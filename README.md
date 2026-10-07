# 失眠档案馆 / Nocturne Archive

Next.js App Router + React 静态博客。文章和配置继续保存在 Markdown/YAML，Sveltia CMS、Cloudflare Pages OAuth、美食地图和图片生成流程沿用现有约定。

## 本地运行

使用 Node.js 22，安装后启动：

```bash
npm ci
npm run dev
```

开发地址默认 `http://localhost:3000`。开发脚本监听 `src/content/` 和图片上传目录；有效变更会重新生成内容与图片清单并触发热更新。

构建并预览部署产物：

```bash
npm run build
npm run preview
```

预览默认 `http://127.0.0.1:4173`，可用 `-- --port 4187` 指定端口。产物是 `out/`，不需要常驻 Next 服务。

## 新文章上传

通过 `/admin/` 编辑并保存，CMS 会把 Markdown/YAML 与上传资源提交到 GitHub `main`。也可直接把文章放入 `src/content/posts/`；字段和正文图片语法见 `src/content/README.md`。

构建先校验 frontmatter、栏目、图片引用和美食数据，再枚举文章与栏目路径。内容或校验不合法会使构建失败，避免发布不完整页面。生成的 `src/generated/` 不进入 Git，也不手工编辑。

## 部署

Cloudflare Pages 与 Netlify：构建命令 `npm run build`，发布目录 `out`。Cloudflare Pages 继续使用根目录 `functions/api/` 承接 CMS GitHub OAuth；`public/admin/config.yml` 的认证地址保持原配置。

Vercel 使用 Next 构建入口；配置保留 admin 路径映射，不再将所有路径改写到 SPA 首页。`public/_redirects` 保留旧文章 slug 的跳转。未知路径使用导出的 `404.html`。

美食地图的浏览器配置使用环境变量 `NEXT_PUBLIC_AMAP_KEY`、`NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`。原有 `VITE_AMAP_KEY` 和 `VITE_AMAP_SECURITY_JS_CODE` 在构建配置里兼容；缺少地图配置时仍提供地点列表、详情和外链。CMS OAuth 服务端变量继续只用于 Cloudflare functions。

## 页面转场

各页面使用同一套文字参与层，覆盖标题、摘要、正文文本和地点名称。Torph 负责基础文字分段，React 原生 ViewTransition 负责页面切换快照与移动；相同词组优先，重复字结合距离配对，随后浮现其他内容。

页面内容已随客户端打包。站内切换使用 Next 支持的原生 History API，与 `usePathname` 同步，直接渲染本地视图；无需等待路由数据或后台预取。刷新、直接访问和新标签页继续使用 Next 导出的独立页面。浏览器标题和描述使用与静态页面相同的元数据来源，前进/后退及音乐播放器保持连续。

桌面最多采样 80 个可见文字元素，手机最多 48 个；目标页只为配对成功的字创建独立快照，其余内容跟随整页渐显。移动和字号变化使用位移与缩放，避免逐帧改变宽高。长段落只拆分参与动画的前缀，保留剩余正文为普通文本。

文字保持普通 inline 排版、选择复制与阅读语义；代码、地图和音乐 iframe 不拆分。音乐播放器位于持久布局，不随页面卸载。减少动态或缺少浏览器 API 时，页面仍可正常导航。

## 验证

先构建生产产物，然后运行：

```bash
npm run verify:route-motion
npm run verify:startup
npm run verify:reading
npm run verify:site-polish
npm run verify:food-map
npm run verify:food-map-browser
npm run verify:article-media
npm run verify:decorative-accents
npm run verify:visual
```

生产浏览器检查实际的 Next 静态产物，包括共享文字动画、快速切换、历史导航、音乐持久性、无障碍交互和公开数据。`verify:visual` 汇总阅读、站点交互、装饰素材与文字转场检查，按当前内容运行，无需另外启动预览服务。Vite 仅用于隔离的文章媒体测试夹具，保留现有图片渲染、布局、灯箱与资源合同检查。

外部字体在页面初始化后异步加载，网络不可用时沿用系统字体。`verify:startup` 覆盖字体请求挂起、失败及成功三种情况，检查桌面和手机的欢迎页按钮、背景和导航。
