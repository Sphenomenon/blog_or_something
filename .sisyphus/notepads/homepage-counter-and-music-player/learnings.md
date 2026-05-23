## Task 1 - Homepage Vercount counter

- Existing sidebar visual system lives around `src/styles.css:913-1003` and uses `--surface-card`, `--surface-wash`, `--surface-glow`, `--border-subtle`, `--radius-sm`, `--font-mono`, and `--accent-gold`; the counter styles were scoped as `.side-panel-counter*` near that block.
- `index.html` now loads exactly one deferred Vercount script, `https://events.vercount.one/js`, between the existing Netlify identity script and the Vite module script.
- `HomeView.jsx` keeps `SidePanel` homepage-only and adds the counter between the categories section and terminal/status section with label `本站总访问次数`, `data-testid="home-visit-counter"`, and value span class `vercount_value_site_pv` plus fallback `--`.
- Post-change grep over runtime HTML/JSX/CSS found only the required Vercount script, `home-visit-counter` test IDs, and `vercount_value_site_pv`; no forbidden UV/page-PV/provider strings were found.
- `npm run build` passed after the changes.


## 2026-05-24 - Lazy NetEase music iframe
- `src/components/MusicEasterEgg.jsx` now derives the NetEase song ID from `music.embed_url` with a safe URL parser, so the existing `https://music.163.com/song?id=2707332868` content produces song ID `2707332868` without adding CMS/YAML fields.
- The collapsed music easter egg remains iframe-free because the iframe is only rendered inside the existing `isExpanded` panel branch after the visitor toggles it open.
- The player URL is built as HTTPS outchain player params (`type=2`, parsed `id`, `auto=0`, `height=66`); no `autoplay` attribute and no autoplay `allow` value are emitted.
- Fallback link remains available via `data-testid="music-easter-egg-fallback-link"` and keeps `href` equal to `music.embed_url`, which protects against NetEase embed/copyright/network failures.
- Scoped styles in `src/styles.css` keep the music card visual language with existing tokens and add an overflow-hidden player shell so the cross-origin iframe stays inside the easter egg card.
- Verification: `npm run build` passed. Grep confirmed no `music.playlist_id` usage, no `auto=1`, no `allow="autoplay"`, and no iframe autoplay attribute in source.

## 2026-05-24 - Visual verification for homepage counter and music player
- `scripts/visual-core.mjs` now collects `visitCounterChecks`: `/` must have exactly one `https://events.vercount.one/js` script, `data-testid="home-visit-counter"`, label `本站总访问次数`, and value class `vercount_value_site_pv`; `/archive`, `/about`, `/posts/petrified-corridor`, and `/sections/tech` must not render the counter while the global script count remains one.
- Music verification now records iframe count/src/autoplay/allow/fallback href. Collapsed state requires zero iframes; expanded state requires exactly one NetEase iframe with `type=2`, `id=2707332868`, `auto=0`, `height=66`, fallback `https://music.163.com/song?id=2707332868`, and no autoplay attribute/allow permission.
- Visual verification stubs external hosts (`identity.netlify.com`, `events.vercount.one`, `music.163.com`) with empty local responses inside Playwright contexts so DOM contracts are tested without waiting on live third-party networks or cross-origin iframe internals.
- Updated stale visual fixtures encountered during the run: article navigation expectations now match current content ordering, `/sections/tech` expects its tech subtitle, empty `links` section no longer requires a CTA, and greeting panel assertions derive IDs from `src/content/greeting.yaml`.
- Verification passed with `VISUAL_BASE_URL=http://127.0.0.1:5188/ npm run verify:visual` against a strict local Vite dev server on port 5188; evidence includes `visitCounterChecks` and `musicChecks` in `.sisyphus/evidence/visual-verification.json`.
