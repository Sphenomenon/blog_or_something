# 部署指南：失眠档案馆

## Phase 1: Git + GitHub

1. 初始化 git 仓库：
   ```bash
   git init
   ```

2. 确认 `.gitignore` 已创建（见仓库根目录），然后添加所有文件：
   ```bash
   git add .
   ```

3. 提交：
   ```bash
   git commit -m "init: initial commit"
   ```

4. 在 GitHub 新建仓库（公开或私有均可，两者都支持 Netlify；私有仓库需要授权 Netlify GitHub App）。

5. 关联远程仓库并推送：
   ```bash
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git branch -M main
   git push -u origin main
   ```

6. 验证：浏览器打开 GitHub 仓库页面，确认所有文件都在。

---

## Phase 2: Netlify 部署 + CMS 认证

1. 打开 [netlify.com](https://netlify.com)，用 GitHub 账号登录。

2. 点击 "Add new site" → "Import an existing project" → 选 GitHub → 搜索并选择刚推送的仓库。

3. Netlify 会自动检测 `netlify.toml`：
   - Build command: `npm run build`
   - Publish directory: `dist`
   - 确认无误后点击 "Deploy site"。

4. 等待部署完成（约 1-2 分钟）。点开生成的 `*.netlify.app` 域名，确认站点正常访问。

5. 进入 Site settings → Identity → 点击 "Enable Identity"。

6. Identity → Settings → Registration → 选择 "Invite only"。

7. Identity → Services → Git Gateway → 点击 "Enable Git Gateway"。

8. （可选）Identity → External providers → 添加 GitHub OAuth 以支持第三方登录，按 GitHub OAuth App 向导配置即可。

9. 回到 Identity 页面 → Invite users → 输入你的邮箱 → 点击 "Send"。

10. 打开邮箱查收邀请邮件，点击链接设置密码。

11. 访问 `https://你的站点名.netlify.app/admin/`，用刚设置好的账号登录。成功后应该能看到 7 个集合（blog、sections、site_config、greeting、about、music_config）。

---

## Phase 3: Cloudflare CDN + 自定义域名 + SSL

1. 前提：你已在域名注册商处购买好域名。

2. 打开 [Cloudflare.com](https://cloudflare.com)，注册或登录。

3. Add site → 输入你的域名 → 选择 Free 计划。

4. Cloudflare 会自动扫描现有 DNS 记录。跳过导入步骤，后续手动添加。

5. 添加 CNAME 记录：
   - Type: `CNAME`
   - Name: `@`（或 `www`）
   - Target: `你的站点名.netlify.app`
   - Proxy status: **Proxied**（橙色云朵图标）

6. Cloudflare 会分配两个 nameserver。复制后去域名注册商后台，将域名的 nameserver 改为这两个地址。

7. DNS 生效需要 1-24 小时，请耐心等待。

8. SSL/TLS → Overview → 选择 **"Full (strict)"**。证书由 Cloudflare 和 Netlify 自动处理，无需手动配置。

9. Rules → Page Rules → 添加：
   - URL: `你的域名/admin/*`
   - Setting: Cache Level → **Bypass**
   - 说明：CMS 管理后台不应缓存，确保每次打开都是最新内容。

10. 再加一条：
    - URL: `你的域名/*`
    - Setting: Browser Cache TTL → **"Respect Existing Headers"**
    - 说明：让 Netlify 返回的缓存头控制浏览器缓存行为。

11. 验证：浏览器打开你的域名，确认站点正常显示且地址栏显示 HTTPS 锁图标。

12. 验证：打开 `你的域名/admin/`，确认 CMS 登录界面正常展示。

---

> **注意事项**
>
> - DNS 生效需 1-24 小时，期间访问可能不稳定，属正常现象。
> - CMS 图片上传至 `public/images/uploads/`，通过 Git Gateway 自动提交到仓库并触发 Netlify 重新部署。
> - 如需重置 CMS 密码，在 Netlify Identity → Users 中管理。
> - 所有构建和部署配置已预设在 `netlify.toml` 和 `public/_redirects` 中，无需额外修改。
