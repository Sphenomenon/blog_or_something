# Full Admin CMS + Netlify Deploy + Image Pipeline

## TL;DR
> **Summary**: Expand Decap CMS to edit ALL site content (sections, greeting, site config, about page, music), migrate hardcoded text to CMS-editable YAML files, add image optimization via sharp, and deploy via Netlify + Cloudflare for China-accessible hosting.
> **Deliverables**: 6 new CMS collections, YAML data migration for ~80 hardcoded strings, sharp image pipeline, Netlify + Cloudflare deployment, updated Playwright verification
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5

## Context
### Original Request
1. 选择部署策略，确保国内不用科学上网也能访问
2. `/admin/` 管理后台应该什么都能编辑：文章、分区元数据、greeting 内容、标签、站点配置
3. 图片压缩管线
4. 先部署再添加内容

### Interview Summary
- Deployment: Netlify (CMS 认证) + Cloudflare CDN (国内访问) + 自定义域名
- Domain: 用户自己购买（`.com`/`.me`/`.org`），备案不需要（海外服务器）
- CMS expansion: 13 个文件中约 80 个硬编码字符串退到 YAML 文件
- 6 new CMS collections: sections (folder), site_config (singleton), greeting (singleton), about (singleton), music_config (singleton), plus existing blog
- YAML import: `@rollup/plugin-yaml` — 零配置，自动解析
- Image pipeline: 独立 sharp 构建脚本预处理 `backgrounds/` 和 `public/images/uploads/`
- Tests: 保留并更新 `scripts/visual-core.mjs`（1444 行 Playwright）
- No `vite.config.js` exists yet — must create

### Metis Review (gaps addressed)
- **Gap 1**: `vite.config.js` 不存在 → Task 1a 创建，加入 @rollup/plugin-yaml
- **Gap 2**: YAML 导入策略 → `@rollup/plugin-yaml`（用户确认）
- **Gap 3**: vite-imagetools 与 YAML 不兼容 → 改用独立 sharp 脚本（用户确认）
- **Gap 4**: `content.js` allowedSections 硬编码 → 从 YAML 动态派生
- **Gap 5**: `visual-core.mjs` tagline 重复 → 从 YAML 读取，单一数据源
- **Gap 6**: Playwright 测试已有 → 保留并更新（用户确认）
- **Gap 7**: CMS file 集合需要骨架文件 → Task 2c 创建空 YAML 骨架
- **Gap 8**: Cloudflare CDN 配置细节 → Task 5 写清楚 DNS/SSL/页面规则

## Work Objectives
### Core Objective
将博客所有硬编码文字内容迁移到 CMS 可编辑的 YAML 文件，加上图片优化，部署到 Netlify + Cloudflare 使国内可访问。

### Deliverables
1. `vite.config.js`（含 `@rollup/plugin-yaml`）
2. 6 个 YAML 骨架文件 + 验证加载器
3. 12 个组件重构成从 YAML 读取数据
4. 扩展 `public/admin/config.yml` 含 6 个新集合
5. 独立 sharp 图片优化脚本
6. 更新 `scripts/visual-core.mjs` 从 YAML 读取
7. Netlify + Cloudflare 部署指南
8. `npm run build` 全程通过

### Definition of Done
- [ ] `npm run build` 通过，零错误
- [ ] `npm run verify:visual` 通过（更新后脚本）
- [ ] `/admin/` 侧边栏显示 7 个集合（blog + 6 new）
- [ ] 每个分区 intro 可从 CMS 编辑且不是 "TODO:"
- [ ] Greeting 面板文字可从 CMS 编辑
- [ ] About 页面内容可从 CMS 编辑
- [ ] 站点标题、subtitle、404 文字可从 CMS 编辑
- [ ] 音乐彩蛋配置可从 CMS 编辑
- [ ] sharp 脚本将 6 张背景图压缩为 `.webp` 且构建包含原图+webp
- [ ] `netlify.toml` + `_redirects` 就位

### Must Have
- 全部硬编码文字 → YAML → CMS 可编辑
- `content.js` allowedSections 从 YAML 动态派生
- visual-core.mjs 从同一 YAML 源读取
- `npm run build` 每次通过
- Netlify Identity + Git Gateway 认证

### Must NOT Have
- CSS/设计 tokens 可编辑
- Waline 后端部署
- 音乐播放器 UI 重构（只配置可编辑）
- 标签/分类系统重构
- `sections.js` 全量移除（保留为 facade）
- 新 npm 依赖除 `@rollup/plugin-yaml`、`sharp`、`js-yaml` 外

## Verification Strategy
- **Test infrastructure**: Playwright (`scripts/visual-core.mjs`) — 保留并更新
- **Test approach**: 每个迁移任务后运行 `npm run build` + `npm run verify:visual`
- **Acceptance gate**: 构建零错误 + 视觉验证通过

## Execution Strategy
### Parallel Execution Waves
```
Wave 1 [foundation]: vite.config.js + YAML plugin + skeleton YAML files + sharp script
├── 1a: Create vite.config.js + @rollup/plugin-yaml
├── 1b: Create skeleton YAML files (site, greeting, about, music, 6 sections)
├── 1c: YAML data validators (like content.js pattern)
├── 1d: Sharp image optimization script
└── 1e: Verify Wave 1 build + tests

Wave 2 [migration]: Refactor components to read from YAML (MAX PARALLEL)
├── 2a: Migrate sections.js to read from YAML + sync allowedSections
├── 2b: Migrate SiteHeader.jsx to site.yaml + sections YAML
├── 2c: Migrate GreetingGate.jsx to greeting.yaml
├── 2d: Migrate AboutView.jsx to about.yaml
├── 2e: Migrate HomeView.jsx hero to site.yaml
├── 2f: Migrate ArchiveView.jsx header to site.yaml
├── 2g: Migrate App.jsx 404 to site.yaml
├── 2h: Migrate MusicEasterEgg.jsx to music.yaml
└── 2i: Verify Wave 2 build + visual

Wave 3 [cms]: Expand Decap CMS config + update visual-core
├── 3a: Update config.yml with all 7 collections
├── 3b: Update visual-core.mjs to read from YAML
└── 3c: Verify Wave 3 CMS config + visual tests

Wave 4 [deploy]: Git init + deployment
├── 4a: git init + GitHub push guide
├── 4b: Netlify connect + Identity + Git Gateway setup guide
├── 4c: Cloudflare DNS + CDN + SSL setup guide
└── 4d: Verify deployment flow

Wave FINAL: Manual verification on deployed site
└── F1-F4: User validates CMS editing + CDN access
```

### Dependency Matrix
| Task | Blocks | Blocked By |
|------|--------|------------|
| 1a | 1b-1e, 2a-2i | — |
| 1b | 2a-2h, 3a | — |
| 1c | 2a | 1a |
| 1d | — | — |
| 1e | — | 1a, 1b, 1c, 1d |
| 2a | 2b | 1b, 1c |
| 2b-2h | 2i | 1b, 2a |
| 2i | 3c | 2a-2h |
| 3a | — | 1b, 2a |
| 3b | — | 1b |
| 3c | 4d | 2i, 3a, 3b |
| 4a-4d | — | — |

### Agent Dispatch
| Wave | Tasks | Categories |
|------|-------|------------|
| 1 | 1a, 1b, 1c, 1d, 1e | quick × 5 |
| 2 | 2a | deep, 2b-2h | quick × 7, 2i | quick |
| 3 | 3a | visual-engineering, 3b | quick, 3c | quick |
| 4 | 4a-4d | writing (guides, no code) |

## TODOs

- [x] 1a. Create `vite.config.js` with `@rollup/plugin-yaml`

  **What to do**: Create `vite.config.js` at project root. Currently there is NO vite.config.js — Vite runs zero-config. Add `@rollup/plugin-yaml` to devDependencies and configure it in the Vite plugins array. Ensure `.yaml` files are imported as JS objects (plugin auto-parses YAML → JS). Test with a minimal `.yaml` file import.

  **Must NOT do**: Change any other Vite behavior. Do NOT add react plugin (already built-in). Do NOT add any other plugins.

  **Recommended Agent Profile**: Category: `quick` — Reason: single config file, well-known plugin pattern

  **Parallelization**: Can Parallel: NO (first) | Wave 1 | Blocks: [1b-1e] | Blocked By: []

  **References**:
  - Plugin: `@rollup/plugin-yaml` — https://www.npmjs.com/package/@rollup/plugin-yaml
  - Vite config docs: https://vitejs.dev/config/
  - No existing vite.config.js — create from scratch

  **Acceptance Criteria**:
  - [ ] `vite.config.js` exists at project root
  - [ ] `@rollup/plugin-yaml` in devDependencies (check `package.json`)
  - [ ] `npm run build` passes with the new config
  - [ ] A test `.yaml` file can be imported via `import data from "./test.yaml"` in any JS module

  **Commit**: YES | Message: `build: add vite.config.js with YAML plugin` | Files: [`vite.config.js`, `package.json`]

- [x] 1b. Create skeleton YAML data files

  **What to do**: Create all YAML data files that CMS will edit. These must pre-exist for Decap CMS `file` collections. Create directories and files:
  - `src/content/site.yaml` — `{ site_title, site_description, brand_name, brand_kicker, header_subtitle, search_placeholder, nav_archive_label, nav_about_label, error_404_title, error_404_body, error_404_button }`
  - `src/content/greeting.yaml` — `{ greeting_title, greeting_kicker, greeting_background, panels: [{ id, title, body }] }`
  - `src/content/about.yaml` — `{ code_header, page_title, lead_text, body_text, design_system: [{ term, description }] }`
  - `src/content/music.yaml` — `{ provider, playlist_id, embed_url, title, description, autoplay }`
  - `src/content/sections/tech.yaml`, `essay.yaml`, `diary.yaml`, `reading.yaml`, `travel.yaml`, `links.yaml` — each with `{ slug, label, shortLabel, intro, subtitle, background, order, theme, navKicker }`
  Populate ALL with real current values from the existing hardcoded sources.

  **Must NOT do**: Change any component imports yet (that's Wave 2). Do NOT create files outside `src/content/`. Do NOT leave fields empty or placeholder.

  **Recommended Agent Profile**: Category: `quick` — Reason: file creation with known content

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2a-2h, 3a] | Blocked By: [1a]

  **References**:
  - Sections source: `src/data/sections.js` — all 6 section fields
  - Greeting source: `src/components/GreetingGate.jsx:4-23` — panels array
  - Site source: `src/components/SiteHeader.jsx:4-17,25-26,59,67` — brand + subtitles
  - Site source: `src/App.jsx:223-226` — 404 text
  - About source: `src/pages/AboutView.jsx` — full content
  - Music source: `src/components/MusicEasterEgg.jsx:3-9` — config object

  **Acceptance Criteria**:
  - [ ] All 10 YAML files exist in `src/content/` and `src/content/sections/`
  - [ ] Every file has valid YAML with real content (not placeholders)
  - [ ] Each sections YAML has all 9 fields populated
  - [ ] `greeting.yaml` has 3 panels with correct title+body
  - [ ] `about.yaml` has 3 design_system terms
  - [ ] `npm run build` still passes (files are inert, no imports yet)

  **Commit**: YES | Message: `data: add skeleton YAML files for CMS migration` | Files: [`src/content/*.yaml`, `src/content/sections/*.yaml`]

- [x] 1c. YAML data validators
- [x] 1d. Sharp image optimization script
- [x] 1e. Verify Wave 1 build + tests

  **What to do**: Run `npm run build` and `npm run verify:visual` to confirm Wave 1 changes don't break anything. Verify:
  - vite.config.js loads YAML plugin correctly
  - Skeleton YAML files are valid and inert
  - yaml-loader.js validates without errors
  - sharp script produces output files
  - Build output unchanged from pre-Wave-1

  **Must NOT do**: Make any code changes — verification only.

  **Recommended Agent Profile**: Category: `quick` — Reason: build + test verification

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [] | Blocked By: [1a, 1b, 1c, 1d]

  **References**:
  - Build command: `npm run build`
  - Visual test: `npm run verify:visual`
  - Evidence dir: `.sisyphus/evidence/`

  **Acceptance Criteria**:
  - [ ] `npm run build` exits 0
  - [ ] `npm run verify:visual` exits 0 (or produces evidence)
  - [ ] `dist/images/optimized/` contains `.webp` variants
  - [ ] No new console errors or build warnings

- [x] 2a. Migrate `sections.js` to read from YAML + sync `content.js` allowedSections

  **What to do**: The single most critical migration. `src/data/sections.js` currently exports a hardcoded array of 6 section objects. Change it to import from the 6 YAML files in `src/content/sections/` via `import.meta.glob`. Export the same shape (`SECTION_REGISTRY` array with `getSectionBySlug()`). Also update `src/data/content.js` line 3 — the `allowedSections` Set must dynamically derive from the YAML-loaded sections list, not be hardcoded as `["tech", "essay", ...]`. Import from `sections.js` or from yaml-loader.

  **Must NOT do**: Change the export API of sections.js — `SECTION_REGISTRY`, `getSectionBySlug` must work identically. Do NOT change section slug values.

  **Recommended Agent Profile**: Category: `quick` — Reason: data refactoring, follows established glob pattern

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [2b] | Blocked By: [1b, 1c]

  **References**:
  - Pattern: `src/data/content.js:145-166` — `import.meta.glob("*.md", ...)` pattern
  - Target: `src/data/sections.js:1-70` — current hardcoded array
  - Target: `src/data/content.js:3` — hardcoded `allowedSections` Set
  - Imports: `src/data/content.js:1` — `import { getSectionBySlug } from "./sections.js"`

  **Acceptance Criteria**:
  - [ ] `sections.js` imports from `src/content/sections/*.yaml` via glob
  - [ ] `SECTION_REGISTRY` array has 6 entries with correct data
  - [ ] `getSectionBySlug("tech")` returns tech section object
  - [ ] `content.js` allowedSections dynamically derived from sections YAML
  - [ ] Adding a new section YAML file auto-adds to allowedSections
  - [ ] `npm run build` passes

  **Commit**: YES | Message: `refactor: migrate sections to YAML data source` | Files: [`src/data/sections.js`, `src/data/content.js`]

- [x] 2b. Migrate `SiteHeader.jsx` to site.yaml + sections YAML
- [x] 2c. Migrate `GreetingGate.jsx` to `greeting.yaml`
- [x] 2d. Migrate `AboutView.jsx` to `about.yaml`
- [x] 2e. Migrate `HomeView.jsx` hero to `site.yaml`
- [x] 2f. Migrate `ArchiveView.jsx` header to `site.yaml`
- [x] 2g. Migrate `App.jsx` 404 to `site.yaml`
- [x] 2h. Migrate `MusicEasterEgg.jsx` to `music.yaml`
- [x] 2i. Verify Wave 2 build + visual tests

  **What to do**: Run `npm run build` + `npm run verify:visual` to confirm ALL migrations work correctly. Check that:
  - All 6 sections render with correct intro/label from YAML
  - Greeting shows 3 panels from YAML
  - About page content from YAML
  - Home hero from YAML
  - Archive header from YAML
  - 404 text from YAML
  - Music config from YAML
  - SiteHeader brand/subtitles from YAML

  **Must NOT do**: Make code changes — verification only.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3c] | Blocked By: [2a-2h]

  **Acceptance Criteria**:
  - [ ] `npm run build` exits 0
  - [ ] `npm run verify:visual` exits 0
  - [ ] No runtime errors when navigating all routes

- [x] 3a. Expand `public/admin/config.yml` with all 7 collections
- [x] 3b. Update `scripts/visual-core.mjs` to read from YAML
- [x] 3c. Verify Wave 3 — CMS config + visual tests

  **What to do**: Run `npm run build` + `npm run verify:visual` to confirm CMS config expansion and visual-core update don't break anything. Check that:
  - All 7 CMS collections appear valid
  - visual-core.mjs passes with YAML-sourced expected values
  - Build output includes admin/config.yml with all collections
  - No regressions in any route or component

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [] | Blocked By: [2i, 3a, 3b]

  **Acceptance Criteria**:
  - [ ] `npm run build` exits 0
  - [ ] `npm run verify:visual` exits 0
  - [ ] `dist/admin/config.yml` contains all 7 collections

  **Commit**: NO

- [x] 4a. Git init + GitHub push guide
- [x] 4b. Netlify connect + Identity + Git Gateway setup guide
- [x] 4c. Cloudflare DNS + CDN + SSL setup guide
- [x] 4d. Verify deployment flow

  **What to do**: Run final `npm run build` + `npm run verify:visual` to confirm all code changes are complete. The deployment itself is manual (user executes guides). Mark this task as done when:
  - Build passes
  - Visual tests pass
  - All guides are complete
  - Tagline: "Ready for deployment — user executes guides"

  **Acceptance Criteria**:
  - [ ] `npm run build` exits 0
  - [ ] `npm run verify:visual` exits 0
  - [ ] `.sisyphus/guides/deployment.md` is complete (all 3 sections)
  - [ ] Zero remaining hardcoded editorial text in components

  **Commit**: NO

## Final Verification Wave
> Manual verification by user AFTER deploying to Netlify + Cloudflare.
- [ ] F1. Login to `/admin/` via Netlify Identity — confirm 7 collections visible
- [ ] F2. Edit a section intro via CMS → publish → verify changes on live site
- [ ] F3. Edit greeting panel text → publish → verify greeting page updates
- [ ] F4. Edit about page content → publish → verify about page updates
- [ ] F5. Upload image via CMS media library → verify appears in post
- [ ] F6. Access site from China (no VPN) — verify CDN-delivered content loads

## Commit Strategy
- Commit after each task or small group of parallel tasks.
- Suggested final commit: `feat: full CMS admin panel with YAML data migration and image pipeline`.
- Files affected: `vite.config.js`, `package.json`, `src/data/sections.js`, `src/data/content.js`, `src/data/yaml-loader.js`, `src/components/SiteHeader.jsx`, `src/components/GreetingGate.jsx`, `src/components/MusicEasterEgg.jsx`, `src/pages/AboutView.jsx`, `src/pages/HomeView.jsx`, `src/pages/ArchiveView.jsx`, `src/App.jsx`, `src/content/*.yaml`, `src/content/sections/*.yaml`, `public/admin/config.yml`, `scripts/optimize-images.mjs`, `scripts/visual-core.mjs`, `.sisyphus/guides/deployment.md`, `.gitignore`

## Success Criteria
- `npm run build` exits 0 with zero errors
- `npm run verify:visual` exits 0 with updated assertions
- All ~80 hardcoded strings migrated to YAML — verified by grep: zero editorial text remaining in components
- `/admin/` sidebar shows 7 editable collections after Netlify deploy
- `allowedSections` in `content.js` dynamically derived from sections YAML
- Sharp script produces `.webp` variants for all 7 background images
- Cloudflare CDN caches static assets, bypasses `/admin/*`, terminates SSL
- China accessibility confirmed via CDN proxy (user verifies)
