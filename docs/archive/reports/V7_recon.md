# V7 recon — `render_motion`

`launch.deployed` empty. P7 not started. V6 closed: pack 76, lint 346/0, round 1445 / 200 / 910.

## Tree

- `generated.placement.vehicles` / `drones` exist (L190). Scene paints them as static `objects`. Layout seed is `placement.demo_seed`.
- `packages/render` has `water.ts` phase from `city_time`; no `motion.ts` / `fx.ts`. `setCityTime` only pulses badges and the day grade.
- Atlas: `vehicle`, `drone`, `smoke`/`smoke_02`, `wind_turbine`, `banner`, `district_billboard`, `waterfall`. No `turbine_blade_*`, `flag_*`, or `bird_*` frames (D-V-12: do not invent PNGs).
- `settings_rows.tick_animation` is live `client_only`. Snapshot log has keys, not per-building `output`.
- Roadmap `render_motion` is still a stub: `gate_cmd` only L190, `construction_tests` empty.

## This step

City-time poses for vehicles/drones/atlas cycles/FX; L338, L357; construction `motion_is_pure_of_city_time`, `no_wall_clock_in_render`, `background_units_hold_no_lot`. Pack 77. Do not change `layout_hash`. `missions_live` stays 0. No `--jobs 8`, no `sim.py`, no P7.
