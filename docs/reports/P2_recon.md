# P2 recon

P1 closed: pack 64, hash `12b0703d…e765`, lint 318/0, vectors `c72de911…06b39` (`R-P-2`). `launch.deployed` all empty. `rules_version` 0.20.0. `prize_live_min_rules_minor` 19.

## Tree

`arch.ci_steps` has five push commands, no `track` field, no nightly rows. `scripts/ci.mjs` emits every row and would run `--jobs 8` if that cmd entered the table. No `.github/workflows` artifact. `construction_ci_step_has_red_run` forbids `attack.py --jobs` on **any** step. `ci_tracks.construction_tests` is empty; `tests` omit `L319`.

D-P-6 step list includes `python content/build.py`; the table does not. `codegen` has `ci_runner` only.

## Risks

`--jobs 8` or `sim.py` on push (`A-P-5`). Nightly without a full attack is a decoration. Hand-edited workflow forks the pack (`D-P-6`). `node scripts/ci.mjs` running nightly cmds on the stage gate. Push job with secrets. `city_day_real_hours` not this stage (`L325`).
