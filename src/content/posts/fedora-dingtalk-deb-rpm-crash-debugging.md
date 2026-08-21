---
id: AR-2026-815
slug: fedora-dingtalk-deb-rpm-crash-debugging
title: 钉钉 deb 包转 RPM 后的闪退排查
excerpt: 善用flatpak
date: 2026-08-15
section: tech
status: published
reading: 8 min
tags: [Linux]
category: Tech
sections: [环境, 转储, GBM, 固化, 验证, 回滚]
---

钉钉 8.1.0 的 deb 包转成 RPM 安装到 Fedora 44 后，主窗口正常出现；加载文档或智能表格数秒后段错误退出。

问题出在一组运行库冲突上：钉钉先加载 Debian 版 GBM，Fedora 的 Mesa 驱动随后进入同一进程，两边对 DRI 扩展表的理解对不上。换掉 GBM 后，旧版 `libstdc++` 和 `envlib.so` 又先后冒了出来。

修复只在 `$HOME/.local` 放两个文件，钉钉安装目录不用改。

## 环境

```text
Fedora       44
Kernel       7.0.7-200.fc44.x86_64
Session      Wayland / niri
GPU          Intel Meteor Lake-P / Intel Arc Graphics
DingTalk     8.1.0.6021101-2.x86_64
Mesa         26.0.6-2.fc44
libstdc++    16.1.1-1.fc44
```

钉钉装在 `/opt/apps/com.alibabainc.dingtalk/files/`。当前版本目录写在 `files/version` 中，测试时是 `8.1.0-Release.6021101`。

## 转储

崩溃日志只留下这些：

```text
qt.glx: qglx_findConfig: Failed to finding matching FBConfig ...
Dump path: ~/.config/DingTalk/dump/.../*.dmp
Segmentation fault (core dumped)
```

一开始怀疑 Wayland 和硬件加速，便测试了强制软件渲染：

```bash
QT_QUICK_BACKEND=software
QT_XCB_FORCE_SOFTWARE_OPENGL=1
LIBGL_ALWAYS_SOFTWARE=1
MESA_LOADER_DRIVER_OVERRIDE=swrast
```

现象没变。

系统桌面入口实际调用的是钉钉 `files` 目录里的 `Elevator.sh`，其中有一段：

```bash
LD_PRELOAD="./envlib.so ./libgbm.so ./plugins/dtwebview/libcef.so" \
    ./com.alibabainc.dingtalk
```

`LD_PRELOAD` 把三个库提前塞进全局符号空间。`libgbm.so` 来自 deb 包，后面加载的 DRI 驱动则来自 Fedora Mesa。

转储里的调用现场很明确：

- 指令指针是 `RIP=0`；
- 栈顶返回地址落在钉钉自带的 `libgbm.so.1.0.0`；
- 返回地址前是 `call *0x50(%rax)`；
- `%rax` 指向 Fedora `libdril_dri.so` 的 `__DRI_DRI2` v5 扩展表；
- 表内偏移 `0x50` 的函数指针为 `NULL`。

间接调用最终跳到地址 `0`。基础 Qt 界面没走这条路径，所以窗口能显示；CEF 的 WebView 一建立图形上下文，进程就崩了。

deb 转 RPM 只是重新封装文件，程序和这些动态库的 ABI 没有随之转换。

## GBM

将 `LD_PRELOAD` 中的 GBM 换成 `/usr/lib64/libgbm.so.1` 后，空指针崩溃消失，Mesa 随即报出另一处冲突：

```text
MESA-LOADER: failed to open dri: ./libstdc++.so.6:
version `GLIBCXX_3.4.26' not found
(required by /lib64/libgallium-26.0.6.so)
```

钉钉自带 `libstdc++.so.6` 的最高符号版本是 `GLIBCXX_3.4.25`，Fedora 这份是 `GLIBCXX_3.4.35`。`libgallium-26.0.6.so` 确实引用 `GLIBCXX_3.4.26`。

GBM 和 C++ 运行时只好一起换成 Fedora 版本。

再启动，NSS 又崩在 `libfreeblpriv3.so` 的随机数健康检查里：

```text
PRNGTEST_RunHealthTests
  -> PRNGTEST_Generate
  -> prng_reseed
  -> prng_getEntropy
```

当时 `envlib.so` 仍由 `LD_PRELOAD` 强制加载，并导出 `getentropy`、`getrandom` 两个函数：

```bash
$ nm -D envlib.so | grep -E ' (getrandom|getentropy)$'
0000000000001406 T getentropy
0000000000004678 T getrandom
```

这两个实现的符号优先级高于 glibc，NSS 实际调用的就是它们。移除 `envlib` 后，NSS 不再崩溃。我没有继续反汇编 `envlib`，因为启动过程已经不依赖它；CEF 留在插件目录里就能正常加载。

四组启动结果：

| 启动方式 | 结果 |
|---|---|
| 钉钉 GBM + Fedora Mesa | GBM 间接调用跳到地址 `0` |
| Fedora GBM + 钉钉 libstdc++ | 缺少 `GLIBCXX_3.4.26` |
| Fedora GBM/C++ + 预加载 envlib/CEF | NSS 随机数路径崩溃 |
| Fedora GBM/C++ + 正常加载 CEF | 文档、智能表格正常 |

## 固化

最终只新增两个用户级文件：

```text
~/.local/bin/dingtalk-fedora
~/.local/share/applications/com.alibabainc.dingtalk.desktop
```

### 启动脚本

保存为 `~/.local/bin/dingtalk-fedora`：

```bash
#!/usr/bin/bash

set -u

app_root=/opt/apps/com.alibabainc.dingtalk/files
version_file="$app_root/version"

if [[ ! -r "$version_file" ]]; then
    echo "DingTalk version file not found: $version_file" >&2
    exit 1
fi

release_name=$(tr -d '\r\n' < "$version_file")
release_dir="$app_root/$release_name"
executable="$release_dir/com.alibabainc.dingtalk"

if [[ ! -x "$executable" ]]; then
    echo "DingTalk executable not found: $executable" >&2
    exit 1
fi

for library in /usr/lib64/libstdc++.so.6 /usr/lib64/libgbm.so.1; do
    if [[ ! -e "$library" ]]; then
        echo "Required Fedora library not found: $library" >&2
        exit 1
    fi
done

export QT_QPA_PLATFORM=xcb
export QT_PLUGIN_PATH="$release_dir"
export LD_LIBRARY_PATH="$release_dir/plugins/dtwebview"
export LD_PRELOAD=/usr/lib64/libstdc++.so.6:/usr/lib64/libgbm.so.1

unset QT_QUICK_BACKEND
unset QT_XCB_FORCE_SOFTWARE_OPENGL
unset LIBGL_ALWAYS_SOFTWARE
unset MESA_LOADER_DRIVER_OVERRIDE

cd "$release_dir" || exit 1
exec "$executable" "$@"
```

```bash
chmod 0755 ~/.local/bin/dingtalk-fedora
```

脚本从 `files/version` 读取发布目录，升级后仍会找到当前版本。

### 桌面入口

保存为 `~/.local/share/applications/com.alibabainc.dingtalk.desktop`：

```ini
[Desktop Entry]
Categories=Network;Chat;
Comment=钉钉（Fedora 兼容启动器）
Exec=/home/YOUR_USER/.local/bin/dingtalk-fedora %u
GenericName=dingtalk
Icon=/opt/apps/com.alibabainc.dingtalk/files/logo.ico
Keywords=dingtalk;
MimeType=x-scheme-handler/dingtalk;x-scheme-handler/dingtalk_std_ind;
Name=钉钉
StartupNotify=true
Terminal=false
Type=Application
X-Deepin-Vendor=user-custom
```

把 `YOUR_USER` 换成用户名。`Exec` 字段不会展开 `$HOME` 或 `~`，这里要写完整路径。

```bash
update-desktop-database ~/.local/share/applications
```

这个文件沿用 RPM 桌面入口的 ID。XDG 会先查 `$HOME/.local/share/applications`，应用菜单以及 `dingtalk://`、`dingtalk_std_ind://` 两种链接都会走新脚本。RPM 更新写入 `/opt` 和 `/usr/share`，不会碰到它。

## 验证

```bash
bash -n ~/.local/bin/dingtalk-fedora
desktop-file-validate \
    ~/.local/share/applications/com.alibabainc.dingtalk.desktop

xdg-mime query default x-scheme-handler/dingtalk
xdg-mime query default x-scheme-handler/dingtalk_std_ind
```

两条查询都应返回：

```text
com.alibabainc.dingtalk.desktop
```

还可以直接查看主进程加载了哪些库：

```bash
grep -E '/(libstdc\+\+|libgbm|libgallium|libnss3|libfreeblpriv3)\.so' \
    /proc/PID/maps | sed -E 's/.* //' | sort -u
```

本次运行加载的是：

```text
/usr/lib64/libgbm.so.1.0.0
/usr/lib64/libstdc++.so.6.0.35
/usr/lib64/libgallium-26.0.6.so
/usr/lib64/libnss3.so
/usr/lib64/libfreeblpriv3.so
```

文档、智能表格和 `dingtalk://` 深链都已测试。主进程持续运行，`~/.config/DingTalk/dump/` 没再产生新文件。

## 回滚

两个文件均位于 `$HOME`，权限仅涉及当前用户。若 `files/version`、CEF 目录或主程序文件名发生变化，需同步调整脚本。

上游修好 Linux 启动问题后，删掉这两个文件即可恢复 RPM 自带入口：

```bash
rm ~/.local/bin/dingtalk-fedora
rm ~/.local/share/applications/com.alibabainc.dingtalk.desktop
update-desktop-database ~/.local/share/applications
```
