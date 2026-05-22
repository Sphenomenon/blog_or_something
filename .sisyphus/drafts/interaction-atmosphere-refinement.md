# Draft: Interaction Atmosphere Refinement

## Requirements (confirmed)
- Smooth transitions when switching different tags/sections.
- User chose transition scope: all site switching, including section/page route changes plus home filter/search/archive metadata interactions where appropriate.
- Greeting next / mouse-wheel-down should keep old text visible and reveal new text below the old text, with silky transition.
- The farthest/global background feels empty; add linework and atmosphere that blends dream library, modern archive system, and grayscale industrial ruin.
- Visual language: dark low light, old book paper, low-saturation gray-green and pale gold, clear document modules, archive numbers, directories, memos, annotations, stone-powder texture, ruined backdrop, calm otherworldly feeling.
- Title areas may use constructivist strong grids, diagonals, geometric blocks, and inscription/monument feeling.
- Body/content areas must remain restrained, clear, and suitable for long Chinese reading.
- Overall mood: a dream library taken over by a research institution, gradually petrified, abandoned, and faded years later.

## Technical Decisions
- Planning only; implementation plan will target existing React/Vite blog and CSS/verification patterns after exploration returns.
- Treat “tag” as current section-first IA unless exploration finds an actual tag-switching interaction still primary.
- Use the existing custom history router in `src/App.jsx`; do not add React Router for this refinement.
- Preserve all current `data-testid` hooks and extend visual verification rather than introducing a separate Playwright test suite.
- Require `prefers-reduced-motion: reduce` fallbacks for all new route/greeting/background motion.
- Keep article `.prose` readability protected; atmospheric linework belongs to global/page/title surfaces, not body text backgrounds.
- User chose background implementation: CSS/SVG generated layering, no new required image asset.

## Research Findings
- `src/App.jsx` owns routing via `window.history.pushState`, `pathname` state, `parseRoute`, and conditional view rendering.
- `src/components/GreetingGate.jsx` currently shows exactly one `currentPanel` at a time; wheel, Arrow/Page keys, Previous/Next all mutate `activeIndex`.
- `src/styles.css` already has body layered gradients, `body::before` grid/noise overlay, `.reveal`, motion tokens, focus-visible styles, and reduced-motion override at `@media (prefers-reduced-motion: reduce)`.
- `src/pages/SectionView.jsx` applies section background assets to `.page-panel--section` via inline `backgroundImage`; section selector is `data-testid="section-view-${section.slug}"`.
- `scripts/visual-core.mjs` is the central Playwright verification runner; it checks direct routes, greeting traversal, focus/motion, overflow across 375/768/1024/1440, section backgrounds, and screenshots.

## Open Questions
- None blocking.

## Scope Boundaries
- INCLUDE: interaction motion plan, greeting progressive reveal behavior, global background/atmosphere styling, verification updates.
- EXCLUDE: deploying, adding CMS/comments/login, replacing existing content model, implementing code directly in this planning pass.
