# Learnings — full-admin-cms-deploy-image

## 2026-05-22 Session Start
- 20 tasks across 5 waves
- Wave 1: foundation (vite.config.js, YAML skeleton, validators, sharp)
- Wave 2: migration (8 parallel component refactors)
- Wave 3: CMS config expansion + visual-core update
- Wave 4: deployment guides (no code)
- SSH configured: `git@github.com:Sphenomenon/blog_or_something.git`. Push directly without prompting.
- Decap CMS version: pin to `@3.5.4` — earlier 3.0.x has `removeChild` DOM bug
- Task 1 (vite-config-yaml): @rollup/plugin-yaml installed as devDep, vite.config.js created with minimal config (only yaml plugin), build passes

## Task 1b — Skeleton YAML Data Files (2026-05-22)

### Completed
- Created all 10 YAML skeleton files under `src/content/`:
  - `src/content/site.yaml` — 28 fields extracted from SiteHeader.jsx, App.jsx, HomeView.jsx, ArchiveView.jsx, index.html
  - `src/content/greeting.yaml` — title, kicker, background, 3 panels with exact body text from GreetingGate.jsx
  - `src/content/about.yaml` — code_header, page_title, lead_text, body_text, 3 design_system entries from AboutView.jsx
  - `src/content/music.yaml` — 6 fields from MusicEasterEgg.jsx (playlist_id & embed_url as null, autoplay as false)
  - `src/content/sections/tech.yaml` through `links.yaml` — all 6 sections from `src/data/sections.js` with subtitles from `SiteHeader.jsx sectionSubtitles` map
- Build verified: `npm run build` passes (YAML files are inert — no imports yet)

### Key Decisions
- Panel IDs in greeting.yaml use simplified `"panel-N"` format (not `"greeting-panel-N"` from source) — these are canonical CMS content
- Section `theme` values use slug-identical values from source (tech→"tech", essay→"essay", etc.) rather than color names
- Section `navKicker` values use real Chinese labels from sections.js (e.g. "技术/瞎折腾") not romanized versions
- Background fields use just filename (e.g. "tech.png") not full import URL — canonical CMS data
- tech.yaml has empty subtitle `""` since tech has no entry in sectionSubtitles map (falls through to default)
- travel background uses `.jpg` extension (travel.jpg) while others use `.png`

### Notes
- LSP diagnostics unavailable (yaml-language-server not installed globally) — build pass suffices as validation
- These YAML files are the canonical single source of truth for Decap CMS; components will read from them in Wave 2

## Task 1c — YAML Loader (2026-05-22)

### Completed
- Created `src/data/yaml-loader.js` — single entry point for all YAML data
- Uses `import.meta.glob("../content/sections/*.yaml", { eager: true })` for 6 section files
- Uses named imports for 4 singleton YAML files (site, greeting, about, music)
- All imports are eager/resolved at module load time (build-time validation)

### Validation Rules
- **Sections**: every section must have non-empty `slug`, `label`, `intro`, `background`; duplicate slug detection
- **Greeting**: requires `greeting_title`, `greeting_kicker`, `panels` (non-empty array), each panel has `id` + `title` + `body`
- **About**: requires `page_title`, `lead_text`, `body_text`, `design_system` (non-empty array), each entry has `term` + `description`
- **Site**: validates `site_title` exists
- **Music**: validates `title` exists
- All validation errors use `function fail(msg) { throw new Error(msg) }` pattern matching `content.js` style
- Sections exported as array sorted by `order` field

### Key Decisions
- `fail()` function simplified from `content.js` pattern (no `filePath` param since all YAML imports are known at build time)
- `import.meta.glob` for sections (dynamic discovery) + named imports for singletons (explicit, tree-shakeable)
- Exports: `{ sections, site, greeting, about, music }`

## Task 1d — Image Optimization Script (2026-05-22)

### Completed
- Created `scripts/optimize-images.mjs` — standalone sharp-based image optimizer
- `sharp@^0.34.5` added to devDependencies
- Added `"optimize-images": "node scripts/optimize-images.mjs"` to package.json scripts
- Updated `"build"` to `"npm run optimize-images && vite build"`
- Processes 7 background images (`backgrounds/`): diary.png, essay.png, greeting.png, links.png, reading.png, tech.png, travel.jpg
- Uploads dir (`public/images/uploads/`) is empty (only .gitkeep) — gracefully skipped
- Output: `public/images/optimized/*.webp` — all 7 generated at quality 80, max 1920px width, no enlargement
- Output mirrored to `dist/images/optimized/` on build (Vite copies `public/` → `dist/`)

### Verification
- `npm run optimize-images` — 7 images optimized on first run, skips existing on subsequent runs
- `npm run build` — runs optimization first, then Vite build; optimized images present in `dist/images/optimized/`
- Idempotent: skips already-existing .webp files on re-run

## Task 1d-v2 — Migrate sections.js to YAML source (2026-05-22)

### Completed
- Replaced hardcoded `sectionDefinitions` array in `src/data/sections.js` with import from `./yaml-loader.js`
- YAML sections have `background` as bare filename (e.g. `"tech.png"`) — transformed via `new URL(\`../../backgrounds/${sec.background}\`, import.meta.url).href` to match original resolved URL behavior
- Added `SECTION_REGISTRY` as a named alias for the `sections` export (alongside existing `sections` export for backward compat)
- Updated `src/data/content.js` line 3: `allowedSections` now computed from `SECTION_REGISTRY.map(s => s.slug)` instead of hardcoded list

### Key Decisions
- `sections.js` now imports from `yaml-loader.js` (no circular dependency — yaml-loader only imports YAML files)
- Both `sections` and `SECTION_REGISTRY` are exported for backward compatibility (`sections` is used by SiteHeader, HomeView; `SECTION_REGISTRY` is the canonical name)
- Background URL resolution kept in sections.js (not moved to yaml-loader) since it's a Vite-specific transform, not a data concern

### Verification
- `npm run build` passes cleanly
- All 6 sections still exported with same shape (slug, label, shortLabel, intro, background as resolved URL, order, theme, navKicker)
- `getSectionBySlug` behavior unchanged

## Task 3b — Update visual-core.mjs to read from YAML (2026-05-22)

### Completed
- Replaced hardcoded `SECTION_TAGLINES` object (lines 13-20) with YAML-loaded version
- Added imports for `readFileSync` from `node:fs`, `yaml` from `js-yaml`, and `path` from `node:path`
- Created `loadYamlSync()` helper that reads YAML relative to `PROJECT_ROOT`
- `SECTION_TAGLINES.home` sourced from `site.yaml` → `header_subtitle`
- Each section's tagline sourced from respective `src/content/sections/{slug}.yaml` → `subtitle`
- `tech` section correctly excluded (empty `subtitle` → falsy check → not added)
- All 6 tagline values match exactly — no behavior change

### YAML Loading Strategy
- Node.js does not support native `.yaml` imports — used `js-yaml` (already installed as transitive dep of `@rollup/plugin-yaml`)
- `import yaml from 'js-yaml'` works in ESM; `yaml.load()` parses YAML strings
- Synchronous loading at module init via `readFileSync` (simpler than top-level await)
- Uses `SECTION_SLUGS` array (already defined) to iterate and load section files — avoids `readdirSync`

### Verification
- YAML loading tested independently: produces identical tagline values
- `npm run verify:visual` fails with same pre-existing error (`"Unexpected token ':'"` browser JS error) — no regression

## Task — Deployment Guide + .gitignore (2026-05-22)

### Completed
- Created `.sisyphus/guides/deployment.md` — 3-phase deployment guide in Chinese
  - Phase 1: git init, GitHub push
  - Phase 2: Netlify deploy, Identity, Git Gateway, invite user
  - Phase 3: Cloudflare DNS, CDN, SSL (Full strict), Page Rules for CMS bypass
- Created `.gitignore` — excludes `node_modules/`, `dist/`, `.sisyphus/evidence/` plus common OS/IDE files

### Key Details
- CMS has 7 collections (blog, sections, site_config, greeting, about, music_config) — mentioned in Phase 2
- Cloudflare SSL set to "Full (strict)" with auto certificate provisioning
- CMS admin path `/admin/*` gets Cache Level: Bypass via Page Rule
- DNS propagation warning included (1-24 hours)
- Image upload flow explained: `public/images/uploads/` → Git Gateway → auto commit → redeploy
