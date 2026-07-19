---
id: AR-2026-719
slug: niri-logisim-xwayland-white-screen
title: niri 下 Logisim-evolution 白屏：一次 AWT 与 Xwayland 排障记录
excerpt: 记录 Logisim-evolution 在 niri 与 xwayland-satellite 环境中出现空白窗口的排查过程，以及 non-reparenting 兼容方案。
date: 2026-07-19
section: tech
status: published
reading: 14 min
tags: [Linux, niri, Java]
category: Tech
sections: [问题现象, 排查过程, 兼容方案, 永久配置, 结论]
---

> 在 GNOME 中运行正常，换到 niri 后却只剩一个可以移动、可以聚焦的白色窗口。看起来像 GPU 渲染故障，最后有效的处理方式却是让 Java AWT 按 non-reparenting 窗口管理器的路径运行。

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

这个变量不是 Wayland 开关，也不是“关闭 Java 硬件加速”。它会让 AWT 将当前 X11 窗口管理环境按 non-reparenting window manager 处理。

在我的环境中，设置变量后 Logisim 主界面立即恢复。xwayland-satellite #244 记录了相同的 Logisim 空白窗口和相同的 workaround；niri 与 xwayland-satellite 的文档也将这个变量列为部分 Java 应用的兼容方案。不过，更准确地说，它是一个已经验证有效的 workaround，而不是对所有 Java 白屏现象都适用的万能修复。

## 问题现象

我在 niri 会话中启动 Logisim-evolution 4.0.0 时，程序窗口可以正常创建，但窗口内容完全是白色的：

- 窗口能被 niri 识别；
- 可以聚焦、移动和关闭；
- 程序进程没有崩溃；
- 同一个安装包在 GNOME 中显示正常；
- 在 niri 中，窗口主体始终没有正常绘制。

此前 Steam 也出现过类似的黑屏：窗口存在，鼠标可以活动，但内容无法正常显示。关闭 Steam 的 GPU 硬件加速后，Steam 恢复正常。因此我最初很容易怀疑 Logisim 的白屏也是 GPU 加速、Mesa 或 Xwayland 缓冲区导致的。

不过，这两个问题最终只是**表象相似**，没有足够证据说明它们具有同一个根因。

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

这个安装包自带 Java 运行时。因此，即使系统默认 Java 是 OpenJDK 25，修改系统 Java 的配置也不一定会影响 Logisim。

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

这说明当前 `$DISPLAY` 可达，基础 GLX 初始化成功，但不能单独证明整个 Java2D、Xwayland 与合成器路径没有问题。

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

其中的：

```kdl
opacity 0.99
```

会让窗口进入半透明合成路径。即使 0.99 与 1.0 肉眼几乎没有区别，它仍可能增加额外的合成工作。

niri 提供了运行时切换规则透明度的动作：

```bash
niri msg action toggle-window-rule-opacity
```

实际测试结果是：将 Logisim 临时恢复为完全不透明后，窗口依然是白色。

因此，全局 `opacity 0.99` 可能增加合成开销，也可能放大某些图形问题，但它不是本次白屏的决定性变量。如果没有特殊需求，我仍然不建议为了几乎不可见的效果对所有窗口设置 0.99；只是删除它不能单独解决这个问题。

## 第二轮怀疑：Java2D 硬件加速

由于 Steam 在关闭 GPU 加速后恢复，下一步自然是检查 Java2D 的绘制管线。

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

这组对照实验不能证明 GPU 路径绝对无误，但显著降低了“只要关闭 Java2D 硬件加速就能修复”的可能性。Steam 使用 Chromium Embedded Framework，其 GPU 合成路径也与 Java AWT/Swing 不同，不能因为症状相似就直接套用同一方案。

需要说明的是，`sun.java2d.*` 属于 JDK 内部实现属性，不是稳定的 Java SE 公共 API。它们适合用于隔离问题，不适合作为没有证据支撑的长期配置。

## 找到匹配的上游问题

继续检索 xwayland-satellite 的上游资料后，我找到了与本次现象匹配的 issue：

- [Logisim Evolution isn't displayed (blank white window) · xwayland-satellite #244](https://github.com/Supreeeme/xwayland-satellite/issues/244)

报告中的现象包括：

- Logisim-evolution 窗口为空白；
- 在其他 Xwayland 环境中表现不同；
- 问题出现在 niri 与 xwayland-satellite 的组合下；
- 设置 `_JAVA_AWT_WM_NONREPARENTING=1` 后恢复正常。

xwayland-satellite 的 README 和 niri 的 Application Issues 文档也提醒：部分 Java 应用在 xwayland-satellite 下可能显示空白窗口，并给出了相同的环境变量。

```bash
_JAVA_AWT_WM_NONREPARENTING=1
```

## 这个变量改变了什么

### Reparenting 与 non-reparenting

在经典 X11 桌面中，窗口管理器可能会为应用创建的顶层窗口增加一个父窗口，用于绘制标题栏、边框和窗口控制按钮。应用窗口因此被“重新设置父级”，即 reparenting。

并不是所有 X11 窗口管理环境都会采用这种模型。xwayland-satellite 为 Wayland 合成器提供 rootless Xwayland 集成，同时承担必要的 X11 窗口管理工作；从 AWT 的角度看，这里需要按 non-reparenting 环境处理。

### AWT 的兼容判断

Java AWT 的 X11 实现包含窗口管理器识别与兼容分支。OpenJDK 中的 `_JAVA_AWT_WM_NONREPARENTING` 会强制 AWT 将当前环境视为 non-reparenting window manager。

结合上游记录和本机 A/B 测试，更稳妥的判断是：

> 这次现象与 Java AWT 在 xwayland-satellite 提供的 X11 窗口管理环境下的兼容判断有关。设置 `_JAVA_AWT_WM_NONREPARENTING=1` 后，AWT 改走 non-reparenting 处理路径，Logisim-evolution 的空白窗口随即恢复。

这个结果与问题发生在 AWT 的窗口管理器兼容分支、而不只是某个 Java2D 绘制后端的判断相符。不过，现有测试没有定位具体失败的事件、缓冲区提交或重绘机制，因此不能仅凭这个 workaround 推导更底层的根因。

不过，我没有对 AWT 内部事件流进行逐事件跟踪，因此不把“某个具体 `ConfigureNotify` 被忽略”写成已经在本机证明的底层根因。这里确认的是修复变量、上游已知问题和可重复的 A/B 结果。

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

整个测试过程中没有修改：

- Logisim 版本；
- Logisim 内置 JDK；
- Mesa 驱动；
- Xwayland 版本；
- xwayland-satellite 版本；
- Java2D 加速设置。

本次 A/B 测试中唯一改变的变量就是：

```bash
_JAVA_AWT_WM_NONREPARENTING=1
```

因此，可以确认它是本机环境中的有效修复。至于其他 Java 程序或不同类型的白屏，仍应分别验证。

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

如果只有 Logisim 出问题，这是最保守的持久方案。

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

这个方案只影响 Logisim、不需要 root，也不修改 RPM 管理的文件。代价是用户级 Desktop Entry 会覆盖软件包提供的同名入口；软件升级后，如果上游入口发生变化，需要偶尔比较两份文件。

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

这种方式不会自动修改应用菜单中的入口。需要菜单入口时，可以再让用户级 Desktop Entry 的 `Exec=` 指向该脚本。

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

环境变量是在进程启动时继承的。即使 niri 重新加载了配置，已经运行的程序，以及部分由 systemd 或 D-Bus 激活的程序，也不一定自动获得新变量。因此，修改会话环境后，注销并重新登录最容易排除继承链问题。

非 Java 程序通常会忽略这个变量，但所有 Java AWT/Swing 程序都可能改变窗口管理器检测行为。如果只有 Logisim 出问题，用户级 Desktop Entry 覆盖仍然更加保守。

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

继续堆叠更多 Java2D 私有参数只会增加性能损失和维护成本。如果这些参数没有形成清晰的单变量对照，也很难判断究竟是哪一个产生了效果。

### 不全局强制软件渲染

例如：

```bash
LIBGL_ALWAYS_SOFTWARE=1 application-command
```

它适合用于诊断 GPU 驱动问题，但会让受影响的 OpenGL 程序改用 CPU 软件渲染。本次有效变量与 AWT 的窗口管理兼容路径有关，没有理由把软件渲染作为永久方案。

### 不直接修改 `/opt` 下的文件

`_JAVA_AWT_WM_NONREPARENTING` 是环境变量，不是普通 JVM `-D` 属性。直接编辑 `/opt/logisim-evolution/lib/app/logisim-evolution.cfg` 不仅语义不合适，还会修改 RPM 管理的内容，并可能在升级时被覆盖。

### 不优先使用 `wmname LG3D`

早期处理 Java 与 non-reparenting 窗口管理器的兼容问题时，常见方法是：

```bash
wmname LG3D
```

它通过伪装窗口管理器名称影响 Java 的识别逻辑，也可能改变其他程序的行为。现在已有语义更直接、作用域更容易控制的 `_JAVA_AWT_WM_NONREPARENTING`，没有必要优先使用这个历史方案。

## Steam 黑屏是否与此相同

大概率不是。

Steam 客户端界面主要基于 Chromium Embedded Framework。关闭 Steam 的 GPU 硬件加速后恢复，更可能指向 Chromium/CEF 的 GPU 合成、图形 API 初始化、缓冲区共享或与合成器的兼容问题。

Logisim-evolution 则是 Java AWT/Swing 程序。本次通过窗口管理兼容变量修复，而不是通过禁用图形加速修复。

所以目前能说的是：

> Steam 和 Logisim 都经过 Xwayland 显示，也都出现了“窗口存在但内容不可见”的现象；但两者有效的 workaround 不同，目前没有足够证据证明它们具有相同的直接原因。

不能仅凭表象相似，就把两者统一归因于 GPU 或 xwayland-satellite；同样也不能只凭 workaround 不同，就断言底层原因一定完全不同。

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

每次只改变一个变量并记录结果。不要一次添加十几个环境变量，否则即使问题消失，也无法知道真正有效的是哪一个。

## 结论

在本机环境中，niri 下的 Logisim-evolution 空白窗口不是通过关闭 Java2D 硬件加速解决的。上游资料和 A/B 测试都指向 Java AWT 与 xwayland-satellite 所提供 X11 窗口管理环境之间的 non-reparenting 兼容问题。

有效的启动方式是：

```bash
_JAVA_AWT_WM_NONREPARENTING=1 \
  /opt/logisim-evolution/bin/logisim-evolution
```

如果只修复 Logisim，推荐使用用户级 Desktop Entry 覆盖或包装脚本；如果多个 Java AWT/Swing 程序都有同类问题，再考虑在 niri 的 `environment` 块中统一设置。

这套方法已经在当前环境和相关上游报告中得到验证，但它仍应被理解为针对特定 AWT/X11 窗口管理兼容问题的 workaround，而不是所有 Wayland、Xwayland 或 Java 白屏的统一答案。

## 参考资料

- [niri：Xwayland 文档](https://github.com/niri-wm/niri/blob/main/docs/wiki/Xwayland.md)
- [niri：Application Issues](https://github.com/niri-wm/niri/blob/main/docs/wiki/Application-Issues.md)
- [xwayland-satellite README](https://github.com/Supreeeme/xwayland-satellite)
- [Logisim Evolution isn't displayed (blank white window) · xwayland-satellite #244](https://github.com/Supreeeme/xwayland-satellite/issues/244)
- [Blank white screen when running Arch Linux · Logisim-evolution #1235](https://github.com/logisim-evolution/logisim-evolution/issues/1235)
- [JDK-8058197：AWT fails on generic non-reparenting window managers](https://bugs.openjdk.org/browse/JDK-8058197)
- [IntelliJ Idea show weird blank screen · sway #595](https://github.com/swaywm/sway/issues/595)
