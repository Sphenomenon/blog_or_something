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

## 先说解决办法

如果 Logisim-evolution 在 niri 中能够创建窗口，但内容始终是白色，可以先从终端测试：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 \
  /opt/logisim-evolution/bin/logisim-evolution
```

如果程序可以直接通过命令名启动：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 logisim-evolution
```

Flatpak 版可以测试：

```bash
flatpak run \
  --env=_JAVA_AWT_WM_NONREPARENTING=1 \
  com.github.reds.LogisimEvolution
```

这个变量不会切换 Wayland，也不会关闭 Java 硬件加速。它让 AWT 将当前 X11 环境视为 non-reparenting window manager。

设置后，本机的 Logisim 主界面立即恢复。xwayland-satellite #244 记录了相同现象和处理方法，niri 与 xwayland-satellite 的文档也将它列为部分 Java 应用的兼容配置。

## 问题现象

我在 niri 会话中启动 Logisim-evolution 4.0.0 时，程序窗口可以正常创建，但窗口内容完全是白色的：

- 窗口能被 niri 识别；
- 可以聚焦、移动和关闭；
- 程序进程没有崩溃；
- 同一个安装包在 GNOME 中显示正常；
- 在 niri 中，窗口主体始终没有正常绘制。

此前 Steam 也出现过窗口存在、内容不可见的黑屏，关闭 GPU 硬件加速后恢复。我因此先查了 Logisim 的 GPU 加速、Mesa 和 Xwayland 缓冲区路径。Steam 使用 CEF，Logisim 使用 Java AWT/Swing；现有观察不足以把两个问题归为同一原因。

## 测试环境

本次排查使用的环境如下：

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

Logisim-evolution 来自安装在 `/opt/logisim-evolution` 下的 RPM 包：

```text
/opt/logisim-evolution/bin/logisim-evolution
/opt/logisim-evolution/lib/app/logisim-evolution-4.0.0-all.jar
/opt/logisim-evolution/lib/app/logisim-evolution.cfg
/opt/logisim-evolution/lib/runtime/
```

这个安装包自带 Java 运行时。系统默认的 OpenJDK 25 配置不会自动作用于 Logisim。

可以通过下面的命令确认 Logisim 实际使用的 Java：

```bash
/opt/logisim-evolution/bin/logisim-evolution --version
```

本机输出中包含：

```text
Logisim-evolution v4.0.0
Java HotSpot(TM) 64-Bit Server VM v22.0.2 (Oracle Corporation)
```

## 确认会话中的 Xwayland 可达

niri 是滚动平铺式 Wayland 合成器，当前环境通过 xwayland-satellite 为 X11 应用提供 rootless Xwayland 集成。本机使用的 JDK 22 AWT/Swing 界面走 X11 兼容路径；下面的检查用于确认 niri 已管理该窗口，并且会话中的 X display 与 GLX 可以正常访问。

启动 Logisim 后运行：

```bash
niri msg windows
```

可以看到类似信息：

```text
Title: "main of Untitled · Logisim-evolution v4.0.0"
App ID: "com-cburch-logisim-Main"
```

这说明 niri 已经识别并管理该窗口。还可以进行只读检查：

```bash
printf 'DISPLAY=%s\n' "$DISPLAY"
xdpyinfo >/dev/null && echo 'X display is reachable'
glxinfo -B
```

本机的 `glxinfo -B` 输出显示直接渲染和 Mesa Intel 图形渲染器可用：

```text
direct rendering: Yes
OpenGL renderer string: Mesa Intel(R) Arc(tm) Graphics (MTL)
Accelerated: yes
```

当前 `$DISPLAY` 可达，基础 GLX 初始化成功。Java2D、Xwayland 与合成器之间的后续路径仍需单独检查。

## 第一轮怀疑：niri 的透明度规则

排查时，我的 niri 配置中有一条对所有窗口生效的规则：

```kdl
window-rule {
    geometry-corner-radius 12
    clip-to-geometry true
    opacity 0.99
    draw-border-with-background false
}
```

```kdl
opacity 0.99
```

会让窗口进入半透明合成路径。即使 0.99 与 1.0 肉眼几乎没有区别，它仍可能增加额外的合成工作。

niri 提供了运行时切换规则透明度的动作：

```bash
niri msg action toggle-window-rule-opacity
```

将 Logisim 临时恢复为完全不透明后，窗口依然是白色。`opacity 0.99` 会增加合成工作，却不是本次白屏的触发条件；删除它也不能解决问题。

## 第二轮怀疑：Java2D 硬件加速

下一步检查 Java2D 绘制管线。

Linux X11 环境中的 Java2D 可能使用 XRender、OpenGL 或 X11 pixmap 离屏缓存。为了判断是不是某个加速后端异常，我依次测试了以下参数。

### 禁用 XRender

```bash
JDK_JAVA_OPTIONS='-Dsun.java2d.xrender=false' \
  /opt/logisim-evolution/bin/logisim-evolution
```

结果：仍然白屏。

### 禁用 pixmap 离屏缓存

```bash
JDK_JAVA_OPTIONS='-Dsun.java2d.pmoffscreen=false' \
  /opt/logisim-evolution/bin/logisim-evolution
```

结果：仍然白屏。

### 同时禁用多个 Java2D 加速路径

```bash
JDK_JAVA_OPTIONS='-Dsun.java2d.xrender=false -Dsun.java2d.opengl=false -Dsun.java2d.pmoffscreen=false' \
  /opt/logisim-evolution/bin/logisim-evolution
```

结果：仍然白屏。

三组参数都无效，关闭 Java2D 硬件加速无法复现有效修复。Steam 的 CEF GPU 合成路径也不能直接套到 Java AWT/Swing 上。

需要说明的是，`sun.java2d.*` 属于 JDK 内部实现属性，不是稳定的 Java SE 公共 API。它们适合用于隔离问题，不适合作为没有证据支撑的长期配置。

## 找到匹配的上游问题

继续检索 xwayland-satellite 的上游资料后，我找到了与本次现象匹配的 issue：

- [Logisim Evolution isn't displayed (blank white window) · xwayland-satellite #244](https://github.com/Supreeeme/xwayland-satellite/issues/244)

报告中的现象与本机一致：

- Logisim-evolution 窗口为空白；
- 在其他 Xwayland 环境中表现不同；
- 问题出现在 niri 与 xwayland-satellite 的组合下；
- 设置 `_JAVA_AWT_WM_NONREPARENTING=1` 后恢复正常。

xwayland-satellite 的 README 和 niri 的 Application Issues 文档也给出了同一个环境变量：

```bash
_JAVA_AWT_WM_NONREPARENTING=1
```

## 这个变量改变了什么

### Reparenting 与 non-reparenting

在经典 X11 桌面中，窗口管理器可能会为应用创建的顶层窗口增加一个父窗口，用于绘制标题栏、边框和窗口控制按钮。应用窗口因此被“重新设置父级”，即 reparenting。

部分 X11 窗口管理环境不采用这个模型。xwayland-satellite 为 Wayland 合成器提供 rootless Xwayland 集成，并承担必要的 X11 窗口管理工作；AWT 在这里需要走 non-reparenting 路径。

### AWT 的兼容判断

Java AWT 的 X11 实现包含窗口管理器识别与兼容分支。OpenJDK 中的 `_JAVA_AWT_WM_NONREPARENTING` 强制 AWT 将当前环境视为 non-reparenting window manager。

上游记录与本机 A/B 测试都指向这条兼容分支：变量设为 `1` 后，AWT 改走 non-reparenting 路径，空白窗口恢复。测试没有逐项跟踪 AWT 事件、缓冲区提交和重绘，因此无法确定更底层的失败点。

相关资料还包括：

- [JDK-8058197：AWT fails on generic non-reparenting window managers](https://bugs.openjdk.org/browse/JDK-8058197)
- [Blank white screen when running Arch Linux · Logisim-evolution #1235](https://github.com/logisim-evolution/logisim-evolution/issues/1235)

## 本机 A/B 验证

使用下面的命令启动：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 \
  /opt/logisim-evolution/bin/logisim-evolution
```

Logisim 主界面立即恢复正常，包括：

- 顶部菜单栏；
- 工具栏；
- 左侧元件树；
- 电路编辑区域；
- 属性面板；
- 缩放控件。

测试过程中以下项目没有变化：

- Logisim 版本；
- Logisim 内置 JDK；
- Mesa 驱动；
- Xwayland 版本；
- xwayland-satellite 版本；
- Java2D 加速设置。

唯一改变的变量是：

```bash
_JAVA_AWT_WM_NONREPARENTING=1
```

它是本机环境中的有效修复。其他 Java 程序仍需分别验证。

## 临时使用

只需要使用一次时，建议直接为当前进程设置变量：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 logisim-evolution
```

这只会影响当前进程及其子进程，不会修改整个桌面会话。

如果直接运行 JAR：

```bash
env _JAVA_AWT_WM_NONREPARENTING=1 \
  java -jar logisim-evolution.jar
```

## 永久方案一：用户级 Desktop Entry 覆盖

如果只有 Logisim 出问题，优先使用这个方案。

不要直接修改 `/opt/logisim-evolution` 中由 RPM 管理的文件，否则升级时修改可能被覆盖。

先创建用户应用目录：

```bash
mkdir -p ~/.local/share/applications
```

复制软件包提供的 Desktop Entry：

```bash
cp /opt/logisim-evolution/lib/logisim-evolution-logisim-evolution.desktop \
  ~/.local/share/applications/
```

编辑用户副本：

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

完成后可以刷新应用数据库：

```bash
update-desktop-database ~/.local/share/applications
```

完全退出已有 Logisim 进程，再从应用启动器中打开即可。

这个方案只影响 Logisim，不需要 root，也不修改 RPM 管理的文件。用户级 Desktop Entry 会覆盖软件包提供的同名入口；软件升级后，应检查上游入口是否变化。

## 永久方案二：包装脚本

如果经常从终端启动 Logisim，可以创建：

```text
~/.local/bin/logisim-evolution-niri
```

内容如下：

```sh
#!/bin/sh

exec env _JAVA_AWT_WM_NONREPARENTING=1 \
  /opt/logisim-evolution/bin/logisim-evolution "$@"
```

添加执行权限：

```bash
chmod +x ~/.local/bin/logisim-evolution-niri
```

以后运行：

```bash
logisim-evolution-niri
```

这种方式不会修改应用菜单。需要菜单入口时，再让用户级 Desktop Entry 的 `Exec=` 指向该脚本。

## 永久方案三：在 niri 会话中设置

如果多个 Java AWT/Swing 应用都有空白窗口、窗口不刷新或弹出窗口异常，可以在 niri 会话中统一设置。

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

然后注销并重新登录 niri 会话，使之后启动的程序继承新环境变量。

环境变量在进程启动时继承。niri 重新加载配置后，已经运行的程序和部分由 systemd 或 D-Bus 激活的程序不会自动获得新变量。修改后应注销并重新登录。

非 Java 程序通常会忽略这个变量，但所有 Java AWT/Swing 程序都可能改变窗口管理器检测行为。只有 Logisim 出问题时，不必扩大到整个会话。

## Flatpak 用户

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

不同打包来源的应用 ID 可能不同，可以先确认：

```bash
flatpak list | grep -i logisim
```

## 为什么不优先使用其他修复

### 不把禁用 GPU 加速当作主方案

本机已经验证以下参数均不能解决白屏：

```text
-Dsun.java2d.xrender=false
-Dsun.java2d.opengl=false
-Dsun.java2d.pmoffscreen=false
```

继续堆叠 Java2D 私有参数会增加性能损失和维护成本，也会破坏单变量对照。

### 不全局强制软件渲染

例如：

```bash
LIBGL_ALWAYS_SOFTWARE=1 application-command
```

它可用于诊断 GPU 驱动问题，但会让 OpenGL 程序改用 CPU 软件渲染。本次测试没有理由把它留作永久配置。

### 不直接修改 `/opt` 下的文件

`_JAVA_AWT_WM_NONREPARENTING` 是环境变量，不是 JVM `-D` 属性。直接编辑 `/opt/logisim-evolution/lib/app/logisim-evolution.cfg` 会修改 RPM 管理的内容，并可能在升级时被覆盖。

### 不优先使用 `wmname LG3D`

早期处理 Java 与 non-reparenting 窗口管理器的兼容问题时，常见方法是：

```bash
wmname LG3D
```

它通过伪装窗口管理器名称影响 Java 的识别逻辑，也可能改变其他程序的行为。`_JAVA_AWT_WM_NONREPARENTING` 的作用更直接，也更容易限制范围。

## 建议的排查顺序

以后在 niri 中遇到 Java GUI 空白窗口，可以按以下顺序排查。

### 1. 确认应用仍在运行

```bash
pgrep -af java
niri msg windows
```

如果窗口能被 niri 列出，说明应用至少完成了窗口创建。

### 2. 确认 Xwayland 可达

```bash
printf 'DISPLAY=%s\n' "$DISPLAY"
xdpyinfo >/dev/null && echo 'Xwayland is reachable'
```

不要硬编码 `DISPLAY=:0`；当前 niri 会为会话选择并导出实际的显示号。

### 3. 优先测试 non-reparenting 方案

```bash
_JAVA_AWT_WM_NONREPARENTING=1 application-command
```

如果立即恢复，就没有必要先修改 Mesa 或堆叠 Java2D 参数。

### 4. 确认应用实际使用的 Java

不要默认应用使用 `/usr/bin/java`。AppImage、Flatpak、jpackage、JetBrains 和某些 RPM/DEB 包都可能自带运行时。

如果应用支持，可以先运行：

```bash
application-command --version
```

否则，先确认目标进程的 PID，再检查其实际可执行文件和命令行：

```bash
readlink -f /proc/PID/exe
tr '\0' ' ' < /proc/PID/cmdline
```

将 `PID` 替换为已经确认属于该应用的进程号，避免从其他 Java 进程推断运行时版本。

RPM 包还可以查看文件列表：

```bash
rpm -ql package-name
```

### 5. 前面无效时再隔离图形管线

例如：

```bash
JDK_JAVA_OPTIONS='-Dsun.java2d.xrender=false' application-command
```

或者仅用于诊断：

```bash
LIBGL_ALWAYS_SOFTWARE=1 application-command
```

每次只改变一个变量并记录结果。一次加入多个环境变量，即使问题消失，也无法确认是哪一个生效。

## 参考资料

- [niri：Xwayland 文档](https://github.com/niri-wm/niri/blob/main/docs/wiki/Xwayland.md)
- [niri：Application Issues](https://github.com/niri-wm/niri/blob/main/docs/wiki/Application-Issues.md)
- [xwayland-satellite README](https://github.com/Supreeeme/xwayland-satellite)
- [Logisim Evolution isn't displayed (blank white window) · xwayland-satellite #244](https://github.com/Supreeeme/xwayland-satellite/issues/244)
- [Blank white screen when running Arch Linux · Logisim-evolution #1235](https://github.com/logisim-evolution/logisim-evolution/issues/1235)
- [JDK-8058197：AWT fails on generic non-reparenting window managers](https://bugs.openjdk.org/browse/JDK-8058197)
- [IntelliJ Idea show weird blank screen · sway #595](https://github.com/swaywm/sway/issues/595)
