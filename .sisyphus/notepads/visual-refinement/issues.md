## 2026-05-21T08:39:00Z Task: bootstrap
- Playwright MCP browser skill expects system Chrome path and may fail in this environment.
- Local script-based Playwright (`playwright` npm package with chromium) is confirmed workable for QA.
- Keep compatibility-safe CSS choices where possible to avoid browser-specific rendering regressions.

## 2026-05-21T00:00:00Z Task: tokenized visual foundation
- The stylesheet still contained a few hardcoded accent-border values, so token coverage needed a second pass to avoid mixed conventions.
- `border-left` accents are better expressed as named border tokens than raw widths/colors because they appear in multiple page shells.

## 2026-05-21T00:00:00Z Task: secondary-page differentiation
- `lsp_diagnostics` is unavailable in this environment because the TypeScript and Biome language servers are not installed locally.
- Playwright MCP could not launch through the browser skill because system Chrome is missing; local `playwright` with installed Chromium remains the workable QA path.

## 2026-05-21T00:00:00Z Task: home hierarchy refinement
- The first broad stylesheet patch missed the exact mobile media-query context, so the safer approach was to patch smaller CSS regions directly.
- Browser verification showed no horizontal overflow at 1440 or 375 after the refinement (`scrollWidth` matched viewport width at both sizes).

## 2026-05-21T00:00:00Z Task: article reading refinement
- The stylesheet required careful incremental patches because the article block and responsive block were split across distant sections.
- The article page itself was already stable; the main risk was introducing overflow through TOC labels, related panel buttons, and dense table content.

## 2026-05-21T09:03:08Z Task: responsive-accessibility hardening
- Playwright checks confirm no horizontal overflow at 375, 768, 1024, or 1440 widths for home, archive, tags, about, and article views.
- Reduced-motion verification now checks computed styles directly; animationName becomes none and transitionDuration becomes 0s under `prefers-reduced-motion: reduce`.

## 2026-05-21T09:40:00Z Task: visual verification wiring
- Browser focus assertions can be misleading if they check raw `outline-style`; this app exposes a visible ring via computed `outline-width` and shadow-driven styling instead.
- The consolidated verifier initially timed out on the article click because the search filter was still active; clearing the filter before the article click made the flow deterministic.

## 2026-05-21T10:05:00Z Task: visual refinement remediation
- The shared verifier now depends on test hooks for navigation and article selection, which avoids fragile role/text fallback when copy changes slightly.
- Reduced-motion checks need to sample an actually interactive element, not only the global `.reveal` node, so the assertion remains meaningful for control transitions too.

## 2026-05-22T00:00:00Z Task: section scope fidelity fix
- `lsp_diagnostics` could not run because the TypeScript language server is not installed in this environment; build and visual verification were used as the executable checks instead.
- The visual verifier had to be extended with explicit section-toggle assertions because the old coverage only validated that section pages rendered, not that the CTA stayed section-scoped and reset on slug change.
