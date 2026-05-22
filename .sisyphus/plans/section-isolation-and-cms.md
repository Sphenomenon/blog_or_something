# Section-Isolated Navigation + Decap CMS Integration

## TL;DR
> **Summary**: Enforce strict section-isolated prev/next navigation (no cross-section leaks), and integrate Decap CMS with Netlify deploy for browser-based content editing with image upload.
> **Deliverables**: Section-scoped `getArticleNeighbors`, strict `related` rail, Decap CMS admin panel, Netlify deploy config, CMS media upload support
> **Effort**: Medium
> **Parallel**: YES — 3 waves
> **Critical Path**: Task 1 → Task 2 → Task 3

## Context
### Original Request
1. 隔离思想，每个板块的文章互相隔离，prev/next 导航不引导到其他板块的文章
2. 插图支持确认 + CMS 编辑面板，网页部署后确保只有博主能编辑更新
3. 图片上传支持（CMS 编辑器内拖入/粘贴）

### Interview Summary
- Navigation isolation: STRICT — `getArticleNeighbors` must filter by `post.section`, return `null` if no same-section neighbor
- `ArticleView` "related" rail: also strict, no cross-section fallback
- CMS: Decap CMS (git-based), hosted via Netlify with Netlify Identity for GitHub OAuth
- Image upload: yes, CMS editor supports drag/paste, images stored to `public/images/uploads/`
- No existing deployment pipeline — Netlify must be configured from scratch
- Test strategy: manual only (user preference), no automated tests in this plan

### Metis Review (gaps addressed)
- Both prev/next AND related must be strict — confirmed
- Section identity: `post.section` slug, already validated against sections.js registry
- CMS content model: edit existing `src/content/posts/*.md` directly
- Media folder: `public/images/uploads/` for Vite static serving
- Netlify Identity + Git Gateway setup checklist included
- SPA routing: `_redirects` file for deep-link support
- Risk mitigations: no global fallback, section key consistency guaranteed by existing validation, media path end-to-end tested

## Work Objectives
### Core Objective
Enforce strict section-scoped article navigation and add Decap CMS for authenticated browser-based content editing with image upload, deployed on Netlify.

### Deliverables
1. Modified `getArticleNeighbors` with section-scoped variant
2. Updated `ArticleView` related rail to strict same-section only
3. Decap CMS admin config (`public/admin/config.yml`)
4. Decap CMS admin entry (`public/admin/index.html`)
5. Netlify deployment configuration (`netlify.toml`, `public/_redirects`)
6. CMS image upload path: `public/images/uploads/`

### Definition of Done
- [ ] `getArticleNeighbors` returns only same-section neighbors, `null` where none
- [ ] `ArticleView` related list contains only same-section posts
- [ ] `/admin/` loads Decap CMS login interface
- [ ] `netlify.toml` has correct build command (`npm run build`) and publish dir (`dist`)
- [ ] `public/_redirects` handles SPA deep-link routing (`/* /index.html 200`)
- [ ] CMS config allows editing posts with all frontmatter fields
- [ ] CMS image upload saves to `public/images/uploads/` and renders in posts
- [ ] `npm run build` succeeds with CMS static files included

### Must Have
- Section-scoped neighbor logic with zero cross-section leakage
- Decap CMS admin accessible at `/admin/`
- Netlify Identity authentication (only repo collaborators can log in)
- Image upload to `public/images/uploads/` via CMS media library

### Must NOT Have
- Cross-section fallback in prev/next or related
- Custom auth backend (use Netlify Identity only)
- Migration scripts or content model changes beyond Decap config
- Markdown parser changes (existing parser already handles images)
- Automated tests (user explicitly chose manual-only)
- Taxonomy redesign, search changes, comment system changes

## Verification Strategy
> Manual verification only, per user preference.
- Test decision: none (manual)
- QA policy: acceptance criteria are verifiable conditions with specific commands/steps, but executed manually by user
- Evidence: not applicable

## Execution Strategy
### Parallel Execution Waves
> Wave 1: Data layer + ArticleView fix (blockers for everything else)
> Wave 2: CMS config + admin page (independently parallelizable)
> Wave 3: Netlify deployment config (depends on build verifying with CMS files)

Wave 1: [data-layer] Section-isolated navigation helpers + ArticleView related rail
Wave 2: [cms-setup] Decap CMS config, admin page, media folder
Wave 3: [deployment] Netlify config, redirects, build verification

### Dependency Matrix
| Task | Blocks | Blocked By |
|------|--------|------------|
| 1a. getArticleNeighbors(section) | 1b | — |
| 1b. ArticleView strict related | 1c | 1a |
| 1c. Verify section isolation | — | 1a, 1b |
| 2a. Decap CMS config.yml | 2c | — |
| 2b. Admin index.html | 2c | — |
| 2c. CMS build verification | — | 2a, 2b |
| 3a. netlify.toml | — | — |
| 3b. _redirects | — | — |
| 3c. Final build verification | — | 1c, 2c, 3a, 3b |

### Agent Dispatch Summary
| Wave | Tasks | Categories |
|------|-------|------------|
| 1 | 1a, 1b, 1c | quick, quick, quick |
| 2 | 2a, 2b, 2c | visual-engineering, visual-engineering, quick |
| 3 | 3a, 3b, 3c | quick, quick, quick |

## TODOs

- [x] 1a. Section-scoped `getArticleNeighbors` helper

  **What to do**: Modify `getArticleNeighbors` in `src/data/content.js` to accept an optional `sectionSlug` parameter. When provided, filter `sortedPosts` to only posts matching that section before finding neighbors. If no section filter given, keep existing global behavior as backward-compatible default. Import and re-export from `src/data/posts.js` if signature changes.

  **Must NOT do**: Remove the existing global-scope signature; add a new function OR use an optional parameter. Do NOT change `sortedPosts` itself. Do NOT touch `getArticleNeighbors` calls in ArchiveView or other non-article contexts.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: single-function modification in one file, well-understood existing pattern
  - Skills: `[]`
  - Omitted: `visual-engineering` — no UI changes in this task

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [1b] | Blocked By: []

  **References**:
  - Pattern: `src/data/content.js:170-176` — `getSectionRepresentativePosts` already filters by `post.section`, reuse this filter pattern
  - Current: `src/data/content.js:178-188` — existing `getArticleNeighbors` implementation
  - API: `src/data/content.js:113-141` — post object shape confirms `section` field
  - Export: `src/data/posts.js` — current re-exports of content helpers

  **Acceptance Criteria**:
  - [ ] `getArticleNeighbors('some-article', 'essays')` returns only posts where `post.section === 'essays'`
  - [ ] When no section param given, behavior matches current global `getArticleNeighbors`
  - [ ] First article in section has `previous: null`
  - [ ] Last article in section has `next: null`
  - [ ] Section with one article returns `{ previous: null, next: null }`

  **Commit**: YES | Message: `feat(blog): scope article neighbors to section` | Files: [`src/data/content.js`, `src/data/posts.js`]

- [x] 1b. ArticleView strict related rail

  **What to do**: In `src/pages/ArticleView.jsx`, update the `related` list computation (lines 202-206) to be strict same-section only. Currently it prefers same-section but falls back to cross-section. Change it to filter ONLY same-section posts (excluding current article), removing the fallback. Pass the current post's `section` to the updated `getArticleNeighbors` call.

  **Must NOT do**: Change the UI layout, styles, or markup of the related rail. Do NOT touch prev/next link behavior (that comes from neighbors directly). Do NOT remove the section label display.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: single logic change in one component, straightforward filter modification
  - Skills: `[]`
  - Omitted: `visual-engineering` — no visual changes, only data filtering

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [1c] | Blocked By: [1a]

  **References**:
  - Pattern: `src/data/content.js:170-176` — `getSectionRepresentativePosts` filter pattern
  - Target: `src/pages/ArticleView.jsx:201-206` — current related computation to modify
  - API: `src/pages/ArticleView.jsx:199-200` — `post.section` is already available

  **Acceptance Criteria**:
  - [ ] Related list contains only posts with same `section` as current article
  - [ ] Current article itself is excluded from related list
  - [ ] Section with only one article shows empty related list
  - [ ] No cross-section posts appear in related list under any conditions

  **Commit**: YES | Message: `fix(blog): enforce strict section isolation in related articles` | Files: [`src/pages/ArticleView.jsx`]

- [x] 1c. Verify section isolation behavior

  **What to do**: Build the site (`npm run build`) and verify section isolation works correctly. Write a small verification script or manual checklist that:
  1. Confirms `getArticleNeighbors` with section param returns same-section-only in all edge cases
  2. Confirms `ArticleView` renders same-section-only related posts
  Provide clear pass/fail output the user can verify.

  **Must NOT do**: Write automated Playwright tests (user chose manual-only). Do NOT create .sisyphus/evidence files.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: build verification + manual checklist, no UI automation
  - Skills: `[]`

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [3c] | Blocked By: [1a, 1b]

  **References**:
  - Build: `package.json` — `npm run build`
  - Helper: `src/data/content.js` — updated `getArticleNeighbors`
  - Component: `src/pages/ArticleView.jsx` — updated related computation

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds with no errors
  - [ ] Manual verification checklist confirms all edge cases pass
  - [ ] Cross-section posts do not leak into related rail

  **Commit**: NO

- [x] 2a. Decap CMS config.yml
- [x] 2b. Decap CMS admin index.html
- [x] 2c. CMS media upload directory
- [x] 3a. Netlify deployment configuration
- [x] 3b. SPA redirects fallback
- [x] 3c. Final build and manual verification

  **What to do**: Run `npm run build` and confirm all new files are included in the output:
  - `dist/admin/config.yml`
  - `dist/admin/index.html`
  - `dist/images/uploads/` directory
  - `dist/_redirects`
  - All existing pages still build correctly
  Provide a verification checklist for manual testing on deployed site:
  1. Visit `/admin/` → should see Decap CMS login
  2. Visit any article → prev/next and related should only show same-section
  3. Visit nested route and refresh → should not 404

  **Must NOT do**: Deploy to Netlify (that's user's action). Do NOT create automated tests.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: build verification + checklist
  - Skills: `[]`

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [] | Blocked By: [1c, 2c, 3a, 3b]

  **References**:
  - Build: `package.json` — `npm run build` command
  - Output dir: `dist/` — expected to contain new admin + redirect files

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds with zero errors
  - [ ] `dist/admin/` contains config.yml and index.html
  - [ ] `dist/images/uploads/` exists
  - [ ] `dist/_redirects` exists
  - [ ] All existing routes build without regressions

  **Commit**: NO

## Final Verification Wave
> Manual verification only. User executes acceptance criteria manually after deploying to Netlify.
- [ ] F1. Verify section isolation: navigate to articles in different sections, confirm prev/next and related are section-scoped
- [ ] F2. Verify CMS access: visit `/admin/`, confirm login interface loads
- [ ] F3. Verify CMS editing: after Netlify deploy + Identity setup, log in and edit a post
- [ ] F4. Verify image upload: drag/paste image in CMS editor, confirm saved to `images/uploads/` and renders in post

## Commit Strategy
- Commit after each task or small group of related tasks.
- Suggested final commit message pattern: `feat(blog): section-isolated navigation and CMS integration`.
- Files to commit: `src/data/content.js`, `src/data/posts.js`, `src/pages/ArticleView.jsx`, `public/admin/config.yml`, `public/admin/index.html`, `public/images/uploads/.gitkeep`, `netlify.toml`, `public/_redirects`

## Success Criteria
- Article prev/next navigation never crosses section boundaries
- Article related rail shows only same-section posts
- `/admin/` page loads Decap CMS login via Netlify Identity
- CMS image upload saves to `public/images/uploads/` and renders in built site
- `netlify.toml` + `_redirects` ready for Netlify deployment
- `npm run build` succeeds with all new files included
