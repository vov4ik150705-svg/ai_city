# Corporator — студийный остров и 18 зданий

Паспорт source-сцены visual rescue. Закрытый план — `docs/archive/plans/PLAN_ISLAND.md`,
история LOOK — `docs/archive/reports/TZ_ISLAND_LOOK.md` и
`docs/archive/reports/TZ_ISLAND_LOOK_STEPS.md`. Не исполнять.

Клеточная сетка пака и кадр V3-0…V3-7 — архив, не эта сцена. Живая масса —
Terra (`R-V-109`). Снимок `Island` 2026-09-06 — архив (`R-V-104`).

Не путать с `content/studio.py` (кисть спрайтов V12, `R-V-44`). Не заменять 18 файлов `models/`.

---

## 1. Что канон, что рабочая копия

| слой | путь | состав |
|---|---|---|
| живая масса Terra | `art/island_v3/runtime_terra19/island_mass.glb` | diet из `models/island 6/TERRA_Floating_Island.glb` (`R-V-109`) |
| живые здания | `art/island_v3/runtime_terra19/buildings/*.glb` | diet 18 `models/*.glb` |
| архив массы `Island` | `art/island_v3/snapshots/canon_2026-09-06_island/` | не runtime |
| отклонённый жирный bake | `art/island_v3/island.glb` | не runtime, не смотреть как результат |
| отклонённая рабочая копия | локальный `island_rejected_2026-09-07.blend` | прежняя трава, терраса и центральное кольцо; только rollback |
| сырьё зданий | `models/*.glb` | ровно 18 файлов = таблица `PLANTS` |
| посадчик | `art/island_v3/build_island.py` | исторический журнал `PLANTS`; `main()` запрещён и не запускается |
| снимок массы | `art/island_v3/_freeze_canon.py` | исторический инструмент; в visual rescue не запускать |
| визуальный канон Terra | `art/island_v3/maps/terra-look.json` | принятая посадка 2026-09-14; не кнопка Terra-19 и не `terra-19.json` |
| просмотр | `art/island_v3/view.html` | тонкие `runtime/` (`?v=runtime`), не жирный bake |

Канон массы 2026-09-06 (архив, не живая карта):

- лица: **4130**
- AABB: xy `-5000.4..5105.7` / `-5118.3..4922.0`, z `-2517.2..0.1`
- площадка: полярная треугольная сетка **7200 × 7200 м** (`ISLAND_SCALE = 10`, полуось `360 × 10`)
- утёс: крупногранный low-poly, дно обрезано

Отклонённые рабочие файлы на момент аудита: blend ~317.8 МБ, жирный bake
~247.6 МБ. Канонный GLB массы без зданий — ~147 КБ.

`art/island_v3/_recover_dumps/`, `_recover_mosaic.py`, `_compose_mosaic.py`
и прочий мусор восстановления **не канон**.

Source-сцена обязана иметь коллекции:

- `00_CanonMass` — только `Island`;
- `10_Hardscape`;
- `20_Buildings`;
- `30_WorldDecor`;
- `40_Sky`;
- `50_Anchors`;
- `90_Review`, не экспортируется.

---

## 2. Масштаб и посадка

Числа ниже — журнал исходной посадки 18 моделей, а не разрешение снова
запустить старую центральную композицию.

```
ISLAND_SCALE = 10          # площадка 7200 м; здания этим множителем не удваиваются
BUILDING_SCALE = 4
PLAZA_Z = 0.06             # пол посадки
HALL_HEIGHT = 450 × 4 = 1800
MSFT_HEIGHT = 230 × 4 = 920
DISTRICT_SPAN = 140 × 4 = 560
YARD_SPAN = 170 × 4 = 680
ARCH_SPAN = 160 × 4 = 640
BANK_SPAN = 130 × 4 = 520
```

Старые `_ixy`, `PLANTS` и правило yaw к центру не являются новым layout.
LOOK-04 строит композицию вручную по hero-камере. `build_island.main()`
остаётся запрещён после I5 и не обходится.

Runtime building не несёт world transform. Его root находится в локальном
origin основания; полную translation+rotation задаёт `anchor_*`.

---

## 2.1. Точки привязки

Механика — `R-V-100`. После принятого LOOK-04 владелец ставит Empty
`anchor_<slug>`: translation и rotation, без scale. Они уезжают в
`runtime/island_mass.glb`; рантайм читает дерево GLB, не пак и не JSON.

Цель остаётся 26 узлов: 18 занятых и 8 свободных. Координаты прежнего
центрального кольца отклонены и не переносятся автоматически. Имена можно
сохранить, pose расставляется заново по принятому blockout.

---

## 3. Восемнадцать моделей

Файлы на диске `models/` (2026-09-06). Старый банк `bank_building_qu_0904155916` снят; живой — `bank_building_qu_0906034155`.

Позиция в таблице — немасштабированная `PLANTS` (метры после ×10). Колонка «якорь» здесь — цель масштаба (`height` / `span`), **не** Empty `anchor_*` из §2.1.

| plant | файл | xy | якорь | pack id | статус |
|---|---|---|---|---|---|
| CityHall | `city_hall_0904163823_texture.glb` | (0, 22) | height 1800 | `city_hall` | старый pose отклонён |
| Tesla | `tesla_building_red_qu_0904132734_texture.glb` | (−176, 114) | span 560 | `energy_plant` | старый pose отклонён |
| Apple | `Apple_Store_Building__0904122206_texture.glb` | (176, 114) | span 560 | `flagship_store` | старый pose отклонён |
| Coinbase | `Coinbase_Archway_Quad_0904174803_texture.glb` | (−180, −28) | span 640 | `finance_tower` | старый pose отклонён |
| Microsoft | `microsoft_building_qu_0904171619_texture.glb` | (114, 163) | height 920 | `cloud_campus` | старый pose отклонён |
| Bank | `bank_building_qu_0906034155_texture.glb` | (−114, −174) | span 520 | `bank` | старый pose отклонён |
| Amazon | `amazon_building_0904183325_texture.glb` | (176, −114) | span 560 | `logistics_hub` | старый pose отклонён |
| FleetYard | `fleet_yard_Q_0904132541_texture.glb` | (36, −182) | span 680 | `fleet_yard` | старый pose отклонён |
| NvidiaDepot | `NVIDIA_Amazon_Depot_Q_0904222124_texture.glb` | (−114, 176) | span 560 | `drone_depot` | старый pose отклонён |
| Workshop | `workshop_building_qua_0906031738_texture.glb` | (174, −42) | span 520 | `workshop` | старый pose отклонён |
| PowerNode | `Power_Node_Device_Qua_0905063753_texture.glb` | (−174, −114) | span 520 | `power_node` | старый pose отклонён |
| AmazonWarehouse | `Amazon_warehouse_Buil_0905061632_texture.glb` | (114, −176) | span 560 | — | нет id (`R-V-95`), старый pose отклонён |
| AgentHub | `Agent_Hub_0906001529_texture.glb` | (−36, −174) | span 520 | `agent_hub` | старый pose отклонён |
| Clearinghouse | `clearinghouse_0906002912_texture.glb` | (−176, 176) | span 560 | `clearing_house` | старый pose отклонён |
| DataCenter | `data_center_Buil_0905182303_texture (1).glb` | (40, 176) | span 560 | `data_center` | старый pose отклонён |
| Exchange | `Exchange_Building_Nav_0905175315_texture.glb` | (−176, 40) | span 560 | `exchange` | старый pose отклонён |
| NvidiaTower | `nvidia_tower_0906011341_texture.glb` | (−40, 178.6) | height 920 | `ai_research_center` | старый pose отклонён |
| RoboticLab | `robotic_lab_0905215549_texture.glb` | (176, 42) | span 560 | `robotics_lab` | старый pose отклонён |

В паке 18 id, в студии 18 файлов. Не 1:1: студия сажает `AmazonWarehouse`, пак ждёт `retail_complex`. Подстановка Meshy в `hero_catalog` не сделана (`R-V-86` жив для кадра). Сверка 2026-09-06: 18 имён на диске `models/*.glb` совпали с filenames в `PLANTS`; расхождений нет.

---

## 4. История площадки (чтобы не вернуть не то)

1. Вороной-мозаика (полярная подложка + плитки) — нравилась 4 сентября; снимок `canon_2026-09-05_island` вместе с деревом `island_v3` был стёрт.
2. Полярная треугольная **сетка** — архив **2026-09-06**, не живая Terra.
3. Мозаику собирали из транскрипта, затем владелец вернул сетку (`island_grid_backup`).

Не сжимать площадку обратно к 3600 м. Не вытирать здания из живой копии «чтобы почистить канон»: канон массы — снимок, живая сцена — с домами.

---

## 5. Активная работа

Живая карта — Terra (`R-V-109`). Вид принят 2026-09-14; визуальный канон —
`maps/terra-look.json` (кусты, водопады, maple), не кнопка «Канон Terra-19».
LOOK-01/04/05 на `Island` 2026-09-06 не исполняются.

Клиент сажает тот же JSON. `view.html` LOOK-03 всё ещё указывает на архивный
`runtime/island_mass.glb` из-за конструкционных проб.

Следующий шаг — HUD после `GO`. Юниты и море вокруг не входят в
сцену. Водопады на Terra разрешены (`R-V-108`).

---

## 6. Как открыть

Blender: `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`.

`build_island.py` и `_freeze_canon.py` в visual rescue не запускать.

Смотреть студию Terra (`map.html`) и общий runtime preview. Живой mass —
`runtime_terra19/island_mass.glb`, не жирный bake и не снимок 2026-09-06.

---

## 7. Что это не меняет

Пак, `pack_version`, `layout_hash`, `hero_catalog`, контракты,
`launch.deployed`, `missions_live`, краны NFT, форму денег, Pixi-архив V12.
Живой runtime — `runtime_terra19/island_mass.glb` плюс локальные
`runtime_terra19/buildings/*.glb`. Жирный `island.glb` не является runtime.
Экономические счётчики по-прежнему из пака. `city_id` геометрию не задаёт.
