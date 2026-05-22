# Interaction Atmosphere Refinement

## TL;DR
> **Summary**: Refine the existing React/Vite blog with smoother all-site transitions, a stacked greeting reveal, and a richer CSS/SVG atmospheric background inspired by a petrified dream library/archive system. Preserve the current custom router, accessibility, reduced-motion behavior, and Chinese long-form readability.
> **Deliverables**:
> - All-site transition system for route/page changes and selected in-page state changes
> - Greeting gate converted from single-panel replacement to stacked progressive reveal
> - CSS/SVG global background linework with archive/library/industrial-ruin atmosphere
> - Extended visual verification for motion, stacked greeting, readability, overflow, and reduced-motion
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Task 2/3 → Task 4 → Task 5

## Context
### Original Request
- “能否在切换不同标签的时候更平滑”
- “对于开头的greeting：点击next或者鼠标滚轮向下的时候，效果为：旧的文本不消失，新文本出现在旧文本下方。同样的，要丝滑过渡”
- “最后面的背景……有点空，可以尝试加点线条” with aesthetic direction: dream library + modern archive system + grayscale industrial ruin; dark low light, old paper, low-saturation gray-green/pale gold, document modules, archive numbers, catalogues, memos, annotations, stone-powder texture, ruins, calm otherworldliness.
- Title areas may use constructivist grids, diagonals, geometric blocks, and inscription feeling; body areas must remain restrained, clear, and suitable for Chinese long-form reading.

### Interview Summary
- Transition scope decision: **全站切换**. Apply smoothing to route/page changes and selected in-page state changes, not only section navigation.
- Background implementation decision: **CSS/SVG 叠层**. Do not require new raster image assets.
- Existing architecture decision: keep the custom browser-history router in `src/App.jsx`; do not add React Router.
- Verification decision: extend existing `scripts/visual-core.mjs`; do not add a separate Playwright test framework.

### Metis Review (gaps addressed)
- Added a transition inventory to prevent “all-site switching” scope creep.
- Defined greeting stacked-reveal behavior, overflow, mobile, reset, and reverse-navigation contracts.
- Defined visual zoning so decoration is allowed on global/page/title surfaces but forbidden from interfering with `.prose`.
- Added reduced-motion, focus, viewport, readability, and performance acceptance checks.

## Work Objectives
### Core Objective
Improve perceived smoothness and atmosphere while preserving the blog’s existing section-first archive architecture, accessibility, performance, and long-form reading comfort.

### Deliverables
- Route/page transition wrapper and CSS state classes integrated with current `pathname`-driven rendering.
- Home filter/search/archive metadata transitions that are smooth but do not delay typing or navigation.
- Greeting stacked transcript reveal where old text remains and the next text appears beneath it.
- CSS/SVG atmospheric background layers: archive grid, diagonal constructivist title accents, memo/catalogue linework, subtle stone-powder texture.
- Verification evidence in `.sisyphus/evidence/` proving build, visual checks, accessibility, reduced-motion, overflow, and readability protections.

### Definition of Done (verifiable conditions with commands)
- `npm run build` exits 0.
- `npm run verify:visual` exits 0.
- `.sisyphus/evidence/visual-verification.json` contains passing checks for route transitions, greeting stacked reveal, reduced-motion, overflow, focus, background zoning, and prose readability guard.
- `.sisyphus/evidence/visual-verification-summary.md` lists all new checks as passed.
- Screenshots exist for home, greeting stacked state, article, archive, and all six sections at 1440px.

### Must Have
- Preserve `data-testid` selectors currently used by verification.
- Preserve keyboard accessibility for greeting and navigation.
- Preserve `@media (prefers-reduced-motion: reduce)` behavior: no animated interpolation, same state progression.
- Keep article `.prose` readable and visually calm.
- Use CSS/SVG generated layers only for new global background atmosphere.

### Must NOT Have
- Must NOT introduce `react-router-dom` or another router.
- Must NOT add new raster image assets as required implementation inputs.
- Must NOT use `dangerouslySetInnerHTML`.
- Must NOT put decorative overlays above `.prose` text or reduce text contrast.
- Must NOT create vague acceptance criteria like “looks smoother”; all acceptance criteria must be agent-executable.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after using existing custom Playwright runner in `scripts/visual-core.mjs` plus `npm run build`.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}` plus updated `.sisyphus/evidence/visual-verification.json` and summary.

## Transition Inventory
| State Change | Animate? | Contract | Verification Hook |
| --- | --- | --- | --- |
| Route/page changes among `/`, `/archive`, `/about`, `/posts/:slug`, `/sections/:slug` | YES | Outgoing content fades/slides no more than 8px; incoming content reveals within 450ms; cleanup classes removed after transition. | `main`, route-specific test IDs, transition class assertions in `scripts/visual-core.mjs` |
| Section nav active-state change | YES | Active underline/color transitions using existing `.site-nav button.active`; no layout jump. | `nav-section-${slug}` |
| Home status/tag filter changes | YES | Result list/cards reveal softly; filter chip active state transitions; typing remains immediate. | `.filter-bar`, `archive-card-*`, `search-query` |
| Header search input typing | PARTIAL | Do not debounce/delay value updates; only result list change may animate. | `search-query` |
| Archive/article related navigation | YES | Same route/page transition contract as other route changes. | `archive-card-AR-2026-041`, `article-related-*` |
| Greeting Next / wheel down / ArrowDown / PageDown | YES | Previous entries remain visible; next entry appears below with smooth opacity/translate reveal. | `greeting-panel-1/2/3`, new stack selectors |
| Greeting Previous / wheel up / ArrowUp / PageUp | YES | Active index moves upward; already revealed entries remain visible but active marker changes. Do not delete text unless returning before first panel is impossible. | `greeting-prev`, stack selectors |
| Greeting Enter Home | YES | Gate exits or home appears smoothly; reduced-motion exits instantly. | `greeting-enter-home`, home heading |
| Hover/focus micro-interactions | YES | Existing focus rings preserved; no hover-only information. | focus-visible checks |
| Music easter egg expand/collapse | NO NEW WORK | Preserve existing behavior; do not expand scope. | existing music checks |

## Visual Zoning Contract
- Global shell/body: may contain CSS/SVG linework, archive IDs, low-opacity grids, diagonal geometry, memo/catalogue strokes, stone-powder texture.
- Title/hero/page panels: may use stronger constructivist grids and geometric blocks, especially `.hero-panel`, `.article-hero`, `.page-panel-header`, `.section-hero`.
- Article `.prose`: no decorative overlay above text, no animated background behind paragraphs, no reduction to existing font size/line-height, no `mix-blend-mode` layer inside prose.
- Mobile: decorative density must reduce at `width <= 780px`; no horizontal overflow.

## Greeting Stacked-Reveal Contract
- Initial load shows panel 1 text only.
- Next / wheel down / ArrowDown / PageDown reveals the next panel below the existing text; previous panel text remains visible.
- At final step, all three entries are visible in vertical order: 自我介绍 → 个人碎片 → 技术栈.
- Previous / wheel up / ArrowUp / PageUp changes active marker upward but does not remove already revealed text once it has appeared in the current greeting session.
- Reset behavior: leaving home and returning to `/` starts a fresh greeting session with only panel 1 visible, matching existing every-entry greeting behavior.
- Overflow behavior: stack is contained in the greeting panel; on mobile it may scroll vertically inside the page but must not clip controls or create horizontal overflow.
- Reduced-motion behavior: entries appear immediately with no transform/opacity animation, but the same entries become visible after the same inputs.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Task 1 foundation contracts and route/page transition state; Task 3 background atmosphere can proceed in parallel after respecting zoning.
Wave 2: Task 2 greeting stacked reveal; Task 4 verification expansion after Task 1/2/3 APIs/selectors settle.
Wave 3: Task 5 final polish, evidence, and regression pass.

### Dependency Matrix (full, all tasks)
| Task | Blocked By | Blocks |
| --- | --- | --- |
| 1. Add transition orchestration and all-site transition styles | None | 2, 4, 5 |
| 2. Convert greeting to stacked progressive reveal | 1 | 4, 5 |
| 3. Add CSS/SVG atmospheric background linework | None | 4, 5 |
| 4. Extend visual verification for motion/background/readability | 1, 2, 3 | 5 |
| 5. Run final polish and evidence consolidation | 4 | Final Verification Wave |

### Agent Dispatch Summary (wave → task count → categories)
| Wave | Task Count | Categories |
| --- | ---: | --- |
| 1 | 2 | `visual-engineering`, `visual-engineering` |
| 2 | 2 | `visual-engineering`, `quick` |
| 3 | 1 | `unspecified-high` |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add transition orchestration and all-site transition styles

  **What to do**: Add a lightweight transition orchestration layer around the existing `pathname` / view rendering in `src/App.jsx`. Preserve the custom `window.history.pushState` router. Introduce deterministic CSS state classes or data attributes on `main` / a route transition wrapper so route/page changes can animate and clean up. Extend `src/styles.css` with reusable transition classes for page enters, route exits, active nav changes, and list/card refreshes. Apply transitions to route/page changes, section nav active changes, home filter result list refreshes, and archive/article related navigation. Search input value updates must remain immediate; only the result list may reveal softly.
  **Must NOT do**: Do not add `react-router-dom`. Do not delay typing in `search-query`. Do not remove existing route deep-link behavior. Do not remove existing `data-testid` selectors.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: Requires UI motion design and careful React/CSS integration.
  - Skills: [] - No extra skill required.
  - Omitted: [`git-master`] - No commit requested during task execution.

  **Parallelization**: Can Parallel: YES with Task 3 | Wave 1 | Blocks: [2, 4, 5] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/App.jsx:13-156` - Current route state, `navigateTo`, `openPost`, `openSection`, greeting mount, and conditional view rendering.
  - Pattern: `src/styles.css:203-221` - Existing `.site-nav button` transition and active styles to preserve/extend.
  - Pattern: `src/styles.css:268-283` - Existing `.reveal` and `@keyframes reveal-frame` animation pattern.
  - Pattern: `src/styles.css:1777-1801` - Reduced-motion override that must disable new transitions.
  - Test: `scripts/visual-core.mjs:175-216` - `openView` route helper affected by route transitions.
  - Test: `scripts/visual-core.mjs:334-389` - Existing focus and reduced-motion checks to extend.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits 0.
  - [ ] Navigating `/` → `/sections/tech` → `/sections/essay` → `/archive` → `/posts/petrified-corridor` preserves expected headings/test IDs and no page errors in Playwright.
  - [ ] During a route change, the transition wrapper exposes a machine-detectable transition state (`data-transition-state` or documented class) and removes it within 600ms.
  - [ ] `search-query` input value changes immediately on typing; result list may transition but input value must match typed text synchronously in Playwright evaluation.
  - [ ] `prefers-reduced-motion: reduce` causes computed transition/animation durations for route/list transition samples to be `0s` or `none` while navigation still succeeds.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Route transitions complete and clean up
    Tool: Playwright
    Steps: Open /, dismiss greeting with data-testid="greeting-enter-home", click data-testid="nav-section-tech", then data-testid="nav-section-essay", then data-testid="nav-archive"; inspect main transition state before and after 700ms.
    Expected: Correct view test IDs/headings appear; transient transition class/data attribute appears during transition and is absent/idle after 700ms; no console page errors.
    Evidence: .sisyphus/evidence/task-1-route-transitions.json

  Scenario: Reduced motion keeps behavior without animated interpolation
    Tool: Playwright
    Steps: Emulate reducedMotion="reduce"; navigate between /sections/tech and /archive; evaluate computed animationName and transitionDuration on the transition wrapper and .reveal sample.
    Expected: Navigation succeeds; computed animationName is "none" or duration is "0s"; transitionDuration is "0s".
    Evidence: .sisyphus/evidence/task-1-reduced-motion.json
  ```

  **Commit**: NO | Message: `feat(ui): add route transition system` | Files: [`src/App.jsx`, `src/styles.css`, `scripts/visual-core.mjs`]

- [x] 2. Convert greeting to stacked progressive reveal

  **What to do**: Refactor `src/components/GreetingGate.jsx` so it tracks revealed panels separately from active panel. Initial home greeting shows only panel 1. Next / wheel down / ArrowDown / PageDown reveals the next panel below previous text with smooth opacity/translate reveal. Old text remains visible. At final step all three panels are visible in order. Previous / wheel up / ArrowUp / PageUp changes active marker upward without deleting already revealed text in the current session. Keep `Enter Home` behavior and every-entry reset behavior from `src/App.jsx`. Add stable selectors for stack entries if needed, but preserve existing `greeting-panel-1`, `greeting-panel-2`, `greeting-panel-3`, `greeting-prev`, `greeting-next`, `greeting-enter-home`.
  **Must NOT do**: Do not make old greeting text disappear on forward navigation. Do not create a focus trap. Do not hide controls on mobile. Do not use timers that make verification flaky.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: Requires coordinated React state, animation, and responsive accessibility behavior.
  - Skills: [] - No extra skill required.
  - Omitted: [`frontend-ui-ux`] - Built-in command unavailable in this session and task is already scoped.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4, 5] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/components/GreetingGate.jsx:4-23` - Current three panel content and IDs; preserve content/order.
  - Pattern: `src/components/GreetingGate.jsx:27-83` - Current `activeIndex`, wheel debounce, keyboard handlers, and `stepPanel` behavior.
  - Pattern: `src/components/GreetingGate.jsx:85-136` - Current selectors and controls that verification uses.
  - Pattern: `src/styles.css:407-530` - Existing greeting layout/styles to adapt to stacked entries.
  - Pattern: `src/App.jsx:68-72` - Existing reset behavior when leaving home.
  - Test: `scripts/visual-core.mjs:312-328` - Existing greeting traversal test to update for stacked behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits 0.
  - [ ] On fresh `/`, exactly panel 1 text is visible; panel 2 and 3 text are not visible.
  - [ ] One `greeting-next` click makes panel 1 and panel 2 text visible in vertical order.
  - [ ] One wheel-down event from the initial state makes panel 1 and panel 2 text visible in vertical order.
  - [ ] ArrowDown and PageDown have the same reveal outcome as Next.
  - [ ] After reaching panel 3, all three texts remain visible and `Enter Home` still dismisses the gate.
  - [ ] On mobile viewport 375px, greeting stack and controls have no horizontal overflow and controls remain reachable.
  - [ ] Under reduced motion, content reveals immediately without transform/opacity animation, but state progression is identical.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Next button stacks greeting text
    Tool: Playwright
    Steps: Open /; assert greeting-gate visible; assert greeting-panel-1 text visible and panel-2 text not visible; click greeting-next; read bounding boxes/text for greeting-panel-1 and greeting-panel-2.
    Expected: Both panel 1 and panel 2 text are visible; panel 2 top is below panel 1 top; panel 1 remains visible; no page errors.
    Evidence: .sisyphus/evidence/task-2-greeting-next-stack.json

  Scenario: Wheel and reduced-motion parity
    Tool: Playwright
    Steps: Open / at 375px; dispatch wheel deltaY > 0 on greeting-gate; emulate reducedMotion="reduce" and repeat on fresh page; inspect visible panel texts and computed animation/transition styles.
    Expected: Wheel reveals panel 2 below panel 1 in both modes; reduced-motion has no animated transform/transition; no horizontal overflow.
    Evidence: .sisyphus/evidence/task-2-greeting-wheel-reduced.json
  ```

  **Commit**: NO | Message: `feat(greeting): stack onboarding entries` | Files: [`src/components/GreetingGate.jsx`, `src/styles.css`, `scripts/visual-core.mjs`]

- [x] 3. Add CSS/SVG atmospheric background linework

  **What to do**: Enrich the farthest/global background using CSS/SVG-generated layers only. Extend `body` / `body::before` / optional `body::after` or `.app-shell` pseudo-elements with low-opacity archive grids, document modules, diagonal constructivist title accents, catalogue/memo linework, archive numbering motifs, stone-powder texture, and muted gray-green/pale-gold accents. Apply stronger geometric treatment to title/hero/page surfaces (`.hero-panel`, `.article-hero`, `.page-panel`, `.section-hero`) while keeping `.prose` restrained. Reduce decoration density on mobile. Ensure all decorative layers are `pointer-events: none` and sit behind content.
  **Must NOT do**: Do not add raster assets. Do not place overlays above `.prose` text. Do not reduce paragraph readability or existing line-height. Do not create horizontal overflow. Do not animate expensive filters in scroll paths.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: Requires aesthetic CSS composition and readability protection.
  - Skills: [] - No extra skill required.
  - Omitted: [`artistry`] - The desired aesthetic is detailed enough; execution should be disciplined rather than exploratory.

  **Parallelization**: Can Parallel: YES with Task 1 | Wave 1 | Blocks: [4, 5] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/styles.css:88-115` - Current body gradient and `body::before` texture/grid overlay.
  - Pattern: `src/styles.css:237-266` - Existing `.hero-panel` constructivist line overlay pattern.
  - Pattern: `src/styles.css:993-1107` - `.prose` readability styles that must remain calm and clear.
  - Pattern: `src/styles.css:1600-1775` - Responsive rules for mobile density reductions.
  - Pattern: `src/styles.css:1777-1801` - Reduced-motion override; decorative layers should not depend on animation.
  - Pattern: `src/pages/SectionView.jsx:26-34` - Section page background asset layering; do not override section-specific images.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits 0.
  - [ ] Global background has at least two generated decorative layers visible through computed styles on `body::before`, `body::after`, or documented wrapper pseudo-elements.
  - [ ] All decorative pseudo-elements have `pointer-events: none`.
  - [ ] `.prose` computed background remains transparent or a calm surface without overlay pseudo-elements above text; `.prose p` color and line-height are not reduced from current values.
  - [ ] At 375/768/1024/1440 widths, no route has horizontal overflow.
  - [ ] Section backgrounds still include `url(...)` for all six sections.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Atmospheric layers exist without blocking content
    Tool: Playwright
    Steps: Open / after dismissing greeting; evaluate computed styles for body::before/body::after and top-level decorative layers; click nav-section-tech and archive-card-AR-2026-041.
    Expected: Decorative layers are present with pointer-events none; clicks work; section and article routes open; no page errors.
    Evidence: .sisyphus/evidence/task-3-background-layers.json

  Scenario: Article readability zone is protected
    Tool: Playwright
    Steps: Open /posts/petrified-corridor; evaluate computed styles for article.prose, .prose p, article-hero, and any overlapping pseudo-elements.
    Expected: `.prose p` line-height remains at least current readable value; paragraph color remains high contrast against surface; no decorative layer is positioned above article text; no horizontal overflow.
    Evidence: .sisyphus/evidence/task-3-prose-readability.json
  ```

  **Commit**: NO | Message: `style(theme): add archive atmosphere layers` | Files: [`src/styles.css`, `scripts/visual-core.mjs`]

- [x] 4. Extend visual verification for motion, stacked greeting, background zoning, and readability

  **What to do**: Update `scripts/visual-core.mjs` so `npm run verify:visual` verifies the new interaction and visual contracts. Add structured checks for route transition state/cleanup, search immediacy with list transition, greeting stacked reveal via button/wheel/key, reduced-motion parity, CSS/SVG decorative layer presence, prose readability zoning, and overflow across all existing viewport/route coverage. Preserve existing route, markdown, music, section background, focus, and screenshot checks. Write new evidence details into `.sisyphus/evidence/visual-verification.json` and `.sisyphus/evidence/visual-verification-summary.md`.
  **Must NOT do**: Do not create a separate Playwright config/test suite. Do not remove existing checks or weaken current assertions. Do not make checks depend on manual visual review.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Script extension with known selectors and explicit assertions.
  - Skills: [] - No extra skill required.
  - Omitted: [`playwright`] - Skill command is unavailable here; use existing script patterns directly.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [5] | Blocked By: [1, 2, 3]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `scripts/visual-core.mjs:1-12` - Imports, evidence directory, viewport constants, section slug constants.
  - Pattern: `scripts/visual-core.mjs:84-97` - Evidence write and screenshot helpers.
  - Pattern: `scripts/visual-core.mjs:312-328` - Existing greeting traversal to replace/extend with stacked assertions.
  - Pattern: `scripts/visual-core.mjs:334-389` - Existing focus and reduced-motion checks to extend.
  - Pattern: `scripts/visual-core.mjs:391-438` - Existing overflow and section background checks to preserve.
  - Pattern: `scripts/visual-core.mjs:440-672` - `runVisualVerification` summary assembly and assertions.
  - API/Type: `package.json:6-10` - `verify:visual` script entrypoint.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits 0.
  - [ ] `npm run verify:visual` exits 0.
  - [ ] `.sisyphus/evidence/visual-verification.json` includes named passing objects for `transitionChecks`, `greetingStackChecks`, `backgroundLayerChecks`, `readabilityChecks`, `reducedMotionChecks`, and existing route/overflow/section/music checks.
  - [ ] `.sisyphus/evidence/visual-verification-summary.md` mentions all new check groups and reports pass status.
  - [ ] Existing screenshots remain generated: home, greeting, article, archive, all six sections, about, music.
  - [ ] New screenshot or JSON evidence exists for greeting stacked state.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full visual verification passes with new check groups
    Tool: Bash
    Steps: Run npm run verify:visual; read .sisyphus/evidence/visual-verification.json; inspect top-level check group names and statuses.
    Expected: Command exits 0; all new check groups exist; every status is pass/ok; no existing check group was removed.
    Evidence: .sisyphus/evidence/task-4-verify-visual-output.json

  Scenario: Greeting and readability evidence are machine-readable
    Tool: Playwright / Bash
    Steps: Use the updated visual runner to exercise greeting Next, wheel, ArrowDown, reduced-motion; open article route and evaluate prose/background styles.
    Expected: Evidence JSON records visible stacked panels in order, reduced-motion parity, prose readability guard values, and no horizontal overflow.
    Evidence: .sisyphus/evidence/task-4-greeting-readability-evidence.json
  ```

  **Commit**: NO | Message: `test(visual): cover transition atmosphere refinements` | Files: [`scripts/visual-core.mjs`, `.sisyphus/evidence/*`]

- [x] 5. Run final polish and evidence consolidation

  **What to do**: Perform a full regression pass after Tasks 1-4. Fix any minor visual/interaction issues found by automated checks without expanding scope. Confirm transition timing through computed durations, not manual judgment: route/list/greeting durations should use existing tokens (`--duration-fast`, `--duration-normal`, `--duration-slow`, `--ease-archive`) and stay within the plan’s max 450ms / 600ms cleanup window. Confirm decorative density reduces on mobile and that title areas can be stronger while body content stays calm. Update repo-local notes only if prior project workflow requires it; otherwise keep changes limited to implementation and verification files.
  **Must NOT do**: Do not add features beyond the three requested refinements. Do not change content/frontmatter/schema. Do not introduce deployment/CMS/comments work. Do not mark final verification tasks complete before reviewer approval and user okay.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Cross-cutting QA/regression pass across UI, CSS, and verification evidence.
  - Skills: [] - No extra skill required.
  - Omitted: [`git-master`] - Commit is deferred until user requests it.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [Final Verification Wave] | Blocked By: [4]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/styles.css:1-75` - Theme tokens and duration/easing variables.
  - Pattern: `src/styles.css:88-115` - Global background layers.
  - Pattern: `src/styles.css:407-530` - Greeting styling.
  - Pattern: `src/styles.css:993-1107` - Prose readability zone.
  - Test: `scripts/visual-core.mjs:440-672` - Full visual verification run.
  - Evidence: `.sisyphus/evidence/visual-verification.json` - Machine-readable evidence to inspect.
  - Evidence: `.sisyphus/evidence/visual-verification-summary.md` - Human-readable summary to update/check.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits 0.
  - [ ] `npm run verify:visual` exits 0 twice consecutively to rule out transition timing flake.
  - [ ] Playwright console/page error arrays are empty in verification evidence.
  - [ ] All route, greeting, focus, reduced-motion, overflow, section background, music, markdown, transition, background, and readability checks pass.
  - [ ] At 375px viewport, greeting controls remain reachable and no route reports horizontal overflow.
  - [ ] At 1440px viewport, screenshots exist for home, greeting stacked state, article, archive, all six sections, about, and music.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Consecutive verification runs are stable
    Tool: Bash
    Steps: Run npm run build, then npm run verify:visual twice consecutively.
    Expected: All commands exit 0; second verification run does not fail due to timing/transition cleanup; evidence status remains ok.
    Evidence: .sisyphus/evidence/task-5-stability-run.json

  Scenario: Scope and readability regression sweep
    Tool: Playwright / Bash
    Steps: Open all routes in the visual runner at 375 and 1440; inspect evidence for errors, overflow, prose readability, decorative layer pointer-events, and preserved section background URLs.
    Expected: No route overflows; `.prose` remains protected; decorative layers do not block clicks; all six section backgrounds still have URL layers; no unrelated CMS/comments/deployment changes are present.
    Evidence: .sisyphus/evidence/task-5-regression-sweep.json
  ```

  **Commit**: NO | Message: `feat(ui): refine transitions and archive atmosphere` | Files: [`src/App.jsx`, `src/components/GreetingGate.jsx`, `src/styles.css`, `scripts/visual-core.mjs`, `.sisyphus/evidence/*`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit after all implementation tasks and verification pass.
- Suggested message: `feat(ui): refine transitions and archive atmosphere`
- Include changed source, styles, verification scripts, and evidence summaries only if the project convention includes evidence files.

## Success Criteria
- User-requested interaction semantics are implemented exactly: all-site smooth transitions, stacked greeting reveal, and CSS/SVG atmospheric background.
- No regressions to route deep links, greeting entry behavior, article rendering, section backgrounds, search, archive navigation, focus, reduced-motion, or viewport overflow.
- Verification is fully automated and recorded in `.sisyphus/evidence/`.
