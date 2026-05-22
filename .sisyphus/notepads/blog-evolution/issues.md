
- Environment issue: `lsp_diagnostics` could not run because `typescript-language-server` is not installed in this workspace runtime (`Command not found: typescript-language-server`).
- Route contract nuance: existing `nav-tags` selector is retained, but it now navigates to `/sections/tags` as a section-route placeholder, which currently resolves to deterministic not-found pending future section-page implementation.
- Regression observed: `debug-interactions.mjs` timed out/fails on tags because script still expected `标签页`; fixed by updating `scripts/visual-core.mjs` tags checks to wait/assert `data-testid="not-found-view"` under current Task 1 contract.
- No blocker encountered while wiring background assets for the new section registry; repo already contains matching files for each required section slug.

- LSP diagnostics could not be executed because `typescript-language-server` is not installed in the environment; verification relied on Vite build and runtime validation behavior.
- Direct Node import check for `src/data/content.js` failed as expected outside Vite because `import.meta.glob` is a Vite transform feature, not native Node runtime API.

- Fixed runtime ReferenceError in `src/data/posts.js`: switching from re-export-only (`export { posts } from "./content.js"`) to local import + re-export restored lexical binding required by `getTagCounts()`.

- `lsp_diagnostics` remains unavailable in this runtime because both `typescript-language-server` and `biome` are missing; build verification was used as the fallback truth source for the edited JS/CSS files.

- Tags content is now intentionally demoted to a secondary metadata surface; it is no longer represented as primary navigation, which means any existing automation that expects `标签` in the header will need to follow the updated section-first selectors.

- Markdown parser scope is intentionally conservative (no raw HTML pass-through and no nested list/table edge-case normalization) to keep article rendering safe without adding sanitizer dependencies.

- `lsp_diagnostics` remains unavailable in this workspace because the configured TypeScript and Biome language servers are not installed; build and Playwright verification were the authoritative checks for the greeting work.
- The first visual verification pass failed because keyboard events were sent before the greeting gate was focused; the fix was to auto-focus the gate and explicitly focus it in `scripts/visual-core.mjs` before advancing panels.
- The visual verifier also needed to treat a fresh `/` entry as a greeting state before the home shell appears; it now dismisses the gate through `data-testid="greeting-enter-home"` before asserting `档案索引`.

- `inspectInteractions()` in `scripts/visual-core.mjs` must always account for greeting-first entry on `/`; the minimal fix was to reuse the existing Enter Home control before filling `data-testid="search-query"`.

- `lsp_diagnostics` is still unavailable in this runtime because `typescript-language-server` is not installed, so static editor diagnostics could not be used as a verification source for the new JSX/CSS files.
- The music easter egg currently renders the graceful unavailable copy by design because no NetEase playlist or track ID was supplied in the task context.

- `lsp_diagnostics` could not be executed for modified JSX files because `typescript-language-server` is not installed in this runtime; verification relied on required build/runtime/visual command suite, all passing.
2026-05-21: The first broad stylesheet patch missed exact selector context in a few places, so the safest path was to re-read the local blocks and patch the CSS in smaller chunks. That kept the change confined to the intended responsive/accessibility polish.

- The first pass over Task 11 failed because the chosen article does not render blockquote/code/table content; the markdown assertion was corrected to match the actual post corpus.
- A redundant `greeting-enter-home` click after `openView("home")` caused a timeout because the helper had already dismissed the gate; the verifier now uses the already-dismissed home state for music checks.
- `openView()` originally only handled `section-tech`, which made later section screenshot checks silently wrong until the helper was generalized for all `section-{slug}` routes.

- No runtime issue surfaced while documenting content authoring, but the repo still relies on the content loader’s fail-fast validation, so README guidance needs to stay aligned with `src/data/content.js`.

- 2026-05-21 (F1 follow-up): Final-wave verification originally missed overflow coverage for five section routes and had no explicit section background assertion; resolved by expanding overflow sweep view matrix and adding fail-fast per-section background checks in `scripts/visual-core.mjs`.
