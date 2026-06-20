# FOOD MAP KNOWLEDGE

## OVERVIEW

Feature boundary for food-place contracts, YAML normalization, public/privacy projection, external-source aggregation, AMap integration, and React food-map UI. Page orchestration is in `src/pages/FoodMapView.jsx`; route registration is in `src/App.jsx`; styles are global in `src/styles.css`.

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Change schema/public fields | `contracts.js`, `core.js` | Update allowlists and verification scripts together. |
| Add local place fields | `src/content/food-places/*.yaml`, `core.js`, `public/admin/config.yml` | Preserve public/private projection. |
| Change YAML loading | `loader-core.js`, `loader.js` | Keep Vite glob logic out of `loader-core.js`. |
| Change external merge | `core.js` | Local scalar values win; arrays merge local-first. |
| Change AMap behavior | `amap.js`, `FoodMapComponents.jsx` | Raw AMap only in adapter; UI must fallback without keys. |
| Change UI classes | `FoodMapComponents.jsx`, `src/styles.css` | Global `food-map-*` classes drive styling and verification. |
| Verify | `npm run verify:food-map` | Aggregate command runs focused checks and build. |

## DATA FLOW

```text
src/content/food-places/*.yaml -> loader.js -> loader-core.js -> core.js -> FoodMapView.jsx
scripts/generate-food-map-json.mjs -> public/food-map/index.json -> dist/food-map/index.json
public/food-map/sources.json -> loadFoodMapSourceConfig() -> aggregateFoodMapExternalSources()
```

## CONTRACTS

- Required local fields: `spotId`, `name`, `status`, `city`, `category`, `address`, `coordinates.lng`, `coordinates.lat`.
- `status` is `published` or `draft`.
- Coordinates: lng `-180..180`, lat `-90..90`.
- Default coordinate system: `GCJ-02`; CMS also allows `WGS84`.
- Duplicate local `spotId` is a validation error, never a merge case.
- Shared schema: `https://valaxy.site/schemas/food-map.v1.json`, version `1`.

## PRIVACY RULES

- Public projection includes only published, non-private places.
- Public/shared JSON uses allowlists: `FOOD_MAP_PUBLIC_PLACE_KEYS`, `FOOD_MAP_PUBLIC_VISIT_KEYS`, `FOOD_MAP_SHARED_SPOT_KEYS`.
- Private visits are removed.
- Never leak `private`, `privateNote`, `people`, draft records, private places, or unknown secret fields.

## AMAP RULES

- `VITE_AMAP_KEY` enables live AMap; `VITE_AMAP_SECURITY_JS_CODE` is optional.
- Missing key, failed script load, non-browser runtime, and no-coordinate states are supported UI states.
- Keep `window.AMap`, `new AMap.*`, marker/listener/map internals inside `amap.js`.
- React components should use adapter methods and keep fallback marker/list UX functional.

## ANTI-PATTERNS

- Do not put `import.meta.glob` in `loader-core.js`; that file is intentionally pure/testable.
- Do not include React components in `index.js` unless deliberately changing the public surface.
- Do not turn `/food-map/index.json` into an SPA route or aggregate external/friend data into the local shared JSON.
- Do not require live AMap, public internet, CacheTide, production deploys, or real keys in tests.
- Do not use `dangerouslySetInnerHTML` for popup/UI content; verification asserts absence.
- Preserve `[food-map]` error/warning prefixes where present.
