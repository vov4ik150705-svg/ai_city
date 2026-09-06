# Sit + scale — implementation plan

Spec: `docs/reports/2026-09-02-map-sit-scale-design.md`. Owner said ok.

1. `content/column_mask.py` — ray-down predicate (Python oracle).
2. `render.json` ladder + `atlas.py` always `packed_wh` (art/out no longer freezes 56px trees).
3. `world.py` — grove only, no allee, no hedge ring; leftover budget → furniture.
4. `scene.py` clip + `packages/render` Graphics mask from the same keep-tiles.
5. L365/L366/L367 + attacks; docs; pack 103.
6. Gate: lint 365/0, build pack 103, attack --only 12/12, vectors 21, render tsc/vitest 22/0. Closed.
