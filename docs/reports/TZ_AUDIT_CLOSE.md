# TZ_AUDIT_CLOSE — закрыть хвост аудита 2026-10-02

Живое ТЗ на хвост, который проверен по дереву 2026-10-02 и не входит в `docs/reports/TZ_PRELAUNCH_FIX.md`. Источник проверки — тот проход: клиент не в проде, `deploy/.env.example` без имён живого порта, мёртвый Pixi, вторая `stabilityBps`, `settle` в TypeScript короче `content/fragments.py`, bloom забит нулём, `onManageFunds` не вызывается, документы называют текущим пак 176 и 272 правила.

Это ТЗ не пересматривает NO-GO из `docs/reports/FINAL_PRELAUNCH_REVIEW.md` и не закрывает PL1…PL16 заново. Как исполнять — `.cursor/rules/tz-audit-close.mdc`.

Читать целиком §0 и §1 до первой правки. Дальше — только задачу, которую назвал владелец. Номера строк из прохода не копировать как доказательство: найти символ заново.

---

## 0. Как работать

### 0.1 Одна задача

Задачи: **AC1 … AC7**. Порядок — §4, линейно. Владелец не назвал id — спроси. Не брать две. Не начинать «всё сразу».

Где возможно, сначала красный тест: он падает на текущем коде и называет дыру. Тест, который был зелёным до правки, дыру не доказывает.

Задача не закрыта, пока не пройдены три прохода §0.5.

### 0.2 Оболочка

PowerShell 5. Не `&&`, не `grep`, не `head`. Разделитель — `;`. `pnpm` через `corepack pnpm`. Foundry не ставить. `node_modules` не переустанавливать и не удалять. Снятие файла с диска — только `Move-Item` в `C:\Users\sk640\corporator-trash-20260918`.

Пак трогала задача: `python content/lint.py`, `python content/build.py`, `python content/codegen.py`, `python content/attack.py --only <новые и затронутые L>`. Полный `--jobs 8` на шаге не гонять.

TypeScript: `npx tsc --noEmit -p tsconfig.json` из каталога пакета. Тесты узко из корня: `npx vitest run <путь>`. Плюс `ReadLints` на все правленные файлы.

Сгенерированный файл с шапкой `GENERATED from pack` руками не править. `deploy/.env.example`, `deploy/Dockerfile`, `deploy/compose*.yaml` правятся через `content/codegen.py` и `content/params`.

`pack_version` поднимается один раз на задачу, которая меняла `content/params`. Перед подъёмом снять текущее значение командой из `content/params/meta.json`, не из прозы. Причина — `docs/CONTENT.md` §5. Следующий свободный линтер — **L400**. Дыры L328, L364, L387 не переиспользовать. Новое правило — только если инвариант нельзя доказать тестом.

Перед правкой контрактов и перед AC5 прочитать `content/params/launch.json` поле `deployed` командой. Все пять полей пустые — ставка не снята. Хоть одно непустое — стоп.

### 0.3 Чего не делать ни в одной задаче

- Не подписывать `launchToken`, не деплоить в мейннет, не печатать секреты и не подставлять боевые ключи в example.
- Не возвращать `pause` / `unpause` / `Pausable`. Это решение владельца, `docs/AUDIT.md`.
- Не подключать HSM/KMS и не делать обёртку, которая читает тот же env и называется ключницей.
- Не удалять таблицы `accounts`, `buyback_batches`, `vouchers`, `fragments_ledger`, `seasons`, `prize_pools`, `prize_payouts`, `basket_batches`, `prize_returns` и не писать в них пустые ряды «чтобы ожили». `L287` и `L288` требуют `prize_returns` в схеме.
- Не восстанавливать каталог `art/island_v3/reviews/`. Файлов нет.
- Не переписывать замер в `docs/CANON.md` (пак 176, Workshop, фонд). Это история решения, не штамп текущего пака.
- Не менять `sceneClickOpensWorkspace`: клик по острову выбирает здание и не открывает кабинет.
- Не считать «You receive» на клиенте. Оценку банка это ТЗ не добавляет.
- Не менять `creator_tax_bps`, `vault_fee_bps`, `bank_markup_bps`, `bank_markup_floor_bps`, формулу `corpOut`, полосу круга `[1400, 1600]`, `L13`, `L14`.
- Не минтить Capital иначе как через `mintFromBacking`.
- Не ослаблять `w25.test.ts` и `h2.test.ts`.
- Не трогать 18 GLB, юнитов, миссии, Settings, 19-е здание.
- Не чинить C-20 и C-01.
- Двойник: правка арифметики `packages/engine/src/*.ts` повторяется в `content/*.py` с тем же порядком деления, кроме AC4, где Python уже эталон и двигается только TypeScript.

### 0.4 Решения, которые нельзя подменить

**R-AC-01.** Пример env перечисляет каждое имя, которое процесс читает, чтобы открыть живой порт, хоп, фид, IPFS, дом vault и шесть стоков. Значения секретов и адресов в example пустые. `CORPORATOR_UNSTAKE_COOLDOWN_S` по-прежнему равен секундам пака.

**R-AC-02.** Игрок открывает собранный клиент из прод-compose. Это отдельный сервис на порту из `arch.listen.ports`, не статика внутри API и не внешний CDN. Порт на хосте — loopback, как у API. TLS-фронт остаётся шагом оператора.

**R-AC-03.** Живой кадр — Three.js. Pixi не импортируется клиентом и не остаётся зависимостью `@corporator/render`.

**R-AC-04.** `stabilityBps` в рантайме одна: `packages/engine/src/seasons.ts`, реэкспорт из `index.ts`. Формула фрагментов, которая собирает bps из `spend_*`, удаляется.

**R-AC-05.** `settle` в `packages/engine/src/fragments.ts` принимает те же смысловые аргументы, что `content/fragments.py`: `wipe_pool_on_zero`, `redistribute_dust`, `share_cap_bps` вместе с `contributions`. `settleFromData` читает `wipe_pool_on_zero_claims` и `redistribute_dust` так же, как Python, и не читает share cap из пака: Python тоже не читает его в `settle_from_data`. На текущем паке этих флагов нет, выплата `settleCities` не сдвигается. `seasons.ts` свою нарезку не переводит на `fragments.settle`.

**R-AC-06.** Сила bloom в маунте острова — `bloomStrengthBps` пака, который клиент уже кладёт в проп. `onManageFunds` открывает банк с блока Capital. Payroll и клики Energy/Compute остаются своими.

### 0.5 Три прохода

1. Логика — команды секции задачи, с числами выхода.
2. Синтаксис — `ReadLints`, `tsc --noEmit` затронутых пакетов.
3. Атака из секции. Каждая атака — тест или прогон, который на старом коде падает, а на новом держится. Список в отчёте обязателен.

### 0.6 Отчёт задачи

По-русски. Код и id — по-английски. Коммит только по просьбе.

1. Какую задачу закрыл.
2. Гейт числами.
3. Что атаковал и что нашлось.
4. Расхождение с этим ТЗ, если число или ветка оказались иными.
5. Что осталось владельцу.
6. Следующий id по §4.

---

## 1. Карта

| суть | задача | не делать |
|---|---|---|
| Handoff, `DESIGN.md` и `content/README.md` называют текущим пак 176 или 272 правила. Ссылка CANON на каталог LOOK ведёт в пустоту | AC1 | не переписывать замер пака 176 в CANON |
| `fragments.ts` определяет вторую `stabilityBps`, `index.ts` её не отдаёт, L218 смотрит только Python | AC2 | не трогать формулу в `seasons.ts` |
| `pixi.js@8.20.1` и файлы Pixi без живого импорта | AC3 | не трогать `three.ts` и 18 GLB |
| `settle` без wipe / dust / share cap | AC4 | не менять выплату на текущем паке |
| В example нет имён RPC, контрактов, хопа, фида, IPFS, стоков, флага депозитов, дома vault | AC5 | не класть секреты и не включать депозиты |
| Bloom маунта `0n`. Capital не вызывает `onManageFunds` | AC6 | не открывать кабинет кликом по острову |
| Прод-образ не отдаёт клиент | AC7 | не вешать статику на API и не заводить CDN |

Вне очереди, одним абзацем, чтобы не потерять: «You receive» в банке — зашитый прочерк. Закрытие — поле оценки с сервера, не формула в JSX. Этого id здесь нет.

---

## 2. Задачи

### AC1 — документы говорят текущий пак

**Проблема.** `content/README.md` пишет «272 правил». В `content/lint.py` 396 правил: L01–L399 без L328, L364, L387. `CORPORATOR_MASTER_HANDOFF.md` в шапке называет текущим пак 176 и хеш `7bbdc470…` и говорит, что другое число ниже — устаревший текст. `DESIGN.md` в абзаце про сезоны пишет, что расчёт призов живёт в текущем pack `0.24.0/176`. `docs/CANON.md` в таблице источников указывает `art/island_v3/reviews/LOOK-00/refs/`, каталога нет. `docs/CONTENT.md` уже говорит пак 204 и хеш `16ed396bc2a980853a03c3f96783c892b9ec4974b464c47e35e307fdd406698d` — его не переписывать, снять командой и сверить.

**Как фиксить.**

1. README: число правил снять с `lint.py` командой (уникальные `rule("L…")`), не вписать 396 из этого файла вслепую. Если к моменту задачи число другое — писать фактическое.
2. Handoff: в блоке текущего статуса поставить пак, хеш, `rules_version` и размер `content/out/pack.json` с диска. Фразу «любой pack id кроме 176 — устаревший текст» заменить: 176 — снимок аудита 2026-09-20; текущий пак — тот, что в шапке. Главы ниже, которые описывают тот снимок, не переписывать целиком.
3. `DESIGN.md`: одна фраза. Текущий пак брать из `meta.json` и `pack.sha256`. Смысл абзаца оставить: сезон не заменяет живую смену, Influence в v1, выплата on-chain не обещана.
4. Строка таблицы CANON про `art/island_v3/reviews/LOOK-00/refs/`: каталог отсутствует, не источник кадра. Не создавать PNG.

`content/params` не трогать. `pack_version` не поднимать.

**Приёмка.** README, шапка handoff и фраза в `DESIGN.md` совпадают с `meta.json` и `pack.sha256`. Замер Workshop в CANON по-прежнему говорит «пак 176».

**Атака.** После правки поиск по этим трём файлам не должен объявлять 176 или 272 текущим числом. Историческая фраза замера в CANON обязана остаться.

---

### AC2 — одна stabilityBps

**Проблема.** `packages/engine/src/fragments.ts` экспортирует `stabilityBps(validTicks, data, ticksDay)`, которая складывает `spend_burn_bps`, `spend_fund_bps`, `spend_protocol_bps`. На паке 204 это 4000+6000+0=10000, то есть численно тот же BPS, что `seasons.stabilityBps`. Вызовов нет. `index.ts` отдаёт функцию из `seasons.ts`. L218 проверяет только `content/aggregates.py`.

**Как фиксить.** Удалить функцию из `fragments.ts`. Экспорт из `seasons.ts` и вызов в `services/api/src/project.ts` не менять.

**Красный тест.** До удаления: импорт модуля `fragments` содержит `stabilityBps`. Тест ждёт отсутствия. После удаления тест зелёный. Второй тест: `index.ts` по-прежнему экспортирует `stabilityBps`, и на 24 валидных тиках при 24 тиках суток она равна BPS.

**Приёмка.** `tsc --noEmit` в `packages/engine`. Узкий vitest этого теста. `python content/lint.py` не обязателен, если пак не трогали; если трогали — полный узкий гейт §0.2.

**Атака.** Вернуть функцию в `fragments.ts` на время прогона — красный тест снова видит экспорт. Вернуть удаление.

---

### AC3 — снять Pixi

**Проблема.** `packages/render/package.json` зависит от `pixi.js@8.20.1` и экспортирует `./pixi`. `pixi.ts`, `pixiDraw.ts`, `pixiMotion.ts` не импортирует ни клиент, ни `three.ts`. Рядом Pixi тянут `columnMask.ts`, `objects.ts`, `lut.ts`, `glyphs.ts`. L371 запрещает клиенту `@corporator/render/pixi` при `visual3_frame_live=1`. L380 и L382 запрещают `pixi.js` внутри `three.ts`.

**Как фиксить.**

1. Найти командой каждый импорт этих файлов. Живой путь — `three.ts` и клиент — их не использует. Архивные тесты, которые существуют только чтобы держать Pixi, уезжают вместе с файлами.
2. Файлы Pixi-стека перенести `Move-Item` в `C:\Users\sk640\corporator-trash-20260918`, не удалять с диска.
3. Убрать экспорт `./pixi` и импорты из `packages/render/src/index.ts`, которые остаются без модуля. Не выкинуть экспорт, который реально тянет `three.ts` или клиент.
4. Убрать `pixi.js` из `dependencies`. Lockfile обновить той командой, которой в репозитории уже собирают lockfile. Каталог `node_modules` не удалять.
5. L371, L380, L382 не ослаблять.

**Приёмка.** `tsc --noEmit` в `packages/render` и `apps/client`. Узкие тесты рендера, которые остаются после переноса. В `packages/render/src` нет `from "pixi.js"`. Клиент собирается `vite build` без Pixi в графе: поиск по `apps/client/dist` не находит `pixi`.

**Атака.** Временно добавить `from "pixi.js"` в `three.ts` и увидеть красный L380 или L382, затем убрать. Клиентский импорт `@corporator/render/pixi` по-прежнему роняет L371, если такой импорт вернуть в `SceneHost`.

---

### AC4 — settle как в Python

**Проблема.** `content/fragments.py` функция `settle` умеет `wipe_pool_on_zero`, `redistribute_dust`, `share_cap_bps` и `contributions`. При пустой сумме фрагментов и `wipe_pool_on_zero` пыль обнуляется. Иначе пыль остаётся в пуле. `share_cap_bps > 0` и вклад режут выплату и пишут `PRIZE_SHARE_CAPPED`. `redistribute_dust` раздаёт остаток поровну городам с фрагментом > 0. `settle_from_data` передаёт wipe и redistribute из `fragments.wipe_pool_on_zero_claims` и `fragments.redistribute_dust` и не передаёт share cap.

`packages/engine/src/fragments.ts` `settle` этих аргументов не имеет. Пустая сумма всегда оставляет `pool_left = pool`. `settleFromData` зовёт `settle(fragments, pool, cap, BPS)`.

`FRAGMENT_HOP_STALE` и `DEMO_NO_CLAIM` в `fragments.py` только константы, в `settle` не пишутся. В TypeScript их не «оживлять» внутри `settle`. `DEMO_NO_CLAIM` уже возвращает API. `PRIZE_SHARE_CAPPED` уже пишет `seasons.ts`. Не дублировать нарезку сезона через `fragments.settle`.

**Как фиксить.** Перенести в TypeScript ветки `settle` с тем же порядком деления, что в Python (`a * b // c`, не `a // c * b`). `settleFromData` читает те же два флага. `settleCities` по-прежнему идёт через `settleFromData`. Сигнатуру не раздувать полями, которых нет у Python.

**Красный тест** на текущем TS, до правки, три вектора:

1. Фрагменты `[0,0]`, пул > 0, wipe включён. Python: `pool_left = 0`. TS сейчас: `pool_left = pool`.
2. Два города, выплата с пылью, redistribute включён. Сумма выплат после раздачи совпадает с Python.
3. `share_cap_bps` режет большую долю, в кодах есть `PRIZE_SHARE_CAPPED`, сумма выплат не выше пула.

После правки те же три вектора зелёные. Четвёртый: флаги выключены, результат байт-в-байт прежний для входа, который уже покрыт тестом движка (пул и выплаты не выросли и не сжались).

**Приёмка.** `tsc` движка. Узкий vitest. `python content/lint.py`, потому что трогали двойник только с одной стороны: линтер должен остаться зелёным, пак не менялся, `pack_version` не поднимать. Если правка задела `content/params` — стоп, это уже не AC4.

**Атака.** Выключить wipe в вызове при нулевых фрагментах: `pool_left` снова равен пулу. Поднять `share_cap_bps` до потолка, при котором сырая доля меньше потолка: кода `PRIZE_SHARE_CAPPED` нет. Сумма выплат выше пула — тест падает.

---

### AC5 — имена в deploy/.env.example

**Проблема.** `emit_env_example` печатает `secrets.roles` и `arch.env.vars`. В example есть роли и `CORPORATOR_UNSTAKE_COOLDOWN_S`. Нет имён, без которых оператор не соберёт живой порт. Процесс их уже читает:

- `CORPORATOR_DEPOSITS_OPEN`, `CORPORATOR_RPC_URL`, `CORPORATOR_CHAIN_ID`, `CORPORATOR_RPC_TIMEOUT_MS`
- `CORPORATOR_CORP_TOKEN`, `CORPORATOR_VAULT`, `CORPORATOR_STAKE_REGISTRY`, `CORPORATOR_MERKLE_ROOTS`, `CORPORATOR_PRIZE_TREASURY` (`readPlayerReady`)
- `CORPORATOR_HOP_URL`, `CORPORATOR_IPFS_PIN_URL`, `CORPORATOR_FEED_ETH_USD`, `CORPORATOR_VAULT_HOUSE`
- `CORPORATOR_STOCK_NVDA`, `CORPORATOR_STOCK_TSLA`, `CORPORATOR_STOCK_AMZN`, `CORPORATOR_STOCK_AAPL`, `CORPORATOR_STOCK_MSFT`, `CORPORATOR_STOCK_COIN`

Перед правкой снять список ещё раз командой по `process.env` / `env["CORPORATOR_`. Имя, которое читает прод-старт и которого нет в списке выше, добавить. Имя только тестов не добавлять.

**Как фиксить.** Каждое имя — запись `arch.env.vars` с пустым значением в example. Не класть URL, адрес и ключ. `CORPORATOR_DEPOSITS_OPEN` в example пустой, не `1`: пустой флаг оставляет мок (`R-PL-01` уже в коде). Example пересобрать codegen. Руками файл не править.

`pack_version` +1, причина в `docs/CONTENT.md` §5: имена живого порта в example, ставки не менялись.

**Красный тест.** До генерации чтение `deploy/.env.example` не содержит `CORPORATOR_RPC_URL`. После — содержит каждое имя из списка, и строка `CORPORATOR_UNSTAKE_COOLDOWN_S` равна `generated.api.unstake_cooldown_s`, не пустая. Ни одна строка секрета не имеет значения справа от `=`.

**Приёмка.** `lint.py`, `build.py`, `codegen.py`, `attack.py --only` тех L, которые читают example (как минимум правило, которое сверяет `CORPORATOR_UNSTAKE_COOLDOWN_S`). Круг из `build.py` записать. Если круг уехал — откат, ставки не должны были меняться.

**Атака.** Убрать одно новое имя из `arch.env.vars`, пересобрать example в тесте или во временной копии данных линтера: тест имён красный. Вернуть имя.

---

### AC6 — bloom и кнопка банка

**Проблема.** `apps/client/src/hud/SceneHost.tsx` в вызов маунта передаёт `bloomStrengthBps: 0n`, хотя проп уже приходит из пака и стоит в зависимостях эффекта. `EconomyLook` делает `void props.onManageFunds`. `App` на этот колбэк открывает маршрут `bank`. Payroll и ресурсы свои колбэки вызывают.

**Как фиксить.**

1. В маунт передать `props.bloomStrengthBps`. Не подставлять число из пака вторым литералом в JSX.
2. Блок Capital в левой колонке становится кнопкой и вызывает `onManageFunds`. Не добавлять новый маршрут и не открывать кабинет с острова. Payroll и Energy/Compute не перевешивать на банк.
3. Сверить с `hud/design-reference/00-hud-full.png`, что кнопка не ломает колонку Economy. Новый PNG не рисовать.

**Приёмка.** Узкий vitest HUD, который рендерит левую колонку: клик по Capital вызывает переданный `onManageFunds` один раз и не вызывает `onPayroll`. Тест маунта или исходника сцены: в объект маунта не входит литерал `bloomStrengthBps: 0n`. `ReadLints`. Клиентский `tsc --noEmit`. В браузере на preview: клик по Capital открывает банк, клик по payroll открывает обзор, bloom не обнулён пропом (если в паке сила не ноль — в вызов уходит это значение; снять число командой из пака до утверждения).

**Атака.** Кнопка Capital не должна открывать банк, если колбэк не передан: такого пути нет, колбэк обязателен. Двойной клик не ставит два маршрута поверх друг друга так, чтобы закрытие вернуло не туда: один `openRoute("bank")`.

---

### AC7 — клиент в прод-compose

**Проблема.** `emit_dockerfile` копирует `apps` только в стадию `build`. Рантайм запускает `services/api/dist/main.js`. В `compose.prod.yaml` нет сервиса клиента. `apps/client` уже имеет `vite build`.

**Как фиксить.**

1. Порт клиента — новый ключ `arch.listen.ports`, следующее число после занятых `api` / `sampler` / `buyback` / `attestor`. Снять занятые порты командой. Литерал порта в `Dockerfile` и yaml не писать: его печатает codegen из этого ключа.
2. Образ на стадии build выполняет сборку клиента. Рантайм копирует каталог статики. Сервис compose `client` той же образ, другая команда: маленький раздатчик на `node:http` без новой npm-зависимости, корень — собранный `dist`, порт — `CORPORATOR_LISTEN_PORT`. Не встраивать раздачу в процесс API.
3. Прод-compose публикует клиент на `127.0.0.1`, не на все интерфейсы. В `docs/OPS.md` одна фраза: TLS и публичный хост — шаг оператора, как для порта API.
4. Как клиент находит API, прочитать в коде до правки. Не заводить второй базовый URL, если сборка уже знает адрес. Если статический хост ломает относительный API — починить тем способом, который уже есть в клиенте, и написать это в отчёте.
5. `pack_version` +1, причина в `docs/CONTENT.md` §5. Ставки экономики не меняются.

**Приёмка.** `codegen --check`. В сгенерированном Dockerfile есть шаг сборки клиента и копирование статики в рантайм. В prod-compose есть сервис `client` и нет публикации его порта на `0.0.0.0`. Узкий тест: раздатчик на фикстурном каталоге отдаёт файл и не отдаёт путь вне корня.

**Атака.** Запрос `../` и абсолютный путь не читают файл снаружи корня статики. Порт в yaml совпадает с `arch.listen.ports`, подмена ключа в данных генератора меняет оба места одинаково.

---

## 3. Порядок

```
AC1 документы
AC2 stabilityBps
AC3 Pixi
AC4 settle
AC5 example env          pack_version
AC6 bloom и Capital
AC7 статика клиента      pack_version
```

AC4 после AC2: оба трогают `fragments.ts`. AC7 после AC5: оба трогают генерацию деплоя, example и Dockerfile не править вперемешку руками. AC6 не зависит от пака и может идти после AC1, но один агент идёт по списку.

Полный `attack.py --jobs 8` и полный vitest этим ТЗ не требуются. Их по-прежнему закрывает PL16, когда владелец назовёт PL16.
