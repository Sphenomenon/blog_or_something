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

4. 在 GitHub 新建仓库（公开或私有均可）。

5. 关联远程仓库并推送：
   ```bash
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git branch -M main
   git push -u origin main
   ```

6. 验证：浏览器打开 GitHub 仓库页面，确认所有文件都在。

---

## Phase 2: Cloudflare Pages 部署 + CMS 认证

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)，用你的 Cloudflare 账号登录。

2. 左侧导航 → Workers & Pages → 点击 "Create application" → 选择 "Pages" 选项卡 → "Connect to Git"。

3. 授权 Cloudflare 访问你的 GitHub 账号（如未授权过），搜索并选择刚推送的仓库。

4. 配置构建设置：
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - 其他保持默认。点击 "Save and Deploy"。

5. 等待部署完成（约 1-2 分钟）。点开自动生成的 `<project>.pages.dev` 域名，确认站点正常访问。

6. **设置 GitHub OAuth 认证（CMS 登录用）：**
   - 打开 [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
   - 点击 "New OAuth App"
   - Application name: 随意填写，例如 "Nocturne Archive CMS"
   - Homepage URL: 填入你的 Cloudflare Pages 站点 URL，如 `https://<project>.pages.dev`
   - Authorization callback URL: 填入 `https://<project>.pages.dev/api/callback`
   - 点击 "Register application"
   - 创建成功后，复制 **Client ID**，然后点击 "Generate a new client secret" 生成 **Client Secret** 并复制

7. **在 Cloudflare Pages 中添加环境变量：**
   - Cloudflare Dashboard → Workers & Pages → 选择刚部署的项目
   - 进入 **Settings** → **Environment variables**
   - 添加两个变量（均勾选 "Encrypt"）：
     - `CLIENT_ID` = 上一步复制的 GitHub OAuth App Client ID
     - `CLIENT_SECRET` = 上一步复制的 GitHub OAuth App Client Secret
   - Apply to "Production" 和 "Preview" 两个环境
   - 点击 "Save"

8. **重新部署以启用环境变量：**
   - 进入项目的 **Deployments** 页面
   - 找到最新的部署记录，点击右侧的三个点 → "Retry deployment"
   - 或者推送一次新的 commit 触发自动部署

9. 验证 CMS 登录：
   - 浏览器打开 `https://<project>.pages.dev/admin/`
   - 点击 "Login with GitHub"
   - 跳转到 GitHub 授权页面，点击 "Authorize"
   - 授权成功后自动跳回 CMS 页面，此时应该能看到 7 个集合（blog、sections、site_config、greeting、about、music_config）

---

## Phase 3: 阿里云自定义域名绑定

1. 前提：你已在域名注册商（如阿里云）处购买好域名。

2. Cloudflare Dashboard → Workers & Pages → 选择你的项目 → **Custom domains** → 点击 "Set up a custom domain"。

3. 输入你的域名（例如 `example.com` 或 `www.example.com`），点击 "Continue"。

4. Cloudflare Pages 会自动生成两条 DNS 记录（一般来说是一条 CNAME 记录和一条 TXT 验证记录）。**复制这些记录内容。**

5. 登录阿里云控制台，进入 **云解析 DNS** → 选择你的域名 → **添加记录**：
   - 添加 CNAME 记录：记录类型 `CNAME`，主机记录 `@`（或 `www`），记录值设为 Cloudflare 提供的目标地址
   - 添加 TXT 记录：记录类型 `TXT`，主机记录按 Cloudflare 提示填写，记录值设为 Cloudflare 提供的验证字符串

6. 等待 DNS 验证（通常 5-30 分钟，最长可能数小时）。Cloudflare Pages 会自动检测验证状态。

7. 验证成功后，Cloudflare Pages 会自动为你的域名申请 SSL 证书（无需手动配置）。状态变为 "Active" 后即可访问。

8. **更新 GitHub OAuth App 的回调 URL：**
   - 打开 [GitHub OAuth Apps](https://github.com/settings/developers)
   - 找到之前创建的 OAuth App，点击 "Edit"
   - 将 **Homepage URL** 和 **Authorization callback URL** 中的 `pages.dev` 域名替换为你的自定义域名
   - 例如：
     - Homepage URL: `https://你的域名`
     - Authorization callback URL: `https://你的域名/api/callback`
   - 点击 "Update application"

9. 验证：浏览器打开你的自定义域名，确认站点正常显示且地址栏显示 HTTPS 锁图标。

10. 验证：打开 `https://你的域名/admin/`，确认 CMS 登录界面正常展示且能正常登录。

---

> **注意事项**
>
> - DNS 生效需数分钟到数小时，期间访问可能不稳定，属正常现象。
> - CMS 图片上传至 `public/images/uploads/`，通过 GitHub OAuth 自动提交到仓库并触发 Cloudflare Pages 重新部署。
> - `netlify.toml` 存在于仓库中但**不会被 Cloudflare Pages 使用**（仅保留作为参考），Cloudflare Pages 使用 `wrangler.jsonc` 中的 `pages_build_output_dir` 配置。
> - SPA 路由由 `public/_redirects` 文件控制（Cloudflare Pages 兼容 Netlify 格式的 `_redirects` 规则）。
> - 如需为 Preview 预览分支也绑定自定义域名，可在 Custom domains 中为不同分支配置不同域名。
