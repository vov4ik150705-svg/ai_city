# TZ_ISLAND_LOOK_STEPS — подробные задания LOOK-00…LOOK-11

Приложение к `docs/reports/TZ_ISLAND_LOOK.md`: how-to каждого шага главного
ТЗ. Главное ТЗ не закрывать. Исполнять строго свой раздел `LOOK-N`.

Одна задача `LOOK-N` — один чат и один исполнитель. Исполнитель не начинает
следующую задачу, пока владелец не принял обязательные кадры текущей.
Системный протокол — `.cursor/rules/island-look.mdc`.

Тяжёлые задачи Blender и browser renderer выполняет Cursor Grok 4.6 Extra
High. Архитектор проводит аудит и пишет документы, но не меняет сцену, код
или пак.

## Общий формат отчёта исполнителя

Каждый LOOK заканчивается коротким отчётом:

- что изменено;
- какие source и runtime файлы затронуты;
- какие обязательные кадры приложены;
- измеренные числа, не потолки из документа;
- что было атаковано и какой отказ получен;
- что не удалось доказать;
- rollback point;
- `STOP` и ожидание решения. Исполнитель никогда не пишет себе `GO`;
`GO LOOK-N` даёт только владелец.

Фраза «GO, если…» ниже означает условие, после которого исполнитель
останавливается и просит владельца о `GO`; это не self-approval.

Слова «должно работать», «выглядит лучше» и «гейт зелёный» не являются
результатом визуального шага.

С 2026-09-14 живая карта — Terra (`R-V-109`). LOOK-01/04/05 на `Island`
2026-09-06 не исполнять. Следующий назначаемый шаг — LOOK-09 на Terra.
Текст LOOK-09 про UnrealBloom/composer не копировать пакетом: bloom по
камню и небу уже ломал кадр; каждый рычаг — отдельный owner `GO`.

---



## LOOK-00 — baseline, источник и reference lock



### Цель

Зафиксировать, что именно сейчас видит владелец, и исключить повторную
приёмку устаревшего `art/island_v3/island.glb`.

### Предусловия

Нет. Это read-only шаг. Blender, GLB, код и пак не изменяются.

### Входы

- locked mockup 1 (структура/бренды):
`art/island_v3/reviews/LOOK-00/refs/mockup1_structure_brands.png`
(+ sidecar `.json`);
- locked mockup 2 (плотность/свет):
`art/island_v3/reviews/LOOK-00/refs/mockup2_density_light.jpg`
(+ sidecar `.json`);
- отклонённый скриншот владельца:
`art/island_v3/reviews/LOOK-00/refs/owner_rejected_screenshot.png`;
- `docs/reports/AUDIT_ISLAND_VISUAL.md`;
- `art/island_v3/view.html`;
- `art/island_v3/runtime/island_mass.glb`;
- `art/island_v3/island.glb`;
- текущая клиентская сцена.



### Процедура

1. Записать SHA-256, размер и mtime:
  - жирного `island.glb`;
  - `runtime/island_mass.glb`;
  - каждого `runtime/buildings/*.glb`.
2. В DevTools Network доказать, какие GLB загружает preview.
3. Снять с одной и той же машины:
  - текущий `view.html`;
  - клиент без HUD-оверлея;
  - старый bake только как подписанный `REJECTED_STALE_BAKE`.
4. В каждый PNG встроить или положить рядом metadata:
  - source hash;
  - URL;
  - viewport;
  - camera pose;
  - city phase;
  - renderer revision.
5. Отдельно отметить видимые факты:
  - площадь;
  - декор;
  - облака;
  - City Hall;
  - тени;
  - неон;
  - framing.
6. Зафиксировать мокап 1 как источник структуры/брендов, мокап 2 как
  источник плотности/света. Море вокруг и фигурки на обоих помечаются
  `OUT`. Водопады на острове — `IN` (`R-V-108`).



### Deliverables

- baseline-набор PNG;
- одностраничный `baseline.json` или markdown рядом с кадрами;
- список активных URL и hash;
- явная подпись старого bake как отклонённого.



### Приёмка

- любой человек может по PNG определить точный GLB и renderer revision;
- ни один reference capture не грузит 247-МБ bake;
- viewer и client сняты в одинаковом viewport и близкой камере;
- причины расхождения viewer/client перечислены фактами.



### Атаки

- Подменить URL на `island.glb`: metadata и Network должны показать подмену.
- Сменить cache query без смены bytes: hash остаётся прежним.
- Показать Blender viewport вместо runtime: кадр отклоняется.
- Скрыть phase: кадр отклоняется как невоспроизводимый.



### Rollback

Не нужен: шаг read-only.

### Stop/go

`GO`, только если источник каждого кадра доказан. Иначе дальнейшая правка
визуала запрещена.

---



## LOOK-01 — восстановление immutable canonical mass



### Цель

Вернуть точный канонический корпус и удалить из рабочей сцены ошибочную
травяную крышку и вырезанную террасу, не меняя snapshot.

### Предусловия

LOOK-00 принят.

### Разрешённая область

- локальная рабочая копия `art/island_v3/island.blend`;
- новый локальный backup rejected-сцены;
- экспортный runtime после принятия Blender-кадра.

`snapshots/canon_2026-09-06_island/` read-only.

### Процедура Blender

1. Закрыть все процессы, способные автоматически сохранить `island.blend`.
2. Создать локальный backup:
  `island_rejected_2026-09-07.blend`. Не использовать его как runtime.
3. Открыть snapshot и проверить:
  - объект `Island`;
  - transform;
  - число вершин/рёбер/полигонов;
  - AABB;
  - material slots;
  - отсутствие зданий.
4. В рабочую сцену импортировать или append **только** объект `Island` из
  snapshot. Не прогонять `_freeze_canon.py`.
5. Удалить старый изменённый `Island`, `PlazaPaving` и все покрытия, которые
  являлись частью прежнего I1/I2. Здания и полезные декор-прототипы временно
   перенести в скрытую quarantine collection.
6. Назвать объект строго `Island`, сбросить лишние parent и modifiers.
7. Зафиксировать transforms. Любое отличие от snapshot должно объясняться
  только конверсией Blender/glTF осей, не ручным scale.
8. Материал корпуса оставить серо-каменным. Материал или атрибут со словами
  `grass`, `soil_top`, `lawn` на `Island` запрещён.
9. Создать collection `00_CanonMass`, поместить туда только `Island` и
  запретить случайное выделение/редактирование.
10. Снять orbit и under screenshots до добавления hardscape.

Fingerprint считается над object-space vertex positions и polygon index
loops в каноническом порядке. В Blender требуется байт-точное совпадение
после append. Для runtime AABB допускается не более 0.5 м на компоненту из-за
quantization; topology counts совпадают точно.

### Deliverables

- рабочая сцена с одним каноническим `Island`;
- topology fingerprint;
- AABB comparison;
- два PNG: orbit и under;
- backup отклонённой сцены.



### Приёмка

- topology fingerprint объекта совпадает со snapshot;
- ориентир snapshot: 4130 faces, но главным остаётся fingerprint;
- Blender AABB совпадает точно в пределах float serialization, runtime AABB
отличается не более чем на 0.5 м по каждой границе;
- transform единичный или документирован экспортной конверсией;
- на корпусе нет grass/lawn материала;
- силуэт края и гранёный низ совпадают с каноном;
- snapshot не изменился побайтно.

Orbit/under PNG этого шага — структурное Blender-доказательство
восстановления snapshot. Оно не является финальным runtime proof; начиная с
LOOK-03 обязательны runtime-captures.

### Атаки

- Сдвинуть один vertex: fingerprint должен измениться.
- Добавить скрытый Boolean modifier: аудит modifier stack должен упасть.
- Оставить старый `PlazaPaving`: collection audit должен найти его.
- Переименовать grass в `Ground`: material color/ownership review всё равно
должен отвергнуть зелёную крышку.
- Перезаписать snapshot: git/hash review должен остановить шаг.



### Rollback

Вернуть рабочий `island.blend` из локального backup. Snapshot rollback не
нужен, потому что он не должен изменяться.

### Stop/go

`GO`, только после визуального подтверждения владельцем, что восстановлен
именно нравившийся корпус.

---



## LOOK-02 — scene ownership и export contract



### Цель

Сделать границы сцены однозначными до новой композиции. Убрать world
transforms из building GLB и не экспортировать вывески зданий в массу.

### Предусловия

LOOK-01 принят.

### Целевая структура Blender

- `00_CanonMass` — `Island`;
- `10_Hardscape` — платформы, стены, лестницы, мощение;
- `20_Buildings` — 18 authoring building roots;
- `30_WorldDecor` — деревья, фонари, rails, benches;
- `40_Sky` — `SkyDome`, clouds;
- `50_Anchors` — только `anchor_*`;
- `90_Review` — камеры, proxy, rulers, debug.



### Процедура

1. Создать коллекции и распределить существующие объекты по ownership.
2. Для каждого из 18 зданий создать root `building_<slug>`.
3. Внутри root:
  - корпус;
  - `sign_<slug>_*`;
  - `window_<slug>_*`;
  - building-specific roof props.
4. Перевести геометрию runtime-копии в локальные координаты:
  - нижняя точка footprint на Y=0 в Three/glTF;
  - центр footprint на X=0, Z=0;
  - базовый фасад смотрит по Blender local `-Y`, после glTF-конверсии —
  по glTF local `+Z`;
  - root position/rotation identity.
5. Не менять исходный `models/*.glb`. Локализуется derived authoring copy.
6. `anchor_*` хранит полную translation и rotation. Scale всегда
  игнорируется.
7. Экспорт массы выбирает только `00`, `10`, `30`, `40`, `50`.
8. Экспорт building выбирает root и всех его children.
9. Preview и client получают одну таблицу `slug → building GLB`, но pose
  берут только из anchor node.
10. Жирный `island.glb` исключить из всех loader paths. Файл можно оставить
  как локальный rejected artifact, но не как fallback.
11. Для каждой export group вывести tree report: nodes, meshes, materials,
  images, transforms.



### Deliverables

- чистая collection hierarchy;
- 18 локальных building roots;
- mass export без building-specific children;
- building exports с собственными signs/windows;
- tree report.



### Приёмка

- в `island_mass.glb` нет `sign_<building>` и `window_<building>`;
- в каждом building GLB root имеет identity transform;
- нижняя точка building geometry находится на локальном floor;
- перенос одного building на три тестовых Empty с world height
`-200/0/+200` не меняет высоту зазора у основания;
- transform audit подтверждает применение полной anchor pose;
- yaw применяется один раз;
- `models/*.glb` не изменены.



### Атаки

- Экспортировать City Hall с world translation: transform audit падает.
- Оставить sign в массе: ownership audit падает.
- Дать anchor scale 5: runtime размер здания не меняется.
- Поставить building площади на верхний anchor: он не тонет и не висит.
- Повернуть source vertices и anchor одновременно: parity capture ловит
двойной yaw.



### Rollback

Derived runtime удаляется и пересобирается из authoring copy. Исходники 18
GLB остаются неизменными.

### Stop/go

Условие `GO`: тестовое здание одинаково садится на три тестовых Empty
`-200/0/+200`. Визуальный preview/client parity доказывается следующим
LOOK-03.

---



## LOOK-03 — общий runtime preview и hero-camera fit



### Цель

Устранить два независимых look-стека. Любой арт-ревью должен показывать тот
же loader, material policy, camera math и renderer, что игровой клиент.

### Предусловия

LOOK-02 принят. Допустим временный blockout без финальных материалов.

### Разрешённая область

Это browser-code задача. Исполнитель не меняет экономику, механику, HUD или
Blender-композицию.

### Процедура renderer

1. Вынести общий creation path:
  - renderer;
  - GLTFLoader + MeshoptDecoder;
  - material classification;
  - anchors;
  - scene lights;
  - camera fit;
  - composer.
2. `view.html` оставить тонкой оболочкой общего preview, а не вторым
  самописным renderer.
3. Удалить viewer-only исправления материалов, которых нет в клиенте.
4. Задать общий output contract:
  - sRGB;
  - ACES Filmic;
  - OutputPass;
  - одинаковый exposure;
  - одинаковый DPR cap;
  - одинаковое anti-alias решение.
5. Заменить текущий Hemisphere input из HUD `navy/green` на временный
  world-light config общего preview. Финальный lookdev остаётся LOOK-09.
6. `SkyDome` и clouds классифицировать по стабильным tags/names и всегда
  переводить в unlit path.
7. Восстанавливать normals у примитивов, если diet их удалил, либо перестать
  удалять normals там, где они влияют на свет.
8. Реализовать camera fit по bounding sphere/box:
  - вычислить vertical и horizontal FOV;
  - взять ограничивающий угол;
  - получить distance с padding;
  - target привязать к центру городской массы, а не к литералу 160;
  - сохранить island и City Hall внутри safe frame.
9. Сделать wheel/pinch multiplicative или пропорциональным distance.
  Изменение на 1 метр при диапазоне 800–44 000 запрещено.
10. Развести режимы occupancy:
  - all-18 review scene всегда показывает 18 studio assets;
    - production scene следует фактической занятости игрока;
    - `amazon_warehouse` остаётся studio slug с пустым `pack_id` и не
    переименовывается/не выдаётся за `retail_complex` (`R-V-95`).
11. Зафиксировать primary hero pose после owner review:
  FOV 32–40°, azimuth 35–50°, elevation 30–40° над горизонтом.



### Deliverables

- один shared runtime path;
- preview route без HUD;
- camera metadata в capture;
- parity screenshots.



### Приёмка

- preview и client при одинаковых bytes/phase/camera совпадают по:
  - silhouette;
  - building pose;
  - sky;
  - base color;
  - exposure;
  - shadow state;
- допустима разница только в HUD и интерактивных overlays;
- остров занимает 72–86% ширины 1920×1080;
- полный остров виден без ручного многотысячного wheel input;
- camera near/far не режут шпиль и низ утёса.



### Атаки

- Отключить MeshoptDecoder: ошибка загрузки видима, не чёрный экран.
- Удалить normals: viewer и client ведут себя одинаково.
- Открыть preview с другим exposure: parity check падает.
- Изменить viewport на 1366×768: island fit сохраняется.
- Сдвинуть City Hall вверх: camera fit включает шпиль, не обрезает низ.



### Rollback

Shared renderer включается feature switch только на время разработки, пока
parity не доказан. Старый viewer не считается fallback для принятия.

### Stop/go

`GO`, когда один runtime capture можно воспроизвести из preview и client.

---



## LOOK-04 — композиционный blockout и разновысотный верх



### Цель

До материалов и декора построить структуру уровня мокапов: асимметричный
город на трёх или четырёх уровнях, а не кольцо в центре.

### Предусловия

LOOK-01…03 приняты. Hero-camera зафиксирована как рабочая.

### Процедура Blender

1. Скрыть финальные textures, glow и мелкий decor.
2. Создать proxy box для каждого здания из его реального AABB. Цветом
  различать только hierarchy tier, не район.
3. Создать proxy hardscape трёх уровней:
  - `L0`: незакрытые участки `Island`; отдельного L0 deck нет, проходы в
   массе не вырезаются;
  - `L1`: основной deck;
  - `L2`: district/civic terraces;
  - `L3`: максимум один локальный podium.
4. Начальный relief:
  - при L0/L1/L2: два перепада 160–240 м, total 320–480 м;
  - при optional L3: три перепада 100–200 м, total 360–520 м;
  - L3 не добавляется поверх уже максимальных двух перепадов.
5. Создать civic core. City Hall ставится в центральной или задней
  центральной трети, не строго в геометрический центр по привычке.
6. Разбить остальные 17 зданий на 4–6 визуальных групп по 2–5 объектов.
  Группы отличаются плотностью, высотой и направлением улицы.
7. Выбрать второй landmark из существующих 18 и поставить в передней или
  боковой трети. Новую модель не добавлять.
8. Провести одну main axis и 2–3 secondary routes.
9. Оставить 2–4 осмысленных void:
  - civic plaza;
  - garden pocket;
  - overlook;
  - service yard.
10. Распределить building centers минимум по 65% полезного диаметра.
11. Убрать одинаковый наружный пояс. Минимум две группы подходят ближе к
  краю, но AABB не пересекает обрыв.
12. Развернуть фасады на улицы и площади. Запрещено общее правило
  «все смотрят на `(0,0)`».
13. Проверить top, hero и side cameras.
14. Показать владельцу 2–3 blockout-варианта, но рекомендовать один.
  Финальная композиция выбирается здесь, не после материалов.



### Deliverables

- blockout blend;
- layout sheet с именами 18 зданий;
- hero/top/side captures;
- выбранная схема levels и routes;
- список будущих anchors.



### Приёмка

- City Hall — самый высокий и чистый силуэт;
- его мировая высота ≥1.45 следующего landmark;
- шпиль — самая высокая точка skyline hero-кадра;
- city envelope занимает 70–85% полезного верха;
- нет равномерного кольца;
- видны минимум три уровня;
- минимум две связи между каждой соседней парой levels;
- ни один building proxy не пересекает другой, hardscape edge или cliff;
- 18 исходных зданий использованы ровно по одному разу;
- свободные будущие anchors не заполняются fake buildings.



### Атаки

- Обесцветить blockout: hierarchy всё ещё читается.
- Выключить City Hall label: доминанта определяется силуэтом.
- Посмотреть с соседнего азимута ±35°: город не разваливается в одну линию.
- Удалить декор: композиция остаётся городом.
- Включить одинаковую ориентацию к центру: review должен отвергнуть кольцо.



### Rollback

Каждый вариант хранится отдельной review collection или отдельной локальной
копией. Не перезаписывать принятую версию без owner decision.

### Stop/go

Жёсткий `STOP` до явного выбора владельца. LOOK-05 не начинается на
непринятом blockout.

### Итерация draw7 (заборчики по углам)

Владелец отклонил прямоугольник забора в площади перед Hall. Сейчас только
короткие L на внешних углах террасы + L на кромке спуска (общий угловой
столб, без щели). Столб у подножия стены на Island снят. Доказательство —
runtime PNG, не Blender workbench.

- top: `art/island_v3/reviews/LOOK-04/step1_top_1920x1080.png`
- hall: `art/island_v3/reviews/LOOK-04/step1_hall_1920x1080.png`
- mass A sha256 `af5a3ee508aebef43f8f84850e745007bc581dd7f6f85f3da5c9de04f098ad6b`

`STOP`. LOOK-05 не начат.

### Итерация draw8 (контур высокой зоны, top)

Чертёж с самого верха, вход Hall напротив. Забор по обрыву высокой части:
СЗ внешний угол → западная полка → вырез (X_LEFT, Y_LEFT) → западный обрыв
площади → кромка до спуска; СВ внешний L; правая терраса (X_RIGHT, Y_RIGHT).
Проём рампы перед Hall без поперечной перекладины. Углы с общим столбом.

- top: `art/island_v3/reviews/LOOK-04/step1_top_1920x1080.png`
- hall: `art/island_v3/reviews/LOOK-04/step1_hall_1920x1080.png`
- mass A sha256 `fe0129f047569689f4ccb096e671d02b44192d3b634baafd24023b9eb86e8ff8`

`STOP`. LOOK-05 не начат.

---



## LOOK-05 — hardscape, маршруты и  посадочные pads



### Цель

Превратить принятый blockout в читаемый городской верх без травы, сохранив
канонический `Island`.

### Предусловия

LOOK-04 принят.

### Процедура Blender

1. `Island` не выделять и не редактировать.
2. Перевести proxy levels L1+ в отдельные low-poly deck meshes. L0 остаётся
  открытым `Island`; не накрывать его второй сплошной крышкой.
3. Для каждого deck:
  - собственный нерегулярный contour;
  - slab thickness 20–60 м;
  - видимая retaining wall;
  - отсутствие открытых non-manifold краёв.
4. Основные route widths:
  - main promenade: 180–280 м;
  - secondary street/path: 100–180 м;
  - service path: 70–120 м.
5. Лестницы:
  - ширина 120–240 м;
  - ступень читается пятном с hero-camera;
  - не более разумного числа повторяющихся модулей;
  - минимум две связи на level transition.
6. Pad каждого здания:
  - 1.15–1.35 его footprint;
  - отдельный edge value;
  - основание здания полностью внутри;
  - pad не выглядит клеткой экономической сетки.
7. Civic plaza может использовать локальный checker или крупную плитку.
  Остальной город — направленные slabs/bands, не шахматка до края.
8. Разметить три непересекающиеся masks, сумма ровно 100% полезного
  7200×7200 top:
  - hardscape: цель 68%, допустимо 63–73%;
  - exposed canonical rock: цель 28%, допустимо 24–32%;
  - planter soil: цель 4%, допустимо 0–8%;
  - grass/lawn mask отсутствует.
9. Материалы земли:
  - vertex color или маленькая общая palette texture;
  - 3–5 значений;
  - roughness достаточно высокая;
  - без уникальной 2K texture на каждый deck.
10. Устранить z-fighting физическим offset/thickness, а не polygon offset,
  скрывающим пересечения.
11. Создать edge rhythm: rails, curbs, bollard sockets и lamp sockets, но
  сами props оставить LOOK-07.



### Deliverables

- final low-poly hardscape;
- route map;
- pad map;
- level/height sheet;
- material swatches;
- hero/top/side runtime captures.



### Приёмка

- grass/lawn материалов и зелёной крышки нет;
- три уровня читаются без bloom;
- retaining walls дают реальный силуэт;
- ко всем зданиям есть логичный route;
- City Hall стоит на полном pad;
- нет z-fighting, дыр и висящих ступеней;
- hardscape не меняет topology/hash `Island`;
- hardscape не напоминает экономическую клеточную сетку.



### Атаки

- Удалить все здания: levels и routes всё ещё читаются.
- Выключить цвет: перепады остаются геометрическими.
- Поставить камеру дальше: город не превращается в зелёный стол.
- Поднять один deck без лестницы: connectivity review падает.
- Добавить grass material под другим именем: swatch/coverage review падает.



### Rollback

Hardscape живёт в отдельной collection и может быть удалён без изменения
`Island`.

### Stop/go

`GO`, когда владелец принимает форму уровней и маршрутов в сером дневном
кадре без декора.

---



## LOOK-06 — 18 building assets, материалы и emissive children



### Цель

Сделать 18 исходных зданий единым по качеству, но разным по характеру
набором. Устранить тёмные фасады, world transforms и оторванный неон.

### Предусловия

LOOK-02, LOOK-03 и LOOK-05 приняты. Все phase samples снимаются общим
runtime renderer, не отдельным Blender/viewer look.

### Процедура

1. Составить contact sheet всех 18 source и runtime assets в одинаковом
  neutral light.
2. Для каждого здания записать:
  - triangles;
  - materials;
  - textures и color space;
  - baked lighting;
  - AABB;
  - local origin;
  - visual role.
3. Не изменять `models/*.glb`. Работать с derived copy.
4. Удалять normal/AO/ORM только после A/B capture. Слепой общий strip
  запрещён.
5. BaseColor — sRGB. Data maps — linear. Emissive color — корректный glTF
  path. Не красить солнце в albedo.
6. Нормализовать value:
  - тёмный фасад сохраняет детали в bright day;
  - светлый фасад не клиппится;
  - разные отрасли не превращаются в один чёрный материал.
7. Roughness/metalness задаются по функции, а не одним 0/0.85 всем подряд,
  если это уничтожает различия.
8. Перевести root в local origin по LOOK-02.
9. Внутрь root добавить:
  - брендовый sign mesh;
  - 2–6 window groups при необходимости;
  - roof prop только если улучшает силуэт.
10. Теги материала/узла:
  - `emissive:sign`;
    - `emissive:window`;
    - `surface:building`;
    - `surface:glass`.
11. City Hall проверить отдельно:
  - полный pad contact;
    - чистый шпиль;
    - никакая нижняя геометрия не уходит под platform;
    - равномерный scale.
12. Упрощать до целевого LOD только после silhouette overlay. Ошибка
  simplify не должна менять крышу, знак и основание.



### Deliverables

- 18 локальных runtime GLB;
- neutral-light contact sheet before/after;
- material inventory;
- emissive tag report;
- silhouette comparison;
- day/dusk/night sample для 4 landmark buildings.



### Приёмка

- ровно 18 source filenames остались неизменными;
- 18 runtime roots локальны;
- signs/windows экспортированы со своим building;
- ни один sign не остаётся в mass;
- City Hall и каждое здание касаются своего pad;
- в bright day детали тёмных фасадов читаются;
- emissive не заменяет base color;
- текстуры ≤1024, если владелец не принял измеренное исключение;
- runtime building ≤350 КБ либо есть явное owner-approved исключение при
сохранённом first-load budget.

LOOK-06 не обязан ложно пройти текущий scene material ceiling 16: 18
различных building assets уже могут дать не меньше 18 material instances.
Разрешение расхождения выполняется и измеряется в LOOK-10.

### Атаки

- Обнулить phase glow: base building остаётся читаемым.
- Перенести building на другой level: contact сохраняется.
- Сломать normal map: A/B capture показывает разницу или карта удаляется.
- Удалить sign child: asset acceptance падает.
- Подать весь корпус в glow list: material classification должна отвергнуть.



### Rollback

Любой runtime GLB пересобирается из неизменяемого source. Не копировать
исправление обратно в `models/`.

### Stop/go

`GO`, когда 18-building contact sheet принят, а четыре landmark прошли все
три фазы.

---



## LOOK-07 — world decor и масштаб диорамы



### Цель

Заполнить маршруты, края и pockets осмысленным повторяющимся декором, не
маскируя плохую композицию.

### Предусловия

LOOK-05 и LOOK-06 приняты.

### Asset intake из `decoration/`

Для каждого кандидата:

1. Записать автора, URL и лицензию.
2. Проверить коммерческое использование.
3. Отказаться от GPL, SA, editorial и unknown.
4. Проверить один mesh/семейство, origin у основания, Z-up authoring.
5. Удалить rig, animation, cameras и lights.
6. Оценить силуэт с hero-camera.
7. Привести материал к vertex color или общему маленькому atlas.
8. Уложить prototype в triangle/byte budget.

Новые файлы, которые владелец добавит позже, проходят тот же intake.

### Процедура расстановки

1. Выбрать 3–5 tree silhouettes.
2. Сформировать authored groups по 3–7 деревьев. Не использовать равномерный
  scatter и районную квоту.
3. Деревья ставить:
  - в planter pockets;
  - на overlook;
  - между группами зданий;
  - локально по edge, не непрерывным лесом.
4. Фонари ставить сериями 3–6 вдоль route. Отдельно отметить начало лестниц
  и plaza edge.
5. Rails ставить короткими секциями там, где читается высота. Не окружать
  каждый level одинаковой лентой.
6. Benches/bollards/planters использовать как punctuation, не шум.
7. Все повторения — linked data/GPU instances.
8. Variation допускается через scale/yaw в узком диапазоне, но placement
  остаётся авторским и детерминированным.
9. Screen-space review:
  - крупная крона 12–32 px на 1920×1080 hero;
  - lamp glow минимум 3 px;
  - rail читается ритмом, а не одиночным пикселем.



### Deliverables

- license ledger;
- approved decor contact sheet;
- instance report;
- hero/top/side captures;
- decor-only debug capture.



### Приёмка

- используются сначала одобренные assets из `decoration/`;
- нет юнитов и моря вокруг; водопады на острове разрешены;
- 3–5 tree silhouettes различимы;
- деревья не сливаются с землёй;
- фонари поддерживают маршруты;
- rails усиливают перепады levels;
- уникальных prototype мало, instances много;
- decor library ≤600 КБ;
- сцена без декора остаётся композиционно рабочей.



### Атаки

- Заменить linked duplicate на unique mesh: instance audit падает.
- Добавить случайный scatter: повторный export должен показать
недетерминизм или placement review его отвергает.
- Добавить человека «для масштаба»: R-V-101 останавливает шаг.
- Добавить alpha-leaf forest: overdraw/style review останавливает.
- Скрыть все фонари: routes должны остаться читаемы, но lighting cue
считается недоделанным.



### Rollback

Каждое семейство живёт в отдельной collection/parent и снимается независимо.

### Stop/go

`GO`, когда декор читается с hero-camera и не превращает кадр в россыпь.

---



## LOOK-08 — SkyDome и объёмные облака



### Цель

Собрать чистое голубое небо и chunky low-poly clouds уровня мокапов без
спрайтов, tree fragments и частиц.

### Предусловия

LOOK-03 принят; композиция LOOK-04 уже фиксирована.

### Процедура Blender

1. Сделать четыре cloud prototypes специально для сцены.
2. Каждый prototype:
  - закрытая manifold геометрия;
  - 5–12 крупных lobes;
  - flat shading;
  - 48–192 triangles как начальная цель;
  - центрированный origin;
  - единый unlit vertex-color material;
  - без тонких колец и внутренних tree-like ветвей.
3. Силуэты:
  - long;
  - compact;
  - high;
  - broken pair.
4. Согласовать physical span families: примерно 500–1200 м в масштабе
  острова. Финал определяется экраном.
5. Расставить 12–18 instances в трёх depth bands:
  - near: частично у краёв кадра;
  - mid: вокруг острова;
  - far: верхняя половина неба.
6. Минимум два облака проходят ниже видимого края острова, но не входят в
  rock volume.
7. Минимум два крупных облака дают узнаваемый силуэт в верхней половине.
8. Не ставить равномерным кругом.
9. `SkyDome`:
  - inward/double-sided render;
  - unlit;
  - vertical gradient;
  - no depth write;
  - no shadow;
  - no bloom;
  - no frustum culling.
10. Clear color совпадает с нижним цветом sky, чтобы отсутствие dome не
  давало чёрный кадр, но missing dome остаётся ошибкой.



### Deliverables

- four-cloud contact sheet;
- placement map;
- hero/side/under captures;
- runtime material and instance report.



### Приёмка

- облака выглядят объёмами, не белыми штрихами;
- 4 families различимы;
- 12–18 instances не образуют круг;
- минимум 2 ниже острова;
- минимум 2 заметны в hero-day;
- dome и clouds одинаковы в preview/client;
- облака не светятся bloom и не отбрасывают тени;
- particle, billboard и CSS cloud отсутствуют.



### Атаки

- Перевернуть normals prototype: runtime review должен показать/поймать
исчезновение.
- Применить phaseGain=0: sky/cloud остаются видимыми.
- Включить bloom layer облака: selective bloom test падает.
- Поставить облако внутрь AABB скалы: spatial audit падает.
- Заменить на tree mesh: silhouette review отклоняет.



### Rollback

Cloud family и SkyDome отделены в `40_Sky`; canonical mass не затрагивается.

### Stop/go

`GO`, когда владелец принимает облака на hero и under кадрах.

---



## LOOK-09 — bright-day lighting, shadows, emissive и post



### Цель

Получить главный яркий дневной кадр и рабочие dusk/night без чёрных
материалов, мёртвого неона и bloom по небу.

### Предусловия

LOOK-03…08 приняты.

### Текущий долг, который этот LOOK обязан закрыть

Сейчас day signs не реализованы:

- `content/world.py` выводит `lights=0` для day;
- L336/L377 и связанные атаки держат старый смысл;
- `packages/render/src/light.ts` `lightsOn("day")` возвращает false;
- `signGainBps` и render tests ожидают ноль;
- `placement.json` описывает выключенные day lights.

Нельзя решить это установкой общего `day lights=1`: тогда включатся окна и
фонари. Нужен отдельный packed `sign_day_gain` или эквивалентная категория,
плюс синхронная правка канона, паковых правил/атак и render tests в этом
LOOK.

### Процедура renderer

1. Установить общий output:
  - `SRGBColorSpace`;
  - `ACESFilmicToneMapping`;
  - exposure из pack/config;
  - composer `RenderPass → selective bloom → OutputPass`.
2. Классифицировать материалы до phase update:
  - `sky`;
  - `cloud`;
  - `sign`;
  - `window`;
  - `lamp`;
  - `buildingSurface`;
  - `hardscape`;
  - `decor`.
3. Сохранить `exportedEmissiveStrength` и вычислять:
  `runtimeStrength = exportedStrength × phaseGain`.
   Присваивать всем материалам одно 0/0.8 запрещено.
4. Bright day:
  - тёплый directional key;
  - холодный слабый fill/Hemisphere;
  - sky colors из world palette, не `navy` HUD;
  - sign 25–40%;
  - window 0–12%;
  - lamp 0%.
   Глобальный `lights=0` может остаться для window/lamp; sign baseline
   вычисляется отдельным параметром.
5. Dusk:
  - меньший key;
  - sign 70–85%;
  - window 55–75%;
  - lamp 100%;
  - без красной полноэкранной заливки.
6. Night:
  - слабый направленный moon/fill;
  - sign/window/lamp 100%;
  - фасад остаётся различим, а не чёрный.
7. Включить один directional shadow:
  - PCF soft как первый вариант;
  - shadow camera fit по bounds городской массы;
  - map size из pack/config;
  - bias/normalBias измерены, не скопированы;
  - только нужные casters.
8. Hardscape и Island получают shadows. Sky/clouds исключены.
9. Selective bloom:
  - только sign/window/lamp layers;
  - half-resolution допускается;
  - white cloud и bright stone не bloom;
  - threshold настраивается после сохранения exported strength.
10. Если без AO контакт слабый, сначала улучшить shadow framing/bias и
  добавить дешёвый contact decal под buildings. SSAO/GTAO — только после
    измерения, не по умолчанию.
11. Снять dawn/day/dusk/night в одной камере.



### Deliverables

- lighting config sheet;
- material classification report;
- dawn/day/dusk/night captures;
- shadow debug capture;
- bloom-only capture;
- histogram/clip report;
- fps before/after shadow+bloom.



### Приёмка

- day является главным красивым кадром, а не диагностическим режимом;
- City Hall и тёмные здания читаются в тени;
- основания имеют контактную тень;
- retaining walls показывают перепады;
- sign днём виден, но слабее night;
- windows/lamps днём почти или полностью выключены;
- sky/cloud никогда не гаснут от phase;
- bloom-only содержит только emissive categories;
- нет белой пелены и клиппинга большей части фасадов;
- preview/client совпадают.



### Атаки

- `lights=0`: sky/cloud и base surfaces остаются видимыми.
- Выставить bloom threshold 0: review ловит bloom всего кадра.
- Удалить OutputPass: parity/histogram test падает.
- Включить shadow у SkyDome: shadow caster audit падает.
- Заменить exported strength на 0.8: night capture теряет glow и не проходит.
- Подать HUD `navy/green` в Hemisphere: day swatch review падает.



### Rollback

Каждый компонент имеет config switch для диагностики, но принятой считается
только полная комбинация. Старый viewer-light rig не является production
fallback.

### Stop/go

`GO`, когда владелец принимает hero-day и подтверждает, что dusk/night не
ломают материалы.

---



## LOOK-10 — diet, streaming и реальный GPU-профиль



### Цель

Уложить принятую картинку в браузерные бюджеты, не уничтожив силуэты,
материалы и неон.

### Предусловия

LOOK-09 визуально принят. До этого aggressive diet запрещён.

### Процедура

1. Зафиксировать pre-diet source captures и hashes.
2. Для массы, hardscape, decor и каждого building измерить:
  - bytes;
  - triangles;
  - primitives;
  - materials;
  - textures;
  - GPU instances.
3. Оптимизировать по порядку:
  - prune unused;
  - dedup;
  - instance;
  - texture resize/format;
  - meshopt;
  - simplify только после silhouette A/B.
4. Не удалять normals, если production renderer их не восстанавливает.
5. Не удалять AO/ORM механически: карта удаляется только при невидимой
  разнице или после замены более дешёвым материалом.
6. Building assets грузить по занятости игрока. Preview all-18 может иметь
  отдельный режим, но production first paint не обязан fetch все 18.
7. Замерить network waterfall и time-to-first-meaningful-island.
8. Замерить реальный GPU:
  - 1920×1080;
  - bright day;
  - all-18 stress scene;
  - shadows+bloom включены;
  - согласованный integrated-GPU профиль;
  - минимум 60 секунд после прогрева.
9. Записать median, p95 frame time, fps, draw calls и texture memory.
10. Сравнить pre/post-diet кадры в одной камере.
11. Разрешить известный material-budget конфликт:
  - измерить material instances и shader programs all-18 сцены;
    - сначала объединить идентичные world/decor materials;
    - не атласить 18 зданий ценой потери качества без A/B;
    - рекомендуемый all-18 ceiling — 32 material instances;
    - текущий pack ceiling 16 обновить в этом LOOK вместе с правилами и
    атаками, если измерение подтверждает невозможность 16.
12. Разрешить известный material-budget конфликт:
  - измерить material instances и shader programs all-18 сцены;
    - сначала объединить идентичные world/decor materials;
    - не атласить 18 зданий ценой потери качества без A/B;
    - рекомендуемый all-18 ceiling — 32 material instances;
    - текущий pack ceiling 16 обновить в этом LOOK вместе с правилами и
    атаками, если измерение подтверждает невозможность 16.



### Deliverables

- asset budget report;
- network waterfall;
- GPU profile;
- pre/post contact sheet;
- список принятых компромиссов.



### Приёмка

- first load ≤12 МБ;
- mass ≤1.5 МБ;
- building ≤350 КБ или owner-approved измеренное исключение;
- decor ≤600 КБ;
- triangles ≤250k;
- draw calls ≤100;
- material instances ≤32 в all-18 stress scene; старый ceiling 16 не
считается пройденным молча;
- texture side ≤1024;
- fps target 60 @1080p на согласованном профиле;
- p95 frame time не скрывается средним;
- визуальный owner lock после diet не нарушен.



### Атаки

- Удалить normals: post-diet parity должна поймать плоский свет.
- Simplify City Hall сильнее: silhouette overlay ловит шпиль/крышу.
- Fetch все 18 до first paint: network gate показывает регрессию.
- Скопировать потолок 100 в observe: фактический GPU capture обязателен.
- Выключить shadows ради fps: визуальный lock не проходит.



### Rollback

Каждый diet stage пишет новый временный artifact и заменяет runtime только
после A/B. Source и pre-diet hash сохраняются.

### Stop/go

`GO`, когда одновременно выполнены visual и performance contracts.

---



## LOOK-11 — owner acceptance и заморозка вида



### Цель

Закрыть visual rescue решением владельца, а не выводом агента.

### Предусловия

LOOK-00…10 имеют `GO`.

### Обязательный review pack

1. `hero_day_1920x1080`;
2. `hero_dawn_1920x1080`;
3. `hero_dusk_1920x1080`;
4. `hero_night_1920x1080`;
5. `orbit_side_1920x1080`;
6. `orbit_under_1920x1080`;
7. `top_layout_1920x1080`;
8. `compact_1366x768`;
9. `bloom_only`;
10. `shadow_debug`;
11. `no_emissive_day`;
12. `RENDER_NO_GPU`;
13. network и GPU reports;
14. source/runtime hashes.



### Чеклист владельца

- корпус — тот самый канонический;
- верх имеет несколько уровней;
- City Hall — доминанта и не пересекает поверхность;
- здания не образуют кольцо-кучку;
- край острова не пустой и не заполнен травой;
- дороги, pads, лестницы и подпорные стенки читаются;
- декор поддерживает масштаб;
- облака объёмные;
- bright day действительно красивый;
- неон виден днём и усиливается ночью;
- тени сажают здания;
- моря вокруг и юнитов нет; водопады на острове разрешены;
- визуал воспринимается как единая диорама, а не набор GLB.



### Технический чеклист

- source `models/*.glb` не изменены;
- snapshot не изменён;
- viewer/client parity доказан;
- anchors дают полную pose;
- building signs принадлежат building GLB;
- real GPU и network budgets доказаны;
- `launchToken`, экономика и HUD не затронуты visual rescue без отдельной
задачи.



### Атаки

- Показать только лучший close-up: review pack неполон.
- Скрыть under view: объём корпуса не доказан.
- Показать Blender вместо runtime: отказ.
- Показать day из viewer, night из client: отказ.
- Сослаться на зелёный тест без owner approval: отказ.
- Убрать море вокруг / юнитов только из hero, оставив в сцене: graph audit ловит.



### Решение

Владелец пишет одно:

- `ACCEPT LOOK-11` — вид принят;
- `REJECT LOOK-11: <конкретные пункты>` — возвращение в соответствующий
LOOK, а не хаотический полиш.



### После принятия

Можно переходить к `docs/reports/HUD_DESIGN_SYSTEM.md`; `docs/reports/TZ_HUD.md` остаётся
legacy-справкой, не источником дизайна. P7 и `launchToken` остаются
отдельным решением владельца.