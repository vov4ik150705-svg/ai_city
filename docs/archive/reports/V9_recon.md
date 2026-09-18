# V9 recon — `hud_screens`

`launch.deployed` empty. P7 not started. V8 closed: pack 78, lint 352/0, round 1445 / 200 / 910.

## Tree

- Fifteen `kind=screen` rows already live in `screens.json` with empty/loading. Eleven HUD panels exist as V8 components. No `apps/client/src/hud/screens/`. Overlay route is `data-scene-route` only; BottomMenu has no `onClick`.
- `build_place` still `commit:build`. L273 and attacks `a_l146`/`a_l150`/`a_l152`/`a_l273` pin that action. `services/api/src/commit.ts` still has `applyBuild`. Protocol `commandRoutes` still lists `/command/build`.
- `hud_screens` roadmap stub: gate without L358, `construction_tests` empty. L358 absent from `RULES`.

## This step
