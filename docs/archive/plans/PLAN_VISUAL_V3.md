# PLAN_VISUAL_V3 — архив клеточного кадра V3-0…V3-7

**Закрыто.** Не исполнять как остров. Живая работа — `docs/reports/PLAN_ISLAND.md` (`R-V-96`).
Паспорт закрытия — `docs/reports/V3-7_final.md`. Файл не удаляется: ключи `visual3_*`, D-V3, L370–L384.

Предшественник V0–V12 закрыт: `docs/reports/V12_final.md`. `PLAN_VISUAL.md` не исполняется.

Автор плана — владелец. Числа отсюда в код не копируются: код берёт пак. Агент, которому дали «остров», этот файл не исполняет.

---

## §0. Предусловие — командой, не памятью

```
python -c "import json;d=json.load(open('content/params/launch.json',encoding='utf-8'));print(d['deployed'])"
```

Все пять полей `deployed` пусты. `chain.deployed` в паке нет. Ставка не снята.
`visual3_close` закрыт (`V3-7_final.md`). `P7` (`launchToken`, мейннет) **не начинается** без владельца.
Живой кадр между этим архивом и `P7` — `PLAN_ISLAND.md`, не повтор этапов ниже.

Не двигаются: Rev-A, круг / вход / выход из пака, `layout_version` 1, `tick_inputs` пуст,
общий остров (`R-V-15`), HUD HTML/CSS, компаньон без доли, `missions_live=0`, краны NFT 0.

---

## §1. Цель и границы

**Цель (архив).** Тот же экономический остров в браузере как вытяжка легенды пака. Живой 3D-остров после закрытия этой фазы — `PLAN_ISLAND.md`, не этот §1.

**Не-цель.** Форма денег, байты записи, миссии, NFT-доля, `launchToken`, физика,
полёт от первого лица, спавн модели через `commit:build`, per-user остров.

Pixi V12 остаётся в репозитории как архив. Software-ромбы не выдаются за кадр v3.
`RENDER_NO_GPU` остаётся кодом отказа.

---

## §2. Сеттинг (канон мира, не механика)

Corporator — одна остров-корпорация. Игрок — основатель. Шесть клиньев — живые отрасли
реальных бумаг (NVDA compute, TSLA energy, AMZN logistics, AAPL consumer, MSFT automation,
COIN finance). Ядро — гражданский квартал (мэрия, завод, хаб, подстанция, банк, биржа).

Вид: стилизованная cyberpunk-диорама, не реализм и не пиксель. Ночь и неон — родная фаза;
день не выключает город, но гасит вывески. Здания одного языка (игрушечный объём, неон
в окнах) и **разного материала**. Агенты — сотрудники на сменах, не толпа RPG.

Камера: высокая орбита вокруг острова, ограниченный наклон, без полёта от первого лица
и без физики. Стиль сырья v3 — `assets/_STYLE_V3.txt`. Pixelize-замок V12 —
`assets/_STYLE_LOCK.txt`, архив идентичности, не закон кадра.

---

## §3. Решения D-V3

| id | решение |
|---|---|
| D-V3-1 | `mainnet_launch` после `visual3_close`, не после `visual_close` |
| D-V3-2 | Сцена из пака (`generated.placement.scene`). 3D — XZ-вытяжка той же легенды |
| D-V3-3 | Движок кадра — Three.js в `packages/render`. Pixi — архив V12, не удалять |
| D-V3-4 | Cyberpunk-диорама: общий язык, уникальный материал. NVIDIA-кирпич не на все дома |
| D-V3-5 | Камера — орбита из пака. Наклон и дистанция — ключи `orbit_*` в `render.params` (`L373`). `derived.zoom_levels` — iso-зум V12, не дистанция орбиты. Физики нет. Свет суток — V3-3, не этот id |
| D-V3-6 | Герои — GLB по id `buildings.json`. LOD Quad 30k+5k, текстуры 2K. Декор instancing |
| D-V3-7 | В `packages/render` нет `Date` / `Math.random`. Часы — `apps/client/src/clock.ts` |
| D-V3-8 | Литералы ≥2 в `packages/render/src` запрещены (`L340`). Числа — секция `render` |
| D-V3-9 | `RENDER_NO_GPU` жив. Ромбы Pixi не fallback v3. `visual3_frame_live=1` с V3-1 (`L371`) |
| D-V3-10 | Фазовое правило одно: `code-phase.mdc`. Второго `visual3-phase.mdc` не заводить |
| D-V3-11 | Восемь ключей `visual3_*` между `visual_close` и `mainnet_launch` |
| D-V3-12 | `rules_version` минор 0.22.0 (новая сущность ключей). `prize_live_min_rules_minor` = 19 |
| D-V3-13 | Голдены v3: не побайтовый GPU. Пробы пака: нет фон-ключа, якорь мэрии, вода, ночное окно |
| D-V3-14 | 3D-меши в render разрешены (`R-V-73`). Запрет мешей D-V снят явно |
| D-V3-15 | `commit:build` сажает лот, не спавнит модель. Клик: пустой = каталог, сток = стейк, вода = `BUILD_TILE_ILLEGAL` |
| D-V3-16 | Полный `--jobs 8` только на `visual3_close`, публикации пака, ночном CI и правке `lint.py`/`attack.py` |

---

## §4. Этапы V3-0…V3-7

Порядок строгий. V3-(N+1) не стартует без зелёного гейта V3-N и отчёта `V3-<N>_final.md`.
V3-7 требует V3-1…V3-6 без исключений. Three.js в клиенте — с V3-1, не с V3-0.
Meshy GLB — вход V3-2.

Ключи (ровно восемь, этих имён, никакого четырнадцатого visual-ключа):

`visual3_form`, `visual3_engine`, `visual3_assets`, `visual3_light`,
`visual3_input`, `visual3_units`, `visual3_world`, `visual3_close`.

| этап | ключ | суть | construction_tests на старте |
|---|---|---|---|
| V3-0 | `visual3_form` | пак, roadmap, L370, флаг кадра 0 | `visual3_stage_keys_exist` |
| V3-1 | `visual3_engine` | Three.js остров из легенды, орбита, `RENDER_NO_GPU` | `visual3_island_from_legend`, `visual3_orbit_from_pack`, `visual3_no_gpu_stays` |
| V3-2 | `visual3_assets` | 18 GLB + LOD + посадка на лот | `visual3_heroes_by_building_id`, `visual3_lod_lighter_than_high`, `visual3_plant_on_lot` |
| V3-3 | `visual3_light` | сутки, солнце, emissive. Запечённое солнце на albedo запрещено | `visual3_sun_from_city_time`, `visual3_windows_emissive`, `visual3_no_baked_sun` |
| V3-4 | `visual3_input` | луч в тайл, BUILD, стейк, HUD не дырявый | `visual3_ray_hits_tile`, `visual3_empty_opens_build`, `visual3_hud_not_a_hole` |
| V3-5 | `visual3_units` | агенты: билборды или простые меши | `visual3_walkers_from_pack`, `visual3_units_billboard_or_mesh`, `visual3_units_not_lootable` |
| V3-6 | `visual3_world` | декор, вода, свет без физики | `visual3_water_one_plane`, `visual3_decor_instanced`, `visual3_fill_light_no_physics` |
| V3-7 | `visual3_close` | полный гейт, `GATE_VISUAL.md` заново, pack publish, паспорт в P7 | `visual3_budgets_measured`, `visual3_golden_frames_match` |

Гейт шага (кроме V3-7): `python content/lint.py` && `python content/build.py` &&
`python content/attack.py --only <новые и затронутые L>`. Не дополнять `--jobs 8`.

V3-0 `gate_cmd`: `python content/lint.py && python content/build.py && python content/attack.py --only L370,L348,L353`.
V3-1 `gate_cmd`: `python content/lint.py && python content/build.py && python content/attack.py --only L370,L348,L371,L372,L373`.
V3-2 `gate_cmd`: `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L374,L375`.
V3-3 `gate_cmd`: `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L376,L377`.
V3-4 `gate_cmd`: `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L378,L379`.
V3-5 `gate_cmd`: `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L380,L381`.
V3-6 `gate_cmd`: `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L382,L383`.

**Дисциплина шага — три прохода, не пожелание.** Канон цикла — `.cursor/rules/verification-loop.mdc`. Шаг не закрыт, пока не сделаны:

1. Логика: `python content/lint.py` и `python content/build.py`. Ноль ошибок — числом правил, не словом «проверил». `attack.py --only` на новые и затронутые L. Полный `--jobs 8` не гейт шага (`D-V3-16`).
2. Синтаксис: `ReadLints` на правленные файлы; Python — импорт и прогон; TypeScript — `tsc --noEmit`; JSON — схема.
3. Адверсариальное ревю: для каждого нового правила, формулы, инварианта и пробы — вход, на котором он **должен** упасть, и красный `--only`. Правило, которое никогда не срабатывает, — декорация. Молча выжившая атака в отчёте обязана быть названа.

Слова «должно работать» результатом не считаются. V3-1 не закрывается зелёным L370 без импорта Three.js, орбиты из пака и живого `RENDER_NO_GPU`.

---

## §5. Правила линтера

Свободный id после текущего дерева: **L385**. L328 по-прежнему бронь P7 и отсутствует (R-V-8).
L329–L384 не переименовываются.

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми ключей v3 между `visual_close` и `mainnet_launch`; CT `visual3_engine`/`visual3_assets`/`visual3_light`/`visual3_input`/`visual3_units`/`visual3_world` ≠ пробам своего этапа; nonempty CT у позднего ключа; минор < 22 | снять `visual3_form`; ghost; пустой или чужой CT этапа |
| L371 | `visual3_frame_live` ≠ 1; нет пина/импорта Three.js; Pixi как живой кадр | флаг 0; нет `from "three"`; `SceneHost` → `@corporator/render/pixi` |
| L372 | `gate_cmd` V3-1…V3-6 содержит `--jobs 8`; engine без L371/L373; assets без L374/L375; light без L376/L377; input без L378/L379; units без L380/L381; world без L382/L383 | `--jobs 8`; stub `--only L370` |
| L373 | нет ключей орбиты; min ≥ max; дистанция = числитель `zoom_levels` | копия iso-зума; invert tilt |
| L374 | каталог героев ≠ 18 id `buildings.json`; LOD low не легче high; NVIDIA brick не на research; нет GLB | снят bank; clone sha; lod low≥high; compute_brick на workshop |
| L375 | герои не на лоте `reference_layout`; `commit:build` спавнит меш | нет spanX; `commit:spawn_mesh` |
| L376 | нет направленного солнца от `city_time`; поза не из фаз пака; `setCityTime` глотает часы | invert elevation day≤night; `void cityTime`; снят `sun_elevation_bps` |
| L377 | остров `MeshBasicMaterial`; нет window/sign emissive; baked sun на albedo | MeshBasic; нет `"window"`; `NdotL` в heroes.py |
| L378 | нет луча в тайл сетки; `hitAt` зовёт iso `tileFromWorld`; нет `Raycaster`; нет повторного луча в `waterY` | снят `pickFromRay`; `tileFromWorld` в `three.ts`; снят `waterY` |
| L379 | пустой тайл не открывает BUILD; закрытый сток не стейк; HUD дырявый | kind не `building`; `pointer-events: none` на `.hud-col` |
| L380 | пешеходы не из пака; остаются 1×1 кубами; нет камерной плоскости | снят `plantUnits`; нет `isPackedWalker` в `three.ts`; нет `mesh.lookAt` |
| L381 | поза не от `city_time`; `agent_id` на пешеходе; клик ловит моба | `void cityTime`; поле `agent_id`; `walker_` в `pick.ts` |
| L382 | море не одна плоскость; нет `landCells`/`shoreFoam`; нет `HemisphereLight`; `fill.intensity` мёртв | снят `plantWater`; `islandCells` без skip `~`; нет hemi; hemi без intensity |
| L383 | декор не instanced; машины 1×1; поза не `city_time`; физика | нет `plantDecor`; нет `InstancedMesh`; `cannon` import |
| L384 | `visual3_close` без `--jobs 8`/`sim.py`; `GATE_VISUAL.md` не v3; нет `observeVisual3Budgets` | stub jobs; заголовок V12; снят fn |

Заморозка флага и пустых CT была законом V3-0 (`R-V-78`). V3-1…V3-7 сняли её по этапам. `visual3_close` держит `--jobs 8` и `sim.py` (`L384`). `--jobs 8` не в шаговых `gate_cmd` (`L372`).

---

## §6. Конструкционные пробы

Имя `it()` = имя в `construction_tests`. V3-0: `visual3_stage_keys_exist`.
V3-1: `visual3_island_from_legend`, `visual3_orbit_from_pack`, `visual3_no_gpu_stays`.
V3-2: `visual3_heroes_by_building_id`, `visual3_lod_lighter_than_high`, `visual3_plant_on_lot`.
V3-3: `visual3_sun_from_city_time`, `visual3_windows_emissive`, `visual3_no_baked_sun`.
V3-4: `visual3_ray_hits_tile`, `visual3_empty_opens_build`, `visual3_hud_not_a_hole`.
V3-5: `visual3_walkers_from_pack`, `visual3_units_billboard_or_mesh`, `visual3_units_not_lootable`.
V3-6: `visual3_water_one_plane`, `visual3_decor_instanced`, `visual3_fill_light_no_physics`.
V3-7: `visual3_budgets_measured`, `visual3_golden_frames_match`.
Имена фаз C/L/M/G/P/V0–V12 не переиспользуются.

---

## §7. Атаки A-V3

| id | атака | должен поймать |
|---|---|---|
| A-V3-1 | снять `visual3_form` из order/roadmap | L370 |
| A-V3-2 | вставить ghost между `visual_close` и `mainnet_launch` | L370 |
| A-V3-3 | назвать этап `visual_form` / `mainnet_launch` | L370 |
| A-V3-4 | `visual3_frame_live=0` после монтажа / нет Three.js | L371 |
| A-V3-5 | `--jobs 8` в `gate_cmd` этапа V3-0…V3-6 | L372 на шаговых ключах; L319 ловит только CI-трек |
| A-V3-6 | подменить `scene.json` на диске | L329: клиент читает пак |
| A-V3-7 | `city_id` задаёт геометрию | D-V-21 жив |
| A-V3-8 | `commit:build` красит дорогу | D-V3-15 |
| A-V3-9 | `missions_live=1` попутно | L347 |
| A-V3-10 | мейннет до `visual3_close` | D-V3-1, пустой `launch.deployed` |
| A-V3-11 | `Math.random` в render | L338 |
| A-V3-12 | ромбы Pixi как кадр v3 при `visual3_frame_live=1` | L371 |
| A-V3-13 | закрыть V3-1 зелёным L370 без импорта Three.js | L371 |
| A-V3-14 | `--jobs 8` в `visual3_engine.gate_cmd` | L372 |
| A-V3-15 | пустой или ghost CT у `visual3_engine` | L370 (список проб этапа обязателен) |

Живые атаки V12, которые фаза не снимает: сцена не из `scene.json?url`, фон-ключ,
NFT-краны 0, Verified без корня, hex-адрес, демо без фарма.

---

## §8. Расхождения R-V-73+

Нумерация продолжается после `R-V-72`. Принятые R-V-15…18 и R-V-51…72 не переименовываются.

| id | суть |
|---|---|
| R-V-73 | 3D-меши в `packages/render` разрешены. Запрет мешей фазы V0–V12 снят явно |
| R-V-74 | pixelize / 53 цвета / snap-LUT — архив V12, не закон кадра v3 |
| R-V-75 | игровой кадр — орбита, не закон 2:1-ромба. `tileOrigin` остаётся доказательством V12 |
| R-V-76 | P7 ждёт `visual3_close`, не `visual_close` |
| R-V-77 | дерево Pixi не удаляется; это архив, не второй игровой кадр |
| R-V-78 | `visual3_frame_live=0` на V3-0: пак говорит, что Three.js ещё не кадр |
| R-V-79 | ядро пакует лоты только по футпринтам `base`; `pick_lot` — наименьший подходящий |
| R-V-80 | оверлей студии: пустые `placements`/`props` оставляют генератор; тайлы земли сохранены. Кисть не ТЗ острова v3 |
| R-V-81 | закрыто V3-1: L370 требует CT этапа, не запрещает его; L348 больше не держит `visual3_frame_live` |
| R-V-82 | закрыто V3-1…V3-7: каждый шаговый `gate_cmd` цитирует свои L; `visual3_close` держит `--jobs 8` и `sim.py` (`L384`); CT close = двум пробам V3-7 |
| R-V-83 | закрыто V3-1: `orbit_*` в `render.params`; дистанция не копирует `zoom_levels` (`L373`) |
| R-V-84 | закрыто V3-7: `packages/render` gate = `tsc` + `vitest run test/v31.test.ts` … `test/v37.test.ts`. `GATE_VISUAL.md` — редакция v3 (`sprites=483`); архив V12 под `archive.v12.*`. `art/preview/scene.png` = software `fallback.png` |
| R-V-85 | после V3-0 151/161 packed vehicles на `.`, не на `r`/`c`. `layout_hash` не двигали на V3-7; хозяин — геометрия / P7 |
| R-V-86 | Meshy 30k/5k/2K нет на диске. Генератор пишет уникальные toy-GLB по id зданий. Цели remesh и текстуры — `render.params`; фактические quad counts легче и уникальны. Бинарники Meshy заменяют файлы без смены ключей каталога |
| R-V-87 | плейсхолдер героев светит окнами/вывесками как отдельные примитивы GLB с `emissiveFactor`, не 2K emission map. Рантайм масштабирует `emissiveIntensity` от `city_time`. Карты Meshy подключаются в те же имена `window`/`sign` без смены контракта |
| R-V-88 | HUD-снимок не несёт `districts_opened`; `App` шлёт пустую карту opened, поэтому живой кадр трактует все маяки как закрытые (стейк). Ветка opened в `routeSceneClick` жива и покрыта пробой |
| R-V-89 | пешеходы v3 — камерные плоскости с цветом палитры, не PNG атласа V12 и не GLB-люди (`R-V-74`). Нанятый агент не рисуется мобом на лоте |
| R-V-90 | fill v3 — `HemisphereLight` с `ambient_bps` фазы, поверх `AmbientLight` V3-3. Оба из пака, поэтому ночь всё ещё темнее дня. Meshy-декора нет: toy-боксы + `InstancedMesh`; бинарники заменят геометрию без смены ключей высот |
| R-V-91 | V3-7: `draw_calls_max=4096` с замера графа Three.js (3273), не копия V12 `96`. Профиль desktop = software: на хосте гейта нет WebGL (`R-V-38`). Суша остаётся одним мешем на клетку |
| R-V-96 | Живой 3D-остров = `art/island_v3` + `models/`. Сетка пака не редактируется как остров. `R-V-94` для живого кадра снят |
| R-V-97 | Дроны, машины, пешеходы, юниты и квота жилья/заполнителя — не обязательный визуал меша |

---

## §9. PENDING владельца

| ключ | владелец | зачем |
|---|---|---|
| `attest_testnet` | owner | R-V-5, без выдуманных адресов |
| `island_studio_diorama` | owner | живой остров `PLAN_ISLAND.md`; не квота сетки пака |

Потолки draw-call спрайтов V12 не копировать в v3. Новые потолки — после замера на V3-7.

---

## §10. Определение готовности V3-0

Зелёные `lint.py`, `build.py`, `attack.py --only L370` и `gate_cmd` этапа.
Проба `visual3_stage_keys_exist` красная на снятом ключе. Атаки A-V3-1…4 названы.
Three.js в `packages/render` не импортирован. `launch.deployed` пуст.
Отчёты `V3-0_*.md` на диске.

---

## §11. Определение готовности V3-1

Зелёные `lint.py`, `build.py`, `attack.py --only L370,L348,L371,L372,L373` и `gate_cmd` этапа.
Пробы `visual3_island_from_legend`, `visual3_orbit_from_pack`, `visual3_no_gpu_stays` красные на своих входах.
`visual3_frame_live=1`. Three.js в `arch.toolchain` и в `packages/render`. Орбита из пака, не iso-зум.
`SceneHost` не импортирует `@corporator/render/pixi`. `launch.deployed` пуст.
Отчёты `V3-1_*.md` на диске. Next: V3-2 — 18 GLB.

---

## §12. Определение готовности V3-2

Зелёные `lint.py`, `build.py`, `attack.py --only L370,L372,L374,L375` и `gate_cmd` этапа.
Пробы `visual3_heroes_by_building_id`, `visual3_lod_lighter_than_high`, `visual3_plant_on_lot` красные на своих входах.
Каталог ключей = 18 id `buildings.json`. LOD low легче high. `commit:build` сажает лот.
`launch.deployed` пуст. Отчёты `V3-2_*.md` на диске. Next: V3-3 — сутки и emissive.

---

## §13. Определение готовности V3-3

Зелёные `lint.py`, `build.py`, `attack.py --only L370,L372,L376,L377` и `gate_cmd` этапа.
Пробы `visual3_sun_from_city_time`, `visual3_windows_emissive`, `visual3_no_baked_sun` красные на своих входах.
Направленное солнце от `city_time`. Окна/вывески — emissive, не albedo. `MeshLambertMaterial` на острове. День `lights=0`.
`launch.deployed` пуст. Отчёты `V3-3_*.md` на диске. Next: V3-4 — луч в тайл, BUILD, стейк.

---

## §14. Определение готовности V3-4

Зелёные `lint.py`, `build.py`, `attack.py --only L370,L372,L378,L379` и `gate_cmd` этапа.
Пробы `visual3_ray_hits_tile`, `visual3_empty_opens_build`, `visual3_hud_not_a_hole` красные на своих входах.
Луч бьёт в тайл сетки. Пустой тайл открывает BUILD. Закрытый сток — стейк. HUD не дырявый.
`launch.deployed` пуст. Отчёты `V3-4_*.md` на диске. Next: V3-5 — агенты.

---

## §15. Определение готовности V3-5

Зелёные `lint.py`, `build.py`, `attack.py --only L370,L372,L380,L381` и `gate_cmd` этапа.
Пробы `visual3_walkers_from_pack`, `visual3_units_billboard_or_mesh`, `visual3_units_not_lootable` красные на своих входах.
Пешеходы из пака — камерные плоскости. Поза от `city_time`. Нет `agent_id`, нет клика-моба.
`launch.deployed` пуст. Отчёты `V3-5_*.md` на диске. Next: V3-6 — декор, вода, свет без физики.

---

## §16. Определение готовности V3-6

Зелёные `lint.py`, `build.py`, `attack.py --only L370,L372,L382,L383` и `gate_cmd` `visual3_world`.
Пробы `visual3_water_one_plane`, `visual3_decor_instanced`, `visual3_fill_light_no_physics` красные на своих входах.
Глубокая вода — одна плоскость плюс пена. Декор — `InstancedMesh`. Fill — `HemisphereLight` с живым `fill.intensity`. Нет физики.
`launch.deployed` пуст. Отчёты `V3-6_*.md` на диске. Next: V3-7 — полный прогон и публикация пака.

---

## §17. Определение готовности V3-7

Зелёные `lint.py`, `build.py`, `attack.py --jobs 8`, `python content/sim.py` и `gate_cmd` `visual3_close`.
Пробы `visual3_budgets_measured`, `visual3_golden_frames_match` красные на своих входах.
Круг 1445, вход 200, выход 910, окно A не сдвинуты. `GATE_VISUAL.md` — редакция v3 на двух профилях. Пак опубликован (новый `pack_version` и hash).
`missions_live=0`. Краны NFT 0. `launch.deployed` пуст. Отчёты `V3-7_*.md` на диске. Next: P7 — только по решению владельца.
