## Task 1 learnings

- The canonical blog ordering now lives in `src/data/content.js`, which keeps page consumers aligned on one deterministic model.
- Section representative selection is a simple slice over the globally sorted post list, so it stays stable without adding featured/frontmatter fields.
- Canonical article comment paths should be normalized from the raw pathname only; query strings and hashes must be stripped before any downstream comment integration.

- Task 2 section entrance verification is more reliable when the greeting gate is validated from a dedicated fresh `/` context, so previous route state cannot leak into onboarding assertions.
- The section entrance layout can reuse the canonical sorted post slice helper and still keep the CTA stable for every section route.

## Task 3 learnings

- `ArticleView.jsx` already had the correct article-only render boundaries, so the safest change was to keep Waline scoped to the existing article comments section and tighten verification around it.
- The deterministic article order from `getArticleNeighbors` can be exercised cleanly with the actual newest, middle, and oldest posts; that makes boundary assertions much clearer than testing a single article route.
- Canonical comment paths and `login: 'force'` fit naturally into the current `useEffect` lifecycle as long as the Waline instance is destroyed before re-initialization on route changes.

## Task 4 learnings

- The archive page should treat `getArchiveYears()` as the single source of truth for both default selection and pager bounds; that keeps empty years out automatically and avoids maintaining a second sort model in the component.
- A year-only archive pager is easiest to verify when the page exposes stable selectors for the active year, pager buttons, and the rendered post list for that year.
- Visual verification is more durable when the archive boundary check walks the available years generically instead of hardcoding the current dataset's newest and oldest years.

## Task 5 learnings

- Greeting panel reveals need a short-lived `entering` state in addition to `active` so the newly selected panel can animate in without breaking the stacked history semantics.
- The greeting wheel/next interaction is easiest to verify by watching `data-state` transitions on the newly revealed panel rather than relying on `display` changes, because the old panels must remain in the DOM.
- Removing the greeting image fallback from section routes eliminates the route-transition flash without affecting the section-specific background layers that the verifier already expects.

## Task 6 learnings

- Consolidated regression evidence is most reliable when each route verification payload returns a uniform shape (including comment-scope state), so group-level pass/fail logic does not depend on branch-specific omissions.
- Adding explicit console warning/error capture to Playwright page contexts closes the last verification gap for “overflow/focus/console cleanliness” and makes the evidence machine-verifiable.
- Task-level artifacts are easiest to keep deterministic when generated inside the same verification run (`task-6-full-regression.json` + mobile screenshot) from the final verified state.
