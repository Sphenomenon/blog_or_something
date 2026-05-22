---
id: AR-2026-121
slug: zfs-grub-nightmare
title: 当 GRUB 遇上 ZFS：一场内核引导的血泪史
excerpt: 从内核文件丢失到密钥锁定，从 GRUB 兼容性故障到 systemd-boot 邪修方案——记录我那台 Linux 主机的三次濒死与一次叛逃。
date: 2026-05-22
section: tech
status: published
reading: 6 min
tags: [Linux, ZFS, GRUB, systemd-boot, 故障排查, 内核]
category: Tech
sections: [第一次, 第二次, 邪修, 叛逃]
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

然后我绝望地发现了一个问题。

> 最初重装系统时给系统盘设了 LUKS 加密，而我**并没有备份密钥文件**。

换成人话说就是：**保险柜的钥匙被锁在保险柜里面。**

神仙也救不了。

更要命的是那周正好有考试。万般无奈之下，只能重装系统。通宵一晚上重新倒腾工具包和 UI 美化——都什么时候了还想着美化，23333。

---

## 第二次

新系统很听话。我们度过了和谐的两周。

然后昨天下午，打开电脑时，熟悉的画面又出现了。

叒叕是同样的报错。

此处应有暴躁老哥砸电脑的 GIF。

好在这次学聪明了，没设密钥。我很顺利地把 pool 挂载到 live 盘里，翻日志，查资料，最终定位到了根因：

**GRUB 不兼容 ZFS 的新特性。**

具体来说，GRUB 对 ZFS 的支持一直停留在比较早期的水平。如果你用了开启了 snapshot 功能的 bpool，GRUB 在解析引导路径时就会找不到设备。

> 打个比方的话，就是点火器和汽车引擎对不上口径。不是车坏了，也不是点火器坏了，就是它俩互相不认。

---

## 邪修方案

按理说，正确的做法是换一个支持 ZFS 的引导器，或者调整 pool 的 feature flags。但我当时没看到那篇文章。

所以我干了件更野的事。

直接破坏 GRUB 配置，让引导流程 fallback 到 systemd-boot，绕过 GRUB 的算法问题。

> 别问为什么不用正解。问就是我倒腾完了才看见那篇正确的文章。

但这又带来了新问题：systemd-boot 只能访问 EFI 分区。如果你不同步 zpool 里的内核文件，新旧内核割裂太久，旧内核文件会被系统判定为损坏。那就回到最初的报错了。

于是 RTFW 无数次之后，决定写一个脚本，用 inotifywait 监控内核文件的改动，自动同步到 EFI 分区：

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

这个脚本纯靠 GPT 写的。楼主实在被干得**道心破碎**，GTFW 无数次之后已经完全不想自己动手写了。

---

## 叛逃

问题是解决了。

但是感觉缝缝补补导致我的系统往**屎山代码**的方向发展了，23333。

现在不敢轻举妄动升级系统，生怕把内核搞崩。

**就和 22.04 过一辈子吧。**

追加：笔者在 25 年 10 月逃到了 Fedora 床上。

冷静，克制。
