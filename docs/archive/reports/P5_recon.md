# P5 recon

P4 closed: pack 67, hash `b1505f61e3f43a5eb45b3c3ba8dd91e25267421bfa60a58a9a3bffad9af09093`, lint 324/0, constructions 238. `launch.deployed` all empty. `rules_version` 0.20.0. Watermark 19. P3 closed (pack 66).

## Tree

`time.params.city_day_real_hours` = 25; `tick_length_city_hours` = 1; `ticks_per_city_day` derived 24. Farm window = `payroll_daily_divisor` = 14 (`L92`). Prize period = season / 3 = 30 (`L282`). Period settle at city_day 31 hour 6; season settle at city_day 91 hour 6.

`arch.rehearsal` absent. `time_rehearsal.construction_tests` empty; `tests` omit L325. `p0.test.ts` still expects empty P5 probes.

Engine tick is sequential and pure. `sim.run_season` already loops 90 city days; it is the oracle of expectations, not the step gate (`A-P-5`). Acceleration must be tick-call cadence only (`D-P-9`, `A-P-4`).

RPC silence / JSON-number lie / voucher nonce / `submitMinuteRoot` fail-open already exist in chainport. LLM template on provider fail exists (`llm_refusal_falls_back_to_template`). Do not reuse `rpc_silence_is_open` or `prize_period_divides_season` as `it()` names (`L268`).

No Docker (`R-P-6`). PLAN §9 RPC/IPFS providers still owner. Three wall-clock testnet days cannot be waited here.

## Risks

Compressing `city_day_real_hours` rehearses another economy (`A-P-4`). Counting local-chain run A as run B (`D-P-9`). Hop retry keyed by attempt ordinal (`A-P-15`). Thin testnet pool (accepted). Calendar 3-day testnet is owner, not a pack defect (`R-P-7`).
