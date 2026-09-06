# V7 final

`render_motion`: город живёт от `city_time` (машины, дроны, дым, FX без выдуманных чисел). `launch.deployed` пуст. Водяной знак 19. `missions_live=0`, краны NFT 0, `companion_revenue_live=0`, `window_a_ratified=1`, `season_prizes_live=1`, `prize_live_min_rules_minor` 19.

Пак **77**, хеш **`68432d1253f85deeacb0f24f0d593b40f704352bf9f45b10cfdd1a40526918b3`**, 620605 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров, magenta 0, sha `acd419041ca4`. `layout_hash` `63aa7ce8cc09…` (геометрия не сдвинулась).

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 348 / 0 |
| `python content/build.py` | 0; pack 77; 620605 байт; hash `68432d12…6918b3`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `68432d12` |
| `python content/attack.py --only L190,L338,L357` | 7/0 пойманы |
| construction три имени V7 | OK на зелёном (None); красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `0f256c8a…f99389` (сдвиг с pack_hash, R-V-14); инвентарь homes 25, тот же |
| render `tsc --noEmit` + `vitest run` | tsc 0; vitest 16/0 (3 V3 + 4 V4 + 3 V5 + 3 V6 + 3 V7) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 10/0 (после фикса `loadBlocks` от `x0`/`y0`) |
| contentpack `v0.test.ts` | 5/0 |
| eslint `packages/render/src` | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26). `len(CONSTRUCTION)` = **272**.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| overlay `Math.random` в motion | L338 | caught |
| `world_prng_bytes=4` | L338 | caught |
| `vehicle_tiles_per_city_minute=0` | L338 | caught |
| overlay `amount: 62n` в fx | L357 | caught |
| клиент `amount = snap.capital` | L357 | caught |
| `fx_popup_ms=0` | L357 | caught |
| L190 modifier (харнесс `--only`) | L190 | caught |
| `west`/`north` в pack blocks | нет полей → `API_MALFORMED` | закрыто: периметр из `x0`/`y0` + период |
| `Date`/`Math.random`/`deltaTime` в render src | нет | греп пуст |
| `--jobs 8` в `gate_cmd` этапа | нет (A-V-26) | нет |
| engine import в render | нет | нет |
| `city_id` задаёт геометрию | нет | `layout_hash` прежний; сид движения = `demo_seed` |
| машина съезжает с дороги | нет | vitest `isRoadCell` на t=12 и t=24 |

Выстояло (не закрывается кодом V7): GPU-голден Pixi (**R-V-25**, V12); глиф-шрифт подписей (**R-V-26**); один кадр воды (**R-V-24**); различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations.

## Расхождения

- **R-V-28.** Раскладка лотов/декора — `draw_below`; поворот машины — `world_prng % n` как TZ_RENDER §8.
- **R-V-29.** `city_time` — целые часы города: `frac` внутри тайла 0; `fx_popup_ms` упакован, длительность позы 1 тик; `popups: []` до поля снимка.
- Нет `turbine_blade_*` / `flag_*` / `bird_*` PNG (D-V-12 / R-V-24).
- Открытые районы ещё не в снапшоте. `build_place` до **V9**.
- **R-V-25, R-V-26, R-V-24, R-V-14, R-V-27** наследуются.

## Готовность

Критерий PLAN_VISUAL §4 V7: два прогона с одним `city_time` дают ту же позу (vitest); греп `Math.random|Date.|performance.` по `packages/render/src` пуст; машина остаётся на дорожном тайле. Next: V8 — `hud_shell`.
