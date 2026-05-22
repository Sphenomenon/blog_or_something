# Visual Refinement for Nocturne Archive Blog

## TL;DR
> **Summary**: Refine the existing local React/Vite blog from a functional dark archive prototype into a cohesive “dream library + institutional archive + petrified ruin” visual system, without changing deployment or content architecture.
> **Deliverables**:
> - Tokenized visual system for surfaces, spacing, typography, focus, and motion
> - Refined home, article, archive, tags, and about views
> - Stronger keyboard/focus states and responsive behavior
> - Automated Playwright-style verification scripts/screenshots for key pages and viewports
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Tasks 2/3/4 → Tasks 5/6 → Final Verification

## Context
### Original Request
User chose **视觉精修** after the local app was fixed and verified. Deployment and content-system migration are later priorities.

### Interview Summary
- Current app is a local React + Vite blog in `/home/sphenicidition/Documents/blog`.
- It already runs locally after fixing `ReferenceError: React is not defined`.
- User wants refinement of the visual experience, not deployment.
- Desired aesthetic remains: “清醒的档案系统，记录一场正在腐朽的梦。”

### Metis Review (gaps addressed)
- Add strict non-goals: no deployment, no CMS/MDX migration, no scroll-synced TOC logic, no new animation framework.
- Define token contract before page tweaks.
- Keep implementation CSS-first and structure-light.
- Add executable QA for viewports, focus, motion, article rhythm, and overflow.

## Work Objectives
### Core Objective
Transform the current working blog into a more coherent, polished, readable, and atmospheric visual system while preserving local functionality.

### Deliverables
- Updated `src/styles.css` visual system tokens and component styles.
- Targeted JSX class/structure updates only where necessary in:
  - `src/components/SiteHeader.jsx`
  - `src/components/ArchiveCard.jsx`
  - `src/pages/HomeView.jsx`
  - `src/pages/ArticleView.jsx`
  - `src/pages/ArchiveView.jsx`
  - `src/pages/TagsView.jsx`
  - `src/pages/AboutView.jsx`
- Verification scripts under project root or `scripts/` for viewport/interaction checks.
- Evidence screenshots/logs under `.sisyphus/evidence/`.

### Definition of Done (verifiable conditions with commands)
- `npm run build` completes successfully.
- `npm run dev -- --host 127.0.0.1 --strictPort` serves the app locally.
- Playwright verification confirms visible rendering and no page errors for Home, Article, Archive, Tags, About.
- At 375, 768, 1024, and 1440 widths, `document.documentElement.scrollWidth <= window.innerWidth + 1`.
- Keyboard navigation reaches nav, search, cards, filters, tags, archive rows, related items, and TOC buttons with visible focus styles.
- Reduced-motion mode disables non-essential reveal/hover animation timing.

### Must Have
- Maintain Chinese long-form readability.
- Preserve current React/Vite structure.
- Keep visual atmosphere restrained and low-saturation.
- Make focus/hover/active states legible.
- Make archive/tag pages feel distinct but still part of one system.

### Must NOT Have
- No deployment work.
- No CMS, MDX, or content model migration.
- No new animation framework or UI library.
- No scroll-synced TOC logic in this phase.
- No major routing/state architecture changes.
- No decorative effects that reduce readability or cause scroll jank.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + existing Node/Playwright scripts; no new test framework required unless executor chooses a minimal script.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Token/foundation task
Wave 2: Page/component refinement tasks
Wave 3: Responsive, interaction, and QA hardening tasks

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2-6.
- Tasks 2, 3, 4 can run in parallel after Task 1.
- Task 5 depends on Tasks 2-4.
- Task 6 depends on Tasks 1-5.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 1 task → visual-engineering
- Wave 2 → 3 tasks → visual-engineering in parallel
- Wave 3 → 2 tasks → visual-engineering + quick

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Establish Tokenized Visual Foundation

  **What to do**: In `src/styles.css`, introduce explicit token groups for spacing, surface depth, border/inset, typography, motion, and focus. Replace ad-hoc repeated values where safe. Keep existing palette but add named semantic tokens for archive surface, dream surface, petrified surface, focus ring, quiet glow, and line glow. Add base focus style helpers for `button`, `input`, and clickable cards.
  **Must NOT do**: Do not rewrite the whole stylesheet. Do not introduce CSS preprocessors or CSS modules. Do not change React state or routing.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Token and CSS-system refinement.
  - Skills: [] - No external skill required.
  - Omitted: [`frontend-ui-ux`] - Already loaded in parent session; executor can proceed without reloading unless desired.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: Tasks 2, 3, 4, 5, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/styles.css:1` - existing CSS custom properties.
  - Pattern: `src/styles.css:36` - current global background and typography.
  - Pattern: `src/styles.css:166` - current reveal animation and motion pattern.
  - Pattern: `src/styles.css:208` - current shared button styling selector.
  - External: Tailwind Typography style rhythm reference from research: `https://github.com/tailwindlabs/tailwindcss-typography/blob/543de4274390e90c4aab5d216729b46a3ba5541b/src/styles.js#L235-L321`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` succeeds.
  - [ ] A grep/search of `src/styles.css` shows semantic token names for spacing, focus, motion, and surfaces.
  - [ ] Playwright script confirms at least one focused nav button and one focused archive card have non-transparent outline or box-shadow.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Focus token visibility
    Tool: Playwright
    Steps: Open http://127.0.0.1:5173/, press Tab until the first nav button and first archive card receive focus; inspect computed outline/box-shadow.
    Expected: Each focused control has visible non-transparent focus styling distinct from hover-only state.
    Evidence: .sisyphus/evidence/task-1-token-focus.json

  Scenario: Token pass does not break rendering
    Tool: Bash
    Steps: Run `npm run build`.
    Expected: Build exits 0.
    Evidence: .sisyphus/evidence/task-1-build.log
  ```

  **Commit**: NO | Message: `style(theme): establish archive visual tokens` | Files: [`src/styles.css`]

- [x] 2. Refine Home Hierarchy and Archive Card System

  **What to do**: Update `src/pages/HomeView.jsx`, `src/components/ArchiveCard.jsx`, and `src/styles.css` so the homepage has a clearer visual path: hero strongest, filter bar secondary, archive list primary content, side panel supporting. Refine `.archive-card`, `.card-hit`, `.meta-grid`, `.tag-list`, `.filter-bar`, `.side-panel`, and `.section-title`. Add subtle card edge detail or circuit-branch accents without cluttering text.
  **Must NOT do**: Do not add new pages or new data fields unless needed for visual labels. Do not make cards look like generic SaaS cards.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Home and card visual polish.
  - Skills: [] - No extra skill required.
  - Omitted: [`playwright`] - Use direct Playwright scripts or existing local scripts, not browser skill dependency.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 5 | Blocked By: Task 1

  **References**:
  - Pattern: `src/pages/HomeView.jsx:5` - HeroPanel structure.
  - Pattern: `src/pages/HomeView.jsx:24` - FilterBar structure.
  - Pattern: `src/pages/HomeView.jsx:90` - HomeView composition.
  - Pattern: `src/components/ArchiveCard.jsx:3` - archive card markup.
  - Pattern: `src/styles.css:151` - `.hero-panel` current style.
  - Pattern: `src/styles.css:183` - `.filter-bar` current style.
  - Pattern: `src/styles.css:302` - `.archive-card` current style.
  - Pattern: `src/styles.css:400` - `.side-panel` current style.

  **Acceptance Criteria**:
  - [ ] Home page renders at 1440 and 375 widths with no horizontal overflow.
  - [ ] Search/filter controls remain visible and keyboard focusable.
  - [ ] First archive card has a distinct hover/focus state and readable metadata.

  **QA Scenarios**:
  ```
  Scenario: Home hierarchy happy path
    Tool: Playwright
    Steps: Open home at 1440px; capture full-page screenshot; inspect that hero, filter bar, archive list, and side panel are all visible.
    Expected: No page errors; archive list is visually primary after hero; no overlap/clipping.
    Evidence: .sisyphus/evidence/task-2-home-1440.png

  Scenario: Home narrow viewport edge case
    Tool: Playwright
    Steps: Open home at 375px; assert `document.documentElement.scrollWidth <= window.innerWidth + 1`; capture screenshot.
    Expected: Header, filters, archive cards, and side panel stack cleanly with no horizontal scrolling.
    Evidence: .sisyphus/evidence/task-2-home-375.png
  ```

  **Commit**: NO | Message: `style(home): refine archive index hierarchy` | Files: [`src/pages/HomeView.jsx`, `src/components/ArchiveCard.jsx`, `src/styles.css`]

- [x] 3. Refine Article Reading Experience and TOC Clarity

  **What to do**: Update `src/pages/ArticleView.jsx` and article-related CSS so article pages feel editorial and readable. Improve `.article-layout`, `.article-hero`, `.prose`, `.prose h2`, paragraph rhythm, blockquote, note/memo blocks, code, table, figure, related panel, `.rail`, and `.rail-right li.active button`. Make TOC active state visually meaningful, but keep it click-based only.
  **Must NOT do**: Do not implement scroll-synced TOC. Do not add markdown/MDX. Do not reduce Chinese body readability for atmosphere.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Article typography and reading-flow refinement.
  - Skills: [] - No extra skill required.
  - Omitted: [`librarian`] - External typography research already available.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 5 | Blocked By: Task 1

  **References**:
  - Pattern: `src/pages/ArticleView.jsx:4` - current article page component.
  - Pattern: `src/styles.css:428` - `.article-layout` current layout.
  - Pattern: `src/styles.css:483` - `.prose` current max-width.
  - Pattern: `src/styles.css:496` - `.article-hero` current style.
  - Pattern: `src/styles.css:533` - blockquote style.
  - Pattern: `src/styles.css:542` - note/memo block styles.
  - External: Chinese layout reference from research: `https://github.com/w3c/clreq/blob/d5bbe6fa6ab87bea3a07db76c395c89d31da441b/README.md#L22-L29`.

  **Acceptance Criteria**:
  - [ ] Article page has no horizontal overflow at 375/768/1024/1440.
  - [ ] Body text computed line-height is at least 1.75 times font size.
  - [ ] TOC active item is visually distinct by at least two properties among color, border, background, marker, or inset.
  - [ ] Code blocks scroll horizontally inside their container, not the page.

  **QA Scenarios**:
  ```
  Scenario: Article reading happy path
    Tool: Playwright
    Steps: Open app, click first archive card, capture article page at 1440px; inspect paragraph line-height and article width.
    Expected: Article content is visible, centered in reading column, with clear hero/meta/body hierarchy.
    Evidence: .sisyphus/evidence/task-3-article-1440.png

  Scenario: Long content and narrow viewport edge case
    Tool: Playwright
    Steps: Open article at 375px; assert no horizontal overflow; inspect `pre` scrollWidth can exceed clientWidth without page overflow.
    Expected: Body text, TOC/rails, table, image, and code do not break page layout.
    Evidence: .sisyphus/evidence/task-3-article-375.json
  ```

  **Commit**: NO | Message: `style(article): improve reading rhythm and toc clarity` | Files: [`src/pages/ArticleView.jsx`, `src/styles.css`]

- [x] 4. Distinguish Archive, Tags, and About Pages Within One System

  **What to do**: Refine `src/pages/ArchiveView.jsx`, `src/pages/TagsView.jsx`, `src/pages/AboutView.jsx`, and related CSS so each secondary page has a distinct archival role. Archive should feel like chronological cabinet rows; Tags should feel like a taxonomy/terminology index; About should feel like a manifesto/system card. Update `.page-panel`, `.archive-group`, `.archive-group button`, `.tag-cloud`, `.tag-cloud button`, `.about-panel dl`, and `.about-panel dl div`.
  **Must NOT do**: Do not add new navigation or routes. Do not create unrelated content sections.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Secondary-page visual differentiation.
  - Skills: [] - No extra skill required.
  - Omitted: [`deep`] - Scope is bounded UI polish.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: Task 5 | Blocked By: Task 1

  **References**:
  - Pattern: `src/pages/ArchiveView.jsx:3` - archive grouping structure.
  - Pattern: `src/pages/TagsView.jsx:3` - tag index structure.
  - Pattern: `src/pages/AboutView.jsx:1` - about/system manifesto structure.
  - Pattern: `src/styles.css:618` - `.page-panel` style.
  - Pattern: `src/styles.css:636` - `.archive-group` style.
  - Pattern: `src/styles.css:682` - `.tag-cloud` style.
  - Pattern: `src/styles.css:700` - `.about-panel dl` style.

  **Acceptance Criteria**:
  - [ ] Archive page groups entries by date with clear row hierarchy.
  - [ ] Tags page shows tag labels and counts with distinct typography.
  - [ ] About page shows three system pillars without crowding at 375px.
  - [ ] All secondary page buttons have visible hover/focus states.

  **QA Scenarios**:
  ```
  Scenario: Secondary pages happy path
    Tool: Playwright
    Steps: Navigate to Archive, Tags, About via header; capture screenshots at 1440px.
    Expected: Each page is visibly distinct while sharing common surface/border/token language.
    Evidence: .sisyphus/evidence/task-4-secondary-1440.png

  Scenario: Secondary mobile edge case
    Tool: Playwright
    Steps: At 375px, navigate Archive, Tags, About; assert no horizontal overflow and all buttons visible.
    Expected: Rows and tag cards stack cleanly; no text clipping.
    Evidence: .sisyphus/evidence/task-4-secondary-375.json
  ```

  **Commit**: NO | Message: `style(pages): distinguish archive tags and about views` | Files: [`src/pages/ArchiveView.jsx`, `src/pages/TagsView.jsx`, `src/pages/AboutView.jsx`, `src/styles.css`]

- [x] 5. Responsive and Accessibility Hardening Pass

  **What to do**: Add/adjust responsive rules in `src/styles.css` for 375, 768, 1024, and 1440 widths. Improve header stacking, nav wrapping, search placement, article rail placement, metadata wrapping, archive rows, tag cloud, and about cards. Add strong `:focus-visible` rules for all clickable controls and inputs. Ensure `prefers-reduced-motion` still works.
  **Must NOT do**: Do not remove visual identity on mobile. Do not hide critical navigation or filters. Do not rely on manual visual judgment only.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Responsive and accessibility styling.
  - Skills: [] - No extra skill required.
  - Omitted: [`playwright`] - Use direct scripts; skill not required.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Task 6 | Blocked By: Tasks 2, 3, 4

  **References**:
  - Pattern: `src/styles.css:751` - current 1180px media query.
  - Pattern: `src/styles.css:778` - current 780px media query.
  - Pattern: `src/styles.css:811` - current reduced-motion media query.
  - Pattern: `debug-page.mjs` - current Playwright rendering diagnostic script.
  - Pattern: `debug-interactions.mjs` - current interaction diagnostic script.

  **Acceptance Criteria**:
  - [ ] No horizontal overflow at widths 375, 768, 1024, 1440.
  - [ ] Keyboard-only navigation reaches all interactive controls with visible focus.
  - [ ] Reduced-motion emulation reduces animation duration to effectively none.
  - [ ] Mobile header shows brand, nav, and search without overlap.

  **QA Scenarios**:
  ```
  Scenario: Responsive viewport sweep
    Tool: Playwright
    Steps: For widths 375, 768, 1024, 1440, open Home and Article; assert no horizontal overflow and capture screenshots.
    Expected: All layouts render without clipping or page-level horizontal scroll.
    Evidence: .sisyphus/evidence/task-5-responsive-sweep.json

  Scenario: Keyboard and reduced-motion edge case
    Tool: Playwright
    Steps: Emulate reduced motion; tab through header/search/cards/filter/tags/TOC; inspect focus styles and animation duration.
    Expected: Focus is visible on every control; reduced motion removes non-essential animation timing.
    Evidence: .sisyphus/evidence/task-5-a11y-motion.json
  ```

  **Commit**: NO | Message: `style(responsive): harden mobile and focus states` | Files: [`src/styles.css`, `debug-page.mjs`, `debug-interactions.mjs`]

- [x] 6. Add Visual Verification Scripts and Evidence Capture

  **What to do**: Extend or create Playwright scripts to automate screenshots and assertions for Home, Article, Archive, Tags, and About. Store results under `.sisyphus/evidence/`. Update `package.json` only if adding a convenient script such as `"verify:visual": "node scripts/verify-visual.mjs"`. Keep scripts lightweight and dependency-free beyond current Playwright.
  **Must NOT do**: Do not add Jest/Vitest unless necessary. Do not require manual screenshot inspection to pass.

  **Recommended Agent Profile**:
  - Category: `quick` - Script/test wiring and build verification.
  - Skills: [] - No extra skill required.
  - Omitted: [`visual-engineering`] - This is verification wiring, not design work.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final Verification | Blocked By: Task 5

  **References**:
  - Pattern: `debug-page.mjs` - current page-render diagnostic.
  - Pattern: `debug-interactions.mjs` - current interaction diagnostic.
  - Pattern: `package.json:6` - current scripts section.
  - Pattern: `.sisyphus/evidence/` - required evidence output directory to create if absent.

  **Acceptance Criteria**:
  - [ ] `node debug-page.mjs` reports `pageErrors: []` and `hasShell: true`.
  - [ ] `node debug-interactions.mjs` reports all boolean checks true.
  - [ ] New visual verification script, if added, exits 0 and writes evidence files.
  - [ ] `npm run build` exits 0.

  **QA Scenarios**:
  ```
  Scenario: Visual verification happy path
    Tool: Bash
    Steps: Run `node debug-page.mjs`, `node debug-interactions.mjs`, optional `npm run verify:visual`, then `npm run build`.
    Expected: All commands exit 0; evidence files are created under `.sisyphus/evidence/`.
    Evidence: .sisyphus/evidence/task-6-verification.log

  Scenario: Evidence completeness edge case
    Tool: Bash
    Steps: List `.sisyphus/evidence/` after verification.
    Expected: Evidence exists for home/article/secondary pages and responsive/focus assertions.
    Evidence: .sisyphus/evidence/task-6-evidence-list.txt
  ```

  **Commit**: NO | Message: `test(visual): add local verification evidence scripts` | Files: [`debug-page.mjs`, `debug-interactions.mjs`, `scripts/verify-visual.mjs`, `package.json`, `.sisyphus/evidence/*`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep
## Commit Strategy
- Do not commit unless user explicitly asks.
- Recommended single commit after user approval: `style(blog): refine nocturne archive visual system`.
- Keep implementation changes grouped by task in working tree for easier review.

## Success Criteria
- The blog remains locally runnable and buildable.
- Visual hierarchy is stronger without sacrificing Chinese long-form readability.
- All interactive controls have clear hover/focus/active states.
- Home, Article, Archive, Tags, About each feel distinct while sharing one coherent archive system.
- Automated evidence demonstrates viewport, interaction, focus, reduced-motion, and build success.
