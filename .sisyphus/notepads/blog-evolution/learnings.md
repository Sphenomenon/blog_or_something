
- Replaced state-only view switching with URL-derived routing in `src/App.jsx` using `window.location.pathname`, `history.pushState`, and `popstate` synchronization.
- Added deterministic post resolution from URL slug via a memoized `postBySlug` map sourced from `src/data/posts.js`; direct reload at `/posts/:slug` now resolves the article without prior in-memory state.
- Preserved existing navigation test hooks (`brand-home`, `nav-home`, `nav-post`, `nav-archive`, `nav-tags`, `nav-about`) by keeping `SiteHeader` test IDs and adapting only route targets in App.
- Interaction smoke scripts must assert tags navigation against Task 1 placeholder behavior (`/sections/tags` => `not-found-view`) rather than legacy tags heading text.
- Added a section registry in `src/data/sections.js` as a single source of truth for six section slugs, ordered metadata, and safe slug lookup helpers.

- Implemented dependency-free markdown pipeline in `src/data/content.js` using Vite raw `import.meta.glob` and strict fail-fast validation (required fields, unique slug, section allowlist, ISO date/calendar safety).
- Kept app contract stable by normalizing each post to include legacy fields plus `section` and parsed markdown `content`; defaulted `tags` to [] and `sections` to [`正文`] when omitted.

- Verification after posts-binding fix: `node debug-page.mjs` and `node debug-interactions.mjs` reported no page errors, and `npm run build` succeeded.

- Built `src/pages/SectionView.jsx` on top of the existing `page-panel` and `ArchiveCard` patterns so section pages stay visually consistent with archive/home cards instead of introducing a new card system.
- Section listing is deterministic: posts are filtered by `post.section`, sorted by `date` descending and `slug` ascending, and the empty state is explicitly rendered with `data-testid="section-empty-state"`.

- Migrated the primary navigation to the canonical six section slugs from `src/data/sections.js` and kept tags out of the main IA; the header now uses stable `nav-section-{slug}` selectors for section-first verification.
- Home sidebar now reuses the same section registry for direct `/sections/{slug}` navigation, which removes duplicated labels and keeps the section list aligned with the header.

- Article rendering now consumes markdown-derived `post.content` in `src/pages/ArticleView.jsx` with a structured, safe parser (no `dangerouslySetInnerHTML`) supporting paragraphs, `h2/h3`, blockquotes, fenced code, ordered/unordered lists, links, images, and pipe-table syntax.
- TOC source now prefers frontmatter `post.sections`; when not provided (default-only `正文`), TOC labels fall back to parsed markdown headings while preserving `data-testid="toc-{n}"` selectors and existing active-state interaction.
- Related posts now rank by same-section priority first and then by newest publish date, keeping side/panel related navigation aligned with section-first IA.

- Added a three-panel `GreetingGate` in `src/components/GreetingGate.jsx` with stable panel selectors, wheel/keyboard/button navigation, and an imported `backgrounds/greeting.png` URL passed through a CSS custom property for the backdrop layer.
- The greeting must be verified through the same Enter Home control a user would use; the browser script now focuses the gate, steps through panel 2 and 3, then dismisses the gate before asserting the home shell.
- Fresh entry to `/` now shows the greeting every time; dismissal is session-local to the current route and is cleared when navigating away from home so direct-entry behavior stays deterministic.

- Added a collapsed-by-default `MusicEasterEgg` in `src/components/MusicEasterEgg.jsx` and mounted it only after the greeting gate is dismissed on the home route, which keeps the easter egg invisible during initial entry.
- The music widget uses a local placeholder config object with `playlistId`/`embedUrl` set to `null`, so the unavailable state is explicit and no autoplay or external script loading is needed.
- Visual verification still passed after the mount change: `npm run build`, `node debug-page.mjs`, `node debug-interactions.mjs`, and `npm run verify:visual` all completed successfully.

- Task 9 integration: unified routed post navigation by passing post slugs through `ArchiveCard`, `ArchiveView`, and article related-entry callbacks, so all open actions resolve via `/posts/{slug}` instead of view-local object assumptions.
- Search behavior remains intact and now explicitly includes section context by matching canonical section `label`/`shortLabel` and `post.section` alongside id/title/excerpt/tags.
- Archive chronology behavior is preserved (`year.month` grouping unchanged), and direct route flows for `/archive`, `/about`, `/sections/{slug}`, and `/posts/{slug}` remained refresh-safe under existing pathname parsing.
2026-05-21: The visual verification suite checks overflow at 375/768/1024/1440 widths and also inspects reduced-motion transitions, so CSS fixes must cover both layout containment and motion overrides. The existing archive system already exposes enough shared tokens and focus styling to keep polish scoped to stylesheet changes.

- Task 11 expanded `scripts/visual-core.mjs` into a fuller route/onboarding verifier: it now checks direct routes, greeting dismissal, section screenshots, markdown rendering signals, and music availability without breaking the existing JSON/summary evidence outputs.
- The article markdown assertions needed to target real rendered structure from `petrified-corridor.md`; the reliable signal was the article title plus TOC count, not generic blockquote/code/table expectations.
- Section screenshots are easiest to keep truthful when each section route is opened explicitly in sequence; a generic helper must understand all `section-{slug}` paths, not just the first canonical section.

- Content docs should mirror `src/data/content.js` exactly, including the six allowed section slugs, required frontmatter fields, and the fallback `sections: [正文]` behavior when frontmatter omits `sections`.
- `src/data/sections.js` is the canonical section registry, so authoring notes should point writers there for labels, order, themes, intro copy, and background asset paths.

- 2026-05-21: For section-first route suites, keep canonical slugs in one constant (`SECTION_SLUGS`) and drive both screenshot/background loops and overflow sweep from it to prevent partial route coverage regressions.
