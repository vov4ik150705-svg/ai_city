# PLAN_LAUNCH — план до запуска

Составлен 2026-09-18 по результатам полного аудита репозитория. Живой план
работ. Порядок разделов — порядок исполнения: сначала F (закрыть дефекты),
потом I (убрать отклонённый остров), потом M (доделать механики).

Каждая задача самодостаточна: её можно выдать отдельному агенту, не давая
ему остального документа. Внутри задачи есть точные пути, шаги, гейт и
критерий готовности.

---

## 0. Как работать — читать всем и каждый раз

Системное правило исполнения этого ТЗ — `.cursor/rules/plan-launch.mdc`
(`alwaysApply`). Агент читает **эту секцию задачи**, а не пересказывает план.

### 0.1 Обстановка

- Оболочка — **PowerShell 5 на Windows**. Оператор `&&` не работает,
  команды разделять `;`. Вместо `grep`/`head`/`tail` — `Select-String`,
  `Select-Object -First N`.
- `pnpm` не в PATH; работает `corepack pnpm`. У пакета `@corporator/client`
  **нет скрипта `dev`**: dev-сервер поднимается как
  `npx vite --config apps/client/vite.config.ts`.
- `pnpm install` на этой машине падает по TLS к registry.npmjs.org.
  `node_modules` уже установлены — не переустанавливать без нужды.
- Foundry (`forge`) не установлен. Контракты не собираются. Самому не ставить.

### 0.2 Гейт шага — узкий, обязательный

После **каждой** задачи:

```
python content/lint.py
python content/build.py
python content/attack.py --only <id правил, затронутых задачей>
```

плюс `ReadLints` на все правленые файлы, плюс тесты той области, которую
трогал (`npx vitest run <путь к тесту>`).

**Полный `python content/attack.py` без `--only` запускать запрещено** —
он идёт часами. Полный прогон бывает только при закрытии фазы.
`python content/builds.py` (≈1200 с) в шаговом гейте не запускать.

Слова «должно работать», «скорее всего проходит», «логика верна» результатом
не считаются. Не запустил — не сделал. В отчёте приводить **числа**, а не
«проверил».

### 0.3 Текущая база, от которой считаем

На момент составления плана:

| показатель | значение |
|---|---|
| `pack_version` | **149** (H2.5: `UI_NO_RESPEC`) |
| pack hash | `d372db3639507f062a36c7590f439d1acd4f3bf0e0ba9b8d76aee591b8f3bf97` |
| `rules_version` | `0.24.0` |
| каналов состояния заполнено | **19 из 21** (H1; `wallet.chain` и `wallet.corp_balance` честно `{}` без `launch.deployed`) |
| команд исполняет API | **11 из 16** (`research_start`, `open_district`, `stake`, `unlock_tier`, `pick_node`, `merge`, `upgrade` живые) |
| намерений живых на клиенте | **10 из 19** |
| `python content/lint.py` | 385 правил, **2 ERRORS** (L195 даты в WORLD.md, L268 имена `look03_runtime` + it() H1 вне `construction_tests`), 1 WARNING (L174), 4 PENDING |
| `npx vitest run` (корень) | **271 passed / 10 failed / 281** |
| `eslint .` в живых пакетах | **205 errors** (`render` 158, `engine` 47) |
| `python content/codegen.py --check` | сходится |
| `content/params/launch.json` `deployed` | все пять полей пустые |

Если ваши числа отличаются от этих — сначала выясните почему, потом
работайте. Не подгоняйте. HUD-счёт после части H — колонка «сейчас» в H9,
не эта таблица состава плана.

### 0.4 Красные линии

- **Не подписывать `launchToken` и не деплоить в мейннет.** Ни одна задача
  этого плана этого не требует. «Кажется, осталось только запустить» —
  вопрос владельцу, не право агента.
- **Сгенерированный файл руками не правится.** Файл с шапкой
  `/* GENERATED from pack ... */` меняется только через
  `python content/codegen.py`. Список таких файлов — 23 штуки, см. F1.
- **Числа только из пака.** В рантайме нет числовых литералов кроме `0`, `1`
  и индексов. Одно и то же число в двух местах — дефект.
- **Тик детерминирован.** Внутри экономического тика запрещены внешний инференс,
  `Math.random`, `Date`, `performance`, системное время, любой внешний I/O.
  Случайность — только `hash(city_id, tick_index, agent_id)`. Время —
  только `city_time`.
- **Свободный id линтера — `L390`.** Занято 386 id, максимум `L389`. Дыры
  `L328`, `L364` и `L387` молча не переиспользовать.
- **Расхождение `C-20` не трогать.** `DESIGN.md` §4.8 говорит «половина
  тир-1 дивиденда», генератор берёт полный. Это намеренно сохраняемый
  конфликт. Не выравнивать без отдельного решения владельца.
- **Юнитов не добавлять** — ни машин, ни дронов, ни пешеходов, ни мобов,
  даже «фоном» (`R-V-101`).
- **Внешнего инференса нет** (`R-V-110`). Хост-писателя не возвращать.
- **Карту не генерировать** ни от `city_id`, ни от `layout_seed`, ни
  процедурно (`R-V-98`).
- **`missions_live` остаётся `0`.** Миссии не включать.
- Коммиты — только когда владелец попросил. В сообщении коммита писать
  числа гейта.

### 0.5 Адверсариальное ревю — обязательный третий проход

Для каждого нового правила, формулы или инварианта построить вход, на
котором оно **должно** упасть, и показать падение. Правило, которое никогда
не срабатывает, — декорация. В отчёте прямо написать: что атаковал, что
выстояло, что нашлось. Ревью без списка атак не считается пройденным.

---

# ЧАСТЬ F. Закрыть найденные дефекты

Десять падающих тестов, 9 ошибок линтера и 3 ошибки типов сводятся к пяти
причинам. Задачи F1–F7 закрывают их.

---

## F1. Держать сгенерированный слой в синхроне с паком

**Статус:** уже сделано 2026-09-18 (коммит `bd8a3c2d`). Задача оставлена
как справка — повторять не надо, но механику надо знать.

**Что было:** сгенерированный TypeScript был проштампован паком 143
(`b1cc21aa…`), а пак на диске — 144 (`dc58998f…`). TypeScript сверяет хеш
пака при загрузке, хеши не сходились, рантайм не стартовал.

**Как это лечится всегда:**

1. `python content/codegen.py --check` — показывает список разошедшихся
   артефактов.
2. Если есть расхождения — `python content/codegen.py` (без `--check`).
3. Снова `python content/codegen.py --check` — должно быть
   `23 artifacts match pack <hash>`.

**Правило на будущее:** после **любого** изменения `content/params/*.json`
обязательна связка `python content/build.py` → `python content/codegen.py`.
Пропустили — получите ровно эту поломку снова.

23 генерируемых артефакта: десять файлов `packages/protocol/src/*.ts`,
`services/api/migrations/001_from_pack.sql`, `.dependency-cruiser.cjs`,
корневой `tsconfig.json`, шесть файлов `deploy/*`, `scripts/ci.mjs`,
`.github/workflows/ci.yml`, `contracts/foundry.toml`,
`contracts/test/PackConstants.sol`.

---

## F2. Довести вырез Companion до конца

**Статус:** закрыто 2026-09-18. Companion снят из живого пака (`L388`).
Хвосты в коде закрыты. Хост-писатель снят отдельно (`R-V-110`): живых
процессов четыре (api, sampler, buyback, attestor). Каталога писателя
в `services/` нет.

### Чего не делать

Не возвращать Companion в пак. Не возвращать пятый процесс и не обещать
внешнего писателя сводки. `L388` охраняет вырез Companion. Схема
`arch.listen.ports` не принимает лишний порт.

---

## F3. Перевести рендер острова на `city_time`

**Статус:** закрыто 2026-09-19. `performance.now()` снят из
`packages/render/src/three.ts`. Вода — `city_time × water_steps_per_tick`.
Солнце и фаза дня — `setCityTime` → `sunPose`. `L334`/`L335`/`L338`/`L376`
ушли из ERRORS. Студийный `Clock` в `art/island_v3/map.ts` — не живой
рендер; не открывать как LOOK. Ниже — исходная задача, не исполнять.

### Что сломано

`packages/render/src/three.ts` берёт время из настенных часов вместо часов
города:

- строка **305** — `performance.now()`
- строка **516** — дельта кадра для воды

Ловят это:

- линтер: `L334` (вода), `L335` (фаза дня), `L338` (движение), `L376` (солнце)
- тесты: `packages/render/test/v7.test.ts` — `motion_is_pure_of_city_time`
  и `no_wall_clock_in_render`

### Почему это важно

Закон проекта: «Время в рендере — только часы города». Сейчас два игрока с
одинаковым `city_time` увидят разную картинку, и одинаковый `city_time` не
даёт одинаковый кадр. Экономический тик при этом чистый — врёт только
визуал дня, воды и солнца.

### Шаги

1. Найти, как `city_time` вообще попадает в рендер. Искать:
   `Select-String -Path packages/render/src/three.ts -Pattern 'cityTime|setCityTime|city_time'`.
   Скорее всего есть сеттер, который HUD уже вызывает — `SceneHost.tsx`
   прокидывает часы.
2. Прочитать строки вокруг 305 и 516 и понять, **что** именно считается от
   времени: фаза дня, положение солнца, анимация воды, движение декора.
3. Заменить источник: вместо `performance.now()` и накопленной дельты
   использовать `city_time` (и производные от него), которые уже приходят
   снаружи.
4. Для анимации воды, которой нужна непрерывность, использовать не дельту
   кадра, а функцию от `city_time`: фаза должна **однозначно** определяться
   значением `city_time`, а не историей кадров.
5. Не вводить числовых литералов. Коэффициенты скорости берутся из пака
   (`content/params/render.json`). Если нужного ключа нет — добавить его в
   пак по `docs/CONTENT.md` §5, поднять `pack_version`, прогнать
   `build.py` и `codegen.py`.

### Гейт

```
python content/lint.py
python content/build.py
python content/attack.py --only L334,L335,L338,L376
npx vitest run packages/render/test/v7.test.ts
```

### Готово, когда

- `L334`, `L335`, `L338`, `L376` ушли из ERRORS (было 9 ошибок → станет 5);
- `v7.test.ts` зелёный;
- `python content/attack.py --only L334,L335,L338,L376` — все пробы пойманы;
- визуально: открыть `art/island_v3/map.html` и убедиться, что вода и свет
  по-прежнему анимируются, а не замерли.

### Адверсариальная проверка

Подставить в рендер два одинаковых `city_time` подряд и убедиться, что кадр
байт-в-байт одинаковый. Затем вернуть `performance.now()` на место и
показать, что `v7` снова краснеет — это доказывает, что тест живой.

---

## F4. Починить само правило L387

**Статус:** закрыто 2026-09-18 (краш снят), затем **снято владельцем** в тот
же день. Packed day-sign LOOK-09 не канон принятого вида (`R-V-105`).
Правило `l387_sign_day_gain`, его пробы и id `L387` удалены из живого
гейта. Id не переиспользовать. LOOK-ТЗ уехали в `docs/archive/`.

Ниже — исходная задача фикса краша, для истории. Не исполнять повторно.

Критерий «L387 пропало из ERRORS (5→4)» написан против другой базы.
Живой линтер после фикса: 12 ERRORS, из них четыре — L387 на ключах
LOOK-09, которых нет в паке (`sign_day_gain_bps`, `island_bloom_live`,
`island_shadows`, shadow map/bias). Их нет по `R-V-105`: packed day-sign
baseline не заводился, принятый hero-day не применяет `day lights=0`.
Заводить ключи в F4 нельзя — это смена принятого вида, не починка
линтера. Пробы L387 ловят изолированную мутацию (фикстура прохождения +
один слом).

### Что сломано

`content/lint.py`, район строки **12476**. Правило `L387` падает с
`UnboundLocalError: local variable 'day' referenced before assignment`.
Причина — выражение вида `day = phases.get("day") if isinstance(day, dict)`:
переменная `day` читается в условии до того, как ей присвоено значение.

### Шаги

1. Открыть `content/lint.py` на строке 12476 и прочитать всё тело правила
   `l387_*`, а не только падающую строку.
2. Понять намерение: `L387` обещает проверять, что дневные вывески берут
   `sign_day_gain_bps` из пака, окна и фонари днём выключены, тень одна PCF,
   а `bloomLive` гейтит композитор.
3. Исправить присваивание так, чтобы условие проверяло **источник**, а не
   ещё не существующую переменную. Скорее всего должно быть примерно
   `raw = phases.get("day"); day = raw if isinstance(raw, dict) else {}` —
   но написать по фактическому смыслу соседнего кода, не копировать вслепую.
4. Убедиться, что правило теперь реально что-то проверяет, а не просто не
   падает.

### Гейт

```
python content/lint.py
python content/attack.py --only L387
```

### Готово, когда

- правило больше не падает с `UnboundLocalError`;
- `python content/attack.py --only L387` **ловит** изолированную пробу
  (фикстура прохождения + одна мутация). Если проба не ловится — правило
  стало декорацией.
- L387 в ERRORS живого пака — это отсутствующие ключи LOOK-09 / `R-V-105`,
  не краш. Зелёный L387 без упаковки ключей не требовать.

### Обязательно

Это правка самого `lint.py`. По правилам проекта правка линтера — один из
четырёх случаев, когда нужен **полный** `python content/attack.py --jobs 8`.
Запустить его в конце этой задачи и привести число пойманных проб.

---

## F5. Убрать литерал из `islandLook.ts`

**Статус:** закрыто 2026-09-19. Восьмёрка — `render.look_orbit_distance_max_mul = 8`
в паке 146. Имена `islandLook` / `look03_*` — исторические идентификаторы
камеры, не открытый LOOK-проход. Ниже — исходная задача, не исполнять.

### Что сломано

`packages/render/src/islandLook.ts:122` — `Math.round(n * 8)`. Литерал `8`
ловит линтер `L340` и ESLint `no-restricted-syntax`.

### Шаги

1. Прочитать строку 122 и понять, что означает восьмёрка: шаг квантования,
   делитель, число сегментов.
2. Найти подходящий ключ в `content/params/render.json`. Если его нет —
   добавить по `docs/CONTENT.md` §5 с полями `v`, `src`, `why`; поднять
   `pack_version`; прогнать `build.py` и `codegen.py`.
3. Прочитать число из пака, а не из константы в модуле.

### Гейт

```
python content/lint.py
python content/build.py
python content/codegen.py --check
python content/attack.py --only L340
```

### Готово, когда

`L340` ушло из ERRORS и проба `L340` ловится.

---

## F6. Оживить или убрать `fill.intensity`

**Статус:** закрыто 2026-09-19. `fill.intensity` пишется в `three.ts`.
L382 ушла из ERRORS. Ниже исходная задача, не исполнять.

### Что сломано

Линтер `L382`: «`fill.intensity` is never applied: HemisphereLight would be
a dead constructor». То есть создаётся `HemisphereLight`, но его
интенсивность никуда не применяется — объект строится впустую.

### Шаги

1. Найти место: `Select-String -Path packages/render/src/*.ts,packages/render/src/islandEnv/*.ts -Pattern 'HemisphereLight|fill\.intensity'`.
2. Решить, что верно:
   - если заливочный свет нужен по принятому виду — применить
     `intensity` из пака и убедиться, что кадр не изменился сверх
     ожидаемого;
   - если не нужен — удалить конструктор целиком, чтобы не висел мёртвый
     объект.
3. Принятый вид — `ENV_LOOK_REV` 27 и `maps/terra-look.json`. **Картинку
   менять нельзя.** Если применение `intensity` заметно меняет кадр —
   остановиться и спросить владельца.

### Гейт

```
python content/lint.py
python content/attack.py --only L382
```
плюс визуальная проверка `art/island_v3/map.html` до и после.

---

## F7. Разобраться с тремя тестами снятого 2D-рендера

**Статус:** закрыто 2026-09-19. `m0` сверстан с паком: этап `fee_split`
держит 5 ключей `construction_tests`, `money_form` — 2. Три красных
визуальных пробы ушли в `docs/archive/tests/` по решению владельца;
живые `it("…")` оставлены как заглушки (L268). GPU-гейт острова — не эта
задача. Ниже исходный текст, не исполнять.

**Это задача на решение, а не на код. Сначала спросить владельца.**

### Что падает

- `packages/render/test/v3.test.ts` — `ground_matches_python_scene`:
  сверяет клеточный ground в TypeScript с Python-сценой
- `packages/render/test/v12.test.ts` — `visual_budgets_measured`
- `packages/render/test/v37.test.ts` — `visual3_budgets_measured`

Все три охраняют **изометрический клеточный рендер**, которого в игре
больше нет: живой кадр — Three.js и Terra.

Отдельно падает `packages/contentpack/test/m0.test.ts` —
`money_stage_keys_exist`: у этапа `money_form` фактически **5** ключей в
`construction_tests`, тест ожидает **3**.

### Что сделать

1. Установить фактами, что именно проверяет каждый тест и относится ли это
   к живому 3D-пути. Не гадать: прочитать тела тестов.
2. Для `m0.test.ts` — это не 2D. Сверить `construction_tests` этапа
   `money_form` в `content/params/arch.json` с тем, что ожидает тест.
   Источник правды — пак. Если в паке 5 ключей осознанно, правится тест;
   если ключи добавили случайно — правится пак.
3. Для `v3`/`v12`/`v37` подготовить владельцу короткую записку: что тест
   проверяет, почему он больше не применим, и что предлагается — отправить
   в архив вместе с 2D-рендером или переписать под Three.js.
4. **Не удалять тесты самостоятельно.** Удалённый тест — это снятая
   защита; такое решение принимает владелец.

---

# ЧАСТЬ I. Убрать отклонённый остров, оставить только Terra

Цель: в репозитории и на диске остаётся ровно один остров — принятая Terra.
Отклонённая масса, её снимки, откаты и ревью закрытых LOOK уходят из
рабочего дерева.

**Общее правило части I: ничего не удалять командой удаления.** Всё
переносится в папку-корзину вне репозитория. Владелец требует возможность
отката.

Корзина уже создана: `C:\Users\sk640\corporator-trash-20260918`.
Резервная копия живого острова: `C:\Users\sk640\corporator-unversioned-backup-20260918`.
Тег состояния до чистки: `pre-cleanup-2026-09-18`.

---

## I1. Перенацелить `view.html` на Terra

**Статус:** закрыто 2026-09-19. `view.html` и `preview.ts` читают
`runtime_terra19`. Отклонённый `./runtime/` больше не путь проверки вида.
Ниже исходная задача, не исполнять.

**Делать первым. Пока это не сделано, отклонённый остров удалять нельзя —
сломается инструмент проверки вида.**

### Что не так

`art/island_v3/view.html`, строки **56–57**:

```
data-mass="./runtime/island_mass.glb"
data-buildings="./runtime/buildings/"
```

Это **отклонённый** остров: в `art/island_v3/runtime/buildings/` лежат
файлы со старыми именами `amazon.glb`, `apple.glb`, `nvidia_tower.glb`.

Живой клиент грузит другое — `apps/client/src/islandLookAssets.ts` берёт
`art/island_v3/runtime_terra19/island_mass.glb` и
`runtime_terra19/buildings/*.glb`.

При этом правило фазы прямо говорит: «проверка вида — `art/island_v3/view.html`
или Blender». То есть документированный способ проверить остров показывает
не тот остров. Это же нарушает сквозной закон «держать паритет preview и
клиентского рендерера».

Второй превью, `art/island_v3/map.html` → `map.ts:205`, Terra грузит
правильно.

### Шаги

1. Прочитать `art/island_v3/preview.ts`. В строках 14–21 заданы
   `MASS_FALLBACK = "./runtime/island_mass.glb"`,
   `BUILDINGS_FALLBACK = "./runtime/buildings/"` и glob
   `import.meta.glob("./runtime/buildings/*.glb")`.
2. Решить с владельцем один из двух вариантов:
   - **вариант А (рекомендуемый):** перенацелить `view.html` и
     `preview.ts` на `runtime_terra19`, тогда оба превью показывают Terra;
   - **вариант Б:** объявить `view.html` архивом и оставить единственным
     превью `map.html`, а правило фазы поправить.
3. При варианте А поменять и `data-*` в `view.html`, и три константы/glob
   в `preview.ts`. Glob в Vite статический — менять строку литерала, а не
   собирать путь из переменной.
4. Проверить, что имена зданий совпадают. В старом рантайме это `amazon`,
   `apple`, `nvidia_tower`; в Terra — `agent_hub`, `bank`, `city_hall` и
   т.д. Если `preview.ts` где-то ожидает старые имена — поправить.
5. Учесть тест: `packages/render/test/look03_runtime.test.ts:280` проверяет
   `view.includes("./runtime/buildings/")`. После правки этот тест надо
   осознанно обновить под Terra, а не обойти.

### Гейт

```
npx vitest run packages/render/test/look03_runtime.test.ts
python content/lint.py
python content/attack.py --only L386
```
плюс открыть `art/island_v3/view.html` и глазами убедиться, что видна
Terra, а не старая масса.

### Готово, когда

`view.html` и `map.html` показывают **один и тот же** остров, и это Terra.

---

## I2. Вынести отклонённый остров из индекса и с диска

**Статус:** закрыто 2026-09-19. Отклонённое в
`C:\Users\sk640\corporator-trash-20260918\rejected-island` (не удаление).
В git `art/island_v3/runtime/` пуст. Живые `runtime_terra19/` (57 файлов) и
`maps/terra-look.json` на месте. Пак 147. Ниже исходная задача, не
исполнять.

**Делать только после I1.**

### Что выносится

| путь | файлов | размер | что это |
|---|---|---|---|
| `art/island_v3/runtime/` | 22 | 5.1 МБ | отклонённый рантайм, **в git** |
| `art/island_v3/snapshots/` | 5 | 204 МБ | снимок массы 2026-09-06 |
| `art/island_v3/island.glb` | 1 | 236.1 МБ | жирный GLB, не рантайм |
| `art/island_v3/island_grid_backup.glb` | 1 | 236.1 МБ | точный дубль предыдущего |
| `art/island_v3/_rollback/` | 26 | 29.8 МБ | откаты LOOK |
| `art/island_v3/rollback/` | 2 | 2.9 МБ | то же |
| `art/island_v3/reviews/` | 237 | 65.3 МБ | ревью закрытых LOOK-00…04 |

Итого около **780 МБ**. В git из этого только `art/island_v3/runtime/`
(22 файла) — остальное уже untracked или в `.gitignore`.

### Что НЕ трогать ни при каких условиях

- `art/island_v3/runtime_terra19/` — живая масса и здания;
- `art/island_v3/maps/terra-look.json` — принятая посадка и камера;
- `decoration/*.glb` — декор, грузится глобом;
- `models/` — 18 защищённых GLB плюс `models/island 6/TERRA_Floating_Island.glb`,
  это исходник Terra (`R-V-109`);
- `visual/buildings orig/`, `visual/units/`, `assets/website/units/` —
  HUD-арт, импортируется клиентом.

### Шаги

1. Перед началом проверить, что на отклонённое ничто не ссылается:
   ```
   Select-String -Path apps/**/*.ts,apps/**/*.tsx,packages/**/*.ts,art/**/*.ts,art/**/*.html -Pattern 'island_v3/runtime/|\./runtime/|island\.glb|snapshots/' -ErrorAction SilentlyContinue
   ```
   Единственная законная ссылка после I1 должна отсутствовать. Если что-то
   нашлось — сначала расшить, потом выносить.
2. Убрать из индекса, сохранив на диске:
   ```
   git rm -r --cached art/island_v3/runtime
   ```
3. Перенести в корзину (не удалять):
   ```
   $trash = "C:\Users\sk640\corporator-trash-20260918\rejected-island"
   New-Item -ItemType Directory -Force -Path $trash | Out-Null
   Move-Item -LiteralPath "art\island_v3\runtime" -Destination $trash
   Move-Item -LiteralPath "art\island_v3\snapshots" -Destination $trash
   Move-Item -LiteralPath "art\island_v3\island.glb" -Destination $trash
   Move-Item -LiteralPath "art\island_v3\island_grid_backup.glb" -Destination $trash
   Move-Item -LiteralPath "art\island_v3\_rollback" -Destination $trash
   Move-Item -LiteralPath "art\island_v3\rollback" -Destination $trash
   Move-Item -LiteralPath "art\island_v3\reviews" -Destination $trash
   ```
4. Почистить `.gitignore`: строки `art/island_v3/island.glb`,
   `art/island_v3/island_grid_backup.glb`,
   `art/island_v3/snapshots/**/*.blend` больше не нужны, если файлов нет.
   Убирать по одной, проверяя `git status`.
5. Проверить, что живое на месте:
   ```
   (Get-ChildItem "art\island_v3\runtime_terra19" -Recurse -File).Count   # ожидается 57
   Test-Path "art\island_v3\maps\terra-look.json"                          # ожидается True
   ```

### Гейт

```
python content/lint.py
python content/build.py
npx vitest run packages/render
npx vite build --config apps/client/vite.config.ts
```
плюс открыть `map.html` и `view.html`.

### Готово, когда

- отклонённого острова нет ни в индексе, ни в рабочем дереве;
- `runtime_terra19` цел, 57 файлов;
- клиент собирается, тесты render зелёные;
- освобождено около 780 МБ.

---

## I3. Решить судьбу Blender-исходников

**Закрыто 2026-09-19.** Владелец: оставить как есть. Файл
`art/island_v3/island.blend` (**307.4 МБ**) на месте, не выносили.
Автосейвов `*.blend1` в `island_v3/` нет. В git нет, HUD и клиент не читают.
Фаза острова закрыта. Историю git ради места не переписывали.

Измерение на закрытии: план писал 4.4 ГБ `*.blend`/`*.blend1`; на диске
остался один `island.blend`. Вариант «вынести автосейвы» совпал с «оставить»:
`*.blend1` уже не было.

---

# ЧАСТЬ H. Довести HUD и API до играбельного состояния

**Это самая большая и самая важная часть плана.** Задачи H1–H9 отменяют и
заменяют прежние M1, M2, M3 — не делать их отдельно.

## H0. Что именно не работает и почему — читать перед любой задачей H

### Диагноз

HUD не сломан. HUD честно рисует «нет данных», потому что **API отдаёт
пустоту**, а **клиент сам блокирует половину действий**. Движок при этом
почти всю игру уже считает. Это задача проводки, а не разработки механик.

Три факта, каждый проверяемый командой:

**Факт 1. API заполняет 9 каналов состояния из 21.**
`services/api/src/http.ts`, функция `projectState` (строки ≈80–143). На
строках 93–95 она создаёт **все** источники как пустые объекты `{}`, затем
заполняет только: `tick.capital`, `tick.energy`, `tick.compute`,
`aggregate.payroll_ratio`, `wallet.protocol_eth_in_flight`,
`wallet.protocol_vault_corp`, `wallet.protocol_studio_eth`,
`seasons.prize_basket`, `log.events`.

Остаются пустыми **двенадцать**: `aggregate.gdp`, `aggregate.happiness`,
`aggregate.stability`, `fragments.city_ledger`,
`oracle.district_efficiency`, `oracle.stock_price`,
`seasons.influence_rank`, `tick.agent_state`, `tick.building_level`,
`wallet.chain`, `wallet.corp_balance`, `wallet.stake_tokens`.

**Факт 2. API исполняет 4 команды из 15.**
`packages/protocol/src/routes.ts` объявляет 15 маршрутов. `applyLive` в
`services/api/src/commit.ts:190–194` обрабатывает четыре: `hire`,
`claim_prize`, `build`, `set_objective`. Остальные одиннадцать
(`deposit`, `withdraw`, `buy_stock`, `stake`, `open_district`,
`unlock_tier`, `pick_node`, `merge`, `upgrade`, `claim_fragment`, `noop`)
маршрут имеют, обработчика — нет, и возвращают `undefined`.

**Факт 3. Клиент блокирует 16 намерений из 19.**
`apps/client/src/hud/liveAdapter.ts:8` —
`LIVE_MUTATION_EFFECTS = ["build", "hire", "set_objective"]`. В таблице
`BY_INTENT` (строки 107–131) двенадцать намерений помечены
`refusal-only` и четыре `unsupported`. Любое из них проходит через
`unavailable()` (строка 355) и отдаёт `FEATURE_NOT_IN_V1`, **не доходя до
сети**.

### Почему кнопки не оживают сами

У каждого действия в паке есть список предусловий `requires`. Проверить:

```
python -c "import json;p=json.load(open('content/out/pack.json',encoding='utf-8'));a=p['sections']['screens']['actions'];print(json.dumps(a['bank_withdraw'],ensure_ascii=False,indent=2))"
```

У `bank_withdraw` это `not_demo_withdraw`, `wallet`, `capital`,
`bank_open`, `bank_weekday`, `bank_limit`. Гейт `bank_limit` считается от
`bankLimitLive`, которое API **не присылает**. Значит гейт неразрешим,
кнопка не может стать активной, и никакая правка вёрстки этого не изменит.

Вот полная цепочка играбельности, и рвётся она в двух местах:

```
движок считает  →  API проецирует  →  клиент читает  →  гейт requires
   ГОТОВО           РВЁТСЯ (H1)      ГОТОВО           РВЁТСЯ (H4)

игрок жмёт  →  адаптер постит  →  API исполняет  →  снимок обновился
  ГОТОВО        РВЁТСЯ (H3)       РВЁТСЯ (H2)        ГОТОВО
```

### Что движок уже умеет — не писать заново

Проверить: `Get-Content packages/engine/src/index.ts`.

| нужно для | готовая функция в `@corporator/engine` |
|---|---|
| `aggregate.gdp` | `gdpDay(payouts)` |
| `aggregate.happiness` | `happinessOfCity(cfg, state, city)`, `happinessBps(terms, weights, bps)` |
| `aggregate.stability` | `stabilityBps` (`fragments.ts` и `seasons.ts`) |
| население, уровень | `population`, `cityLevelFromPopulation`, `stickyCityLevel`, `housingCapacityOf` |
| слоты функций | `buildSlotsOf`, `ordinaryActiveCount` |
| производительность | `productivityBps(realized, nominal, bps)` |
| депозит | `mintFromBacking` |
| банк, лимиты, ваучер | `authorize`, `present`, `expire`, `remainingGlobal`, `bankShareBps`, `globalCapWei`, `personalCapWei`, `resetDayCounters` |
| анстейк, возврат | `unstake(city, ticker, amount, cityTime, graceHours, sMin)`, `refundAllowed` |
| research | `advanceResearch(cfg, state)`, `researchProgressStep` |
| фрагменты | `settleFromData`, `settleCities`, `windowSettleDue`, `fragmentGrossBase` |
| сезон, влияние, ранги | `seasonSettle`, `zipfPayout`, `zipfWeights`, `shareFloor`, `iDay`, `intensityBps`, `coverageBps`, `positiveDay`, `accumulateDay` |
| котировки DEX | `cpmmBuyCorp`, `cpmmSellCorp` |
| призы | `claimEveryAsset`, `claimPrize`, `refundPlayer`, `returnUnsettled` |
| оффлайн | `clipOfflineHours(base, added, hardCap)` |
| XP | `awardPaidTick`, `awardTrain`, `grantWithRemainder` |

**Правило части H: если функция есть в этой таблице — вызывать её, а не
писать свою.** Своя реализация той же формулы — дефект «одно число в двух
местах».

### Что объявлено обязательным

Пак объявляет **34** экрана/панели/флоу, из них **33 — `v1: live`** и
только `missions` — `stub`. Плюс **39 действий** (38 live, `missions_start`
stub), **45 полей**, **21 источник состояния**. Проверить:

```
python -c "import json,collections;p=json.load(open('content/out/pack.json',encoding='utf-8'));s=p['sections']['screens'];print(len(s['screens']),len(s['actions']),len(s['fields']),len(s['state_sources']));print(collections.Counter(v['v1'] for v in s['screens'].values()))"
```

То есть играбельным должно быть почти всё. `missions` — единственное
законное исключение, `missions_live` остаётся `0`.

### Повторяемый рецепт: как подключить один канал

Этому рецепту следовать буквально, он одинаков для всех задач H1.

1. Взять один `state_source` id из `packages/protocol/src/channels.ts`.
2. Найти, какое поле `ClientSnapshot` его ждёт:
   `apps/client/src/hud/snapshot.ts` (тип на строках 11–62).
3. Найти, как клиент его читает: `apps/client/src/hud/boot.ts`,
   `snapshotFromEnvelope`.
4. Найти в `packages/engine/src/index.ts` функцию, которая это считает.
5. В `projectState` (`http.ts`) присвоить `sections["<id>"] = <значение>`.
   Форму брать из того, что читает клиент, и **не менять** её.
6. Прогнать `npx vitest run apps/client services/api`, открыть клиент и
   убедиться, что панель ожила.
7. Если значения в движке нет — **оставить канал пустым**. Пустая панель с
   причиной лучше выдуманного числа. Это закон: HUD показывает причины, а
   не молчаливые нули.

### Повторяемый рецепт: как подключить одну команду

1. В `services/api/src/commit.ts` написать `applyXxx(ctx, state, city, body)`
   по образцу `applyHire` (строки 27–40) или `applyBuild` (116–170).
2. Проверять предусловия **до** мутации и возвращать `errResult(ctx, state,
   codes.<КОД>)`. Коды брать из `packages/protocol/src/codes.ts`, новых не
   выдумывать.
3. Внутри вызывать готовую функцию движка из таблицы выше.
4. Зарегистрировать строкой `if (effect === "xxx") return applyXxx(...)` в
   `applyLive` (строки 190–194).
5. Вернуть `okResult(ctx, state, { effect: "xxx", ... })`.
6. Только после того, как API отвечает, снять блокировку на клиенте:
   в `liveAdapter.ts` поменять `support` с `refusal-only` на `"live"` и
   добавить effect в `LIVE_MUTATION_EFFECTS` (строка 8).
7. **Порядок обязателен.** Снять блокировку раньше обработчика — значит
   выпустить кнопку, которая шлёт запрос в пустоту.

### Красные линии части H

- Не выдумывать числа. Всё из пака и движка.
- Не считать экономику в клиенте. Клиент только показывает.
- Не менять форму `DecisionRecord`, `layout_version`, `creator_tax_bps`.
- Не трогать `C-20`, `C-01`, `C-22`.
- `claim_prize` включать **только** вместе с H2.11 и M6. Тест
  `hud_truth.test.ts` это охраняет намеренно.
- Не включать `missions`.
- Не возвращать `bottom_menu`: дизайн-система запрещает постоянный нижний
  док, даже если ключ в паке есть. Действия `menu_*` вешать на контекстные
  входы.

---

## H1. Заполнить двенадцать пустых каналов состояния

**Статус:** закрыто 2026-09-19. `projectState` проецирует все 21 источник; `wallet.chain` / `wallet.corp_balance` честно пустые без `launch.deployed`. Порог ранга — `qualifyDays` от `pack.sections`, не от пустого `cfg.data`.

Разбито на четыре независимые задачи — их можно делать параллельно разными
агентами. Каждая правит одну и ту же функцию `projectState`, поэтому
**согласовать порядок и не править файл одновременно**.

Общий гейт для всех H1.x:

```
npx tsc --noEmit -p services/api
npx tsc --noEmit -p apps/client
npx vitest run services/api apps/client
python content/lint.py
```

### H1.1. Агрегаты города: GDP, happiness, stability, productivity

Каналы: `aggregate.gdp`, `aggregate.happiness`, `aggregate.stability`.
Поля снимка: `gdp`, `happiness`, `stability`, `productivity`.

Шаги:

1. Прочитать `packages/engine/src/aggregates.ts` целиком. Там
   `gdpDay(payouts)`, `happinessOfCity(cfg, state, city)`,
   `productivityBps(realized, nominal, bps)`.
2. Прочитать `packages/engine/src/fragments.ts`, функция
   `stabilityBps(validTicks, data, ticksDay)`.
3. Понять, где движок хранит вход: `gdp_day`, `valid_ticks`, счётчики
   выплат в объекте города. Смотреть `packages/engine/src/tick.ts`, как
   они пишутся.
4. В `projectState` присвоить три секции. `bps` брать из пака, а не писать
   `10000`.
5. Проверить в HUD: панель `overview` и `city_card` должны показать числа
   вместо «Unavailable».

Порог интерфейса: happiness ниже 50% — красная строка, stability ниже 70% —
подсказка про energy. Пороги в паке (`happiness_penalty_threshold_bps`,
`stability_hint_threshold_bps`), не в коде.

### H1.2. Здания и агенты: то, без чего город выглядит мёртвым

Каналы: `tick.building_level`, `tick.agent_state`.
Поля снимка: `functions` (массив `{id, nameKey, statusKey}`), `agents`
(массив `{id, idleKey}`), `population`, `cityLevel`.

Это **самый заметный игроку пробел**: из-за него `FunctionStrip`,
`agents.tsx` и `building_card.tsx` показывают заглушки.

Шаги:

1. Движок держит функции города в `city["functions"]` (массив строк
   `{id, level, deactivated, frozen}` — видно в `commit.ts:135–167`) и
   агентов в `city["agents"]` (`commit.ts:36–38`).
2. Форма, которую ждёт клиент, — в `snapshot.ts:38–51`. Поля `nameKey`,
   `statusKey`, `idleKey` — это **ключи строк**, не готовый текст.
   Локализацию делает клиент.
3. `statusKey` выводить из состояния функции: активна, деактивирована,
   заморожена. `idleKey` — это код простоя из `codes.ts` (`IDLE_NO_ENERGY`,
   `IDLE_NO_COMPUTE`, `IDLE_NO_AGENT`, `IDLE_WRONG_ROLE`). Простой обязан
   иметь **причину**; молчаливый ноль запрещён.
4. `population` — `population(occupiedJobs, populationPerJob, housingCapacity)`,
   ёмкость жилья — `housingCapacityOf(functions, thresholds, housingAdd)`.
5. `cityLevel` — `cityLevelFromPopulation(pop, thresholds, levelMax)`,
   затем `stickyCityLevel(current, derived)`. **Уровень не понижается сам**
   — это смысл `stickyCityLevel`, не обойти.

### H1.3. Кошелёк и рынок

Каналы: `wallet.corp_balance`, `wallet.chain`, `wallet.stake_tokens`,
`oracle.stock_price`, `oracle.district_efficiency`.
Поля снимка: `corp`, `stocks` (массив `{ticker, price, dayPct, effect}`),
`quoteLive`, `quoteAgeMs`.

Шаги:

1. Цены стоков приходят от `services/sampler`. Установить, что там живое, а
   что мок, и **не притворяться**, что цена живая: `quoteLive` должно быть
   `false`, когда источник мок или данные устарели.
2. Эффективность района — «погода отрасли», множитель 85–115%. Она **не**
   PnL игрока. Не выводить баланс игрока из цены стока — это прямой запрет
   канона.
3. `wallet.chain` и `corp_balance` — с цепи через `packages/chainport`.
   Без настроенных адресов оставить пустым, а не показывать ноль.
4. `quoteAgeMs` считать от `city_time`, не от `Date.now()`.

### H1.4. Сезоны и фрагменты

Каналы: `seasons.influence_rank`, `fragments.city_ledger`.
Поля снимка: `seasonLabel`, `periodLabel` (сейчас **всегда** `undefined` —
см. `boot.ts:127–128`), плюс новое поле под ранги.

Шаги:

1. `packages/engine/src/seasons.ts` уже считает всё: `accumulateDay`,
   `iDay`, `seasonSettle`, ранги `1..N`, Zipf. Смотреть строки ≈328–494.
2. Отдать в `seasons.influence_rank`: ранг, влияние, положительные дни,
   признак квалификации. Форму согласовать с H3 (экран лидерборда).
3. `fragments.city_ledger` — из `settleFromData` / `settleCities`.
4. `seasonLabel` и `periodLabel` — ключи строк, не готовый текст.
5. **Один слот на кошелёк.** Логика уже в движке, не дублировать.

---

## H2. Дописать одиннадцать обработчиков команд в API

Каждый пункт — отдельная задача. Делать по одному, следуя рецепту из H0.
После каждого — сразу H3 на тот же effect.

**Порядок исполнения именно такой:** от простого к деньгам.

### H2.1. `research_start`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Синтетический `commit:research_start` из осей `research.json` входит в `command_endpoints` через `screens.effective_actions` (id узлов в `screens.json` не пишутся, `L161`). API списывает Capital по `generated.balance.research_node_cost`, ставит `research_focus` и `research_progress=0`, выставляет `objective` в `cfg.research_objective`. `advanceResearch` в команде не вызывается: узел закрывает тик. Клиент шлёт `axis_id`, `support: "live"`.

Движок: `advanceResearch(cfg, state)`, `researchProgressStep`.
В `liveAdapter.ts` это сейчас `unsupported`, хотя маршрута
`/command/research_start` в `routes.ts` **нет**. Сначала проверить, есть ли
он в паке (`screens.json` действие research). Если маршрута нет — добавить
ключ в пак, поднять `pack_version`, прогнать `build.py` и `codegen.py`.
Экран: `research.tsx` — сейчас каталог живой, коммита нет.

### H2.2. `open_district`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/open_district` уже был в паке. API открывает район, если `stake_settled[ticker] ≥ s_min` из пака и `corp_held > 0`; `corp_held` не списывается (hop — `buy_stock`, H2.11). Демо — `WALLET_NOT_CONNECTED`. `city_level` в `requires` действия нет. Клиент шлёт `district_id`, `support: "live"`.

Открытие отрасли по стейку реального Stock Token. Предусловия — порог
стейка (количественный), уровень города. Коды отказа —
`STAKE_BELOW_THRESHOLD` и соседние в `codes.ts`.
Шесть районов фиксированы: NVDA→Compute, TSLA→Energy, AMZN→Logistics,
AAPL→Consumer, MSFT→Automation, COIN→Finance. Тикеры сменные, роли — нет.

### H2.3. `stake`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/stake` уже был в паке. API переносит токены из `tokens_held` в `stake_settled` до следующей кратности `stake_mult_step × S_min` (пак); район должен быть уже открыт. Движка `stake` нет — обратное `unstake` не вызывается, серверную команду `unstake` не изобретать. Клиент шлёт `district_id`, `support: "live"`.

Доп. стейк в уже открытый район. Действие `district_stake_more`,
`requires: ["stake_mult"]`. Порог кратности — из пака.

### H2.4. `unlock_tier`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/unlock_tier` уже был в паке. API открывает следующий тир района (`city.district_tiers`, 0 = нет); тир 1 стоит 0 Capital, тиры 2 и 3 — `generated.progression.tier_cost`. Гейты — `generated.progression.tier_gates` (`city_level_req`, `stake_mult × S_min`, `requires_prev`). Район должен быть открыт. Дивиденд тира читается из `generated.progression.progression_dividends` и кладётся в `city.nodes` для стека. `body.tier` игнорируется: только current+1. Демо не требует кошелька. Клиент шлёт `district_id`, `support: "live"`.

Тир 1 открывается только стейком и стоит 0 Capital. Тиры 2 и 3 стоят
Capital по таблице research. Источник — `docs/PROGRESSION.md` и
`generated.progression.tier_cost`.

### H2.5. `pick_node`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/pick_node` уже был в паке. API берёт `node_id` из `generated.progression.progression_nodes`, кладёт узел в `city.nodes` (ключ и magnitude из пака), отказывает `NODE_SIDE_LOCKED` на exclusive-паре, `TIER_NOT_UNLOCKED` если тир района ниже, `DISTRICT_LOCKED` если район закрыт. Респека нет. Capital не списывается (`spend=none`). Клиент шлёт `node_id` и `district_id`, `support: "live"`, предупреждение `UI_NO_RESPEC` до клика.

Выбор узла прогрессии. Эксклюзивные узлы **без респека** — выбрал и всё.
Предупредить игрока до нажатия, а не после.

### H2.6. `merge`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/merge` уже был в паке. API берёт `merge_id` из `generated.progression.progression_merges`, списывает `generated.progression.merge_cost`, кладёт оба эффекта в `city.nodes` величиной из пака (`C-20`: полный тир-1 дивиденд, `DESIGN.md` не править), пишет `city.merges`. Отказы: `DISTRICT_LOCKED`, `TIER_NOT_UNLOCKED` если тир ниже `merge_min_tier`, `MERGE_MATCHING_BLOCKED` на занятом районе или при `merge_active_cap`, `NOT_ENOUGH_CAPITAL`. Респека нет. Синергийная пара в merge не входит (`L59`). Клиент шлёт `merge_id` и `district_id`, `support: "live"`, предупреждение `UI_NO_RESPEC` до клика.

Слияние двух районов. Девять непокрытых пар, `merge_active_cap = 3`.
**Внимание: `C-20`.** `DESIGN.md` §4.8 говорит «половина тир-1 дивиденда»,
генератор берёт полный. Брать значение **из пака**
(`generated.progression.progression_merges`), в код число не писать, текст
`DESIGN.md` не править.

### H2.7. `upgrade`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/upgrade` уже был в паке. API берёт `building_id`, списывает `generated.balance.level_cost` следующего уровня (та же таблица, что `buildCost` для L1), пишет `functions[].level`. Отказы: `CITY_LEVEL_TOO_LOW` если функции нет, она выключена или это `city_hall`; `DISTRICT_FROZEN`; `TIER_NOT_UNLOCKED` на `building_level_max`; `NOT_ENOUGH_CAPITAL`. `body.level` игнорируется. Клиент шлёт `building_id`, `support: "live"`.

Апгрейд уровня здания. Стоимость — `generated.balance.level_cost`, уже
читается в `buildCost` (`commit.ts`). Переиспользовать.

### H2.8. `claim_fragment`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/claim_fragment` уже был в паке. API: демо `DEMO_NO_CLAIM`; если окно due — `windowSettleDue` + `settleCities` по всем городам с леджером/пулом (кап N≥2 не обойти поселением одного города); затем `fragment_owed` → `tokens_held`. Пустой пул — `FRAGMENT_POOL_EMPTY`, леджер сгорает. Σ=0 — `FRAGMENT_NO_CLAIMS`, пул не трогать. Не ERC-20, не hop, не `claim_prize`. Клиент `support: "live"`, extra пустой.

Фрагменты: окно `fragment_window_city_days` (7 суток города), не горизонт фонда `/14`. `windowSettleDue`, `settleFromData`.
Начислять только за работу в маячных зданиях и только оплаченные тики.

### H2.9. `deposit`

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. Маршрут `/command/deposit` уже был в паке. API берёт `amount` $CORP, требует кошелёк, списывает `corp_held`, минтит Capital только через `mintFromBacking` (сбор vault, dest — город, не фонд). Часы банка не режут. Клиент шлёт `amount`, `support: "live"`, review на банке сохранён.

**Первая денежная команда. Дальше — осторожно.**

Движок: `mintFromBacking`. Инвариант кассы:

```
Capital у игроков + Capital в фонде ≤ $CORP в vault × 2000
```

Любой минт Capital проходит **только** через депозит `$CORP` в vault. Кода,
который минтит Capital без депозита, быть не должно. Курс минта плавает, но
не выше 2000; вниз оракул двигает сразу, вверх — не быстрее шага за сутки
города.

После правки обязательно: `python content/build.py` и сверить числами —
вход `200` bps, выход `910` bps, круг `1445` bps в полосе `[1400, 1600]`.

### H2.10. `withdraw` через ваучер

**Статус:** закрыто 2026-09-19 вместе с H3 для этого effect. API `commit:withdraw` проверяет демо, кошелёк, часы, воскресенье и дневной лимит, затем `authorize` → `present`. Capital жжётся, $CORP из vault в `corp_held` по `bank_markup_bps`. Тиковый `bankWithdraw` не вызывается: `C-22` оставлен. Клиент шлёт `amount`, `support: "live"`, review на банке сохранён.

Движок: `authorize` → `present` → `expire`, плюс `remainingGlobal`,
`bankShareBps`, `globalCapWei`, `personalCapWei`, `resetDayCounters`.

Правильная последовательность: `authorize` резервирует покрытие, `present`
его расходует, `expire` освобождает. Двойного покрытия быть не может.

Банк работает по **личному** времени города: часы 08:00–20:00, воскресенье
города закрыто, глобальная ёмкость дня, резервирования переживают границу
суток.

**Известное расхождение `C-22`:** `bankWithdraw` в движке заполняет
`withdraw_intent` сразу, минуя ваучер. Не «чинить» молча — либо закрыть
осознанно вместе с этой задачей и записать решение, либо оставить и не
трогать.

Вход всегда дешевле выхода. Trader не выбивает спред лучше `2130:1` —
потолок, посадкой агента не обойти.

### H2.11. `buy_stock` и `claim_prize`

**Статус:** закрыто 2026-09-19 вместе с H3 для `buy_stock`. `claim_prize` на клиенте не снят (M6). API `commit:buy_stock` проверяет кошелёк, тикер района и `corp_held`, затем отказывает `EXCHANGE_HOP_UNAVAILABLE`: котировка мок (`quoteLive = false`), сделку не исполнять. `cpmmBuyCorp` / `cpmmSellCorp` не зовутся, пул и `tokens_held` не двигаются. Клиент шлёт `ticker` и `amount`, `support: "live"`; `liveQuoteExecutable` остаётся ложью.

`buy_stock`: котировка и покупка идут **вне тика**. Математика кривой —
`cpmmBuyCorp` / `cpmmSellCorp`. Пока источник котировок мок — держать
`quoteLive = false` и не давать исполнить сделку.

`claim_prize`: API уже умеет (`applyClaimPrize`, `commit.ts:52–88`).
Разблокировать на клиенте **только** после M6 (реальная выдача). До этого
`refusal-only` — это не баг, а честность: `launch.json` `deployed` пуст,
выдать приз физически нечем.

---

## H3. Снимать блокировки на клиенте — строго по факту готовности API

**Статус:** `research_start` снят 2026-09-19 вместе с H2.1; `open_district`
снят 2026-09-19 вместе с H2.2; `stake` снят 2026-09-19 вместе с H2.3;
`unlock_tier` снят 2026-09-19 вместе с H2.4; `pick_node` снят 2026-09-19
вместе с H2.5; `merge` снят 2026-09-19 вместе с H2.6; `upgrade` снят
2026-09-19 вместе с H2.7; `claim_fragment` снят 2026-09-19 вместе с H2.8;
`deposit` снят 2026-09-19 вместе с H2.9; `withdraw` снят 2026-09-19 вместе с H2.10; `buy_stock` снят 2026-09-19 вместе с H2.11.
Остальные effect — только после своего пункта H2, не пачкой. `claim_prize`
не снимать до M6.

Для каждого effect, закрытого в H2:

1. В `apps/client/src/hud/liveAdapter.ts` в таблице `BY_INTENT`
   (строки 107–131) заменить `support: "refusal-only"` на `support: "live"`.
2. Добавить effect в `LIVE_MUTATION_EFFECTS` (строка 8).
3. Проверить, что `extraFromIntent` (строки 419–467) кладёт в тело нужные
   поля. Для `deposit`/`withdraw` это `amount`, для `buy_stock` —
   `ticker` и `amount`.
4. Прогнать `npx vitest run apps/client/test/hud_truth.test.ts`.

**Не снимать блокировку пачкой.** Один effect — одна правка — один прогон.
Иначе нельзя понять, какая кнопка соврала.

`unstake` не включать: команды нет ни в протоколе, ни в API, и по канону
анстейк холдерский, on-chain. Серверную команду `unstake` не изобретать.

---

## H4. Сделать гейты `requires` работающими

**Статус:** закрыто 2026-09-19. `evaluateActionGate` в `apps/client/src/hud/gates.ts`
ходит по `requires` пака: первое непройденное blocking — код отказа, нет поля
в снимке — `UI_UNAVAILABLE` («нет данных», не «нельзя»). `ActionButton` и
`BuildScreen` глушат кнопку этой причиной. Warning `building_hours` не
блокирует. `demo_blocked` по-прежнему режет вывод и призы. `claim_prize` на
клиенте `refusal-only` до M6. Пак не поднимали. Ниже исходная задача.

**Это ядро играбельности.** Кнопка должна сама знать, можно ли её нажать, и
если нельзя — сказать почему.

### Шаги

1. Выгрузить все предусловия:
   ```
   python -c "import json,collections;p=json.load(open('content/out/pack.json',encoding='utf-8'));a=p['sections']['screens']['actions'];c=collections.Counter();[c.update(v.get('requires') or []) for v in a.values()];print(c)"
   ```
2. Для каждого предиката определить, из какого поля снимка он считается:
   `wallet`, `corp`, `capital`, `agent_slot`, `build_slot`, `city_level`,
   `bank_open`, `bank_weekday`, `bank_limit`, `stake_mult`, `hop_priced`,
   `not_demo_withdraw`, `not_demo_prize` и остальные.
3. Написать **одну** чистую функцию-оценщик: на входе id действия и снимок,
   на выходе либо «доступно», либо код отказа первого непройденного
   предусловия. Порядок проверки брать из пака, чтобы код отказа был
   предсказуемым.
4. Подключить её в `ActionButton`, чтобы кнопка была `disabled` с понятной
   причиной, а не молча падала после нажатия.
5. `demo_blocked: 1` учитывать отдельно: демо-аккаунт не выводит и не
   забирает призы. Барьер демо не ослаблять, прогресс демо в кошелёк не
   переносить.
6. Если предусловие неразрешимо, потому что данных нет — показывать это как
   «нет данных», а не как «нельзя».

### Гейт

Тест на каждый предикат: состояние, в котором он **не** проходит, даёт
ожидаемый код отказа. Предикат без такого теста считается непроверенным.

---

## H5. Приёмка каждого экрана по отдельности

**Закрыто 2026-09-19.** Инвентарь 34 объектов пака (15 экранов + 11 панелей + 8 флоу).
Живые входы без нижней полосы: клавиши 1–6, сезон → лидерборд, статус города → Industries,
каталог районов внутри Industries, исследования — таб Overview. `build` закрыт и больше
не шлёт `tile_x`/`tile_y`. `settings` не возвращали. `claim_prize` по-прежнему refusal-only.
Мёртвые файлы (`Topbar.tsx`, `CapitalSlot.tsx`, `CityCard.tsx`, `BuildingDetailLook.tsx`,
`IndustriesFromDistricts.tsx`, `primitives.ts`) на месте: входы перенесены, удаление — отдельным шагом.
Пиксельные PNG в репозиторий не клались: приёмка — `apps/client/test/h5.test.ts` и живой `hud-preview.html`
(сезон → лидерборд empty `not_qualified_yet`, Industries → NVDA `district_card`, клавиши 2/3 → agents/exchange).

| поле | что проверить |
|---|---|
| id | из пака |
| достижим | есть живой вход из интерфейса, не из мёртвого файла |
| данные | все поля из `fields` приходят с сервера |
| действия | все `actions` экрана исполняются или честно отказывают с кодом |
| состояния | loading, empty, error реализованы, не зашиты константой |
| отказы | коды из пака показываются текстом, а не общим `UI_UNAVAILABLE` |
| вердикт | играбельно / частично / заглушка |

| id | достижим | данные | действия | состояния | отказы | вердикт |
|---|---|---|---|---|---|---|
| build | нет (`resolveHudRoute` пуст) | каталог пака | `build_place` закрыт с экраном | empty по каталогу | гейт H4 | заглушка |
| agents | клавиша 2 | roster / idle | hire live; `agents_open_card` | empty по `agentsKind` | коды пака | играбельно |
| districts | Industries + `data-open-district` | шесть районов пака | open / card / exchange | empty по списку | DISTRICT_LOCKED | играбельно |
| exchange | клавиша 3; `districts_to_exchange` | quote / hop | `buy_stock` live | stale quote | EXCHANGE_HOP_* | играбельно |
| bank | клавиша 4; manage funds | лимит / курс | deposit / withdraw live | hours / limit | BANK_* | играбельно |
| research | таб Overview | оси пака | `research_start` live | empty по осям | CITY_LEVEL / CAPITAL | играбельно |
| missions | нет | stub | `missions_start` blocked | empty | FEATURE_NOT_IN_V1 | заглушка |
| leaderboard | клик сезона | rank / basket | claim refusal-only до M6 | empty = не qualified | PRIZE_* | играбельно |
| building_card | manage здания | clip / level | upgrade live | empty без object id | TIER_NOT_UNLOCKED | играбельно |
| agent_card | `agents_open_card` | idle | `set_objective` | empty без агентов | warning idle | играбельно |
| district_card | Industries look / open_card | tree / stake | stake / tier / node / merge / claim | empty без районов | STAKE_* / TIER_* | играбельно |
| offline_return | авто-оверлей при возврате | клип окна из пака + `clipOfflineHours` | continue dismiss | cap code | IDLE_OFFLINE_CAP_REACHED | играбельно |
| onboarding_demo | авто на демо-входе | `pack.onboardSteps` | next / wallet offer | empty по шагам | DEMO_* | играбельно |
| wallet_connect | LoginRoot, не этот экран | четыре состояния на логине | pack-экран не логинит | empty | WALLET_* | играбельно |
| settings | нет (дизайн) | pack rows | поверхность `data-settings-active=0` | n/a | UI_UNAVAILABLE | заглушка |
| topbar | всегда | Capital / часы / плашка | сезон, notify, wallet→банк | stale freeze | WALLET_* | играбельно |
| overview | клавиша 1; view all | GDP / payroll | табы workspace | missing → Unavailable | UI_UNAVAILABLE | играбельно |
| active_events | нет отдельной панели | — | — | — | — | частично |
| districts_panel | Industries | efficiency / market | open district | unavailable fields | DISTRICT_LOCKED | играбельно |
| city_card | правый рейл | population / level | details + Industries | missing → Unavailable | UI_UNAVAILABLE | играбельно |
| agents_panel | экран agents | roster | hire / card | empty / unavailable | NO_FREE_AGENT_SLOT | играбельно |
| log_panel | Journal; notify | events / attest | view all | loading только journal | UI_EVENTS_* | играбельно |
| district_overview | нет схемы | — | — | — | — | частично |
| scene | всегда | Terra | select / manage | RENDER_NO_GPU | — | играбельно |
| stock_bar | числа на Exchange/Industries | dual numbers | buy на exchange | no permanent bar | — | частично |
| bottom_menu | нет дока; клавиши 1–6 | menu_* в паке | shortcuts | n/a | — | заглушка |
| flow_onboard_clock | автофлоу демо | шаг пака | next | — | — | играбельно |
| flow_onboard_seat | автофлоу демо | шаг пака | next | — | — | играбельно |
| flow_onboard_payout | автофлоу демо | шаг пака | next | — | — | играбельно |
| flow_onboard_idle | автофлоу демо | шаг пака | next | IDLE_NO_ENERGY | — | играбельно |
| flow_onboard_bank | автофлоу демо | шаг пака | next | — | BANK_* | играбельно |
| flow_onboard_wallet | LoginRoot / offer | шаг пака | DEMO_NO_WITHDRAW | — | DEMO_NO_WITHDRAW | играбельно |
| flow_return_summary | авто-оверлей | клип окна | — | IDLE_OFFLINE_CAP_REACHED | — | играбельно |
| flow_return_continue | dismiss overlay | — | navigate, без commit | — | — | играбельно |

Известные дыры этой задачи закрыты: `App` loading через `workspaceLoading` (только journal),
`leaderboard` empty = `influenceQualified !== true`, районы достижимы из Industries,
исследования живы табом Overview, `tile_x`/`tile_y` сняты с закрытого `build`,
Settings не возвращали, у Industries есть вход (клавиша 5 и статус города).

---

## H6. Живые обновления вместо ручного обновления страницы

**Закрыто 2026-09-19.** Клиент подписывается на `WS /city/{city_id}/ws`
(`apps/client/src/hud/wsFeed.ts`, `LiveRoot.tsx`). Сообщения класса
`tick` / `aggregate` / `price` / `log` / `efficiency` патчат снимок только
своими `state_source`; пульс `{ pack_hash }` — живость, `city_time` с сокета
часы не двигает. Обрыв — `data-link="stale"` с возрастом и ожиданием до
следующего пульса (`wsHeartbeatMs`). Полный `GET /state` остаётся на мутациях,
не на каждом кадре сокета. API по-прежнему шлёт heartbeat, не патчи классов —
публикация секций при тике остаётся M7.

---

## H7. Онбординг, оффлайн-возврат и кошелёк

**Закрыто 2026-09-19.** Восемь флоу `v1: live` на клиенте.

Онбординг демо ведёт по `pack.onboardSteps` (не хардкод списка), авто-старт
на первом демо-входе, `onboard_next` шагает по паку. Прогресс в
`sessionStorage` ключом города: демо-город и кошелёк не пересекаются.

Оффлайн-возврат — авто-оверлей, если `city_time` вырос с прошлого захода.
Окно: база + дивиденды Automation + один merge extra; клип —
`clipOfflineHours` из `@corporator/engine`. Превышение —
`IDLE_OFFLINE_CAP_REACHED`. Continue закрывает оверлей, без `commit`.

Живой вход кошелька — `LoginRoot` (нет провайдера / чужая сеть / spinner /
сессия). Pack-экран `wallet_connect` остаётся биекцией L358 и не логинит.

---

## H8. Сквозной тест играбельности

**Закрыто 2026-09-19.** `apps/client/test/h8.test.ts`:

- цикл на фикстурах: Capital / GDP / happiness / агент / здание / район /
  лидерборд / банк видны на экранах, не только в снимке;
- один `city_time` → тот же снимок и тот же кадр Overview;
- `catchUp` ≡ пошаговый `tick` (байты `DecisionRecord` и `tick_index`);
- `Date.now` / несидированный `Math.random` нет на пути тика и `buildHud`;
- pack-действия `v1: live` + `commit:*` живые на клиенте, кроме
  `leaderboard_claim` (`claim_prize` refusal-only до M6).

---

## H9. Отчёт о готовности HUD

**Закрыто 2026-09-19; провод до запуска дожат 2026-09-19.** Счёт из кода и пака (`apps/client/test/h9.test.ts`),
не из прозы. `launch.deployed` пуст: hop и клейм на клиенте зажигаются от заполненных адресов и env, без второго прохода кода. `build` / `settings` / `missions` / `bottom_menu` не работа. Пак не поднимали. `launchToken` не подписывали.

| метрика | было 2026-09-18 | сейчас 2026-09-19 | цель |
|---|---|---|---|
| каналов состояния заполнено | 9 / 21 | 21 / 21 (`wallet.*` честно `{}` без RPC) | 21 / 21 |
| команд исполняет API | 4 / 15 | 16 `applyLive` включая `claim_prize`; `noop` stub | 15 / 15 |
| намерений живых на клиенте | 3 / 19 | 15 / 19; `claim_prize` live при заполненном `launch.deployed` | 15 / 19 (без `unstake`, `present_voucher`) |
| действий пака работает | 3 / 39 | 38 / 39 после `deployed` (`missions_start` stub) | 38 / 39 (кроме `missions_start`) |
| экранов играбельно | 9 / 15 (инвентарь 34 / 34, H5) | 29 / 34 (pack `v1` 33 / 34; build/settings/missions/bottom_menu закрыты, `stock_bar` не полоса) | 33 / 34 |
| полей снимка приходит | ~10 / 30 | 38 / 40 (`quoteAgeMs` / `quoteCorpEth` только при hop-ready) | 30 / 30 |

Именованные дыры, которые остаются честными до запуска (код уже на месте):

- `wallet.chain` и `wallet.corp_balance` — `{}` без RPC и адресов контрактов;
- Confirm биржи и `oracle.stock_price.live` — только `feed_live` + RPC + `CORPORATOR_HOP_URL`; мок стоки не минтит;
- `claim_prize` / `leaderboard_claim` live на клиенте, когда все пять `launch.deployed` непусты;
- экраны: `missions` stub пака; `build` / `settings` / `bottom_menu` не работа (решение владельца); `stock_bar` — числа на Exchange/Industries, не постоянная полоса;
- снимок: `quoteAgeMs` и `quoteCorpEth` пусты, пока hop не исполняется. Тип `ClientSnapshot` вырос относительно цели 30.

Готовность HUD к запуску = владелец заполняет `launch.deployed` и env (RPC, hop URL), пересобирает пак; второго кодирования каналов/кнопок нет. M8 закрыт 2026-09-19.

---

# ЧАСТЬ M. Доделать механики до запуска

**M1, M2 и M3 заменены задачами H1–H5.** Не исполнять их отдельно:
проекция состояния — H1, вход в лидерборд — H5, экран лидерборда — H1.4
плюс H5. M4–M8 закрыты 2026-09-19.

Порядок внутри части важен: M1 и M2 разблокируют всё остальное, потому что
без них HUD не видит данных, а лидерборд нечем наполнить.

---

## M1. Расширить проекцию состояния в API

**Это узкое горлышко всей игры.** Пока оно не расшито, HUD честно рисует
«Unavailable» почти везде, и кажется, что сломан интерфейс, хотя данных
просто не присылают.

### Что сейчас

`services/api/src/http.ts`, функция `projectState`, строки ≈80–143.
Заполняет только: capital, energy, compute, `payroll_ratio`,
`seasons.prize_basket`, `log.events`.

Что HUD уже умеет читать, но не получает (см. `apps/client/src/hud/boot.ts`
строки ≈112–144 и `snapshot.ts`): агенты, функции зданий, `city_level`,
GDP, баланс `$CORP`, котировки, лимит банка, метки сезона и периода,
и главное — `seasons.influence_rank`.

Полный список каналов — `packages/protocol/src/channels.ts`. Там 20
источников; API заполняет 6.

### Шаги

1. Открыть `packages/protocol/src/channels.ts` и выписать все 20
   `StateSourceId`.
2. Открыть `content/params/screens.json` и найти для каждого экрана его
   `state_sources` — пак объявляет, какие источники какому экрану нужны.
3. Открыть `apps/client/src/hud/snapshot.ts` и посмотреть, какую форму
   HUD ожидает для каждого источника. **Форму не изобретать** — она уже
   задана типом `ClientSnapshot`.
4. Для каждого источника найти, откуда взять значение в состоянии движка.
   Движок уже считает почти всё: `packages/engine/src/aggregates.ts`,
   `seasons.ts`, `economy.ts`, `xp.ts`.
5. Дописать `projectState`, заполняя секции по одной. После каждой
   секции — прогнать клиент и посмотреть, что панель ожила.
6. **Ничего не выдумывать.** Если значения в движке нет — оставить источник
   незаполненным, чтобы HUD честно показал «Unavailable». Пустая панель
   лучше выдуманного числа: это прямой закон проекта («HUD показывает
   причины, а не молчаливые нули»).

### Гейт

```
npx tsc --noEmit -p services/api
npx vitest run services/api
npx vitest run apps/client
python content/lint.py
```

### Готово, когда

Живой город показывает агентов, функции, уровень города и GDP из API, а не
заглушки. Каждое число можно проследить до значения в движке.

---

## M2. Вернуть вход в лидерборд и клавиши навигации

Маленькая задача, но без неё лидерборд нельзя проверить руками.

### Что сейчас

- Единственный `onNavigate("leaderboard")` живёт в
  `apps/client/src/hud/topbar/Topbar.tsx:67` — а этот файл **мёртв**, у него
  ноль входящих импортов. Живой топбар — `IslandTopbar.tsx`.
- Живой `apps/client/src/hud/studio/StatusBarLook.tsx:28–30` рисует сезон
  обычным `<span>`, не кнопкой.
- Клавиши `1`–`6` объявлены в `apps/client/src/hud/navigation.ts:5–12`,
  функция `hudDestinationByShortcut` есть на строке 90, но её **никто не
  вызывает**: в `App.tsx` на `keydown` обрабатывается только `Escape`
  (строки ≈294–318).
- `menu_leaderboard` в паке висит на `bottom_menu`, а нижнее меню дизайн-
  системой запрещено и не рисуется.

### Шаги

1. В `StatusBarLook.tsx` сделать сезонный чип кнопкой, ведущей на
   `leaderboard`. Поведение подсмотреть в мёртвом `Topbar.tsx:61–68`, но
   **не возвращать сам `Topbar`** — только перенести намерение.
2. Кнопка должна быть доступной: реальный `<button>`, видимый фокус,
   понятное имя. Требования — `docs/reports/HUD_DESIGN_SYSTEM.md`.
3. В `App.tsx` в обработчик `keydown` добавить разбор цифр через готовую
   `hudDestinationByShortcut`. Не писать свою таблицу соответствий — она уже
   есть в `navigation.ts`.
4. Не добавлять нижнее меню. Дизайн-система запрещает постоянный bottom
   dock, даже если ключ `bottom_menu` в паке ещё есть.

### Гейт

```
npx vitest run apps/client/test/hud_workspace.test.ts apps/client/test/hud_quality.test.ts
npx tsc --noEmit -p apps/client
```

Добавить тест: «экран лидерборда достижим из живого chrome». Сейчас такого
теста нет, и именно поэтому регрессия прошла незамеченной.

### Готово, когда

Лидерборд открывается кликом по сезону и клавишей, и это закреплено тестом.

---

## M3. Довести лидерборд до рабочего состояния

**Важно понимать: лидерборд готов примерно на две трети.** Математика уже
написана и работает. Задача — соединить готовые куски, а не писать заново.

### Что уже есть и трогать не надо

`packages/engine/src/seasons.ts` полностью считает рейтинг:

- строки ≈328–352: собирает `influence` по городам, выбирает лучший город
  на кошелёк (один слот на кошелёк);
- строки ≈372–373: сортирует по влиянию, при равенстве — по `cityId`;
- строки ≈410–494: присваивает ранги `1..N`, считает выплаты по Zipf,
  формирует `AssetRankRow` с полями `influence`, `rank`.

Канал `seasons.influence_rank` объявлен в
`packages/protocol/src/channels.ts:12`. API умеет `claim_prize`
(`services/api/src/commit.ts:192`, функция `applyClaimPrize`).

### Чего не хватает — три провода

**Провод 1. Ранги не выходят из движка.**
`services/api/src/http.ts` заполняет `sections["seasons.prize_basket"]`
(строка ≈131) и **никогда** не заполняет `sections["seasons.influence_rank"]`.
Закрывается в рамках M1.

**Провод 2. Экран показывает корзину вместо таблицы.**
`apps/client/src/hud/screens/leaderboard.tsx` рисует три вкладки
(`season`/`farm`/`claims`) и в каждой — список шести тикеров с суммами.
Колонок ранга, влияния и квалификации нет вообще.

Что должно быть по `docs/reports/HUD_DESIGN_SYSTEM.md` (раздел про Season,
строки ≈4528–4601) и `docs/SCREENS.md:53`:

- ранг — **только если он реально пришёл**, не выдумывать место;
- влияние (Influence);
- положительные дни в формате X/6;
- квалификация по стейку на момент расчёта;
- один слот на кошелёк, с пояснением;
- пустое состояние `not_qualified_yet`;
- коды `PRIZE_*` на кнопке, а не общий `UI_UNAVAILABLE`.

Сейчас на строке 22 стоит `empty={false}` жёстко — пустое состояние
никогда не включается. Это надо связать с реальной пустотой.

**Провод 3. Клейм заблокирован на клиенте.**
`apps/client/src/hud/liveAdapter.ts:113` держит
`claim_prize: { effect: "claim_prize", support: "refusal-only" }`, а список
живых мутаций на строке 8 — только `["build", "hire", "set_objective"]`.
При этом сервер клейм реализует.

### Осторожно: тест намеренно закрепляет текущее поведение

`apps/client/test/hud_truth.test.ts:128` — тест
«does not treat claim_prize as confirmed custody». Он **специально**
фиксирует, что клиент не подтверждает получение приза.

Причина: приз — это реальный актив. Пока нет продакшн-пути передачи
(buyback, кошелёк, `PrizeTreasury` в сети), показывать игроку «приз ваш»
было бы враньём. `content/params/launch.json` `deployed` пуст — в мейннете
ничего нет.

Поэтому:

- **включать клейм только вместе с реальным путём выдачи** (см. M6);
- если включаете — переписать `hud_truth.test.ts:128` осознанно, объяснив
  в сообщении коммита, почему обещание стало правдой;
- если продакшн-путь ещё не готов — оставить `refusal-only` и вместо этого
  поправить `docs/SCREENS.md:53`, чтобы документ не обещал живой клейм.

### Шаги

1. Дождаться M1 (ранги приезжают) и M2 (экран достижим).
2. Прочитать в `content/params/screens.json` строки ≈398–411 — поля экрана
   `leaderboard`: `leaderboard_rank`, `leaderboard_basket`,
   `leaderboard_period_hours`. Это контракт, по нему и строить.
3. Расширить `ClientSnapshot` в `apps/client/src/hud/snapshot.ts` полем для
   рангов, повторив форму из `seasons.ts`.
4. Переписать вкладку `season` в `leaderboard.tsx`: таблица рангов.
   Колонки — из `state_sources` пака.
5. Связать `empty` с `not_qualified_yet`.
6. Показать `PRIZE_*` через `ActionButton`/`Refusal`.
7. Клейм — по развилке выше.

### Гейт

```
npx vitest run apps/client
npx vitest run services/api
python content/lint.py
python content/attack.py --only L350
```

### Адверсариальная проверка

- город без квалификации → экран показывает `not_qualified_yet`, а не ранг 1;
- два города одного кошелька → в таблице **один** слот, с наибольшим
  влиянием;
- равное влияние у двух городов → порядок детерминирован по `cityId`,
  повторный расчёт даёт тот же результат;
- API не прислал ранги → экран показывает «нет данных», а не пустую
  таблицу, выглядящую как «никто не играет».

---

## M4. Довести аттестацию: merkle и IPFS

**Закрыто 2026-09-19.** `selectAttestorPort` в `services/attestor/src/live.ts`:
живой `createRpcPort` + `createLiveTransport`, если заданы `CORPORATOR_RPC_URL`,
chain id, timeout и полный набор адресов `readPlayerReady`; иначе мок.
IPFS по-прежнему `CORPORATOR_IPFS_PIN_URL`. Корни: таблица `attest_roots`
(та же миграция api) при `DATABASE_URL`, иначе память. Fail-open: битый
payload → `logged`; упавший IPFS/RPC не `verified`; выплата не откатывается.
Адреса не хардкод. Пак не поднимали. Ниже исходная задача.

**Важно: merkle и IPFS уже написаны.** Это не разработка с нуля, а включение
продакшн-пути вместо мока.

### Что уже готово

`services/attestor/src/`:

| файл | что делает |
|---|---|
| `tree.ts` | merkle: `minuteLeaves`, `minuteRoot`, `cityDayPayload`, `cityDayCid`, `cityDayStoreKey`, `cityReps` |
| `cid.ts` | сборка CIDv1 из версии, кодека, mh-кода и длины — всё из пака |
| `publish.ts` | публикация запечатанных тиков |
| `badge.ts` | бейдж `verified` только когда есть **и** корень, **и** CID; иначе `logged` |
| `submit.ts` | отправка минутного корня в `MerkleRoots` через порт |
| `store.ts` | хранилище корней (в памяти) |
| `step.ts`, `sealed.ts`, `drain.ts`, `ready.ts` | шаг, запечатывание, слив, готовность |

Контракт `contracts/src/MerkleRoots.sol` существует. В `packages/chainport`
есть `MerkleRootsPort` (`port.ts:29`), мок (`mock.ts:151`) и **живой RPC**
(`src/rpc/index.ts:74`, `src/rpc/live.ts:107`), а `playerReady.ts:30`
проверяет адрес из переменной `CORPORATOR_MERKLE_ROOTS`.

### Где ровно дыра

`services/attestor/src/live.ts`:

- строка **37–38**: IPFS уже выбирается правильно — если задан
  `CORPORATOR_IPFS_PIN_URL`, берётся `createHttpIpfs(env)`, иначе мок;
- строка **39**: `const port = createMockPort(cfg)` — **порт цепи всегда
  мок**, независимо от настроек. Живой RPC-порт существует, но здесь не
  используется;
- строка **40**: `memoryRootStore()` — корни живут в памяти и теряются при
  перезапуске.

Комментарий на строке 32 это подтверждает: «Mock chain until R-V-5 fills RPC».

### Шаги

1. Прочитать `packages/chainport/src/rpc/index.ts` и понять, как собирается
   живой порт и какие переменные окружения ему нужны. Отправная точка —
   `playerReady.ts`, там перечислены все адреса контрактов.
2. В `live.ts` сделать выбор порта по тому же принципу, что уже сделан для
   IPFS: если адреса контрактов заданы и валидны — живой RPC-порт, иначе
   мок. Не ломать мок-путь: без настроек всё должно работать как сейчас.
3. Заменить `memoryRootStore()` на устойчивое хранилище. В
   `services/api` уже есть слой БД и миграции — использовать его, а не
   изобретать файловое хранилище.
4. Проверить, что аттестация остаётся **асинхронной и неблокирующей**. Это
   закон проекта: «сначала выплата, потом запись», упавший IPFS или RPC не
   останавливает доход. В `live.ts:45` уже есть правильное поведение —
   при неудаче возвращается `badge: "logged"` с пустыми корнем и CID.
   Не сломать это.
5. Бейдж не подделывать: `verified` только когда есть и корень, и CID
   (`badge.ts:6`). Правило `L350` это охраняет.

### Чего делать нельзя

- Не деплоить `MerkleRoots.sol` в мейннет. Задача — код и конфигурация.
- Не хардкодить адреса контрактов. Они приходят из окружения.
- Не убирать мок-путь: без переменных окружения проект обязан подниматься.

### Гейт

```
npx tsc --noEmit -p services/attestor
npx vitest run services/attestor
python content/lint.py
python content/attack.py --only L350
```

### Адверсариальная проверка

- IPFS не отвечает → бейдж `logged`, выплата прошла, тик не остановился;
- RPC не отвечает → то же;
- есть корень, нет CID → бейдж **не** `verified`;
- перезапуск сервиса → ранее записанные корни на месте (после шага 3).

---

## M5. Расшить денежный путь или честно его закрыть

**Закрыто 2026-09-19.** `launch.deployed` пуст — hop подключить нельзя (вариант А). Банк и стейк уже живые (H2.9 / H2.10 / H2.3): Confirm остаётся. Биржа — вариант Б: HUD не рисует Review/Confirm, пока `liveQuoteExecutable` ложь; отказ `EXCHANGE_HOP_UNAVAILABLE` до мастера, даже если в стеке остался bank-review. `buy_stock` в API и адаптере live, hop не исполняется. `unstake` не изобретали. `claim_prize` не снимали. `cpmmBuyCorp` не звали. Пак не поднимали. C-22 не чинили. Ниже исходная задача.

### Что сейчас

H2.9–H2.11 (2026-09-19): `deposit`, `withdraw` и `buy_stock` живые; `buy_stock` не исполняет hop, пока котировка мок (`EXCHANGE_HOP_UNAVAILABLE`). `claim_prize` на клиенте `refusal-only` до M6.
Маршруты в протоколе **есть** (`packages/protocol/src/routes.ts`). `applyLive` уже обрабатывает `hire`, `claim_prize`, `build`, `set_objective`, `research_start`, `open_district`, `stake`, `deposit`, `withdraw`, `buy_stock`.

При этом в HUD нарисован полный мастер подтверждения: `bank.tsx`,
`exchange.tsx` показывают stepper с кнопкой Confirm. Банк после H2.9/H2.10 подтверждает live apply; биржа после H2.11 постит `buy_stock`, но hop честно закрыт, пока `quoteLive` ложь.

**Это худший из возможных вариантов**: интерфейс обещает действие, которого
нет. Либо подключаем, либо не обещаем.

### Две развилки, выбирает владелец

**Вариант А — подключить.** Реализовать в `commit.ts` обработчики
`deposit`, `withdraw`, `stake`, `buy_stock`. Требует:
- Vault и StakeRegistry в сети либо честного тестового окружения;
- пути ваучера для выхода через банк (сейчас `bankWithdraw` в движке
  заполняет `withdraw_intent` сразу, минуя резервирование — это записано
  как расхождение `C-22`);
- снятия `refusal-only` в адаптере.

**Вариант Б — не обещать.** Убрать кнопку Confirm там, где действие не
живое; показать состояние «скоро» до входа в мастер, а не после.

### Отдельно: `unstake`

Команды `/command/unstake` нет **ни в протоколе, ни в API**. В HUD намерение
объявлено и помечено `unsupported` (`liveAdapter.ts:128`). По канону анстейк
холдерский, on-chain, а серверная заморозка на 24 часа города — отдельная
вещь. Не изобретать серверную команду `unstake`, которой нет в каноне.

### Гейт

```
npx vitest run apps/client/test/hud_truth.test.ts
npx vitest run services/api
python content/lint.py
python content/build.py
```

Экономические инварианты после любой правки денег проверять числами из
`python content/build.py`:

- круг в полосе `[1400, 1600]` bps (сейчас **1445**);
- вход дешевле выхода (сейчас **200** против **910** bps);
- сплит сбора `100 / 20 / 60 / 20` bps;
- `creator_tax_bps = 200` не двигается;
- минт Capital только через депозит `$CORP` в vault.

---

## M6. Продакшн-путь выдачи призов

**Закрыто 2026-09-19.** Buyback: RPC-порт при полном env (`createBuybackPort`), источник конвейера — fail-open мок (`SERVICE_DEGRADED`); hop `hopOk=0` стоки не покупает. API → `PrizeTreasury.claimPrize` через `selectApiPort` (живой RPC только при полном env; мок не кастодиал: `paid>0` без цепи → `PRIZE_CLAIM_UNCOVERED`). `returnUnsettled` — только бот, только до slice. Vault и PrizeTreasury без `pause`/`unpause`. `refundPlayer` не трогали. Hop котировок по-прежнему мок (M5 Б). `claim_prize` на клиенте не снимали: `launch.deployed` пуст, выдать физически нечем. Пак не поднимали. Ниже исходная задача.

### Что нужно

1. **Buyback.** `services/buyback` существует. Установить, что в нём живое,
   а что мок.
2. **PrizeTreasury.** Контракт `contracts/src/PrizeTreasury.sol` есть,
   порт custody в `packages/chainport` есть. Не хватает транспорта
   API → цепь: текущий путь в API — локальная проекция, а не реальная
   передача.
3. **DEX quote/buy и сток-хоп.** Внешняя граница. Источник по умолчанию —
   fail-open мок. Для запуска нужен реальный источник котировок.
4. **Возврат невыданного.** `returnUnsettled` на казне призов — только
   боту-вкладчику, только до нарезки игроку. Десятка трат не возвращается
   в vault и не кормит фонд зарплат.

### Инварианты, которые нельзя нарушить

- `refundPlayer` — только vault `$CORP`, сумма не больше `backingOf`;
- бот байбека не забирает депозиты игроков и не опустошает vault;
- у Vault и PrizeTreasury **нет** и не появляется `pause`/`unpause`;
- take студии 0.2% — ETH с призовой ноги DEX, не из фонда зарплат.

Полные решения формы денег Rev-A — `docs/archive/plans/PLAN_MONEY.md` §15.
Это архив, читать как справку по форме, не исполнять как план.

---

## M7. Живые обновления и восстановление состояния

Закрыт 2026-09-19. Сокет публикует `{ channel, sections }` по классам частоты, не полный снимок; пульс остаётся `{ pack_hash, city_time }`. При старте API поднимает город из последнего снимка и хвоста `tick_inputs` (`restoreLiveState`). Планировщик зовёт `catchUp`: догон ≡ реплей, оффлайн срезается потолком из пака (жёсткий 18 часов города). `claim_prize` на клиенте не снимать. `launchToken` не подписывать.

---

## M8. Полный агентный тик

**Закрыто 2026-09-19.** Тик живого города идёт по слотам: `agent_id` — id агента, синтетический `"shift"` только у T3 без `functions`. Найм пяти ролей, `assign`, задача на агента и HUD карточки уже были; M8.4/M8.6 дожали оракул, порт, Tools, ночной premium, потолок минта. C-11 закрыт. Ниже исходная задача.

Это расхождение `C-11`. Закрывает канон `DESIGN.md` §5: агент =
`{ роль, уровень, черты[], слот, задача }`, пять ролей живые, тик считает
смену по слоту, запись несёт настоящий `agent_id`. Пока этого нет, HUD
после H показывает список людей, а экономика остаётся «город как один
работник».

Очередь приложения B не менять: M8 идёт после M7. Внутри этой задачи
обязательное предусловие — закрытый **H1.2** (канал `tick.agent_state`
существует) и живой `hire` в API. H9 оставляет `assign` вне своей цели
намеренно; `assign` добавляет **эта** задача, таблицу H9 не править.

Без проекции H1.2 полный тик некуда показать. Не начинать M8, пока H1.2
не закрыт. Не возвращать Companion (`L388`, `R-V-110`). Не спавнить
юнитов на острове (`R-V-101`): агент — работник в слоте, не меш.

### Что сейчас — измерить командой, не памятью

Три факта:

1. Найм всегда пишет Engineer.
   `services/api/src/commit.ts`, `applyHire`, строка 37:
   `agents.push({ id: "h" + n.toString(), role: "engineer" })`.
   Черт, слота, задачи, уровня нет. Scientist / Logistician / Trader /
   Manager нанять нельзя.
2. Тик считает город, не агента.
   `packages/engine/src/economy.ts`, `collectRequests`, строки ≈445–498:
   `city["output_base"]`, сид `"shift"`.
   `packages/engine/src/tick.ts`, `recordsOf`, строка 350:
   `agent_id: "shift"`.
   Оракул то же самое: `content/tick.py` `_collect_requests` ≈1006 и
   запись ≈1494. Python и TypeScript должны остаться байт-парными —
   править **оба**.
3. HUD не умеет сажать и не видит роль.
   `apps/client/src/hud/liveAdapter.ts:127` — `assign` это
   `unsupported`. В `packages/protocol/src/routes.ts` маршрута
   `/command/assign` нет: пути команд берутся из `commit:*` в
   `content/params/screens.json`. `agents.tsx` пять фактов карточки
   (XP, черты, назначение, задача, события) зашиты в `UI_UNAVAILABLE`.
   `set_objective` пишет `city["objective"]` (`commit.ts:173–177`), не
   задачу агента. Это поле нельзя отнять у research: H2.1 /
   `advanceResearch` смотрит на фокус города отдельно.

Пак уже содержит модель. Не выдумывать вторую.

| что | где |
|---|---|
| пять ролей v1 | `content/params/agents.json` `roles`; гейт `L308` |
| порядок ролей матрицы | `content/fixtures/design_5_8.json`: `engineer`, `logistician`, `trader`, `scientist`, `manager` |
| 90 клеток посадки | `generated.buildings.affinity_matrix` из `content/build.py` `build_affinity`; сверяется с фикстурой, `L05` |
| множители | `economy.json`: `affinity_home_bps` 10000, `affinity_neighbour_bps` 6000, `affinity_accepted_bps` 2500 |
| девять задач | `agents.json` `objectives`; дефолт роли — `is_default`; `L19` |
| четыре черты | `agents.json` `traits`; 1–2 на агента, `traits_per_agent_min/max` |
| стартовый пул найма | `hire_pool_engineer_bps` 5000, `logistician` 2500, `trader` 2500; сумма 10000. Scientist и Manager в пул **не входят** |
| слоты города | `generated.agents.slots_at_city_level`; старт 8, потолок 20 |
| формула смены | `DESIGN.md` §5.3 п.5 |
| потолок спреда Trader | не лучше **2130:1** (`bank_markup_floor_bps`); посадкой не обойти |
| запись | `docs/TICK.md` §8, layout v1; состав полей не менять |

Движок, который уже есть и **не писать заново**: `awardPaidTick`,
`awardTrain`, `applyXp`, `agentLevelMultBps` (`packages/engine/src/xp.ts`);
`applySpend` на найм; `seededPrng` / `shiftSeedHex`
(`packages/engine/src/state.ts`); `applyStack` (`stack.ts`) — стек
модификаторов задач и черт; `scheduleOpen`, `pay`, `fixDayBudget`
(`economy.ts`); `advanceResearch` — это городской research, не задача
агента.

### Объект агента в состоянии города

После найма каждый элемент `city["agents"]`:

```
id, role, level, xp, xp_remainder, level_mult_bps,
traits[], building_id, objective, train_target, focus,
idle, request, payout
```

- `id` — как сейчас, `"h" + n`, стабилен, не переезжает при пересадке.
- `role` — один из пяти id пака, все `v1: true`. Новых ролей нет.
- `level` стартует с 1, `xp` с 0. Кривая — `generated.agents.xp_to_next`.
- `traits` — массив id черт, длина в `[traits_per_agent_min, traits_per_agent_max]`,
  выдаётся **один раз при найме**, не перекатывается.
- `building_id` — id функции из `city["functions"]` либо `""` (не посажен).
  В одном здании сидит не больше одного агента. Счётчика слотов на
  здание в паке нет — не выдумывать второй слот.
- `objective` — id задачи из `agents.objectives`, обязан принадлежать
  этой роли (`L19`). При найме ставить дефолт роли (`is_default`).
- `train_target` — только Scientist на задаче `train`: id другого агента.
- `focus` — только Manager на задаче `focus`: контур из
  `agents.contours`. Сама задача ключей не имеет.
- Имя — роль и уровень из строк пака, один раз, на тик не влияет
  (`DESIGN.md` §5.4).

Не хранить выход и affinity на городе как единственный источник.
`city["output_base"]` / `city["affinity_bps"]` после M8 — либо сумма /
агрегат для GDP, либо удаляются из пути выплаты. Путь `"shift"` как
производство **удаляется**. Обновить `packages/engine/src/spawn.ts` и
спавн в `content/tick.py` / симы: производящий архетип обязан посадить
агента в слот (или иметь autonomous-здание). Фикстуры, ждавшие одну
запись `agent_id = "shift"`, переписать.

Autonomous-здания (`buildings.json` `autonomous: true`: City Hall,
Agent Hub, Robotics Lab) работают без агента. Не-autonomous без посадки —
`IDLE_NO_AGENT`, выплаты нет. Молчаливый ноль запрещён.

### Повторяемый рецепт этой задачи

1. Сначала оракул `content/tick.py`, потом порт
   `packages/engine/src/economy.ts` + `tick.ts`. Векторный паритет:
   одинаковые входы → одинаковые записи. Своя формула в API или клиенте —
   дефект.
2. Команды — рецепт H0 «как подключить одну команду», но **внутри M8**,
   не трогая текст H2: обработчик в `commit.ts` → строка в `applyLive` →
   только потом `live` в `liveAdapter.ts`.
3. Числа только из пака. В рантайме нет литералов кроме 0, 1 и индексов.
   10000 bps, 6000, 2500, 2130 — из `generated` / `params`, не из этой
   прозы.
4. `DecisionRecord` layout v1: те же поля. Меняются значения
   `agent_id`, `building_id`, `objective`, `seed`, `inputs`, `output`,
   `reason`. `layout_version` остаётся 1. Адрес игрока в запись не
   входит. Сортировка листьев — по `agent_id` UTF-8, как `TICK.md` §9.
5. Касса: минт Capital без депозита `$CORP` в vault по-прежнему
   невозможен. Фонд зарплат режет **пропорционально** по сумме запросов
   всех агентов города; `payroll_ratio` отдаётся клиенту. `pay()` уже
   умеет список rows — кормить его одной строкой на слот, не городом.
6. Если нужен новый гейт пака — свободный id **L390**. Дыры 328 и 364
   не переиспользовать. Не плодить правило, которое никогда не падает.

---

### M8.1. Найм пяти ролей и черты

Файл: `services/api/src/commit.ts` `applyHire` (строки 27–40).

Шаги:

1. Тело запроса: необязательное `role`. Если есть — обязан быть одним
   из пяти `agents.roles` с `v1: true`, иначе `API_MALFORMED`.
2. Если `role` нет — бросок из стартового пула весами пака
   (`hire_pool_*_bps`) через `seededPrng(city_id, tick_index, new_id, "hire")`.
   В этом броске могут выпасть только Engineer, Logistician, Trader.
   Scientist и Manager — **только явным выбором** игрока. Так устроен
   `DESIGN.md` §5.12: иначе первые восемь — касса без завода.
3. Слоты и стоимость — как сейчас: `agentSlots`, `hireCost`,
   `NO_FREE_AGENT_SLOT`, `NOT_ENOUGH_CAPITAL`, `applySpend`. Стоимость
   растёт с числом агентов. Увольнения в паке нет (`screens.json` без
   fire) — **не добавлять**.
4. Выдать 1 или 2 черты из `agents.traits` тем же PRNG, стрим `"traits"`.
   Не перекатывать никогда.
5. Поставить дефолтную задачу роли из пака. `building_id = ""`.
   `level = 1`, `xp = 0`, `level_mult_bps` из `agentLevelMultBps`.
6. HUD: экран `agents` / кнопка `agents_hire` даёт выбрать роль.
   Пять живых, не пятнадцать. Поиск и фильтры `disabled` в
   `agents.tsx` не оживлять в этой задаче без данных.

Гейт куска: нанять Scientist телом `{role:"scientist"}` → в
`city["agents"]` роль `scientist`. Без тела — никогда не scientist.
Повторный найм с тем же сидом — та же роль и те же черты.

---

### M8.2. Посадка в слот — команда `assign`

В паке действия `commit:assign` нет, поэтому маршрута нет. Это дыра
канона §5.6: «пересадка мгновенная, новый тик уже в новом здании».
H2 её не делает. Делает M8.

Шаги:

1. Добавить действие в `content/params/screens.json` (экран `agent_card`
   или `agents`): `effect: "commit:assign"`, `v1: "live"`, `spend: "none"`,
   `src: "DESIGN.md §5.6"`. Requires — свободный агент и существующая
   функция города, коды из `codes.ts`, новые не выдумывать. Поднять
   `pack_version`, причина по `CONTENT.md` §5.
2. `python content/build.py` ; `python content/codegen.py`. Появится
   `/command/assign` в `packages/protocol/src/routes.ts`. Руками
   generated-файл не править.
3. `applyAssign(ctx, state, city, body)` в `commit.ts`: тело
   `{ agent_id, building_id }`. Нет агента / нет функции →
   `API_MALFORMED`. Посадка в занятое здание: прежний агент получает
   `building_id = ""`, новый садится (мгновенный вытеснение, не очередь).
4. Матрица `none` **не отказывает в посадке**. Тик поставит
   `IDLE_WRONG_ROLE` и ноль выплаты — игрок читает лог, как с банком
   в воскресенье (`DESIGN.md` §5.12). Клиенту до тика можно показать
   предупреждение, не блок.
5. Robotics Lab / City Hall / Agent Hub можно оставить пустыми:
   autonomous. Посадка туда по матрице §5.8 (Manager родной в City Hall
   и Cloud Campus, Scientist сосед в Agent Hub).
6. После того как API отвечает — снять `unsupported` с `assign` в
   `liveAdapter.ts`, добавить `"assign"` в `LIVE_MUTATION_EFFECTS`,
   в `extraFromIntent` отдать `agent_id` и `building_id`. Тест
   `apps/client/test/l3.test.ts` сейчас ждёт `unavailable` на assign —
   переписать вместе с этим шагом, не раньше.

v1 без времени на дорогу. Не вводить travel ticks.

---

### M8.3. Задача на агента, не на город

`applySetObjective` сейчас пишет `city["objective"]`. После M8:

- тело `{ agent_id, objective, train_target?, focus? }`;
- `objective` ∈ задач этой роли, иначе `API_MALFORMED`;
- Scientist `train` без `train_target` — отказ;
- Scientist `research` не подменяет `research_start`: прогресс дерева
  по-прежнему `advanceResearch` / `city["research_focus"]`. Задача
  `research` на агенте — это «этот учёный в этом тике жрёт Compute на
  узел», а не выбор оси игроком;
- Manager `focus` пишет контур в `agent["focus"]`;
- смена задачи со **следующего** тика (`DESIGN.md` §5.9), не задним
  числом внутри текущего.

Городской `city["objective"]` больше не является задачей агента.
Если H2.1 уже пишет туда research — развести поля в этом шаге и починить
тесты H2.1, текст секции H2.1 не переписывать.

`agent_set_objective` в паке уже `v1: live`. Клиент шлёт `objective`
без `agent_id` (`liveAdapter.ts:225–227`) — добавить id выбранной
карточки.

---

### M8.4. Тик по слотам и записи смен

Ядро C-11. Файлы: `content/tick.py` `_collect_requests` и сборка
записей; `packages/engine/src/economy.ts` `collectRequests`;
`packages/engine/src/tick.ts` `recordsOf`. Порядок: оракул, затем порт,
затем вектор.

Для каждого города, для каждой активной функции из `city["functions"]`
(не deactivated / не frozen):

1. Найти агента с `building_id === function.id`. Нет агента:
   autonomous → слот жив без работника; иначе `idle = IDLE_NO_AGENT`,
   `request = 0`, запись всё равно есть (причина обязана быть в логе).
2. Есть агент. Часы здания — `buildings.schedule` через уже существующий
   `scheduleOpen`. Банк/биржа закрыты → `IDLE_BANK_CLOSED` /
   `IDLE_OUT_OF_HOURS`, не «чуть качает».
3. Соответствие роли — клетка `generated.buildings.affinity_matrix`.
   `home` / `neighbour` / `accepted` → множитель из пака.
   `none` → `IDLE_WRONG_ROLE`, выплаты нет.
4. Энергия и compute — как сейчас `energyOk` / `computeOk`, но **draw
   считается от слота и задачи**, не от одного `city["energy_draw"]`.
   Overclock трогает `energy_cost_bps`; Train/Research — `compute_cost_bps`.
   Нет входа → `IDLE_NO_ENERGY` / `IDLE_NO_COMPUTE`. Scientist без
   Compute стоит, даже в родной лаборатории.
5. Выход по `DESIGN.md` §5.3:
   `база(здание, ур.) × соответствие_роли × кривая(ур. агента) ×
   E_района × модификатор_задачи × дрожь(сид) × сплав T5`.
   База — кривая уровня здания из пака, не литерал.
   Кривая агента — `agent["level_mult_bps"]`.
   Дрожь — `seededPrng(city_id, tick_index, agent_id)` **без** `"shift"`.
   Модификаторы задачи и черт — ключи из пака, стек `applyStack`, клип
   пишет `MODIFIER_CAP_CLAMPED`, молча не урезать.
6. `pay()` кормить списком `{ city_id, agent_id, request }`. Бюджет
   по-прежнему `fund / 14` на город. Коэффициент один на тик,
   в каждую запись. Сначала выплата, потом запись (`DESIGN.md` §6.4).
7. Запись: `agent_id` = id агента, либо пустая строка для пустого
   не-autonomous слота; `building_id` = id функции; `objective` = задача
   агента; `seed` = `shiftSeedHex(city_id, tick_index, agent_id)`;
   `inputs.energy` / `inputs.compute` — фактический draw слота;
   `reason` — код простоя или `""`. Синтетического `"shift"` в живом
   городе нет.
8. `city["payout"]` = сумма выплат агентов (GDP, seasons, fragments
   продолжают читать город). Не считать GDP второй формулой.

Logistician не производит ресурс. Его `request` в фонд — 0, эффект —
снижение idle других слотов: локально в Workshop / Power Node / Energy
Plant, пока Logistics не открыт; на цепочку — когда открыт Logistics Hub
(`DESIGN.md` §5.7). Величины — ключи `idle_reduction_bps` задачи Route /
Stockpile, не свои bps в коде.

Trader не пишет свой курс вывода. Живой вывод — существующий
`bankWithdraw`. Посадка Trader в Банке на задаче Desk может сдвинуть
надбавку **вниз** к полу `bank_markup_floor_bps` и не дальше.
Quote действует только в Exchange. Проверить числом: эффективный курс
не лучше 2130:1.

Manager ничего не производит. Focus усиливает выбранный контур
(energy / compute / happiness / доля фонда — что объявит пак), одним
контуром на агента.

Robotics Lab: слот без агента жрёт energy и compute, выход по паку.

---

### M8.5. HUD: роль, слот, задача, простой с причиной

Канал `tick.agent_state` после H1.2 отдаёт `{ id, idleKey }`. Форму
**расширить аддитивно**, не заводя второй список:

`{ id, idleKey, role, buildingId, objective, level, xp, traits }`.

Ключи строк, не готовый текст. `idleKey` — код из `codes.ts`
(`IDLE_NO_ENERGY`, `IDLE_NO_COMPUTE`, `IDLE_NO_AGENT`, `IDLE_WRONG_ROLE`,
`IDLE_BANK_CLOSED`, `IDLE_OUT_OF_HOURS`, …).

Файлы:

- `apps/client/src/hud/snapshot.ts` — расширить тип `agents`;
- `apps/client/src/hud/boot.ts` `snapshotFromEnvelope` — прочитать поля;
- `apps/client/src/hud/screens/agents.tsx` — снять пять заглушек
  `UI_UNAVAILABLE` на XP / черты / назначение / задачу / события, если
  поле пришло; события смены = `reason` последней записи, не выдуманный
  нарратив;
- `apps/client/src/hud/parts/AgentCard.tsx` — уже есть `roleId`, его
  наконец передать;
- `apps/client/src/hud/screens/agent_card.tsx` — выбранный агент, кнопки
  `assign` и `agent_set_objective` с его id.

Не считать экономику в клиенте. Не оживлять `missions`. Не возвращать
`bottom_menu`.

---

### M8.6. Три дыры того же семейства — не раньше M8.4

Делать отдельными коммитами внутри M8, не смешивать с посадкой:

1. `tools_effect_bps` не заполняется в `loadConfig`
   (`packages/engine/src/config.ts`). `spawn.ts:29` уже читает поле.
   Узел research Tools: Workshop +10% Capital. Взять величину из пака.
2. `night_energy_premium_bps` загружается (`config.ts:98`) и не
   используется. Ночью energy дороже; черта `night_owl` режет этот ключ
   (`agents.traits.night_owl`). Эффективная надбавка — из пака / T5,
   не «половина 1000» из головы.
3. Дневной лимит минта есть в контенте (`mint_rate_limit_bps`, код
   `MINT_RATE_CAPPED`), в движке не живёт. Включить в существующий
   `updateMintRate`, не писать второй храповик.

---

### Красные линии M8

- Не менять другие секции этого файла. Не «подчищать» H9, очередь
  приложения B, C-20 / C-01 / C-22.
- Не возвращать Companion, хост-писателя, внешний инференс.
- Не добавлять юнитов, машин, дронов, пешеходов на сцену.
- Не генерировать карту и не выводить геометрию из `city_id`.
- `creator_tax_bps = 200`, `missions_live = 0`, `layout_version = 1`.
- Не минтить Capital без депозита. Не обходить потолок 2130:1 посадкой
  Trader. Вход дешевле выхода.
- Тик — чистая функция: без `Date`, `Math.random` без сида, без I/O.
- Не подписывать `launchToken`.

### Гейт

После каждого подпункта M8.1–M8.6 — узкий гейт §0.2. Для всей M8:

```
python content/lint.py
python content/build.py
python content/codegen.py --check
python content/attack.py --only L05,L19,L21,L308
npx tsc --noEmit -p packages/engine
npx tsc --noEmit -p services/api
npx tsc --noEmit -p apps/client
npx vitest run packages/engine services/api apps/client
```

Если добавлен L389 — включить его в `--only`. Полный `attack.py` без
`--only` не гонять. `ReadLints` на все правленые файлы.

Вектор: один и тот же state с пятью посаженными ролями прогнать через
`content/tick.py` и `@corporator/engine` — записи байт-совпали, набор
`agent_id` равен id агентов, `"shift"` нет.

### Адверсариальное ревю — обязательно, иначе M8 не закрыта

Построить вход, на котором правило **должно** упасть, и показать падение.

| атака | ожидание |
|---|---|
| найм без `role` сто раз на фиксированном сиде | нет Scientist/Manager; есть только пул 50/25/25 |
| `applyHire` всегда Engineer (старый код) | новый тест падает, если роль не из пула/тела |
| Engineer в Workshop, Produce, есть energy | выплата > 0, `agent_id` = id агента, reason `""` |
| то же здание без агента | `IDLE_NO_AGENT`, output 0, запись с причиной |
| Trader в Workshop (клетка `none`) | посадка проходит, тик `IDLE_WRONG_ROLE`, output 0 |
| Trader в Банке в воскресенье / ночью | `IDLE_BANK_CLOSED` или `IDLE_OUT_OF_HOURS`, не «чуть качает» |
| Scientist без compute | `IDLE_NO_COMPUTE` |
| Engineer Overclock при energy впритык | чаще idle energy, чем Produce; не минус фонда сверх запроса |
| два агента с `building_id` одного здания | после `assign` сидит один, второй `""` |
| jitter / seed | `hash(city_id, tick_index, agent_id)`, не `"shift"` |
| Trader Desk в Банке, крутить markup | курс вывода не лучше 2130:1 |
| 200 агентов запросами выше фонда | `payroll_ratio < 10000`, никто не обнулён, пока фонд не пуст |
| минт Capital без депозита | по-прежнему невозможно |
| запись без выплаты | запрещено: сначала pay, потом record |
| `city_id` в сиде дрожи задаёт геометрию острова | не задаёт; остров Terra не читает тик |

Молча выжившую атаку в отчёте назвать. Правило, которое никогда не
срабатывает, — декорация.

### Готово, когда

- Нанять можно все пять ролей. Стартовый случайный пул — три. Черты
  1–2, не перекатываются.
- Агента можно посадить и пересадить. Не та роль → простой с кодом, не
  краш и не молчаливый ноль.
- Тик платит по слоту: роль × здание × задача × черты × часы × входы.
  `agent_id = "shift"` в живом городе нет.
- Python-оракул и TypeScript дают одинаковые записи.
- HUD карточки показывает роль, слот, задачу, XP, черты и причину
  простоя из API.
- C-11 закрыт. Касса, круг трения, 2130:1 и детерминизм тика держатся
  на числах шага, не на прозе.

---

# Приложение A. Состояние документации

Честный ответ на вопрос «документацию проверил и привёл к актуальному
виду»: **проверил полностью, привёл частично.**

### Что уже исправлено 2026-09-18

- `.cursor/rules/code-phase.mdc`: текущая фаза — HUD и сайт, а не «HUD не
  начинать»; свободный id линтера `L389` вместо неверного `L387`; снята
  устаревшая запись про падение `L353`; добавлено, что живой рендер —
  Three.js, а Pixi и изометрия — архив.
- `docs/CANON.md`: убрана ссылка на несуществующий
  `.cursor/rules/island-look.mdc`; раздел «Текущая работа» переписан под
  HUD и сайт; сказано про Three.js.
- Ссылки на несуществующий `island-look.mdc` расшиты в
  архивных `PLAN_ISLAND.md`, `TZ_ISLAND_LOOK.md`,
  `TZ_ISLAND_LOOK_STEPS.md`, `PROMPT_ISLAND.md`.
- Удалены 27 файлов PixiJS-скиллов (230 КБ) из `.cursor/skills`.

### Что ещё не сделано — задачи D4–D5

**D1. Номер пака устарел в девяти документах.** Закрыто 2026-09-21.
Текущий reference pack — **176**, хеш `7bbdc470c0b3d4d188…`, rules `0.24.0`.
Когда задача писалась, документы называли 138/141/143 при фактическом 144;
к закрытию текущим был уже 176. Пройдено по списку: `DESIGN.md`,
`PUBLIC_DOC.md`, `docs/CONTENT.md`, `docs/LAUNCH.md`, `docs/SIMULATION.md`,
`docs/TICK.md` держат 176 как текущий. `docs/reports/GATE_PERF.md` оставил
замер на pack 21 и подписал текущий 176 отдельно — подменять хеш замера
нельзя. `docs/reports/I0_diet_report.md` и
`docs/archive/reports/TZ_ISLAND_LOOK.md` номера пака не содержат (четыре
«143» в I0 — это 143 982 треугольника, не `pack_version`). Исторические
прогоны (`SIMULATION.md` pack 171) не переписывались.

**D2. `HUD.md` удалён, живые документы на него ссылаются.** Закрыто 2026-09-21.
Три названных файла уже держали живые адреса: `docs/TICK.md` — дизайн
`docs/reports/HUD_DESIGN_SYSTEM.md`, догон `docs/SCREENS.md`; `docs/ARCHITECTURE.md`
— экраны `docs/SCREENS.md`; `docs/WORLD.md` — оба. Добиты оставшиеся живые
указатели: `content/README.md` (фикстуры), комментарии `clock.ts` /
`preview.ts` / `badge.ts`. `HUD.md` не восстановлен. Архив и поля `src` в
`content/params/*.json` не переписывались: это историческое обоснование
параметра, не текущий канон вида.

**D3. `docs/WORLD.md` часть B — живой документ с мёртвым 2D.** Закрыто 2026-09-21.
Часть B уже была в `docs/archive/WORLD_PACK_GRID.md` (легенда тайлов, ромбы,
`tileOrigin`, pixelize, LUT/snap). Живой `docs/WORLD.md` — часть A плюс мост
счётчиков (`R-V-99`) и указатель на архив. Даты `2026-09-*` убраны из живого
текста в пользу `R-V-104` / `R-V-106` / `R-V-109` (канон дат остаётся в
`docs/CANON.md`). Строка BRIEF T10 в `WORLD.md` оставлена: `L194` читает
только этот файл. `docs/CANON.md` больше не зовёт `WORLD.md` «остров и мир»
целиком.

**D4. Война авторитетов по HUD.** Закрыто 2026-09-21.
`docs/archive/reports/hud_prompt.md` и `docs/archive/reports/TZ_HUD.md`
уже лежат в архиве (`R-V-102`); живых копий в `docs/` нет. `HUD.md` не
восстановлен. Живой lock вида — `hud/design-reference/` и
`.cursor/rules/hud-visual.mdc`. `docs/reports/HUD_DESIGN_SYSTEM.md` снят
с visual authority: errata only (нет Settings, нет bottom nav, Recent
Activity ≤ 3; IBM Plex Sans + JetBrains Mono local). Source Serif 4
остался только в архивном `hud_prompt.md` и в тестах, которые его
запрещают. Исторические ссылки на `TZ_HUD.md` в `docs/SCREENS.md` и
`docs/archive/WORLD_PACK_GRID.md` оставлены как долг кадра (`R-V-55`),
не как живой шелл.

**D5. 346 паспортов закрытых фаз в `docs/archive/reports/`.** Закрыто 2026-09-21.
Снимок плана 2026-09-18 был 346 файлов / 1216 КБ / 14 685 строк. На диске
сейчас **351** файл, **1370.3 KiB**, **18641** строк; ничего не удалялось
(`hud_prompt.md` и `TZ_HUD.md` пришли с D4). Оглавление —
`docs/archive/reports/INDEX.md` (файл → фаза → дата ISO если есть в тексте,
иначе — → заголовок). Каталог исключён из индекса редактора
(`.cursorignore`); INDEX — исключение. `docs/archive/plans/` и
`docs/archive/WORLD_PACK_GRID.md` в ignore не входят.

### Расхождения, которые надо сохранить, а не «починить»

- **`C-20`** — merge-дивиденд: `DESIGN.md` §4.8 говорит «половина тир-1»,
  генератор берёт полный (`content/build.py:2328`,
  `"magnitude_from": "merge tier-1 dividend"`). Намеренно сохраняемый
  конфликт.
- **`C-01`** — API игнорирует `tile_x`/`tile_y` (`commit.ts`) и активирует функцию по `building_id`. Клиент с H5 больше не шлёт тайлы из закрытого `build.tsx`. Не оживлять посадку в клетку и не заставлять API есть тайлы.
- **`C-22`** — `bankWithdraw` в движке заполняет намерение сразу, минуя
  путь резервирования через ваучер. Решение `R-W-04` это снимает; в командном пути ещё нет: `applyWithdraw` по-прежнему вызывает `present` и увеличивает `corp_held`.

---

# Приложение B. Порядок работ

Рекомендуемая очередь. В скобках — размер задачи.

**Неделя 1 — закрыть дефекты:**
F1–F7 закрыты (F4 снято). Дальше часть I: I1 `view.html` на Terra.

**Неделя 1–2 — один остров:**
I1, I2 и I3 закрыты 2026-09-19 (I3: оставить `island.blend`).

**Недели 2–5 — играбельный HUD (часть H, самая объёмная):**
H1 закрыт. H2.1–H2.11+H3 закрыты. H4 гейты `requires` закрыты 2026-09-19. H5 приёмка экранов закрыта 2026-09-19. H6 сокет закрыт 2026-09-19. H7 онбординг и оффлайн закрыт 2026-09-19. H8 сквозной тест закрыт 2026-09-19. H9 отчёт измерен 2026-09-19, провод HUD до запуска дожат (каналы 21/21, клейм/hop зажигаются от `deployed`+env). M4 merkle/IPFS закрыт 2026-09-19. M5 денежный путь закрыт 2026-09-19 (hop Б, банк/стейк А). M6 выдача призов закрыт 2026-09-19 (API→казны env-gated; HUD клейм live при заполненном `launch.deployed`). M7 живые обновления закрыт 2026-09-19. M8 полный агентный тик закрыт 2026-09-19 (C-11: слот, не `"shift"`). Очередь кода этого плана пуста.

**Неделя 5–6 — аттестация:** M4 merkle и IPFS закрыт 2026-09-19.

**Неделя 4+ — деньги и живость:**
M6 закрыт 2026-09-19. M7 живые обновления закрыт 2026-09-19. M8 полный агентный тик закрыт 2026-09-19.

**Параллельно, документация:** D1–D5 закрыты 2026-09-21.

### Что должно быть закрыто до разговора о запуске

- **H9 на цели по проводу:** 21/21 каналов состояния, 16 обработчиков API включая `claim_prize`, 38/39
  действий пака после `deployed`, 29/34 экрана играбельны (build/settings/missions/bottom_menu не работа).
  После заполнения `launch.deployed` и env второго кодирования HUD нет. M8 закрыт.
- ноль падающих тестов;
- ноль ошибок линтера пака;
- ноль ошибок типов;
- адреса контрактов, владельцы ролей, соответствие Stock Token →
  StakeRegistry, задеплоенный ABI;
- реальный источник котировок DEX вместо fail-open мока;
- хостинг клиента (сейчас его нет в `deploy/`);
- внешний аудит контрактов сверх внутреннего `docs/AUDIT.md`.

`launchToken` не подписывается ни одной задачей этого плана.
