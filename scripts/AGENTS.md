# SCRIPTS KNOWLEDGE

## OVERVIEW

Scripts are project automation, not passive tests. Many write generated assets, evidence under `.sisyphus/evidence/`, `public/food-map/index.json`, `public/images/optimized`, or `dist`.

## WHERE TO LOOK

| Task | Script | Side effects |
|---|---|---|
| Optimize images | `optimize-images.mjs` | Writes `public/images/optimized/*.webp`; skips existing outputs. |
| Generate food-map JSON | `generate-food-map-json.mjs` | Writes `public/food-map/index.json`. |
| Visual verification | `verify-visual.mjs`, `visual-core.mjs` | Runs browser/build checks; writes evidence/screenshots. |
| Food-map aggregate verify | `verify-food-map.mjs` | Runs sub-verifiers + build + static JSON checks. |
| Food-map schema/content/external/AMap/browser | `verify-food-map-*.mjs` | Node assertions/Playwright; may write evidence. |

## COMMANDS

```bash
npm run optimize-images
npm run generate:food-map-json
npm run build
npm run verify:food-map
npm run verify:visual
```

Focused food-map checks:

```bash
npm run verify:food-map-schema
npm run verify:food-map-content
npm run verify:food-map-amap
npm run verify:food-map-external
npm run verify:food-map-browser
```

## IMAGE WORKFLOW

- Inputs: `backgrounds/` and `public/images/uploads/`.
- Accepted source extensions: `.png`, `.jpg`, `.jpeg`.
- Output: flat WebP files in `public/images/optimized/`.
- Sharp settings: max width 1920, quality 80, no enlargement.
- Run from repo root; paths are current-working-directory relative.
- Existing optimized files are skipped. Delete stale `.webp` before regenerating changed sources.
- Upload and background files with the same basename collide because output is flat.

## FOOD-MAP JSON WORKFLOW

- Input: sorted `.yaml` files from `src/content/food-places/`.
- Parser: `js-yaml`.
- Normalization: shared `src/features/food-map/core.js` code.
- Output: `public/food-map/index.json`; build copies it to `dist/food-map/index.json`.
- Owner/site metadata: `Nocturne Archive`, `https://blog.sphenicidition.top`.

## VERIFICATION CONVENTIONS

- Custom scripts use `node:assert/strict`, not Jest/Vitest.
- Success output uses `PASS ...` style.
- `verify-food-map.mjs` is the broad food-map gate and includes `npm run build`.
- Browser checks use Playwright directly and mock/block third parties such as AMap, Netlify Identity, Vercount, and NetEase.
- Visual checks sweep 375/768/1024/1440 widths and rely on stable `data-testid` selectors.

## ANTI-PATTERNS

- Do not run these during a strictly read-only audit.
- Do not add recursive/nested image assumptions without changing `optimize-images.mjs`.
- Do not expect changed raw images to regenerate while matching `.webp` outputs already exist.
- Do not replace assertions with screenshot-only checks.
- Do not require live public internet/API keys for food-map checks.
