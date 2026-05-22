## Task 1 issues

- `lsp_diagnostics` could not run because `typescript-language-server` is not installed in this environment.
- Helper verification was completed with direct Node execution instead, and the evidence JSON files were generated successfully.

- Visual verification initially failed because the onboarding assertion ran after the page had already navigated away from the greeting gate state.
- Route transition checks also needed an explicit wait for `data-transition-state="transitioning"` to avoid reading an immediate stale `idle` state after navigation.

## Task 3 issues

- The Vite build emits existing Rollup warnings from `@vueuse/core` about `/* #__PURE__ */` comments, but they do not fail the build.
- Direct Node imports of `src/data/content.js` are not usable outside Vite because of `import.meta.glob`, so article-order validation has to run through the app or the visual verifier instead.

## Task 4 issues

- `lsp_diagnostics` is still unavailable because the required language servers are not installed in this environment (`typescript-language-server` and `biome`).
- `src/data/content.js` cannot be imported directly with plain Node for archive-year introspection because it depends on `import.meta.glob`; the safe verification path is the app and visual verifier.
- The archive verification initially used hardcoded year values, but the dataset only currently exposes two years, so the checks had to be rewritten to walk the available years generically.

## Task 5 issues

- `lsp_diagnostics` remains unavailable for the modified JS/JSX/CSS files because `typescript-language-server` and `biome` are not installed in this environment.
- The first visual assertion timed out because the verifier expected the greeting panel to settle into `revealed`, but the component correctly promotes the newly entered panel to `active` after its enter animation.
- The greeting route flash check needed to be explicit about greeting asset leakage on `/archive`, since the section backgrounds still legitimately retain their own image layers.

## Task 6 issues

- The first consolidated Task 6 run failed in-script because `launchPage()` did not propagate the new `consoleEntries` field added in `createPage()`, causing an undefined dereference during console-cleanliness assertions.
- The initial selected-scope summary incorrectly flagged `articleNavigationAndCommentsScope` as failed because some non-article route branches validated comment scope but did not return `comments` in `routeChecks`; returning those fields fixed deterministic group evaluation.
- `lsp_diagnostics` is still unavailable in this environment (`typescript-language-server` missing), so verification remained command-driven (`npm run build` and `npm run verify:visual` twice) with generated JSON/markdown/png artifacts.
