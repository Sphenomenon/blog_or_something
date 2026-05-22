## 2026-05-21T08:39:00Z Task: bootstrap
- Execute plan `visual-refinement.md` from first unchecked task.
- Keep implementation CSS-first and structure-light.
- Verify each task with scriptable checks and build.

## 2026-05-22T00:00:00Z Task: section scope fidelity fix
- Implement the section CTA as an inline expand/collapse toggle inside `SectionView.jsx` rather than delegating to the global archive route, because the requirement is to show all posts in the current section on the same page.
- Use `aria-expanded` and the existing section CTA test id as the stable regression contract, since they are deterministic and reflect the actual UI state.

## 2026-05-22T00:00:00Z Task: archive background leak selector fix
- Use `.page-panel--archive` as the primary archive root selector in `scripts/visual-core.mjs` because it exists in the rendered ArchiveView and avoids the fake `archive-view` test id.
- Fail fast when the archive root is missing before evaluating background leakage, so the verifier reports a real selector problem instead of a false-positive background comparison.
