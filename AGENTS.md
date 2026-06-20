# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-04  
**Commit:** 3894c3b  
**Branch:** main

## OVERVIEW

Nocturne Archive is a Vite + React 18 SPA with hand-rolled routing, source-controlled Markdown/YAML content, Sveltia CMS admin config, Cloudflare Pages OAuth functions, and custom verification scripts. There is no TypeScript, no framework router, no conventional test runner, and no lint/format command.

## STRUCTURE

```text
blog/
├── src/App.jsx                  # manual route parser + app shell
├── src/content/                 # CMS/source content; see nested AGENTS.md
├── src/data/                    # custom Markdown/YAML loaders and facades
├── src/features/food-map/       # food-map contracts, projections, AMap adapter
├── src/pages/                   # route views consumed by App.jsx
├── src/styles.css               # single global stylesheet + design tokens
├── public/admin/                # Sveltia CMS static admin
├── public/food-map/             # generated/shared JSON + external source config
├── backgrounds/                 # raw images optimized into public/images/optimized
├── scripts/                     # build/verification scripts; see nested AGENTS.md
└── functions/api/               # Cloudflare Pages CMS OAuth functions
```

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Add/route a page | `src/App.jsx`, `src/pages/` | Preserve custom `parseRoute()` + `history.pushState`; no React Router. |
| Edit post/section/site copy | `src/content/`, `src/data/` | Markdown/YAML loaded through custom code, not Astro collections. |
| Food map schema/UI/API | `src/features/food-map/`, `src/pages/FoodMapView.jsx`, `src/content/food-places/` | Privacy projection and AMap fallback are contractual. |
| Global visual style | `src/styles.css` | Tokens and `food-map-*`/BEM-like classes are global. |
| CMS fields/auth | `public/admin/config.yml`, `functions/api/` | GitHub backend points at `https://icarusfell.top/api`. |
| Generated assets | `scripts/optimize-images.mjs`, `public/images/optimized/` | Optimizer skips existing outputs. |
| Deploy behavior | `netlify.toml`, `vercel.json`, `wrangler.jsonc` | Static deploys coexist; OAuth functions are Cloudflare Pages-specific. |

## CODE MAP

| Symbol | Type | Location | Role |
|---|---|---|---|
| `App` | React component | `src/App.jsx` | Owns routing, transitions, filters, and view composition. |
| `parseRoute` | function | `src/App.jsx` | Maps `/`, `/archive`, `/about`, `/food-map`, `/posts/:slug`, `/sections/:slug`. |
| `posts` | data export | `src/data/content.js` | Eager raw Markdown glob, custom frontmatter validation, newest-first sorting. |
| `sections` / `getSectionBySlug` | data exports | `src/data/sections.js` | YAML section registry + optimized WebP background rewrite. |
| `yamlContentPlugin` | Vite plugin | `vite.config.js` | Parses `.yaml`/`.yml` with `js-yaml` into default exports. |
| `normalizeLocalFoodPlaces` | function | `src/features/food-map/core.js` | Validates local food-place YAML and normalizes public fields. |
| `projectPublicFoodMapPlaces` | function | `src/features/food-map/core.js` | Drops draft/private places and private visit fields. |
| `createAmapAdapter` | function | `src/features/food-map/amap.js` | Encapsulates raw AMap JSAPI and no-op fallback states. |
| `onRequest` | Cloudflare handler | `functions/api/auth.js`, `functions/api/callback.js` | CMS GitHub OAuth start/callback. |

## CONVENTIONS

- JavaScript ESM only: `.js`, `.jsx`, `.mjs`; explicit local import extensions are common.
- Style: double quotes, semicolons, two-space indentation; do not invent Prettier/ESLint rules.
- React components use PascalCase files/exports; helpers lower camelCase; constants UPPER_SNAKE_CASE.
- CSS is global in `src/styles.css`; use existing `:root` tokens, focus rings, `data-*` state attributes, and BEM-like classes.
- Motion uses Framer Motion and should respect `useReducedMotion` where interaction/animation is significant.
- `data-testid` selectors are part of verification; avoid renaming/removing without updating scripts.
- Content tone: bilingual Chinese/English, “Nocturne Archive / 失眠档案馆”, archive/system/nocturne vocabulary.

## ANTI-PATTERNS (THIS PROJECT)

- Never hardcode OAuth credentials, AMap keys, VPS/admin secrets, or tokens; use runtime env variables.
- Do not add `react-router-dom` or framework file routing unless explicitly requested.
- Do not treat content as Astro/MDX collections; preserve the custom loaders.
- Do not expose food-map draft/private places, private visits, `people`, `privateNote`, or non-allowlisted fields in public UI/JSON.
- Keep raw AMap access inside `src/features/food-map/amap.js`; React components must not call `window.AMap`, `new AMap`, or map internals directly.
- Do not require live AMap, public internet, production deploys, or real keys for food-map verification.
- Avoid `dangerouslySetInnerHTML`; food-map verification asserts it is absent.
- Do not autoplay music; keep iframe persistence behavior and avoid unnecessary unmounting.
- Do not weaken automated verification into screenshot-only/manual checks.

## UNIQUE STYLES

- Visual system: dark archival surfaces, muted paper text, gold/rust/oxide accents, serif Chinese body type, mono metadata, ledger/noise/diagonal textures.
- Route staging uses `data-route-kind`, `data-transition-state`, and `data-list-transition-state` on global shells.
- Section backgrounds are authored as raw filenames but served as `/images/optimized/*.webp`.
- `TagsView.jsx` exists but is not currently routed by `App.jsx`.

## COMMANDS

```bash
npm install
npm run dev
npm run build
npm run preview
npm run verify:food-map
npm run verify:visual
```

Focused checks:

```bash
npm run verify:food-map-schema
npm run verify:food-map-content
npm run verify:food-map-amap
npm run verify:food-map-external
npm run verify:food-map-browser
```

## NOTES

- `npm run build` runs image optimization, food-map JSON generation, then Vite build.
- Verification scripts may write `.sisyphus/evidence/` and some run build/local servers; they are not read-only.
- No `npm test`, `npm run typecheck`, or `npm run lint` exists.
- `node_modules/`, `dist/`, optimized images, generated food-map JSON, and `.sisyphus/` planning artifacts may be present in the workspace; distinguish source from generated/history.
