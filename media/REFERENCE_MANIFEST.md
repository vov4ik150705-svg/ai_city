# Corporator — какие файлы давать генератору

Реестр оригиналов и карта «что приложить к какой задаче». Правила для генератора — `media/MEDIA_GENERATION_RULE.md`, описание стиля и паспорта объектов — `media/VISUAL_DESIGN_SYSTEM.md`. Снято 2026-09-30 командой по файлам.

## 0. Как пользоваться в ChatGPT

1. Приложить к чату `media/MEDIA_GENERATION_RULE.md`, `media/VISUAL_DESIGN_SYSTEM.md` и картинки по §1.
2. Первым сообщением вставить текст ниже, заменив последнюю строку своим заказом.
3. Готовый кадр проверить глазами хотя бы по вывескам (§9 правила): генератор ошибается чаще всего там.
4. В новом заказе снова прикладывать листы, а не прошлый результат.

```text
Ты генерируешь медиа для игры Corporator. Прочитай целиком приложенные MEDIA_GENERATION_RULE.md и VISUAL_DESIGN_SYSTEM.md и исполняй их как жёсткие правила. Приложенные картинки — референсы тех же самых объектов: остров, здания, персонажи должны быть узнаваемо теми же, вывески и логотипы — побуквенно по таблице §3 правила. Подписи на листах-референсах в кадр не переносить. Логотип $CORP не рисовать — оставить под него место. Меняй только ракурс, позу, сюжет, окружение и свет. Перед генерацией кратко напиши план кадра (§7 шаг 1) и запрос по шаблону §8. После генерации пройди самопроверку §9 и ответь по шаблону §10. Нашёл ошибку в вывеске — исправь только эту область.
Заказ: <что нужно, формат, для чего>
```

## 1. Что приложить к задаче

Всегда прикладываются два текста: `media/MEDIA_GENERATION_RULE.md` и `media/VISUAL_DESIGN_SYSTEM.md`. Картинки — по таблице. Порядок в строке — порядок важности: если чат ограничивает число вложений, отрезать с конца.

| Задача | Картинки |
|---|---|
| Сцена с одним–тремя зданиями (пост, баннер) | `media/kit/buildings/<id>.png` каждого здания в кадре → `media/arts/economy-sky-art.png` (небо) |
| Персонаж в действии | `media/kit/roles/<id>.png` → лист здания, у которого он стоит → `media/arts/economy-sky-art.png` |
| Команда из нескольких ролей | `media/kit/roles/<id>.png` каждой роли → `media/kit/overview_roles.png` |
| Весь остров, ракурс близок к игровому | `media/island/island_03_tight.png` (как основа для редактирования) → `media/kit/island_map.png` → `media/kit/signs_all.png` |
| Весь остров с другой стороны или снизу | `media/kit/island_map.png` → `media/island/island_03_tight.png` → `island_06_lowest_fill.png` → `media/kit/overview_buildings.png` → `media/kit/signs_all.png` → листы зданий, которые окажутся крупно |
| Фрагмент острова крупно (улица, площадь) | `media/kit/island_map.png` → листы зданий фрагмента → `media/island/island_03_tight.png` |
| Персонаж на острове | `media/kit/roles/<id>.png` → `media/island/island_03_tight.png` → `media/kit/island_map.png` → листы ближайших зданий |
| Ночь или закат | То же, что для задачи, плюс `media/arts/futer.png` (закат, только небо и свет) |
| Макет с логотипом | Как для задачи. Логотип `media/corporator_logo/logo solo.png` / `logo token.png` не прикладывать генератору, а накладывать после (правило H8) |
| Короткое видео | Готовый проверенный кадр → листы объектов этого кадра |

Для генератора `<id>` — имена файлов листов:

- здания: `city_hall`, `workshop`, `agent_hub`, `power_node`, `bank`, `exchange`, `ai_research_center`, `energy_plant`, `logistics_hub`, `flagship_store`, `cloud_campus`, `finance_tower`, `robotics_lab`, `drone_depot`, `data_center`, `fleet_yard`, `retail_complex`, `clearing_house`, `neon_residence`;
- роли: `engineer`, `logistician`, `manager`, `scientist`, `trader`.

**Не прикладывать как референс объекта:** `media/arts/*` (кроме неба), `media/hud_design/*`, `media/website_design/*`, `visual/buildings orig/*`, `media/stock_logos/*`, прошлые генерации. В них объекты перерисованы с ошибками (правило §5).

---

## 2. Комплект `media/kit/` — производные листы

Собраны 2026-09-30 из оригиналов без изменения исходных файлов. Подписи и номера на листах служебные, в кадр не переносятся. Листы — производные: при споре прав оригинал из §3.

| Файл | Что внутри | Из чего собран |
|---|---|---|
| `media/kit/buildings/<id>.png` (19 шт.) | A — главный вид; B — повёрнут, больше правого бока; C — выше, видна крыша; крупные планы всех вывесок с побуквенной подписью | A и вывески — `media/buildings/<Имя>.png`; B — `assets/website/buildings/<id>.png`; C — `assets/website/buildings_elev34/<id>.png` |
| `media/kit/roles/<id>.png` (5 шт.) | A — 3/4 полный рост; B — фронт полный рост; C — фронт погрудно | A — `media/units/*.png`; B — `visual/units/*_icon.png`; C — `hud/units/*_anfas.png` |
| `media/kit/overview_buildings.png` | 19 зданий, вид A, подписи | `media/buildings/*` |
| `media/kit/overview_roles.png` | 5 ролей, вид A, подписи | `media/units/*` |
| `media/kit/signs_all.png` | 35 вывесок 18 зданий крупно, подписи с точным текстом | `media/buildings/*` |
| `media/kit/island_map.png` | Лицевой кадр острова с номерами 1–19 и легендой | `media/island/island_03_tight.png` |

Виды B и C сняты более ровным светом, окна слабее — это свет, не другой дизайн. На виде A Neon Residence — на чёрном фоне исходного файла.

---

## 3. Оригиналы

`SHA-256` — первые 16 hex. Полная сумма: `Get-FileHash -Algorithm SHA256 "<путь>"`. Не совпала — файл подменён, не использовать и сообщить владельцу.

### 3.1 `media/island/` — остров Terra

Три кадра одного захвата живого клиента игры, 3840×2160, без альфы.

| Путь | SHA-256 | Что видно |
|---|---|---|
| `media/island/island_03_tight.png` | `8ba3437e4d27b7c4` | Лицевой фасад, весь остров, 19 зданий. Задний ряд: арка COINBASE, City Hall, MICROSOFT, NVIDIA. Фасады Workshop, Exchange, Logistics Hub, Retail Complex отвёрнуты. Копия: `assets/website/island_site_hero/03_tight.png` |
| `media/island/island_04_hero_walk_left.png` | `baf3a38633f2f0bb` | Тот же фасад дальше, больше низа, 3–4 водопада. Копия: `assets/website/island_master/04_hero_walk_left.png` |
| `media/island/island_06_lowest_fill.png` | `22882f4bd8c86b30` | Крупнее, ниже и правее; лучший кадр скал и уступов. Копия: `assets/website/island_walk_right_low/06_lowest_fill.png` |

### 3.2 `media/buildings/` — здания

Вид 3/4: фасад и правый бок, камера немного сверху, прозрачный фон (кроме Neon Residence). По цвету совпадают с `hud/buildings_avatar/<Имя>.png`.

| Путь | Здание | Размер | SHA-256 |
|---|---|---|---|
| `media/buildings/City Hall.png` | City Hall, база | 1254×1254 | `698251abff6c5dd2` |
| `media/buildings/Workshop.png` | Workshop, база | 1254×1254 | `d7e8f36452b77395` |
| `media/buildings/Agent Hub.png` | Agent Hub, база | 1254×1254 | `0c03f4ba5a44aa79` |
| `media/buildings/Power Node.png` | Power Node, база | 1254×1254 | `a8cc399eed8a48db` |
| `media/buildings/Bank.png` | Bank, база | 1254×1254 | `8bf0efffcac906a2` |
| `media/buildings/Exchange.png` | Exchange, база | 1536×1024 | `046df4688985e00f` |
| `media/buildings/AI Research Center.png` | AI Research Center, маяк Compute (NVDA) | 1254×1254 | `4c25b80684ff0911` |
| `media/buildings/Energy Plant.png` | Energy Plant, маяк Energy (TSLA) | 1254×1254 | `1081fc9e93108ceb` |
| `media/buildings/Logistics Hub.png` | Logistics Hub, маяк Logistics (AMZN) | 1268×1241 | `97c680fc7b8f656a` |
| `media/buildings/Flagship Store.png` | Flagship Store, маяк Consumer (AAPL) | 1536×1024 | `25326598a7b6cde5` |
| `media/buildings/Cloud Campus.png` | Cloud Campus, маяк Automation (MSFT) | 1254×1254 | `af9f5a1a5647a62b` |
| `media/buildings/Finance Tower.png` | Finance Tower, маяк Finance (COIN) | 1254×1254 | `d6b0c795a2ef64ff` |
| `media/buildings/Robotics Lab.png` | Robotics Lab, синергия | 1254×1254 | `1436673a63dedbad` |
| `media/buildings/robotics_lab_png.png` | Robotics Lab, дубль крупнее — не нужен | 1254×1254 | `89747ba92934afd4` |
| `media/buildings/Drone Depot.png` | Drone Depot, синергия | 1254×1254 | `1c2ec554d7da40b0` |
| `media/buildings/Data Center.png` | Data Center, синергия | 1312×1199 | `7df7b699ec723ab2` |
| `media/buildings/Fleet Yard.png` | Fleet Yard, синергия | 1268×1241 | `b5579fc236ad42a3` |
| `media/buildings/Retail Complex.png` | Retail Complex, синергия | 1269×1239 | `7baa08b04f372619` |
| `media/buildings/clearing house.png` | Clearing House, синергия (имя файла строчными) | 1312×1199 | `41370e415970ab5a` |
| `media/buildings/Neon Residence.png` | Neon Residence, вне пака, без вывесок; без альфы, чёрный фон | 1254×1254 | `39349518b37fadc5` |

### 3.3 `media/units/` — пять ролей

| Путь | Роль | Размер | SHA-256 |
|---|---|---|---|
| `media/units/Engineer.png` | Engineer | 1024×1536 | `6e3625fdb58ee1d6` |
| `media/units/Logistician.png` | Logistician | 1024×1536 | `d4a39d583cce7a80` |
| `media/units/manager.png` | Manager (фигура в узкой центральной полосе кадра) | 1408×1408 | `2efee968f3dc2f43` |
| `media/units/scientist.png` | Scientist | 1024×1536 | `f1663f55508f137a` |
| `media/units/trader.png` | Trader | 1024×1024 | `9a0d278167b9fe29` |

Дополнительные виды тех же ролей (вошли в листы): `visual/units/<Роль>_icon.png` (1408×1408, фронт полный рост), `hud/units/<Роль>_anfas.png` (фронт погрудно). Маскот вне ролей: `visual/units/corporator.png`, `corporator_icon.png` — только по прямой просьбе владельца.

### 3.4 `media/corporator_logo/`

| Путь | Что | Размер | SHA-256 |
|---|---|---|---|
| `media/corporator_logo/logo solo.png` | Знак «C» со шпилем + `$CORP`, тёмный на тёплом белом, без альфы | 1254×1254 | `58395b6846eb9e60` |
| `media/corporator_logo/logo token.png` | Монета `$CORP`, альфа | 1254×1254 | `19288af558af3db6` |

Накладываются на готовый кадр, генератору как «нарисуй такой же» не даются.

### 3.5 `media/arts/` — рекламные композиции (подача, не объекты)

| Путь | Размер | SHA-256 | Брать | Ошибки в объектах |
|---|---|---|---|---|
| `media/arts/economy-sky-art.png` | 1671×941 | `02a43e60bd08947e` | Небо, облака, дальние островки — чистый фон | Объектов нет |
| `media/arts/hero.png` | 1671×941 | `705eed1af011c9ae` | Свет, солнце слева сверху, глубина облаков | Остров перерисован, City Hall с часами |
| `media/arts/futer.png` | 2170×725 | `1a0293077e0cd30d` | Закатное небо | Остров перерисован, City Hall с иным знаком |
| `media/arts/island1.png` | 1672×941 | `e8c2cac0b14bc9c5` | Не брать | `CORPORATOR` на арке, часы на City Hall |
| `media/arts/economy-art.png` | 1670×941 | `74ec93b474a6c90b` | Идея сцены «банк и монеты» | Bank и монета перерисованы |
| `media/arts/economy-art-png-2.png` | 1670×942 | `5d52cf6a54f79768` | Как выше | Как выше |
| `media/arts/bank_cloud_png.png` | 1254×1254 | `ac6cc1ebfa176a9e` | Идея «здание на облаке» | Bank близок, но перерисован |
| `media/arts/workshop_cloud_png.png` | 1554×1012 | `d27dda0ff24f42de` | Идея «здание на облаке» | Workshop перерисован |
| `media/arts/workshop_solo_cloud_2.png` | 1535×1024 | `0f0619e3e8db747b` | Как выше | Workshop перерисован |
| `media/arts/logo_cloud_png.png` | 1555×1012 | `d5076e83fe8810d9` | Идея «монета на облаке» | Монета перерисована |
| `media/arts/units 2 png.png` | 1774×887 | `1abbbfd4536bf591` | Идея группового кадра | Позы и детали ролей не сверены |

### 3.6 Интерфейс и чужие знаки — не для генерации объектов

- `media/hud_design/00-hud-full.png`, `01-workspace-building.png`, `02-workspace-agents.png`, `03-bank-deposit.png` — вид HUD (копии в `hud/design-reference/`). Остров на них перерисован, на `00` — `CORPORATOR` на арке.
- `media/website_design/*.png` — макеты сайта: `hero-desktop`, `game-desktop`, `industries-desktop`, `buildings_desktop`, `agents-desktop`, `economy_enter_desktop`, `leadearboard-open-desktop` (опечатка в имени исходная), `futer_desktop`. Образец типографики макета: крупные жирные заглавные в две строки (`RUN THE MACHINE. MAKE IT WORK.`). Остров на `futer_desktop` другого состава.
- `media/stock_logos/*` — чужие логотипы для иконок тикеров в тексте. Вывески на зданиях ими не заменяются: цвета и формы на зданиях свои.

---

## 4. Сводка расхождений

Подробно — `media/VISUAL_DESIGN_SYSTEM.md` §14.

- `COINBASE` на арке подменён: `media/arts/island1.png`, `media/hud_design/00-hud-full.png`.
- Часы вместо звезды на City Hall: `media/arts/hero.png`, `island1.png`, `futer.png`.
- Остров другого состава: `media/website_design/futer_desktop.png`.
- Bank перерисован: `media/arts/economy-art*.png`, слабее `bank_cloud_png.png`. Workshop перерисован: `media/arts/workshop_*`.
- Ранние концепты с другим дизайном: `visual/buildings orig/Energy Plant.png`, `Neon Residence.png`, `Robotics Lab.png`.
- Ориентация фасадов Workshop, Exchange, Logistics Hub, Retail Complex на острове не видна ни на одном кадре.
- Текст второго экрана башни Exchange частично закрыт (`…ME DATA`).
