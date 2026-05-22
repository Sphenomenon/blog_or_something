# Layered Blog Utilities

## TL;DR
> **Summary**: Add the selected blog utility/depth improvements without expanding into a full IA redesign: section entrance pages, Waline comments, post prev/next navigation, year-paginated archive, and two greeting/route visual fixes.
> **Deliverables**:
> - Section pages show intro + 3 newest representative posts + all-posts CTA.
> - Article pages get previous/next navigation and Waline comments with forced login.
> - Archive groups posts by year and paginates by year.
> - Site header tagline changes per section route.
> - Greeting next/wheel reveal animates new text instead of instant appearance.
> - Route changes no longer flash the greeting background.
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 data/navigation helpers → Tasks 2/3/4 UI work → Task 5 visual bug fixes → Task 6 verification consolidation

## Context
### Original Request
- User accepted only: “主题页做入口页,” Waline comments, post previous/next navigation, archive page remodel by year grouping + pagination.
- User also requested: greeting wheel/Next reveal must transition, and route clicks briefly flashing the greeting background should be investigated as likely bug.
- User explicitly said: “只规划不要动代码.” This document is the execution plan only.

### Interview Summary
- Waline `serverURL`: use Vite public env placeholder; backend deployment is out of scope.
- Waline login: force login before commenting.
- Archive pagination: by year.
- Section representative posts: 3 newest posts per section.
- Comments: article pages only.
- Yookoishi reference: borrow only shallow blog/category/archive utility ideas; do not copy visual style or expand nav scope.

### Metis Review (gaps addressed)
- Deterministic ordering rules are locked below.
- Waline env-missing behavior is defined below.
- Waline path canonicalization is defined below.
- Greeting flash gets route-transition test matrix coverage.
- Edge cases are included for <3 section posts, archive boundaries, article prev/next boundaries, and missing Waline env.

## Work Objectives
### Core Objective
Implement the selected utility/depth pass while preserving the existing dark archival design system and avoiding broad homepage/global IA redesign.

### Deliverables
- Section entrance preview layout.
- Article previous/next navigation.
- Article-only Waline comment block.
- Year-grouped archive with year pagination.
- Animated greeting reveal for newly revealed panels.
- No greeting-background flash on non-home route transitions.
- Updated visual verification for all above behavior.

### Definition of Done (verifiable conditions with commands)
- `npm run build` exits `0`.
- `npm run verify:visual` exits `0` and emits evidence under `.sisyphus/evidence/`.
- Playwright/visual evidence confirms section, article, archive, greeting, route flash, and Waline degraded-mode behavior.

### Must Have
- Section preview rule: latest 3 posts in that section, sorted by existing normalized post ordering/date descending; if dates tie, tie-break by slug ascending for determinism.
- Section with fewer than 3 posts displays all available posts without empty placeholders.
- Section page must include a clear CTA to view all posts in that section; this may expand inline or navigate to an existing/all-section list, but must be automated-testable.
- Previous/next rule: adjacent articles according to the same global sorted `posts` order used by current lists; newest article has no “next newer” link, oldest article has no “previous older” link.
- Archive rule: one year per page; default archive page shows latest year with posts; empty years are excluded.
- Archive navigation boundary states must be disabled/absent at newest/oldest year.
- Waline env var: `VITE_WALINE_SERVER_URL`.
- Waline missing-env behavior: do not crash; render an explicit disabled comments notice in article pages only.
- Waline path key: canonical article pathname only, without query/hash and without trailing slash except root.
- Waline mode: `login: 'force'`; backend deployment and backend env configuration are documented but not implemented.
- Site is fixed dark; Waline dark setting should use fixed dark or selector matching the app shell, not light default.
- Site header tagline mapping (per user-provided text):
  - Home / default: `庞大而臃肿，记录一场腐朽的梦`
- `/sections/essay` (随笔): `兑上零散花瓣，削入几块冰，醇而不辛，甘洌醉人`
- `/sections/diary` (日记): `……你知道这世上没有万灵药`
- `/sections/reading` (文章): `于是我们抖擞精神，奋发向前，却如逆水行舟，被不断推回往昔岁月`
- `/sections/travel` (游记): `那纵横八千九百千米的安第斯山脉不仅会忠实地记住一切，也足够雄伟到能够将一切的罪恶藏于其中`
- `/sections/links` (友链): `孩子兴奋地跑向太阳，它第一次见到如此明亮的事物。直到筋疲力竭，它才发现紧握的手中不知何时空无一物`
- `/sections/tech` (技术) and any other unlisted section slugs: fall back to home default tagline.
- Archive, about, and other non-section views fall back to the home tagline.

### Must NOT Have
- No full homepage IA redesign.
- No new CMS, RSS, deployment, backend Waline deployment, or tag/category dedicated pages unless already present and directly needed for archive/section links.
- No comments outside article pages.
- No copying yookoishi/Frosti visual styling.
- No removing existing route/list transition behavior.
- No human-only acceptance criteria.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + existing Vite/Playwright visual verification.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Task 1 shared deterministic content helpers + test selector conventions.
Wave 2: Tasks 2, 3, 4 can run mostly in parallel after Task 1.
Wave 3: Task 5 motion/flash fixes + Task 6 verification consolidation.

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2, 3, 4, 6.
- Task 2 depends on Task 1.
- Task 3 depends on Task 1.
- Task 4 depends on Task 1.
- Task 5 can start after Task 1 but must be verified after Tasks 2-4 due route/layout interactions.
- Task 6 depends on Tasks 2-5.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 1 task → quick
- Wave 2 → 3 tasks → visual-engineering, unspecified-low, visual-engineering
- Wave 3 → 2 tasks → visual-engineering, unspecified-high

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add deterministic blog utility helpers and selector contracts

  **What to do**: Add or update helper logic in the existing data/page layer so downstream tasks share one ordering rule: posts sorted by date descending using current normalized `posts`, tie-break by slug ascending. Provide helpers/selectors needed for: section top 3 newest, article prev/next neighbors, archive years sorted descending, canonical article comment path. Add stable `data-testid` attributes where needed by verification without changing visible design.
  **Must NOT do**: Do not introduce a new CMS/data model. Do not add manual featured fields. Do not change post content.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: small deterministic logic and selector groundwork.
  - Skills: [] - No special skill needed.
  - Omitted: [`frontend-ui-ux`] - Visual design is handled in later tasks.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: Tasks 2,3,4,6 | Blocked By: none

  **References**:
  - Pattern: `src/data/content.js` - normalized post derivation, `year`, `month`, sort behavior.
  - Pattern: `src/data/posts.js` - post export surface.
  - Pattern: `src/App.jsx` - route parsing and article/section route wiring.
  - Research: Metis directive - deterministic rules and path canonicalization required.

  **Acceptance Criteria**:
  - [ ] `npm run build` exits `0`.
  - [ ] A Node/Playwright-verifiable helper path or rendered output proves section representative posts are newest 3 by date desc, slug asc tie-break.
  - [ ] Canonical comment path excludes query/hash and trailing slash.
  - [ ] No source content/frontmatter fields are added solely for representative selection.

  **QA Scenarios**:
  ```
  Scenario: Deterministic section representative ordering
    Tool: Bash
    Steps: Run a small node/module check or existing visual verifier that computes each section's first 3 post slugs twice.
    Expected: Both runs return identical slug arrays sorted by date descending, then slug ascending.
    Evidence: .sisyphus/evidence/task-1-helper-ordering.json

  Scenario: Canonical Waline path normalization
    Tool: Bash
    Steps: Verify canonical path for `/posts/example?utm=x#top` and `/posts/example/`.
    Expected: Both normalize to `/posts/example`.
    Evidence: .sisyphus/evidence/task-1-canonical-path.json
  ```

  **Commit**: NO | Message: `feat(blog): add layered utility helpers` | Files: [`src/data/*`, page files needing selectors]

- [x] 2. Convert section pages into entrance pages with 3 newest representative posts

  **What to do**: Update `SectionView.jsx` so section pages first explain the section using existing `sections.js` intro/theme metadata, then show exactly 3 newest representative posts or fewer if unavailable, then provide a clear CTA to view all posts for that section. Preserve current section backgrounds and dark archival styling while reducing list-first flatness. Also update `SiteHeader.jsx` to render a per-route tagline using the user-provided mapping: switch tagline from the hardcoded default to a section-keyed lookup derived from active section slug or view.
  **Must NOT do**: Do not redesign homepage. Do not add manual featured flags. Do not remove route support for `/sections/:slug`.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: page layout and interaction clarity.
  - Skills: [] - No extra skills required.
  - Omitted: [`git-master`] - No git operation requested.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 6 | Blocked By: Task 1

  **References**:
  - Pattern: `src/pages/SectionView.jsx` - current intro/metadata/full-list section page.
  - API/Type: `src/data/sections.js` - section intro/theme/background copy source.
  - API/Type: `src/data/content.js` - section/date normalized post fields.
  - Pattern: `src/components/SiteHeader.jsx` - current hardcoded tagline on line 15; receives `activeSectionSlug` prop.
  - Style: `src/styles.css` - section page and archive card patterns.
  - Reference: yookoishi - shallow Blogs/Tech/Life category utility pattern only.

  **Acceptance Criteria**:
  - [ ] `npm run build` exits `0`.
  - [ ] Each non-empty section page renders section intro before representative posts.
  - [ ] Each section page renders max 3 representative post links.
  - [ ] A section with fewer than 3 posts renders only available posts and no blank cards.
  - [ ] CTA to all section posts is visible and actionable/testable.
  - [ ] Site header tagline text matches the user-provided mapping per section route; `/sections/reading` shows `文章` tagline; unlisted sections including `/sections/tech` and non-section views fall back to home default tagline.

  **QA Scenarios**:
  ```
  Scenario: Section entrance happy path
    Tool: Playwright
    Steps: Open `/sections/essay`; locate section intro, representative list, and all-posts CTA.
    Expected: Intro appears before list; representative list count is <=3; CTA is visible and keyboard focusable.
    Evidence: .sisyphus/evidence/task-2-section-entrance.png

  Scenario: Per-section tagline correctness
    Tool: Playwright
    Steps: Visit `/sections/essay`, `/sections/reading`, `/sections/travel`, `/sections/tech`; read the site header subtitle text on each.
    Expected: essay/reading/travel show their mapped taglines; tech and archive/about show home default; no blank or broken state.
    Evidence: .sisyphus/evidence/task-2-section-taglines.json

  Scenario: Low-count section edge case
    Tool: Playwright
    Steps: Open the section with the fewest posts; count representative post cards.
    Expected: Count equals available post count if <3; no empty placeholder appears; layout has no horizontal overflow.
    Evidence: .sisyphus/evidence/task-2-section-low-count.json
  ```
  **Commit**: NO | Message: `feat(sections): add entrance previews` | Files: [`src/pages/SectionView.jsx`, `src/components/SiteHeader.jsx`, `src/styles.css`, `scripts/visual-core.mjs`]

- [x] 3. Add article previous/next navigation and article-only Waline comments

  **What to do**: Update `ArticleView.jsx` to render previous/next article navigation based on deterministic global post ordering. Add an article-only Waline comments component or mount block using `@waline/client`, CSS import, `VITE_WALINE_SERVER_URL`, `login: 'force'`, canonical path, dark styling, SPA cleanup/update lifecycle. If env var is missing, render an explicit disabled comments notice and do not crash.
  **Must NOT do**: Do not deploy Waline backend. Do not add comments to home/archive/section/about pages. Do not use query/hash in comment thread key.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: focused feature integration with lifecycle details.
  - Skills: [] - No extra skills required.
  - Omitted: [`frontend-ui-ux`] - Style should follow existing article footer patterns.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 6 | Blocked By: Task 1

  **References**:
  - Pattern: `src/pages/ArticleView.jsx` - article layout, related posts, route click handlers.
  - API/Type: `src/data/content.js` - global post order and normalized fields.
  - External: `https://github.com/walinejs/waline/blob/8e81b4e73341a9373c8a369bfb67de2a50b2a801/docs/src/en/cookbook/import/project.md#L41-L55` - npm import + CSS pattern.
  - External: `https://github.com/walinejs/waline/blob/8e81b4e73341a9373c8a369bfb67de2a50b2a801/docs/src/en/cookbook/import/project.md#L101-L130` - React wrapper cleanup/update lifecycle.
  - External: `https://github.com/walinejs/waline/blob/8e81b4e73341a9373c8a369bfb67de2a50b2a801/docs/src/en/reference/client/props.md#L6-L25` - `serverURL` and `path` props.
  - External: `https://github.com/walinejs/waline/blob/8e81b4e73341a9373c8a369bfb67de2a50b2a801/docs/src/en/reference/client/props.md#L153-L162` - `login` prop.

  **Acceptance Criteria**:
  - [ ] `npm run build` exits `0`.
  - [ ] `@waline/client` is declared in dependencies if package-based integration is used.
  - [ ] Article pages include comments block; non-article pages do not.
  - [ ] Missing `VITE_WALINE_SERVER_URL` produces visible disabled comments notice and no console/runtime crash.
  - [ ] With env var present, Waline init receives `serverURL`, canonical `path`, `login: 'force'`, and dark config.
  - [ ] Newest/oldest post boundaries render disabled/absent previous/next states correctly.

  **QA Scenarios**:
  ```
  Scenario: Article navigation happy path
    Tool: Playwright
    Steps: Open a middle article route; click previous and next article controls.
    Expected: Each control navigates to the correct adjacent article by global sorted order; route updates without full reload.
    Evidence: .sisyphus/evidence/task-3-prev-next.json

  Scenario: Waline degraded mode and route scope
    Tool: Playwright
    Steps: Run without `VITE_WALINE_SERVER_URL`; open an article, then `/archive`, then `/sections/essay`.
    Expected: Article shows disabled comments notice; archive/section pages have no comments container; no console error from Waline init.
    Evidence: .sisyphus/evidence/task-3-waline-degraded.json
  ```

  **Commit**: NO | Message: `feat(article): add navigation and comments` | Files: [`src/pages/ArticleView.jsx`, `src/components/*`, `src/styles.css`, `package.json`, `scripts/visual-core.mjs`]

- [x] 4. Remodel archive into year-grouped, year-paginated browsing

  **What to do**: Update `ArchiveView.jsx` from `year.month` all-at-once grouping to one-year-per-page browsing. Default to latest year with posts. Exclude empty years. Provide previous/next year controls with disabled/absent boundary states. Keep visual style aligned with current archive dossier design.
  **Must NOT do**: Do not add tag/category pages. Do not paginate by arbitrary post count. Do not show empty years.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: archive layout + pagination controls.
  - Skills: [] - No extra skills required.
  - Omitted: [`librarian`] - External research already completed.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 6 | Blocked By: Task 1

  **References**:
  - Pattern: `src/pages/ArchiveView.jsx` - current archive grouping.
  - API/Type: `src/data/content.js` - `year`, `month`, date-derived fields.
  - Reference: woshiluo - clean chronological archive and pagination concept.
  - Reference: yookoishi - visible archive utility entry only.

  **Acceptance Criteria**:
  - [ ] `npm run build` exits `0`.
  - [ ] Archive default displays latest year with posts.
  - [ ] Archive groups entries under year heading and may preserve month/date labels inside the year.
  - [ ] Previous/next year controls navigate across available years only.
  - [ ] Boundary controls are disabled or absent at newest/oldest year.
  - [ ] Browser back/forward preserves year page state if URL state is used; otherwise in-memory controls remain deterministic and testable.

  **QA Scenarios**:
  ```
  Scenario: Latest-year archive default
    Tool: Playwright
    Steps: Open `/archive`; read visible year heading and post years.
    Expected: Visible heading is latest available year; all listed posts belong to that year.
    Evidence: .sisyphus/evidence/task-4-archive-latest-year.png

  Scenario: Archive year pagination boundaries
    Tool: Playwright
    Steps: Navigate previous year until oldest; then navigate next year until latest.
    Expected: No empty year page appears; oldest has no older-year action; latest has no newer-year action.
    Evidence: .sisyphus/evidence/task-4-archive-boundaries.json
  ```

  **Commit**: NO | Message: `feat(archive): group and paginate by year` | Files: [`src/pages/ArchiveView.jsx`, `src/styles.css`, `scripts/visual-core.mjs`]

- [x] 5. Fix greeting reveal transition and route background flash

  **What to do**: Update `GreetingGate.jsx` and greeting CSS so Next/wheel reveals new text through an enter transition instead of direct instant display. Replace `display: none`-driven reveal with animatable states where needed. Investigate and fix greeting-background flash when navigating to essay/other pages; remove or sequence the shared greeting fallback in `SectionView.jsx`/route backgrounds so non-home pages never briefly paint the greeting background during route transitions.
  **Must NOT do**: Do not remove greeting gate. Do not disable route transitions globally. Do not change section-specific background assets except to remove unsafe greeting fallback behavior.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: motion/visual bug fix.
  - Skills: [] - No extra skills required.
  - Omitted: [`librarian`] - No external docs needed.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Task 6 | Blocked By: Task 1

  **References**:
  - Pattern: `src/components/GreetingGate.jsx` - wheel/button stepping and revealed state.
  - Style: `src/styles.css` greeting block - current hidden/revealed panel styles.
  - Pattern: `src/App.jsx` - route transition state and greeting dismissed reset behavior.
  - Pattern: `src/pages/SectionView.jsx` - shared greeting-background fallback risk.
  - Test: `scripts/visual-core.mjs` - existing visual verification framework.

  **Acceptance Criteria**:
  - [ ] `npm run build` exits `0`.
  - [ ] Wheel down and Next button trigger an observable transition lasting >100ms and <=450ms for newly revealed greeting text.
  - [ ] Reduced-motion mode still reveals text immediately without animation.
  - [ ] Route transitions from home/greeting to `/sections/essay`, `/archive`, and another section do not show greeting background on non-home route screenshots/frames.
  - [ ] Existing route/list transition checks still pass.

  **QA Scenarios**:
  ```
  Scenario: Greeting reveal transition
    Tool: Playwright
    Steps: Open home with greeting; click Next; sample newly revealed panel opacity/transform at start, midpoint, and after transition.
    Expected: Midpoint differs from final state, proving transition; final panel visible and old panel remains visible.
    Evidence: .sisyphus/evidence/task-5-greeting-transition.json

  Scenario: No greeting background flash on route changes
    Tool: Playwright
    Steps: From home/greeting-dismissed state, click Essay/section/archive links and capture frames during first 500ms of route transition.
    Expected: No non-home frame uses greeting background image; intended section or neutral archive background is shown only.
    Evidence: .sisyphus/evidence/task-5-no-background-flash.json
  ```

  **Commit**: NO | Message: `fix(ui): smooth greeting reveal and route backgrounds` | Files: [`src/components/GreetingGate.jsx`, `src/pages/SectionView.jsx`, `src/App.jsx`, `src/styles.css`, `scripts/visual-core.mjs`]

- [x] 6. Consolidate visual verification and regression evidence

  **What to do**: Extend `scripts/visual-core.mjs` or supporting verification scripts to cover all selected scope. Run build and visual verification. Ensure evidence files summarize section entrance, article nav/Waline scope, archive year pagination, greeting transition, no background flash, route regressions, overflow, focus, and reduced-motion behavior.
  **Must NOT do**: Do not rely on manual visual inspection. Do not remove existing checks for route/markdown/music/focus/section backgrounds/readability.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: integration QA across all changed surfaces.
  - Skills: [] - No extra skills required.
  - Omitted: [`git-master`] - No commit requested.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final Verification | Blocked By: Tasks 2,3,4,5

  **References**:
  - Test: `scripts/visual-core.mjs` - existing visual checks and evidence output.
  - Config: `package.json` - `npm run build`, `npm run verify:visual`.
  - Evidence: `.sisyphus/evidence/` - required output location.

  **Acceptance Criteria**:
  - [ ] `npm run build` exits `0`.
  - [ ] `npm run verify:visual` exits `0` twice consecutively.
  - [ ] Evidence JSON/summary includes named pass groups for section entrance, article navigation/comments, archive year pagination, greeting transition, route background flash, reduced-motion.
  - [ ] No horizontal overflow at 375, 768, 1024, 1440 viewport widths.
  - [ ] No browser console errors during checked flows.

  **QA Scenarios**:
  ```
  Scenario: Full selected-scope regression
    Tool: Bash
    Steps: Run `npm run build` then `npm run verify:visual` twice consecutively.
    Expected: All commands exit 0; evidence contains pass=true for every new named group.
    Evidence: .sisyphus/evidence/task-6-full-regression.json

  Scenario: Mobile interaction smoke
    Tool: Playwright
    Steps: At 375px viewport, visit home greeting, section, article, archive; tab through primary controls.
    Expected: No overflow; focus visible; CTA, prev/next, archive year controls, and comments notice are reachable.
    Evidence: .sisyphus/evidence/task-6-mobile-smoke.png
  ```

  **Commit**: NO | Message: `test(blog): verify layered utilities` | Files: [`scripts/visual-core.mjs`, `.sisyphus/evidence/*`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit only after all implementation tasks and final verification approve.
- Suggested message: `feat(blog): add layered utilities and comments`.
- Include source, style, package lock changes, verification scripts, and evidence only if project convention includes evidence files.

## Success Criteria
- Section pages feel like entrances, not full inventory pages.
- Article pages support adjacent reading and article-only forced-login Waline comments.
- Archive browsing is year-grouped and year-paginated.
- Greeting reveal is visibly smooth on normal motion and instant on reduced motion.
- Non-home route transitions never flash the greeting background.
- All behavior is verified automatically with no human-only acceptance gates.
