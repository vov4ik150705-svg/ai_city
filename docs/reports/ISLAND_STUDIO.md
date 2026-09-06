# Corporator — студийный остров и 18 зданий

Живой 3D-остров Corporator. План работы — `docs/reports/PLAN_ISLAND.md` (`R-V-96`, `R-V-97`; якоря `R-V-100`, юнитов в работе нет `R-V-101`).
Клеточная сетка пака и кадр V3-0…V3-7 — архив, не эта сцена.

Не путать с `content/studio.py` (кисть спрайтов V12, `R-V-44`). Не заменять 18 файлов `models/`.

---

## 1. Что канон, что рабочая копия

| слой | путь | состав |
|---|---|---|
| канон массы (площадка + утёс) | `art/island_v3/snapshots/canon_2026-09-06_island/` | `island.blend`, `island.glb` (~150 KB), `preview_orbit.png`, `preview_under.png`, `KEEP.txt` |
| живая сцена | `art/island_v3/island.blend`, `island.glb` | та же масса + 18 зданий |
| бэкап сетки до попытки мозаики | `art/island_v3/island_grid_backup.blend`, `.glb` | копия живой сцены на момент сетки |
| сырьё зданий | `models/*.glb` | ровно 18 файлов = таблица `PLANTS` |
| посадчик | `art/island_v3/build_island.py` | открывает blend, снимает чужие меши, сажает `PLANTS`, yaw 45°, экспорт; **корпус не генерирует**; Empty `anchor_*` не создаёт и не удаляет |
| снимок массы | `art/island_v3/_freeze_canon.py` | пишет только объект `Island` в папку канона; живые `island.blend` / `island.glb` не трогает |
| просмотр | `art/island_v3/view.html` | `island.glb?v=grid` |

Канон массы 2026-09-06:

- лица: **4130**
- AABB: xy `-5000.4..5105.7` / `-5118.3..4922.0`, z `-2517.2..0.1`
- площадка: полярная треугольная сетка **7200 × 7200 м** (`ISLAND_SCALE = 10`, полуось `360 × 10`)
- утёс: крупногранный low-poly, дно обрезано

Живые файлы (~317 MB blend / ~248 MB glb) содержат здания. Канонный glb массы без зданий — ~150 KB. Канонный blend (~211 MB) — та же геометрия острова без экспорта зданий.

`art/island_v3/_recover_dumps/`, `_recover_mosaic.py`, `_compose_mosaic.py` и прочий мусор восстановления **не канон**.

---

## 2. Масштаб и посадка

Источник чисел — `art/island_v3/build_island.py`, не этот абзац.

```
ISLAND_SCALE = 10          # площадка 7200 м; здания этим множителем не удваиваются
BUILDING_SCALE = 4
PLAZA_Z = 0.06             # пол посадки
HALL_HEIGHT = 280 × 4 = 1120
MSFT_HEIGHT = 230 × 4 = 920
DISTRICT_SPAN = 140 × 4 = 560
YARD_SPAN = 170 × 4 = 680
ARCH_SPAN = 160 × 4 = 640
BANK_SPAN = 130 × 4 = 520
```

Мир здания: `_ixy(x, y) = (x × ISLAND_SCALE, y × ISLAND_SCALE)`. Yaw к City Hall: `0` в начале координат, иначе `atan2(x, y)` в немасштабированных `x,y`. После расстановки `yaw_objects(buildings, 45°)` — остров уже повёрнут на 45°, посадчик крутит **только здания**. Масштаб: либо `target_height / height`, либо `target_span / max(dx, dy)`. Низ сажается на `PLAZA_Z`.

`main()` падает, если множество `models/*.glb` ≠ filenames в `PLANTS`.

---

## 2.1. Точки привязки

Механика — `PLAN_ISLAND.md` §4 (`R-V-100`). Владелец ставит в `island.blend` пустышки (Empty) с именем `anchor_<slug>` (`slug` — латиница в нижнем регистре): позиция и yaw, без масштаба. Они уезжают в `island.glb` как узлы сцены; рантайм читает дерево GLB, не пак и не JSON. Посадчик `build_island.py` якоря **не создаёт и не удаляет** (снимает только MESH ≠ `Island`). Нынешний экспорт пишет MESH; выгрузка узлов `anchor_*` — шаг 6 плана, не побочный эффект посадчика. Точка привязки — не лот `reference_layout`.

---

## 3. Восемнадцать моделей

Файлы на диске `models/` (2026-09-06). Старый банк `bank_building_qu_0904155916` снят; живой — `bank_building_qu_0906034155`.

Позиция в таблице — немасштабированная `PLANTS` (метры после ×10). Колонка «якорь» здесь — цель масштаба (`height` / `span`), **не** Empty `anchor_*` из §2.1.

| plant | файл | xy | якорь | pack id | статус |
|---|---|---|---|---|---|
| CityHall | `city_hall_0904163823_texture.glb` | (0, 8) | height 1120 | `city_hall` | совпал |
| Tesla | `tesla_building_red_qu_0904132734_texture.glb` | (−200, 190) | span 560 | `energy_plant` | функция, не имя файла |
| Apple | `Apple_Store_Building__0904122206_texture.glb` | (190, 190) | span 560 | `flagship_store` | функция |
| Coinbase | `Coinbase_Archway_Quad_0904174803_texture.glb` | (−250, 10) | span 640 | `finance_tower` | функция |
| Microsoft | `microsoft_building_qu_0904171619_texture.glb` | (250, 10) | height 920 | `cloud_campus` | функция |
| Bank | `bank_building_qu_0906034155_texture.glb` | (−190, −190) | span 520 | `bank` | совпал |
| Amazon | `amazon_building_0904183325_texture.glb` | (190, −190) | span 560 | `logistics_hub` | функция |
| FleetYard | `fleet_yard_Q_0904132541_texture.glb` | (10, −250) | span 680 | `fleet_yard` | совпал |
| NvidiaDepot | `NVIDIA_Amazon_Depot_Q_0904222124_texture.glb` | (0, 245) | span 560 | `drone_depot` | функция |
| Workshop | `workshop_building_qua_0906031738_texture.glb` | (245, −120) | span 520 | `workshop` | совпал |
| PowerNode | `Power_Node_Device_Qua_0905063753_texture.glb` | (−300, −90) | span 520 | `power_node` | совпал |
| AmazonWarehouse | `Amazon_warehouse_Buil_0905061632_texture.glb` | (280, −280) | span 560 | — | нет id в `buildings.json` (`R-V-95`) |
| AgentHub | `Agent_Hub_0906001529_texture.glb` | (90, −90) | span 520 | `agent_hub` | совпал |
| Clearinghouse | `clearinghouse_0906002912_texture.glb` | (−280, −260) | span 560 | `clearing_house` | совпал |
| DataCenter | `data_center_Buil_0905182303_texture (1).glb` | (90, 280) | span 560 | `data_center` | совпал; пробел и `(1)` в имени |
| Exchange | `Exchange_Building_Nav_0905175315_texture.glb` | (−310, 180) | span 560 | `exchange` | совпал |
| NvidiaTower | `nvidia_tower_0906011341_texture.glb` | (140, 250) | height 920 | `ai_research_center` | функция |
| RoboticLab | `robotic_lab_0905215549_texture.glb` | (280, 90) | span 560 | `robotics_lab` | совпал |

В паке 18 id, в студии 18 файлов. Не 1:1: студия сажает `AmazonWarehouse`, пак ждёт `retail_complex`. Подстановка Meshy в `hero_catalog` не сделана (`R-V-86` жив для кадра). Сверка 2026-09-06: 18 имён на диске `models/*.glb` совпали с filenames в `PLANTS`; расхождений нет.

---

## 4. История площадки (чтобы не вернуть не то)

1. Вороной-мозаика (полярная подложка + плитки) — нравилась 4 сентября; снимок `canon_2026-09-05_island` вместе с деревом `island_v3` был стёрт.
2. Полярная треугольная **сетка** — живой канон **2026-09-06**.
3. Мозаику собирали из транскрипта, затем владелец вернул сетку (`island_grid_backup`).

Не сжимать площадку обратно к 3600 м. Не вытирать здания из живой копии «чтобы почистить канон»: канон массы — снимок, живая сцена — с домами.

---

## 5. Не сделано (владелец)

Двухъярусный топ с мокапа (утопленная центральная площадь + приподнятая терраса кольца, разные высоты, квадратный двор) **не вырезан**. Это **шаг 1** `PLAN_ISLAND.md` §2, не висящая рекомендация. Числа на столе, не в меше: оставить 7200 и сетку; два дека (внутренний ~40% утоплен, внешнее кольцо **~+180 м**, порядка 1/6 текущей высоты City Hall); классы зданий от Hall; Hall ≈ четверть ширины острова ≈ 1800 м. Пустота кадра — плоский блин, не «мало GLB». `ISLAND_SCALE` дальше не растить. Ключ pending: `island_studio_diorama`.

Покрытие, декор, свет и небо — шаги 2–4 плана, до принятия вида. Композиция 18 GLB и якоря — шаги 5–6. Провод в клиент — шаг 7. HUD — шаг 8, только после принятия вида владельцем. Юнитов в работе нет (`R-V-101`): машины, дроны, пешеходы, роботы и мобы на сцене не ставятся, пока владелец не решит их вернуть; агент их не добавляет. Квота жилья и заполнителя на меше нет (`R-V-97` в этой части).

---

## 6. Как повторить

Blender: `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`.

Посадить 18 зданий на живую массу (корпус не трогает):

```
blender.exe --background --python art/island_v3/build_island.py
```

Снять канон массы (не перезаписывает живые файлы):

```
blender.exe art/island_v3/island.blend --background --python art/island_v3/_freeze_canon.py
```

Смотреть: из `art/island_v3` → `python -m http.server 8788 --bind 127.0.0.1` → `http://127.0.0.1:8788/view.html?v=grid`. Орбита вьюера: `40deg 62deg 2200m`, цель `0m 160m 0m`.

---

## 7. Что это не меняет

Пак, `pack_version`, `layout_hash`, `hero_catalog`, контракты, `launch.deployed`, `missions_live`, краны NFT, форму денег, Pixi-архив V12. Живой `island.glb` — авторская **карта** (масса + якоря, `R-V-98` / `R-V-100`); экономические счётчики по-прежнему из пака. `city_id` геометрию не задаёт (`D-V-21`). Не путать с кистью `content/studio.py`.
