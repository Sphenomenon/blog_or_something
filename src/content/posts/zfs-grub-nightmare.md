---
id: AR-2026-121
slug: zfs-grub-nightmare
title: Ubuntu 22.04 LTS 内核文件丢失的 systemd-boot 邪修方案
excerpt: Ubuntu20.04LTS
date: 2025-09-30
section: tech
status: published
reading: 6 min
tags:
  - 技术
category: Tech
sections:
  - 第一次
  - 第二次
  - 邪修
---

## 第一次

开机，黑屏，错误信息：

```
error: no such device: 7ff77852ffc815f
error: file '/BOOT/ubuntu_rxdoyz@/vmlinuz-6.8.0-40-generic' not found
error: you need to load the kernel first
```

愣了三秒，重启，还是一样。内核文件不见了。

第一反应是拿 live USB 进去修。挂载 zpool，解密，chroot，重装 GRUB——标准流程，对吧？

> 最初重装系统时给系统盘设了 LUKS 加密，而我**并没有备份密钥文件**。


---

## 第二次

新系统很听话。我们度过了和谐的两周。

然后昨天下午，打开电脑时，熟悉的画面又出现了。

叒叕是同样的报错。

好在这次没设密钥。我顺利地在 live USB 中挂载了 pool，翻日志、查资料，最后把问题定位到 GRUB：

**GRUB 不兼容 ZFS 的新特性。**

GRUB 对 ZFS 的支持一直停留在较早的水平。如果 bpool 开启了 snapshot 功能，GRUB 解析引导路径时会找不到设备。

---

## 邪修方案

稳妥的做法是换用支持 ZFS 的引导器，或者调整 pool 的 feature flags。但我当时没看到那篇文章。

我最后用了更野的办法。

直接破坏 GRUB 配置，让引导流程 fallback 到 systemd-boot，绕过 GRUB 的算法问题。

> 别问为什么不用正解。问就是我倒腾完了才看见那篇正确的文章。

但这又带来了新问题：systemd-boot 只能访问 EFI 分区。如果你不同步 zpool 里的内核文件，新旧内核割裂太久，旧内核文件会被系统判定为损坏。那就回到最初的报错了。

翻了无数遍文档后，我写了一个脚本，用 `inotifywait` 监控内核文件改动，并自动同步到 EFI 分区：

```bash
#!/bin/bash
# 监控 /boot 下的内核文件变更，自动同步到 EFI 分区
inotifywait -m -e close_write --format '%w%f' /boot |
while read file; do
  case "$file" in
    *vmlinuz-*|*initrd.img-*|*System.map-*)
      cp "$file" /efi/EFI/ubuntu/
      echo "synced: $file"
      ;;
  esac
done
```
---

## 叛逃

问题是解决了。

但是感觉缝缝补补导致我的系统往**屎山代码**的方向发展了。
现在不敢轻举妄动升级系统，生怕把内核搞崩。

**就和 22.04 过一辈子吧。**

P.S. 笔者在 2025 年 10 月逃到了 Fedora 床上。
