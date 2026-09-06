# V6 final

`render_camera`: зум только из пака, клампы, клик стейк/карточка (D-V-22). `launch.deployed` пуст. Водяной знак 19. `missions_live=0`, краны NFT 0, `companion_revenue_live=0`, `window_a_ratified=1`, `season_prizes_live=1`, `prize_live_min_rules_minor` 19.

Пак **76**, хеш **`08c372ac0744de9565620a82b0a09092aa5695f39593aa1983c4ecfc9f3e4f44`**, 617619 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров, magenta 0, sha `acd419041ca4`. `layout_hash` `63aa7ce8cc09…` (геометрия не сдвинулась).

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 346 / 0 |
| `python content/build.py` | 0; pack 76; 617619 байт; hash `08c372ac…e4f44`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `08c372ac` |
| `python content/attack.py --only L185,L337` | 6/0 пойманы |
| construction три имени V6 | OK на зелёном; красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `c90650be…de4b8c8` (сдвиг с pack_hash, R-V-14); инвентарь homes 25, тот же |
| render `tsc --noEmit` + `vitest run` | tsc 0; vitest 13/0 (3 V3 + 4 V4 + 3 V5 + 3 V6) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 10/0 |
| contentpack `v0.test.ts` | 5/0 |
| eslint `packages/render/src` | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26). `len(CONSTRUCTION)` = **269**.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| колонка HUD 0 | L185 | caught |
| zoom_levels 3/1 | L185 | caught |
| overlay `{ num: 3n, den: 2n }` | L337 | caught |
| overlay без `clampCamera` | L337 | caught |
| `camera_bounds` min/max swap | L337 | caught |
| `pan_deadzone_px=0` | L337 | caught |
| pinch delta < `pinch_step_bps` | не шаг | vitest `pinchZoomDir` → 0 |
| клик HUD-панели | не сцена (A-V-11) | панели — поздние sibling поверх canvas |
| `LiveRoot` extra workshop / q:0 | нет | снято |
| вода / пустой объект | `""` | vitest |
| маяк закрыт / workshop | `districts` / `building_card` | vitest; не `commit:build` |
| `--jobs 8` в `gate_cmd` этапа | нет (A-V-26) | нет |
| `Date.now` / `Math.random` / engine в render | нет | нет |
| `city_id` задаёт геометрию | нет | `layout_hash` прежний |

Выстояло (не закрывается кодом V6): GPU-голден Pixi (**R-V-25**, V12); глиф-шрифт подписей (**R-V-26**); один кадр воды (**R-V-24**); различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations.

## Расхождения

- **R-V-27.** `zoom_step_ms` / `pan_inertia_ms` в паке; рендер щёлкает масштаб и кламп (в `packages/render` нет `Date`). Клиент может позже интерполировать положение через `clock.ts`.
- Открытые районы ещё не в снапшоте: все шесть маяков идут в `districts`, пока поле не появится.
- `build_place` / `commit:build` в паке до **V9**.
- **R-V-25, R-V-26, R-V-24, R-V-14** наследуются.
- Единица `ms` добавлена в `corporator.schema.json` `unit` enum под ключи длительности камеры.

## Готовность

Критерий PLAN_VISUAL §4 V6: масштаб вне `derived.zoom_levels` недостижим (`zoom_levels_from_pack`, L337); на минимуме остров в safe rect (L185); закрытый маяк → `districts`, открытый/прочее здание → `building_card`; захардкоженного `commit:build {q:0,r:0}` в `LiveRoot.tsx` нет. Next: V7 — `render_motion`.
