# P6 recon

P5 closed: pack 68, hash `1e50885daa47c397d5a3f405a6e1a7ef883b3f4f5057ddd6fa2670f51ce69147`, lint 325/0, constructions 242. `launch.deployed` all empty. `rules_version` 0.20.0. Watermark 19.

## Tree

Ten `arch.metrics` rows exist (L259): service + `threshold_src`, no `observe_src`, no `alert_channel`. `services/api/src/metrics.ts` exports `observedFromThresholds` and `index.ts` re-exports it. `c9.test.ts` wires observed = threshold (`R-P-5`, `A-P-6`). `/ready` has pack_hash / migration / attest_lag, no live observations.

`generated.api.sampler_age_alert_city_hours` = 3; `economy.params.price_staleness_max_city_hours` = 6. Formula `stale // 2`. Not a construction `it()` yet.

`docs/OPS.md` has image / secrets / backup. No incident list. Forbidden copy is L302 on HUD/strings, not OPS.

`ops_watch.construction_tests` empty; `tests` omit L326/L327. `p0.test.ts` still expects empty P6 probes.

P5 numbers for calibration (not guessed): round trip 1445 vs floor 1400; payroll_ratio 10000 vs ticks_day 24; mint 51 vs capital_anchor 2000; fund contribution 4802 vs fund tax 100; sampler alert 3 before decay 6.

## Risks

`observed = threshold` (`A-P-6`). Metric read inside the tick (`A-20`). Alert without addressee. Threshold invented instead of P5. New transport code (`A-P-22`). `observedFromThresholds` left on the production barrel. Forbidden «овнер вывел» / «owner drained» in the runbook.
