# Decisions — full-admin-cms-deploy-image

## Architecture
- YAML import: @rollup/plugin-yaml (zero-config, auto-parse)
- Image optimization: standalone sharp script (not vite-imagetools)
- Sections: folder collection (6 YAML files, same schema)
- Singletons: file collections (site, greeting, about, music)
- Single source of truth: YAML files → JS facades read from YAML
- Tests: keep Playwright visual-core.mjs, update to read from YAML
