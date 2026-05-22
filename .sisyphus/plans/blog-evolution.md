# Blog Evolution: Section-First Markdown Archive

## TL;DR
> **Summary**: Convert the blog from a hardcoded state-switched archive into a URL-routed, section-first personal archive with Markdown-authored posts, section background art, a three-panel greeting gate, and a subtle NetEase-style music easter egg. Comments are explicitly deferred.
> **Deliverables**:
> - URL routing/deep links for home, posts, archive, sections, about, and fallback.
> - Six primary sections: 技术/瞎折腾, 随笔, 日记, 喜欢的文章, 游记, 友链.
> - Markdown content pipeline with validated frontmatter and no routine business-code edits for new posts.
> - Section pages with user-provided background assets from `backgrounds/`.
> - Greeting/onboarding flow shown on every site entry before home.
> - Collapsed music easter egg with no autoplay and safe fallback.
> - Extended Playwright visual verification evidence.
> **Effort**: Large
> **Parallel**: YES - 5 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 7 → Task 9

## Context
### Original Request
- User wants current “tag” ideas to behave more like independent sections: `技术/瞎折腾`, `随笔`, `日记`, `喜欢的文章`, `游记`, `友链`.
- Each section has a short user-written intro/snippet and one background image.
- Entry experience should show a greeting, self-introduction, personal snippets, and personal tech stack through mouse wheel switching, then enter home.
- NetEase Cloud Music is under consideration but may feel tacky.
- Comments are possible, but user does not want to build a login system.
- User is unsure whether frequent blog updates require source-code edits.

### Interview Summary
- Product IA: section-first, not traditional tag-first.
- Route slugs accepted:
  - `/sections/tech`
  - `/sections/essay`
  - `/sections/diary`
  - `/sections/reading`
  - `/sections/travel`
  - `/sections/links`
- Greeting/onboarding: show every site entry before home; no first-visit persistence suppression.
- Content workflow: Markdown files in repo; routine post updates should edit Markdown/frontmatter, not business logic.
- Comments: defer from v1.
- Music: subtle/collapsed easter egg only, not a prominent widget.
- Test strategy: keep existing build + Playwright visual verification; do not add Vitest/React Testing Library in this plan.

### Metis Review (gaps addressed)
- Added route contract, fallback behavior, and direct-entry verification.
- Added frontmatter schema and validation rules.
- Added single source of truth for section metadata.
- Added migration policy from `src/data/posts.js` to Markdown.
- Added onboarding accessibility requirements beyond wheel-only controls.
- Added music guardrails: collapsed by default, no autoplay, failure-tolerant.
- Added explicit deferred scope for comments and CMS.

## Work Objectives
### Core Objective
Rebuild the blog information architecture around shareable URL-routed sections and Markdown content while preserving the existing visual identity and adding the new greeting/music experiences safely.

### Deliverables
- Routing foundation with direct URL support.
- Section metadata registry with six fixed sections and background assets.
- Markdown post loader/parser and migrated example content.
- Section landing/listing pages.
- Greeting gate with wheel, keyboard, touch/button controls.
- Collapsed music easter egg.
- Updated navigation/search/archive/article flows.
- Extended `npm run verify:visual` evidence.

### Definition of Done (verifiable conditions with commands)
- `npm run build` succeeds.
- `npm run verify:visual` succeeds and writes route/onboarding/section evidence under `.sisyphus/evidence/`.
- Direct browser entry to `/`, `/posts/petrified-corridor`, `/archive`, `/sections/tech`, `/sections/essay`, `/sections/diary`, `/sections/reading`, `/sections/travel`, `/sections/links`, `/about`, and an unknown route renders the expected app state without console page errors.
- New posts can be added as Markdown files under the chosen content directory without editing `src/App.jsx`, `src/pages/*`, or `src/components/*`.

### Must Have
- Keep Chinese UI copy and “失眠档案馆” visual tone.
- Use imported image URLs from the repo-root `backgrounds/` folder: `backgrounds/tech.png`, `backgrounds/essay.png`, `backgrounds/diary.png`, `backgrounds/reading.png`, `backgrounds/travel.jpg`, `backgrounds/links.png`, and `backgrounds/greeting.png`.
- Add stable `data-testid` selectors for every new route, onboarding panel, section page, and music easter egg control used by verification.
- Greeting must be usable without a mouse wheel: include keyboard and explicit button controls.
- Music must not autoplay.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Do NOT implement comments in v1.
- Do NOT add a login system.
- Do NOT add a CMS in v1.
- Do NOT add Vitest/React Testing Library unless explicitly requested later.
- Do NOT replace the whole visual design language; extend the existing archive/institution aesthetic.
- Do NOT depend on user manual visual confirmation for acceptance.
- Do NOT leave URL navigation state-only; direct entry and refresh must work.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after using existing custom Playwright verification (`npm run verify:visual`) + `npm run build`.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}` plus consolidated `.sisyphus/evidence/visual-verification.json` and `.sisyphus/evidence/visual-verification-summary.md`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Foundation contracts and routing/content infrastructure — Tasks 1-3
Wave 2: Section and Markdown migration — Tasks 4-6
Wave 3: Experience features — Tasks 7-8
Wave 4: Existing page integration and visual polish — Tasks 9-10
Wave 5: Verification hardening — Tasks 11-12

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2, 4, 5, 6, 9, 11.
- Task 2 blocks Tasks 4, 5, 6, 9, 11.
- Task 3 blocks Tasks 4, 5, 6, 9, 11.
- Task 4 blocks Tasks 5, 6, 9, 11.
- Task 5 blocks Tasks 6, 9, 11.
- Task 6 blocks Tasks 9, 11.
- Task 7 blocks Tasks 9, 11.
- Task 8 blocks Tasks 10, 11.
- Task 9 blocks Task 11.
- Task 10 blocks Task 11.
- Task 11 blocks Task 12.
- Task 12 blocks Final Verification Wave.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → quick, unspecified-high
- Wave 2 → 3 tasks → unspecified-high, writing, visual-engineering
- Wave 3 → 2 tasks → visual-engineering
- Wave 4 → 2 tasks → visual-engineering, unspecified-high
- Wave 5 → 2 tasks → quick, unspecified-high

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add route foundation and URL contract

  **What to do**: Replace the `activeView` pseudo-router in `src/App.jsx` with URL-driven navigation using a small internal browser-history route parser. Do not add `react-router-dom` or any routing dependency in this plan. Implement exact route table: `/` home, `/posts/:slug`, `/archive`, `/sections/:sectionSlug`, `/about`, and fallback `*` not-found. Preserve search/filter state where it still belongs on home. Update navigation handlers to navigate by URL instead of `setActiveView` strings.
  **Must NOT do**: Do not implement comments, CMS, deployment, or unrelated visual redesign. Do not leave post/section selection dependent on previous in-memory navigation state.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: routing changes affect app architecture and all pages.
  - Skills: [] - No specialized skill required.
  - Omitted: [`frontend-ui-ux`] - This is route infrastructure, not visual design.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 4, 5, 6, 9, 11] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/App.jsx:10-63` - current state-based routing to replace.
  - Pattern: `src/components/SiteHeader.jsx:3-31` - current nav view IDs and buttons to convert to URL navigation.
  - API/Type: `src/data/posts.js:1-59` - current posts include `slug` used for `/posts/:slug` lookup.
  - Test: `scripts/visual-core.mjs:149-178` - current `openView` clicks nav buttons; must become URL-capable.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits 0.
  - [ ] A Playwright script can direct-enter `/`, `/posts/petrified-corridor`, `/archive`, `/sections/tech`, `/about`, and `/missing-route`, with no page errors.
  - [ ] Unknown route renders a deterministic not-found view with `data-testid="not-found-view"` and a link/button back to `/`.
  - [ ] Browser refresh on `/posts/petrified-corridor` keeps the article visible without relying on prior `selectedPost` state.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Direct URL routing works
    Tool: Bash
    Steps: Run npm run build, then run a Playwright node script against local Vite preview/dev server that visits /, /posts/petrified-corridor, /archive, /sections/tech, /about.
    Expected: Each route renders its expected heading/test id and records zero pageerror events.
    Evidence: .sisyphus/evidence/task-1-route-foundation.json

  Scenario: Unknown route fallback works
    Tool: Bash
    Steps: Visit /definitely-not-real with Playwright and query [data-testid="not-found-view"].
    Expected: Not-found view is visible and its home control navigates to /.
    Evidence: .sisyphus/evidence/task-1-route-foundation-error.json
  ```

  **Commit**: NO | Message: `feat(routing): add url route foundation` | Files: [`src/App.jsx`, `src/components/SiteHeader.jsx`, `scripts/visual-core.mjs`]

- [x] 2. Create section metadata registry

  **What to do**: Add a single source of truth for section metadata, preferably `src/data/sections.js`. Define six sections with exact slugs and labels: `tech` = `技术/瞎折腾`, `essay` = `随笔`, `diary` = `日记`, `reading` = `喜欢的文章`, `travel` = `游记`, `links` = `友链`. Include fields: `slug`, `label`, `shortLabel`, `intro`, `background`, `order`, `theme`, `navKicker`. Import image URLs in `sections.js` from repo-root assets using relative imports such as `../../backgrounds/tech.png`; assign the imported URL to `background`. Do not use literal `/backgrounds/...` public paths unless the files are intentionally moved into `public/backgrounds/` by a later explicit task. For `intro`, use clear placeholders prefixed with `TODO:` so the user can later replace prose without code structure changes.
  **Must NOT do**: Do not invent final personal prose. Do not scatter section definitions across page components.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded data contract creation.
  - Skills: [] - No specialized skill required.
  - Omitted: [`writing`] - Final prose is user-owned; only placeholders are needed.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [4, 5, 6, 9, 11] | Blocked By: [1]

  **References**:
  - Pattern: `src/data/posts.js:1-68` - existing data module style.
  - Asset: `backgrounds/tech.png` - section background source.
  - Asset: `backgrounds/essay.png` - section background source.
  - Asset: `backgrounds/diary.png` - section background source.
  - Asset: `backgrounds/reading.png` - section background source.
  - Asset: `backgrounds/travel.jpg` - section background source.
  - Asset: `backgrounds/links.png` - section background source.

  **Acceptance Criteria**:
  - [ ] `src/data/sections.js` exports ordered section metadata and lookup helpers by slug.
  - [ ] Each accepted slug maps to exactly one section.
  - [ ] Missing slug lookup returns `null` or `undefined` consistently and is handled by callers.
  - [ ] `npm run build` exits 0 after importing the registry in at least one route/page.

  **QA Scenarios**:
  ```
  Scenario: Section registry is complete
    Tool: Bash
    Steps: Run a Node import check that loads src/data/sections.js and verifies the six slugs, labels, order, and background paths.
    Expected: All six sections exist exactly once, are sorted by order, and each background value resolves to a non-empty Vite asset URL/string.
    Evidence: .sisyphus/evidence/task-2-section-registry.json

  Scenario: Invalid section slug is safe
    Tool: Bash
    Steps: Import the lookup helper and query missing slug "unknown".
    Expected: Helper returns null/undefined and does not throw.
    Evidence: .sisyphus/evidence/task-2-section-registry-error.json
  ```

  **Commit**: NO | Message: `feat(sections): add section metadata registry` | Files: [`src/data/sections.js`]

- [x] 3. Add Markdown content pipeline and frontmatter validation

  **What to do**: Introduce Markdown files as the post source of truth under a content directory such as `src/content/posts/`. Use Vite-supported `import.meta.glob` to load Markdown as raw text, or another no-backend build-time method compatible with current Vite setup. Add a parser module, preferably `src/data/content.js`, that extracts frontmatter and body. Required frontmatter fields: `id`, `slug`, `title`, `excerpt`, `date`, `section`, `status`, `reading`. Optional fields: `tags`, `category`, `sections`. Validation rules: required fields must be present; `slug` unique; `section` must be one of `tech|essay|diary|reading|travel|links`; `date` must sort lexicographically as ISO `YYYY-MM-DD`. Invalid Markdown must fail build/import loudly with an actionable error, not silently render bad content.
  **Must NOT do**: Do not add a CMS or backend. Do not keep `src/data/posts.js` as the long-term editable post source after migration.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: content model migration affects all article/list/search views.
  - Skills: [] - No specialized skill required.
  - Omitted: [`librarian`] - No external library research required unless the implementer proposes adding a parser dependency.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [4, 5, 6, 9, 11] | Blocked By: [1, 2]

  **References**:
  - Pattern: `src/data/posts.js:1-59` - current schema to preserve at normalized output level.
  - API/Type: `src/pages/ArticleView.jsx:4-10` - currently expects `post.sections` and selected post object.
  - API/Type: `src/pages/HomeView.jsx:23-65` - currently derives tags for filters.
  - API/Type: `src/pages/TagsView.jsx:1-34` - currently uses `getTagCounts()`.
  - External: `https://vite.dev/guide/features.html#glob-import` - Vite glob import pattern for content loading.

  **Acceptance Criteria**:
  - [ ] At least four existing sample posts are migrated to Markdown files under `src/content/posts/`.
  - [ ] Normalized `posts` export preserves fields required by existing pages: `id`, `slug`, `title`, `excerpt`, `date`, `tags`, `status`, `reading`, `category`, `year`, `month`, `sections`, plus `section` and parsed `content`.
  - [ ] Adding a new valid Markdown file changes the `posts` list without editing page/component code.
  - [ ] Build fails with a clear validation message for invalid frontmatter in a controlled verification fixture or parser test path.

  **QA Scenarios**:
  ```
  Scenario: Markdown posts load and normalize
    Tool: Bash
    Steps: Run npm run build, then run a Node import check for the normalized posts module.
    Expected: At least four posts load, all have valid section slugs, and petrified-corridor exists.
    Evidence: .sisyphus/evidence/task-3-markdown-content.json

  Scenario: Invalid frontmatter is rejected
    Tool: Bash
    Steps: Run the parser validation against a temporary bad markdown string missing section/date.
    Expected: Validation throws an actionable error listing missing fields; no app files are permanently changed.
    Evidence: .sisyphus/evidence/task-3-markdown-content-error.json
  ```

  **Commit**: NO | Message: `feat(content): load posts from markdown` | Files: [`src/content/posts/*.md`, `src/data/content.js`, `src/data/posts.js`]

- [x] 4. Build section landing pages with background art

  **What to do**: Add a `SectionView` page component, preferably `src/pages/SectionView.jsx`, that renders the selected section title, intro placeholder, background art, section metadata, and a list of posts in that section. Sorting rule: published/draft/sealed all visible unless existing status filters are explicitly applied elsewhere; sort by `date` descending, tie-break by `slug` ascending. For empty sections, render a styled empty state with `data-testid="section-empty-state"` rather than hiding the page. Apply section background via CSS custom property or inline style in a controlled wrapper using the imported `section.background` URL; include fallback to imported `greeting.png` or existing gradient if the configured image fails.
  **Must NOT do**: Do not turn this into traditional tag filtering. Do not remove archive or tags pages in this task.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: page structure and background art must fit existing visual system.
  - Skills: [] - No specialized skill required.
  - Omitted: [`writing`] - Section intro text remains placeholder/user-owned.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [6, 9, 11] | Blocked By: [1, 2, 3]

  **References**:
  - Pattern: `src/pages/HomeView.jsx:92-118` - list rendering structure using `ArchiveCard`.
  - Pattern: `src/pages/TagsView.jsx:7-32` - page panel structure and tag destination behavior to supersede visually.
  - Pattern: `src/components/ArchiveCard.jsx` - reuse existing card rendering for section post lists.
  - CSS: `src/styles.css` - central style file for page panel variants and backgrounds.
  - Data: `src/data/sections.js` - section metadata source from Task 2.

  **Acceptance Criteria**:
  - [ ] Direct entry to each `/sections/{slug}` renders a section page with `data-testid="section-view-{slug}"`.
  - [ ] Each page displays the correct Chinese label and placeholder intro.
  - [ ] Each page references the configured background asset path for that section.
  - [ ] Empty sections render a deterministic empty state.

  **QA Scenarios**:
  ```
  Scenario: All section pages render
    Tool: Bash
    Steps: Run Playwright against /sections/tech, /sections/essay, /sections/diary, /sections/reading, /sections/travel, /sections/links.
    Expected: Each route shows [data-testid="section-view-{slug}"] and the expected Chinese label.
    Evidence: .sisyphus/evidence/task-4-section-pages.json

  Scenario: Section with no posts is graceful
    Tool: Bash
    Steps: Visit a valid section that has no migrated posts, or temporarily use a test-only empty section fixture if all have posts.
    Expected: [data-testid="section-empty-state"] is visible and no runtime error occurs.
    Evidence: .sisyphus/evidence/task-4-section-pages-empty.json
  ```

  **Commit**: NO | Message: `feat(sections): add section landing pages` | Files: [`src/pages/SectionView.jsx`, `src/styles.css`, `src/App.jsx`]

- [x] 5. Migrate navigation from tag-first to section-first

  **What to do**: Update `SiteHeader`, home hero/side panel, and the old tags page behavior so primary navigation exposes section-first IA. Header should include home, sections or direct section entry, archive, about; keep search. The existing `/tags` concept should either be removed from primary navigation or converted into `/sections` index depending on implementation simplicity. If keeping a tag cloud for legacy tags, label it as secondary metadata, not primary navigation. Add stable selectors: `data-testid="nav-section-tech"` etc. Home side panel should list the six sections and link to their routes.
  **Must NOT do**: Do not delete tag metadata from posts; it may remain secondary. Do not add new user-facing section labels beyond the accepted six.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: navigation and home hierarchy must remain polished.
  - Skills: [] - No specialized skill required.
  - Omitted: [`quick`] - Cross-component UI changes are not trivial.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [9, 11] | Blocked By: [1, 2, 3, 4]

  **References**:
  - Pattern: `src/components/SiteHeader.jsx:3-31` - current nav buttons.
  - Pattern: `src/pages/HomeView.jsx:68-89` - current side panel hardcoded categories.
  - Pattern: `src/pages/TagsView.jsx:4-34` - current tag cloud behavior to demote or adapt.
  - Data: `src/data/sections.js` - accepted section list and ordering.

  **Acceptance Criteria**:
  - [ ] Header or section index provides route navigation to all six sections.
  - [ ] Home page side panel shows all six section labels and navigates to matching section routes.
  - [ ] Search input remains available and functional on header/home.
  - [ ] No primary nav item labeled `标签` remains unless it clearly points to a secondary metadata page outside the six-section IA.

  **QA Scenarios**:
  ```
  Scenario: Section navigation is reachable
    Tool: Bash
    Steps: Use Playwright to click each section nav/side-panel control from home.
    Expected: URL changes to the accepted /sections/{slug} route and matching section heading appears.
    Evidence: .sisyphus/evidence/task-5-section-navigation.json

  Scenario: Search survives IA change
    Tool: Bash
    Steps: From home, fill [data-testid="search-query"] with 冷光.
    Expected: The cold-light post remains visible in the filtered result list.
    Evidence: .sisyphus/evidence/task-5-section-navigation-search.json
  ```

  **Commit**: NO | Message: `feat(nav): make sections primary` | Files: [`src/components/SiteHeader.jsx`, `src/pages/HomeView.jsx`, `src/pages/TagsView.jsx`, `src/styles.css`]

- [x] 6. Render Markdown article content and section-aware article metadata

  **What to do**: Update `ArticleView` so article body renders parsed Markdown content instead of hardcoded demo paragraphs. Support at minimum: paragraphs, h2/h3 headings, blockquote, fenced code, unordered/ordered lists, links, images, and tables if parser supports them. Generate TOC from Markdown headings when `sections` frontmatter is absent; otherwise preserve `sections` frontmatter as TOC labels. Article metadata should show the canonical section label and route link. Related posts should prefer same section first, then newest posts.
  **Must NOT do**: Do not use unsafe `dangerouslySetInnerHTML` without sanitizing/escaping strategy. If implementing a minimal renderer, escape text and only emit controlled elements.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: content rendering touches safety, parsing, and article UX.
  - Skills: [] - No specialized skill required.
  - Omitted: [`visual-engineering`] - Existing article visual system should be reused rather than redesigned.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [9, 11] | Blocked By: [1, 2, 3, 4]

  **References**:
  - Pattern: `src/pages/ArticleView.jsx:27-115` - current hardcoded article body and visual classes.
  - Pattern: `src/pages/ArticleView.jsx:117-139` - TOC active-state pattern to preserve.
  - Data: `src/data/content.js` - normalized Markdown content from Task 3.
  - CSS: `src/styles.css` - existing `.prose`, blockquote, table, code, figure styles from prior visual refinement.

  **Acceptance Criteria**:
  - [ ] `/posts/petrified-corridor` renders content from its Markdown file, not hardcoded demo body.
  - [ ] Article page shows canonical section label and a link to `/sections/{section}`.
  - [ ] TOC renders from Markdown headings or `sections` frontmatter with stable `data-testid="toc-{n}"`.
  - [ ] Related posts prioritize same-section posts when available.

  **QA Scenarios**:
  ```
  Scenario: Markdown article renders
    Tool: Bash
    Steps: Visit /posts/petrified-corridor and query article heading, body paragraph text, and at least one rendered h2.
    Expected: Markdown-derived content is visible and no hardcoded demo-only paragraph remains as the main body.
    Evidence: .sisyphus/evidence/task-6-markdown-article.json

  Scenario: Unknown post slug is safe
    Tool: Bash
    Steps: Visit /posts/not-a-real-post.
    Expected: Not-found view or article-not-found state appears with no page errors.
    Evidence: .sisyphus/evidence/task-6-markdown-article-error.json
  ```

  **Commit**: NO | Message: `feat(article): render markdown posts` | Files: [`src/pages/ArticleView.jsx`, `src/data/content.js`, `src/styles.css`]

- [x] 7. Add every-entry greeting/onboarding flow

  **What to do**: Add a top-level greeting gate component, preferably `src/components/GreetingGate.jsx` or `src/pages/GreetingView.jsx`, shown on every initial app entry before home content. It has exactly three panels: self-introduction, personal snippets, tech stack. Use an imported URL from `backgrounds/greeting.png` as the background. Interaction contract: wheel down advances one panel with debounce; wheel up moves back one panel; `ArrowDown`/`PageDown` advance; `ArrowUp`/`PageUp` go back; visible Previous/Next/Enter buttons work with mouse/touch; final panel shows `Enter Home`. No localStorage/sessionStorage suppression in v1. After enter, navigate to `/` and reveal normal app shell. Add skip/enter control labelled clearly for accessibility.
  **Must NOT do**: Do not make wheel the only control. Do not autoplay music in the greeting. Do not hide focus outlines.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: high-impact visual/interaction feature with accessibility concerns.
  - Skills: [] - No specialized skill required.
  - Omitted: [`quick`] - Interaction state and accessibility are non-trivial.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [9, 11] | Blocked By: [1]

  **References**:
  - Pattern: `src/App.jsx:37-61` - top-level shell position where gate can wrap/precede main content.
  - Asset: `backgrounds/greeting.png` - greeting background.
  - CSS: `src/styles.css` - existing motion/focus/reduced-motion patterns to extend.
  - Test: `scripts/visual-core.mjs:180-234` - existing focus/reduced-motion verification to extend.

  **Acceptance Criteria**:
  - [ ] Fresh visit to `/` first shows greeting panel 1 with `data-testid="greeting-gate"` and `data-testid="greeting-panel-1"`.
  - [ ] Wheel/keyboard/button controls advance through panels 1 → 2 → 3 without skipping two panels per event.
  - [ ] Final `Enter Home` control hides greeting and shows home heading `档案索引`.
  - [ ] Reloading the site shows greeting again, by design.
  - [ ] Reduced-motion mode disables decorative panel transition animations.

  **QA Scenarios**:
  ```
  Scenario: Greeting wheel and keyboard flow works
    Tool: Bash
    Steps: Visit / in a new Playwright context, assert panel 1, wheel down once, assert panel 2, press ArrowDown, assert panel 3, click Enter Home.
    Expected: Home content appears and [data-testid="greeting-gate"] is no longer visible.
    Evidence: .sisyphus/evidence/task-7-greeting-flow.json

  Scenario: Greeting is accessible without wheel
    Tool: Bash
    Steps: Visit /, use Tab to focus Next, press Enter twice, then focus Enter Home and press Enter.
    Expected: All panels advance via keyboard and focus is visible; home appears.
    Evidence: .sisyphus/evidence/task-7-greeting-flow-keyboard.json
  ```

  **Commit**: NO | Message: `feat(greeting): add entry onboarding flow` | Files: [`src/App.jsx`, `src/components/GreetingGate.jsx`, `src/styles.css`, `scripts/visual-core.mjs`]

- [x] 8. Add collapsed music easter egg

  **What to do**: Add a small collapsed music easter egg component, preferably `src/components/MusicEasterEgg.jsx`, available after entering the main app shell. Default state is collapsed; label can be `夜间电台` or similarly subtle. No autoplay. First click expands a panel with either a placeholder slot for NetEase embed configuration or a non-playing embedded player if an existing public NetEase iframe URL is provided by config. Since user has not provided a track/playlist ID, implement the component with a placeholder message and documented config constant; do not invent a playlist. If external embed fails or is absent, display graceful unavailable copy and keep the page functional.
  **Must NOT do**: Do not autoplay audio. Do not load an external script globally. Do not make music visually dominant.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: subtle UI component with failure states.
  - Skills: [] - No specialized skill required.
  - Omitted: [`librarian`] - No further external research needed unless a real NetEase embed URL is supplied.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [10, 11] | Blocked By: [1]

  **References**:
  - Pattern: `src/components/SiteHeader.jsx:13-47` - header/shell component style and test IDs.
  - CSS: `src/styles.css` - button, panel, focus, reduced-motion tokens.
  - Decision: Music is `彩蛋式`, not prominent.

  **Acceptance Criteria**:
  - [ ] Component renders collapsed with `data-testid="music-easter-egg-toggle"` after greeting is dismissed.
  - [ ] Clicking toggle expands `data-testid="music-easter-egg-panel"`.
  - [ ] No `audio`, `iframe`, or external player autoplays on initial page load.
  - [ ] Missing NetEase config displays a graceful placeholder, not an error.

  **QA Scenarios**:
  ```
  Scenario: Music easter egg expands manually
    Tool: Bash
    Steps: Enter home, click [data-testid="music-easter-egg-toggle"].
    Expected: [data-testid="music-easter-egg-panel"] appears and page has no pageerror events.
    Evidence: .sisyphus/evidence/task-8-music-easter-egg.json

  Scenario: Music does not autoplay
    Tool: Bash
    Steps: Enter home and inspect audio/iframe elements before clicking the music toggle.
    Expected: No playing media is present; any player iframe is absent or lazy-rendered until expansion.
    Evidence: .sisyphus/evidence/task-8-music-easter-egg-no-autoplay.json
  ```

  **Commit**: NO | Message: `feat(music): add collapsed easter egg` | Files: [`src/components/MusicEasterEgg.jsx`, `src/App.jsx`, `src/styles.css`]

- [x] 9. Integrate archive/home/about flows with routed Markdown sections

  **What to do**: Update HomeView, ArchiveView, AboutView, ArchiveCard, and any old callback props to use routed links/navigation instead of `onOpenPost`/`onViewChange` where appropriate. Keep archive grouping by year/month. Home should show posts from Markdown pipeline and section links. Archive cards should navigate to `/posts/{slug}`. About can link to sections and mention the archive concept if already present, but avoid large prose rewrites. Ensure `data-testid` values remain stable or are updated in verification scripts.
  **Must NOT do**: Do not remove existing archive and about pages. Do not convert every tag into a primary section beyond the six accepted sections.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: integration across multiple pages and old props.
  - Skills: [] - No specialized skill required.
  - Omitted: [`writing`] - Minimal copy changes only.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [11] | Blocked By: [1, 3, 4, 5, 6, 7]

  **References**:
  - Pattern: `src/pages/HomeView.jsx:92-118` - current home props and card opening.
  - Pattern: `src/pages/ArchiveView.jsx` - archive grouping to preserve.
  - Pattern: `src/components/ArchiveCard.jsx` - current card click behavior to route-link.
  - Pattern: `src/pages/AboutView.jsx` - static about page to preserve.
  - Test: `scripts/visual-core.mjs:315-331` - interaction flow to update for routed links.

  **Acceptance Criteria**:
  - [ ] Home post cards navigate to `/posts/{slug}` and render article pages.
  - [ ] Archive post cards navigate to `/posts/{slug}` and render article pages.
  - [ ] Home section links navigate to `/sections/{slug}`.
  - [ ] About and archive direct routes render after refresh.
  - [ ] Existing search behavior still filters by title, excerpt, id, section label, and tags.

  **QA Scenarios**:
  ```
  Scenario: Routed card navigation works
    Tool: Bash
    Steps: Enter home, click the card for AR-2026-041.
    Expected: URL becomes /posts/petrified-corridor and article heading is visible.
    Evidence: .sisyphus/evidence/task-9-routed-integration.json

  Scenario: Archive direct route and card click work
    Tool: Bash
    Steps: Visit /archive directly, click the first archive card.
    Expected: Article route loads with no page errors.
    Evidence: .sisyphus/evidence/task-9-routed-integration-archive.json
  ```

  **Commit**: NO | Message: `refactor(app): integrate routed markdown flows` | Files: [`src/pages/HomeView.jsx`, `src/pages/ArchiveView.jsx`, `src/pages/AboutView.jsx`, `src/components/ArchiveCard.jsx`, `src/App.jsx`]

- [x] 10. Apply responsive and accessibility polish for new section/greeting/music UI

  **What to do**: Extend `src/styles.css` for section pages, greeting panels, and music easter egg using existing tokenized visual foundation. Validate at widths 375, 768, 1024, 1440. Ensure no horizontal overflow. Ensure focus-visible indicators exist for section links, greeting controls, and music controls. Respect `prefers-reduced-motion: reduce` by disabling onboarding transitions and background motion. Ensure background images do not make text unreadable; add overlays where necessary.
  **Must NOT do**: Do not replace the established archive aesthetic. Do not add excessive animation or autoplay behavior.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: responsive UI/accessibility hardening.
  - Skills: [] - No specialized skill required.
  - Omitted: [`quick`] - Cross-viewport polish requires careful QA.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [11] | Blocked By: [4, 7, 8]

  **References**:
  - CSS: `src/styles.css` - central styles and existing reduced-motion/focus patterns.
  - Test: `scripts/visual-core.mjs:180-255` - focus, reduced-motion, and overflow sweep patterns.
  - Asset: `backgrounds/*.png`, `backgrounds/travel.jpg` - real backgrounds to test with overlay contrast.

  **Acceptance Criteria**:
  - [ ] No horizontal overflow at 375, 768, 1024, or 1440 px for home, article, archive, all six sections, about, and greeting.
  - [ ] Focus-visible state is programmatically detectable for greeting next/enter, section card/link, and music toggle.
  - [ ] Reduced-motion mode sets relevant decorative animations/transitions to `0s` or `none`.
  - [ ] Text over every section background remains readable via overlay/surface treatment.

  **QA Scenarios**:
  ```
  Scenario: New views have no responsive overflow
    Tool: Bash
    Steps: Run Playwright viewport sweep for 375, 768, 1024, 1440 across greeting, home, all section routes, article, archive, about.
    Expected: document/body scrollWidth <= clientWidth for every route and width.
    Evidence: .sisyphus/evidence/task-10-responsive-polish.json

  Scenario: Focus and reduced motion are preserved
    Tool: Bash
    Steps: Emulate reduced motion, tab through greeting controls, section links, and music toggle.
    Expected: Focus-visible is true with visible outline/box-shadow; transition/animation durations are disabled under reduced motion.
    Evidence: .sisyphus/evidence/task-10-accessibility-polish.json
  ```

  **Commit**: NO | Message: `style(app): polish section greeting responsive states` | Files: [`src/styles.css`]

- [x] 11. Extend visual verification for routing, sections, greeting, Markdown, and music

  **What to do**: Update `scripts/visual-core.mjs` and `scripts/verify-visual.mjs` so `npm run verify:visual` validates the new architecture. Preserve existing evidence outputs, but expand them. Add route checks for `/`, `/posts/petrified-corridor`, `/archive`, `/sections/tech`, `/sections/essay`, `/sections/diary`, `/sections/reading`, `/sections/travel`, `/sections/links`, `/about`, and unknown route. Add onboarding checks that dismiss greeting before normal route assertions where needed. Add screenshot evidence for greeting and each section at 1440 width. Add direct-entry checks using fresh browser contexts where necessary. Add assertions for no autoplay music and missing-config graceful state.
  **Must NOT do**: Do not make verification depend on manual browser inspection. Do not remove existing build execution from verification.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded script extension using existing Playwright helpers.
  - Skills: [] - No specialized skill required.
  - Omitted: [`playwright`] - Built-in skill not required; existing script pattern is enough.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: [12] | Blocked By: [1, 4, 6, 7, 8, 9, 10]

  **References**:
  - Test: `scripts/visual-core.mjs:1-394` - existing visual verification framework.
  - Test: `scripts/verify-visual.mjs` - existing command entrypoint.
  - Package: `package.json:6-11` - existing `verify:visual` script.
  - Evidence: `.sisyphus/evidence/visual-verification-summary.md` - summary format to preserve/extend.

  **Acceptance Criteria**:
  - [ ] `npm run verify:visual` writes `visual-verification.json` with route, onboarding, section, markdown, music, overflow, focus, reduced-motion, and build sections.
  - [ ] `visual-verification-summary.md` lists all checked routes and generated screenshots.
  - [ ] Screenshot evidence exists for greeting and each section at 1440 width.
  - [ ] Verification fails non-zero if any direct route, onboarding step, section background, or build check fails.

  **QA Scenarios**:
  ```
  Scenario: Full visual verification passes
    Tool: Bash
    Steps: Run npm run verify:visual.
    Expected: Command exits 0 and evidence JSON status is ok.
    Evidence: .sisyphus/evidence/task-11-visual-verification.json

  Scenario: Unknown route and missing optional music config are verified
    Tool: Bash
    Steps: Inspect visual-verification.json after npm run verify:visual.
    Expected: JSON includes unknown route fallback passed and music missing-config fallback passed.
    Evidence: .sisyphus/evidence/task-11-visual-verification-edge.json
  ```

  **Commit**: NO | Message: `test(visual): verify routed section archive` | Files: [`scripts/visual-core.mjs`, `scripts/verify-visual.mjs`, `package.json`]

- [x] 12. Document content authoring and deferred decisions in repo-local implementation notes

  **What to do**: Add concise in-repo content authoring documentation only if the project already has an appropriate docs/readme file; otherwise add comments near the content parser/schema exports, not a new top-level docs tree. Explain how to add a Markdown post, required frontmatter, valid section slugs, where background assets live, and that comments/CMS are deferred. If adding a file, use `README.md` only if it already exists; otherwise prefer `src/content/README.md` because it lives with content and is implementation-relevant.
  **Must NOT do**: Do not create deployment docs. Do not implement comments or Decap CMS. Do not write personal section intro prose for the user.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: concise technical documentation for future authoring.
  - Skills: [] - No specialized skill required.
  - Omitted: [`visual-engineering`] - No UI changes required.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: [Final Verification Wave] | Blocked By: [3, 11]

  **References**:
  - Data: `src/data/sections.js` - valid section slug list.
  - Data: `src/data/content.js` - frontmatter validation contract.
  - Content: `src/content/posts/*.md` - examples of valid Markdown posts.
  - External: `https://decapcms.org/docs/intro/` - future CMS reference only; do not implement.
  - External: `https://giscus.app/` - future comments reference only; do not implement.

  **Acceptance Criteria**:
  - [ ] Authoring notes list exact required frontmatter fields and valid section slugs.
  - [ ] Authoring notes explain that adding a normal post requires only adding a Markdown file and rebuilding.
  - [ ] Authoring notes explicitly state comments and CMS are deferred future options.
  - [ ] `npm run build` and `npm run verify:visual` still pass after documentation/comments.

  **QA Scenarios**:
  ```
  Scenario: Authoring docs match schema
    Tool: Bash
    Steps: Compare documented required fields against src/data/content.js validation fields.
    Expected: Documentation and validation list the same required fields.
    Evidence: .sisyphus/evidence/task-12-authoring-docs.json

  Scenario: Deferred scope remains deferred
    Tool: Bash
    Steps: Search source for comment-system integrations, login UI, Decap CMS admin route, or backend config.
    Expected: None are implemented; docs mention them only as future options.
    Evidence: .sisyphus/evidence/task-12-authoring-docs-scope.json
  ```

  **Commit**: NO | Message: `docs(content): document markdown authoring` | Files: [`src/content/README.md`, `src/data/content.js`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit once after all implementation tasks and verification pass.
- Suggested message: `feat(blog): add section-first markdown archive`
- Do not commit `.sisyphus/evidence/*.png` unless the user explicitly wants evidence committed.

## Success Criteria
- Section-first navigation is the primary user-facing taxonomy.
- All accepted route slugs work by direct URL entry and refresh.
- Markdown content pipeline is documented by implementation and verified by build.
- Greeting is accessible, repeatable every entry, and not wheel-only.
- Music is subtle, collapsed, and non-blocking.
- Comments remain deferred with no login/backend added.
