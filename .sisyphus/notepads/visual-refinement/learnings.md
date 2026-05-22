## 2026-05-21T08:39:00Z Task: bootstrap
- Current app is React + Vite with multi-view local blog structure.
- Prior runtime black screen root cause was missing React import in JSX files; fixed and verified.
- Existing diagnostics scripts: `debug-page.mjs` and `debug-interactions.mjs`.
- Visual refinement scope excludes deployment and content-system migration.

## 2026-05-21T00:00:00Z Task: tokenized visual foundation
- The stylesheet already centralizes the archive look in `src/styles.css`, so token work can stay highly localized.
- Semantic surface tokens map cleanly onto the existing low-saturation dark archive palette without changing page structure.
- A single `:where(...):focus-visible` block can cover brand, nav, form, card, rail, and related controls while keeping the focus glow restrained.

## 2026-05-21T00:00:00Z Task: secondary-page differentiation
- Page-specific modifier classes (`page-panel--archive`, `page-panel--tags`, `page-panel--about`) let the secondary pages diverge by composition while staying inside the same surface language.
- Archive benefits from timeline-like vertical cues and staggered row geometry; tags reads best as a compact index grid with tight label/count pairing.
- About works as a manifesto card when the intro lead and metadata are separated from the explanatory body, instead of forcing it into the same list/grid structure as archive or tags.

## 2026-05-21T00:00:00Z Task: home hierarchy refinement
- The home page reads best when the hero stays the strongest surface, the filter bar becomes a compact control strip, and the archive list owns the main vertical rhythm.
- Splitting card content into `card-body` and `card-foot` makes the metadata block and tags easier to balance without changing the card’s semantics.
- Thin pseudo-element edge lines work well for subtle circuit/detail cues as long as they stay low-opacity and are masked by `overflow: hidden`.

## 2026-05-21T00:00:00Z Task: article reading refinement
- Resetting TOC state on post change keeps the active item aligned with the opened article without adding scroll sync.
- A TOC row becomes meaningfully distinct when it changes not only color but also weight, background treatment, and underline treatment on the active label.
- Article reading stability improved by giving tables fixed layout on desktop and a horizontal overflow fallback only on narrow screens.

## 2026-05-21T09:03:08Z Task: responsive-accessibility hardening
- Added small-screen breathing room for header, nav, search, filter chips, archive cards, article rails, tag cloud, and about cards without changing page structure.
- Strengthened keyboard focus with a thicker outline and halo so nav, search, card-hit, archive rows, tag buttons, and related buttons are unmistakable on Tab.
- Reduced-motion now fully disables animation and transitions instead of leaving 1ms timing residue, which made browser verification clearer.

## 2026-05-21T09:40:00Z Task: visual verification wiring
- A shared Playwright harness keeps `debug-page.mjs`, `debug-interactions.mjs`, and `scripts/verify-visual.mjs` aligned on the same deterministic browser path.
- The article-open flow is safest when the home filter is cleared before clicking the archive card button directly by its accessible name.
- Evidence artifacts are most useful when the verifier writes both a machine-readable JSON summary and a short markdown build/verification summary.

## 2026-05-21T10:05:00Z Task: visual refinement remediation
- Stable `data-testid` hooks on existing nav, search, card, archive, tag, and article controls make the verifier independent of exact Chinese copy while staying unobtrusive.
- A shared `openView()` helper is the cleanest way to keep navigation waits consistent across debug scripts and the main visual verifier.
- Screenshot evidence is easiest to trust when the verifier emits one PNG per key view at the default desktop viewport alongside the JSON summary.

## 2026-05-22T00:00:00Z Task: section scope fidelity fix
- The section page can satisfy the F4 scope requirement with an inline expand/collapse toggle instead of routing to the global archive, which keeps the user on the section-scoped page.
- Resetting the expanded state on `sectionSlug` change is essential for deterministic regression checks, because it prevents stale expanded UI from leaking across sections.
- Stable `aria-expanded` plus the existing `data-testid="section-all-posts-*"` hook gave the visual verifier a reliable way to assert collapsed, expanded, and reset states.
