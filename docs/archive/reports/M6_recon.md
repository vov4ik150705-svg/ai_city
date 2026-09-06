# M6 recon

`launch.deployed` all empty. M5 closed pack 51, hash `832630c4…d7c9`, lint 302/0. `rules_version` stays 0.19.0.

Read through §15: `D-M-15` / `R-M-16` / `L302` overlap §4 M6. Seven assets and `PRIZE_POOL_DRAINED` as owner-withdraw are not in force. Monthly basket is six stocks. Leaderboard shows empty pool / uncovered claim. No drain or pause buttons. No «залочено навсегда».

Tree now: city Treasury is named in HUD.md §4.1 / §5.1 as Capital but `overview` and `city_card` panels have no treasury field. Protocol pots have no fields. `leaderboard_table` is rank only. `PRIZE_POOL_EMPTY` and `PRIZE_CLAIM_UNCOVERED` are already on `leaderboard_rank.state_codes`. `claim_prize` is live; API `applyLive` does not yet return per-asset rows (demo still 409 `DEMO_NO_PRIZE`). `state_sources` 17; construction probe hardcodes 17. Channels 5. No new channel.

Construction names from §4, sense from §15: `leaderboard_shows_basket_composition`, `drain_notice_visible_on_leaderboard`, `claim_returns_every_asset`.

Gate: lint, client gate, api test, attack L155/L162/L165/L302, full gate. `sim.py` not required. Art untouched. `launchToken` forbidden.
