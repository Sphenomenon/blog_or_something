# Learnings

## SPA Routing & Deployment

- **2026-05-22**: Created `public/_redirects` with `/* /index.html 200` for Netlify SPA fallback routing. This file serves as a backup to `netlify.toml` — Netlify processes `_redirects` from the publish directory directly, ensuring deep-link SPA routing works even if TOML config isn't processed.
- Vite copies `public/` contents to `dist/` root during build, so `public/_redirects` ends up at `dist/_redirects` automatically.

## Decap CMS Admin Page

- **2026-05-22**: Created `public/admin/index.html` — Decap CMS admin entry page.
- Script loading order is critical: Netlify Identity widget → Decap CMS → init script.
- Identity must be initialized before CMS.init() to handle auth redirect flow correctly.
- `on("login")` redirects to `/admin/` to close the modal popup.
- `on("logout")` calls `document.location.reload()` to reset state.
- Vite copies `public/admin/index.html` to `dist/admin/index.html` during build.
- CMS auto-discovers `config.yml` from the same directory (`/admin/config.yml`).
- CDN URLs used: `identity.netlify.com/v1/netlify-identity-widget.js` and `unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js`.

## Decap CMS Configuration

- **2026-05-22**: Created `public/admin/config.yml` — Decap CMS configuration file.
- Backend: `git-gateway` on `main` branch (Netlify Identity + Git Gateway for auth).
- Media folder: `public/images/uploads` (source), `/images/uploads` (public URL).
- Single collection `blog` at `src/content/posts` with all frontmatter fields matching existing posts: id, slug, title, excerpt, date, section, status, reading, tags, category, sections, body.
- Section field uses `select` widget with options from `src/data/sections.js`: tech, essay, diary, reading, travel, links.
- Status uses `select` with options: published, draft.
- Tags and sections use `list` widget with string sub-field.
- Date uses `datetime` widget with `date_only: true` and `format: YYYY-MM-DD`.
- `locale: zh_Hans` for Chinese localization.
- No `publish_mode` set = direct publish (editorial workflow disabled, MVP).
- `slug: '{{slug}}'` template generates filenames from the slug frontmatter field.
- `identifier_field: slug` ensures slug is used as the entry identifier.
- `category` and `sections` are optional fields (matched from `src/data/content.js` validation logic showing these have defaults).
- No extra collections (pages, sections, settings) — blog-only config per spec.
- `site_url` and `display_url` left as placeholder empties for deployment config.
