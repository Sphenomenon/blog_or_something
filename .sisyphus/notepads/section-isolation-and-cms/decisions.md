# Decisions — section-isolation-and-cms

## Technical Decisions
- Nav isolation: STRICT same-section, null if no neighbor
- Section identity: `post.section` slug
- CMS auth: Netlify Identity + GitHub OAuth (no custom backend)
- CMS media: `public/images/uploads/` with `.gitkeep`
- CMS CDN: `decap-cms@^3.0.0` via unpkg
- CMS locale: `zh_Hans`
- Git branch: `main`
- Build command: `npm run build`
- Publish directory: `dist`
