# R-V-51 final

Pixelize restore overlay (R-V-51…55). `launch.deployed` empty. Economy unchanged: round 1445, entry 200, exit 910, window A `[12275, 15783]`.

## Gate

| command | result |
|---|---|
| `python content/build.py` | pack 98; 661017 bytes; hash `a47f8edbc40e92fceda39c65082deeb89e97ec1d0a928f62d89f8111552c36ba`; atlas 269 / 1193708 B / magenta 0 / `070369c3e4c8` |
| `python content/lint.py` | 362 / 0 |
| `python content/codegen.py` | 23 artifacts, same hash |
| `python content/attack.py --only L273,L332,L358,L359,L363,L195,L268,L319,L331,L340,L09` | 25/0 caught |
| `python content/vectors.py` | 21 files; sha `7ec076a82a60fcd9a01c520abc9a5a16a11ba5c96a579636fbabc3989817e139` (moves with pack_hash, R-V-14); `layout_v1_edge` present; `record_field_homes` 25 fields, same inventory |
| render `tsc -b` + vitest | tsc 0; 22/0 |
| client vitest | 20/0 |
| api vitest | 37/0 |
| eslint / depcruise render | 0 |

`pnpm` not on PATH; gates via `node_modules/.bin`. `sim.py` not a V-step gate.

`python content/attack.py --jobs 8`: 911 attacks; every rule caught; 362 rules covered; construction held 285 probes; elapsed 19.3s; exit 0. Required because `lint.py`/`attack.py` changed.

## Attacks (25 targeted)

Caught: drop `build_place`; RGB atlas; zero glow; no lut/index; ghost/omit screen; wide/stretch sprite; `return padId`; pixi without `groundTopId`; `apply_lot_pad`; contact alpha 0; WORLD.md `99`; `CHUNK=8`; magenta / grade key; `--jobs 8` on push.

## Discrepancies

- R-V-51 pixelize / 53-lock (snap LUT wired; phase still ColorMatrix + `gradeRgb` for L331).
- R-V-52 diamonds + cliff 11 (`cliffId` on shore).
- R-V-53 lot-tile; no plaza pad swap.
- R-V-54 scale not retuned this pass.
- R-V-55 BUILD catalog + `commit:build`.
- R-V-16 limited to `reference_layout` + empty-tile place.
- Hardware vs software GPU pixel (R-V-25/38) still accepted.

## Unclosed

- Player buildings not in snapshot/SceneHost overlay (L236 if a new `state_source`).
- Index-atlas phase LUT not sampled; `lut_phases.png` packed.
- R-V-54 house/person scale.
- `--jobs 8` full attack at close of lint/attack edit.

Next: wire player overlay without a new state_source if GET already carries `city.buildings`; else owner. P7 still blocked until V12 close (already closed historically; this overlay does not start P7).
