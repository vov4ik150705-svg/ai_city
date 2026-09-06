# T10 — разведка и сводка

Задача: генератор города и арт-дирекшн. Канон вида — `docs/WORLD.md`. ТЗ — `docs/reports/T10_tz.md`. Этот файл — фактический прогон исполнителя, не пересказ.

## 1. Что нашёл в каноне и коде

`DESIGN.md` §3 (сутки города, банк 08–20, пересчёт efficiency в 06:00), §4 (шесть районов, синергии, `playable_v1`), §7 (база / маяки / синергии / заполнитель; уровень — оверлей), §8 (Happiness в том числе от парков), §9 (сид → берег и сетка, зоны заранее, игрок ставит базу/маяки/синергии, заполнитель сам). `HUD.md` §2 (колонки 260, топбар 56, 16:9), §5.4 (клик зоны ведёт камеру), §6.1 (бейджи на сцене), §7 (токены рамп), §8 (частоты). `BRIEF.md` §6 T10 — инвентарь в `content/fixtures/brief_t10_world.json`.

Закрыты T0–T9. Пак: `content/build.py`, гейт L1–L168 до этого шага, `attack.py`, `sim.py`/`tick.py`, `builds.py`. Арт: 14 спрайтов в `assets.json`. Ручной `art/pipeline/scene.json` снят; сцена — артефакт `art/out/scene.json`.

`tick.py` даёт `sha256(f"{city_id}:{tick_index}:{agent_id}")[:8]`. T10 переиспользует тот же примитив: `world_prng` над `f"{city_id}:layout:{stream}:{index}"`. Выборки — rejection sampling, без `% n`.

## 2. Числа и откуда

Авторские (`placement.json`): `road_period_tiles=8` (футпринт 4 + зазор 1×2 → сторона 7; P=7 даёт `courtyard_side == lot_ring_depth`, двор не читается как парк; P=9 двор шире кольца), `building_gap_tiles=1`, `lot_min_side_tiles=1`, `blocks_reserve=0`, `water_margin_tiles=2`, `shore_jitter_tiles=1`, `mini_island_share_bps=40`, `zone_anchor_ring_step=3`, `filler_slots_per_kind=2`, `district_fill_step_bps=2500`, `decor_target_share_bps=1200`, `decor_share_tolerance_bps=400`, `vehicles_per_100_road_tiles=8`, `drones_per_100_blocks=25`, `camera_edge_margin_tiles=2`, `zoom_max_scale=2`, `demo_seed=1`. Фазы: tint authored; часы derived из `time.json` (dawn 6, day 8, dusk 20, night 22, сумма 24).

Выведенные (`python content/build.py`, пак 21): grid `63`, R `29`, lots `150`, lots_per_block `6`, lots_needed `34`, blocks `25`, decor `1411` bps (окно 1200±400), `lots_per_zone` по 24 на район и 6 в ядре, `filler_occupied_total=15`, `park_slots=1+playable_v1=4`, `plaza_slots=3`, lanterns `10`, trees `305`, vehicles `50`, drones `6`, mini-islands `5` (посадка = счётчик), land `2629`, water `1340`, roads `628`. `layout_hash` демо-сида `0a10a886f3348f2d5ce534bb8e18d0fd3f5ae95511972c79968ed657ca3dc402`. Пак `78d28465629df668e43ae670225f56ce67cbb059222c9b9f3b6dfd49d06cf1ee` (396128 байт). `rules_version` `0.14.0`. `pack_version` **21**.

`min_road_period` derived = 7; авторский P = 8 проходит L169 и держит двор шире кольца.

`zone_anchor_ring_step=3`: диск `1+2·3·4=25` кварталов. Ring 2 не режется на шесть ортогонально связных равных клиньев.

HUD-высоты полос в каноне нет → `pending.json` `hud_stock_strip_height_px`, `hud_bottom_menu_height_px` (T12). Safe rect считает их нулём: `504×520` px при `aspect_w × tile_w` и топбаре 56. Iso bbox `4032×2016`, `zoom_min=1/8`.

## 3. Развилки

1. **Счётчики vs сид.** ТЗ: многосточниковый BFS с поворотом кольца. Поворот якорей менял именные `lots_per_zone` (клинья разного размера) → `filler_occupied_total` ехал с сидом → L175. Решение: полярная сортировка (векторное произведение, без atan2), равные клинья, сид крутит только метки районов (`draw_below(district_count)`). Остаток — каноническому первому району. `R-T10-6`.
2. **Happiness и парки.** Канон §8. Мост `park_slots` из `playable_v1`, не из плана. Формула — T11. `R-T10-1`.
3. **P=8** прошёл по вместимости (150 лотов, 25 кварталов). Why не переписывался под другое P.
4. **Декор** — бюджет, не драйвер лотов. Генератор не красит лоты, чтобы попасть в 1200 bps. Деревья добирают остаток бюджета по свободной суше.
5. **Зум** — степени двойки; `zoom_min` — наибольший масштаб, при котором iso-bbox влезает в safe rect из фикстуры HUD.

## 4. Дыры, которые закрыл этот прогон

Пересборка не считала черновик принятым. На живом коде нашлось:

1. **`world.load_assets_pending` возвращал `[]`.** Выражение `blob.get("assets") or blob if isinstance(blob, list) else []` из-за приоритета `if-else` над `or` даёт пустой список на dict-файле. Генератор подставлял футпринт `(2,2)` вместо спеки. `substation` в эталоне был 2×2 при спеке 1×1. Атака L178 попадала в «нет спеки у agent_hub», а не в «длинная сторона > 4». Исправлено явным разбором list/dict. После правки L178 ловит `workshop footprint 5x3 long side > 4`. Пак переиздан: version 21, хеш сменился; `layout_hash` сцены тот же (pending-спрайты на сцену не попадают).
2. **L175 ловил ярлык `_attack_seed_lots`, а не сравнение счётчиков.** Ярлык снят. Атака теперь роняет «counters for seed 1 differ from seed 0»: генератор реально добавляет лоты от сида, восемь сидов расходятся.
3. **L188 сверял только формульный счётчик, не посадку и не воду.** Теперь `len(placed) == want` и тайл сцены `~`. Конструкционная проба «мини-острова: число = посадка, все в воде».
4. **L191 защищал только bbox квартала.** Добавлены все тайлы суши на линии сетки: джиттер не маскируется дорогой вне ромба застройки.

Ранее в дереве уже было: снесён leftover quota-BFS; ручной `art/pipeline/scene.json` удалён; `IDLE_NO_AGENT` выведен на сцену.

## 5. Атаки T10 (правила)

Каждая — отдельный `rule()` и строка в `ATTACKS`. Фактический текст поимки после правок:

| ID | Вход | Что поймал |
|---|---|---|
| L169 | `road_period_tiles=4` | период < `min_road_period` |
| L170 | лот 1×1 в `(cx,cy)` квартала | нет ортогонального соседа-дороги |
| L171 | два северных лота вплотную | зазор 0 |
| L172 | лот на (0,0) | вне диска суши |
| L173 | 4-wide на востоке | `w > lot_ring_depth` |
| L174 | `decor_target_share_bps=9000` | realized 4438 вне 9000±400; лоты не закрашены |
| L175 | `_attack_seed_lots` | счётчики seed 1 ≠ seed 0 |
| L176 | compute → energy | зона без кварталов |
| L177 | маяк в core | не своя зона |
| L178 | pending workshop 5×3 | long side > 4 (и depth > ring) |
| L179 | close < open; `dawn_hour` param | немонотонность; час хранится |
| L180 | `sprite_id` от уровня | новый спрайт |
| L181 | снят `state_source` у `IDLE_NO_ENERGY` | бейдж без источника |
| L182 | `park_slots` от сида; `tick_inputs=["lots"]` | мост от сида / вход тика |
| L183 | поддельный `layout_hash` | хеш ≠ sha256(scene) |
| L184 | `_pipeline_scene_exists` | ручная сцена |
| L185 | колонка 0; зум 3/1 | не HUD; не степень двойки |
| L186 | `water_margin_tiles=0` | нет кольца |
| L187 | лот на shore | берег застроен |
| L188 | два mini в одной клетке | дистанция 0 / посадка ≠ счётчик |
| L189 | фонари без night | свет не выведен |
| L190 | vehicle + `modifier_key` | фон ссылается на ключ |
| L191 | jittered protected tile | джиттер съел квартал |
| L192 | `server_annex` в чужой зоне | чужой район |
| L193 | fill не монотонен | доля по тиру |
| L194 | WORLD.md без секции BRIEF | покрытие |
| L195 | литерал `99` вне whitelist | числа не в паке |

Конструкционные T10:

1. Восемь сидов: `counters` побайтово равны, `layout_hash` различается, два прогона сида 1 равны.
2. `shore_jitter=R` не трогает protected.
3. Декор не на лотах, доля в бюджете.
4. Ноль открытых районов: `park_slots=1`.
5. `district_fill_step_bps=10000` не > 10000 на тире.
6. Нет `pack.json` → `layout.py` exit 1 с текстом.
7. Пак без `generated.placement.scene` → exit 1.
8. Все шесть районов, fill 10000 bps: `filler_occupied_total` пакетный.
9. `zoom_min` вмещает остров.
10. `layout_hash = sha256(canonical(scene))`.
11. Мини-острова: посадка = счётчик, все на `~`.

Границы: R минимальный при диске ring 3; зона из четырёх кварталов (равные клинья, не единица); джиттер не ест квартал; fill 0 при закрытом районе; 10000 bps на потолке; `zoom_min` подгоняется под bbox.

Внешние отказы: нет `pack.json` / нет `generated.placement.scene` — `layout.py` exit 1. Нет `art/out/scene.json` — `scene.py` SystemExit. Старый пак без `placement` — L09/схема.

Итог харнесса — §8 (фактический прогон, не оценка).

## 6. Расхождения

- **R-T10-1** Happiness ← `park_slots`, не план. Формула — T11.
- **R-T10-2** высоты полос HUD = pending T12; viewport = `aspect_w × tile_w`, не выдуманный 1920.
- **R-T10-3** `DESIGN.md` §1 и §9.1: N → `road_period_tiles`.
- **R-T10-4** `HUD.md` §6.1 → `WORLD.md`.
- **R-T10-5** полный L1-диск, не только кольцо `1+4*ring`.
- **R-T10-6** полярные клинья вместо BFS с поворотом якорей.

## 7. Версии

`rules_version` **0.14.0** — формула генератора мира (major по `docs/CONTENT.md` §6). `pack_version` **21**: повторная публикация после починки загрузчика `assets_pending.json` (хеш `78d284…`; 20 был пак с футпринтам заполнителя 2×2 вместо спеки). Сцена `layout_hash` не сдвинулась.

## 8. Гейт

Команды исполнителя, числа с консоли, не из прозы:

```
python content/build.py
python content/lint.py
python content/attack.py
python art/pipeline/layout.py
python art/pipeline/layout.py
python content/sim.py
python content/builds.py
```

- **build.py:** 396128 canonical bytes, hash `78d28465629df668e43ae670225f56ce67cbb059222c9b9f3b6dfd49d06cf1ee`, rules 0.14.0, pack_version 21, T10 world grid 63 R 29 lots 150 decor 1411 bps, CANON MISMATCH нет.
- **lint.py:** **195** правил, **0** ошибок, **0** предупреждений, PENDING 33 (19 art T10 + прочие владельцы T2/T3/T11/T12).
- **layout.py ×2:** оба раза `layout.sha256` = `0a10a886f3348f2d5ce534bb8e18d0fd3f5ae95511972c79968ed657ca3dc402` (63 ряда, 329 объектов). Совпадает с `generated.placement.layout_hash`. Ручного `art/pipeline/scene.json` нет.
- **attack.py:** **367** (266 ATTACKS + 5 DIRECT + 96 CONSTRUCTION), **195** правил покрыто, **0** UNATTACKED, **0** SURVIVED, **0** CRASHES. L178 → `workshop footprint 5x3 long side > 4`. L175 → `counters for seed 1 differ from seed 0`. Все 11 конструкционных проб T10 держатся.
- **sim.py:** 10 required scenarios, SIM.md hash `cdf8d7ea2cd9af7cb340757d9b29d415c9f459a03d580ff7d81e6517a5c5e10d` (сдвинулся с паком 21: хеш пака входит во вход тика).
- **builds.py:** dominating 0 dead 0 mandatory 0, hash `37042dae9392793a2f9488131ae73a98ad08e5556d04d730019c91e56351c047`.

Арт TODO: 19 спек в `assets_pending.json`, owner T10. `build_tile_refusal` остаётся pending (строки BUILD).

Приёмка: 0 ошибок lint, правил ≥ 193, 0 UNATTACKED, layout.sha256 одинаковый на двух прогонах, нет ручных координат, числа WORLD.md из пака/фикстур, R-T10-* названы.
