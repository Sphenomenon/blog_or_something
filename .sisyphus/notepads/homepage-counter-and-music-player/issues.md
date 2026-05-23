## Task 1 - Verification notes

- `lsp_diagnostics` on `src/styles.css` could not run because the configured `biome` LSP server is not installed in this environment.
- `lsp_diagnostics` on `src/pages/HomeView.jsx` reported only an existing TypeScript hint that `React` is declared but never read; no LSP errors were reported for the changed JSX file.
- `npm run build` passed, with non-failing third-party Rolldown `INVALID_ANNOTATION` warnings from `node_modules/@vueuse/core/dist/index.js`.


## 2026-05-24 - Lazy NetEase music iframe verification notes
- CSS LSP diagnostics could not run because the configured `biome` language server is not installed in this environment (`Command not found: biome`). JS diagnostics for `src/components/MusicEasterEgg.jsx` passed after removing the unused default React import.
- `npm run build` completed successfully but Vite/Rolldown emitted existing third-party `INVALID_ANNOTATION` warnings from `node_modules/@vueuse/core`; these did not fail the build.

## 2026-05-24 - Visual verification update notes
- Plain `npm run verify:visual` initially hit stale Node listeners already bound to `127.0.0.1:5173`, producing navigation timeouts and an unrelated browser syntax error; `scripts/visual-core.mjs` now supports `VISUAL_BASE_URL`/`VITE_BASE_URL` while preserving the default `http://127.0.0.1:5173/`.
- Direct live third-party requests caused timeouts or console noise (`API error: Failed to fetch` / resource failures), so visual verification now fulfills known external hosts inside Playwright instead of asserting live Vercount replacement or NetEase iframe internals.
- `lsp_diagnostics` for `scripts/visual-core.mjs` reports only existing unused-symbol hints for `exerciseGreetingGate` and `onboardingContext`; no errors were reported.
- `npm run verify:visual` passed on the isolated port. The build step inside visual verification still emits existing non-failing Rolldown `INVALID_ANNOTATION` warnings from `node_modules/@vueuse/core`.
