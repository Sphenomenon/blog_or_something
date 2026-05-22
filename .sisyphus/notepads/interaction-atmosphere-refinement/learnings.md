## 2026-05-21T12:35:00Z Task: bootstrap
Initialized notepad for interaction-atmosphere-refinement. Pending implementation learnings.

## 2026-05-21T00:00:00Z Task: Task 1 transition orchestration
- Centralizing route timing in `src/App.jsx` works cleanly with the existing `window.history.pushState` router and keeps deep-link semantics intact.
- A deterministic `data-transition-state` on the main route wrapper is easy for the visual harness to assert without touching existing `data-testid` selectors.
- Home search typing should stay synchronous; only the surrounding list surfaces need the soft refresh state.

## 2026-05-21T00:10:00Z Task: Task 1 verification stabilization
- The home search assertion needs to wait for the refresh state to surface, not just inspect immediately after `.fill()`.
- The transition state is deterministic once observed via `data-list-transition-state`, so the harness should wait for that attribute before asserting.

## 2026-05-21T00:20:00Z Task: Task 1 verification fix
- The harness should assert the list refresh window, not a single synchronous sample right after typing, because the refresh state is short-lived and timing-sensitive.
- Waiting for `data-list-transition-state="refreshing"` before checking the input preserves the product behavior while making the test deterministic.

## 2026-05-21T00:35:00Z Task: Task 3 atmosphere refinement
- The global atmosphere reads cleanly when it lives in `body::before`/`body::after` with negative stacking and `pointer-events: none`, while panel-level overlays handle local texture density.
- Adding `isolation: isolate` to the main shell and prominent panels keeps pseudo-elements behind content without needing to rewrite the view markup.
- Mobile density trimming is easiest to reason about as an opacity reduction on the decorative layers rather than a separate mobile-only background system.

## 2026-05-21T13:00:00Z Task: Task 4 visual verification expansion
- Grouped verification payloads are easiest to keep deterministic when they wrap the existing check arrays instead of replacing them, so downstream consumers can keep the legacy fields while gaining named group status.
- Background-layer assertions should match the implemented layering contract directly: generated pseudo-elements with `pointer-events: none` and negative z-index are enough to prove the decoration stays behind content.
- Readability checks are more stable when they sample the rendered prose article itself and verify line-height ratio plus the absence of decorative pseudo-elements on `article.prose`.

## 2026-05-21T13:24:08Z Task: Task 5 final polish and consolidation
- Running `npm run build` followed by two consecutive `npm run verify:visual` executions is a practical flake gate for transition timing cleanup and keeps evidence deterministic.
- The grouped verification fields (`transitionChecks`, `greetingStackChecks`, `backgroundLayerChecks`, `readabilityChecks`, `reducedMotionChecks`) provide a stable top-level contract for final regression signoff.

## 2026-05-21T13:29:26Z Task: F3 real manual QA
- Full Playwright interaction sweep (`npm run verify:visual`) remains a reliable final-wave gate for this plan because it validates direct-route loads, stacked greeting progression (keys/wheel/buttons), transition lifecycle markers, and runtime cleanliness in one run.
- Readability protection is confirmed by runtime CSS evidence (`article.prose` has no decorative pseudo-elements/background images and maintains paragraph line-height ratio 1.9), so atmosphere layers are not intruding into long-form content.
- Responsive behavior stayed stable across 375/768/1024/1440 widths with zero horizontal overflow in all required views (home, archive, article, sections, about).

## 2026-05-21T13:30:23Z Task: F1 timing-cap fix
- The F1 reject was caused by a strict token mismatch, not a motion-system bug: `--duration-slow` must stay at or below 450ms because the route stage consumes that token directly.
