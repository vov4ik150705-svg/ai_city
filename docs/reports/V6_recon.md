# V6 recon — `render_camera`

`launch.deployed` empty. P7 not started. V5 closed: pack 75, lint 345/0, round 1445 / 200 / 910.

## Tree

- Zoom already packed (`L185`): levels `1/8 … 2/1`, bounds `{min:-2, max:64}`, `zone_centroids` for six districts + core.
- `packages/render` has no `camera.ts`. `pixi.ts` scales the world, no pan, no hit-test.
- `LiveRoot.tsx` still special-cases `effect === "build"` with `{ tile: { q: 0n, r: 0n }, building_id: "workshop" }` — that is the spawn TZ names. `screens.json` `build_place` stays until V9.
- Beacons: `ai_research_center`, `energy_plant`, `logistics_hub`, `flagship_store`, `cloud_campus`, `finance_tower`. Snapshot has no opened-districts field yet: closed = not in `opened`.

## Not this step

V7 motion, V8 HUD density, V9 `build_place` removal, palette snap, `--jobs 8`, `sim.py`, P7.
