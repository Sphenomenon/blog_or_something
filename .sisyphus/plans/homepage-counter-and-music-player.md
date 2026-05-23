# Homepage Counter and NetEase Music Player

## TL;DR
> **Summary**: Implement the homepage total visit counter and the NetEase embedded music player together so shared homepage/visual-test changes are coordinated in one execution. This plan supersedes `.sisyphus/plans/homepage-vercount-visit-counter.md`.
> **Deliverables**:
> - One global Vercount script and a compact right-sidebar `本站总访问次数` module.
> - A lazily rendered NetEase Cloud Music iframe player derived from the existing `music.embed_url`.
> - No autoplay; visitors decide playback from the NetEase player.
> - Existing music YAML/CMS schema preserved.
> - One consolidated update to visual verification for both features.
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 4 → Final Verification Wave

## Context
### Original Request
- Add “网页访问次数” on the homepage with visual style matching the blog.
- Upgrade the existing music module from a plain URL/facts display to a NetEase Cloud Music-style embedded player.
- Do not autoplay music; visitors should decide whether to play/stop.
- Use the music link already configured in the blog.
- Merge the music-player plan and visit-counter plan into a single plan.

### Interview Summary
- Visit counter provider: Vercount.
- Visit counter metric: total site page views via `vercount_value_site_pv`.
- Visit counter label: `本站总访问次数`.
- Visit counter location: homepage right sidebar `SidePanel`.
- Visit counter fallback: `--`.
- Vercount script: load globally once in `index.html`.
- Music source: existing `src/content/music.yaml` `embed_url: https://music.163.com/song?id=2707332868`.
- Music implementation: simple single-song only; no CMS/YAML schema restructure.
- Music iframe URL: `https://music.163.com/outchain/player?type=2&id=2707332868&auto=0&height=66`.
- Music iframe render timing: only after panel expansion / user intent.

### Metis Review (gaps addressed)
- Mark the old Vercount-only plan as superseded to avoid double execution.
- Do not use `playlist_id: Tiantian` as a NetEase ID; derive the song ID only from `music.embed_url`.
- Replace stale music visual assertions that currently expect no iframe/media.
- Do not rely on live Vercount or NetEase network success in tests.
- Keep iframe autoplay disabled: `auto=0`, no autoplay attribute, no `allow="autoplay"`.
- Preserve existing YAML and CMS fields.

## Work Objectives
### Core Objective
Add a homepage visit counter and convert the music easter egg into a real user-initiated NetEase embedded player while preserving the blog’s existing dark archive aesthetic and static React/Vite architecture.

### Deliverables
- `index.html` includes exactly one non-blocking Vercount script.
- `src/pages/HomeView.jsx` right sidebar includes a compact visit-count module.
- `src/components/MusicEasterEgg.jsx` derives NetEase song ID from `music.embed_url`, lazily renders the NetEase iframe after expansion, and keeps the original song link as fallback.
- `src/styles.css` includes compact counter styles and NetEase iframe/container styles without breaking existing responsive layout.
- `scripts/visual-core.mjs` verifies both features in one consolidated pass.

### Definition of Done (verifiable conditions with commands)
- `npm run build` exits `0`.
- `npm run verify:visual` exits `0` or produces only documented unrelated failures.
- `index.html` has exactly one script whose src is `https://events.vercount.one/js`.
- Homepage after greeting dismissal shows `[data-testid="home-visit-counter"]` with label `本站总访问次数`.
- Counter value element has class `vercount_value_site_pv`, `data-testid="home-visit-counter-value"`, and fallback/current text that is non-empty (`--` or numeric).
- Music collapsed state has no NetEase iframe.
- Music expanded state has exactly one iframe with `data-testid="music-easter-egg-player"` and URL query containing `type=2`, `id=2707332868`, `auto=0`, `height=66`.
- Music iframe has no autoplay attribute and no `allow` containing `autoplay`.
- Fallback link exists and points to `https://music.163.com/song?id=2707332868`.
- No horizontal overflow at 375, 768, 1024, and 1440 px before or after music panel expansion.

### Must Have
- Vercount:
  - Use `https://events.vercount.one/js` exactly once.
  - Use `vercount_value_site_pv` only.
  - Label exactly `本站总访问次数`.
  - Test IDs: `home-visit-counter`, `home-visit-counter-value`.
- Music:
  - Use `music.embed_url` as the source of truth.
  - Derive song ID `2707332868` from the current URL.
  - Generate HTTPS outchain iframe URL with `auto=0`.
  - Render iframe only after the music panel is expanded.
  - Keep fallback link to original `music.embed_url`.
  - Test IDs: `music-easter-egg-player`, `music-easter-egg-fallback-link`.
- Styling:
  - Counter follows `.side-panel` visual language.
  - Music iframe container follows `.music-easter-egg` visual language.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Do NOT implement Vercount UV (`vercount_value_site_uv`) or page PV (`vercount_value_page_pv`).
- Do NOT add charts, analytics dashboards, Cloudflare D1, localStorage tracking, GoatCounter, Umami, Plausible, or backend APIs.
- Do NOT add autoplay, `allow="autoplay"`, or `auto=1`.
- Do NOT use `music.playlist_id` for player ID construction.
- Do NOT add playlist/multi-song support.
- Do NOT add new YAML/CMS fields or restructure `src/content/music.yaml` / `public/admin/config.yml`.
- Do NOT build custom audio controls or scrape NetEase APIs.
- Do NOT inspect or style inside the cross-origin NetEase iframe.
- Do NOT modify the deferred Artalk/VPS comment plan.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after using `npm run build` and existing Playwright visual verification.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.
- External-network policy: tests assert DOM contracts, script tags, generated iframe URLs, and fallback behavior; they do not wait for live Vercount replacement or NetEase iframe internals.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Task 1 (Vercount script + sidebar counter), Task 2 (NetEase music player + styles)
Wave 2: Task 3 (consolidated visual verification), Task 4 (build/scope/responsive sweep)

### Dependency Matrix (full, all tasks)
- Task 1: blocks Task 3 and Task 4.
- Task 2: blocks Task 3 and Task 4.
- Task 3: blocked by Tasks 1 and 2; blocks final verification.
- Task 4: blocked by Tasks 1 and 2; blocks final verification.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 2 tasks → visual-engineering, quick.
- Wave 2 → 2 tasks → unspecified-high, quick.

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add global Vercount script and homepage sidebar counter

  **What to do**: Add one non-blocking Vercount script to `index.html`: `<script defer src="https://events.vercount.one/js"></script>` near existing body scripts and before the Vite module script. In `src/pages/HomeView.jsx`, add a compact counter section inside `SidePanel`, preserving the existing category buttons and terminal/status section. Mark it with `data-testid="home-visit-counter"`, label it exactly `本站总访问次数`, and render the value element as `<span className="vercount_value_site_pv" data-testid="home-visit-counter-value">--</span>`. In `src/styles.css`, add scoped counter styles near `.side-panel` styles, using existing design tokens and avoiding layout disruption.
  **Must NOT do**: Do not add UV/page PV spans. Do not add a React script-injection effect. Do not add any other analytics provider. Do not change route logic, greeting gate, archive cards, or music component in this task.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: small UI addition must match existing sidebar style.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - commit only after full merged feature verification.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Tasks 3, 4 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - File: `index.html:19-24` - existing body scripts; add Vercount exactly once without moving Vite module script.
  - Pattern: `src/pages/HomeView.jsx:67-91` - `SidePanel` insertion target.
  - Style: `src/styles.css:913-1003` - `.side-panel` visual language and mono status text.
  - External: `https://vercount.one/` - official script URL and site PV span class/id conventions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `index.html` contains exactly one script with `src="https://events.vercount.one/js"`.
  - [ ] `src/pages/HomeView.jsx` contains `data-testid="home-visit-counter"`.
  - [ ] `src/pages/HomeView.jsx` contains `data-testid="home-visit-counter-value"` on an element with class `vercount_value_site_pv`.
  - [ ] Counter label text is exactly `本站总访问次数`.
  - [ ] Counter fallback text is exactly `--`.
  - [ ] Runtime code does not add `vercount_value_site_uv` or `vercount_value_page_pv`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Vercount script and counter DOM are correct
    Tool: Playwright
    Steps: Start dev server; open `/`; dismiss `greeting-gate` if visible; inspect scripts and `[data-testid="home-visit-counter"]`.
    Expected: Exactly one `events.vercount.one/js` script exists; counter is visible; label is `本站总访问次数`; value element has class `vercount_value_site_pv`; value text is `--` or a numeric string.
    Evidence: .sisyphus/evidence/task-1-counter-dom.json

  Scenario: Counter remains homepage-scoped
    Tool: Playwright
    Steps: Open `/archive`, `/about`, a known `/posts/...` route, and `/sections/tech`; query `[data-testid="home-visit-counter"]`.
    Expected: Counter appears on `/` only and is absent on non-home routes.
    Evidence: .sisyphus/evidence/task-1-counter-route-scope.json
  ```

  **Commit**: YES | Message: `feat(home): add visit counter` | Files: `index.html`, `src/pages/HomeView.jsx`, `src/styles.css`

- [x] 2. Upgrade music easter egg to lazy NetEase iframe player

  **What to do**: Update `src/components/MusicEasterEgg.jsx` so the collapsed state remains iframe-free. When the existing toggle expands the panel, derive a numeric song ID from `music.embed_url`. For the current configured URL, derive `2707332868`. Generate the iframe URL `https://music.163.com/outchain/player?type=2&id=2707332868&auto=0&height=66`. Render one iframe with `data-testid="music-easter-egg-player"`, `title="NetEase Cloud Music player: ${music.title}"`, `loading="lazy"`, and no autoplay attributes. Render a fallback link with `data-testid="music-easter-egg-fallback-link"` and `href={music.embed_url}`. Keep provider/title/description copy; remove raw URL-as-fact as the primary experience. Add graceful unavailable state when no valid NetEase song ID can be derived. Add/adjust styles in `src/styles.css:1005-1120` for the iframe container and fallback link.
  **Must NOT do**: Do not change `src/content/music.yaml` schema. Do not change `public/admin/config.yml`. Do not use `music.playlist_id` as ID source. Do not add playlist/multi-song support. Do not set `auto=1`, `autoplay`, or `allow="autoplay"`. Do not build custom audio controls or call scraping APIs.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: component behavior plus style update with responsive iframe constraints.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - existing visual direction is fixed; do not redesign broadly.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Tasks 3, 4 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Component: `src/components/MusicEasterEgg.jsx:4-64` - current toggle, panel, facts display, and availability logic.
  - Config: `src/content/music.yaml:1-6` - existing `embed_url`, title, description, autoplay false.
  - Guardrail: `public/admin/config.yml:129-141` - do not restructure CMS fields.
  - Style: `src/styles.css:1005-1120` - current music card styles.
  - Test: `scripts/visual-core.mjs:426-447` and `1134-1151` - current music collectors/assertions to update in Task 3.
  - External: NetEase outchain pattern `https://music.163.com/outchain/player?type=2&id=<song_id>&auto=0&height=66`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Collapsed music panel renders no iframe with `music.163.com/outchain/player`.
  - [ ] Expanded music panel renders exactly one iframe with `data-testid="music-easter-egg-player"`.
  - [ ] Iframe `src` starts with `https://music.163.com/outchain/player` and includes query params `type=2`, `id=2707332868`, `auto=0`, `height=66`.
  - [ ] Iframe has no `autoplay` attribute and no `allow` attribute containing `autoplay`.
  - [ ] Fallback link exists with `href="https://music.163.com/song?id=2707332868"`.
  - [ ] `src/content/music.yaml` and `public/admin/config.yml` are unchanged unless only non-schema content text is intentionally edited.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Music iframe lazy-renders after visitor expands panel
    Tool: Playwright
    Steps: Open `/`; dismiss greeting if visible; confirm no NetEase iframe exists; click `[data-testid="music-easter-egg-toggle"]`; inspect `[data-testid="music-easter-egg-player"]`.
    Expected: No iframe before expansion; exactly one iframe after expansion; iframe URL contains `type=2`, `id=2707332868`, `auto=0`, `height=66`.
    Evidence: .sisyphus/evidence/task-2-music-iframe.json

  Scenario: Music player preserves fallback and disables autoplay
    Tool: Playwright
    Steps: Expand music panel; inspect iframe attributes and fallback link.
    Expected: Fallback link href equals original `https://music.163.com/song?id=2707332868`; iframe has no autoplay attribute; iframe allow attribute is absent or does not contain `autoplay`.
    Evidence: .sisyphus/evidence/task-2-music-no-autoplay.json
  ```

  **Commit**: YES | Message: `feat(home): embed netease music player` | Files: `src/components/MusicEasterEgg.jsx`, `src/styles.css`

- [x] 3. Update visual verification once for both homepage features

  **What to do**: Update `scripts/visual-core.mjs` to verify both the visit counter and the new music iframe behavior in one pass. Replace stale music assertions that expect no iframe/media and unavailable placeholder copy. Keep existing visual evidence patterns. For counter checks, assert script count, homepage visibility, label, value class, and route scope. For music checks, assert collapsed state has no iframe, expanded state has exactly one iframe with expected NetEase URL query, no autoplay attribute/allow, and fallback link. Add responsive overflow checks after music expansion at existing viewport widths where feasible.
  **Must NOT do**: Do not wait for Vercount to return a live number. Do not wait for NetEase iframe internals to load. Do not assert cross-origin iframe content. Do not keep old assertions that conflict with iframe rendering.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: large Playwright script with existing checks; must avoid regressions.
  - Skills: [`playwright`] - browser automation verification.
  - Omitted: [`frontend-ui-ux`] - no design implementation in this task.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: final verification | Blocked By: Tasks 1, 2

  **References** (executor has NO interview context - be exhaustive):
  - Test: `scripts/visual-core.mjs:1-18` - constants/evidence setup.
  - Test: `scripts/visual-core.mjs:290-330` - home view opening/greeting dismissal pattern.
  - Test: `scripts/visual-core.mjs:426-447` - current music state collector to update.
  - Test: `scripts/visual-core.mjs:1134-1151` - stale music assertions to replace.
  - UI: `src/pages/HomeView.jsx` after Task 1.
  - UI: `src/components/MusicEasterEgg.jsx` after Task 2.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Visual verification asserts `home-visit-counter` exists on `/` after greeting dismissal.
  - [ ] Visual verification asserts exactly one `events.vercount.one/js` script exists.
  - [ ] Visual verification asserts counter value element has class `vercount_value_site_pv`.
  - [ ] Visual verification asserts non-home routes do not include `home-visit-counter`.
  - [ ] Visual verification asserts music collapsed state has no NetEase iframe.
  - [ ] Visual verification asserts music expanded state has one NetEase iframe with `type=2`, `id=2707332868`, `auto=0`, `height=66`.
  - [ ] Visual verification asserts fallback link href equals `https://music.163.com/song?id=2707332868`.
  - [ ] Visual verification has no active assertion requiring zero media/iframe after music expansion.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Consolidated homepage feature verification passes
    Tool: Bash
    Steps: Run `npm run verify:visual`.
    Expected: Command exits 0; evidence contains visit-counter state and music-player state with generated iframe URL attributes.
    Evidence: .sisyphus/evidence/task-3-verify-visual-merged.txt

  Scenario: Tests avoid live third-party dependencies
    Tool: Bash
    Steps: Inspect updated visual evidence/checks for Vercount and NetEase.
    Expected: Checks assert DOM/script/iframe URL contracts only; no assertion requires live Vercount numeric replacement or NetEase iframe internal DOM load.
    Evidence: .sisyphus/evidence/task-3-third-party-independent.txt
  ```

  **Commit**: YES | Message: `test(home): verify counter and music player` | Files: `scripts/visual-core.mjs`

- [x] 4. Final build, scope, responsive, and supersession sweep

  **What to do**: Run final build and verification. Confirm changed files are limited to expected feature files. Confirm no forbidden analytics/music scope was added. Confirm old `.sisyphus/plans/homepage-vercount-visit-counter.md` is superseded by this plan; optionally add a one-line superseded note to the old plan if the executor is operating in plan-maintenance mode, otherwise leave it untouched and rely on this plan’s supersession note. Confirm no changes to Artalk/comment plan. Confirm responsive no-overflow at 375, 768, 1024, 1440 with music expanded.
  **Must NOT do**: Do not edit comment-system files. Do not delete old plans unless explicitly requested. Do not commit evidence unless project convention requires it. Do not fix unrelated visual failures without documenting them.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded final verification and scope audit.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - use only if user explicitly asks for commit.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: final verification | Blocked By: Tasks 1, 2

  **References** (executor has NO interview context - be exhaustive):
  - Build scripts: `package.json:6-12`.
  - Expected files: `index.html`, `src/pages/HomeView.jsx`, `src/components/MusicEasterEgg.jsx`, `src/styles.css`, `scripts/visual-core.mjs`.
  - Superseded plan: `.sisyphus/plans/homepage-vercount-visit-counter.md`.
  - Deferred plan to avoid touching: `.sisyphus/plans/china-friendly-artalk-comments.md`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits `0`.
  - [ ] `npm run verify:visual` exits `0`.
  - [ ] Runtime/test files contain no `vercount_value_site_uv`, `vercount_value_page_pv`, `busuanzi`, `goatcounter`, `umami`, or `plausible` provider code.
  - [ ] Music runtime contains no `auto=1`, `allow="autoplay"`, or use of `playlist_id` as player ID source.
  - [ ] `src/content/music.yaml` and `public/admin/config.yml` schema are unchanged.
  - [ ] `.sisyphus/plans/china-friendly-artalk-comments.md` is unchanged by implementation.
  - [ ] Evidence documents no horizontal overflow at required viewport widths with music expanded.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Build and visual verification pass after merged feature
    Tool: Bash
    Steps: Run `npm run build`; run `npm run verify:visual`.
    Expected: Both commands exit 0.
    Evidence: .sisyphus/evidence/task-4-build-visual.txt

  Scenario: Scope sweep confirms only selected counter/music behavior
    Tool: Bash
    Steps: Search changed files for forbidden strings: `vercount_value_site_uv`, `vercount_value_page_pv`, `busuanzi`, `goatcounter`, `umami`, `plausible`, `auto=1`, `allow="autoplay"`, and player usage of `playlist_id`.
    Expected: No forbidden runtime matches; only selected Vercount site PV and NetEase `auto=0` iframe remain.
    Evidence: .sisyphus/evidence/task-4-scope-sweep.txt
  ```

  **Commit**: YES | Message: `feat(home): add visit counter and music player` | Files: final changed implementation/test files


## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle — APPROVE
- [x] F2. Code Quality Review — unspecified-high — APPROVE (fixed: unused import + dead CSS)
- [x] F3. Real Manual QA — unspecified-high (+ playwright) — APPROVE (DOM + visual tests pass)
- [x] F4. Scope Fidelity Check — deep — APPROVE

## Commit Strategy
- Suggested single commit: `feat(home): add visit counter and music player`
- Expected changed files: `index.html`, `src/pages/HomeView.jsx`, `src/components/MusicEasterEgg.jsx`, `src/styles.css`, `scripts/visual-core.mjs`.
- Do not commit unrelated draft cleanup unless explicitly requested.

## Success Criteria
- Homepage has a compact, visually consistent total visit counter.
- Music easter egg expands into a real NetEase iframe player using the existing configured song link.
- No autoplay is introduced.
- Existing build and visual verification remain passing.
- Old Vercount-only plan is clearly superseded by this merged plan.
