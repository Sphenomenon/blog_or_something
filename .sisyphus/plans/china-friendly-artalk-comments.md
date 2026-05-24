# China-Friendly Artalk Comments Migration

## TL;DR
> **Summary**: Replace the current Waline/Vercel/Supabase comment chain with Artalk, using a fresh Artalk data store on a future HK/VPS and exposing it at `https://comment.icarusfell.top` so mainland visitors can comment without VPN. The repository work migrates the article-page comment client; the deployment work is a runbook gated on purchasing/provisioning the VPS.
> **Deliverables**:
> - Artalk frontend integration replacing Waline in article pages.
> - Artalk-specific environment variable and disabled-state behavior.
> - Updated visual/core verification for Artalk and article-only rendering.
> - HK/VPS Docker Compose + SQLite + reverse proxy/TLS deployment runbook.
> - Cloudflare DNS and Cloudflare Pages environment checklist for `comment.icarusfell.top`.
> - Backend health, persistence, and mainland-accessibility verification evidence.
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Task 2 → Task 5 → Task 6 → Final Verification Wave

## Context
### Original Request
- User verified across multiple devices that the current comment login UI cannot open in mainland China without VPN.
- User asked for a no-VPN solution, preferably with CLI interaction/deployment, and asked for alternatives.

### Interview Summary
- Initial preference: preserve QQ login.
- Research finding: current mainstream/comment-system official routes do not offer a clean official QQ-login path; current Waline official social-login docs do not list QQ, and GitHub-based comment systems are poor fits for mainland no-VPN visitors.
- User selected the robust Artalk route over Waline backend migration and custom QQ OAuth.
- User selected HK/VPS deployment target.
- User selected starting fresh; no Waline/Supabase data migration.
- User selected `comment.icarusfell.top` as the comment backend subdomain.
- User does not yet have the VPS.

### Metis Review (gaps addressed)
- Split repository migration from future VPS deployment so the plan does not assume the VPS already exists.
- Preserve article-only rendering and canonical comment-path behavior.
- Remove Waline runtime dependencies and Waline-specific test assumptions.
- Use Artalk native anonymous/email-password comment flow instead of blocked third-party OAuth as the mainland-friendly default.
- Include Docker volume persistence, backup, trusted domains, TLS, DNS, and no-secret guardrails.
- Treat mainland no-VPN accessibility as a primary acceptance criterion, with best-effort automated evidence and user-network fallback only as additional evidence.

## Work Objectives
### Core Objective
Make article comments usable from mainland China without VPN by replacing the current Waline frontend integration with Artalk and preparing an Artalk backend deployment on `comment.icarusfell.top` hosted on a China-reachable HK/VPS.

### Deliverables
- Repository changes:
  - `src/pages/ArticleView.jsx` uses Artalk instead of Waline.
  - `package.json` / `package-lock.json` remove `@waline/client` and add `artalk`.
  - `scripts/visual-core.mjs` verifies Artalk comment behavior instead of Waline behavior.
  - Deployment docs under `.sisyphus/plans/` contain exact Artalk backend and Cloudflare setup runbook.
- Backend runbook:
  - VPS purchase/provisioning checklist.
  - Docker Compose deployment using `artalk/artalk-go` with `./data:/data` SQLite persistence.
  - Reverse proxy/TLS for `https://comment.icarusfell.top`.
  - Admin bootstrap via `docker compose exec artalk artalk admin`.
  - Backup/restore commands for the SQLite/data directory.

### Definition of Done (verifiable conditions with commands)
- `npm run build` exits `0`.
- `npm ls artalk` shows an installed Artalk package.
- `npm ls @waline/client` exits non-zero or reports no installed `@waline/client`.
- Runtime code contains no import of `@waline/client` and no required `VITE_WALINE_SERVER_URL` usage.
- Article routes render an Artalk container when `VITE_ARTALK_SERVER_URL` is configured.
- Non-article routes do not render the Artalk container.
- Missing `VITE_ARTALK_SERVER_URL` produces deterministic disabled-state UI and no crash.
- After VPS provisioning, `curl -I https://comment.icarusfell.top` succeeds with valid TLS.
- After VPS provisioning, `curl -sS https://comment.icarusfell.top/api/v2/conf` or the verified Artalk API endpoint succeeds without DNS/TLS errors.
- After VPS provisioning, `docker compose restart artalk` preserves Artalk data under the mounted `./data` directory.
- Mainland no-proxy accessibility evidence is captured from at least one China-region probe/service or user-provided no-VPN network check.

### Must Have
- Use Artalk client config from official docs: `Artalk.init({ el, pageKey, pageTitle, server, site })`.
- Use frontend env var `VITE_ARTALK_SERVER_URL=https://comment.icarusfell.top`.
- Use Artalk site name `Icarusfell Blog` consistently in frontend and backend (`site`, `ATK_SITE_DEFAULT`).
- Preserve existing canonical comment path helper `normalizeCanonicalArticleCommentPath(pathname)` from `src/data/content.js` via the current re-export path `src/data/posts.js`.
- Preserve article-only comment placement in `src/pages/ArticleView.jsx`.
- Use Artalk anonymous comments enabled as default (`ATK_AUTH_ANONYMOUS=true`) to avoid blocked OAuth/login dependencies; keep email-password login enabled by Artalk default for users who want accounts.
- Use moderation pending by default (`ATK_MODERATOR_PENDING_DEFAULT=true`) so anonymous mainland-friendly comments do not publish without review.
- Use SQLite (`ATK_DB_TYPE=sqlite`, `ATK_DB_FILE=./data/artalk.db`) for the first deployment.
- Use persistent bind mount `./data:/data`.
- Keep secrets out of git; admin password, SMTP credentials, VPS credentials, and Cloudflare tokens must never be committed.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Do NOT build custom QQ OAuth.
- Do NOT migrate Waline/Supabase comments.
- Do NOT keep Waline and Artalk active simultaneously.
- Do NOT redesign the article page beyond required comment-provider integration.
- Do NOT change article routes, slugs, or canonical path semantics.
- Do NOT add unrelated analytics, monitoring, image hosting, or anti-spam integrations unless explicitly requested later.
- Do NOT commit `.env`, admin credentials, VPS IP credentials, SMTP passwords, or API tokens.
- Do NOT rely on GitHub/Giscus/Utterances/Gitalk for the primary visitor comment flow.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed where infrastructure access exists. If the VPS is not yet purchased, backend deployment tasks produce a ready-to-run runbook and mark execution as blocked by missing SSH target.
- Test decision: tests-after + existing Playwright/visual script (`scripts/visual-core.mjs`) + build checks.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.
- Mainland accessibility policy: use at least one automated China-region HTTP probe/service if reachable from the execution environment. If no probe has a CLI/API path, capture `curl`/browser evidence from the deployed endpoint and document that final mainland-user confirmation remains an external environmental check, not a code acceptance gate.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Task 1 (repo discovery), Task 4 (VPS/DNS runbook), Task 7 (docs/env guidance)
Wave 2: Task 2 (frontend migration), Task 3 (verification update), Task 5 (backend deployment once VPS exists)
Wave 3: Task 6 (end-to-end smoke), Task 8 (cleanup/deprecation sweep)

### Dependency Matrix (full, all tasks)
- Task 1: blocks Tasks 2, 3, 8.
- Task 2: blocked by Task 1; blocks Tasks 3, 6, 8.
- Task 3: blocked by Tasks 1 and 2; blocks Task 6.
- Task 4: no code dependency; blocks Task 5.
- Task 5: blocked by Task 4 and availability of VPS SSH/DNS access; blocks Task 6.
- Task 6: blocked by Tasks 2, 3, 5.
- Task 7: can run after Task 1; blocks final handoff quality.
- Task 8: blocked by Tasks 2 and 3.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → quick, writing, unspecified-low.
- Wave 2 → 3 tasks → quick, unspecified-high.
- Wave 3 → 2 tasks → unspecified-high, quick.

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Inventory and lock comment-system change points

  **What to do**: Search the repository for all Waline/comment references before editing. Confirm every runtime, test, and doc touchpoint that must change or remain. Produce `.sisyphus/evidence/task-1-comment-inventory.json` listing: Waline runtime imports, Waline env vars, Artalk references if any, comment containers/selectors, and docs that mention current comments.
  **Must NOT do**: Do not edit code in this task. Do not inspect or alter external Vercel/Supabase credentials. Do not plan migration of old comments.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded repository search and evidence capture.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - no commit operation required.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Tasks 2, 3, 8 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/pages/ArticleView.jsx:1-4` - current Waline imports to remove later.
  - Pattern: `src/pages/ArticleView.jsx:224-256` - current `VITE_WALINE_SERVER_URL`, container refs, lifecycle, and `login: "force"` initialization.
  - Pattern: `src/pages/ArticleView.jsx:392-397` - current comment section UI and disabled notice.
  - API/Type: `src/data/content.js:241-252` - canonical comment path helper that must be preserved.
  - Test: `scripts/visual-core.mjs` - existing Playwright/visual regression script with Waline-specific expectations.
  - Package: `package.json:13-17` - current `@waline/client` dependency.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Evidence file `.sisyphus/evidence/task-1-comment-inventory.json` exists and lists every file containing `waline`, `VITE_WALINE`, `article-comments`, `comments-container`, or `commentPath`.
  - [ ] Evidence explicitly classifies each reference as `runtime`, `test`, `docs`, or `historical`.
  - [ ] Evidence includes `src/pages/ArticleView.jsx`, `src/data/content.js`, `scripts/visual-core.mjs`, and `package.json`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Inventory finds current Waline runtime references
    Tool: Bash
    Steps: Run repository content search for `@waline/client`, `VITE_WALINE_SERVER_URL`, and `login: "force"`; write structured results to `.sisyphus/evidence/task-1-comment-inventory.json`.
    Expected: Evidence file includes `src/pages/ArticleView.jsx` with line references around imports and initialization.
    Evidence: .sisyphus/evidence/task-1-comment-inventory.json

  Scenario: Inventory confirms no migration scope
    Tool: Bash
    Steps: Search repository and `/tmp/waline-deploy` notes only for Supabase/Waline migration scripts.
    Expected: Evidence states no tracked migration script exists and explicitly records `No Waline/Supabase import/export task planned`.
    Evidence: .sisyphus/evidence/task-1-no-migration-scope.json
  ```

  **Commit**: NO | Message: n/a | Files: evidence only

- [ ] 2. Replace Waline frontend integration with Artalk

  **What to do**: Update `src/pages/ArticleView.jsx` to import Artalk and its CSS, read `import.meta.env.VITE_ARTALK_SERVER_URL?.trim() ?? ""`, keep a React ref/instance lifecycle equivalent to the current Waline lifecycle, and initialize Artalk with `Artalk.init({ el: artalkContainerRef.current, pageKey: commentPath, pageTitle: post.title, server: artalkServerURL, site: "Icarusfell Blog", darkMode: true, locale: "zh-CN" })`. Keep the existing article-only section and related layout. Change disabled message to `评论暂不可用：未配置 VITE_ARTALK_SERVER_URL。`. Update test IDs only if necessary; preferred: keep `data-testid="article-comments-container"` for existing tests and add `data-provider="artalk"`.
  **Must NOT do**: Do not keep `@waline/client` imports. Do not use a public CDN for Artalk client in React code. Do not change `commentPath` generation. Do not add QQ/OAuth logic. Do not alter article markdown rendering or routing.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: one primary React file plus dependency manifest update.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - visual redesign is explicitly out of scope.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Tasks 3, 6, 8 | Blocked By: Task 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/pages/ArticleView.jsx:224-256` - mirror existing init/destroy lifecycle with Artalk instance.
  - Pattern: `src/pages/ArticleView.jsx:392-397` - preserve article comment section placement and disabled-state pattern.
  - API/Type: `src/data/content.js:241-252` - preserve normalized `pageKey` value.
  - External: `https://artalk.js.org/en/guide/deploy.html#client-installation` - Artalk npm package and React-compatible import pattern: `import 'artalk/Artalk.css'; import Artalk from 'artalk'`.
  - External: `https://artalk.js.org/en/guide/frontend/config.html#configuring-the-interface-via-artalk-init` - required `Artalk.init({ el, pageKey, pageTitle, server, site })` options.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `package.json` dependencies include `artalk` and do not include `@waline/client`.
  - [ ] `package-lock.json` is updated consistently by package manager commands.
  - [ ] `src/pages/ArticleView.jsx` contains no `@waline/client`, `waline`, `Waline`, or `VITE_WALINE_SERVER_URL` runtime references.
  - [ ] `src/pages/ArticleView.jsx` initializes Artalk with `pageKey: commentPath`, `pageTitle: post.title`, `server: artalkServerURL`, and `site: "Icarusfell Blog"`.
  - [ ] Missing `VITE_ARTALK_SERVER_URL` does not throw and renders disabled text.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Artalk dependency and runtime import replace Waline
    Tool: Bash
    Steps: Run `npm ls artalk`; run `npm ls @waline/client`; search runtime source for `@waline/client` and `VITE_WALINE_SERVER_URL`.
    Expected: `npm ls artalk` exits 0; `npm ls @waline/client` exits non-zero or shows none; runtime source has no Waline import/env reference.
    Evidence: .sisyphus/evidence/task-2-dependency-replacement.txt

  Scenario: Missing Artalk env renders disabled UI without crash
    Tool: Playwright
    Steps: Start dev server without `VITE_ARTALK_SERVER_URL`; open a known article route; query `[data-testid="article-comments-disabled"]`.
    Expected: Disabled text equals `评论暂不可用：未配置 VITE_ARTALK_SERVER_URL。`; no page errors are captured.
    Evidence: .sisyphus/evidence/task-2-missing-env-disabled.json
  ```

  **Commit**: YES | Message: `feat(comments): migrate article comments to artalk` | Files: `src/pages/ArticleView.jsx`, `package.json`, `package-lock.json`

- [ ] 3. Update visual/core verification for Artalk

  **What to do**: Update `scripts/visual-core.mjs` and any verification entrypoints that assert Waline-specific behavior. Replace `VITE_WALINE_SERVER_URL` expectations with `VITE_ARTALK_SERVER_URL`. Verify article-only rendering, configured-server container presence, and missing-env disabled state. Preserve existing evidence-writing patterns under `.sisyphus/evidence/`.
  **Must NOT do**: Do not remove unrelated existing visual checks. Do not make tests depend on a live production Artalk backend when the objective is only frontend container behavior. Do not use vague screenshot-only assertions.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: test script is large and must preserve existing checks while changing comment assertions.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - test behavior only; no redesign.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Task 6 | Blocked By: Tasks 1, 2

  **References** (executor has NO interview context - be exhaustive):
  - Test: `scripts/visual-core.mjs:1-15` - Playwright setup and evidence directory constants.
  - Test: `scripts/visual-core.mjs:199-212` - existing evidence writing helpers to reuse.
  - Pattern: `src/pages/ArticleView.jsx:392-397` - target selectors for comments section.
  - External: `https://artalk.js.org/en/guide/frontend/config.html#server` - frontend `server` option must point to accessible backend.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Search for `VITE_WALINE_SERVER_URL` in `scripts/visual-core.mjs` returns no matches.
  - [ ] Search for `Waline`/`waline` in active visual assertions returns no runtime/test dependency unless in a historical/deprecation assertion.
  - [ ] `npm run verify:visual` exits `0` in the documented environment or produces a precise failure unrelated to comments with evidence.
  - [ ] Test evidence proves article route renders `[data-testid="article-comments-container"][data-provider="artalk"]` when `VITE_ARTALK_SERVER_URL` is set.
  - [ ] Test evidence proves non-article routes do not render the comment container.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Configured frontend shows Artalk container only on articles
    Tool: Playwright
    Steps: Start dev server with `VITE_ARTALK_SERVER_URL=https://comment.icarusfell.top`; open a known article route, `/`, `/archive`, and `/sections/tech`; inspect `[data-testid="article-comments-container"]`.
    Expected: Container exists only on the article route and has `data-provider="artalk"`; non-article routes have zero matches.
    Evidence: .sisyphus/evidence/task-3-article-only-artalk.json

  Scenario: Verification script has no Waline env dependency
    Tool: Bash
    Steps: Search `scripts/visual-core.mjs` for `VITE_WALINE_SERVER_URL`, `@waline/client`, and `login: "force"`.
    Expected: No matches in active test code.
    Evidence: .sisyphus/evidence/task-3-no-waline-test-dependency.txt
  ```

  **Commit**: YES | Message: `test(comments): verify artalk article comments` | Files: `scripts/visual-core.mjs`

- [ ] 4. Prepare HK/VPS, DNS, and reverse-proxy runbook

  **What to do**: Create a deployment runbook section in this plan or an appended `.sisyphus/drafts`-free artifact under `.sisyphus/plans/` describing the exact pre-execution checklist and shell commands for the future VPS. Use Ubuntu 22.04/24.04 as the default target. Specify minimum VPS requirements: HK/Singapore or China-optimized route, 1 vCPU, 1 GB RAM, 10 GB disk, public IPv4, ports 22/80/443 open. Specify Cloudflare DNS record: `comment` A record to VPS IPv4, DNS-only initially for issuance/debug; Cloudflare proxy can be enabled only after HTTPS/API verification. Specify Caddy as the default reverse proxy because it automates TLS; include Nginx only as fallback. Specify Artalk Compose file content with `artalk/artalk-go`, `./data:/data`, `127.0.0.1:23366:23366`, `ATK_LOCALE=zh-CN`, `ATK_SITE_DEFAULT=Icarusfell Blog`, `ATK_SITE_URL=https://icarusfell.top`, `ATK_TRUSTED_DOMAINS=https://icarusfell.top https://www.icarusfell.top`, `ATK_AUTH_ANONYMOUS=true`, `ATK_MODERATOR_PENDING_DEFAULT=true`, `ATK_DB_TYPE=sqlite`, `ATK_DB_FILE=./data/artalk.db`.
  **Must NOT do**: Do not purchase a VPS. Do not store real SSH credentials or admin passwords. Do not include Supabase or Waline migration commands. Do not require mainland ICP/备案 for HK/VPS.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: precise deployment/runbook instructions with commands.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - commit deferred until implementation phase if requested.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: Task 5 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - External: `https://artalk.js.org/en/guide/deploy.html#docker-compose` - official Docker Compose example.
  - External: `https://artalk.js.org/en/guide/env.html#general` - `ATK_SITE_DEFAULT`, `ATK_SITE_URL`, `ATK_TRUSTED_DOMAINS`, locale, port.
  - External: `https://artalk.js.org/en/guide/env.html#social-login` - `ATK_AUTH_ANONYMOUS` and email login defaults.
  - External: `https://artalk.js.org/en/guide/env.html#database` - SQLite env vars.
  - External: `https://artalk.js.org/en/guide/env.html#moderator` - `ATK_MODERATOR_PENDING_DEFAULT`.
  - External: `https://artalk.js.org/en/guide/backend/reverse-proxy.html#caddy` - Caddy reverse proxy pattern.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Runbook contains a `docker-compose.yml` block with `image: artalk/artalk-go`, `restart: unless-stopped`, `ports: ["127.0.0.1:23366:23366"]`, and `./data:/data`.
  - [ ] Runbook contains a Caddyfile block for `comment.icarusfell.top` reverse proxying to `127.0.0.1:23366`.
  - [ ] Runbook contains Cloudflare DNS steps for `comment.icarusfell.top` and explicitly says DNS-only first.
  - [ ] Runbook contains admin bootstrap command `docker compose exec artalk artalk admin` and says credentials must be entered out-of-band.
  - [ ] Runbook contains backup command `tar -czf artalk-data-$(date +%F).tar.gz data` or equivalent.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Runbook includes all required Artalk deployment primitives
    Tool: Bash
    Steps: Search the plan/runbook for `artalk/artalk-go`, `ATK_AUTH_ANONYMOUS=true`, `ATK_MODERATOR_PENDING_DEFAULT=true`, `ATK_TRUSTED_DOMAINS`, `comment.icarusfell.top`, and `docker compose exec artalk artalk admin`.
    Expected: All required strings are present exactly once or in clearly relevant sections.
    Evidence: .sisyphus/evidence/task-4-runbook-primitives.txt

  Scenario: Runbook excludes secrets and migration scope
    Tool: Bash
    Steps: Search the runbook for `PG_PASSWORD`, `SUPABASE`, `CLIENT_SECRET`, `admin password`, and real private key patterns.
    Expected: No real secrets appear; Waline/Supabase references appear only under explicit exclusions or historical context.
    Evidence: .sisyphus/evidence/task-4-no-secrets-no-migration.txt
  ```

  **Commit**: YES | Message: `docs(comments): add artalk vps deployment runbook` | Files: `.sisyphus/plans/china-friendly-artalk-comments.md`

- [ ] 5. Deploy Artalk backend after VPS is available

  **What to do**: Once the user provides SSH access to the purchased HK/VPS, execute the runbook from Task 4. Install Docker, Docker Compose plugin, and Caddy if absent. Create `/opt/artalk` (or user-approved equivalent), write `docker-compose.yml` on the server only, start Artalk, configure Caddy for `comment.icarusfell.top`, create the Artalk admin through CLI, and verify `https://comment.icarusfell.top` from the execution environment. Configure Cloudflare Pages build variable `VITE_ARTALK_SERVER_URL=https://comment.icarusfell.top` if the executor has Cloudflare access; otherwise produce exact dashboard steps.
  **Must NOT do**: Do not write server `.env` or compose files into this repo. Do not store SSH credentials. Do not run destructive firewall commands that cut off SSH. Do not enable Cloudflare proxy until direct DNS-only HTTPS and API checks pass. Do not import old comments.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: remote deployment with DNS/TLS/firewall verification.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - server deployment is not a repo commit.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Task 6 | Blocked By: Task 4 + user-provided VPS SSH/DNS access

  **References** (executor has NO interview context - be exhaustive):
  - Runbook: `.sisyphus/plans/china-friendly-artalk-comments.md` Task 4.
  - External: `https://artalk.js.org/en/guide/deploy.html#launch-server` - Docker launch and admin command.
  - External: `https://artalk.js.org/en/guide/backend/reverse-proxy.html#caddy` - Caddy reverse proxy config.
  - Env: Cloudflare Pages variable should be `VITE_ARTALK_SERVER_URL=https://comment.icarusfell.top`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `ssh <server> 'docker compose version && caddy version'` succeeds, or equivalent installation evidence exists.
  - [ ] `ssh <server> 'cd /opt/artalk && docker compose ps'` shows Artalk service running.
  - [ ] `curl -I https://comment.icarusfell.top` exits `0` with valid TLS.
  - [ ] `curl -sS https://comment.icarusfell.top` returns Artalk-served content or dashboard/API response, not a Vercel/Supabase error.
  - [ ] `ssh <server> 'cd /opt/artalk && test -f data/artalk.db'` succeeds after first startup.
  - [ ] `ssh <server> 'cd /opt/artalk && docker compose restart artalk && docker compose ps'` leaves Artalk running.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Backend HTTPS and Artalk service are reachable
    Tool: Bash
    Steps: Run `curl -I https://comment.icarusfell.top`; run `curl -sS https://comment.icarusfell.top | head` or equivalent full captured output; run server-side `docker compose ps`.
    Expected: TLS validates; HTTP status is healthy (`200`, `301`, or documented Artalk response); Artalk container status is running.
    Evidence: .sisyphus/evidence/task-5-backend-health.txt

  Scenario: Container restart preserves SQLite data
    Tool: Bash
    Steps: On the VPS, verify `/opt/artalk/data/artalk.db` exists; run `docker compose restart artalk`; verify service is running and database file still exists.
    Expected: Artalk restarts successfully and database file remains under persistent `data` mount.
    Evidence: .sisyphus/evidence/task-5-persistence.txt
  ```

  **Commit**: NO | Message: n/a | Files: server-only deployment, Cloudflare dashboard/env outside repo

- [ ] 6. Run end-to-end Artalk smoke and mainland-accessibility verification

  **What to do**: With frontend configured and backend deployed, verify the integrated production path. Open an article route on `https://icarusfell.top`, confirm Artalk renders, submit a test comment if moderation policy allows, and confirm pending/visible behavior matches `ATK_MODERATOR_PENDING_DEFAULT=true`. Run backend probes from the executor and at least one mainland-oriented probe if available. Capture screenshots and JSON/text evidence.
  **Must NOT do**: Do not leave spam/test comments visible publicly if moderation is off; delete or mark test comments after verification through dashboard/API if possible. Do not require QQ login. Do not disable moderation just to make the test easier.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-service UI/backend/DNS verification.
  - Skills: [`playwright`] - browser route and comment UI checks.
  - Omitted: [`git-master`] - no commit required unless fixes are made.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: final verification | Blocked By: Tasks 2, 3, 5

  **References** (executor has NO interview context - be exhaustive):
  - Frontend: `src/pages/ArticleView.jsx` Artalk init after Task 2.
  - Backend: `https://comment.icarusfell.top`.
  - Blog: `https://icarusfell.top`.
  - Test data: author `Artalk Test`, email `artalk-test@example.com`, body `Artalk integration smoke test`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Production article page loads without console/page errors caused by Artalk.
  - [ ] Artalk comment editor/list UI appears on article routes.
  - [ ] Artalk UI does not appear on homepage, archive, or section routes.
  - [ ] Test comment submission reaches backend; if moderation is enabled, the UI/backend indicates pending or admin review rather than silent failure.
  - [ ] `https://comment.icarusfell.top` is reachable from at least one non-local probe; mainland probe evidence is captured if available.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Production article displays Artalk and submits smoke comment
    Tool: Playwright
    Steps: Open `https://icarusfell.top`; navigate to a known article; locate Artalk editor; fill name `Artalk Test`, email `artalk-test@example.com`, body `Artalk integration smoke test`; submit; capture UI response.
    Expected: Artalk UI loads; submit request does not fail with DNS, CORS, or 5xx; moderation/pending behavior is visible or comment appears according to backend policy.
    Evidence: .sisyphus/evidence/task-6-production-artalk-smoke.png

  Scenario: Mainland/no-proxy accessibility best-effort check
    Tool: Bash / web service / Playwright
    Steps: Query a China-region HTTP probe if available for `https://comment.icarusfell.top`; otherwise capture direct `curl -I` and document missing automated mainland probe in evidence.
    Expected: Probe reports reachable HTTP(S) status, or evidence explicitly marks `BLOCKED: no China-region probe available to executor` while direct endpoint health passes.
    Evidence: .sisyphus/evidence/task-6-mainland-accessibility.json
  ```

  **Commit**: NO | Message: n/a | Files: evidence only unless fixes are required

- [ ] 7. Update deployment/environment documentation for Artalk

  **What to do**: Update existing deployment guidance that the implementer determines is appropriate, preferably `.sisyphus/guides/deployment.md` if maintained, or keep documentation in this plan if repository docs should not change. Document that Cloudflare Pages production must set `VITE_ARTALK_SERVER_URL=https://comment.icarusfell.top`, that `VITE_WALINE_SERVER_URL` is deprecated/unused, and that Artalk backend credentials live only on the VPS/DNS provider. Document admin URL `https://comment.icarusfell.top` and moderation default pending behavior. Mark old Waline/Vercel/Supabase comment chain as retired, not as active instructions.
  **Must NOT do**: Do not write secrets. Do not edit unrelated CMS OAuth instructions unless needed to avoid confusion. Do not claim the backend is deployed until Task 5 evidence exists.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: documentation update and operator guidance.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - commit handled by implementer only if user requests.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: final handoff quality | Blocked By: Task 1

  **References** (executor has NO interview context - be exhaustive):
  - Existing doc: `.sisyphus/guides/deployment.md` - deployment/CMS guidance from prior work.
  - Current frontend env: `src/pages/ArticleView.jsx` after Task 2 - source of `VITE_ARTALK_SERVER_URL` truth.
  - Runbook: `.sisyphus/plans/china-friendly-artalk-comments.md` Task 4.
  - External: `https://artalk.js.org/en/guide/env.html` - Artalk environment variable naming.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Documentation names `VITE_ARTALK_SERVER_URL=https://comment.icarusfell.top` as the active Cloudflare Pages variable.
  - [ ] Documentation states `VITE_WALINE_SERVER_URL` is no longer used after migration.
  - [ ] Documentation states fresh-start/no Waline migration.
  - [ ] Documentation states admin bootstrap and credentials are out-of-band.
  - [ ] Documentation contains no real credentials or secrets.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Documentation points operators to Artalk env, not Waline env
    Tool: Bash
    Steps: Search updated docs for `VITE_ARTALK_SERVER_URL` and `VITE_WALINE_SERVER_URL`.
    Expected: Artalk env is documented as active; Waline env appears only as deprecated/retired if present.
    Evidence: .sisyphus/evidence/task-7-doc-env-check.txt

  Scenario: Documentation contains no secrets
    Tool: Bash
    Steps: Search changed docs for `password`, `CLIENT_SECRET`, `PG_PASSWORD`, private-key markers, and known old Supabase password strings.
    Expected: No real secret values exist; credential terms appear only as placeholders or warnings.
    Evidence: .sisyphus/evidence/task-7-doc-no-secrets.txt
  ```

  **Commit**: YES | Message: `docs(comments): document artalk deployment settings` | Files: `.sisyphus/guides/deployment.md` or `.sisyphus/plans/china-friendly-artalk-comments.md`

- [ ] 8. Remove retired Waline assumptions and perform final cleanup sweep

  **What to do**: After Artalk integration and tests pass, run a final repository sweep for Waline runtime/test leftovers. Remove unused imports, stale comments, obsolete disabled messages, and inactive `VITE_WALINE_SERVER_URL` references in runtime/test code. Keep historical references only if clearly labeled as retired/migrated in documentation. Ensure package lock and build artifacts are coherent. Do not touch external Waline Vercel deployment unless the user explicitly asks to decommission it.
  **Must NOT do**: Do not delete evidence files. Do not delete old Waline backend project or Supabase project. Do not remove CMS OAuth functions. Do not change unrelated friend links/posts/content.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: cleanup and verification sweep.
  - Skills: [] - no special skill needed.
  - Omitted: [`ai-slop-remover`] - task is multi-file targeted cleanup, not single-file slop pass.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: final verification | Blocked By: Tasks 2, 3

  **References** (executor has NO interview context - be exhaustive):
  - Runtime: `src/pages/ArticleView.jsx`.
  - Tests: `scripts/visual-core.mjs`.
  - Package: `package.json`, `package-lock.json`.
  - Historical docs may mention Waline only if labeled retired.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits `0`.
  - [ ] Search runtime source under `src/` finds no `waline`, `Waline`, `@waline/client`, or `VITE_WALINE_SERVER_URL`.
  - [ ] Search `scripts/` finds no active Waline assertions or required Waline env vars.
  - [ ] `package-lock.json` contains no installed `@waline/client` package entry.
  - [ ] Artalk references remain only where expected: `src/pages/ArticleView.jsx`, `package.json`, lockfile, tests/docs.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Build and runtime sweep pass
    Tool: Bash
    Steps: Run `npm run build`; search `src/` for `waline|Waline|@waline/client|VITE_WALINE_SERVER_URL`.
    Expected: Build exits 0; runtime search has no matches.
    Evidence: .sisyphus/evidence/task-8-build-runtime-sweep.txt

  Scenario: Package lock no longer installs Waline client
    Tool: Bash
    Steps: Search `package-lock.json` for `@waline/client`; run `npm ls @waline/client`.
    Expected: Lockfile has no `@waline/client` package entry; `npm ls @waline/client` exits non-zero or reports empty.
    Evidence: .sisyphus/evidence/task-8-package-sweep.txt
  ```

  **Commit**: YES | Message: `chore(comments): remove retired waline references` | Files: cleanup-only files found by sweep

## Backend Deployment Runbook Appendix
> Use this appendix when the HK/VPS has been purchased and SSH access is available. Replace `<vps-ip>` and `<ssh-user>` only in terminal/session configuration, never in tracked files containing credentials.

### VPS prerequisites
- Region/routing: Hong Kong preferred; Singapore acceptable only if tested from mainland networks.
- Minimum spec: 1 vCPU, 1 GB RAM, 10 GB disk, public IPv4.
- OS default: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS.
- Firewall/security group: allow TCP `22`, `80`, `443`; do not expose `23366` publicly.
- DNS control: Cloudflare zone for `icarusfell.top` must be editable.

### Cloudflare DNS
- Create record: `A comment <vps-ip>`.
- Proxy status: **DNS only** until Caddy certificate issuance and Artalk health pass.
- After successful direct verification, Cloudflare proxy may be enabled only if all checks still pass.

### Server install outline
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
curl -fsSL https://get.docker.com | sudo sh
sudo apt-get install -y caddy
sudo usermod -aG docker "$USER"
```

Log out and back in if Docker group membership is needed.

### Artalk Compose file
Create `/opt/artalk/docker-compose.yml` on the VPS only:

```yaml
services:
  artalk:
    container_name: artalk
    image: artalk/artalk-go
    restart: unless-stopped
    ports:
      - "127.0.0.1:23366:23366"
    volumes:
      - ./data:/data
    environment:
      - TZ=Asia/Shanghai
      - ATK_LOCALE=zh-CN
      - ATK_SITE_DEFAULT=Icarusfell Blog
      - ATK_SITE_URL=https://icarusfell.top
      - ATK_TRUSTED_DOMAINS=https://icarusfell.top https://www.icarusfell.top
      - ATK_AUTH_ANONYMOUS=true
      - ATK_MODERATOR_PENDING_DEFAULT=true
      - ATK_DB_TYPE=sqlite
      - ATK_DB_FILE=./data/artalk.db
      - ATK_FRONTEND_DARKMODE=auto
```

Start and verify:

```bash
cd /opt/artalk
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 artalk
```

### Caddy reverse proxy
Create or update `/etc/caddy/Caddyfile`:

```caddyfile
comment.icarusfell.top {
  reverse_proxy 127.0.0.1:23366 {
    header_up X-Forwarded-For {header.X-Forwarded-For}
    header_up X-Real-IP {remote_host}
  }
}
```

Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Admin bootstrap
Create/update the Artalk admin interactively on the VPS only:

```bash
cd /opt/artalk
sudo docker compose exec artalk artalk admin
```

Do not write the admin password to repo files, shell history notes, evidence files, or chat logs.

### Backend verification commands
```bash
curl -I https://comment.icarusfell.top
curl -sS https://comment.icarusfell.top | sed -n '1,20p'
cd /opt/artalk && sudo docker compose ps
cd /opt/artalk && test -f data/artalk.db && ls -lh data/artalk.db
```

### Backup and restore
Manual backup command from `/opt/artalk`:

```bash
cd /opt/artalk
tar -czf "artalk-data-$(date +%F).tar.gz" data
```

Restore outline:

```bash
cd /opt/artalk
sudo docker compose down
mv data "data.before-restore-$(date +%F-%H%M%S)"
tar -xzf artalk-data-YYYY-MM-DD.tar.gz
sudo docker compose up -d
```

### Cloudflare Pages environment
- Set production variable: `VITE_ARTALK_SERVER_URL=https://comment.icarusfell.top`.
- Remove or ignore old production variable: `VITE_WALINE_SERVER_URL`.
- Trigger a new Cloudflare Pages deploy after setting the variable.



## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit repository migration separately from deployment runbook updates if both produce tracked changes.
- Suggested commit 1: `feat(comments): migrate article comments to artalk`
- Suggested commit 2: `docs(comments): add artalk vps deployment runbook`
- Do not commit backend secrets, generated `.env`, VPS credentials, Artalk admin password, or DNS API tokens.

## Success Criteria
- Blog frontend no longer depends on Waline.
- Article pages initialize Artalk with `server: import.meta.env.VITE_ARTALK_SERVER_URL`, `pageKey: normalizeCanonicalArticleCommentPath(...)`, `pageTitle: post.title`, and `site: "Icarusfell Blog"`.
- `comment.icarusfell.top` Artalk backend is deployable via Docker Compose on a HK/VPS and has a clear blocked/unblocked path depending on VPS availability.
- Fresh-start decision is respected: no Waline/Supabase import/export work is performed.
- Domestic accessibility is explicitly verified or recorded as pending external infrastructure validation if no VPS exists yet.
