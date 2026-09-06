# V9 recon — `hud_screens`

`launch.deployed` empty. P7 not started. V8 closed: pack 78, lint 352/0, round 1445 / 200 / 910.

## Tree

- Fifteen `kind=screen` rows already live in `screens.json` with empty/loading. Eleven HUD panels exist as V8 components. No `apps/client/src/hud/screens/`. Overlay route is `data-scene-route` only; BottomMenu has no `onClick`.
- `build_place` still `commit:build`. L273 and attacks `a_l146`/`a_l150`/`a_l152`/`a_l273` pin that action. `services/api/src/commit.ts` still has `applyBuild`. Protocol `commandRoutes` still lists `/command/build`.
- `hud_screens` roadmap stub: gate without L358, `construction_tests` empty. L358 absent from `RULES`.
- Companion screen is V10; missions stay stub (`commit:noop`).

## This step

Fifteen screen components + registry (`L358`); Empty/Loading/Refusal; overlay navigation; six-step onboarding from pack flows; bank withdraw shows `WALLET_NOT_CONNECTED` before funds. Remove `build_place`/`commit:build`; retire `BUILD_TILE_ILLEGAL` / `NO_FREE_BUILD_SLOT` for L149. Pack 79. No `--jobs 8`, no `sim.py`, no P7. Companion screen stays out.
