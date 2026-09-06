# TZ_ART leftover — §4.5 frames and §4.6 overlays

Append-only `*_v2.png` (D-V-12). `launch.deployed` empty. Not P7. Not a new visual stage. `missions_live=0`. Пешеходы §4.7 и глифы §5 — `TZ_ART_final.md`.

Пак **83**, хеш **`ec2ab01630b0ebba4741b31ba2a09c213550061211abe8459cb295c92604c75a`**, 628595 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 217 кадров (было 179), 1 страница, 2929514 B, magenta 0, sha `8d297817f391`. `layout_hash` `63aa7ce8cc09…` (геометрия не ехала).

## Что добавлено

38 новых id в `art/pipeline/assets.json`: `turbine_blade_0..7`, `smoke_03..06`, `flag_0..3`, `billboard_0..3`, `waterfall_0..3`, `shore_wave_0..3`, `vehicle_dir_{e,w,n,s}`, `drone_bob_0..3`, `badge_verified`, `select_ring`.

Провод: `packages/render/src/motion.ts` (кадр из `city_time`, направление машины по знаку шага), `pixiMotion.ts` (смена текстур), `objects.ts` (`select_ring` при выборе; тело `wind_turbine` / `district_billboard` рисует motion). `flag_frames=4` — общий счётчик четырёхкадровых наборов. `smoke_frames=6`, `turbine_frames=8`.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 83; 628595 B; hash `ec2ab016…2604c75a`; круг 1445; вход 200; выход 910 |
| `python content/codegen.py` | 23 artifacts, hash `ec2ab016` |
| `python content/lint.py` | 357 / 0 |
| `python content/attack.py --only L16,L178,L330,L331,L332,L338,L340` | 14/14 пойманы |
| `python content/vectors.py` | 21 файл; sha `6729937f…00c506` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| render `tsc --noEmit` + vitest | tsc 0; vitest 18/0 |
| eslint `packages/render/src` (правленые) | 0 |

`--jobs 8` / `sim.py` не в команде шага. `GATE_VISUAL.md` observe.atlas_bytes обновлён до 2929514 (тот же 1 page, texture_bytes 20971520).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| ghost sprite у city_hall | L16 | caught |
| footprint 5×3 | L178 | caught |
| нет sha атласа / cap−1 / переставлены x/y | L330 | caught (2929514 vs 2929513) |
| непрозрачная магента / key-out off / grade ключ | L331 | caught |
| RGB без alpha / glow=0 у зданий | L332 | caught |
| Math.random в motion / prng_bytes≠8 / speed=0 | L338 | caught |
| `const CHUNK = 8` в render src | L340 | caught |
| `smoke_frames=0` / `flag_frames=0` / `turbine_frames=0` | L338 | caught |
| overlay без `smoke_06` / без `vehicle_dir_*` | L330 shelf | caught |

Выстояло на момент ART_FRAMES: GPU-голден Pixi (**R-V-38**). Пешеходы §4.7, глиф-шрифт §5, R-V-39/40/11 — `TZ_ART_final.md` / `R_V_39.md` / `R_V_40.md` / `R_V_11.md`.

## Расхождения

- **R-V-24** закрыт: 16-way новыми id; вода `frames_x=4`; `crosswalk` один куб (D-V-12).
- **R-V-12** / **R-V-26** закрыты в `TZ_ART_final.md`.

## Незакрытое

`attest_testnet` owner (R-V-5); `pause_ready_delay` owner (P7); `companion_llm_price_snapshot`; `exit_uncovered_at_band_floor`; `bank_withdraw_rate_ceiling_only` T3.
