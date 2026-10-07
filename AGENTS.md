# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-04  
**Commit:** 3894c3b  
**Branch:** main

## OVERVIEW

Nocturne Archive uses Next.js App Router + React 19, static export, source-controlled Markdown/YAML content, Sveltia CMS, Cloudflare Pages OAuth functions, and custom verification scripts. Vite remains only for isolated article-media verification harnesses. There is no TypeScript, conventional test runner, or lint/format command.

## STRUCTURE

```text
blog/
├── app/                         # Next layouts, static routes, metadata, 404
├── src/App.jsx                  # persistent shell, shared state, Next navigation
├── src/BlogRoute.jsx            # route interpretation + view composition
├── src/content/                 # CMS/source content; see nested AGENTS.md
├── src/data/                    # custom Markdown/YAML loaders and facades
├── src/features/food-map/       # food-map contracts, projections, AMap adapter
├── src/views/                   # reusable route views
├── src/generated/               # ignored, build-generated content and manifests
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
| Add/route a page | `app/[...path]/page.jsx`, `src/BlogRoute.jsx`, `src/views/` | Enumerate static routes with `generateStaticParams`; preserve content validation. |
| Edit post/section/site copy | `src/content/`, `src/data/` | Markdown/YAML loaded through custom code, not Astro collections. |
| Food map schema/UI/API | `src/features/food-map/`, `src/views/FoodMapView.jsx`, `src/content/food-places/` | Privacy projection and AMap fallback are contractual. |
| Shared text transitions | `src/components/SharedText.jsx`, `TextRouteFrame.jsx`, `src/lib/text-transition.js` | Visible glyph budget, word-aware matching, native View Transition, reduced-motion fallback. |
| Global visual style | `src/styles.css` | Tokens and `food-map-*`/BEM-like classes are global. |
| CMS fields/auth | `public/admin/config.yml`, `functions/api/` | GitHub backend points at `https://icarusfell.top/api`. |
| Generated assets | `scripts/optimize-images.mjs`, `public/images/optimized/` | Optimizer skips existing outputs. |
| Deploy behavior | `netlify.toml`, `vercel.json`, `wrangler.jsonc` | Static deploys coexist; OAuth functions are Cloudflare Pages-specific. |

## CODE MAP

| Symbol | Type | Location | Role |
|---|---|---|---|
| `App` | React component | `src/App.jsx` | Persistent state, music, header; Next-integrated History API updates bundled views without route fetches. |
| `BlogRoute` | React component | `src/BlogRoute.jsx` | Composes route-specific views inside a native ViewTransition boundary. |
| `parseRoute` | function | `src/App.jsx` | Maps `/`, `/archive`, `/about`, `/food-map`, `/posts/:slug`, `/sections/:slug`. |
| `posts` | data export | `src/data/content.js` | Generated Markdown input, custom frontmatter validation, newest-first sorting. |
| `sections` / `getSectionBySlug` | data exports | `src/data/sections.js` | YAML section registry + optimized WebP background rewrite. |
| Site content generator | script | `scripts/generate-site-content.mjs` | Reads Markdown/YAML, validates loaders, exports only projected public food places. |
| `normalizeLocalFoodPlaces` | function | `src/features/food-map/core.js` | Validates local food-place YAML and normalizes public fields. |
| `projectPublicFoodMapPlaces` | function | `src/features/food-map/core.js` | Drops draft/private places and private visit fields. |
| `createAmapAdapter` | function | `src/features/food-map/amap.js` | Encapsulates raw AMap JSAPI and no-op fallback states. |
| `onRequest` | Cloudflare handler | `functions/api/auth.js`, `functions/api/callback.js` | CMS GitHub OAuth start/callback. |

## CONVENTIONS

- JavaScript ESM only: `.js`, `.jsx`, `.mjs`; explicit local import extensions are common.
- Style: double quotes, semicolons, two-space indentation; do not invent Prettier/ESLint rules.
- React components use PascalCase files/exports; helpers lower camelCase; constants UPPER_SNAKE_CASE.
- CSS is global in `src/styles.css`; use existing `:root` tokens, focus rings, `data-*` state attributes, and BEM-like classes.
- Route motion uses native React ViewTransition; local interaction uses Framer Motion. Both must respect reduced-motion preferences.
- `data-testid` selectors are part of verification; avoid renaming/removing without updating scripts.
- Content tone: bilingual Chinese/English, “Nocturne Archive / 失眠档案馆”, archive/system/nocturne vocabulary.

## ANTI-PATTERNS (THIS PROJECT)

- Never hardcode OAuth credentials, AMap keys, VPS/admin secrets, or tokens; use runtime env variables.
- Use App Router for production navigation; do not add React Router or browser history routing alongside it.
- Do not send raw local food-place records into generated client modules; project public fields at build time.
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

- `npm run build` generates and validates content/assets, then uses Next static export into `out/`.
- `npm run dev` watches content/uploads and refreshes generated input before Next hot reload.
- Production browser verifiers use `scripts/serve-static.mjs` against `out/`; build first. Vite is reserved for article-media fixture/component checks.
- All route views and content are bundled. Internal navigation uses native `history.pushState` integrated with Next `usePathname`; `BlogRoute` reads the live path from site context. Do not reintroduce network-dependent route navigation or bulk prefetch for these local views. Server/client title and description share `src/lib/route-metadata.js`.
- Verification scripts may write `.sisyphus/evidence/` and some run build/local servers; they are not read-only.
- No `npm test`, `npm run typecheck`, or `npm run lint` exists.
- `node_modules/`, `.next/`, `out/`, `src/generated/`, optimized images, generated food-map JSON, and `.sisyphus/` artifacts may be present; distinguish source from generated/history.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
