# M6 code

Pack **52**, `rules_version` 0.19.0 unchanged. Key `prize_surface`. `owner_drain` not added. Art untouched. `launch.deployed` empty.

## Pack / HUD data

`screens.state_sources` +4 on existing channels: `seasons.prize_basket` → aggregate; `wallet.protocol_*` → price. Fields: city Treasury = `tick.capital`; protocol plaque on `city_card`; leaderboard basket + derived `prize_period_real_hours`. Strings `UI_TREASURY` / `UI_PROTOCOL` / kettle and studio labels. L302 in `lint.py`. Attack probes: drain button, forever copy, Treasury→vault, hide UNCOVERED.

## Runtime

Client `buildHud` / `App`: Treasury from Capital; protocol plaque; basket rows; period hours; prize notice from envelope `seasons.prize_basket.notice`. `snapshotFromEnvelope` reads protocol pots and basket. API `projectState` fills those sections. `claimEveryAsset` already in engine; `applyLive` `claim_prize` returns one row per `prize_assets`. Demo still 409 `DEMO_NO_PRIZE`.

## Tests

`apps/client/test/m6.test.ts` — names equal `construction_tests`: `leaderboard_shows_basket_composition`, `drain_notice_visible_on_leaderboard`, `claim_returns_every_asset`.
