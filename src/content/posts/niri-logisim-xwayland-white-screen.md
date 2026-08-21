---
id: AR-2026-719
slug: niri-logisim-xwayland-white-screen
title: niri 下 Logisim-evolution 白屏问题
excerpt: 记录 Logisim-evolution 在 niri 与 xwayland-satellite 环境中出现空白窗口的排查过程，以及 non-reparenting 兼容方案。
date: 2026-07-19
section: tech
status: published
reading: 14 min
tags: [Linux, niri, Java]
category: Tech
sections: [问题现象, 排查过程, 兼容方案, 永久配置, 结论]
---

## 先修好再说

Logisim-evolution 能开窗口，内容却一片白时，先从终端这样启动：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 \
  /opt/logisim-evolution/bin/logisim-evolution
```

程序在 `PATH` 中的话，用短一点的命令：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 logisim-evolution
```

Flatpak 版则是：

```bash
flatpak run \
  --env=_JAVA_AWT_WM_NONREPARENTING=1 \
  com.github.reds.LogisimEvolution
```

`_JAVA_AWT_WM_NONREPARENTING` 只改变 AWT 对 X11 窗口管理器的识别，和 Wayland、硬件加速开关无关。

本机加上这个变量后，Logisim 主界面立即恢复。

## 问题现象

我在 niri 会话中启动 Logisim-evolution 4.0.0，窗口能聚焦、移动和关闭，进程也没崩，就是整块内容全白。同一个安装包放到 GNOME 里一切正常。

Steam 此前也黑过屏，关掉 GPU 硬件加速就能恢复。我自然先去查 Logisim 的 GPU 加速、Mesa 和 Xwayland 缓冲区，后来发现只是症状相像：Steam 用 CEF，Logisim 走 Java AWT/Swing。

## 测试环境

当时的环境：

| 组件 | 版本或信息 |
| --- | --- |
| 操作系统 | Fedora Linux 44 |
| 内核 | Linux 7.0.7 |
| Wayland 合成器 | niri 26.04 |
| Xwayland 集成 | xwayland-satellite 0.8.1 |
| Xwayland | 24.1.11 |
| 显卡 | Intel Meteor Lake Arc Graphics |
| 内核驱动 | i915 |
| Mesa | 26.0.6 |
| Logisim-evolution | 4.0.0 |
| Logisim 内置 Java | Oracle JDK 22.0.2 |

我装的是 RPM 包，文件都在 `/opt/logisim-evolution`：

```text
/opt/logisim-evolution/bin/logisim-evolution
/opt/logisim-evolution/lib/app/logisim-evolution-4.0.0-all.jar
/opt/logisim-evolution/lib/app/logisim-evolution.cfg
/opt/logisim-evolution/lib/runtime/
```

安装包自带 Java 运行时，所以折腾系统默认的 OpenJDK 25 没用。

实际使用的 Java 可以这样查：

```bash
/opt/logisim-evolution/bin/logisim-evolution --version
```

本机输出中包含：

```text
Logisim-evolution v4.0.0
Java HotSpot(TM) 64-Bit Server VM v22.0.2 (Oracle Corporation)
```

## Xwayland 没断

niri 通过 xwayland-satellite 接入 X11 应用，本机这份 JDK 22 AWT/Swing 也走 X11。先确认窗口已经交给 niri，X display 和 GLX 也能访问。

启动 Logisim 后运行：

```bash
niri msg windows
```

输出里有这个窗口：

```text
Title: "main of Untitled · Logisim-evolution v4.0.0"
App ID: "com-cburch-logisim-Main"
```

niri 已经接管窗口。再查 `$DISPLAY` 和 GLX：

```bash
printf 'DISPLAY=%s\n' "$DISPLAY"
xdpyinfo >/dev/null && echo 'X display is reachable'
glxinfo -B
```

本机的 `glxinfo -B` 显示直接渲染和 Mesa Intel 渲染器都能用：

```text
direct rendering: Yes
OpenGL renderer string: Mesa Intel(R) Arc(tm) Graphics (MTL)
Accelerated: yes
```

到这里，`$DISPLAY` 和基础 GLX 都没问题。白屏发生在更后面的路径。

## 透明度不是原因

我的 niri 配置对所有窗口套了这条规则：

```kdl
window-rule {
    geometry-corner-radius 12
    clip-to-geometry true
    opacity 0.99
    draw-border-with-background false
}
```

其中的 `opacity 0.99` 会让窗口进入半透明合成路径。0.99 和 1.0 肉眼看不出差别，合成器走的路径却不同。

可以临时关掉这条透明度规则：

```bash
niri msg action toggle-window-rule-opacity
```

切回完全不透明，Logisim 还是白的。这条规则确实多添了一层合成，但和本次故障无关。

## 关掉 Java2D 加速也没用

Linux X11 下的 Java2D 可能走 XRender、OpenGL 或 X11 pixmap 离屏缓存。我分别关掉 XRender、离屏缓存，又把几个加速路径一起禁用：

```bash
JDK_JAVA_OPTIONS='-Dsun.java2d.xrender=false' \
  /opt/logisim-evolution/bin/logisim-evolution

JDK_JAVA_OPTIONS='-Dsun.java2d.pmoffscreen=false' \
  /opt/logisim-evolution/bin/logisim-evolution

JDK_JAVA_OPTIONS='-Dsun.java2d.xrender=false -Dsun.java2d.opengl=false -Dsun.java2d.pmoffscreen=false' \
  /opt/logisim-evolution/bin/logisim-evolution
```

三次启动，三次白屏。Steam 那套“关 GPU 加速”的办法搬不过来。

`sun.java2d.*` 是 JDK 内部属性，适合拿来隔离故障，不该在没有证据时留作长期配置。

## 上游也有人踩过

[xwayland-satellite #244](https://github.com/Supreeeme/xwayland-satellite/issues/244) 里的 Logisim-evolution 同样只剩白色窗口，问题也出现在 niri 与 xwayland-satellite 的组合下。设置 `_JAVA_AWT_WM_NONREPARENTING=1` 后，窗口恢复。xwayland-satellite 的 README 和 niri 的 Application Issues 文档都写了这个配置。

## AWT 的 non-reparenting 分支

经典 X11 窗口管理器常会给应用窗口套一个父窗口，用来画标题栏和边框，这叫 reparenting。xwayland-satellite 提供的是 rootless Xwayland 集成，不走这套模型。

Java AWT 的 X11 实现会识别窗口管理器，再选择对应的兼容分支。`_JAVA_AWT_WM_NONREPARENTING=1` 强制它把当前环境当作 non-reparenting window manager。

上游报告和本机对照都指向这条分支：变量设为 `1`，白屏立刻消失。我没有继续跟踪 AWT 的事件和重绘过程，所以更底层卡在哪一步还不知道。

另外两份相关记录：

- [JDK-8058197：AWT fails on generic non-reparenting window managers](https://bugs.openjdk.org/browse/JDK-8058197)
- [Blank white screen when running Arch Linux · Logisim-evolution #1235](https://github.com/logisim-evolution/logisim-evolution/issues/1235)

## 本机对照

保持 Logisim、内置 JDK、Mesa、Xwayland 和 xwayland-satellite 的版本不变，启动时只多加 `_JAVA_AWT_WM_NONREPARENTING=1`。菜单、元件树和编辑区全部恢复，Java2D 设置没有改动。这足以确认变量在本机有效，但不代表所有 Java 白屏都能这样修。

直接运行 JAR 时，把变量交给当前进程即可：

```bash
env _JAVA_AWT_WM_NONREPARENTING=1 \
  java -jar logisim-evolution.jar
```

这两种写法只影响本次启动的进程及其子进程。

## 固化

### 只改 Logisim：桌面入口

只有 Logisim 出问题时，改用户级 Desktop Entry 就够了。

不要改 `/opt/logisim-evolution` 里的 RPM 文件，升级时会被覆盖。

创建用户应用目录：

```bash
mkdir -p ~/.local/share/applications
```

复制软件包提供的 Desktop Entry：

```bash
cp /opt/logisim-evolution/lib/logisim-evolution-logisim-evolution.desktop \
  ~/.local/share/applications/
```

然后编辑用户副本：

```bash
nano ~/.local/share/applications/logisim-evolution-logisim-evolution.desktop
```

将原来的启动命令：

```ini
Exec=/opt/logisim-evolution/bin/logisim-evolution
```

改为：

```ini
Exec=env _JAVA_AWT_WM_NONREPARENTING=1 /opt/logisim-evolution/bin/logisim-evolution
```

如果原始 `Exec=` 中存在 `%f`、`%F`、`%u` 或 `%U` 等字段代码，必须保留。例如：

```ini
Exec=env _JAVA_AWT_WM_NONREPARENTING=1 /opt/logisim-evolution/bin/logisim-evolution %F
```

刷新应用数据库：

```bash
update-desktop-database ~/.local/share/applications
```

完全退出已有进程，再从应用启动器打开。这个副本不需要 root，也不会碰 RPM 文件；软件升级后，记得看一眼上游入口有没有改过。

### 从终端启动：包装脚本

如果经常从终端启动 Logisim，可以创建：

```text
~/.local/bin/logisim-evolution-niri
```

```sh
#!/bin/sh

exec env _JAVA_AWT_WM_NONREPARENTING=1 \
  /opt/logisim-evolution/bin/logisim-evolution "$@"
```

添加执行权限：

```bash
chmod +x ~/.local/bin/logisim-evolution-niri
```

以后直接运行：

```bash
logisim-evolution-niri
```

包装脚本不管应用菜单。需要菜单入口时，让用户级 Desktop Entry 的 `Exec=` 指向它。

### 多个 Java 程序都白屏

如果不止 Logisim，多个 AWT/Swing 程序都白屏或不刷新，可以把变量放进 niri 会话。

编辑：

```text
~/.config/niri/config.kdl
```

在已有的 `environment` 块中加入：

```kdl
environment {
    _JAVA_AWT_WM_NONREPARENTING "1"
}
```

保存后验证配置：

```bash
niri validate -c ~/.config/niri/config.kdl
```

保存后注销并重新登录。环境变量在进程启动时继承，单纯重载 niri 配置不会传给已经运行的程序，部分由 systemd 或 D-Bus 拉起的进程也一样。

这个设置会改变所有 AWT/Swing 程序的窗口管理器检测。只有 Logisim 出问题时，还是用桌面入口更省事。

### Flatpak

临时启动：

```bash
flatpak run \
  --env=_JAVA_AWT_WM_NONREPARENTING=1 \
  com.github.reds.LogisimEvolution
```

创建用户级永久覆盖：

```bash
flatpak override --user \
  --env=_JAVA_AWT_WM_NONREPARENTING=1 \
  com.github.reds.LogisimEvolution
```

查看覆盖：

```bash
flatpak override --user --show com.github.reds.LogisimEvolution
```

撤销覆盖：

```bash
flatpak override --user \
  --unset-env=_JAVA_AWT_WM_NONREPARENTING \
  com.github.reds.LogisimEvolution
```

应用 ID 可能不同，先查一眼：

```bash
flatpak list | grep -i logisim
```

## 没留下的几个办法

`LIBGL_ALWAYS_SOFTWARE=1` 可以诊断 GPU 驱动，却会把 OpenGL 扔给 CPU，没必要常驻。前面那组 `sun.java2d.*` 参数已经全部失败，再往上堆只会把单变量对照搅乱。

`_JAVA_AWT_WM_NONREPARENTING` 是环境变量，不是 JVM 的 `-D` 属性。把它写进 `/opt/logisim-evolution/lib/app/logisim-evolution.cfg` 语义不对，RPM 升级还会覆盖文件。

老办法 `wmname LG3D` 靠伪装窗口管理器名称影响 Java，作用范围更难控制。现在有专门的环境变量，没必要再绕这一圈。

## 再碰到同类白屏

我会先看进程和窗口还在不在：

```bash
pgrep -af java
niri msg windows
```

窗口能被 niri 列出，说明程序至少完成了窗口创建。接着查 Xwayland：

```bash
printf 'DISPLAY=%s\n' "$DISPLAY"
xdpyinfo >/dev/null && echo 'Xwayland is reachable'
```

别硬编码 `DISPLAY=:0`，用会话已经导出的值。两项都正常，再试 non-reparenting 变量：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 application-command
```

如果窗口立刻恢复，到这里就可以停。没有恢复的话，先查应用到底用了哪份 Java。AppImage、Flatpak、jpackage、JetBrains 和部分 RPM/DEB 包都会自带运行时，不能默认是 `/usr/bin/java`。

```bash
application-command --version
```

应用不支持 `--version` 时，确认 PID 后直接看可执行文件和命令行：

```bash
readlink -f /proc/PID/exe
tr '\0' ' ' < /proc/PID/cmdline
```

RPM 包还可以查文件列表：

```bash
rpm -ql package-name
```

这些都排完，再单独隔离 Java2D 或 OpenGL。一次只改一个变量，不然修好了也不知道是谁起了作用。

## 参考资料

- [niri：Xwayland 文档](https://github.com/niri-wm/niri/blob/main/docs/wiki/Xwayland.md)
- [niri：Application Issues](https://github.com/niri-wm/niri/blob/main/docs/wiki/Application-Issues.md)
- [xwayland-satellite README](https://github.com/Supreeeme/xwayland-satellite)
- [Logisim Evolution isn't displayed (blank white window) · xwayland-satellite #244](https://github.com/Supreeeme/xwayland-satellite/issues/244)
- [Blank white screen when running Arch Linux · Logisim-evolution #1235](https://github.com/logisim-evolution/logisim-evolution/issues/1235)
- [JDK-8058197：AWT fails on generic non-reparenting window managers](https://bugs.openjdk.org/browse/JDK-8058197)
- [IntelliJ Idea show weird blank screen · sway #595](https://github.com/swaywm/sway/issues/595)
