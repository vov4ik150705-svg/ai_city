# GATE_VISUAL — island runtime picture

observe.software draw_calls=43 sprites=0 atlas_bytes=2469767 texture_bytes=20971520 bundle_bytes=1107950
observe.desktop draw_calls=43 sprites=0 atlas_bytes=2469767 texture_bytes=20971520 bundle_bytes=1107950
archive.v12.software draw_calls=67 sprites=669 atlas_bytes=2484551 texture_bytes=20971520 bundle_bytes=1009486
archive.v12.desktop draw_calls=67 sprites=669 atlas_bytes=2484551 texture_bytes=20971520 bundle_bytes=1009486

Бюджеты чисел живут в паке. Этот документ определяет, что должен измерить
исполнитель. Архитектор этого этапа гейты не запускает.

## 1. Текущий статус: FAIL

Существующий гейт не доказывает вид:

- gate host не имеет WebGL;
- fps не измеряется;
- live `observe.software` / `observe.desktop` считает `observeIslandBudgets`
  (примитивы mass+buildings, атлас, page textures, dist-web JS), не потолок пака;
- golden использует fallback/архивный кадр, а не GPU-capture острова;
- наличие `SkyDome`, облаков и emissive materials не проверяет их экранную
  форму, экспозицию и положение.

До реализации LOOK-10 любые слова «visual gate зелёный» относятся только к
структуре файлов, не к качеству кадра.

Day-sign baseline в паке по-прежнему нет: L336/L377 гасят окна и фонари
на packed day. Принятый hero-day 2026-09-14 не идёт через этот packed путь.

## 2. Единственный допустимый источник

Capture использует:

- `art/island_v3/runtime_terra19/island_mass.glb`;
- `art/island_v3/runtime_terra19/buildings/*.glb`;
- общий renderer path preview/client из LOOK-03;
- зафиксированную hero-camera;
- записанную city phase;
- записанные hashes GLB и renderer revision.

Запрещены:

- жирный `art/island_v3/island.glb`;
- Blender viewport как golden;
- отдельный viewer light stack;
- capture без camera/phase/hash metadata.

## 3. Обязательные GPU-captures

- `hero_day_1920x1080`;
- `hero_dawn_1920x1080`;
- `hero_dusk_1920x1080`;
- `hero_night_1920x1080`;
- `orbit_side_1920x1080`;
- `orbit_under_1920x1080`;
- `top_layout_1920x1080`;
- `compact_1366x768`;
- `bloom_only`;
- `shadow_debug`;
- `no_emissive_day`;
- `RENDER_NO_GPU` fallback.

Все основные кадры снимаются одним renderer path.

## 4. Композиционные проверки

Проверяется по hero-day:

- остров занимает 72–86% ширины кадра;
- cliff и City Hall spire не обрезаны;
- city envelope как bounding region занимает 70–85% полезного top
  7200×7200 м; это не material area;
- building centers используют не менее 65% полезного диаметра;
- мировая высота City Hall не меньше 1.45 следующего landmark, а spire —
  самая высокая точка hero skyline;
- видны минимум три hardscape levels;
- нет равномерного кольца зданий;
- нет одинакового пустого пояса у края;
- grass coverage = 0.
- material masks суммируются в 100%: hardscape 63–73%, canonical rock
  24–32%, planter soil 0–8%.

Числа измеряются по согласованным masks/debug ids, а не переписываются из
ТЗ как `observe`.

## 5. Световые проверки

Hero-day:

- sky голубой, не чёрный и не HUD navy;
- base surfaces читаются при выключенном emissive;
- есть направленная и контактная тень;
- dark buildings не превращаются в чёрные пятна;
- signs видны слабее night, но не равны нулю;
- windows почти выключены;
- lamps выключены.

Dawn/dusk/night:

- signs, windows и lamps усиливаются;
- facade base color остаётся видимым;
- bloom не выжигает границы здания;
- sky/cloud не попадают в bloom-only.

Негативные пробы:

- `phaseGain=0` не гасит sky/cloud;
- bloom threshold 0 проваливает bloom mask;
- удалённый OutputPass проваливает parity/histogram;
- один общий glow bucket проваливает material-class report.

## 6. Геометрия и placement

- `Island` topology fingerprint совпадает со snapshot;
- `Island` не имеет grass material и terrain modifiers;
- hardscape — отдельные meshes;
- все building roots локальны;
- полная anchor pose применяется одинаково в preview/client;
- base каждого здания касается pad;
- signs/windows принадлежат building GLB;
- в mass нет building-specific emissive children;
- SkyDome/clouds не cast/receive shadows.

Негативные пробы:

- тестовый building переносится между нижним и верхним anchor без sink/float;
- anchor scale 5 не меняет building scale;
- double yaw ловится parity capture;
- скрытый Boolean на `Island` меняет fingerprint и падает.

## 7. Облака и декор

- четыре cloud silhouette families;
- 12–18 cloud instances;
- минимум два ниже island edge;
- минимум два заметны в hero-day;
- нет billboard, particle, tree fragment или CSS cloud;
- декор использует GPU instances;
- tree/lamp/rail читаются в screen space;
- юниты и вода отсутствуют в scene graph.

## 8. Бюджеты

Целевые потолки:

- first load ≤ 12 МБ;
- mass ≤ 1.5 МБ;
- building ≤ 350 КБ, кроме явно принятого измеренного исключения;
- unique decor ≤ 600 КБ;
- triangles ≤ 250 000;
- draw calls ≤ 100;
- material instances: текущий pack ceiling 16 имеет статус `BLOCKED`;
  рекомендуемая приёмка LOOK-10 ≤32 для all-18 stress scene, если
  atlas/shared material не дают 16 без потери вида;
- texture side ≤ 1024;
- target 60 fps @1080p.

Performance report обязан содержать:

- GPU/driver/browser;
- viewport и DPR;
- warm-up;
- длительность sample не меньше 60 секунд;
- median fps;
- p95 frame time;
- draw calls;
- triangles;
- texture memory;
- network waterfall.

Формула примитивов не заменяет GPU measurement.

## 9. Визуальный stop/go

Технический gate может сказать только `MEASURED PASS`. Финальный visual
статус:

- `OWNER ACCEPTED`;
- `OWNER REJECTED`.

`OWNER ACCEPTED` LOOK-11 (2026-09-14) открывает HUD; сам каркас — отдельный `GO`.
