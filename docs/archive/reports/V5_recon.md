# V5 recon — `render_light`

`launch.deployed` empty. P7 not started. V4 closed: pack 74, lint 343/0, round 1445 / 200 / 910. Atlas 179 frames, magenta 0, `city_glow.png` present (`glow_building_count` 27).

## Tree

- Phases already in `generated.placement.phases` from `time.json` (L179): dawn 6, day 8, dusk 20, night 22. `lanterns_on_phases` = dawn/dusk/night. Day `lights=0`.
- TZ_RENDER §6.2–6.4 still describes palette LUT + snap. **D-V-4 wins:** color grade (tint mix), not `lut_phases` / `lut_snap`. GPU frame goldens stay V12 (R-V-25). Proof: pure `gradeRgb` + glowGain=0 at day.
- `packages/render` has no `light.ts`. `pixi.ts` paints cubes/sprites, no filter.
- `cityClockParts` hour = `cityTime % ticksDay`; `ticks_per_city_day` = 24 (tick = 1 city hour). Blend window in minutes must be packed; hour-resolution ramp needs window ≥ 2 hours.

## Numbers to add

`phase_blend_city_minutes`, `city_minutes_per_hour`, `emissive_gain_bps`, `grade_bps`. Tint from `placement.phases`. No hour literals in render src (L335).

## Not this step

V6 camera/click, V7 motion, palette snap, `pixelize.py`, `--jobs 8`, `sim.py`, P7.
