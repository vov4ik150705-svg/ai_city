# F7 — archived visual construction tests

Owner decision 2026-09-19 (PLAN_LAUNCH F7): archive these three probes
with the 2D/cell-frame renderer. A GPU island gate is a later task.

Live copies in `packages/render/test/` keep the `it("…")` names so L268
stays a 1:1 map; bodies here are the last full probes.

| probe | source | why it was red |
|---|---|---|
| `ground_matches_python_scene` | `v3.test.ts` | isometric `tileOrigin` / autotile / `tree_*` sprites; pack scene has no `tree_*` (`R-V-99`) |
| `visual_budgets_measured` | `v12.test.ts` | `observeVisualBudgets` on the cell grid vs island `GATE_VISUAL.md` (`sprites=0`) |
| `visual3_budgets_measured` | `v37.test.ts` | `observeIslandBudgets` vs stale `bundle_bytes` in `GATE_VISUAL.md` |
