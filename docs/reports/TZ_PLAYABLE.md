# TZ_PLAYABLE — доведение HUD до полностью играбельного вида

Живое ТЗ. Задание — сделать так, чтобы игрок проходил игру целиком через живой HUD `apps/client/src/hud`: строил здания, открывал районы стейком, подписывал свои транзакции кошельком, выводил деньги в кошелёк, видел живой курс и оборот, и получал всё, что игра обещает. Решения владельца приняты 2026-09-24 и записаны в `docs/CANON.md`, раздел «Решения владельца 2026-09-24 — играбельность». Этот файл — как их исполнить.

Читать целиком §0 и §1 до первой правки. Дальше — только ту задачу, которую закрываешь.

Миссии и Settings в это ТЗ не входят и не оживляются.

---

## 0. Как работать с этим файлом

### 0.1 Одна задача за заход

Задачи: **W0 … W25**. Порядок и зависимости — §3, он не произвольный: W0 зелёный раньше всех, словарь пака W1 раньше любой новой команды, цепь W2 раньше любой чейн-команды, подпись W6 раньше клиентской подписи W18.

Владелец не назвал id — спроси, какую задачу закрывать. Не бери две сразу. Не начинай «всё сразу».

### 0.2 Оболочка и команды

PowerShell 5. Не `&&`, не `grep`, не `head`. Разделитель команд — `;`. `pnpm` через `corepack pnpm`. Foundry не ставить. `node_modules` не переустанавливать.

Узкий гейт шага, когда задача трогала `content/params`:

```
python content/lint.py
python content/build.py
python content/codegen.py
python content/attack.py --only <новые и затронутые L>
```

TypeScript проверять локальным `tsc`, не вешать `corepack pnpm` на клиент:

```
npx tsc --noEmit -p tsconfig.json
```

запускать из каталога того пакета, который правил (`apps/client`, `services/api`, `packages/engine`, `packages/chainport`, `services/sampler`).

Тесты — из корня репозитория, узко по затронутому:

```
npx vitest run services/api/test/<файл>.test.ts
npx vitest run apps/client/test/<файл>.test.ts
npx vitest run packages/engine
```

Полный `python content/attack.py --jobs 8` на шаге **запрещён**. Он гоняется в четырёх случаях: закрытие фазы, публикация пака, ночной CI, правка самих `lint.py` или `attack.py`. В этом ТЗ `lint.py`/`attack.py` правятся в **W1** и в **W25** — там полный прогон обязателен и это не разрешение гонять его на каждом шаге.

Полный `npx vitest run` по всему монорепо и `python content/sim.py` — только в W25.

Удаление с диска запрещено: только `Move-Item` в `C:\Users\sk640\corporator-trash-20260918`.

### 0.3 Главная ловушка — двойник движка

У TypeScript-движка есть построчный питоновский двойник. Он не тест: это оракул векторов. Правка одной стороны без другой роняет векторный паритет, и узнаешь ты об этом на чужом шаге.

| TypeScript | Python-двойник |
|---|---|
| `packages/engine/src/economy.ts` | `content/tick.py` |
| `packages/engine/src/slots.ts` | `content/slots.py` |
| `packages/engine/src/stack.ts` | `content/slots.py` (стек внутри) |
| `packages/engine/src/bank.ts` | `content/bank.py` |
| `packages/engine/src/state.ts` (genesis) | `content/tick.py`, создание состояния |

Любая правка арифметики или порядка операций в `packages/engine/src/*.ts` обязана быть повторена в `content/*.py` **с точностью до порядка деления**. `a * b // c` и `a // c * b` — разные числа и разный хеш записи. Проверка — тесты движка плюс `python content/lint.py`.

### 0.4 Красные линии

Не двигать:

- **Инвариант кассы I1.** `capital_outstanding ≤ vault_corp × capital_anchor`. Ни одна задача не минтит Capital мимо `mintFromBacking`. Выплата переносит уже сминченное из `state["fund"]` в `city["capital"]`. Нет `mintFromBacking` «чтобы закрыть смены».
- **`creator_tax_bps = 200`.** Иммутабелен.
- **Круг трения.** `vault_fee_bps = 200`, `bank_markup_bps = 1000`, `bank_markup_floor_bps = 650`. Полоса линтера `[1400, 1600]`. `L13` и `L14` не должны шелохнуться. На паке 184 круг печатается `1445 bps`, вход `200`, выход `910`.
- **Вход дешевле выхода** (`assertI2`).
- **Детерминизм тика.** Без `Math.random()`, `Date`, `performance`, внешнего I/O внутри тика. Случайность только `hash(city_id, tick_index, agent_id)`. Время — только `city_time` сервера.
- **`layout_version = 1`**, `missions_live = 0`, краны NFT нули.
- **`launchToken` не подписывать, в мейннет не деплоить.** Перед любой правкой контрактов прочитать `content/params/launch.json` поле `deployed` **командой**. На 2026-09-24 все пять полей пусты: `token`, `curve`, `pool`, `hook`, `tx`.
- **Числовых литералов в рантайме нет**, кроме `0`, `1` и индексов. Новое число — параметр пака. Исключение, уже принятое в коде: константы криптографии (раунды keccak, порядок кривой) — это не параметры экономики.
- **Сгенерированный файл с шапкой `GENERATED from pack` руками не правится.** Правится `content/codegen.py`, затем `python content/codegen.py`. Сюда входят `packages/protocol/src/routes.ts`, `codes.ts`, `services/api/migrations/001_from_pack.sql`, `deploy/.env.example`.
- **18 GLB зданий не трогать.** Не рескейлить, не заменять, не регенерировать. Юнитов на сцену не добавлять (`R-V-101`).
- **`C-20` и `C-01` не чинить.** Это сохранённые расхождения, приложение A `docs/reports/PLAN_LAUNCH.md`. `C-22` этим ТЗ **снимается** — см. `R-W-04`.
- **Не 19-е здание, не новая роль, не выплата за факт постройки.**

### 0.5 Свободные id линтера

На 2026-09-24 свободно с **L396**. Занято до L395 включительно: L390 — E1, L391 — E2, L392 — E3, L393 — E4, L394 — E6, L395 — E5. Дыры L328, L364, L387 молча не переиспользовать. Это ТЗ занимает **L396, L397, L398** (все три — в W1). Следующий свободный после них — **L399**. Новое правило регистрируется строкой в `docs/CONTENT.md` §6 и атакой в `content/attack.py`.

### 0.6 Гейт каждой задачи

Задача не закрыта, пока не пройдены три прохода. «Должно работать» результатом не считается.

1. **Логика.** Команды из секции задачи, дословно. Если трогал `content/params`: `python content/lint.py` — ноль ошибок, отчитаться числом правил (сейчас 392); `python content/build.py` — числа из вывода (pack, hash, круг, вход/выход). `python content/attack.py --only <новые и затронутые L>`.
2. **Синтаксис.** `ReadLints` на все правленные файлы. TypeScript — `npx tsc --noEmit -p tsconfig.json` в каталоге пакета. Python — импорт и прогон. JSON — он валидируется `lint.py`.
3. **Адверсариальное ревю.** Для каждого нового правила и инварианта построить вход, на котором он **должен** упасть, и показать падение. Список атак в отчёте обязателен. Молча выжившие атаки не упоминать нельзя.

Поднял пак — поднял `pack_version` **один раз на задачу** и записал причину в `docs/CONTENT.md` §5 (каноническая форма, текущий пак).

### 0.7 База на 2026-09-24, от которой считать

Снято командами, не из прозы:

- `python content/lint.py`: правил 392, ошибок 0, предупреждение одно (`L174` decor 1087 bps внутри 1200±400).
- `python content/build.py`: pack 681 694 байт, хеш `b95b8fe73277141956eae51c1a5a13aee370d464a7b32f199c1a44a20998f599`, правила 0.24.0, pack_version 184, круг 1445 bps, вход 200 / выход 910.
- `launch.deployed`: все пять полей пустые.
- Тесты: `services/api` 129/129, `packages/chainport` 16/16, `services/sampler` 4/4, клиент 142/144, движок 58/60. Четыре красных теста чинит **W0**, не ты по ходу своей задачи.

### 0.8 Отчёт

По-русски. Код, идентификаторы, коммиты — по-английски. Коммит только по просьбе владельца. Тексты файлов в чат не выводить.

1. Какую задачу закрыл (`W0`…`W25`).
2. Гейт числами: правил в `lint.py`, вывод `build.py` (если трогал пак), `--only` id и результат, тесты (сколько прошло).
3. Что атаковал и что нашлось. Список обязателен.
4. Факт против числа этого ТЗ. Разошлось — назвать, не подгонять.
5. Что осталось владельцу.
6. Следующий id по §3.

---

## 1. Диагноз

Коротко: даже после запуска токена игру через HUD целиком не пройти. Движок считает правильно, API в основном работает, но HUD не даёт построить здание, районы заперты взаимной блокировкой, кошелёк не подписывает транзакции, а вывод не доходит до кошелька.

### 1.1 Районы нельзя открыть

`services/api/src/commit_districts.ts`. Открытие требует стейк не ниже `s_min` (строка 183), а стейк требует уже открытый район (строка 201). Больше никто `stake_settled` не пишет. Из HUD закрытый район нельзя и достейкать: кнопка на карточке индустрии — это `districts_open`, а `district_stake_more` живёт только на открытой карточке района и без поля суммы.

### 1.2 В HUD нельзя построить здание

`apps/client/src/hud/navigation.ts` режет маршруты `build` и `missions`. Экран `build.tsx` не монтируется. В карточке здания (`building_card.tsx:40-42`) кнопка Upgrade активна и на непостроенном: она шлёт `commit:upgrade`, а `applyUpgrade` на отсутствующем здании отвечает `CITY_LEVEL_TOO_LOW`. Кнопки Activate нет вообще. Deactivate шлётся в обход пака и на непостроенном отвечает 200, ничего не меняя.

`applyBuild` (`services/api/src/commit.ts`) отказывает зданиям с `autonomous: true`, поэтому `agent_hub` и `robotics_lab` нельзя получить ни из HUD, ни из API. Владелец это не заказывал (`R-W-06`).

### 1.3 Кошелёк ничего не подписывает

`apps/client/src/walletLogin.ts` умеет ровно три вызова: `eth_requestAccounts`, `eth_chainId`, `personal_sign`. Нет `eth_sendTransaction`, нет `approve`, нет `wallet_switchEthereumChain`.

Сервер сам шлёт `eth_sendTransaction` (`packages/chainport/src/rpc/live.ts`, `sendTx`), причём для `deposit` и `stake` без `from`. Публичный RPC такое не подпишет. `Vault.deposit` и `StakeRegistry.stake` тянут токены через `transferFrom` с кошелька игрока, так что без approve и без подписи игрока они падают всегда.

Отдельно дыра в контрактах: `deposit(address account, …)` и `stake(address account, …)` не проверяют `msg.sender == account`. Кто угодно может дёрнуть `transferFrom` по уже выданному approve и запереть токены игрока в `pending`.

### 1.4 Вывод не доходит до кошелька

`applyWithdraw` (`services/api/src/commit_bank.ts:203`) сам вызывает `authorize` и тут же `present` и кладёт $CORP в серверный `corp_held`. В сеть вызова нет. Это сохранённое расхождение `C-22`; владелец его снимает (`R-W-04`).

Вторая половина той же дыры — в контракте. `Vault.issueVoucher` требует `corpAmount <= availableOf(account)`, а `availableOf` — это личный `backingOf` минус резерв. Зарплата личный backing не увеличивает, поэтому выигрыш упирается в `cover`. Владелец 2026-09-24 это снял: выводится столько, сколько позволяет банк. Чинит задача **W8**, она больше не ждёт решения.

### 1.5 Курс и оборот в тик не подаются

`services/api/src/scheduler.ts` собирает вход тика константами: `eth_usd_8dec` и `corp_eth_wei_per_whole` из пака, `feed_live = 1`, `dex_turnover = 0`. Сервис `services/sampler` считает TWAP (`stepSampler`), но `startMain` поднимает только `/ready` и ничего не публикует. Курс минта поэтому заморожен на сиде пака, а сбор с оборота DEX в фонд не приходит.

И внутри движка живой вход игнорируется: `applyDexTurnover` (`packages/engine/src/economy.ts`, близнец `content/tick.py`) берёт `cfg["eth_usd_8dec"]`, а не `inputs["eth_usd_8dec"]`.

### 1.6 Прочее, что ломает игру при многих игроках

- Одно соединение с Postgres на всех (`services/api/src/store.ts`), а блокировка по городу (`city_lock.ts`). Тик берёт лок первого города, команда — своего, `BEGIN`/`COMMIT` при этом общие. Транзакции переплетаются.
- `persistLiveState` пишет весь мир в строку каждого города (`tick_host.ts:221`), и `restoreLiveState` читает только первый город. Команды пишут состояние только в `host.state`: после рестарта процесса выживает то, что успел записать тик.
- `GET /city/{id}/state` и WS открываются по голому `city_id`, без сессии.
- Тик публикует WS-патчи только для `firstCityId` (`host.ts`).
- Клиент ходит на адрес из пака (`listen.ts` → `main.tsx:103`), переменной окружения нет.
- Отказ виден игроку только на денежных кнопках. Остальные пишут код в `data-adapter-code` на корне (`HudShell.tsx`) и молчат; `agents.tsx` вызывает `onIntent` через `void` и роняет необработанный reject.
- Суммы $CORP вводятся как есть: пресеты `"5"`, `"10"`, `"50"` в `bank.tsx:22` и `exchange.tsx` — это 5 wei, не 5 $CORP.
- Часы клиента (`clock.ts`) считают дельту от `firstLoginMs`, а якорь `snap.cityTime` при этом обновляется. Прошедшее считается дважды.

---

## 2. Решения и рецепты

Решения `R-W-01`…`R-W-06` — в `docs/CANON.md`. Здесь — как их исполнять, чтобы два агента не разошлись.

### 2.1 Рецепт CS — клиент подписывает, сервер проверяет

Так устроены все команды, которые двигают активы игрока: `deposit`, `stake`, `unstake`, `withdraw` (его сетевая половина), `buy_stock`, `claim_prize`. Команды без актива игрока (`build`, `upgrade`, `hire`, `assign`, `open_district`, `unlock_tier`, `pick_node`, `merge`, `research_start`, `set_objective`, `claim_fragment`) остаются одним запросом, как сейчас.

Контракт ответа один на все такие команды. Мок-порт (тесты, локальная игра без сети) проходит старым путём и возвращает сразу:

```json
{ "ok": true, "phase": "applied", "effect": "deposit", "minted": "4998" }
```

Живой порт отвечает в два захода.

**Заход `prepare`.** Тело как сейчас, плюс `"phase": "prepare"`. Сервер проверяет все гейты команды, **ничего не меняет** в состоянии и возвращает:

```json
{
  "ok": true,
  "phase": "prepared",
  "ticket": "<intent_id>",
  "chain_id": "4663",
  "txs": [
    { "to": "0x…", "data": "0x…", "value": "0", "label": "approve" },
    { "to": "0x…", "data": "0x…", "value": "0", "label": "deposit" }
  ]
}
```

`txs` — это ровно те транзакции, которые сервер потом согласен признать. Клиент не собирает calldata сам.

**Клиент.** Для каждой транзакции по порядку зовёт `eth_sendTransaction` через EIP-1193 и ждёт рецепт (`eth_getTransactionReceipt`, `status == 0x1`). Отказ кошелька — это не отказ сервера: клиент показывает `WALLET_TX_REJECTED` и ничего больше не шлёт.

**Заход `confirm`.** Тело: `"phase": "confirm"`, `"ticket"`, `"tx_hashes": ["0x…"]`. Сервер **до** лока проверяет по каждому хешу через RPC:

- `eth_getTransactionReceipt` дал `status == 0x1`; иначе `CHAIN_TX_UNCONFIRMED` (это повтор, не отказ: клиент подождёт и придёт снова);
- `eth_getTransactionByHash`: `from` равен `city.wallet`, `to` и `data` **байт-в-байт** равны транзакции из тикета.

Потом под локом применяет эффект и помечает хеш потраченным (таблица `intents`, ключ `chain_tx:<hash>`). Повторный `confirm` с тем же хешем возвращает сохранённый ответ, а не второй депозит.

Тикет хранится в `intents` ключом `cityId:ticket` и живёт до `confirm`. В тикете записаны: эффект, аргументы, точный список `txs`, момент создания. Чужой `confirm` (другой кошелёк, другие `data`) не проходит сверку и возвращает `API_MALFORMED`.

### 2.2 Рецепт лока — сеть не внутри транзакции БД

Сейчас `executeCommand` делает `applyLive` (а внутри него сетевые вызовы) и только потом `BEGIN`. Это переворачивается.

- **До лока.** Чтения сети и проверка рецептов. Здесь же `prepare`: он не трогает состояние, поэтому лок ему не нужен.
- **Под локом.** Только память и БД: применить эффект, записать `intents`, записать состояние, `COMMIT`. Никаких `await` на сеть внутри.
- **После лока.** То, что подписывает сервер (роль `minter`, `voucherSigner`): отправить сырую транзакцию и короткой второй критической секцией записать результат.

Лок при этом один на весь мир, а не по городу: состояние в памяти одно, и соединение с БД одно. См. W2.

### 2.3 Рецепт пака — как добавить действие, код и строку

Маршруты и коды **генерируются**. Новый эффект появляется в API только если в `content/params/screens.json` есть действие с `effect: "commit:<имя>"`. Порядок такой:

1. Действие в `screens.json` → `actions`. Обязательные поля: `screen`, `kind`, `label`, `effect`, `requires`, `spend`, `demo_blocked`, `v1`, `src`, `why`. `kind` — из `button|row|tab|toggle|tile|link|slider|filter`. `spend` — `none|capital|corp`. `label` начинается с `UI_`.
2. Если у действия новый токен в `requires` — завести capability в `screens.json` → `capabilities` с полями `code`, `tier`, `kind`, `predicate`, `src`, `why`. `code` обязан существовать в `codes.json`.
3. Код в `content/params/codes.json`: `category` (`idle|refusal|state|transport`), `slots` (список имён подстановок), `src`. Для `transport` ещё `http`.
4. Строка в `content/strings/en.json` и `content/strings/ru.json` в объект `strings` (для кода) или `ui` (для `UI_*`). Плейсхолдеры `{slot}` ровно по списку `slots`, иначе упадёт `L11`.
5. `python content/build.py`, затем `python content/codegen.py`. Руками `routes.ts`, `codes.ts`, миграцию и `deploy/.env.example` не трогать.
6. Поднять `pack_version` на единицу и дописать причину в `docs/CONTENT.md` §5.

### 2.4 Что сознательно не делается

- **Релейер.** Сервер не подписывает транзакции игрока и не держит его ключ. Игрок платит газ сам. Это прямое следствие `R-W-03`.
- **Серверный роутер обмена.** `buy_stock` ходит на `CORPORATOR_HOP_URL` ровно как сейчас. Это ТЗ делает так, чтобы игрок этот обмен **подписывал**, а не пишет роутер. Контракт хопа на стороне ответа фиксирует W12; если хоп не отдаёт транзакцию, кнопка честно показывает `EXCHANGE_HOP_UNAVAILABLE`.
- **Миссии и Settings.** `missions_live` остаётся 0, экран миссий остаётся заглушкой, Settings не появляется.
- **Приз сезона в проде.** `claim_prize` остаётся `refusal-only`, пока `launch.deployed` пуст. Провод до него доводится (W12), но кнопку это не включает — так и задумано.
- **Сетка участков и стройка на земле.** Посадка остаётся студийной (`R-V-100`). Игрок строит из карточки здания, не с клетки.

---

## 3. Порядок

Стрелка — «нельзя начать раньше». Всё, что не связано стрелкой, можно брать в любом порядке, но не две задачи сразу.

```
W0 ─> W1 ─> W4 ─> W19 ─────────────> W23 ─> W24 ─> W25
       │     │
       │     └─> W5 ─> W10 ─> W20 ──> W23
       │
       ├─> W2 ─> W3
       │     │
       │     ├─> W6 ─> W9 ─> W11 ─> W21 ─> W23
       │     │     │
       │     │     ├─> W7 ─> W8 ─> W11
       │     │     └─> W18 ─> W21
       │     │
       │     └─> W14
       │
       ├─> W13
       ├─> W15 ─> W17
       ├─> W16
       └─> W22

W12 — после W6 и W18, до W23
```

`W11` нельзя закрывать раньше `W8`: без нового покрытия живой `issueVoucher` отвергнет выигрыш. Линейно, если работает один агент: W0, W1, W2, W3, W4, W5, W6, W7, W8, W9, W10, W13, W14, W15, W16, W17, W18, W19, W20, W11, W21, W22, W12, W23, W24, W25.

---

## 4. Задачи

### W0 — зелёная база

Четыре теста красные на дереве 2026-09-24, и все четыре красные из-за устаревших ожиданий, а не из-за бага. Пока они красные, любой следующий агент будет принимать свой шаг за сломанный.

**Не трогать** `content/params`, движок и API. Чинются только тесты.

1. `packages/engine/test/c1.test.ts` около строки 368. Зашитый эталон записи расходится с движком после E4: `payroll_ratio_bps` ожидается 147, движок даёт 111; `stage_bps.post` ожидается 10000, движок даёт 13200. Переснять байты из питоновского оракула (`python content/vectors.py` печатает векторы — взять оттуда, не вычислять руками) и заменить эталон. Если оракул даёт не 111 и не 13200 — это расхождение двойников, его назвать и остановиться, не подгонять.
2. `packages/engine/test/m8.test.ts` около строки 1266. Ожидается 142216, получается 156438. Формула в тесте не учитывает условный `output_link` из E4. Добрать в формулу величину связи из пака (`generated.progression`, не литерал) и проверить, что сходится в 156438. Не сошлось — назвать оба числа и остановиться.
3. `apps/client/test/h8.test.ts`, проба `hud_catchup_eq_replay`. Фикстура кладёт в фонд 672000 Capital без покрытия в vault, и `assertI1` честно бросает `I1_VAULT`. Покрыть фонд так же, как это делает `armFund` в `services/api/test/harness.ts`: поднять `vault_corp` и `corp_deposited_total` на `ceil(fund / capital_anchor)`. Смысл пробы (догон равен реплею) не менять.
4. `apps/client/test/hud_visual.test.ts` около строки 92 запрещает `<Progress` в `ResourceLine`. Это устарело: кадр `hud/design-reference/00-hud-full.png` показывает полосы Energy и Compute, и `EconomyLook.tsx` их рисует. Убрать этот запрет. Остальные запреты файла не трогать.

**Гейт.** `npx vitest run packages/engine` — все зелёные. `npx vitest run apps/client/test/h8.test.ts apps/client/test/hud_visual.test.ts` — зелёные. `npx tsc --noEmit` в `packages/engine` и `apps/client` — 0 ошибок.

**Атака.** Откатить покрытие фонда в фикстуре h8 и убедиться, что `I1_VAULT` снова ловит непокрытый фонд. Вернуть покрытие.

### W1 — словарь пака

Без этих записей ни одна новая кнопка не получит маршрут: маршруты генерируются из действий. Правки — в `content/params/screens.json`, `content/params/codes.json`, `content/params/api.json`, `content/strings/en.json`, `content/strings/ru.json`, `content/lint.py`, `content/attack.py`. Потом `build.py` и `codegen.py`.

**Новые действия** (`screens.json` → `actions`), все `v1: "live"`, `demo_blocked: 0`:

| id | screen | label | effect | requires | spend | why |
|---|---|---|---|---|---|---|
| `building_build` | `building_card` | `UI_BUILD` | `commit:build` | `city_level`, `build_slot`, `capital` | `capital` | Постройка из карточки здания, без клетки и без экрана стройки |
| `building_activate` | `building_card` | `UI_ACTIVATE` | `commit:build` | [] | `none` | Возврат выключенного здания; сервер отличает по полю `active` |
| `building_deactivate` | `building_card` | `UI_DEACTIVATE` | `commit:build` | [] | `none` | Выключение здания; сервер отличает по полю `deactivate` |
| `district_unstake` | `district_card` | `UI_UNSTAKE` | `commit:unstake` | `district_open` | `none` | Снятие стейка; ниже `S_min` замораживает район с отсрочкой |
| `bank_present_voucher` | `bank` | `UI_PRESENT_VOUCHER` | `commit:present_voucher` | `wallet` | `none` | Предъявление ваучера вывода в сеть |

`building_build` намеренно **без** `build_tile`: клетки больше нет (`R-V-99`), и токен `build_tile` на этой кнопке врал бы. Существующее `build_place` не удалять и не переименовывать — удаление ключа это major. Оно остаётся на немонтируемом экране `build`.

**Изменить** `districts_open`: убрать `corp` из `requires` и поставить `spend: "none"`. Открытие района ничего не тратит (`R-W-02`), его держит стейк. `why` переписать под это.

**Новые коды** (`codes.json`):

| код | category | slots | http |
|---|---|---|---|
| `CHAIN_TX_UNCONFIRMED` | `transport` | [] | 409 |
| `WALLET_TX_REJECTED` | `transport` | [] | 400 |
| `VOUCHER_EXPIRED` | `state` | [] | — |

**Новые строки.** `UI_BUILD`, `UI_ACTIVATE`, `UI_UNSTAKE`, `UI_UNSTAKE_HINT`, `UI_STAKE_AMOUNT`, `UI_VOUCHER_READY`, `UI_VOUCHER_EXPIRES`, `UI_TX_SIGN`, `UI_TX_PENDING`, `UI_TX_MINING` — в `ui` обоих языков. Тексты трёх кодов — в `strings` обоих языков, плейсхолдеров нет. `UI_PRESENT_VOUCHER`, `UI_DEACTIVATE`, `UI_OPEN_DISTRICT` уже есть, заново не заводить. Тон как у соседних строк: коротко, без обещания суммы, без «гарантировано».

**Новые параметры** (`api.json` → `params`), все целые:

| ключ | v | u | зачем |
|---|---|---|---|
| `chain_receipt_poll_ms` | 2000 | ms | период опроса рецепта на клиенте |
| `chain_receipt_timeout_ms` | 120000 | ms | сколько клиент ждёт рецепт, потом честный отказ |
| `server_gas_headroom_bps` | 2000 | bps | запас газа на серверной подписи: `limit = estimate × (BPS + headroom) / BPS` |
| `client_resync_ticks` | 4 | count | раз во сколько тиков клиент заново тянет снимок, если WS молчит |
| `corp_quick_small` | 5 | corp | пресет депозита и покупки |
| `corp_quick_mid` | 10 | corp | пресет |
| `corp_quick_large` | 50 | corp | пресет |
| `capital_quick_small` | 10000 | capital | пресет вывода |
| `capital_quick_mid` | 25000 | capital | пресет |
| `capital_quick_large` | 50000 | capital | пресет |

`corp_display_decimals` заводить **не надо**: точность $CORP уже есть, это `sim.params.wei_decimals` (18). Кто покажет сумму — читает её оттуда.

**Правила линтера**, по одному, с атакой в `attack.py`:

- **L396.** У экрана `building_card` есть действия `building_build`, `building_activate`, `building_deactivate`, `building_upgrade`, и ни у одного в `requires` нет `build_tile`. Атака: убрать `building_activate` — правило обязано упасть.
- **L397.** У `districts_open` в `requires` нет `corp` и есть `wallet` и `stake_threshold`, а `spend` равен `none`. Атака: вернуть `corp` в `requires` — обязано упасть.
- **L398.** Коды `CHAIN_TX_UNCONFIRMED`, `WALLET_TX_REJECTED`, `VOUCHER_EXPIRED` существуют, и у каждого есть строка в обоих языках. Атака: удалить строку одного кода — обязано упасть.

Зарегистрировать все три строкой в `docs/CONTENT.md` §6 и поправить абзац «свободен с L396».

`pack_version` поднять один раз, причина: «словарь играбельности: постройка из карточки, анстейк, предъявление ваучера, коды сети».

**Гейт.** `lint.py` (правил стало 395), `build.py`, `codegen.py`, и **полный** `python content/attack.py --jobs 8`, потому что правлены `lint.py` и `attack.py`. Футер прогона вставить в отчёт.

### W2 — один мир, одна запись, сеть снаружи

Файлы: `services/api/src/city_lock.ts`, `commands.ts`, `tick_host.ts`, `host.ts`, `scheduler.ts`, `session.ts`.

**Лок.** `withCityLock` заменяется на один процессный лок на всё состояние, `withWorldLock`. И тик, и команда, и логин берут его. Переименовать функцию и поправить все вызовы; старое имя не оставлять, иначе кто-то возьмёт не тот лок.

**Состояние в БД.** `persistLiveState` пишет мир **один раз**, в строку `cities` с фиксированным ключом `world` (это не число, это ключ — литерал здесь допустим, как допустимы ключи таблиц). `restoreLiveState` читает сначала `world`, и только если её нет — старую строку первого города, чтобы уже записанные локальные состояния не потерялись.

**Откат памяти.** `executeCommand` запоминает `structuredClone(state)` перед применением и возвращает его, если `COMMIT` не прошёл. Сейчас при ошибке БД память остаётся изменённой, а база — нет.

**Сеть снаружи.** Перестроить `executeCommand` по рецепту 2.2. Проверка `expected_city_time` и лимита команд остаётся под локом, потому что обе читают живое состояние.

**Записи тика.** Ключ `records` уже содержит `cityId` (`tick_host.ts:115`) — не сломать это при переносе. Проверить, что `runTick` берёт `withWorldLock`, и что `attest` по-прежнему вне транзакции.

**Тест** `services/api/test/w2.test.ts`:

- две команды на разные города параллельно дают оба эффекта, без потерянного `COMMIT`;
- падение `putBytes` после применения возвращает память к снимку до команды;
- рестарт (`restoreLiveState` на том же сторе) поднимает мир со всеми городами, а не с первым;
- повторный `intent_id` возвращает прежний ответ и не применяет эффект второй раз (это уже так, тест фиксирует, что не сломалось).

**Атака.** Команда, чей `COMMIT` бросает, не должна менять `city.capital` даже в памяти. Прогнать и показать.

### W3 — сессия на чтение и на WS

Файлы: `services/api/src/http.ts`, `listen.ts`, `ws.ts`.

`GET /city/{id}/state` и апгрейд WS требуют тот же заголовок сессии, что и команда (`sessionFromHeaders`). Чужой или пустой — `API_UNAUTHORIZED` и сокет закрыт. Игрок подписан только на свой `city_id`: сервер и так фильтрует по соединению, надо лишь не принимать соединение без сессии.

**Тест** `services/api/test/w3.test.ts`: без заголовка оба пути дают 401; со своей сессией состояние приходит; с чужой сессией на чужой `city_id` — 401.

**Атака.** Подделать `city_id` в URL при валидной сессии другого города. Обязано быть 401, не чужое состояние.

### W4 — постройка, включение, выключение

Файлы: `services/api/src/commit.ts` (ветки `build`, `upgrade`, `assign`), `packages/engine/src/slots.ts` и близнец `content/slots.py`, если правило слота живёт там.

`applyBuild`:

- Здание с `autonomous: true` строится. Отказ `autonomous` убрать. `prebuilt` по-прежнему не строится и не улучшается.
- Повторный `build` на уже построенное возвращает `API_MALFORMED`, а не молчаливый успех.
- Здание, чей район не открыт, возвращает `DISTRICT_LOCKED`. Район здания брать из `buildingDistrictIds` (`slots.ts`), не из строки в HUD.
- Слоты считать по `generated.balance.build_slots[city_level]`, а не `agentSlots(...) + 3`. Деактивированное здание **занимает** слот: в каноне деактивация не освобождает место.
- `CITY_LEVEL_TOO_LOW` возвращать, только когда уровень города ниже требования здания. Сейчас им отвечают на все случаи подряд — это и есть баг, из-за которого игрок видит неверный отказ.

`applyUpgrade` на здании, которого нет, выполняет **постройку** (`R-W-01`): те же проверки, тот же результат, что `build`. На деактивированном — `API_MALFORMED` с понятным смыслом, не `CITY_LEVEL_TOO_LOW`.

`applyAssign` на здание под стройкой возвращает `IDLE_UNDER_CONSTRUCTION`, не `API_MALFORMED`.

**Тест** `services/api/test/w4.test.ts`:

- `build` для `workshop` на свежем городе проходит и ставит `construction` из `level_build_time`;
- `build` для `agent_hub` и `robotics_lab` проходит;
- `build` для `energy_plant` до открытия района `energy` даёт `DISTRICT_LOCKED`;
- `upgrade` на непостроенном `workshop` строит его;
- деактивация построенного и повторная активация возвращают его в работу;
- деактивация непостроенного даёт отказ, не 200;
- город на уровне 1 не может занять слотов больше, чем `build_slots["1"]`.

**Атака.** Построить, деактивировать и построить другое, пока слоты кончились: деактивированное должно по-прежнему занимать слот, новое — получить `NO_FREE_BUILD_SLOT`.

### W5 — стейк открывает район

Файл: `services/api/src/commit_districts.ts`.

`applyOpenDistrict`: убрать проверку `corp_held`. Оставить `wallet` (не демо), `playable` и порог `stakeHeld >= stakeMin`. Когда район открывается впервые и порог взят — сразу выставить тир 1, без платы: тир 1 стоит 0, а сейчас его приходится покупать отдельным `unlock_tier`, и игрок этого не находит.

`applyStake`: убрать требование открытого района. Если после зачисления `stakeHeld >= stakeMin` и район ещё не открыт — открыть его тем же кодом, что `applyOpenDistrict`, и поставить тир 1. Разморозить, если был заморожен (это уже есть).

Новая ветка `unstake` в `commit.ts` → функция в `commit_districts.ts`. Снимает через `unstake` из `@corporator/engine` (`bank.ts:162`), который уже ведёт `stake_settled`, `tokens_held` и `district_freeze_until`. Не писать второй раз. Сумма приходит в `amount`; больше остатка — `STAKE_BELOW_THRESHOLD`.

**Тест** `services/api/test/w5.test.ts`:

- на свежем городе `stake` на `NVDA` размером `s_min` открывает `compute` и ставит тир 1;
- `stake` меньше `s_min` не открывает и возвращает `STAKE_BELOW_THRESHOLD` на последующий `open_district`;
- `open_district` при выполненном пороге проходит с `corp_held = 0`;
- `unstake` ниже `s_min` ставит `district_freeze_until` на `unstake_grace_city_hours` вперёд;
- повторный `stake` до порога снимает заморозку.

**Атака.** `unstake` на сумму больше `stake_settled` не уводит остаток в минус и не открывает район.

### W6 — подпись сервера и чтение сети

Файлы: `packages/chainport/src/rpc/abi.ts`, `codec.ts`, `live.ts`, `port.ts`, новый `packages/chainport/src/rpc/sign.ts`.

**Чтение, которого нет.** Добавить в транспорт и в порт:

- `eth_getTransactionReceipt` и `eth_getTransactionByHash`, разобранные до полей `status`, `from`, `to`, `input`;
- `eth_getTransactionCount` для адреса и блока `pending` — это nonce;
- `eth_estimateGas`, `eth_gasPrice`;
- `allowance(owner, spender)` у ERC-20;
- чтения `Vault`: `pending(account)`, `issued(nonce)`, `used(nonce)`, `backingOf(account)`, `reservedOf(account)`.

**Подпись.** `sign.ts` собирает сырую транзакцию типа legacy (EIP-155): nonce, gas price, gas limit, to, value, data, `chainId`, подпись `secp256k1` поверх keccak. Keccak брать из `@corporator/engine`, подпись — `@noble/secp256k1`, который уже стоит в `services/api`. Новых библиотек не ставить. Отправка — `eth_sendRawTransaction`.

Ключи ролей читаются из окружения, по именам, которые уже есть в паке (`arch.secrets`): `CORPORATOR_VAULT_MINTER`, `CORPORATOR_VOUCHER_SIGNER`, `CORPORATOR_SIGNER`. В репозиторий значения не попадают. Нет переменной — метод роли возвращает `SERVICE_DEGRADED`, а не подписывает пустым ключом.

`gasLimit = estimate × (BPS + server_gas_headroom_bps) / BPS`, где `BPS` — из пака, не литерал `10000`.

**Тест** `packages/chainport/test/w6.test.ts` на `transportFromPost`: подпись проверяется разбором сырой транзакции (from восстанавливается из подписи и равен адресу роли), nonce берётся из `pending`, повторная отправка с тем же nonce не делается, пока первая не подтверждена.

**Атака.** Подменить `chainId` в ответе `eth_chainId`. Транзакция не должна уйти: подпись привязана к ожидаемому `chainId` из конфигурации.

### W7 — контракты: только свои токены

Файлы: `contracts/src/Vault.sol`, `contracts/src/StakeRegistry.sol`.

Перед правкой прочитать `launch.deployed` командой. Поля непусты — остановиться и спросить владельца, не править.

- `Vault.deposit`: `require(msg.sender == account)`.
- `StakeRegistry.stake`: `require(msg.sender == account)`.

Селекторы `deposit` и `stake` от этого не меняются: типы аргументов те же. Проверить, что `dataDeposit` и `dataStake` в `abi.ts` по-прежнему совпадают, и ничего там не перегенерировать.

**Гейт компиляции** — `solc` без Foundry:

```
npx --yes solc@0.8.28 --bin --via-IR contracts/src/Vault.sol contracts/src/StakeRegistry.sol
```

Падает — править, не игнорировать. Тесты Foundry в этом репозитории гоняет владелец в CI; здесь достаточно, что байткод собирается и селекторы живые.

**Атака.** В голове прогнать вызов `deposit` от третьего адреса и убедиться, что новый `require` его закрывает. Записать это в отчёт явно: автоматического прогона Solidity в шаге нет, и это названное ограничение, а не пройденная проверка.

### W8 — покрытие ваучера по лимиту банка

Решение владельца 2026-09-24, закрывать как обычную задачу. Игрок выводит столько Capital, сколько сам указал, пока это пропускает банк. Потолок банка уже считается в `applyWithdraw` и здесь не переписывается: часы и воскресенье, сумма не больше `city.capital`, дневной лимит от глубины пула, в vault хватает $CORP (`I1`, иначе `VAULT_EXIT_UNCOVERED`). Личный взнос потолком не является. Зарплата выводится тем же ваучером.

`refundPlayer` не трогать. Он по-прежнему отдаёт не больше `availableOf` (`content/lint.py`, правило L299, и `content/treasury.py` `refund_player`). Выигрыш через `refundPlayer` не возвращается — только через банк.

Перед правкой прочитать `launch.deployed` командой. Поля непусты — остановиться.

Файлы: `contracts/src/Vault.sol`, `contracts/script/PlayerReady.s.sol`, `contracts/test/L7.t.sol`, `contracts/test/M5.t.sol`, `contracts/test/P3.t.sol`, `packages/chainport/src/mock.ts`.

**Дом зарплаты.** Сбор, из которого платится зарплата, оседает в vault на отдельном адресе. Это `house`. Адрес задаётся окружением `CORPORATOR_VAULT_HOUSE` и читается в `PlayerReady.s.sol` так же, как `CORPORATOR_VAULT_MINTER`. В пак и в `arch.secrets` его не добавлять. Байбек минтит фонд на этот же адрес: второго котла нет. Найти место, где байбек выбирает счёт `depositThenMint`, и поставить туда этот адрес.

**Контракт.** В конструктор `Vault` последним аргументом добавить `house_`. Прежние семь аргументов не двигать. Во всех `new Vault(` дописать новый аргумент.

Вести два счётчика, оба целые:

- `totalPending` — сколько $CORP лежит в `pending` и ещё не стало backing. `deposit` прибавляет фактический `got`, `mintCapital` вычитает списанный `queued`.
- `totalReserved` — сумма открытых ваучеров. `issueVoucher` прибавляет, `_consumeReserved` вычитает.

Комната ваучера для `account`, функция `voucherRoom`:

```
bal = corp.balanceOf(address(this))
own = backingOf[account]
houseBal = backingOf[house]
others = totalBacking - own
если account != house: others = others - houseBal
locked = others + totalPending + totalReserved
room = bal > locked ? bal - locked : 0
```

`issueVoucher` пускает `corpAmount <= voucherRoom(account)`. Проверку `corpAmount <= availableOf(account)` убрать. `reservedOf[account]` растёт на всю сумму, даже когда она больше личного backing: пока ваучер открыт, `availableOf` этого игрока равен нулю и `refundPlayer` его взнос не отдаёт.

`presentVoucher` больше не требует `backingOf[account] >= corpAmount`. Списание backing: сначала личный, но не больше, чем он есть; затем дом, но не больше, чем есть у дома. Если сумма ваучера больше этих двух списаний, разница покрывается свободным балансом контракта — отдельного счёта у неё нет. Не хватило баланса на всю сумму — откат всей транзакции. Чужой `backingOf` не уменьшается ни на единицу. `totalBacking` уменьшается только на списанный backing, не на свободный остаток. Обрезка `capitalOf` остаётся для тех адресов, чей backing уменьшился. `_refund` не менять.

Селектор `issueVoucher` от этого не меняется: типы аргументов те же. `dataIssueVoucher` в `abi.ts` не переписывать.

**Мок.** `packages/chainport/src/mock.ts` `issueVoucher` сейчас режет по личному backing (`avail`). Поставить ту же комнату: свой backing плюс backing дома плюс свободный остаток `vaultHeld`, минус чужой backing, минус `totalPending`, минус резервы. `presentVoucher` списывает сначала личный backing, остаток — с дома, и не уходит в минус. Без дома мок ведёт себя как контракт с пустым `house`: выигрыш сверх своего backing и свободного остатка не проходит.

**Гейт.** Компиляция, как в W7:

```
npx --yes solc@0.8.28 --bin --via-IR contracts/src/Vault.sol
```

`python content/lint.py` — L299 зелёный. `npx vitest run packages/chainport` — зелёный. Тест мока `packages/chainport/test/w8.test.ts`: ваучер больше личного backing проходит, когда у дома хватает; backing второго игрока не меняется; тот же ваучер при пустом доме отклоняется; `refund` больше личного backing отклоняется.

**Атака.** Ваучер игрока A на сумму, которая съела бы backing игрока B, обязан откатиться, даже если на контракте лежит достаточно $CORP. Показать откат и неизменный `backingOf[B]`.

**Касса.** Это не разрешение минтить. Ваучер только переводит $CORP, которое уже лежит в vault. После W11 прогон кассы обязателен там, не здесь.

### W9 — каркас CS и депозит

Файлы: `services/api/src/commands.ts`, `commit_bank.ts`.

Ввести разбор `phase` по рецепту 2.1 в `handleCommand`, до лока. `prepare` для `deposit`: проверить гейты (`wallet`, сумма, `mint_rate`), посчитать `approve(vault, amount)` только если `allowance < amount`, и `deposit(account, amount)`. Вернуть `txs`. Ничего не записывать в состояние города.

`confirm`: сверить хеши, и только затем существующий `applyDeposit`. Убрать из живого пути прямой `port.vault.deposit` — его заменил `confirm`. Мок-порт (тесты) идёт сразу в применение и возвращает `phase: "applied"`, чтобы старые тесты не переписывать по одному.

**Тест** `services/api/test/w9.test.ts`: `prepare` не меняет `capital`; `confirm` с чужим `from` даёт `API_MALFORMED` и не минтит; `confirm` с верным рецептом минтит столько же, сколько мок-путь; повторный `confirm` с тем же хешем возвращает первый ответ и не минтит второй раз.

**Атака.** `confirm` без предшествующего `prepare` (нет тикета) — `API_MALFORMED`, состояние не тронуто.

### W10 — стейк из кошелька и из леджера

Файлы: `services/api/src/commit_districts.ts`, `project.ts`.

Игрок может застейкать и то, что купил на бирже (оно в `tokens_held`), и то, что лежит в кошельке. Различать по полю `source`.

- `source: "ledger"` — сегодняшнее поведение: списать `tokens_held`, зачислить `stake_settled`. Сети нет.
- `source: "wallet"` — рецепт CS: `approve(stakeRegistry)` при необходимости и `stake(account, ticker, amount)`. На `confirm` зачислить `stake_settled`, **не** трогая `tokens_held`: токены ушли из кошелька, а не из леджера.

Открытие района и тир 1 — из W5, здесь только источник.

Синхронизация с сетью — на чтении состояния, не в тике. `projectStake` сейчас читает несуществующий `stake_snapshot`. Заменить его на снимок `stakeRegistry.snapshot(account)`: записать в город `stake_chain[ticker]`. Выросло против прошлого снимка — добавить разницу в `stake_settled`. Упало — разницу провести через `unstake` движка и тут же списать её из `tokens_held` (токены ушли в кошелёк, а не в леджер; движок зачисляет их обратно, поэтому списать явно).

`oracle.district_efficiency` уже отдаёт `stake`, `stake_ok`, `stake_mult_ok` — этого HUD хватает, новое поле не городить. Добавить в снимок только то, чего нет: остаток по тикерам, чтобы игрок видел, сколько можно застейкать. Это `tokens_held` по шести тикерам внутри `tick.building_level` не класть — завести отдельный ключ нельзя без пака, поэтому положить `stocks` в уже существующий `oracle.stock_price` рядом с ценой (там строки по тикерам уже есть) и дописать в `why` источника.

**Тест** `services/api/test/w10.test.ts`: леджер-стейк открывает район без единого сетевого вызова; кошелёк-стейк без `confirm` не открывает; падение снимка в сети снимает `stake_settled` и не увеличивает `tokens_held`.

**Атака.** Двойной `confirm` одного и того же стейка не удваивает `stake_settled`.

### W11 — вывод до кошелька

**Заменено 2026-09-28:** исполняется в `docs/reports/TZ_WITHDRAW.md` (X7, X8, X9). Здесь не исполнять; текст ниже — история.

Файлы: `services/api/src/commit_bank.ts`, `project.ts`.

`applyWithdraw` больше не вызывает `present` и не кладёт $CORP в `corp_held`. Он считает сумму как сейчас (часы банка, лимит, курс — не переписывать формулу), списывает `Capital` и пишет строку в `city.vouchers`: `id`, `corp`, `issued_at`, `status: "open"`. `capital_outstanding` на этом шаге **не** меняется: деньги ещё в игре, игрок их не забрал.

Дальше сервер подписывает `issueVoucher` ролью `voucherSigner` (W6) и, когда транзакция подтверждена, помечает строку `status: "issued"`. Сервер не сравнивает сумму с личным взносом: потолок уже посчитан банком, а покрытие ваучера — комната из W8. Если контракт вернул `cover` — в vault не хватило свободных $CORP. Строка `status: "rejected"`, `Capital` возвращается игроку, код `VAULT_EXIT_UNCOVERED`.

`present_voucher` — команда CS. `prepare` возвращает одну транзакцию `presentVoucher(...)`. `confirm` после сверки хеша вызывает движковый `present`, уменьшает `capital_outstanding` и `vault_corp`, увеличивает `withdrawn_capital`. До `confirm` ничего из этого не происходит.

Просрочка. Движок уже умеет `expire` (`bank.ts:121`). Сервер при каждом тике смотрит строки старше `voucher_ttl_s`, шлёт `releaseExpiredVoucher` и возвращает `Capital` командой `expire`. Код игроку — `VOUCHER_EXPIRED`.

**Тест** `services/api/test/w11.test.ts`: вывод уменьшает `capital` и не увеличивает `corp_held`; до `confirm` `capital_outstanding` прежний; после `confirm` он падает на сумму вывода; просроченный ваучер возвращает `capital`; второй `confirm` того же хеша не возвращает второй раз.

**Атака.** Вывод при пустом `vault_corp` даёт `VAULT_EXIT_UNCOVERED` и не списывает `capital`.

**Касса.** Прогнать 100 тиков с депозитом и выводом и показать, что `capital_outstanding ≤ vault_corp × anchor` на каждом тике. Это главный инвариант задачи, не побочный.

### W12 — биржа и приз подписываются игроком

Файлы: `services/api/src/commit_exchange.ts`, `commit_prize.ts`.

`buy_stock` переводится на CS. `prepare` спрашивает у `CORPORATOR_HOP_URL` не исполненную цену, а транзакцию: тот же запрос, что сейчас, плюс `"want": "tx"`. Ответ хопа обязан содержать `to`, `data`, `value`. Нет хопа или нет транзакции в ответе — `EXCHANGE_HOP_UNAVAILABLE`, как и сегодня. `confirm` исполняет текущую логику зачисления `tokens_held` (стрижку `fragment_hop_haircut_bps` не трогать).

`claim_prize` аналогично, но только когда `launch.deployed` заполнен. Пока пуст — `refusal-only`, кнопку не включать, текст не обещать. Это уже закреплёно `hud_truth.test.ts`, не ослаблять.

**Тест** `services/api/test/w12.test.ts`: хоп, вернувший транзакцию, даёт `prepared`; хоп, вернувший пусто, даёт `EXCHANGE_HOP_UNAVAILABLE` и не списывает `corp_held`; `claim_prize` при пустом `deployed` не даёт `prepared`.

**Атака.** `confirm` покупки с `data`, отличающимся от выданных хопом, — `API_MALFORMED`, `tokens_held` не вырос.

### W13 — живой курс и оборот в тик

Файлы: `services/sampler/src/main.ts`, `step.ts`, `services/api/src/scheduler.ts`, `packages/engine/src/economy.ts` и близнец `content/tick.py`.

Сэмплер поднимает цикл. Источник выбирается так:

- `chain`, когда заданы `CORPORATOR_RPC_URL` и адрес фида. ETH/USD читается `latestRoundData` у `CORPORATOR_FEED_ETH_USD` (8 знаков — это формат Chainlink, не параметр). CORP/ETH читается из пула: вид пула задаёт `CORPORATOR_POOL_KIND` (`v2` → `getReserves`, `v4` → `StateView.getSlot0`), адрес — `CORPORATOR_POOL_ADDRESS`. Оборот за окно — сумма `Swap` логов за `sampler_period_max_s`.
- `pack`, когда сети нет: сид из пака и `dex_turnover = 0`. Этот режим **запрещён**, когда `CORPORATOR_DEPOSITS_OPEN=1`: процесс отказывается стартовать, а не молча кормит игру сидом.

Сэмплер пишет образец туда, откуда API его уже умеет читать, — в `tick_inputs` сервис не пишет (это чужая таблица). Он пишет `price_samples`. API в `inputsAhead` читает последний образец не старше `price_staleness_max_city_hours` и берёт из него `eth_usd_8dec`, `corp_eth_wei_per_whole`, сумму оборота. Нет свежего — `feed_live = 0` и прошлые ненулевые цены, ровно как движок уже делает при молчании.

`applyDexTurnover` в обоих двойниках переводится на `inputs["eth_usd_8dec"]`, с откатом на `cfg["eth_usd_8dec"]`, только когда вход нулевой. Порядок деления не менять.

**Тест** `services/sampler/test/w13.test.ts`: молчание фида дольше окна даёт `feed_live = 0`; режим `pack` при `DEPOSITS_OPEN=1` не стартует. Плюс векторный тест движка на то, что оборот считается от цены входа, а не из пака, — в `packages/engine/test`.

**Атака.** Образец с `eth_usd_8dec = 0` не обнуляет курс минта: берётся последнее ненулевое. Показать на прогоне.

### W14 — патчи всем, и не под локом

Файлы: `services/api/src/host.ts`, `scheduler.ts`, `ws_patch.ts`.

`stepTick` публикует патчи для **каждого** города из `state.cities`, а не только `firstCityId`. Сама публикация — после `COMMIT` и после отпускания лока: сокет не должен держать состояние.

**Тест** `services/api/test/w14.test.ts`: два города получают каждый свой патч за один тик; патч не уходит, если `COMMIT` не прошёл.

**Атака.** Город без единого соединения не роняет тик остальных.

### W15 — клиент находит сервер и не врёт часами

Файлы: `apps/client/src/main.tsx`, `boot.ts`, `clock.ts`, `hud/LiveRoot.tsx`, `hud/wsFeed.ts`.

- Адрес API — из `import.meta.env.VITE_CORPORATOR_API_ORIGIN`, если задан; иначе как сейчас, из пака. Хардкод `127.0.0.1` не добавлять.
- Клиент шлёт заголовок сессии и на `GET` состояния, и на WS (W3).
- Часы. `cityTimeFromWall` принимает якорь и момент, когда этот якорь был получен, а не `firstLoginMs`. `LiveRoot` запоминает `anchorMs` вместе с `snap.cityTime` и сбрасывает его при каждом новом снимке. Дельта считается от этого момента, поэтому время не удваивается.
- Повторный запрос снимка раз в `client_resync_ticks` тиков, если за это время не было ни одного WS-события. Число брать из пака, не зашивать.

**Тест** `apps/client/test/w15.test.ts`: при двух снимках подряд показанное время не обгоняет сервер больше чем на один интервал; без переменной окружения адрес равен паковому; с переменной — берётся она.

**Атака.** Снимок, пришедший на секунду позже предыдущего, не прыгает городом на час вперёд.

### W16 — отказ виден на каждой кнопке

Файлы: все экраны в `apps/client/src/hud/screens`, где команда уходит мимо `ActionButton`: `agents.tsx` (assign и objective), `building_card.tsx` (deactivate).

Правило одно: `onIntent` больше нигде не вызывается через `void`. Ответ `failed` или `unavailable` показывается тем же `Refusal`, что у `ActionButton`, рядом с кнопкой, которая его вызвала. `data-adapter-code` на корне остаётся, но он больше не единственный канал.

Заодно `applyAssign` уже возвращает `IDLE_UNDER_CONSTRUCTION` (W4) — на клиенте этот код надо показать, а здание под стройкой не предлагать в списке назначения.

**Тест** `apps/client/test/w16.test.ts`: отказ `assign` рисует `Refusal` с кодом; отказ `set_objective` рисует его; ни один экран не содержит `void onIntent` и `void screen.onIntent` (проверка по исходному тексту, как это уже делает `hud_visual`).

**Атака.** Найти `grep`-ом по `apps/client/src` оставшиеся `void .*onIntent`. Ноль вхождений — часть результата, назвать число.

### W17 — суммы в $CORP, а не в wei

Файлы: `apps/client/src/hud/screens/bank.tsx`, `exchange.tsx`, `hud/parts/si.ts`, топбар и `WalletFlyout.tsx`.

- Показ: `formatCorp(atoms)`, где `atoms` — сырой `bigint`, а делитель `10^wei_decimals` берётся из пака (`sim.params.wei_decimals`). Дробная часть — до 4 знаков, хвостовые нули убираются. Группировка как в `groupDigits`.
- Ввод: игрок пишет `5`, клиент умножает на `10^wei_decimals` перед отправкой. Пустое и нечисловое не отправляется.
- Пресеты депозита и покупки — `corp_quick_small/mid/large`, пресеты вывода — `capital_quick_small/mid/large`. Массивы `DEPOSIT_QUICK` и `WITHDRAW_QUICK` удалить.
- `MAX` по-прежнему подставляет точный остаток, уже в единицах показа.

**Тест** `apps/client/test/w17.test.ts`: `formatCorp(5 × 10^18)` даёт `5`; ввод `5` на депозите уходит в команду как `5000000000000000000`; пресеты читаются из пака, и в исходнике `bank.tsx` нет литералов `["5", "10", "50"]`.

**Атака.** Ввод `0` и ввод с буквой не порождают команду. Показать, что `onIntent` не вызван.

### W18 — клиент подписывает

Новый файл `apps/client/src/hud/walletTx.ts` и правка `LiveRoot.tsx` там, где запускается денежная команда.

`walletTx.ts` — единственное место, где клиент трогает сеть:

- `eth_chainId`; если не равен паковому — `wallet_switchEthereumChain`, а когда кошелёк не знает сеть, `wallet_addEthereumChain`. Отказ — `WALLET_WRONG_CHAIN`, команда не начинается.
- `eth_sendTransaction` по каждой транзакции из `txs` по порядку;
- `eth_getTransactionReceipt` с периодом `chain_receipt_poll_ms` и пределом `chain_receipt_timeout_ms`.

`LiveRoot` для команд из рецепта 2.1 делает `prepare` → подпись → `confirm` и показывает шаги существующим `TransactionStepper`: подпись, ожидание, подтверждено. Отказ кошелька на любой транзакции останавливает цепочку и показывает `WALLET_TX_REJECTED`; уже отправленные при этом не откатываются клиентом — их примет или не примет `confirm`, и это честно пишется игроку.

**Тест** `apps/client/test/w18.test.ts` на подменённом EIP-1193: цепочка из двух транзакций уходит по порядку; отказ второй не шлёт `confirm`; неверная сеть сначала зовёт `wallet_switchEthereumChain`.

**Атака.** `prepare`, вернувший пустой `txs`, не вызывает `eth_sendTransaction` ни разу.

### W19 — карточка здания

Файлы: `apps/client/src/hud/screens/building_card.tsx`, `selection.ts`, `hud/gates.ts`.

- Непостроенное функциональное здание показывает `building_build`, а не `building_upgrade`. Апгрейд — только когда здание есть в `functions`.
- Построенное и выключенное показывает `building_activate`.
- `building_deactivate` спрашивает подтверждение тем же `Dialog`, что денежные команды, и только потом шлёт.
- `Manage` у непостроенного `bank`, `exchange`, `agent_hub` ведёт на постройку, а не в кабинет пустого здания. `selection.ts` `manageForBuilding` для здания без строки в `functions` возвращает карточку здания, а не кабинет.
- Гейт `build_slot` на клиенте считать по тому же `build_slots[level]`, что сервер (W4), и не считать `prebuilt`.

**Тест** `apps/client/test/w19.test.ts`: на непостроенном рендерится `building_build` и не рендерится апгрейд; на выключенном рендерится `building_activate`; деактивация без подтверждения не шлёт команду.

**Атака.** Непостроенное здание с закрытым районом: кнопка постройки заблокирована с `DISTRICT_LOCKED`, а не спрятана.

### W20 — районы: стейк, открытие, снятие

Файлы: `apps/client/src/hud/workspace/IndustriesWorkspace.tsx`, `screens/district_card.tsx`, `parts/IndustryCard.tsx`.

- Закрытый район с непокрытым порогом получает поле суммы и кнопку `district_stake_more` с `source: "wallet"`, а не заблокированный `districts_open`. Сколько не хватает — из `oracle.district_efficiency` (`stake` против порога), не вычислять порог на клиенте заново.
- Когда `stake_ok` уже 1 — обычный `districts_open`.
- Открытый район: поле суммы для добавочного стейка (сейчас `district_stake_more` уходит без `amount`) и кнопка `district_unstake` с текстом `UI_UNSTAKE_HINT`, который прямо говорит, что снятие ниже порога заморозит район.
- Тир 1 после открытия показан открытым, без кнопки «купить» за 0.

**Тест** `apps/client/test/w20.test.ts`: закрытый район без стейка показывает ввод суммы; открытый показывает снятие; отправка стейка содержит `amount` и `source`.

**Атака.** Район в `grace` не даёт нажать `unstake` второй раз, пока висит отсрочка.

### W21 — банк на рецепте CS

Файлы: `apps/client/src/hud/screens/bank.tsx`, `LiveRoot.tsx`.

Часть «Вывод» этой задачи заменена 2026-09-28 задачей X13 `docs/reports/TZ_WITHDRAW.md`; депозит остаётся здесь.

Депозит идёт через W18: подтверждение, подпись `approve`+`deposit`, ожидание. Вывод идёт через W11: после `withdraw` карточка показывает открытый ваучер (`UI_VOUCHER_READY`, срок из `voucher_ttl_s`), а `bank_present_voucher` запускает подпись `presentVoucher`. Пока ваучер не выпущен сервером, кнопка предъявления объясняет, чего ждёт, и не молчит.

**Тест** `apps/client/test/w21.test.ts`: депозит на мок-порте по-прежнему один запрос с `phase: "applied"`; на живом порте сначала `prepare`; предъявление без открытого ваучера не шлёт транзакцию.

**Атака.** Сумма вывода больше `capital` не открывает диалог подтверждения.

### W22 — биржа и агенты

Файлы: `apps/client/src/hud/screens/exchange.tsx`, `agents.tsx`.

- Покупка на бирже идёт через W18 и W12. Пресеты — из W17. Когда хоп не сконфигурирован, кнопка показывает `EXCHANGE_HOP_UNAVAILABLE`, как сейчас, и не рисует пустую подпись.
- Назначение агента и смена задачи показывают отказ рядом с контролом (W16 доводит механизм, здесь — чтобы эти два экрана им пользовались).
- Здание под стройкой в список назначения не попадает.

**Тест** `apps/client/test/w22.test.ts`: покупка при живом хопе зовёт `prepare`; здание с `construction > 0` отсутствует в списке назначения.

**Атака.** Назначение на здание, которое снесли между отрисовкой и кликом, показывает отказ сервера, а не роняет промис.

### W23 — все кнопки либо работают, либо честно молчат

Это сверка, а не новая механика. Пройти по инвентарю контролов и для каждой кнопки, которая что-то обещает, убедиться, что она либо шлёт команду и показывает ответ, либо заблокирована с кодом причины.

Проверяются конкретно: постройка, апгрейд, включение, выключение, найм, назначение, задача, депозит, вывод, предъявление ваучера, покупка, открытие района, стейк, снятие стейка, тир, узел, мерж, фрагмент, исследование. Не проверяются и не оживляются: миссии, Settings, приз сезона при пустом `launch.deployed`.

**Тест** `apps/client/test/w23.test.ts` поднимает живой HUD на мок-данных и для каждого пункта списка проверяет, что у кнопки есть либо живой обработчик, либо `disabled` с непустым `data-blocked-code`. Список пунктов — в самом тесте, чтобы следующая мёртвая кнопка роняла его, а не ревью.

**Атака.** Удалить обработчик у одной кнопки в фикстуре теста и убедиться, что тест падает. Вернуть.

### W24 — канон вслед за кодом

Только документация, и только после того, как код задач W4, W5, W11, W19, W20, W21 уже зелёный. Не раньше: документ не должен описывать поведение, которого ещё нет.

- `docs/CANON.md`: снять пометку «в коде ещё нет» у тех `R-W`, которые закрыты, и заменить описанием того, что код делает теперь.
- `docs/reports/PLAN_LAUNCH.md` приложение A: у `C-22` поставить «снято `R-W-04`», не удаляя строку.
- `docs/SCREENS.md`: одной строкой на каждый изменённый экран — где теперь живёт постройка, стейк и вывод.
- `DESIGN.md` §4.5: открытие района держится на стеке, `corp_held` для открытия не требуется. Одним предложением, не абзацем.

**Гейт.** `lint.py` зелёный (правки прозы его не касаются, но прогнать). Расхождений между `CANON.md` и кодом в отчёте — ноль, либо названы.

### W25 — приёмка

Один проход по всей игре на моке, командами, не глазами.

Поднять API на `openPglite` и пройти свежим кошельком: депозит → найм → постройка `workshop` и `energy_plant` → открытие района стейком → назначение агента → несколько тиков → вывод → предъявление ваучера. На каждом шаге записать код ответа и состояние. Любой отказ, которого не ждал, — дыра, чинить здесь же, не заводить W26.

Затем то же самое через живой HUD (`l3.test.ts` показывает, как поднять `listenApi` и `createLiveAdapter` в тесте) и проверить, что клиент видит те же числа.

**Полный гейт**, потому что это закрытие:

```
python content/lint.py
python content/build.py
python content/attack.py --jobs 8
npx vitest run
```

В отчёт: число правил, хеш пака, круг, вход/выход, футер атак, число тестов. Плюс четыре проверки, которые линтер не делает: касса не выросла за прогон; непокрытый фонд ловится `I1`; повторный `confirm` ничего не удваивает; кнопка без провода не выглядит нажатой.

---

## 5. Что этим ТЗ не является

- Не запуск токена и не деплой. `launchToken` не подписывается.
- Не новый экран и не новый визуальный стиль. Вид HUD остаётся на `hud/design-reference/`; где задача здесь меняет состав экрана, она называет это прямо.
- Не баланс экономики. Ставки, фонд и наклон заработка закрыты `TZ_EARNINGS` и здесь не двигаются.
- Не остров. Посадка, GLB и Terra не трогаются.
