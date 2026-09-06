# План кодовой фазы: C0–C11

Назначение: превратить закрытые T0–T12 в работающий монорепо, ничего не проектируя заново. Адреса канона: механика — `DESIGN.md`; границы пакетов и слоёв — `docs/ARCHITECTURE.md`; контракт на проводе — `docs/API.md`; этапы — `docs/ROADMAP.md`; тик и аттестация — `docs/TICK.md`; интерфейс — `HUD.md` и `docs/SCREENS.md`; вид города — `docs/WORLD.md`; форма контента и версионирование — `docs/CONTENT.md`.

**Этот файл не канон.** Канон этапов — `docs/ROADMAP.md` и секция пака «T12: roadmap»; план — способ его исполнить. Расхождение плана с каноном закрывается правкой канона (`R-C-1`), а не правкой плана. План лежит в `docs/reports/`, а не в `docs/`, потому что `content/lint.py` не обходит `docs/` глобом и новый файл в `docs/` гейт бы не двинул, но создал бы второй, негейтованный источник этапов.

---

## §1. Где мы стоим

Паспорт состояния: пак **24**, `rules_version` из `meta.json`, хеш **`001c9ae7235308673f58cc2489cad4527306646f39deb80193c2537892d47173`**, `python content/lint.py` — **266 правил, 0 ошибок**, `python content/attack.py --jobs 8` — 0 UNATTACKED и 0 SURVIVED (`docs/reports/T12_final.md` §2).

Установленные факты разведки:

1. Каталога `packages/*` в дереве **нет**. Границы слоёв, сервисы, кодоген, схема БД, эндпоинты, каналы, метрики, окружения и этапы уже существуют **как данные** в паке — секции `content/out/GENERATED.md` «T12: packages», «T12: services», «T12: codegen», «T12: schema», «T12: port», «T12: metrics», «T12: environments», «T12: endpoints», «T12: channels», «T12: http», «T12: snapshot», «T12: roadmap».
2. В `content/out/pack.json` **59** значений длиной 16+ цифр и **ноль** значений типа float: все числа целые. Следствие: `JSON.parse` в TypeScript теряет точность на паке, загрузчик обязан быть bigint-safe, а нецелое число в паке обязано быть ошибкой загрузки. Уточнение пересчётом — `R-C-5`: из этих 59 ровно 58 являются JSON-числами (57 из них больше `2**53`), а пятьдесят девятое, самое крупное (порядка `1.3e40`), лежит в паке **десятичной строкой**, не числом.
3. `python content/lint.py` не обходит `docs/` глобом: правила читают именованные файлы (`HUD.md`, `docs/SCREENS.md`, `docs/WORLD.md`, `docs/TICK.md`, `ARCHITECTURE.md`, `API.md`, `ROADMAP.md`). Новый файл в `docs/reports/` гейт не двигает — это и есть причина, почему план лежит там.
4. Этапы «T12: roadmap» — десять строк: `pack_gate`, `engine_from_spec`, `host_db_replay`, `port_mock`, `client_on_mock`, `sampler`, `buyback`, `attestor_no_chain`, `chain_v1_1`, `seasons_prizes_v1_1`.
5. Слои: `engine` 0 без зависимостей; `protocol` 1; `contentpack` 1 → `protocol`; `chainport` 2 → `protocol`; `services/*` 3; `apps/client` 4 с `preview_only=1`.

Что уже готово как данные и уже не проектируется: порядок шагов тика (`docs/TICK.md` §3), целочисленная арифметика и таблица стоков остатка (§4), стримы PRNG (§5), контуры границы суток (§6), layout v1 и заголовок (§8), дерево и домены keccak (§9), агрегаты (§11), проводка T5/фрагментов/сезонов/компаньона (§12), матрица отказов и биекция команд (`docs/API.md` §2), сцена и спрайты (`art/out/scene.json`, `art/out/sprites.json`).

Что физически отсутствует в дереве: ни одной строки TypeScript, ни одного каталога `packages/`, `services/`, `apps/`, ни одной SQL-миграции, ни одного npm/pnpm-манифеста, ни одного Dockerfile, ни одного файла золотых векторов.

Кодовая фаза **не проектирует заново ничего из T0–T12**. Она собирается из пака: там, где план хочет число, он берёт ключ пака; там, где хочет форму, — секцию «T12: …»; там, где хочет критерий, — правило `L…` или пробу из `docs/reports/T12_final.md` §4.

---

## §2. Принцип фазы

Пак — единственный источник форм и чисел: ни один слой не хранит второй экземпляр значения, которое пак уже держит. TypeScript — единственный рантайм: экономику в проде считает `packages/engine`, а не `content/*.py`. Python — оракул и гейт: он публикует пак, экспортирует золотые векторы и остаётся арбитром байтов, но в образ не попадает.

| источник | артефакт | потребитель | чем проверяется совпадение |
|---|---|---|---|
| `codes.json` | `packages/protocol/codes.ts` | `services/api` | `codegen --check`, `L247`, `L248` |
| `screens.json` | `packages/protocol/screens.ts` | `apps/client` | `codegen --check`, `L232`, `L235` |
| `modifier_keys.json` | `packages/protocol/modifier_keys.ts` | `packages/engine` | `codegen --check`, `L072` |
| `districts.json` | `packages/protocol/districts.ts` | `apps/client` | `codegen --check`, `L002` |
| `buildings.json` | `packages/protocol/buildings.ts` | `apps/client` | `codegen --check`, `L005` |
| `schema/$defs.unit` | `packages/protocol/units.ts` | `packages/protocol` | `codegen --check`, `L001` |
| `meta.json` | `packages/protocol/versions.ts` | `packages/contentpack` | `codegen --check`, `L266` |
| `arch.schema_tables` | `services/api/migrations/NNN_*.sql` | Postgres | `codegen --check`, `L251`–`L255` |
| `derived.command_endpoints` | таблица маршрутов REST | `services/api` | `L232`, проба `endpoint_bijection` |
| `derived.endpoint_refusals` | матрица отказов на эндпоинт | `services/api` | `L233`, проба `refusal_matrix_matches_t9` |
| `codes.json` категория `transport` | карта кода в HTTP | `services/api` | `L247`, `L248` |
| `arch.packages` | `.dependency-cruiser.cjs`, project references в `tsconfig` | сборка | `L226`–`L230`, пробы `layer_graph_sorts`, `layer_cycle_detected` |
| `arch.channel_rules` | список WS-каналов | `services/api`, `apps/client` | `L236`–`L238`, проба `channels_partition_state_sources` |
| `arch.metrics` | экспортеры метрик и пороги | `services/api`, `engine`, `attestor` | `L259`, проба `invariants_all_metered` |
| `arch.environments`, `arch.readiness` | манифесты окружений, `readiness` | деплой | `L260`, проба `readiness_requires_pack` |
| `content/out/pack.json` через `content/vectors.py` | `content/out/vectors/*.json`, `content/out/vectors.sha256` | тесты `packages/engine` | побайтовое равенство, `pnpm -w run vectors` |
| `art/out/scene.json`, `art/out/sprites.json` | сцена PixiJS | `apps/client` | `L183`, `L184`, `L185` |
| `arch.toolchain` (заводится в C0) | `engines` в манифестах, базовый образ CI | все | новое правило `L267` |

---

## §3. Решения `D-C-1` … `D-C-14`

### `D-C-1`. Python — оракул, TypeScript — рантайм

**Решение.** `content/*.py` остаётся генератором пака и эталоном тика. В прод-рантайм он не входит. Единственный рантайм тика — `packages/engine` на TypeScript (`docs/BRIEF.md` §2, строка «Стек»).

**Причина.** Публичный верификатор (`DESIGN.md` §6.3) обязан импортировать движок без базы, HTTP и провайдера; браузер обязан импортировать его же для предпросмотра. Питоновский оракул нужен как независимый арбитр байтов: если бы обе реализации писал один и тот же слой, дрейф ловить было бы нечем.

**Как проверяется.** Дрейф ловят золотые векторы (`D-C-5`), а не ревью. Ни один `Dockerfile` не копирует `content/`; проверка — правило на состав образа в C9 и отсутствие `python` в рантайм-стадии.

### `D-C-2`. Ни одного числового литерала в движке

**Решение.** `engine` — чистая функция `(pack, state, inputs) → (state, records)`. В `packages/engine` разрешены только `0`, `1` и индексы; все параметры приходят инъекцией из пака.

**Причина.** Число, зашитое в движок, — второй экземпляр значения, которое уже лежит в паке, то есть дефект по сквозному правилу `docs/BRIEF.md` §0 и `docs/CONTENT.md` §1. Хуже: такое число не попадает в `pack_hash`, и реплей старой смены на новом паке даёт другой ответ без следа в заголовке.

**Как проверяется.** eslint `no-magic-numbers` на пакете с whitelist `[0, 1]`. Плюс проба: подмена числа в паке меняет выход движка; подмена числа в коде невозможна, потому что числа там нет (grep-правило на десятичные литералы в `packages/engine/src/**` вне тестов).

### `D-C-3`. В хеш-путь идёт только `bigint`; ни `Math`, ни `Date`, ни I/O

**Решение.** В модуле сериализации `number` запрещён типами: подписи принимают `bigint | string | boolean | Record<…>`, и `number` не проходит компиляцию. В `packages/engine` запрещены `Math`, `Date`, `performance`, `Math.random`, `crypto.getRandomValues`, `process`, `fetch`, `fs` и любой другой I/O.

**Причина.** `docs/TICK.md` §2 и §4: float на пути записи запрещён (`L010`, `L198`, `L209`), случайность — только `hash(city_id, tick_index, agent_id)` (§5), время — только `city_time` (§6). Лаг хоста не является входом тика.

**Как проверяется.** eslint `no-restricted-globals` / `no-restricted-properties` / `no-restricted-imports` на `packages/engine`; `tsc --noEmit` со `strict`; проба «`Date.now()` в движке не компилируется и не линтуется». На стороне пака инвариант уже держат `L208`, `L209`, `L211`, `L223`.

### `D-C-4`. Загрузчик пака — свой bigint-safe парсер, падающий закрыто

**Решение.** `packages/contentpack` несёт собственный zero-dep потоковый JSON-парсер: целое → `bigint`; нецелое число (точка, `e`, `E`, `-0`, `NaN`, `Infinity`) → ошибка загрузки; дубликат ключа → ошибка; сверка `pack_hash` при загрузке падает **закрыто**.

**Причина.** Факт разведки 2: `JSON.parse` теряет точность на паке. Сверка хеша — единственный closed-контур в системе (`docs/ARCHITECTURE.md` §3, `arch.services.pack_gate`): неизвестный пак не имеет права оценить смену (`docs/TICK.md` §2, `L207`).

**Как проверяется.** Негативные тесты: `1.0`, `1e3`, `-0`, `NaN`, дубликат ключа, усечённый поток — каждый обязан дать ошибку загрузки с кодом. Позитивный: все значения больше `2**53` из пака переживают загрузку и повторную канонизацию побайтово (`D-C-6`). Плюс десятичная строка `generated.modifiers.modifier_stack_probe.worst_numerator` читается как `BigInt(string)` и никогда не проходит через `Number` (`R-C-5`, `L086`).

### `D-C-5`. Золотые векторы как антидрейф

**Решение.** Новый скрипт `content/vectors.py` (пишется в C0) экспортирует из Python-оракула набор векторов. Для каждого: `tick_inputs` каноническими байтами, ожидаемые `DecisionRecord` каноническими байтами, хеши листьев и корень, агрегаты города, срез состояния. Выход — `content/out/vectors/*.json` плюс `content/out/vectors.sha256`, по образцу существующих `content/out/pack.sha256`, `BUILDS.sha256`, `SIM.sha256`.

Обязательные классы векторов:

| класс | что фиксирует |
|---|---|
| `empty_tick` | тик без агентов: пустой список записей, заголовок всё равно лист `0` |
| `payroll_trim` | тик с урезанием фонда: `payroll_ratio_bps` и пропорциональность |
| `idle_<code>` | по одному вектору на каждый код категории `idle` в `codes.json` |
| `day_boundary` | тик на `hour==0`: снапшот, храповик, `ema_step`, заморозка бюджета |
| `feed_dead` | `feed_live = 0`: `STALE_PRICE`, деградация только вниз, нулевой ответ даёт минт `0` |
| `stack_nonempty` | непустой стек модификаторов: `stage_bps` `base`/`post`, сплав T5 |
| `cyrillic` | кириллица в строках: экранирование как `ensure_ascii=False` |
| `over_2_53` | величина больше `2**53` в записи и в заголовке |
| `layout_v1_edge` | граница `layout_version = 1`: пустая причина, пустое здание, нулевая дельта фрагментов |
| `keccak_L202` | keccak-векторы `L202`: empty, `abc` и три граничные длины блока |
| `merkle_shapes` | один лист, нечётный уровень, порядок листьев по `agent_id` UTF-8 |
| `cid_city_day` | CID суток города — **переносится в C8** вместе со спекой кодека, см. `R-C-6` |

**Причина.** Две реализации тика — формальное нарушение «одно и то же в двух местах» (`R-C-3`). Единственный способ сделать это нарушение безопасным — не ревью, а машинный арбитр: байты из Python против байтов из TypeScript.

**Как проверяется.** TS-тест обязан воспроизвести **байты точно**, а не «эквивалентно по значению»: сравнение `Uint8Array`, а не разобранных объектов. `python content/vectors.py` дважды даёт один `vectors.sha256`. Новое правило `L269`: набор классов векторов в манифесте покрывает обязательный список; отсутствующий класс — ошибка гейта.

### `D-C-6`. Канонический JSON в TypeScript байт-в-байт как в Python

**Решение.** Одна спека канонизации, одна реализация на язык:

| требование | значение |
|---|---|
| кодировка | UTF-8, без BOM |
| порядок ключей | по возрастанию кодовых точек ключа |
| разделители | `,` и `:` без пробелов |
| целые | без `+`, без ведущих нулей, минус только у отрицательных |
| экранирование | минимальное, не-ASCII байтами как есть (эквивалент `ensure_ascii=False`) |
| запрещено | `NaN`, `Infinity`, `-0`, float, `null` |
| порядок полей записи | `docs/TICK.md` §8, layout v1 |

**Причина.** Канонические байты — вход в keccak и в `pack_hash`. Любое расхождение в пробеле или экранировании меняет корень и делает записанную смену непроверяемой (`docs/CONTENT.md` §5, `DESIGN.md` §6.2).

**Как проверяется.** Векторами `D-C-5`, а не глазами: класс `cyrillic` ловит экранирование, `over_2_53` — числовую печать, `layout_v1_edge` — пустые поля. На стороне пака инвариант держат `L196`–`L200`.

### `D-C-7`. Кодоген односторонний

**Решение.** `content/codegen.py` (пишется в C0) генерирует из пака: семь артефактов «T12: codegen»; DDL таблиц «T12: schema»; таблицу маршрутов REST из `commit:*` (`docs/API.md` §2); карту транспортных кодов в HTTP; конфиг `dependency-cruiser` из таблицы слоёв; список каналов WS. Шапка каждого артефакта — `GENERATED from pack <hash>; do not edit`. Флаг `--check` перегенерирует в память и падает на расхождении.

**Причина.** `docs/ARCHITECTURE.md` §4: пак — единственный источник форм на проводе, `packages/protocol` — сгенерированный артефакт. Ручной список путей запрещён (`L232`), второго инвентаря зависимостей не существует (`D-C-8`).

**Как проверяется.** `python content/codegen.py --check` в гейте CI. Правленный руками сгенерированный файл — дефект уровня гейта: шапка несёт хеш пака, `--check` ловит и текст, и хеш. Новое правило `L270`: список артефактов кодогена равен `arch.codegen` плюс производные (DDL, маршруты, cruiser, каналы), и ни один артефакт не заведён вне таблицы.

### `D-C-8`. Границы слоёв — данные, второго инвентаря нет

**Решение.** Конфиг `dependency-cruiser` и project references в `tsconfig` генерируются из `arch.packages`. Списка пакетов, живущего рядом с таблицей слоёв, не существует.

**Причина.** Рекомендация `docs/reports/T12_final.md` §6: пакет вне таблицы слоёв в данных не существует, и завести второй список значило бы получить два ответа на вопрос «кому можно импортировать кого».

**Как проверяется.** `L226`–`L230` на стороне пака; `depcruise` на стороне кода; пробы `layer_graph_sorts` и `layer_cycle_detected`. Новый пакет, добавленный в код и не добавленный в `arch.packages`, не получает ни `tsconfig`-ссылки, ни разрешения в cruiser — сборка падает.

### `D-C-9`. БД без ORM

**Решение.** Драйвер `pg`, нумерованные forward-only SQL-миграции, DDL из пака, канонические байты в `bytea` плюс колонка хеша, `account_kind` через `CHECK`, отсутствие ребра `demo ↔ wallet` выражено ограничением БД, `migration_version` участвует в `readiness` вместе с `pack_hash`.

**Причина.** `docs/ARCHITECTURE.md` §5 и §9: байты плюс хеш, не пересобираемый JSON; `city_time` — правда, `tick_index` — вычисляемое; снапшот на границе суток равен `time.derived.ticks_per_city_day`. ORM с ленивой сериализацией переставил бы ключи и увёл корень (`RK-6`). Барьер демо, выраженный кодом сервиса, обходится вторым путём записи; выраженный ограничением БД — не обходится.

**Как проверяется.** `L251`–`L255`, `L260`; пробы `replay_from_storage`, `snapshot_tail_equals_full_replay`, `demo_barrier_holds`, `record_fields_have_homes`, `readiness_requires_pack`. Негативный тест: `INSERT` перевода `demo → wallet` отклоняется базой, а не сервисом.

### `D-C-10`. Порядок в тик-хосте

**Решение.** Входы записаны → `tick` → выплата → запись → `outbox`. Аттестация асинхронная и неблокирующая: упавший IPFS или RPC доход не останавливает. Писатель денег игрока — только `services/api`.

**Причина.** `docs/TICK.md` §9, `DESIGN.md` §6.4, `.cursor/rules/economy-determinism.mdc`: экономика падает закрыто, аттестация — открыто. `arch.services`: `fail_mode = open` у всех, кроме `pack_gate`; `writes_player_money = 1` только у `api`.

**Как проверяется.** `L206` (AST: выплата до записи), `L246`; пробы `attestor_down_pay_continues`, `services_do_not_block_tick`, `pack_hash_mismatch_halts`. Второй писатель денег ловится правилом на состав миграций: таблицы с `money = 1` доступны на запись роли только одного сервиса.

### `D-C-11`. `twap_from_samples` — одно определение

**Решение.** `twap_from_samples` живёт в `packages/engine`; `services/sampler` его импортирует. Второй реализации не существует. Спот пула в путь минта не входит ни в одном слое.

**Причина.** `docs/ARCHITECTURE.md` §7 и `R-T12-3`: заголовок и публикуемый ряд обязаны считаться одной функцией, иначе TWAP в заголовке разойдётся с рядом и цена перестанет быть проверяемой. Спот в минте — прямой запрет `docs/BRIEF.md` §8 и `docs/TICK.md` §7.

**Как проверяется.** `L240`, `L242`, `L243`; пробы `sampler_twap_recompute` и `sampler_twap_sensitive` (ряд минус один сэмпл меняет число). Правило импорта: `services/sampler` не объявляет собственной функции агрегации — grep на второе определение в C6.

### `D-C-12`. Клиент читает пак; предпросмотр — только чтение

**Решение.** Экраны, строки, отказы, спрайты — из пака и `art/out`. Ни одного зашитого экрана, ни одной строки текста на проводе. Импорт `engine` в клиент помечен `preview_only`: preview-API возвращает readonly-проекцию, запись в состояние невозможна **типом**, а не соглашением.

**Причина.** `docs/API.md` §1: текста на проводе нет, код плюс подстановки, текст рендерит клиент из `content/strings/ru.json`; поле `message` запрещено (`L248`). `HUD.md` §8 и `.cursor/rules/hud.mdc`: клиент не считает экономику, локально экстраполирует только часы. `arch.packages.client.preview_only = 1`.

**Как проверяется.** `L158`, `L167`, `L168`, `L230`, `L248`; проба `demo_barrier_holds`. Типовая проверка: `preview(state)` возвращает `DeepReadonly<State>`, и попытка присваивания не компилируется. Текстовая проверка: eslint `no-restricted-syntax` на литералы с кириллицей в `apps/client/src/**`, плюс тест «множество отрендеренных строк — подмножество ключей `content/strings/ru.json`».

### `D-C-13`. Имя теста равно имени пробы

**Решение.** Имя vitest-теста дословно равно имени пробы из колонки `tests` таблицы «T12: roadmap» и из списка конструкционных проб `docs/reports/T12_final.md` §4. Одна проба — один тест с тем же именем.

**Причина.** Гейт этапа должен читаться как строка дорожной карты. Если TS-тест назван иначе, приходится держать таблицу соответствий — то есть третий инвентарь помимо пака и кода.

**Как проверяется.** Новое правило `L268`: множество имён тестов, объявленных этапом, равно множеству `roadmap.tests` этого этапа плюс объявленным конструкционным пробам. `vitest run -t <имя пробы>` из `gate_cmd` строки этапа обязан находить ровно один тест.

### `D-C-14`. Версии инструментов — тоже данные

**Решение.** В C0 в `arch.json` заводится блок `toolchain` (Node LTS, pnpm, TypeScript, vitest, fast-check, dependency-cruiser, eslint, Vite, PixiJS, React, `pg`, Postgres) с генерируемой таблицей `GEN:arch.toolchain` и правилом линтера, что `engines` в манифестах совпадают с паком.

**Причина.** Версия инструмента, записанная и в плане, и в конфиге, — дефект «одно число в двух местах». Расхождение версии между машиной разработчика и образом CI даёт разные байты у любого шага, где инструмент участвует в генерации.

**Как проверяется.** Новое правило `L267`: `engines` и версии зависимостей в каждом манифесте равны `arch.toolchain`; расхождение — ошибка гейта. В этом плане ни одна версия не написана значением: адрес — `arch.toolchain.*`.

---

## §4. Этапы `C0` – `C11`

Анатомия этапа фиксирована: `цель`, `строка ROADMAP`, `входы`, `выходы`, `команда гейта`, `инвариантные тесты`, `критерий готовности`, `объём`, `зависит от`, `риски этапа`. Порядок этапов диктуют слои и менять его нельзя.

### `C0` — toolchain, векторы, кодоген-каркас

- **цель.** Поставить форму кодовой фазы: воркспейс, запреты, оракул векторов, односторонний кодоген.
- **строка ROADMAP.** `pack_gate` — этап держит его зелёным и публикует пак **25**. Строк под toolchain, векторы и кодоген в «T12: roadmap» нет: `R-C-1`.
- **входы.** `docs/BRIEF.md` §2 (строка «Стек»), §3; `docs/ARCHITECTURE.md` §2, §4; `docs/CONTENT.md` §5, §6; `docs/TICK.md` §2, §4, §5, §8, §9; ключи пака `arch.packages`, `arch.codegen`, `arch.schema_tables`, `arch.channel_rules`, `arch.roadmap`, `meta.rules_version`, `meta.pack_version`, `tick.params.layout_version`, `attest.params.*`.
- **выходы.** `pnpm-workspace.yaml`, корневой манифест, `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `vitest.workspace.ts`, `eslint.config.js` с запретами `D-C-3`, сгенерированный `.dependency-cruiser.cjs`; `content/vectors.py`, `content/out/vectors/*.json`, `content/out/vectors.sha256`; `content/codegen.py`; блок `toolchain` и новые строки этапов в `content/params/arch.json`; правила `L267`–`L272` в `content/lint.py` с атаками в `content/attack.py`; PENDING-владельцы этапов в `content/params/pending.json`.
- **команда гейта.** `python content/build.py && python content/lint.py && python content/vectors.py && python content/codegen.py --check && pnpm -w install --frozen-lockfile && pnpm -w run gate`.
- **инвариантные тесты.** `L01`, `L13`, `vault_cover` (строка `pack_gate`); новые `L267`, `L268`, `L269`, `L270`, `L271`, `L272`; конструкционные `toolchain_matches_manifests`, `vectors_bytes_stable`, `codegen_check_catches_hand_edit`.
- **критерий готовности.** Пак 25 собирается с нулём проблем канона; `python content/lint.py` даёт `266 + 6` правил и 0 ошибок; `python content/vectors.py` дважды даёт один `vectors.sha256`; `python content/codegen.py --check` падает на одном изменённом байте в любом сгенерированном артефакте; `pnpm -w run gate` падает на внесённом `Date.now()` и на внесённом числовом литерале в `packages/engine`; `arch.toolchain` совпадает с `engines` во всех манифестах, и расхождение в одной версии роняет `L267`.
- **объём.** M.
- **зависит от.** —
- **риски этапа.** `RK-1`, `RK-3`, `RK-5`, `RK-13`, `RK-14`.

### `C1` — `packages/engine`

- **цель.** Порт тика из спеки в единственный рантайм, байт-стабильный по layout v1.
- **строка ROADMAP.** `engine_from_spec`.
- **входы.** `docs/TICK.md` §3 (порядок шагов), §4 (целочисленная арифметика и стоки остатка), §5 (PRNG и стримы), §6 (время и догон), §7 (цена как записанный вход), §8 (layout v1 и заголовок), §9 (дерево и домены), §10 (публичная проверка), §11 (агрегаты), §12 (проводка T5, фрагментов, сезонов, компаньона); `DESIGN.md` §2, §5, §6; `content/tick.py`, `content/aggregates.py`, `content/record.py`, `content/keccak.py`, `content/pack.py` как оракул; ключи пака `tick.*`, `attest.*`, `economy.*`, `time.*`, `agents.params.slots_cap`, `progression.*`, `fragments.*`, `seasons.params.season_prizes_live`, `companion.*`, `exceptions.exceptions.tick_jitter_bps`; `content/out/vectors/*`.
- **выходы.** `packages/engine/src/**` без внешних зависимостей: канонический сериализатор, свой keccak, merkle с доменными байтами и позиционными узлами, `mul_bps`, `twap_from_samples`, `city_clock`, `catch_up`, `tick`, `tick_header`, агрегаты, публичный верификатор `DESIGN.md` §6.3 без цепочки пакетов; `packages/engine/test/**` с векторными и property-тестами.
- **команда гейта.** `python content/attack.py --since-rule L196 && pnpm --filter @corporator/engine run gate && pnpm -w run vectors`.
- **инвариантные тесты.** `L208`, `layout_v1_bytes`, `catchup_eq_replay` (строка `engine_from_spec`); property-тесты `tick_deterministic`, `catchup_equals_replay`, `payroll_trim_proportional`, `no_float_in_bytes`, `record_key_order_irrelevant`, `merkle_odd_level_not_duplicated`.
- **критерий готовности.** Все классы векторов `D-C-5` проходят по **байтам**, а не по значению; `keccak_L202` совпадает с `content/keccak.py` на всех векторах; property-тест fast-check (число прогонов объявлено в `arch.toolchain`, а не в двух конфигах) даёт равенство «догон из одного вызова ≡ N последовательных тиков» и равенство байтов при перестановке ключей входа; `tsc --noEmit` со `strict` проходит; eslint не даёт ни одного числового литерала вне `[0, 1]` и ни одного запрещённого глобала; `packages/engine/package.json` объявляет пустой `dependencies`.
- **объём.** L.
- **зависит от.** `C0`.
- **риски этапа.** `RK-1`, `RK-2`, `RK-4`, `RK-5`, `RK-7`, `RK-8`.

### `C2` — `packages/protocol` и `packages/contentpack`

- **цель.** Сгенерированный протокол и bigint-safe загрузчик пака по хешу.
- **строка ROADMAP.** Строки нет: `R-C-1`. Этап обслуживает `engine_from_spec` и `host_db_replay`, но собственной строки в «T12: roadmap» не имеет.
- **входы.** `docs/ARCHITECTURE.md` §4; `docs/API.md` §1, §3, §6; `docs/CONTENT.md` §5; секции «T12: codegen», «T12: http», «T12: snapshot»; ключи пака `meta.rules_version`, `meta.pack_version`, `meta.derived.pack_hash`, `codes.*`, `screens.*`, `modifier_keys.*`, `districts.*`, `buildings.*`, `schema/$defs.unit`.
- **выходы.** Семь артефактов «T12: codegen» в `packages/protocol/src`; `packages/contentpack/src` — потоковый парсер, реестр паков по хешу, сверка `pack_hash`, отдача секций; обработчик `GET /pack/{pack_hash}` как неизменяемый артефакт с `immutable`-кешем.
- **команда гейта.** `python content/codegen.py --check && pnpm --filter @corporator/protocol --filter @corporator/contentpack run gate`.
- **инвариантные тесты.** `L231`, `L232`, `L235`, `L247`, `L248`, `L266`; конструкционные `pack_hash_mismatch_halts`, `record_fields_have_homes`; новые `loader_rejects_float`, `loader_keeps_bigint`, `loader_rejects_duplicate_key`, `pack_by_hash_is_immutable`.
- **критерий готовности.** Загрузка `content/out/pack.json` и повторная канонизация дают тот же `pack_hash` побайтово; все `57` значений больше `2**53` и десятичная строка `worst_numerator` переживают круг без потери разряда; каждый из шести негативных входов (`1.0`, `1e3`, `-0`, `NaN`, дубликат ключа, усечённый поток) даёт ошибку загрузки с кодом, а не молчаливое значение; подмена одного байта в паке даёт отказ загрузки, а не другое число; `codegen --check` зелёный, и правка одного символа в любом из семи артефактов роняет его.
- **объём.** M.
- **зависит от.** `C0`.
- **риски этапа.** `RK-3`, `RK-5`, `RK-13`.

### `C3` — `services/api` и БД

- **цель.** Хост команд и состояния с forward-only миграциями и байтовым реплеем из хранилища.
- **строка ROADMAP.** `host_db_replay`.
- **входы.** `docs/ARCHITECTURE.md` §3, §5, §9; `docs/API.md` §1–§6; `docs/TICK.md` §2, §6, §9; `docs/SCREENS.md` §5; секции «T12: schema», «T12: endpoints», «T12: http», «T12: snapshot», «T12: environments»; ключи пака `arch.schema_tables`, `arch.readiness`, `arch.derived.state_snapshot_every_ticks`, `api.path_rules`, `api.envelope_ok_fields`, `api.envelope_error_fields`, `api.derived.command_rate_limit_per_city_tick`, `api.params.domain_conflict_http`, `time.derived.ticks_per_city_day`, `time.params.offline_cap_city_hours_base`, `agents.params.slots_cap`, `screens.params.demo_isolated`, `derived.command_endpoints`, `derived.endpoint_refusals`.
- **выходы.** `services/api/src/**` — планировщик тиков от `city_time`, обработчики `POST /command/{effect}`, `GET /city/{city_id}/state`, `GET /pack/{pack_hash}`, WS-каналы, конверт ответа, отказ `409` кодом без прозы; `services/api/migrations/NNN_*.sql`, сгенерированные из пака; экспортеры десяти метрик «T12: metrics» с порогами по ключам.
- **команда гейта.** `python content/attack.py --construction-only && pnpm --filter @corporator/api run gate && pnpm --filter @corporator/api run migrate:check`.
- **инвариантные тесты.** `replay_from_storage`, `snapshot_tail_equals_full_replay` (строка `host_db_replay`); `intent_replay_once`, `stale_expected_city_time`, `rate_limit_derived`, `demo_barrier_holds`, `pack_hash_mismatch_halts`, `endpoint_bijection`, `refusal_matrix_matches_t9`, `stub_endpoint_no_spend`, `channels_partition_state_sources`, `clock_has_no_channel`, `readiness_requires_pack`, `invariants_all_metered`, `services_do_not_block_tick`, `record_fields_have_homes`.
- **критерий готовности.** Реплей из сохранённых байтов даёт **те же байты**, что генезисный прогон, на выборке не менее `time.derived.ticks_per_city_day` тиков; хвост от снапшота равен полному реплею побайтово; повтор `intent_id` возвращает первый результат и `API_INTENT_REPLAY`, а не второй эффект; устаревшая `expected_city_time` отказывает кодом `API_PACK_STALE`; лимит команд равен `api.derived.command_rate_limit_per_city_tick` и в params отсутствует; `INSERT` перевода `demo → wallet` отклоняется ограничением БД; `readiness` красный при несовпадении `pack_hash` либо `migration_version`; ни одна метрика не несёт литерального порога.
- **объём.** L.
- **зависит от.** `C1`, `C2`.
- **риски этапа.** `RK-6`, `RK-7`, `RK-8`, `RK-12`, `RK-13`.

### `C4` — `packages/chainport`

- **цель.** Порт активов с двумя реализациями, без RPC за пределами `rpc`.
- **строка ROADMAP.** `port_mock`.
- **входы.** `docs/ARCHITECTURE.md` §6; `DESIGN.md` §10; `docs/API.md` §6; секция «T12: port»; ключи пака `arch.port.groups`, `arch.port.implementations`, `arch.port.rpc_import_only`, `arch.keys`, `api.derived.voucher_ttl_s`, `launch.*` для адресов и котировки.
- **выходы.** `packages/chainport/src` — интерфейс `AssetPort` из четырёх групп (`corp_token`, `vault`, `stake_registry`, `merkle_roots`), реализации `mock` и `rpc`; `mock` полный, `rpc` заглушен до `C10`; разделение ключей: `voucher_signer` у `api`, `buyback_executor` у `buyback`, в клиенте ни одного.
- **команда гейта.** `python content/attack.py --only L256,L257,L258 && pnpm --filter @corporator/chainport run gate`.
- **инвариантные тесты.** `port_two_implementations`, `voucher_single_use` (строка `port_mock`).
- **критерий готовности.** Реализаций ровно две, и попытка завести третью роняет `L256`; импорт RPC-библиотеки вне подкаталога `rpc` роняет eslint `no-restricted-imports` и `L257`; TTL ваучера равен `api.derived.voucher_ttl_s` и в params отсутствует (`L258`); повторное предъявление ваучера с тем же nonce отклоняется, и на паре одновременных предъявлений проходит ровно одно; ни один ключ из `arch.keys` не читается сборкой `apps/client` (проверка составом бандла).
- **объём.** S.
- **зависит от.** `C2`.
- **риски этапа.** `RK-9`, `RK-10`.

### `C5` — `apps/client`

- **цель.** Клиент на протоколе и mock-порте, целиком из пака, без счёта экономики.
- **строка ROADMAP.** `client_on_mock`.
- **входы.** `HUD.md` §2, §5, §6, §7, §8, §9; `docs/SCREENS.md` §1–§9; `docs/WORLD.md` §7, §8, §9; `.cursor/rules/hud.mdc`, `.cursor/rules/art-pipeline.mdc`; `art/out/scene.json`, `art/out/sprites.json`, `art/palette/corporator.hex`; ключи пака `screens.*`, `codes.*`, `content/strings/ru.json`, `placement.derived.safe_rect_w_px`, `placement.derived.safe_rect_h_px`, `placement.derived.zoom_levels`, `placement.derived.zoom_min_scale_den`, `placement.params.camera_edge_margin_tiles`, `placement.derived.level_overlays`, `placement.derived.zone_centroids`, `balance.params.building_level_max`, `arch.packages.client.preview_only`; бюджеты производительности — `docs/reports/GATE_PERF.md`.
- **выходы.** `apps/client/**` — Vite, React для HUD и экранов, PixiJS v8 для изометрии; сцена из `art/out/scene.json` и тайлов/спрайтов; полосы и безопасный прямоугольник камеры из фикстуры `content/fixtures/hud_layout.json`; зум из пака; тексты из `content/strings/ru.json`; демо-барьер; readonly-проекция предпросмотра.
- **команда гейта.** `python content/lint.py && pnpm --filter @corporator/client run gate && pnpm --filter @corporator/client run test -- -t demo_barrier_holds`.
- **инвариантные тесты.** `L158`, `demo_barrier_holds` (строка `client_on_mock`); `hud_safe_rect_positive`; новые `client_strings_from_pack`, `client_preview_is_readonly`, `client_sees_no_chainport`.
- **критерий готовности.** Множество отрендеренных строк — подмножество ключей `content/strings/ru.json`, и внесённый в код кириллический литерал роняет eslint; попытка записи в объект предпросмотра не компилируется; бандл клиента не содержит ни одного модуля `packages/chainport` и ни одного драйвера БД (проверка составом бандла, `L230`); все `screens.actions` достижимы, недостижимых ноль (`L154`-семейство и `L160`); на минимальном зуме изометрический bbox острова влезает в безопасный прямоугольник, посчитанный из фикстуры (`L185`); часы экстраполируются локально, и ни один экономический показатель не считается на клиенте (grep-правило на арифметику над полями экономических `value_kind`).
- **объём.** L.
- **зависит от.** `C2`, `C4`; смотрит на `C3` для живых данных, но обязан работать на mock-порте.
- **риски этапа.** `RK-7`, `RK-12`, `RK-13`.

### `C6` — `services/sampler`

- **цель.** Записать TWAP и фид во входы тика так, чтобы тик никогда не ждал, а цена оставалась проверяемой.
- **строка ROADMAP.** `sampler`.
- **входы.** `docs/ARCHITECTURE.md` §7, §8; `docs/TICK.md` §7; `docs/API.md` §4; `HUD.md` §8; ключи пака `api.params.sampler_samples_per_tick`, `api.params.sampler_period_max_s`, `api.derived.sampler_period_s`, `api.derived.price_channel_period_s`, `api.derived.samples_per_twap_window`, `api.params.ws_heartbeat_s`, `economy.params.twap_window_city_hours`, `economy.params.price_staleness_max_city_hours`, `arch.derived.sampler_age_alert_city_hours`, `arch.params.price_day_published`, `arch.sampler_input_fields`, `arch.aggregation`.
- **выходы.** `services/sampler/src/**` — снятие TWAP пула `CORP/ETH` и фида `ETH/USD` по производному периоду, запись в `price_samples` и во входы тика, публикация ряда `price_day`, поведение при молчании.
- **команда гейта.** `python content/attack.py --only L239,L241,L242,L243 && pnpm --filter @corporator/sampler run gate`.
- **инвариантные тесты.** `sampler_twap_recompute`, `sampler_twap_sensitive`, `sampler_silence_keeps_age` (строка `sampler`); `sampler_period_divides_tick`, `services_do_not_block_tick`.
- **критерий готовности.** TWAP заголовка пересчитывается из опубликованного ряда до последнего разряда; ряд минус один сэмпл даёт **другое** число (чувствительность, не декорация); при молчании источника значение остаётся старым, `feed_live` уходит в ноль, возраст растёт, а метка времени сэмпла не двигается ни на единицу; алерт возраста срабатывает раньше, чем устаревание начинает резать курс (сравнение `arch.derived.sampler_age_alert_city_hours` с `economy.params.price_staleness_max_city_hours`); период равен `api.derived.sampler_period_s`, делит длину тика и не превышает `api.params.sampler_period_max_s`; сэмплер, остановленный целиком, не задерживает ни один тик (проба `services_do_not_block_tick` на живом хосте); второго определения агрегации в дереве нет.
- **объём.** S.
- **зависит от.** `C1`, `C3`, `C4`.
- **риски этапа.** `RK-9`, `RK-4`.

### `C7` — `services/buyback`

- **цель.** Транспорт «ETH со сборов → покупка `$CORP` → подтверждённый депозит в vault → минт Capital в фонд» без единого нового числа.
- **строка ROADMAP.** `buyback`.
- **входы.** `docs/ARCHITECTURE.md` §7; `DESIGN.md` §2.3; `docs/LAUNCH.md` §5, §14; ключи пака `arch.buyback_refs` (`launch.params.buyback_cadence_city_hours`, `launch.params.buyback_tranche_cap_bps`, `launch.params.buyback_min_batch_wei`, `launch.params.buyback_slippage_safety`), `arch.buyback_order`, `meta.params.buyback_slippage_safety_min`, `economy.params.capital_anchor`.
- **выходы.** `services/buyback/src/**` — расписание от `city_time`, транш от глубины, накопление ниже порога батча, четыре метки времени в `buyback_batches`, минт в фонд только после подтверждённого депозита.
- **команда гейта.** `python content/attack.py --only L244,L245 && pnpm --filter @corporator/buyback run gate`.
- **инвариантные тесты.** `mint_after_deposit_only`, `buyback_tranche_at_three_depths`, `buyback_below_min_batch_waits` (строка `buyback`).
- **критерий готовности.** Ни одного числа выкупа в `services/buyback`: все читаются через `arch.buyback_refs` (`L244`); минт, поставленный до подтверждённого депозита, отклоняется и роняет `L245` и `mint_after_deposit_only`; транш на трёх разных глубинах равен `buyback_tranche_cap_bps` от глубины и ни разу не превышает её; сбор ниже `launch.params.buyback_min_batch_wei` даёт **ноль** отправок, а не одну маленькую; расписание детерминированное и записанное, внутри сервиса нет несидированной случайности и системного времени в решении «когда покупать»; защита от фронтрана собственной покупки выражена запасом `launch.params.buyback_slippage_safety` не ниже `meta.params.buyback_slippage_safety_min` (`L022`).
- **объём.** S.
- **зависит от.** `C3`, `C4`.
- **риски этапа.** `RK-10`, `RK-9`.

### `C8` — `services/attestor`

- **цель.** Дерево, корни и CID суток города локально, с fail-open и без чейна.
- **строка ROADMAP.** `attestor_no_chain`.
- **входы.** `docs/TICK.md` §9, §10, §13; `DESIGN.md` §6.2, §6.4, §11; `docs/ARCHITECTURE.md` §8; ключи пака `attest.params.attest_root_period_s`, `attest.params.merkle_leaf_domain_byte`, `attest.params.merkle_node_domain_byte`, `attest.derived.attest_roots_per_day`, `attest.derived.ipfs_aggregate_key`, `attest.derived.merkle_leaf_order`, `attest.derived.attest_failure_mode`, `arch.params.attest_lag_alert_ticks`, `tick.params.layout_version`.
- **выходы.** `services/attestor/src/**` — батчер по минуте стены по всем городам, один объект на `(city_id, city_day)`, `outbox` с повторами, локальное хранилище корней, метрика `attest_lag_ticks` и код `SERVICE_DEGRADED`; спека и реализация кодека CID (`R-C-6`) плюс класс векторов `cid_city_day` в `content/vectors.py`.
- **команда гейта.** `python content/attack.py --only L246,L207 && pnpm --filter @corporator/attestor run gate && pnpm -w run vectors`.
- **инвариантные тесты.** `attestor_down_pay_continues`, `pack_hash_mismatch_halts` (строка `attestor_no_chain`); `L201`, `L202`, `L203`, `L204`, `L205`; новый `cid_matches_oracle`.
- **критерий готовности.** Корень, посчитанный TS-аттестатором, равен корню из вектора Python **побайтово** (байты берутся из оракула, не из собственного вывода TS); один лист даёт корень равный листу, нечётный уровень не дублируется, домен листа не выдаётся за домен узла; отключённые IPFS и RPC оставляют выплату в состоянии, записи в `outbox`, `attest_lag_ticks` растёт, а тик не задерживается ни на один шаг; CID суток города совпадает с CID из `content/vectors.py` класса `cid_city_day`; период корня равен `attest.params.attest_root_period_s`, ключ агрегата — `(city_id, city_day)`, а не час стены.
- **объём.** M.
- **зависит от.** `C1`, `C3`.
- **риски этапа.** `RK-2`, `RK-11`, `RK-1`.

### `C9` — наблюдаемость, деплой, CI

- **цель.** Сделать инварианты измеримыми в проде и собрать один гейт, которым закрывается любой этап.
- **строка ROADMAP.** Строки нет: `R-C-1`.
- **входы.** `docs/ARCHITECTURE.md` §8, §9; `DESIGN.md` §5.4, §6.4; `docs/CONTENT.md` §5; `docs/reports/GATE_PERF.md`; секции «T12: metrics», «T12: environments»; ключи пака `arch.metrics` (десять строк с `threshold_src`), `arch.readiness`, `arch.environments`, `arch.params.llm_worker_concurrency`, `arch.params.attest_lag_alert_ticks`, `arch.derived.companion_queue_capacity`, `companion.params.companion_advisor_queue_depth`, `arch.toolchain`.
- **выходы.** Экспортеры десяти метрик с порогами по ключам пака; `readiness` = `pack_hash` + `migration_version`; манифесты `dev` / `staging` / `prod`; образ, пинящий `pack_hash`; единый гейт CI с таблицей «шаг → команда → что ловит»; `services/llm/src/**` снаружи тика с `fail_mode = open` и шаблонной подменой при отказе провайдера.
- **команда гейта.** `pnpm -w run ci` — таблица шагов, каждый шаг падает независимо.
- **инвариантные тесты.** `invariants_all_metered`, `readiness_requires_pack`, `services_do_not_block_tick`; `L246`, `L259`, `L260`; новые `image_pins_pack_hash`, `image_has_no_python`, `llm_refusal_falls_back_to_template`, `ci_step_has_red_run`.
- **критерий готовности.** Каждая из десяти строк `arch.metrics` имеет живой экспортер, и литеральный порог в коде роняет `L259`; `readiness` красный при подмене любой из двух величин; образ, собранный из другого пака, не проходит `readiness` против БД, миграции которой пришли от первого; в образе рантайма нет интерпретатора Python и нет каталога `content/` (`D-C-1`); отказ провайдера LLM даёт шаблон, и экономический тик не меняет ни одного байта записи; **у каждого шага CI записан красный прогон** — вход, на котором шаг падает, по `.cursor/rules/verification-loop.mdc` §3; полный `attack.py` не стоит в гейте коммита (`R-C-4`).
- **объём.** M.
- **зависит от.** `C3`, `C6`, `C7`, `C8`.
- **риски этапа.** `RK-14`, `RK-13`, `RK-11`, `RK-6`.

### `C10` — `chain_v1_1`

- **цель.** Включить живой RPC и живой корень, не меняя ни одного байта layout v1.
- **строка ROADMAP.** `chain_v1_1`.
- **входы.** `DESIGN.md` §10, §11; `docs/TICK.md` §9, §13; `docs/ARCHITECTURE.md` §6, §10 (`R-T12-9`); `docs/LAUNCH.md`; ключи пака `arch.port.groups.merkle_roots`, `arch.port.groups.stake_registry`, `arch.port.rpc_import_only`, `attest.derived.attest_roots_per_day`, `tick.params.layout_version`.
- **выходы.** Реализация `rpc` во всех четырёх группах порта; живая отправка корня merkle; `wallet.chain` и `wallet.corp_balance` живыми в канале `price`; реестр стейка как источник `stake_snapshot`.
- **команда гейта.** `python content/lint.py && pnpm --filter @corporator/chainport run test -- -t rpc_parity && pnpm -w run vectors`.
- **инвариантные тесты.** `L204`, `L205` (строка `chain_v1_1`); `layout_v1_bytes`; новые `rpc_parity_with_mock`, `rpc_silence_is_open`, `stake_snapshot_is_recorded_input`.
- **критерий готовности.** Реализация `rpc` даёт на каждом методе порта тот же результат, что `mock`, на общем наборе фикстур; корень, отправленный в чейн, равен корню локального аттестатора побайтово, и `layout_version` остался прежним (`L200`, `L266`); молчащий или лгущий RPC не блокирует тик и не входит в путь минта — `stake_snapshot` попадает в заголовок записанным входом, а не читается изнутри тика; `wallet.chain` и `wallet.corp_balance` живут в канале `price` и во вход тика не входят. Закрывает адресно: `R-T11-10`, `R-T11-12`, `R-T12-9`.
- **объём.** M.
- **зависит от.** `C4`, `C8`, `C9`.
- **риски этапа.** `RK-9`, `RK-2`, `RK-7`.

### `C11` — `seasons_prizes_v1_1`

- **цель.** Включить призы сезонов пересчётом, а не флагом.
- **строка ROADMAP.** `seasons_prizes_v1_1`.
- **входы.** `docs/PRIZES.md` §6, §7; `DESIGN.md` §11; `docs/TICK.md` §12; ключи пака `seasons.params.season_prizes_live`, `seasons.params.prize_curve_alpha_bps`, `seasons.params.stability_bps`, `fragments.*`, `meta.params.*` границ возврата.
- **выходы.** Распределение призового пула на топ-N; включённый `season_prizes_live`; пересчитанный пак с новым `rules_version` (major, если формула распределения двигает записанные величины).
- **команда гейта.** `python content/lint.py && python content/attack.py --only L115,L220 && pnpm --filter @corporator/api run test -- -t season_prize_distribution`.
- **инвариантные тесты.** `L115`, `L220` (строка `seasons_prizes_v1_1`); `L107`, `L113`, `L114`, `L120`, `L121`; новый `season_prize_distribution_proportional`.
- **критерий готовности.** Сумма выплат по кривой не превышает записанный пул ни при одном N, включая `N = 1` и `N = 0` (без деления на ноль); при `season_prizes_live = 0` ранг есть, а минт `$CORP` отсутствует — и это остаётся проверяемым после включения флага на другом городе; включение флага без пересчёта роняет `L220`; приз — `$CORP`, а не Capital, и хоп-надбавка равна нулю (`L109`); демо-аккаунт не может взять реальный приз (`L112`); пропорциональность распределения совпадает с механикой фонда зарплат, а не вводит вторую формулу.
- **объём.** S.
- **зависит от.** `C3`, `C10`.
- **риски этапа.** `RK-12`, `RK-4`.

---

## §5. Инварианты D13 → этап

| инвариант | id теста | этап, где тест появляется |
|---|---|---|
| касса `I1_I3` | `vault_cover`, `mint_after_deposit_only` | `C3` (метрика на хосте), `C7` (проба на конвейере) |
| бюджет трения `L13_L14` | `L13`, `L14`, `friction_budget` | `C1` (шаг 0 тика), `C3` (метрика) |
| пропорциональное урезание фонда `payroll_proportional` | `payroll_ratio`, `payroll_trim_proportional` | `C1` |
| `I5` | `i5_reserve_drain`, `L50` | `C1` (шаг капли), `C3` (метрика) |
| `I7` | `i7_exit_cover`, код `VAULT_EXIT_UNCOVERED` | `C1` (шаг `10б`), `C3` (метрика) |
| `I11` | `i11_flow`, `L55` | `C1` (шаг `11а`), `C3` (метрика) |
| детерминизм тика `tick_pure` | `L208`, `tick_determinism`, `tick_deterministic` | `C1` |
| догон ≡ реплей `catchup_eq_replay` | `catchup_eq_replay`, `L214`, `catchup_equals_replay` | `C1` (движок), `C3` (хост и снапшоты) |
| байтовая стабильность layout v1 `layout_v1_bytes` | `layout_v1_bytes`, `L196`–`L200` | `C1` (байты записи), `C8` (байты дерева и корня) |
| барьер демо `demo_isolated` | `demo_barrier_holds`, `L255` | `C3` (ограничение БД), `C5` (клиент) |

Ни одного инварианта без этапа: десять строк `arch.metrics` покрыты полностью, и покрытие держит `L262` на стороне пака плюс `invariants_all_metered` на стороне хоста.

---

## §6. Риски `RK-1` … `RK-14`

| id | риск | где проявится | как ловится | чем закрывается |
|---|---|---|---|---|
| `RK-1` | канонизация JSON в TS расходится с Python: пробел, экранирование, печать целого | байты записи, лист merkle, `pack_hash` | векторы `cyrillic`, `over_2_53`, `layout_v1_edge` сравнивают `Uint8Array`, а не объекты | `D-C-6`, гейт `pnpm -w run vectors` в `C1` |
| `RK-2` | keccak или CID в TS не совпадает с оракулом | корень, доказательство, публикация суток | векторы `keccak_L202`, `merkle_shapes`, `cid_city_day`; `L201`–`L205` | `D-C-5`, свой keccak без зависимостей в `C1`, кодек CID в `C8` (`R-C-6`) |
| `RK-3` | `JSON.parse` теряет разряды на больших целых пака; десятичная строка `worst_numerator` проходит через `Number` | загрузка пака, любое производное число | `loader_keeps_bigint` на всех значениях больше `2**53`; тип `bigint` в подписи сериализатора | `D-C-4`, `D-C-3`; правило `L086` на стороне пака |
| `RK-4` | дрейф формул Python↔TS: правка оракула без правки движка и наоборот | выход смены, агрегаты, TWAP | `vectors.sha256` меняется — TS-тест краснеет; `python content/vectors.py` в гейте | `D-C-1`, `D-C-5`; `R-C-3` назван открыто |
| `RK-5` | float приходит в хеш-путь через стороннюю библиотеку (bignumber, decimal, big.js) | сериализация, mul_bps, TWAP | `packages/engine/package.json` объявляет пустой `dependencies`; eslint `no-restricted-imports`; `no_float_in_bytes` | `D-C-2`, `D-C-3`; zero-dep движок и загрузчик |
| `RK-6` | БД становится вторым источником чисел: DEFAULT, CHECK с литералом, вычисляемая колонка, JSON-колонка вместо байтов | миграции, реплей | `codegen --check` на DDL; `L251`–`L255`; `replay_from_storage` | `D-C-9`; DDL генерируется, руками не правится |
| `RK-7` | клиентское время и таймзоны вместо `city_time`; локальная экстраполяция утекает в экономику | часы, банк, догон, снапшот | `L208`, `L211`, `L253`; grep-правило на арифметику над экономическими `value_kind` в клиенте | `D-C-3`, `D-C-12`; клиент экстраполирует только часы |
| `RK-8` | догон и реплей расходятся на снапшотах: снапшот берётся не на границе суток или дважды | `state_snapshots`, `catch_up` | `snapshot_tail_equals_full_replay`, `catchup_eq_replay`, `L214`, `L254` | `D-C-9`, `D-C-10`; период снапшота — `time.derived.ticks_per_city_day`, не второй счётчик |
| `RK-9` | молчание сэмплера и ложь RPC: свежая метка на старом значении, спот в минте, блокировка тика | входы тика, курс минта, стейк-гейты | `sampler_silence_keeps_age`, `sampler_twap_sensitive`, `L240`–`L243`, `rpc_silence_is_open`, `services_do_not_block_tick` | `D-C-11`; молчание не двигает метку, тик читает поля входа |
| `RK-10` | минт раньше подтверждённого депозита; фронтран собственной покупки; транш сверх глубины | фонд зарплат, инвариант кассы | `mint_after_deposit_only`, `buyback_tranche_at_three_depths`, `buyback_below_min_batch_waits`, `L022`, `L244`, `L245` | `D-C-10`; порядок `arch.buyback_order`, числа только из `launch.json` |
| `RK-11` | аттестатор тормозит доход: синхронный IPFS, блокирующий `await`, `raise` внутрь тика | выплата, задержка тика | `attestor_down_pay_continues`, `services_do_not_block_tick`, `L246`; метрика `attest_lag_ticks` против `arch.params.attest_lag_alert_ticks` | `D-C-10`; `fail_mode = open` у всех, кроме `pack_gate` |
| `RK-12` | протечка демо-барьера: перевод, общий баланс, реальный приз или клейм из демо | money-таблицы, призы, фрагменты | `demo_barrier_holds`, `L099`, `L112`, `L255`; отклонение `INSERT` на уровне БД | `D-C-9`, `D-C-12`; ребро `demo ↔ wallet` не существует в схеме |
| `RK-13` | сгенерированный файл правлен руками: артефакт протокола, DDL, cruiser, маршруты | протокол, миграции, границы слоёв | `python content/codegen.py --check`; шапка `GENERATED from pack <hash>`; `L270`, `L272` | `D-C-7`; кодоген односторонний, ручная правка — ошибка гейта |
| `RK-14` | версии инструментов на машине и в образе расходятся; lockfile не заморожен | сборка, байты артефактов, воспроизводимость | `L267` (`engines` против `arch.toolchain`), `pnpm -w install --frozen-lockfile`, `image_pins_pack_hash`, `image_has_no_python` | `D-C-14`, `D-C-1`; версия — ключ пака, не строка в двух конфигах |

---

## §7. Расхождения `R-C-1` … `R-C-10`

**`R-C-1`. В «T12: roadmap» нет строк под toolchain, векторы, кодоген и наблюдаемость/деплой.**
**Было:** десять строк этапов, все с гейтом на Python-скриптах.
**Стало:** предлагается добавить в `arch.json.roadmap` строки под `C0` (toolchain, векторы, кодоген), `C2` (протокол и загрузчик) и `C9` (наблюдаемость, деплой, CI), с `gate_cmd`, `tests` и `invariants` у каждой, чтобы `docs/ROADMAP.md` остался единственным источником этапов и покрытие `L262` держалось.
**Статус:** предложено, вносится в `C0`, пак 25. `L264` требует, чтобы новые строки не принесли голых двузначных литералов в `docs/ROADMAP.md`; `L262` требует у каждой строки команду и тест.

**`R-C-2`. BRIEF §2 обещает импорт `packages/engine` сервером, публичным верификатором и клиентом; таблица слоёв даёт клиенту `preview_only = 1`.**
**Было:** «её импортируют сервер, публичный верификатор и клиент для предпросмотра» без ограничения на запись.
**Стало:** запись зафиксирована: preview-импорт возвращает readonly-проекцию и в состояние города не пишет (`arch.packages.client.preview_only`, `HUD.md` §8).
**Статус:** не конфликт, требует записи. Закрывается типом в `C5` (`client_preview_is_readonly`), правка канона не требуется.

**`R-C-3`. Две реализации тика — Python-оракул и TypeScript-рантайм — формально нарушают «одно и то же в двух местах».**
**Было:** сквозное правило `docs/BRIEF.md` §0 и критерий приёмки §8 «ни одно число не встречается в двух местах».
**Стало:** нарушение названо явно и ограничено: оракул не входит в рантайм (`D-C-1`), а совпадение проверяется машинно золотыми векторами (`D-C-5`), не ревью.
**Статус:** принято осознанно, названо, чтобы не считалось незамеченным. Альтернатива — выкинуть Python-эталон — оставила бы TS без независимого арбитра байтов и сделала бы `RK-1`/`RK-2` необнаружимыми.

**`R-C-4`. `python content/attack.py --jobs 8` идёт около 438 s — в CI на каждый коммит не влезает.**
**Было:** гейт шага без флагов, полный прогон.
**Стало:** рекомендация — на коммит `--since-rule` и `--only` по затронутым правилам, полный прогон на ночь и перед публикацией пака. Пол по времени — `builds.analyse`, и он не снижается без правки смысла `L063`–`L065`/`L069` (`docs/reports/GATE_PERF.md` §6).
**Статус:** принято, вносится в таблицу шагов CI в `C9`.

**`R-C-5`. Факт разведки о больших целых уточняется пересчётом.**
**Было:** «59 целых значений длиной 16+ цифр, максимум порядка `1.3e40`».
**Стало:** значений длиной 16+ цифр действительно 59, но из них 58 — JSON-числа (57 из них больше `2**53`), а пятьдесят девятое и самое крупное, `generated.modifiers.modifier_stack_probe.worst_numerator` порядка `1.3e40`, лежит в паке **десятичной строкой**. Следствие для загрузчика двойное: bigint-safe парсер закрывает 57 чисел, но строку он не закрывает — нужна отдельная типовая позиция «десятичная строка читается как `BigInt(string)` и никогда не проходит через `Number`». Строковое представление — не дефект пака: `L086` держит ширину худшего числителя сплава в битах, и хранить его числом значило бы предъявить `JSON.parse` величину, которую тот заведомо испортит.
**Статус:** названо; закрывается в `C2` тестом `loader_keeps_bigint` и в `C0` классом векторов `over_2_53`. Пак не правится.

**`R-C-6`. Класса векторов `cid_city_day` из `content/record.py` экспортировать нечего: функции CID в оракуле нет.**
**Было:** ТЗ этого захода перечисляет «CID из `content/record.py`» в обязательных классах векторов.
**Стало:** в `content/record.py` есть канонизация, `leaf_hash`, `node_hash`, `merkle_root`, `merkle_proof`, `verify_proof`, `batch_leaves`; функции, считающей CID, нет. В паке CID существует только как ключ агрегата `attest.derived.ipfs_aggregate_key` = `(city_id, city_day)` и как факт `L205`. Выбор кодека CID (версия, мультихеш, обёртка) — новая спека, а не порт существующего.
**Статус:** рекомендация — в `C0` экспортировать векторы только для того, что существует (канонические байты, keccak, корень, доказательство); класс `cid_city_day` переносится в `C8` вместе со спекой кодека и добавляется в `content/vectors.py` там же. До `C8` единственный канон по CID — `attest.derived.ipfs_aggregate_key`.

**`R-C-7`. `content/sim.py` не имеет CLI и не принимает сид аргументом.**
**Было:** ТЗ этого захода просит прочитать «`content/sim.py` (CLI и сид)».
**Стало:** `main()` не разбирает `sys.argv`; сиды и ряды заданы сценариями внутри скрипта, воспроизведение — `python content/sim.py` без аргументов. Это не дефект: сценарий, выбираемый флагом, был бы вторым источником настройки прогона помимо params.
**Статус:** зафиксировано. Кодовая фаза `sim.py` не трогает; TS-паритет симуляции в скоуп v1 не входит (§8).

**`R-C-8`. Девятнадцать спрайтов и один текст отказа тайла остаются PENDING с владельцем T10.**
**Было:** `art/out/scene.json` и `art/out/sprites.json` собраны, сцена генерируется.
**Стало:** `python content/lint.py` печатает девятнадцать строк «sprite … not drawn yet» (владелец T10) плюс `build_tile_refusal`. Клиент `C5` на этом не блокируется — `L178` разрешает силуэт из `art/pipeline/assets_pending.json` внутри лимитов футпринта, — но `C5` **не объявляется готовым по арту**, и его критерий готовности про арт не говорит ничего, кроме геометрии и зума.
**Статус:** названо; адрес — §10.

**`R-C-9`. Ни одна строка «T12: roadmap» не несёт TypeScript-команды гейта.**
**Было:** все десять `gate_cmd` — `python content/lint.py` или `python content/attack.py …`, то есть команды, зелёные уже сегодня, до первой строки кода.
**Стало:** это дефект дорожной карты, а не плана: этап можно объявить готовым, не написав ни строки TypeScript. Рекомендация — в `C0` добавить каждой строке `arch.json.roadmap` вторую команду (`ts_gate_cmd`) с `pnpm --filter … run gate` и правилом `L268`, что имена тестов этапа совпадают с `roadmap.tests` дословно (`D-C-13`).
**Статус:** предложено, вносится в `C0` вместе с `R-C-1`. В §4 критерии готовности всех этапов уже сформулированы так, что Python-команды их не закрывают. См. §12, атаки `A-1`, `A-2`, `A-3`.

**`R-C-10`. План лежит вне гейта осознанно, и это создаёт риск дрейфа плана от канона.**
**Было:** `content/lint.py` читает именованные файлы и не обходит `docs/` глобом (факт разведки 3).
**Стало:** план в `docs/reports/` гейт не двигает — значит и не гейтуется. Единственная защита от дрейфа: канон этапов после `C0` живёт в `arch.json.roadmap`, и любое расхождение плана с ним обнаруживается при исполнении `C<N>`, а не при чтении плана.
**Статус:** принято. Правила, читающего `docs/reports/PLAN_CODE.md`, заводить не рекомендуется: это сделало бы отчёт вторым каноном этапов.

---

## §8. Что не входит в кодовую фазу v1

- Solidity в любом виде: интерфейсы контрактов — это `packages/chainport`, а не контракты (`docs/ARCHITECTURE.md` §6).
- Живой RPC до `C10`: до этого только `mock`.
- Призы сезонов до `C11`: `seasons.params.season_prizes_live` остаётся нулём, ранг есть, минта нет (`L220`).
- Live-корень merkle: формат и дерево с первого дня, отправка в чейн — `v1.1` (`R-T11-10`, `R-T12-9`).
- Шесть `S_min` по RPC: снимок фида Chainlink недоступен (RPC отвечает 403), числа не выдумываются (`docs/CONTENT.md` §1.4).
- Снимок цены LLM: точка цены — выбор провайдера, владелец — проект (`R-T12-7`).
- Спрайты сверх T10: арт-бэклог живёт в `art/pipeline/assets_pending.json` (`R-C-8`).
- TS-паритет симуляции T3: `content/sim.py` остаётся Python-инструментом калибровки, в рантайм не переносится (`R-C-7`).
- Локализация: реестр строк один (`content/strings/ru.json`), второй язык — не v1.

---

## §9. Протокол шага

Каждый `C`-этап исполняется одинаково:

1. `docs/reports/C<N>_recon.md` — разведка: что уже есть в паке, что физически отсутствует, какие ключи читаются, какие правила и пробы уже держат инвариант.
2. ТЗ на шаг — из разведки: точные пути файлов, точная математика, точные проверки. ТЗ не сокращается.
3. Работа: код и, если механика поехала, правка канона **в том же заходе** (`.cursor/rules/corporator-canon.mdc`).
4. `docs/reports/C<N>_code.md` — что написано, какие ключи пака прочитаны, какие числа не появились в коде.
5. `docs/reports/C<N>_final.md` — гейт числами, список расхождений, список атак.

Обязательный цикл `.cursor/rules/verification-loop.mdc` на каждом шаге, все три прохода:

- **логика** — `python content/build.py`, `python content/lint.py`, плюс TS-гейт этапа; ноль ошибок отчитывается числом правил, а не словом;
- **синтаксис** — `ReadLints` на все правленные файлы, `tsc --noEmit` и eslint для TypeScript, валидация схемой для JSON, импорт и прогон для Python;
- **адверсариальное ревю** — для каждого нового правила, формулы и инварианта построен вход, на котором он **должен** упасть, и показано, что он падает. Правило без продемонстрированного срабатывания не считается работающим. Список атак в `C<N>_final.md`: что атаковал, что выстояло, что нашлось.

Расхождение с `DESIGN.md` или `HUD.md` называется отдельным пунктом `R-C<N>-*` и либо закрывается тут же, либо получает рекомендацию. Молча переписывать канон нельзя.

---

## §10. Приложение: PENDING → этап

`python content/lint.py` печатает 26 строк PENDING: семь позиций `content/params/pending.json` и девятнадцать строк арт-бэклога (владелец T10). Ни одна не остаётся без адреса.

| item | владелец сейчас | адрес |
|---|---|---|
| `district_stake_threshold` | `T2` | остаётся `owner`: `S_min` в токенах ждёт датированный снимок фида Chainlink. Технический канал — `C10` (группа `stake_registry`, реализация `rpc`); число выбирает владелец, не код |
| `district_stake_reference` | `T2` | следует за `district_stake_threshold`; `S_ref` равен ему и не хранится. `C10` |
| `district_stake_usd_assumption` | `T3` | закрывается вместе с `district_stake_threshold`. До тех пор `C3` и `C5` держат допущение прогона через `district_stake_usd_target_8dec`, не порог в токенах |
| `bank_withdraw_rate_ceiling_only` | `T3` | `C1`: движок считает `economy.derived.bank_withdraw_rate` от потолка `economy.params.capital_anchor`, как записано. Круг остаётся в полосе `meta.params.round_trip_floor_bps` / `round_trip_ceiling_bps`; расхождение `R-T3-1` в кодовой фазе не чинится |
| `exit_uncovered_at_band_floor` | `owner` | остаётся `owner`. `C3` читает его как `threshold_src` метрики `i7_exit_cover` и значение не пересчитывает |
| `companion_llm_price_snapshot` | `owner` | остаётся `owner` (`R-T12-7`). Технический адрес — `C9` (`services/llm`, очередь из `arch.derived.companion_queue_capacity`); точка цены не выводится из пака |
| `build_tile_refusal` | `T10` | `C5`: код отказа в `codes.json` плюс строка в `content/strings/ru.json`; заведение поднимает `pack_version` и проходит `L011`, `L012`. Текст сочиняет автор канона, не код |
| 19 строк `sprite … not drawn yet` | `T10` | `C5` на силуэтах из `art/pipeline/assets_pending.json` в пределах `L178`; готовность `C5` по арту не объявляется (`R-C-8`) |

---

## §11. Воспроизведение

Гейт, существующий сегодня:

```
python content/build.py
python content/lint.py
python content/attack.py --jobs 8
python content/sim.py
```

Появляется в `C0`:

```
python content/vectors.py
python content/codegen.py --check
pnpm -w install --frozen-lockfile
pnpm -w run gate       # tsc --noEmit, eslint, depcruise, vitest run
pnpm -w run vectors    # паритет TS против content/out/vectors
pnpm -w run ci         # таблица шагов C9
```

Хеш пака — поле `hash` в `content/out/pack.json` и файл `content/out/pack.sha256`. Хеш векторов — `content/out/vectors.sha256`. Широкие таблицы — секции `content/out/GENERATED.md` «T12: …»; план их не воспроизводит.

---

## §12. Атаки на план

Адверсариальный проход по самому документу: искали этап, который можно объявить готовым, не запустив ни одной команды, и этап, чей критерий готовности нельзя измерить. Найденное исправлено в тексте выше.

| id | атака | что нашлось | как исправлено |
|---|---|---|---|
| `A-1` | Объявить `C0` готовым по строке `pack_gate`: её `gate_cmd` — `python content/lint.py`, и он зелёный **до** начала этапа | Этап закрывался нулём написанного кода | `C0` получил составную команду гейта с `pnpm -w install --frozen-lockfile` и `pnpm -w run gate`, а критерий — падение гейта на внесённом `Date.now()` и на числовом литерале в движке; `R-C-9` предлагает `ts_gate_cmd` в `arch.json.roadmap` |
| `A-2` | Объявить `C10` и `C11` готовыми: у обоих `gate_cmd` — `python content/lint.py`, зелёный сегодня | Оба этапа закрывались без строчки кода | Критерии переписаны на TS-сторону: `rpc_parity_with_mock` против `mock` на общем наборе фикстур; `season_prize_distribution_proportional` на `N = 0` и `N = 1`. Команды гейта дополнены `pnpm --filter … run test -- -t …` |
| `A-3` | Объявить `C5` готовым: `client_on_mock` гейтится `python content/lint.py`, а `demo_barrier_holds` — конструкционная проба внутри `attack.py`, то есть Python | Клиент мог отсутствовать физически | Команда гейта `C5` дополнена `pnpm --filter @corporator/client run test -- -t demo_barrier_holds`, а критерий — составом бандла и невозможностью записи в предпросмотр по типу |
| `A-4` | Критерий `C5` «клиент читает пак, ни одной зашитой строки» неизмерим: это утверждение ревью | Критерий не проверялся ничем | Заменён на измеримый: множество отрендеренных строк — подмножество ключей `content/strings/ru.json`, плюс eslint на кириллический литерал в `apps/client` |
| `A-5` | Критерий `C9` «единый гейт CI» закрывается пустым пайплайном | Шаг существовал бы формально | Критерий требует таблицу «шаг → команда → что ловит», у каждого шага **записан красный прогон** — вход, на котором шаг падает (`verification-loop` §3), проба `ci_step_has_red_run` |
| `A-6` | Критерий `C2` «bigint-safe загрузчик» закрывается парсером, читающим всё строками | Загрузчик прошёл бы, потеряв типы | Критерий назвал числа: круг загрузки и канонизации сохраняет все значения больше `2**53` и десятичную строку `worst_numerator`, шесть негативных входов дают ошибку с кодом |
| `A-7` | Критерий `C8` «байтовая стабильность layout v1» закрывается повторной сериализацией собственного объекта в TS | Тест сравнивал TS с TS, дрейф от Python не ловился | Критерий требует брать байты **из вектора Python**, а не из собственного вывода (`D-C-5`); в `C1` то же требование на все классы векторов |
| `A-8` | Класс векторов `cid_city_day` объявлен обязательным в `C0`, но экспортировать его нечего | `C0` был бы неисполним по букве | Класс перенесён в `C8` вместе со спекой кодека CID, расхождение названо в `R-C-6` |
| `A-9` | Анатомия этапа в ТЗ перечисляет десять полей, а чеклист приёмки говорит «девять» | Можно было тихо выбросить одно поле | Взят надмножество: у всех двенадцати этапов присутствуют все десять полей; расхождение названо здесь |
| `A-10` | Факт разведки «59 значений, максимум `1.3e40`» подставлен в план как есть; пересчёт даёт 58 JSON-чисел и максимум порядка `1e27` среди чисел | План опирался бы на число, которое не воспроизводится обходом дерева | Расхождение названо в `R-C-5`: 59 = 58 чисел плюс одна десятичная строка, и именно строка даёт `1.3e40`. Следствие добавлено в `D-C-4` отдельной позицией |
| `A-11` | План мог сам стать вторым каноном этапов: он лежит вне гейта и перечисляет `C0`–`C11` | Дрейф плана от `arch.json.roadmap` был бы необнаружим | Первая строка документа объявляет план не каноном; `R-C-1` переносит этапы в `arch.json.roadmap`; `R-C-10` фиксирует, что правило на чтение этого файла заводить не надо |

Выжившее без исправления и принятое осознанно: `R-C-3` (две реализации тика) и `R-C-4` (полный `attack.py` не влезает в гейт коммита) — оба названы, оба ограничены, ни одно не молчит.
