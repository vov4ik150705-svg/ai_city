# TZ_WITHDRAW — вывод до кошелька: $CORP, Stock Tokens, анстейк через 30 суток

Живое ТЗ. Задание — чтобы всё, что игрок заработал или завёл в игру, он мог забрать **в свой кошелёк**, а не на внутренний баланс города:

- Capital → $CORP через банк → кошелёк (ваучер Vault);
- Stock Tokens с биржи, из Farm и из месячного приза → кошелёк;
- застейканные Stock Tokens → анстейк → **30 суток города** (2 700 000 с) ожидания в контракте → кошелёк.

Слово владельца 2026-09-28: «чтоб вывод заработал, stock tokens тоже вывод, анстейк возвращает но через 30 дней». Этот файл исполняет `R-W-04` из `docs/CANON.md` и **заменяет** задачу W11 и часть «Вывод» задачи W21 в `docs/reports/TZ_PLAYABLE.md`. Там их не исполнять.

Читать целиком §0, §1 и §2 до первой правки. Дальше — только ту задачу, которую закрываешь. Как исполнять — `.cursor/rules/tz-withdraw.mdc`.

---

## 0. Как работать с этим файлом

### 0.1 Одна задача за заход

Задачи: **X0 … X15**. Порядок — §4, он не произвольный. Владелец не назвал id — спроси. Не бери две сразу. Не начинай «всё сразу».

Каждая задача, где это возможно, начинается с **красного теста**: тест, который падает на текущем коде и описывает дыру. Потом правка, потом тест зелёный. Тест, который был зелёным до правки, дыру не доказывает.

### 0.2 Оболочка и команды

PowerShell 5. Не `&&`, не `grep`, не `head`. Разделитель — `;`. `pnpm` через `corepack pnpm`. Foundry локально не ставить: `forge test --root contracts` гоняет CI (`.github/workflows/ci.yml`, шаг `forge_test`). `node_modules` не переустанавливать. Удаление — только `Move-Item` в `C:\Users\sk640\corporator-trash-20260918`.

Пак трогал:

```
python content/lint.py
python content/build.py
python content/codegen.py
python content/attack.py --only <новые и затронутые L>
```

TypeScript — `npx tsc --noEmit -p tsconfig.json` из каталога пакета (`services/api`, `packages/chainport`, `apps/client`, `services/buyback`). Тесты — из корня, узко: `npx vitest run services/api/test/<файл>.test.ts`. Плюс `ReadLints` на все правленные файлы.

Полный `python content/attack.py --jobs 8` — только в **X2** (там правится `lint.py`) и в **X15**. Полный `npx vitest run` — только в X15.

### 0.3 Движок не трогать

Все правки этого ТЗ — в API, порте, контрактах, паке и клиенте. `packages/engine/src/*.ts` не меняется: `authorize`, `present`, `expire`, `unstake`, `settleCities` уже есть и используются как есть. Если кажется, что без правки движка не обойтись, — стоп и вопрос владельцу: правка движка тянет двойника в `content/*.py` и векторы.

### 0.4 Красные линии

- **I1 касса.** `capital_outstanding ≤ vault_corp × capital_anchor`. Ни одна задача не минтит Capital. Нет «допечатать, чтобы закрыть смены».
- **Круг трения.** `vault_fee_bps = 200`, `bank_markup_bps = 1000`, `bank_markup_floor_bps = 650`. Полоса `[1400, 1600]`. `L13`, `L14` не шелохнутся. Формулу цены вывода (`corpOut` в `commit_bank.ts`) не переписывать.
- **Вход дешевле выхода.** `creator_tax_bps = 200` иммутабелен.
- **Детерминизм тика.** Всё сетевое в этом ТЗ — вне тика: до лока (чтение) или после коммита (серверная подпись). Тик не ждёт сеть.
- **Лок (§2.2 TZ_PLAYABLE).** Чтение сети — до лока, запись состояния — под локом, серверная подпись — после коммита. Сеть не внутри транзакции БД.
- **Подпись игрока — у игрока (`R-W-03`).** Сервер не держит ключ игрока и не платит его газ. Сервер подписывает только свои роли: `voucher` (выпуск и отпуск ваучера), `signer` (нарезка казны призов), `minter`.
- **Числовых литералов в рантайме нет**, кроме `0`, `1`, индексов и констант криптографии. Каждое новое число — параметр пака (X2).
- **Сгенерированное с шапкой `GENERATED from pack`** (`routes.ts`, `codes.ts`, миграция, `deploy/.env.example`) правится только через `content/codegen.py`.
- **`launchToken` не подписывать, не деплоить.** Перед правкой контрактов (X1) прочитать `content/params/launch.json` поле `deployed` **командой**. Хоть одно поле непусто — стоп, вопрос владельцу.
- **`claim_prize` остаётся `refusal-only`**, пока `launch.deployed` пуст (`hud_truth.test.ts`). Это ТЗ доводит провод, но кнопку не включает.
- **Мок не кастодиален.** Мок-порт остаётся одношаговым (`phase: "applied"`), его поведение и тесты (`w25.test.ts`, `h2.test.ts`) не ломать.
- Не трогать `C-20`, `C-01`. Юнитов, 19-го здания, миссий, Settings не добавлять.

### 0.5 Свободные id линтера

На 2026-09-28 занято до **L398** (TZ_PLAYABLE W1). Это ТЗ занимает **L399** (X2). Следующий свободный после — **L400**. Дыры L328, L364, L387 не переиспользовать. Новое правило — строка в `docs/CONTENT.md` §6 и атака в `content/attack.py`.

### 0.6 Гейт задачи — три прохода

1. **Логика.** Команды секции задачи. Трогал пак — `lint.py` (правил и ошибок числом), `build.py` (pack, hash, круг, вход/выход), `attack.py --only`.
2. **Синтаксис.** `ReadLints`, `tsc --noEmit` в каждом тронутом пакете. Контракты — `forge build` недоступен локально; синтаксис Solidity сверять глазами по соседним функциям и оставить CI.
3. **Адверсариальное ревю.** Атаки из секции задачи плюс свои. Каждая атака — тест или прогон с падением. Список атак в отчёте обязателен.

`pack_version` поднимается один раз на задачу, которая трогала пак, причина — `docs/CONTENT.md` §5.

### 0.7 База на 2026-09-28, от которой считать

Снято командами:

- `python content/lint.py`: `rules run : 395`, ошибок нет.
- `python content/build.py`: pack 695 727 байт, хеш `34d65cca65bcd975461587939a8654f8334613e24965e22c57b31ae9de150bec`, правила 0.24.0, pack_version 187, круг 1445 bps, вход 200 / выход 910 (Trader 611).
- `launch.deployed`: `token`, `curve`, `pool`, `hook`, `tx` — все пусты.
- Параметры: `voucher_ttl_s = 3750` (один час города), `unstake_grace_city_hours = 24`, `city_day_real_hours = 25`, `tick_length_real_seconds = 3750`.

Перед первой задачей снять заново и сверить. Разошлось — назвать.

Базы тестов в этом файле нет: общий прогон `npx vitest run services/api packages/chainport` при написании ТЗ не закончился и за 15 минут. В X0 гонять тесты по файлам (`w25`, `w10`, `commit_bank`, тесты порта) и записать pass/fail каждого до первой правки.

### 0.8 Отчёт

По-русски; код, id, коммиты — по-английски. Коммит только по просьбе. Тексты файлов в чат не выводить.

1. Какую задачу закрыл. 2. Гейт числами. 3. Что атаковал и что нашлось. 4. Факт против этого ТЗ. 5. Что осталось владельцу. 6. Следующий id по §4.

---

## 1. Диагноз — что сейчас не доходит до кошелька

Проверено чтением кода и тестом `services/api/test/w25.test.ts` (зелёный, закрепляет текущее поведение).

### 1.1 $CORP не уходит в кошелёк

`services/api/src/commit_bank.ts`, `applyWithdraw`: проверяет часы, воскресенье, лимит и покрытие, затем в одном вызове `authorize` → `present`, списывает `capital`, **прибавляет `corp_held`** (внутренний баланс города), уменьшает `vault_corp` и `capital_outstanding`. Транзакции в сети нет, `issueVoucher` не вызывается.

`applyPresentVoucher` ничего не переводит: находит строку резерва со статусом `settled` и отвечает. В `services/api/src/commands.ts` у `withdraw` и `present_voucher` нет ветки `prepare`/`confirm`; рецепт есть только у `deposit`, `stake` из кошелька, `buy_stock`, `claim_prize`.

Готово и не используется: `Vault.issueVoucher` / `presentVoucher` / `releaseExpiredVoucher` (`contracts/src/Vault.sol`), `dataIssueVoucher` / `dataPresentVoucher` (`packages/chainport/src/rpc/abi.ts`), серверная подпись роли `voucher` (`rpc/live.ts`, `broadcastRoleTx`), чтения `issued`, `used`.

`$CORP` на `corp_held` тратится только на бирже. Команды «в кошелёк» нет.

### 1.2 Stock Tokens живут в серверном леджере

`city.tokens_held` пишут: `commit_exchange.ts` `creditBuyStock` (биржа), `commit_fragments.ts` `payOwed` (Farm), движковый `unstake` (снятие стейка), `commit_districts.ts` `moveStake` (стейк из леджера), `project.ts` `dropChainStake`. Никто не отправляет их в кошелёк.

- **Биржа на живом порте.** Кошелёк подписывает транзакцию хопа (тратит свой on-chain $CORP), а `confirm` при этом ещё и **списывает `corp_held`** и зачисляет `tokens_held`. Физически токены уходят туда, куда их направил хоп, — сервер это не проверяет (не читает логи чека).
- **Farm.** `claim_fragment` переносит `fragment_owed` в `tokens_held`. Физически токены Farm лежат в `PrizeTreasury` (котёл `KETTLE_FARM = 0`), у которого есть `claimPrize` в кошелёк. Но нарезку `slice` для Farm в продакшене **никто не делает**: конвейер байбека принимает строки `slices` только из батча, а источник батча — `createMockConveyorSource` / `createCannedConveyorSource` (`services/buyback/src/source.ts`).
- **Месячный приз.** `prepareClaimPrize` собирает по транзакции `claimPrize` на каждый из 6 активов × 2 котла, не читая `owed`. Транзакция с нулевым `owed` откатывается (`require(amt > 0, "owed")`), и `confirm` падает `CHAIN_TX_UNCONFIRMED`.

### 1.3 Анстейк не касается контракта

`applyUnstake` вызывает движковый `unstake`: `stake_settled` → `tokens_held`. На живом порте токены при этом остаются в `StakeRegistry`. Сам контракт `StakeRegistry.unstake` отдаёт токены **мгновенно**, отсрочки нет.

Отсюда двойной учёт: игра считает токены на балансе города, игрок снимает их в контракте напрямую в кошелёк, синхронизация (`project.ts` `dropChainStake`) пытается снять уже нулевой стейк, движковый `unstake` отказывает, и токены продолжают числиться на балансе города.

### 1.4 Двойное зачисление стейка из кошелька (по чтению кода, не прогоном)

`commands.ts` `executeStakeConfirm` → `applyStake` → `creditStake` прибавляет сумму к `stake_settled`, но не пишет `city.stake_chain`. Следующий `syncStakeSnapshot` видит в контракте ту же сумму при `stake_chain = 0` и прибавляет её **ещё раз** (`applyChainRows`, ветка `row.amount > prev`). Тест `w10.test.ts` синхронизацию после `confirm` не прогоняет. Первое действие X4 — красный тест на это.

### 1.5 Нельзя отличить «предъявлен» от «отпущен»

`Vault.presentVoucher` и `releaseExpiredVoucher` оба ставят `used[nonce] = true` и удаляют `issued[nonce]`. Событий у Vault нет. Сервер, который не получил `confirm` от клиента, не может по сети понять, забрал ли игрок $CORP или ваучер истёк, — а от этого зависит, возвращать ли Capital.

### 1.6 `slice` не идемпотентен

`PrizeTreasury.slice` прибавляет `owed[...] += amounts[i]`. Повтор той же нарезки после сетевой тишины (транзакция на самом деле прошла) нарежет дважды за счёт чужих токенов котла.

---

## 2. Решения, которые это ТЗ исполняет

**R-X-01 — $CORP выводится ваучером (это `R-W-04`).** На живом порте вывод списывает Capital и выпускает ончейн-ваучер (подпись сервера ролью `voucher`). Игрок сам предъявляет его своим кошельком, и $CORP приходит из Vault в кошелёк. Банковские проверки и цена — как сейчас. `corp_held` на живом порте больше не растёт.

**R-X-02 — Stock Tokens у кошелькового города на живом порте не лежат в леджере.** Каждый токен всегда либо в кошельке игрока, либо в контракте (стейк, отсрочка анстейка, казна призов). Биржа кладёт купленное прямо в кошелёк. Farm и месячный приз забираются `claimPrize` в кошелёк. Инвариант: на живом порте у кошелькового города `tokens_held = 0` и `corp_held = 0` после любой команды.

**R-X-03 — Анстейк: 30 суток города в контракте, потом в кошелёк.**
- Запрос анстейка — транзакция игрока `requestUnstake`. Токены **сразу** перестают считаться стейком: район живёт по действующему правилу (24 часа города отсрочки, потом лёд, `DESIGN.md` §4.5).
- Токены лежат в `StakeRegistry` `unstake_cooldown_s` секунд, потом игрок забирает их транзакцией `claimUnstaked` в кошелёк.
- Отмены нет. Один бакет на пару (кошелёк, тикер). Новый запрос по тому же тикеру сначала выплачивает созревший бакет, а если бакет ещё не созрел — добавляет сумму и **перезапускает таймер на всю сумму**. HUD предупреждает об этом до подписи.
- Мгновенного `unstake` в контракте больше нет.

**R-X-04 — Мок остаётся одношаговым.** На мок-порте (разработка, тесты) вывод, биржа, Farm и анстейк работают как сегодня: `corp_held` и `tokens_held` там — представление кошелька. Мок не деньги и не кастодиан.

**R-X-05 — Живой порт отказывается работать с непустым леджером.** Пока ничего не задеплоено, реальных балансов нет, миграции нет. Если на живом порте у кошелькового города `corp_held > 0` или `tokens_held > 0`, процесс не стартует с кодом `LEDGER_NOT_EMPTY_LIVE`: оператор обнуляет состояние, а не игрок теряет деньги молча.

**R-X-06 — Правда о выводе — в сети, не в `confirm` клиента.** `confirm` клиента только ускоряет. Если игрок подписал, но не прислал `confirm` (закрыл вкладку), сверщик сервера сам доводит ваучер, нарезку и анстейк до конечного статуса по чтению сети.

### 2.1 Решения владельца 2026-09-28

| Вопрос | Решено | Отклонено |
|---|---|---|
| 30 суток — каких | 30 суток **города**: `30 × city_day_real_hours × 3600 = 2 700 000 s` (750 реальных часов, 31.25 реальных суток). Контракт знает только `block.timestamp`, поэтому в него уходят секунды из пака. | 30 реальных суток, `2 592 000 s` |
| Новый запрос при несозревшем бакете | перезапуск таймера на всю сумму | запрет второго запроса до выплаты (`UNSTAKE_COOLING`) |
| Стрижка хопа `fragment_hop_haircut_bps` на живой бирже | не применяется: игрок получает ровно то, что доставила сеть. Задача Quote у Trader на живой бирже на цену не влияет. | держать стрижку — новая механика удержания |
| Газ игрока | игрок платит ETH за `presentVoucher`, `stake`, `requestUnstake`, `claimUnstaked`, `claimPrize`, покупку сам; HUD об этом пишет | спонсор газа |
| Котёл Farm меньше расчёта окна (`Σ > bag`) | не резать ничего, ждать, пока котёл покроет окно; тревога в журнал | пропорциональная нарезка |
| Застрявший `pending` в Vault | оставить: сервер повторяет минт (`settleServerMint`), `reclaimPending` не добавлять | возврат `pending` игроку |

Смена любого пункта — новое решение владельца, не правка исполнителя.

---

## 3. Модель: где лежит актив и как он попадает в кошелёк

| Актив | Где лежит на живом порте | Как попадает в кошелёк | Команда | Кто подписывает |
|---|---|---|---|---|
| Capital | только в состоянии сервера (не токен) | через $CORP-ваучер | `withdraw` → `present_voucher` | выпуск — сервер (`voucher`), предъявление — игрок |
| $CORP, выведенный из банка | Vault (зарезервирован ваучером) | `presentVoucher` | `present_voucher` | игрок |
| $CORP, заведённый депозитом | Vault как backing | обратно только через Capital → банк; аварийно `refundPlayer`/`claimRefund` (не трогаем) | — | — |
| Stock с биржи | сразу кошелёк | хоп доставляет на `from` | `buy_stock` | игрок |
| Stock из Farm | `PrizeTreasury`, котёл FARM | `claimPrize(token, FARM)` после нарезки | `claim_fragment` | нарезка — сервер (`signer`), забор — игрок |
| Stock месячного приза | `PrizeTreasury`, котёл MONTH | `claimPrize(token, MONTH)` | `claim_prize` (refusal-only до деплоя) | игрок |
| Stock в стейке | `StakeRegistry.amountOf` | `requestUnstake` → 30 суток → `claimUnstaked` | `unstake` → `claim_unstaked` | игрок |

Статусы ваучера на сервере: `signing` → `open` → один из конечных `presented` / `expired` / `rejected`. Не путать с движковыми статусами резерва `open` / `settled` / `expired` в `state.bank_reservations`: строка ваучера ссылается на резерв по `id`.

Не путать `city.unstake_pending` (движок, очередь заморозки района, 24 часа города) и новое `city.unstake_cooldown` (токены в контракте, 30 суток города). Это разные вещи с разными часами.

---

## 4. Порядок и зависимости

```
X0 ─> X1 ─> X2 ─> X3 ─┬─> X4 ─> X5 ─> X6 ──────┐
                      ├─> X7 ─> X8 ─> X9 ──────┤
                      ├─> X10 ─────────────────┤
                      └─> X11 ─────────────────┴─> X12 ─> X13 ─> X14 ─> X15
```

Линейно, если работает один агент: X0, X1, X2, X3, X4, X5, X6, X7, X8, X9, X10, X11, X12, X13, X14, X15.

---

## 5. Задачи

### X0 — регистрация и красные тесты диагноза

Только документы и тесты, код не трогать.

- Проверить, что строка этого файла есть в `docs/CANON.md`, а в `TZ_PLAYABLE.md` у W11 и W21 стоит отсылка сюда. Нет — вопрос владельцу, не исполнять ТЗ вне таблицы канона (`R-V-102`).
- Завести `services/api/test/x0.test.ts` с **ожидаемо красными** проверками диагноза, помеченными `it.fails` (vitest), чтобы набор оставался зелёным, а дыра была записана:
  1. на живом (фикстурном) порте вывод не должен увеличивать `corp_held` (сейчас увеличивает);
  2. стейк из кошелька: `confirm`, затем `syncStakeSnapshot` с той же суммой в снимке — `stake_settled` должен остаться равным сумме (сейчас удваивается);
  3. `prepareClaimPrize` не должен выдавать транзакцию для актива и котла с нулевым `owed`.

Фикстурный живой порт — `packages/chainport/src/rpc/fixture.ts`; как подменить сеть — `w10.test.ts` (`book`, `rows`).

**Гейт.** `npx vitest run services/api/test/x0.test.ts` — зелёный (все три `it.fails` действительно падают внутри). По мере закрытия X4, X7, X11 соответствующий `it.fails` переводится в `it` и должен стать зелёным.

### X1 — контракты

Перед правкой: `python -c "import json;print(json.load(open('content/params/launch.json',encoding='utf-8'))['deployed'])"`. Непусто — стоп.

Файлы: `contracts/src/StakeRegistry.sol`, `contracts/src/Vault.sol`, `contracts/src/PrizeTreasury.sol`, `contracts/script/PlayerReady.s.sol`, тесты `contracts/test/P3.t.sol`, `L7.t.sol`, `M5.t.sol`, новый `contracts/test/X1.t.sol`.

**StakeRegistry.**
- Конструктор: `constructor(address owner_, uint256 unstakeCooldownS_)`, `require(unstakeCooldownS_ > 0)`, `uint256 public immutable unstakeCooldownS`.
- Удалить `unstake(ticker, amount)`. Мгновенного пути нет.
- `struct Cooling { uint256 amount; uint256 readyAtS; }`, `mapping(address => mapping(bytes32 => Cooling)) public coolingOf`.
- `requestUnstake(string ticker, uint256 amount)`: `amount > 0`, `amountOf[msg.sender][key] >= amount`; `amountOf -= amount`. Если бакет созрел (`amount > 0 && block.timestamp >= readyAtS`) — сначала обнулить бакет и перевести его сумму `msg.sender`. Затем `bucket.amount += amount; bucket.readyAtS = block.timestamp + unstakeCooldownS`. Событие `UnstakeRequested(account, ticker, amount, readyAtS)`.
- `claimUnstaked(string ticker)`: бакет `amount > 0`, `block.timestamp >= readyAtS`; сначала обнулить, потом `transfer` (checks-effects-interactions). Событие `UnstakeClaimed(account, ticker, amount)`.
- `coolingSnapshot(address account) returns (string[] tickers, uint256[] amounts, uint256[] readyAtS)` — по тем же `_tickers[account]`, отсортировано как `snapshot`.
- `snapshot` не меняется: только активный стейк. Бакет в него **не входит**.

**Vault.**
- `uint8 constant OUTCOME_PRESENTED = 1; uint8 constant OUTCOME_RELEASED = 2;` `mapping(string => uint8) public outcomeOf`.
- `presentVoucher` ставит `outcomeOf[nonce] = OUTCOME_PRESENTED`, `releaseExpiredVoucher` — `OUTCOME_RELEASED`.
- События `VoucherIssued(nonce, account, corpAmount, issuedAtS)`, `VoucherPresented(nonce, account, corpAmount)`, `VoucherReleased(nonce)`.
- Порядок аргументов конструктора и логику покрытия (W8, `house`) не трогать.

**PrizeTreasury.**
- `slice(bytes32 batchId, address token, uint8 kettle, address[] players, uint256[] amounts)`; `mapping(bytes32 => bool) public batchUsed`; `require(!batchUsed[batchId])`, затем `batchUsed[batchId] = true`. Повтор той же пачки откатывается `"batch"`.
- Остальное не менять.

**PlayerReady.s.sol.** `new StakeRegistry(stakeOwner, vm.envUint("CORPORATOR_UNSTAKE_COOLDOWN_S"))`. Имя переменной окружения — из пака (X2), в `.env.example` оно попадёт через codegen.

**Тест `X1.t.sol`.**
- `claimUnstaked` за секунду до `readyAtS` откатывается, ровно в `readyAtS` проходит.
- Второй `claimUnstaked` откатывается.
- `requestUnstake(0)` и сумма больше стейка откатываются.
- `snapshot` после запроса не содержит суммы бакета.
- Созревший бакет выплачивается внутри нового `requestUnstake`, а новый бакет получает новый `readyAtS`.
- Несозревший бакет при новом запросе суммируется, а таймер перезапускается.
- Низкоуровневый вызов старого селектора `unstake(string,uint256)` откатывается.
- `outcomeOf` после предъявления — 1, после отпуска — 2; предъявить после отпуска нельзя.
- Повторный `slice` с тем же `batchId` откатывается.

**Атака.** Застейкать, запросить анстейк, в том же блоке `stake` снова и `requestUnstake` — выплат раньше срока нет. Перевод токена из бакета третьему лицу невозможен (функции нет).

### X2 — пак: числа, коды, действие, страж L399

Файлы: `content/params/economy.json`, `api.json`, `codes.json`, `screens.json`, `arch.json` (env), `content/build.py` (вывод `generated`), `content/lint.py`, `content/attack.py`, `content/codegen.py`, `docs/CONTENT.md` §5, §6.

**Параметры (каждый с `u`, `src`, `why`).**
- `economy.unstake_cooldown_city_days` = 30 (`u: city_days`, `src: docs/reports/TZ_WITHDRAW.md §2.1`). В `generated.api.unstake_cooldown_s` = `days × city_day_real_hours × SECONDS_PER_HOUR` (обе величины уже есть: `city_day_real_hours` в паке, `SECONDS_PER_HOUR` в `content/build.py`, вторых не заводить). Контроль: `2 700 000`, и то же число даёт `days × ticks_per_city_day × tick_length_real_seconds`. Разошлось — стоп.
- `api.voucher_expired_per_city_day_max` — сколько ваучеров одного города может истечь за сутки города, прежде чем `withdraw` откажет. Защищает газ сервера: выпуск и отпуск ваучера платит сервер. Значение предложить с обоснованием, владельцу назвать.
- `api.farm_slice_batch_max` — игроков в одной транзакции `slice`. Обоснование — газовый лимит блока сети, снять `eth_estimateGas` на фикстуре, не угадывать.

**Env.** `arch.secrets` / `arch.env`: `CORPORATOR_UNSTAKE_COOLDOWN_S` (не секрет, значение из пака). Codegen выписывает его в `deploy/.env.example` со значением `unstake_cooldown_s`.

**Коды** (`codes.json`, у каждого `http`, текст игроку честный, без обещаний суммы). Сначала проверить командой, нет ли уже подходящего:
- `VOUCHER_PENDING_SIGN` — ваучер ещё выпускается;
- `VOUCHER_PENDING` — у города уже есть неконечный ваучер;
- `VOUCHER_REJECTED` — сеть отказала в выпуске, Capital возвращён;
- `VOUCHER_EXPIRE_LIMIT` — достигнут `voucher_expired_per_city_day_max`;
- `UNSTAKE_COOLING` — токены ещё в отсрочке, в ответе `ready_at_s`;
- `UNSTAKE_NOTHING_PENDING`;
- `STAKE_LEDGER_LIVE` — на живом порте стейк только из кошелька;
- `FRAGMENT_SLICE_PENDING` — Farm начислен, но ещё не нарезан в казну;
- `PRIZE_NOTHING_OWED`;
- `EXCHANGE_DELIVERY_UNVERIFIED` — в чеке хопа нет перевода токена на кошелёк;
- `LEDGER_NOT_EMPTY_LIVE`.

Существующие `VOUCHER_EXPIRED`, `VAULT_EXIT_UNCOVERED`, `CHAIN_TX_UNCONFIRMED`, `WALLET_TX_REJECTED`, `SERVICE_DEGRADED` переиспользовать.

**Действие** `screens.json`: `district_claim_unstaked` — `screen: district_card`, `kind: button`, `label: UI_CLAIM_UNSTAKED`, `effect: commit:claim_unstaked`, `requires: ["wallet"]`, `spend: none`, `demo_blocked: 0`, `v1: live`, `src: docs/reports/TZ_WITHDRAW.md R-X-03`. Маршрут `/command/claim_unstaked` появляется codegen'ом. Руками `routes.ts` не трогать. Лейблы `UI_CLAIM_UNSTAKED`, `UI_UNSTAKE_COOLING` — там же, где остальные `UI_*`.

**L399.** `unstake_cooldown_s > unstake_grace_city_hours × tick_length_real_seconds / tick_length_city_hours`. Токены не должны выйти из отсрочки раньше, чем район замёрзнет: иначе одни и те же токены держат старый район в отсрочке и уже открывают район у второго кошелька. Плюс: значение `CORPORATOR_UNSTAKE_COOLDOWN_S` в сгенерированном `deploy/.env.example` равно `unstake_cooldown_s`.

**Атака L399** (`attack.py --only L399`):
- `unstake_cooldown_city_days = 1`: `90 000 s` против отсрочки `24 × 3750 = 90 000 s` — равенство, строгое `>` не проходит, L399 обязан упасть;
- `unstake_cooldown_city_days = 0` — L399 обязан упасть (и конструктор контракта откатил бы `0`);
- подменить значение в `.env.example` — L399 обязан упасть.

**Гейт.** `lint.py`, `build.py`, `codegen.py`, `attack.py --only L399`, и **полный** `python content/attack.py --jobs 8` — правился `lint.py`. `pack_version` 187 → 188, причина — `docs/CONTENT.md` §5.

### X3 — порт: чтения и данные, которых нет

Файлы: `packages/chainport/src/port.ts`, `values.ts`, `mock.ts`, `rpc/abi.ts`, `rpc/codec.ts`, `rpc/live.ts`, `rpc/index.ts`, `rpc/fixture.ts`.

- `ChainPort.latestBlockTime(): PortAmount` — `eth_getBlockByNumber("latest")`, поле `timestamp`. Это единственные часы для ваучера и отсрочки. Время сервера (`Date`) для сроков не использовать.
- `TxViewOk.logs: readonly { address; topics; data }[]` из `eth_getTransactionReceipt`. Нужен для проверки доставки биржи (X10).
- `CorpTokenPort.balanceOf(account, token?)` — как уже сделан `allowance`: без `token` — $CORP, с `token` — любой ERC-20 (Stock Token).
- `VaultPort.outcomeOf(nonce): PortAmount`, `VaultPort.releaseExpiredVoucher(nonce)` — роль `voucher` через `broadcastRoleTx`.
- `StakeRegistryPort`: убрать `unstake` (всех вызывающих найти командой `Select-String -Path services/*/src/*.ts,packages/*/src/*.ts,services/*/test/*.ts -Pattern 'stakeRegistry.unstake|dataUnstake'`); добавить `coolingSnapshot(account)` (строки `ticker`, `amount`, `readyAtS`). Данные для подписи игрока: `dataRequestUnstake(ticker, amount)`, `dataClaimUnstaked(ticker)`. Прежний `dataUnstake` удалить, чтобы им нельзя было собрать транзакцию.
- `PrizeTreasuryPort`: `owed(kettle, token, account)`, `unsliced(kettle, token)`; `slice` с первым аргументом `batchId` и через `broadcastRoleTx` роли `signer` (сейчас `prizeSlice` уходит `sendTx` без подписи роли).
- Селекторы в `abi.ts` — вычислить `keccak256` сигнатуры через `@corporator/engine`, тест сверяет каждый новый селектор с keccak, а не с вписанной строкой.
- Мок: те же методы; отсрочка в моке не нужна (R-X-04), `coolingSnapshot` возвращает пусто.
- На 2026-09-28 старый `unstake` вызывают `rpc/live.ts:327`, `rpc/fixture.ts:105`, тесты `packages/chainport/test/c4.test.ts:188` и `c10.test.ts:135` (паритет мок ↔ rpc). Тесты переводятся на `requestUnstake`; паритет не ослабляется.

**Тест** `packages/chainport/test/x3.test.ts`: селекторы; разбор `logs` из фикстурного чека; `balanceOf` с токеном идёт на адрес токена; `slice` без ключа роли — `SERVICE_DEGRADED`, а не неподписанная транзакция; `latestBlockTime` на тишине — ошибка, не ноль.

**Атака.** Чек без `logs` разбирается в пустой список, а не падает. `timestamp` в неверном формате даёт тишину, не `0n`.

### X4 — стейк: одна правда из сети

Файлы: `services/api/src/commit_districts.ts`, `commands.ts`, `project.ts`.

- На живом порте `executeStakeConfirm` **не** вызывает `creditStake`. После проверки чеков он читает `stakeRegistry.snapshot(wallet)` **до лока** и под локом применяет `applyChainRows`, ту же функцию, что синхронизация. Зачисление происходит в одном месте и идемпотентно по `stake_chain`.
- Ветка роста в `applyChainRows` обязана звать `settleStake` (снятие льда и открытие района на тир 1, `R-W-02`). Сейчас её зовёт только `applyStake`. Без этого перенос зачисления в сверку молча перестанет открывать район, а прямой стейк в контракт мимо HUD не открывает район и сегодня.
- Чек есть, а снимок сети ещё старый (нода отстаёт): `CHAIN_TX_UNCONFIRMED`, `retryable`. Такой ответ **не** пишется под ключ хеша (`chainTxKey`) и под ключ намерения, иначе повтор получит застывший отказ. Это правило действует для всех `confirm` этого ТЗ (X5, X6, X8, X10, X11).
- `applyChainRows` / `dropChainStake`. Если снижение в сети больше `stake_settled` (старое состояние), то `stake_settled[t] = chain[t]`, `stake_chain[t] = chain[t]`, код в журнал. Повторять отказ на каждой синхронизации запрещено. `tokens_held` на живом порте не трогать вообще: вычитание `held[ticker] - delta` в `dropChainStake` остаётся только для мока.
- `applyStake` с `source: "ledger"` на живом порте — `STAKE_LEDGER_LIVE`.
- Инвариант живого порта: после любой команды и синхронизации у кошелькового города `stake_settled[t] == stake_chain[t]` по каждому тикеру.

**Тест** `services/api/test/x4.test.ts`:
- `it.fails` №2 из X0 переходит в `it` и зелёный;
- синхронизация, запущенная **между** майнингом и `confirm`, не даёт двойного зачисления;
- стейк из кошелька до `S_min` открывает район на тир 1 и через `confirm`, и через одну только синхронизацию;
- отставший снимок даёт `retryable`, повтор после догона зачисляет ровно один раз;
- `source: "ledger"` на живом порте отказан, на моке работает как раньше.

**Атака.** Снимок сети упал до нуля при `stake_settled > 0` — район уходит в отсрочку по движковому правилу, а `stake_settled` не уходит в минус. Снимок вернул тикер, которого нет в паке, — строка пропускается, остальное применяется.

### X5 — анстейк на рецепте CS

Файлы: `commit_districts.ts`, `commands.ts`, `project.ts`.

На живом порте `unstake` = `prepare` → подпись игрока → `confirm`:

- **prepare.** Прочитать `snapshot(wallet)` до лока. Проверить `0 < amount ≤ chain[t]`. Вернуть одну транзакцию `requestUnstake(ticker, amount)` на `CORPORATOR_STAKE_REGISTRY` и `cooldown_s` из пака (для предупреждения в HUD). Если по тикеру уже есть несозревший бакет — добавить в ответ `restarts_timer: 1` и текущий `ready_at_s`.
- **confirm.** Сверить чек (`from` = кошелёк, `to`, `data`, `status = 1`). Прочитать `snapshot` и `coolingSnapshot` до лока. Под локом: `applyChainRows` (снижение идёт через `dropChainStake` → движковый `unstake` → отсрочка района по §4.5), `city.unstake_cooldown[t] = { amount, ready_at_s }` **из сети**, не вычисленное локально. `tokens_held` не меняется. Если запрос по пути выплатил созревший бакет (бакет в сети меньше, чем прежний плюс новый запрос), в журнал пишется `unstake_claimed` на разницу.
- Мок: `applyUnstake` как сейчас (R-X-04).

Проекция состояния: секция с `unstake_cooldown` по тикерам (сумма и `ready_at_s`), чтобы HUD восстанавливал её после перезагрузки.

**Тест** `services/api/test/x5.test.ts`:
- `prepare` отдаёт ровно `dataRequestUnstake`;
- `confirm` с чужим `data` — `API_MALFORMED`, стейк не изменился;
- после `confirm` район с остатком ниже `S_min` получает `district_freeze_until = city_time + 24`;
- `tokens_held` остался 0;
- повторный `confirm` тем же хешем отдаёт первый ответ.

**Атака.** Игрок снял стейк транзакцией мимо HUD (прямой вызов `requestUnstake`). Синхронизация приводит `stake_settled` к сети, а `unstake_cooldown` заполняется при следующей проекции. Двойного учёта нет.

### X6 — `claim_unstaked`: забрать токены после 30 суток

Файлы: `commit_districts.ts`, `commit.ts`, `commands.ts`, маршрут — из X2.

- **prepare.** До лока: `coolingSnapshot(wallet)` и `latestBlockTime()`. Бакета нет — `UNSTAKE_NOTHING_PENDING`. `now < readyAtS` — `UNSTAKE_COOLING` с `ready_at_s`. Иначе одна транзакция `claimUnstaked(ticker)`.
- **confirm.** Сверить чек. Прочитать `coolingSnapshot` до лока. Под локом удалить строку `unstake_cooldown[t]`, если в сети бакет пуст. Журнал: `unstake_claimed`, сумма из сети.
- Мок: `UNSTAKE_NOTHING_PENDING`.
- Демо: как все денежные команды — отказ.

**Тест** `services/api/test/x6.test.ts`: до срока — `UNSTAKE_COOLING`, транзакции нет; после срока — `prepared` с `dataClaimUnstaked`; после `confirm` строка ушла; второй `prepare` — `UNSTAKE_NOTHING_PENDING`.

**Атака.** Часы сервера впереди сети на сутки. `prepare` смотрит только `latestBlockTime`, поэтому транзакция, которая откатится, игроку не выдаётся.

### X7 — вывод $CORP: выпуск ваучера сервером

Файлы: `services/api/src/commit_bank.ts`, `commands.ts`, `project.ts` (проекция), `city_lock.ts` (если нужно для «после коммита»).

На живом порте `applyWithdraw`:

1. **До лока.** `latestBlockTime()`. Тишина — `SERVICE_DEGRADED`, ничего не списано.
2. **Под локом.** Отказы:
   - у города есть ваучер не в конечном статусе — `VOUCHER_PENDING`;
   - истёкших ваучеров за сутки города не меньше `voucher_expired_per_city_day_max` — `VOUCHER_EXPIRE_LIMIT`. Счётчик `city.vouchers_expired_day` растёт в X9 при статусе `expired` и сбрасывается вместе с дневными счётчиками банка (`resetDayCounters`), отдельных часов не заводить.

   Затем **все существующие проверки и формула без изменений**: часы, воскресенье, `capital`, курс, `corpOut`, `VAULT_EXIT_UNCOVERED`, дневной лимит и урезание суммы. Затем `authorize` (резерв лимита) и **без `present`**:
   - `city.capital -= amount`;
   - новая строка в `city.vouchers`: `{ id, nonce, capital: amount, corp, reservation_id: vid, issued_at_s, status: "signing" }`;
   - `corp_held`, `vault_corp`, `capital_outstanding`, `withdrawn_capital` не меняются.

   Коммит.
3. **После коммита.** `vault.issueVoucher({ nonce, account: wallet, corpAmount: corp, issuedAtS })` ролью `voucher`.
   - Чек `status = 1` → под локом `status: "open"`.
   - Откат: прочитать `issued(nonce)`. Пусто → под локом `status: "rejected"`, движковый `expire(state, city, vid)` (снимает резерв лимита), `city.capital += capital` (движковый `expire` Capital **не** возвращает, это делает API), код `VOUCHER_REJECTED` или `VAULT_EXIT_UNCOVERED`.
   - Тишина — строка остаётся `signing`, доводит сверщик (X9).

Правила:

- `nonce = keccak256(city_id ‖ ":" ‖ intent_id)` в hex. Не голый `intent_id`: `nonce` в Vault глобален на всех игроков.
- `issued_at_s` берётся из `latestBlockTime` (шаг 1), не из часов сервера.
- Ответ `withdraw`: `{ effect: "withdraw", phase: "voucher", voucher: { id, status, corp, expires_at_s } }`, где `expires_at_s = issued_at_s + voucher_ttl_s`. Подписи игрока на этом шаге нет. Ответ уходит после попытки выпуска, не дольше `chain_receipt_timeout_ms`. Не успели — статус `signing`, HUD ждёт по снимку.
- Проекция: секция ваучеров города (все неконечные плюс последний конечный), чтобы HUD после перезагрузки видел открытый ваучер.
- Мок: `applyWithdraw` как сейчас; `w25.test.ts` зелёный без правок.

**Тест** `services/api/test/x7.test.ts`:
- после вывода `capital` меньше, `corp_held` прежний, `capital_outstanding` прежний, `vault_corp` прежний;
- откат `issueVoucher` возвращает `capital` ровно один раз и снимает резерв (`reserved_day` прежний);
- второй `withdraw` при открытом ваучере — `VOUCHER_PENDING`;
- два города с одинаковым `intent_id` получают разные `nonce`;
- `it.fails` №1 из X0 переходит в `it`.

**Касса.** Прогнать 100 тиков с депозитами и выводами на фикстурном живом порте. На каждом тике `capital_outstanding ≤ vault_corp × capital_anchor` (`assertI1`).

**Атака.** Ни одна проверка банка не должна пропустить вывод, который раньше отказывался:
- вывод в воскресенье;
- вывод больше `capital`;
- вывод при пустом `vault_corp`.

В каждом случае `capital` не списан и транзакция не отправлена.

### X8 — `present_voucher` на рецепте CS

Файлы: `commit_bank.ts`, `commands.ts`.

- **prepare.** Найти строку ваучера города по `voucher_id`. До лока прочитать `latestBlockTime()`, `issued(nonce)`, `outcomeOf(nonce)`. Отказы:
  - `status: "signing"` — `VOUCHER_PENDING_SIGN`;
  - конечный статус — первый ответ по этому ваучеру;
  - `now > issued_at_s + voucher_ttl_s` — `VOUCHER_EXPIRED`, транзакции нет;
  - `issued` пуст — `VOUCHER_PENDING_SIGN`.

  Иначе одна транзакция `presentVoucher(nonce, wallet, corp, issued_at_s)` на `CORPORATOR_VAULT`.
- **confirm.** Сверить чек. До лока прочитать `outcomeOf(nonce)`, он должен быть `OUTCOME_PRESENTED`. Под локом **финализация** (одна функция, её же зовёт X9):
  - движковый `present(state, city, reservation_id)`;
  - `capital_outstanding -= capital`, `vault_corp -= corp`, `withdrawn_capital += capital` (город и `acc`);
  - `status: "presented"`.

  `corp_held` не трогается: $CORP уже в кошельке.
- Идемпотентность: по ключу хеша (`chainTxKey`) и по статусу строки. Второй `confirm` не финализирует второй раз. Чек есть, а `outcomeOf` ещё 0 (нода отстаёт) — `retryable`, под ключ не пишется (правило X4).
- Чек `presentVoucher` со `status = 0` (например, `cover`: vault опустел между выпуском и предъявлением) — `CHAIN_TX_UNCONFIRMED`. Ваучер остаётся `open`, игрок может повторить до срока. После срока его доводит X9, и Capital возвращается. Финализации без `OUTCOME_PRESENTED` нет.
- Часы банка и воскресенье при предъявлении не проверяются: их проверил выпуск, а срок ваучера — один час города.
- Мок: `applyPresentVoucher` как сейчас.

**Тест** `services/api/test/x8.test.ts`:
- `prepare` отдаёт ровно `dataPresentVoucher` с `issued_at_s` строки;
- после `confirm` `capital_outstanding` упал на `capital`, `vault_corp` — на `corp`, `corp_held` прежний;
- второй `confirm` ничего не меняет;
- `prepare` после срока — `VOUCHER_EXPIRED`.

**Атака.**
- Подложить в `confirm` хеш транзакции `presentVoucher` чужого ваучера — `API_MALFORMED` по `data`.
- `confirm` при `outcomeOf = RELEASED` — не финализирует. Ваучер доводит X9 как истёкший.

### X9 — сверщик ваучеров

Файлы: `services/api/src/scheduler.ts` (после коммита тика, неблокирующе), `commit_bank.ts` (финализация из X8, возврат из X7).

Каждый тик, вне тика и вне транзакции БД. Для каждой неконечной строки ваучера: до лока читать `latestBlockTime`, `issued(nonce)`, `outcomeOf(nonce)`, под локом писать.

| Статус | Сеть | Действие |
|---|---|---|
| `signing` | `issued` есть | `open` |
| `signing` | `outcomeOf = PRESENTED` | финализация X8 |
| `signing` | пусто, `now > issued_at_s + voucher_ttl_s` | `rejected`, возврат X7 |
| `open` | `outcomeOf = PRESENTED` | финализация X8 (игрок подписал, но не прислал `confirm`) |
| `open` | `outcomeOf = 0`, `now > issued_at_s + voucher_ttl_s` | `releaseExpiredVoucher(nonce)` ролью `voucher`; после чека снова читать `outcomeOf` |
| `open` | `outcomeOf = RELEASED` | `expired`: `expire` + `capital += capital`, код `VOUCHER_EXPIRED` |

Правила:

- Capital возвращается **только** при `outcomeOf = RELEASED` или при `rejected` с пустым `issued`. По времени без чтения сети — никогда.
- Сеть молчит — строка остаётся как есть, тик идёт дальше.
- Упавший сверщик не останавливает доход (`economy-determinism`: аттестация и сеть не блокируют).

**Тест** `services/api/test/x9.test.ts`:
- игрок предъявил без `confirm` — финализирован сверщиком ровно один раз;
- срок вышел — отпуск, Capital возвращён ровно один раз;
- гонка: сверщик отправил отпуск, а игрок успел предъявить (в фикстуре `outcomeOf = PRESENTED`) — финализация как предъявление, Capital не возвращается;
- сеть молчит три тика — ничего не изменилось, потом сеть вернулась — строка доведена.

**Атака.** Поставить `outcomeOf` в фикстуре так, чтобы сначала было `0`, а после отправки отпуска — `PRESENTED`. Двойной выплаты (Capital обратно и $CORP в кошельке) быть не должно.

### X10 — биржа кладёт Stock Tokens в кошелёк

Файлы: `services/api/src/commit_exchange.ts`, `commands.ts`.

На живом порте:

- **Гейт `buyGate`** не читает `corp_held`. До лока `corpToken.balanceOf(wallet)` — меньше суммы, тогда `NOT_ENOUGH_CORP`.
- **prepare.** Запрос хопу дополняется полем `recipient: wallet`. Ответ хопа, как сейчас, — `to`, `data`, `value`, `stock_out`. Если `allowance(wallet, to) < amount`, первой транзакцией идёт `approve(to, amount)` на $CORP (как `prepareStake`).
- **confirm.** Сверить чеки (`from`, `to`, `data`, `status`). В логах чека транзакции `buy` найти ERC-20 `Transfer` с адресом `CORPORATOR_STOCK_<T>`, `to = wallet`, `value > 0`. Нет — `EXCHANGE_DELIVERY_UNVERIFIED`, ничего не зачислено.

  Под локом: `tokens_held` **не** растёт, `corp_held` **не** списывается. Зеркало пула (`pool_eth`, `pool_corp` через `cpmmSellCorp`) обновляется как сейчас. В журнал `stock_bought` с суммой **из лога**, а не из котировки хопа.
- Стрижка `fragment_hop_haircut_bps` на живом порте не применяется (§2.1).
- Мок: `applyBuyStock` / `creditBuyStock` как сейчас.

**Тест** `services/api/test/x10.test.ts`:
- `corp_held = 0`, а в кошельке $CORP есть — покупка проходит;
- `corp_held > 0`, а кошелёк пуст — `NOT_ENOUGH_CORP`;
- чек без `Transfer` на кошелёк — `EXCHANGE_DELIVERY_UNVERIFIED`;
- `Transfer` на чужой адрес — `EXCHANGE_DELIVERY_UNVERIFIED`;
- после успеха `tokens_held` прежний.

**Атака.** Хоп вернул `recipient` = свой адрес. `confirm` не признаёт покупку. Игроку показывается честный код, где его $CORP, — у хопа. Это владельцу как риск хопа, не чинить на клиенте.

### X11 — Farm и месячный приз в кошелёк

Файлы: `services/api/src/commit_fragments.ts`, `commit_prize.ts`, `commands.ts`, `scheduler.ts`, новый `services/api/src/slicer.ts`.

**Нарезка Farm (сервер, вне тика).**
- Движок начисляет `fragment_owed` как сейчас (`settleCities`), детерминизм не трогать.
- После коммита тика или расчёта окна `slicer` для каждого тикера:
  1. собирает кошельковые города с `fragment_owed[t] > 0`;
  2. до лока читает `unsliced(FARM, token)`.
  3. `Σ ≤ bag` → под локом пишет пачку `{ batch_id, token, players, amounts, status: "sending" }` в состояние, коммит. После коммита `slice(batch_id, token, FARM, players, amounts)` ролью `signer`, пачками по `farm_slice_batch_max`. Чек `status = 1` → под локом `fragment_owed[t] -= amount`, `fragment_sliced[t] += amount`, пачка `sent`.
  4. `Σ > bag` → не резать ничего, код `FRAGMENT_POOL_EMPTY` в журнал и метрику. Пул расчёта и котёл в сети разошлись — это тревога, а не повод резать чужое.
- `batch_id = keccak256(token ‖ window_id ‖ index)`, детерминирован. Повтор после тишины безопасен: контракт откатит второй раз (`batchUsed`, X1).
- Режутся только кошельковые города. Доля демо-городов остаётся в котле ненарезанной и уходит боту `returnUnsettled` по действующему правилу `PrizeTreasury`.
- **Второго резчика FARM нет.** Строки `slices` с котлом FARM в конвейере байбека отклоняются (`services/buyback/src/conveyor.ts`, `kettleOk`). Котёл MONTH конвейер не меняет.
- **Бот не забирает котёл раньше нарезки.** `returnUnsettled` в контракте опустошает весь ненарезанный остаток в любой момент. Если бот вернёт котёл FARM до нарезки окна, игроки потеряют Farm этого окна. Конвейер принимает строку `returns` котла FARM только с `window_id`, для которого API уже записал пачки этого окна как `sent` (или записал «нечего резать»). Сейчас конвейер ставит флаг `sliced` только для своих нарезок, поэтому без этой правки он будет возвращать котёл вслепую. Канал «API → конвейер» для этого признака найти командой; нет канала — назвать владельцу и тест на каноническом батче (`createCannedConveyorSource`).
- Прежде чем писать `slicer`, найти командой, откуда на живом порте берётся пул расчёта (`state.fragment_pools`). На живом порте он должен равняться `unsliced(FARM, token)` из сети. Расходится — назвать владельцу, не подгонять.

**`claim_fragment` на рецепте CS (живой порт).**
- **prepare.** До лока `owed(FARM, token, wallet)` по шести токенам. Все нули, а `fragment_owed > 0` — `FRAGMENT_SLICE_PENDING`. Все нули и `fragment_owed = 0` — `FRAGMENT_NO_CLAIMS`. Иначе по транзакции `claimPrize(token, FARM)` только на токены с `owed > 0`.
- **confirm.** Сверить чеки. Под локом `fragment_sliced[t] → fragment_claimed[t]` по суммам из сети. `tokens_held` не растёт.
- Мок: `applyClaimFragment` как сейчас.

**`claim_prize` (месяц).**
- `prepareClaimPrize` строит транзакции **только** котла MONTH и **только** на токены с `owed(MONTH, token, wallet) > 0` (чтение до лока). Всё нули — `PRIZE_NOTHING_OWED`.
- Farm через `claim_prize` не забирается.
- Кнопка остаётся `refusal-only`, пока `launch.deployed` пуст.

**Тест** `services/api/test/x11.test.ts`:
- после расчёта окна `slice` отправлен один раз, повтор пачки не режет второй раз;
- `Σ > bag` — нарезки нет, `fragment_owed` прежний;
- `claim_fragment` до нарезки — `FRAGMENT_SLICE_PENDING`;
- после нарезки — `prepared` только с токенами `owed > 0`;
- `it.fails` №3 из X0 переходит в `it`;
- конвейер отклоняет строку `slices` котла FARM.

**Атака.**
- Город сменил кошелёк между расчётом и нарезкой. Резать на `city.wallet` в момент записи пачки. Смена кошелька у города запрещена существующей сессией — проверить командой, что это так, иначе назвать.
- Сеть подтвердила `slice`, но сервер упал до записи `sent`. Повтор той же пачки откатывается `batch`. Сервер по чтению `batchUsed(batch_id)` помечает пачку `sent` и вычитает `fragment_owed` ровно один раз.

### X12 — страж «на живом порте леджер не кастодиален»

Файлы: `services/api/src/commands.ts`, старт процесса API (`listen.ts` / `tick_host.ts`, найти командой), `services/api/test/x12.test.ts`.

- **Старт.** Порт `rpc`, и у кошелькового города `corp_held > 0`, любой `tokens_held[t] > 0` или `stake_settled[t] ≠ stake_chain[t]` (стейк из леджера, сделанный на моке) — процесс не стартует, `LEDGER_NOT_EMPTY_LIVE` (R-X-05).
- **После каждой команды на живом порте**, до коммита: у города команды `corp_held == 0`, все `tokens_held[t] == 0`, `stake_settled[t] == stake_chain[t]`. Нарушение — откат состояния (как при `WorldMoved`) и `SERVICE_DEGRADED` с записью в журнал. Молча не пропускать.
- Тест перечисляет **всех** писателей `corp_held` и `tokens_held`, найденных командой `Select-String -Path services/api/src/*.ts,packages/engine/src/*.ts -Pattern '"corp_held"|"tokens_held"'`. Для каждого пути на живом порте показывает, что страж не срабатывает на честном входе и срабатывает, если путь вернуть к старому поведению.

**Атака.** Временно вернуть в `creditBuyStock` зачисление `tokens_held` на живом порте. Страж обязан откатить команду. Вернуть обратно.

### X13 — HUD

Файлы: `apps/client/src/hud/screens/bank.tsx`, `district_card.tsx`, `exchange.tsx`, `topbar/WalletFlyout.tsx`, `LiveRoot.tsx`, `liveAdapter.ts`, `walletTx.ts`. Вид — `.cursor/rules/hud-visual.mdc` и `hud/design-reference/`, кабинетное правило 62%, списки через `FilterSelect`. Числа — из снимка и пака, литералов нет.

- **Банк.** После `withdraw` — карточка ваучера из секции снимка (не из памяти вкладки), по статусам:
  - `signing` — «ваучер выпускается», кнопка предъявления заблокирована с причиной;
  - `open` — сумма $CORP и срок до `expires_at_s` (по сетевым часам из снимка); кнопка запускает подпись `presentVoucher` через `runCsCommand`;
  - `presented` — «$CORP в кошельке»;
  - `expired` / `rejected` — «Capital возвращён» после сверки, до сверки — «ждём сверки».

  Предупреждение: предъявление стоит газа в ETH.
- **Карточка района.**
  - Снятие стейка: ввод суммы, затем подтверждение с текстом «токены вернутся в кошелёк не раньше чем через N суток, отмены нет». N — из пака. Если `restarts_timer` — «таймер уже идущей отсрочки начнётся заново для всей суммы».
  - Список `unstake_cooldown`: сумма, дата готовности. Кнопка `UI_CLAIM_UNSTAKED`: до срока заблокирована с `UNSTAKE_COOLING` и датой, после — подпись `claimUnstaked`.
- **Биржа.** После покупки — «токены в кошельке», сумма из ответа (из лога).
- **Farm.** `claim_fragment` на живом порте — подпись. `FRAGMENT_SLICE_PENDING` объясняет, что начисление ещё не передано в казну.
- **Кошелёк (flyout `$CORP`).** Балансы $CORP и шести Stock Tokens читает сервер (`balanceOf(account, token)`) и отдаёт в снимке; клиент их не считает. Нет данных — `—`, не `0`.
- **Строка `stocks` в `oracle.stock_price`** (`project.ts`) сейчас берёт `tokens_held`. На живом порте после X10 это всегда 0. Проекция на живом порте отдаёт баланс кошелька из сети, на моке — `tokens_held`, как сейчас. Иначе HUD покажет «0 токенов», когда они лежат в кошельке.
- `CHAIN_SIGN` в `LiveRoot.tsx` и `BY_INTENT` в `liveAdapter.ts`:
  - добавить `claim_unstaked` и `claim_fragment`;
  - `present_voucher` идти через `runCsCommand` с `phase: "prepare"`;
  - `withdraw` на живом порте — обычная команда без подписи игрока.

**Тест** `apps/client/test/x13.test.ts`:
- после перезагрузки снимка открытый ваучер виден;
- предъявление при `signing` не шлёт `eth_sendTransaction`;
- claim при `UNSTAKE_COOLING` не шлёт транзакцию;
- в тексте подтверждения анстейка есть число суток из пака, а не литерал;
- `hud_truth.test.ts` и `hud_workspace.test.ts` зелёные.

### X14 — документы

- `DESIGN.md` §4.5 — анстейк: запрос, отсрочка района 24 часа города как была, токены в контракте `unstake_cooldown_s`, забор в кошелёк; одна-две фразы.
- `DESIGN.md` §10 / §10.1 — статусы ваучера и сверщик.
- `docs/API.md` — `withdraw`, `present_voucher`, `unstake`, `claim_unstaked`, `claim_fragment`, `buy_stock` на живом порте.
- `docs/SCREENS.md` — новые коды и действие.
- `docs/CANON.md` — у `R-W-04` снять «в коде ещё нет», добавить `R-X-01`…`R-X-06` по одной строке.
- Публичная дока `docs/public/`:
  - `economy.md` «Vouchers» — снять `[NEEDS CONFIRMATION]`, описать ваучер и срок;
  - `industries.md` «Where your Stock Tokens are» — всё в кошельке или в контракте, анстейк 30 суток;
  - `seasons.md` — Farm забирается в кошелёк;
  - `reference.md` «Current version»;
  - `protocol.md` — таблица on-chain / off-chain.

  Числа — из пака.

### X15 — приёмка

Один проход **на фикстурном живом порте** (`rpc/fixture.ts`) и один на моке, командами, не глазами. Свежий кошелёк:

1. депозит → найм → несколько тиков;
2. вывод → `signing` → `open` → предъявление → $CORP в кошельке фикстуры, `capital_outstanding` и `vault_corp` упали;
3. второй вывод без предъявления → срок → сверщик → Capital вернулся ровно один раз;
4. покупка стока → токен в кошельке фикстуры, `tokens_held = 0`;
5. стейк из кошелька → район открыт → синхронизация дважды → стейк не удвоился;
6. анстейк ниже `S_min` → через 24 часа города район во льду → `claim_unstaked` до срока отказан → сдвинуть время фикстуры на `unstake_cooldown_s` → токены в кошельке;
7. окно Farm → нарезка → `claim_fragment` → токены в кошельке;
8. на каждом тике — `assertI1` и страж X12.

Полный гейт:

```
python content/lint.py
python content/build.py
python content/codegen.py
python content/attack.py --jobs 8
npx vitest run
```

Плюс CI `forge test --root contracts` зелёный. Мок-тесты `w25`, `h2`, `w10`, `w12` зелёные без ослабления.

---

## 6. Чем это ТЗ закрывает каждый выход ценности

| Путь | До | После | Задача |
|---|---|---|---|
| Capital → $CORP → кошелёк | на `corp_held`, в кошелёк никак | ваучер, игрок предъявляет | X7, X8, X9 |
| $CORP на `corp_held` | тратится только на бирже | на живом порте не существует (страж) | X12 |
| Stock с биржи | в `tokens_held`, физически неизвестно где | в кошельке, доставка проверена по логу | X10 |
| Stock из Farm | в `tokens_held`, в казне не нарезано | нарезка сервером, забор в кошелёк | X11 |
| Stock месячного приза | 12 слепых транзакций, почти все откатываются | только котёл MONTH и только `owed > 0` | X11 |
| Stock в стейке | мгновенно, в `tokens_held`, двойной учёт | 30 суток в контракте, потом в кошелёк | X1, X5, X6 |
| Стейк из кошелька | двойное зачисление после синхронизации | одна правда — снимок сети | X4 |
| Депозит, не доминченный | сервер повторяет минт (`settleServerMint`) | без изменений | — |
| Аварийный возврат | `refundPlayer` / `claimRefund` ≤ backing | без изменений | — |

---

## 7. Атаки на саму конструкцию — проверены при написании

Каждая строка — вход, который должен сломать ТЗ, и место, где это закрыто. Исполнитель повторяет их тестами в указанных задачах.

1. **Двойное предъявление ваучера.** Контракт: `used[nonce]`. Сервер: финализация по статусу строки и по ключу хеша. — X1, X8.
2. **Предъявил и не прислал `confirm`.** Сверщик финализирует по `outcomeOf`. — X9.
3. **Гонка «отпуск против предъявления».** Capital возвращается только при `outcomeOf = RELEASED`. Предъявление побеждает, если прошло первым. — X1, X9.
4. **Сервер упал между коммитом и `issueVoucher`.** Строка `signing`, `nonce` детерминирован, контракт не выпустит второй раз (`replay`). Сверщик читает `issued(nonce)`. — X7, X9.
5. **`issueVoucher` откатился по `cover`.** Capital и резерв лимита возвращаются ровно один раз. Движковый `expire` Capital не возвращает, это делает API явно. — X7.
6. **Коллизия `nonce` между городами.** `nonce = keccak(city_id ‖ ":" ‖ intent_id)`. — X7.
7. **Часы сервера врут.** Все сроки — по `latestBlockTime`, не по `Date`. — X3, X7, X8, X6.
8. **Два параллельных вывода.** Лок плюс «один неконечный ваучер на город» (`VOUCHER_PENDING`). — X7.
9. **Грифинг газа сервера:** выводить и не предъявлять, сервер платит выпуск и отпуск. Потолок `voucher_expired_per_city_day_max`. — X2, X7.
10. **Обход дневного лимита через истёкшие ваучеры.** `expire` снимает резерв, лимит считает только предъявленное. Истёкший не выводил денег — обхода нет. — X7, X9.
11. **I1 при открытом ваучере.** Capital списан с города, `capital_outstanding` прежний — строже, чем нужно. При предъявлении оба падают по той же формуле, что сейчас. 100 тиков в X7.
12. **Мгновенный анстейк старым селектором.** Функции нет, тест низкоуровневого вызова. — X1.
13. **Одни токены держат два района.** L399: отсрочка токенов строго больше отсрочки заморозки района. Стейк покидает счёт в момент запроса. — X2, X5.
14. **Флэш-стейк:** застейкать, открыть район, снять и перевести. Токены 30 суток в контракте, перевести нельзя. — X1.
15. **Двойное зачисление стейка.** `confirm` = та же сверка со снимком, идемпотентно по `stake_chain`. — X4.
16. **Вечный отказ `dropChainStake`.** Приведение к сети с кодом, без повтора отказа. — X4.
17. **Леджер на живом порте.** Страж старта и страж после команды. — X12.
18. **Хоп доставил не на кошелёк.** Покупка не признаётся без `Transfer` на кошелёк в логе. Риск хопа назван. — X10.
19. **Двойная нарезка Farm** (повтор после тишины или два резчика). `batchId` в контракте, один резчик, конвейер отклоняет FARM. — X1, X11.
20. **Нарезка сверх котла.** `Σ > bag` — не резать, тревога. — X11.
21. **Farm через `claim_prize`.** Только котёл MONTH. — X11.
22. **Транзакции с нулевым `owed`.** Не выдаются. — X11.
23. **Отмена анстейка и перезапуск таймера.** Отмены нет. Созревшее выплачивается первым, перезапуск объявлен в HUD до подписи. — X1, X5, X13.
24. **Мок сломан ради живого порта.** Ветка по `prizeCustodyLive(port)`, мок-тесты без ослабления. — все.
25. **Сеть молчит.** `prepare` отказывает `SERVICE_DEGRADED`, сверщики ждут, тик идёт. — X3, X9, X11.
26. **HUD потерял ваучер при перезагрузке.** Ваучер в снимке, не в памяти вкладки. — X7, X13.
27. **Демо-город.** Все денежные команды отказывают, как сейчас (`DEMO_NO_WITHDRAW`, `DEMO_NO_CLAIM`, `DEMO_NO_PRIZE`). — без изменений, проверить в X15.
28. **Перенос зачисления стейка в сверку перестал открывать район.** Ветка роста `applyChainRows` зовёт `settleStake`. — X4.
29. **Отставшая нода дала «нет изменений», и ответ застыл под ключом хеша.** Повторяемый ответ не пишется под ключ. — X4, X8.
30. **Бот вернул котёл FARM до нарезки.** Возврат FARM только после записанной нарезки окна. — X11.
31. **Стейк из леджера, сделанный на моке, попал на живой порт.** Страж старта сверяет `stake_settled` с `stake_chain`. — X12.
32. **Vault опустел между выпуском и предъявлением.** `presentVoucher` откатывается по `cover`, ваучер остаётся `open`, после срока Capital возвращается. Финализации без `OUTCOME_PRESENTED` нет. — X8, X9.
33. **HUD показывает 0 токенов, когда они в кошельке.** Строка `stocks` на живом порте — баланс кошелька из сети. — X13.
34. **Созревший бакет выплачен внутри нового запроса, а журнал молчит.** Разница бакета пишется как `unstake_claimed`. — X5.

---

## 8. Что это ТЗ не делает и что остаётся владельцу

- **Источник конвейера байбека** (`services/buyback/src/source.ts`) сейчас мок. Без реального источника котёл FARM в сети не наполняется, и `claim_fragment` честно отвечает `FRAGMENT_POOL_EMPTY` или `FRAGMENT_SLICE_PENDING`. Месяц отвечает `PRIZE_NOTHING_OWED`. Запуск токена источник не переключает. Это не вывод: исполнение — `docs/reports/TZ_BUYBACK.md`, задачи `B0`…`B6`. Здесь их не делать.
- **Котёл меньше расчёта Farm** (`Σ > bag`). Решено 2026-09-28 (§2.1): ждать. ТЗ не режет ничего и поднимает тревогу. Игрок видит `FRAGMENT_SLICE_PENDING`, пока котёл не догонит.
- **Застрявший `pending` в Vault.** Решено 2026-09-28 (§2.1): оставить. Сервер повторяет минт (`settleServerMint`). `reclaimPending` не добавлять: игра уже могла зачислить Capital, и возврат `pending` сломал бы I1.
- **Газ игрока в ETH** на предъявление и заборы. Решено 2026-09-28 (§2.1): платит игрок, спонсора нет.
- **Хоп** — внешний сервис. Контракт «доставить на `recipient`» — его ответственность, ТЗ только проверяет факт.
- Не деплоить, не подписывать `launchToken`, не включать `claim_prize` до заполненного `launch.deployed`.
