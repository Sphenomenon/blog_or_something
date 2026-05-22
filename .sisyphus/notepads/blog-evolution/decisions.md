
- Decision: implement a small internal route parser (`parseRoute`) in `src/App.jsx` instead of adding a dependency such as `react-router-dom` to satisfy the no-new-dependencies constraint and keep scope to Task 1 foundation.
- Decision: keep `/sections/:sectionSlug` parseable now, but intentionally render deterministic not-found for section routes until dedicated section UI is implemented in later tasks.
- Decision: preserve historical nav behavior for `nav-post` by mapping it to the first post slug (`/posts/petrified-corridor`) so existing verification flows can still open a concrete article route.
- Decision: expose `sections` as a sorted exported array plus `getSectionBySlug()` returning `null` for unknown slugs so upcoming section consumers can rely on a stable, explicit missing-value contract.

- Chose not to add a frontmatter dependency (e.g., gray-matter) to keep implementation minimal and deterministic for current controlled content shape.
- Enforced section validity against both a fixed allowlist and `getSectionBySlug` to guarantee compatibility with canonical section registry.

- Resolved Task 3 regression with minimal scope: `src/data/posts.js` now uses `import { posts } from "./content.js"; export { posts };` so `getTagCounts()` can access `posts` while preserving public exports.

- Decision for Task 4: resolve `/sections/:slug` directly to a real section page only when the slug exists in the canonical registry; invalid slugs continue to fall through to the existing not-found state.
- Decision for section backgrounds: layer the imported section art with a gradient fallback and keep `backgrounds/greeting.png` as the graceful fallback asset inside the same section wrapper.

- Decision for Task 5: treat the six canonical sections as the only primary navigation targets, and keep tags as auxiliary metadata tooling so the IA stays section-first without losing filter/search affordances.

- Decision for Task 6: implement markdown-to-React rendering in `ArticleView` via explicit block parsing instead of HTML injection; this keeps rendering safe, dependency-free, and compatible with existing prose styles.
- Decision for Task 6 TOC behavior: frontmatter `sections` remains authoritative when present; fallback derives labels from parsed `##/###` headings only when `sections` is effectively absent (`["正文"]`).
- Decision for article metadata: section display label comes from canonical section registry (`getSectionBySlug`) and links to `/sections/{section}` for human-readable section context.

- Decision for Task 7: the greeting gate is a real entry screen on `/`, not a persistence-suppressed first-visit modal; it uses local component state only and is reset when the user leaves home so every new entry sees the onboarding flow.
- Decision for Task 7 controls: the gate keeps wheel, ArrowUp/Down, PageUp/PageDown, and explicit Previous/Next/Enter buttons so accessibility does not depend on a mouse wheel.
- Decision for verification: `scripts/visual-core.mjs` is now the source of truth for greeting behavior, including stepping through all three panels and dismissing the gate via the Enter Home control before checking the home shell.

- Decision for Task 8: keep the music easter egg entirely client-side, collapsed by default, and gated behind `greetingDismissed` so it only appears once the main shell is visible.
- Decision for music config: use a minimal placeholder model with nullable `playlistId`/`embedUrl` fields and a clear unavailable fallback, rather than inventing a fake NetEase ID or attempting autoplay.

- Decision for Task 9: keep integration backward-compatible by making `openPost` accept either a slug string or legacy post object, then normalize to route navigation (`/posts/{slug}`) in one place (`App.jsx`).
- Decision for search contract: replace query matching on `post.category` with section-aware fields (`section label`, `shortLabel`, `slug`) to satisfy section-label discoverability without changing existing UI selectors or archive/home layouts.
2026-05-21: Added `overflow-x: clip` to the main shell and the new section/greeting/music containers rather than touching routing or content logic. Extended the existing focus-visible and reduced-motion rules instead of introducing new animation patterns, preserving the archive tone while improving accessibility.

- Decision for Task 11: keep the verification payload additive by appending `routeChecks`, `onboardingChecks`, `sectionScreenshots`, `musicChecks`, and `markdown` rather than changing the existing evidence contract.
- Decision for markdown verification: assert the article title and TOC count for `/posts/petrified-corridor`, because the current post corpus is prose-only and does not include blockquote/code/table examples.
- Decision for music verification: treat “no autoplay” as the absence of audio/video/iframe embeds before and after expanding the easter egg, since the music feature is intentionally a collapsed placeholder with no real embed config.

- Decision for Task 12 docs: keep `src/content/README.md` concise and implementation-facing, with no CMS, comment, or deployment guidance, so it stays strictly within the authoring contract.
- Decision for new-post workflow: describe the runtime as file-based only, meaning a new post should require just one markdown file plus rebuild, with no additional registration step.

- 2026-05-21 (F1 follow-up): Added `sectionBackgroundChecks` as a first-class payload block in visual evidence and enforced `assertCondition` on missing/non-URL computed backgrounds so verifier exits non-zero on section background regressions.
