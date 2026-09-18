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
| `pack_version` | **145** (был 144 до закрытия F2) |
| pack hash | `06b1b6fe0e315ca8f41e5022367068099db1290bb16963de9228ef8618064b49` |
| `rules_version` | `0.24.0` |
| каналов состояния заполнено | **9 из 21** |
| команд исполняет API | **4 из 15** |
| намерений живых на клиенте | **3 из 19** |
| `python content/lint.py` | 386 правил, **9 ERRORS**, 1 WARNING (L174), 4 PENDING |
| `npx vitest run` (корень) | **271 passed / 10 failed / 281** |
| `eslint .` в живых пакетах | **205 errors** (`render` 158, `engine` 47) |
| `python content/codegen.py --check` | сходится |
| `content/params/launch.json` `deployed` | все пять полей пустые |

Если ваши числа отличаются от этих — сначала выясните почему, потом
работайте. Не подгоняйте.

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
- **Свободный id линтера — `L389`.** Занято 386 id, максимум `L388`. Дыры
  `L328` и `L364` молча не переиспользовать.
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

**Приоритет: высокий.** Закрывает 4 ошибки линтера и 2 падающих теста, и
это нарушение сквозного закона проекта, а не косметика.

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

**Мелкая задача, но правило сейчас не проверяет ничего.**

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

- `L387` пропало из ERRORS (5 ошибок → 4);
- `python content/attack.py --only L387` **ловит** пробу. Если проба не
  ловится — правило стало декорацией, это не готово.

### Обязательно

Это правка самого `lint.py`. По правилам проекта правка линтера — один из
четырёх случаев, когда нужен **полный** `python content/attack.py --jobs 8`.
Запустить его в конце этой задачи и привести число пойманных проб.

---

## F5. Убрать литерал из `islandLook.ts`

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

**Только по решению владельца. Агент сам не выносит.**

`art/island_v3/*.blend` и `*.blend1` — около **4.4 ГБ** авторских
исходников меша. Они в `.gitignore`, в git их нет, HUD и клиент их не
читают. Фаза острова закрыта.

Варианты, которые надо предложить владельцу:

- оставить как есть — нужны, если остров ещё будут править в Blender;
- вынести на внешний диск с описью — освобождает 4.4 ГБ;
- оставить только текущий `island.blend`, автосейвы `*.blend1` (только
  `island.blend1` весит 303 МБ) вынести.

Не переписывать историю git ради места: в `.git` острова почти нет, 289 МБ
объектов — это закоммиченные когда-то `node_modules`, а 403 МБ
`.git/cursor/crepe` — локальный кеш редактора, к истории отношения не имеет.

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

Движок: `advanceResearch(cfg, state)`, `researchProgressStep`.
В `liveAdapter.ts` это сейчас `unsupported`, хотя маршрута
`/command/research_start` в `routes.ts` **нет**. Сначала проверить, есть ли
он в паке (`screens.json` действие research). Если маршрута нет — добавить
ключ в пак, поднять `pack_version`, прогнать `build.py` и `codegen.py`.
Экран: `research.tsx` — сейчас каталог живой, коммита нет.

### H2.2. `open_district`

Открытие отрасли по стейку реального Stock Token. Предусловия — порог
стейка (количественный), уровень города. Коды отказа —
`STAKE_BELOW_THRESHOLD` и соседние в `codes.ts`.
Шесть районов фиксированы: NVDA→Compute, TSLA→Energy, AMZN→Logistics,
AAPL→Consumer, MSFT→Automation, COIN→Finance. Тикеры сменные, роли — нет.

### H2.3. `stake`

Доп. стейк в уже открытый район. Действие `district_stake_more`,
`requires: ["stake_mult"]`. Порог кратности — из пака.

### H2.4. `unlock_tier`

Тир 1 открывается только стейком и стоит 0 Capital. Тиры 2 и 3 стоят
Capital по таблице research. Источник — `docs/PROGRESSION.md` и
`generated.progression.tier_cost`.

### H2.5. `pick_node`

Выбор узла прогрессии. Эксклюзивные узлы **без респека** — выбрал и всё.
Предупредить игрока до нажатия, а не после.

### H2.6. `merge`

Слияние двух районов. Девять непокрытых пар, `merge_active_cap = 3`.
**Внимание: `C-20`.** `DESIGN.md` §4.8 говорит «половина тир-1 дивиденда»,
генератор берёт полный. Брать значение **из пака**
(`generated.progression.progression_merges`), в код число не писать, текст
`DESIGN.md` не править.

### H2.7. `upgrade`

Апгрейд уровня здания. Стоимость — `generated.balance.level_cost`, уже
читается в `buildCost` (`commit.ts:91–96`). Переиспользовать.

### H2.8. `claim_fragment`

Фрагменты: окна 14 дней города, `windowSettleDue`, `settleFromData`.
Начислять только за работу в маячных зданиях и только оплаченные тики.

### H2.9. `deposit`

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

`buy_stock`: котировка и покупка идут **вне тика**. Математика кривой —
`cpmmBuyCorp` / `cpmmSellCorp`. Пока источник котировок мок — держать
`quoteLive = false` и не давать исполнить сделку.

`claim_prize`: API уже умеет (`applyClaimPrize`, `commit.ts:52–88`).
Разблокировать на клиенте **только** после M6 (реальная выдача). До этого
`refusal-only` — это не баг, а честность: `launch.json` `deployed` пуст,
выдать приз физически нечем.

---

## H3. Снимать блокировки на клиенте — строго по факту готовности API

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

Пройти **все 34** объекта пака. Для каждого заполнить строку и
приложить скриншот:

| поле | что проверить |
|---|---|
| id | из пака |
| достижим | есть живой вход из интерфейса, не из мёртвого файла |
| данные | все поля из `fields` приходят с сервера |
| действия | все `actions` экрана исполняются или честно отказывают с кодом |
| состояния | loading, empty, error реализованы, не зашиты константой |
| отказы | коды из пака показываются текстом, а не общим `UI_UNAVAILABLE` |
| вердикт | играбельно / частично / заглушка |

Известные проблемы, которые надо закрыть в этой задаче:

- `App.tsx:280` — `loading` в живом режиме зашит в `false`. Пока так, ни
  один экран не может показать загрузку.
- `leaderboard.tsx:22` — `empty={false}` зашито.
- `districts` — маршрут ремапится в `industries` (`navigation.ts:43`), и
  экран недостижим.
- `research` — как экран ремапится в таб `overview`, обёртка мертва.
- `build` — `resolveHudRoute` возвращает `undefined` (`navigation.ts:42`).
  Экран закрыт намеренно: посадка запрещена каноном. Оставить закрытым,
  но убрать из него `tile_x`/`tile_y` (`build.tsx:48–49`).
- `settings` — по дизайн-системе удалён, в паке живой. Расхождение
  зафиксировать, экран не возвращать.
- `IndustriesWorkspace` — не зарегистрирован как экран и не имеет входа.

**Мёртвый код удалять только после переноса входов:** `Topbar.tsx`,
`CapitalSlot.tsx`, `CityCard.tsx`, `BuildingDetailLook.tsx`,
`IndustriesFromDistricts.tsx`, `primitives.ts` и его сироты.

---

## H6. Живые обновления вместо ручного обновления страницы

Сейчас HUD берёт состояние одним `GET /city/{id}/state`. Маршрут
`WS /city/{city_id}/ws` объявлен, `services/api/src/ws.ts` есть,
потребителя в `apps/client/src` **нет**.

Шаги:

1. Прочитать `services/api/src/ws.ts` и `packages/protocol/src/channels.ts`:
   у каналов есть классы частот (`tick`, `aggregate`, `price`, `log`,
   `efficiency`).
2. Написать подписчика в клиенте, который обновляет снимок по классу
   частоты, а не дёргает всё состояние на каждое сообщение.
3. Часы города **канала не получают** — клиент считает их сам по формуле от
   серверного `city_time`. Канал для часов не заводить.
4. Обрыв соединения — видимое состояние, не тишина. Показать, что данные
   устарели, и через сколько.

---

## H7. Онбординг, оффлайн-возврат и кошелёк

В паке восемь флоу, все `v1: live`: `flow_onboard_wallet`,
`flow_onboard_seat`, `flow_onboard_clock`, `flow_onboard_idle`,
`flow_onboard_bank`, `flow_onboard_payout`, `flow_return_continue`,
`flow_return_summary`.

В клиенте им соответствуют `onboarding_demo.tsx`, `wallet_connect.tsx`,
`offline_return.tsx` — все заглушки, ни один не запускается автоматически.

Шаги:

1. Онбординг ведёт игрока по шагам из `pack.onboardSteps`, не по
   захардкоженному списку.
2. Оффлайн-возврат показывает, что случилось за отсутствие: база 12 часов
   города, автоматизация +1+2+3, слияние +1, **жёсткий потолок 18**.
   Превышение срезается и это показывается явно, а не молча.
3. Реальный вход сейчас в `LoginRoot.tsx:86–101`; экран `wallet_connect`
   дублирует его и не используется. Оставить один путь.
4. Демо и кошелёк не пересекаются: прогресс демо не переносится.

---

## H8. Сквозной тест играбельности

Пока его нет, «играбельно» — это мнение. Нужен тест, который проходит
основной цикл на фикстурах:

```
вход → депозит $CORP → получен Capital → активирована функция здания →
нанят агент → назначена задача → прошёл тик города → появился доход →
виден GDP и happiness → открыт район по стейку → получен фрагмент →
виден ранг в лидерборде → выведено через банк по ваучеру
```

Требования к тесту:

- на каждом шаге проверять, что **экран показывает** результат, а не только
  что API вернул 200;
- один и тот же `city_time` даёт один и тот же кадр и один и тот же снимок;
- догон эквивалентен реплею: пропущенные тики, досчитанные разом, дают то
  же состояние, что посчитанные по одному;
- ни одного обращения к `Date.now()` на пути расчёта.

Добавить отдельный тест «ни одно живое действие не отдаёт
`FEATURE_NOT_IN_V1`»: он должен перечислить действия, которые пак объявил
`v1: live`, и упасть, если клиент их блокирует. Сейчас такой тест упал бы
на шестнадцати намерениях — это и есть измеримая метрика готовности HUD.

---

## H9. Отчёт о готовности HUD

Свести таблицу и держать её актуальной в этом файле:

| метрика | было 2026-09-18 | цель |
|---|---|---|
| каналов состояния заполнено | 9 / 21 | 21 / 21 |
| команд исполняет API | 4 / 15 | 15 / 15 |
| намерений живых на клиенте | 3 / 19 | 15 / 19 (без `unstake`, `present_voucher`, `assign`, `research_start` до H2.1) |
| действий пака работает | 3 / 39 | 38 / 39 (кроме `missions_start`) |
| экранов играбельно | нужно измерить в H5 | 33 / 34 |
| полей снимка приходит | ~10 / 30 | 30 / 30 |

Готовность к запуску по HUD = все шесть строк на цели, плюс зелёный H8.

---

# ЧАСТЬ M. Доделать механики до запуска

**M1, M2 и M3 заменены задачами H1–H5.** Не исполнять их отдельно:
проекция состояния — H1, вход в лидерборд — H5, экран лидерборда — H1.4
плюс H5. Ниже остаются M4–M8.

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

### Что сейчас

`apps/client/src/hud/liveAdapter.ts`, строки 114–118: `deposit`,
`withdraw`, `buy_stock`, `open_district`, `stake` помечены `refusal-only`.
Маршруты в протоколе **есть** (`packages/protocol/src/routes.ts`), но
`applyLive` в `services/api/src/commit.ts:190–194` обрабатывает только
`hire`, `claim_prize`, `build`, `set_objective`.

При этом в HUD нарисован полный мастер подтверждения: `bank.tsx`,
`exchange.tsx` показывают stepper с кнопкой Confirm. Игрок нажимает
«подтвердить» и получает `FEATURE_NOT_IN_V1`.

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
- сплит сбора `100 / 30 / 50 / 20` bps;
- `creator_tax_bps = 200` не двигается;
- минт Capital только через депозит `$CORP` в vault.

---

## M6. Продакшн-путь выдачи призов

Без этого M3 нельзя закрыть честно: клейм показывать нельзя, пока приз
физически некому выдать.

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

Три известные дыры, каждая своя задача.

**M7.1. WebSocket не потребляется.** `services/api/src/ws.ts` есть, маршрут
`WS /city/{city_id}/ws` объявлен, в `apps/client/src` потребителя нет. HUD
живёт на разовом `GET /city/{id}/state`. Для живого города нужен подписчик.

**M7.2. Состояние не восстанавливается из БД.** При перезапуске API
состояние города не поднимается полностью. Есть `recover.ts` и миграции —
надо довести.

**M7.3. Планировщик не использует догон.** `scheduler.ts` не зовёт
`catchUp`. Инвариант, который должен держаться: догон ≡ реплей, то есть
пропущенные тики, досчитанные разом, дают то же состояние, что и тики,
посчитанные по одному. Это проверяется property-тестом, а не глазами.

Оффлайн: база 12 часов города, автоматизация добавляет 1+2+3, слияние +1,
жёсткий потолок **18**. Превышение срезается.

---

## M8. Полный агентный тик

Сейчас `packages/engine/src/tick.ts` выдаёт `agent_id = "shift"` и считает
производство на уровне города. Авторская модель — пять ролей, черты, места,
задачи — в паке описана, но тиком не исполняется. Это расхождение `C-11`.

Это самая большая из оставшихся задач. Браться за неё **после** M1–M4:
без проекции состояния и живого лидерборда полный агентный тик некуда
показать.

Отдельные мелкие дыры того же семейства:

- `tools_effect_bps` не заполняется в `loadConfig` — эффект research
  «Tools» в движке не применяется;
- ночная надбавка за Energy загружается, но не используется;
- дневной лимит минта есть в контенте, но не в движке.

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
  `docs/reports/PLAN_ISLAND.md`, `TZ_ISLAND_LOOK.md`,
  `TZ_ISLAND_LOOK_STEPS.md`, `PROMPT_ISLAND.md`.
- Удалены 27 файлов PixiJS-скиллов (230 КБ) из `.cursor/skills`.

### Что ещё не сделано — задачи D1–D5

**D1. Номер пака устарел в девяти документах.** Документы называют пак 138,
141 или 143; фактический — **144**, хеш `dc58998f9a46f00a…`. Поправить
номер и хеш в: `DESIGN.md`, `PUBLIC_DOC.md`, `docs/CONTENT.md`,
`docs/LAUNCH.md`, `docs/SIMULATION.md` (три места), `docs/TICK.md`,
`docs/reports/GATE_PERF.md`, `docs/reports/I0_diet_report.md` (четыре),
`docs/reports/TZ_ISLAND_LOOK.md`. Менять **только число и хеш**, разделы не
переписывать.

**D2. `HUD.md` удалён, живые документы на него ссылаются.**
`docs/TICK.md:3`, `docs/ARCHITECTURE.md:115`, `docs/WORLD.md` (строки 136,
138, 146, 212, 216, 227). Заменить адресом живого источника:
`docs/reports/HUD_DESIGN_SYSTEM.md` для дизайна, `docs/SCREENS.md` для
контракта экранов. Файл `HUD.md` **не восстанавливать**.

**D3. `docs/WORLD.md` часть B — живой документ с мёртвым 2D.** Легенда
тайлов, ромбы 64×32, `tileOrigin`, pixelize-студия, LUT и snap в 53 цвета.
Вынести часть B в `docs/archive/` отдельным файлом, в части A оставить
ссылку «экономическая сетка пака и архив кадра — там-то». Это же закроет
ошибку линтера `L195` про литералы дат, если заодно убрать даты из текста.

**D4. Война авторитетов по HUD.** `docs/reports/HUD_DESIGN_SYSTEM.md:5–6`
объявляет себя единственным источником, а `hud_prompt.md:5–6` объявляет
источником себя же и называет другие шрифты (Source Serif 4 против
IBM Plex Sans). Отправить `hud_prompt.md` в архив. Туда же `TZ_HUD.md`,
который сам себя называет legacy и описывает 2D-шелл с нижним меню.

**D5. 346 паспортов закрытых фаз в `docs/archive/reports/`** — 1216 КБ,
14 685 строк. Историю не удалять. Склеить оглавление в
`docs/archive/reports/INDEX.md` (фаза → дата → строка итога) и исключить
каталог из индексации редактора через `.cursorignore`. Это главный вклад в
жалобу «лагают агенты» после того, как `node_modules` уже вынесены.

### Расхождения, которые надо сохранить, а не «починить»

- **`C-20`** — merge-дивиденд: `DESIGN.md` §4.8 говорит «половина тир-1»,
  генератор берёт полный (`content/build.py:2328`,
  `"magnitude_from": "merge tier-1 dividend"`). Намеренно сохраняемый
  конфликт.
- **`C-01`** — клиент шлёт `tile_x`/`tile_y` (`build.tsx:48–49`), API их
  игнорирует (`commit.ts:116–169`, активирует функцию по `building_id`).
  Остаток клеточной эпохи; убирать вместе с экраном `build`, не раньше.
- **`C-22`** — `bankWithdraw` в движке заполняет намерение сразу, минуя
  путь резервирования через ваучер.

---

# Приложение B. Порядок работ

Рекомендуемая очередь. В скобках — размер задачи.

**Неделя 1 — закрыть дефекты:**
F2 Companion (средняя) → F4 правило L387 (маленькая) →
F5 литерал (маленькая) → F3 `city_time` в рендере (средняя) →
F6 `fill.intensity` (маленькая) → F7 решение по 2D-тестам (обсуждение).

**Неделя 1–2 — один остров:**
I1 перенацелить `view.html` (маленькая) → I2 вынести отклонённый остров
(средняя) → I3 решение по Blender-исходникам (обсуждение).

**Недели 2–5 — играбельный HUD (часть H, самая объёмная):**
H1.1–H1.4 каналы состояния (четыре средние задачи, можно параллельно) →
H2.1–H2.11 обработчики команд (одиннадцать задач, строго по одной, от
`research_start` к деньгам) → H3 снятие блокировок (по одной за раз) →
H4 гейты `requires` (средняя, ядро играбельности) → H5 приёмка 34 экранов
(большая) → H6 WebSocket (средняя) → H7 онбординг и оффлайн (средняя) →
H8 сквозной тест играбельности (средняя) → H9 отчёт о готовности.

**Неделя 5–6 — аттестация:** M4 merkle и IPFS (средняя).

**Неделя 4+ — деньги и живость:**
M5 денежный путь (большая, нужно решение) → M6 выдача призов (большая) →
M7 WebSocket, восстановление, догон (большая) → M8 полный агентный тик
(самая большая).

**Параллельно, не блокирует:** D1–D5 по документации.

### Что должно быть закрыто до разговора о запуске

- **H9 на цели:** 21/21 каналов состояния, 15/15 команд в API, 38/39
  действий пака работают, 33/34 экрана играбельны, зелёный H8. Без этого
  разговора о запуске нет: пак объявляет 33 экрана живыми, и игрок вправе
  ожидать, что они работают;
- ноль падающих тестов;
- ноль ошибок линтера пака;
- ноль ошибок типов;
- адреса контрактов, владельцы ролей, соответствие Stock Token →
  StakeRegistry, задеплоенный ABI;
- реальный источник котировок DEX вместо fail-open мока;
- хостинг клиента (сейчас его нет в `deploy/`);
- внешний аудит контрактов сверх внутреннего `docs/AUDIT.md`.

`launchToken` не подписывается ни одной задачей этого плана.
