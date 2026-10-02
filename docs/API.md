# Контракт API

Канон REST и WebSocket Corporator. Механика — `DESIGN.md`. Экраны — `docs/SCREENS.md`. Хосты — `docs/ARCHITECTURE.md`. Командная поверхность **выводится** из `screens.json`, не проектируется.

Широкие таблицы — маркеры `<!-- GEN:... -->`, секции пака «T12: …», команда `python content/build.py`.

---

## §1. Конверт

Каждый ответ несёт `city_time`, `tick_index` (производный), `pack_hash`, `rules_version`. Клиент с другим паком узнаёт это из конверта.

Отказ на действие игрока — HTTP `409`, тело `{code, slots, city_time}`. Текста на проводе нет: код плюс подстановки, текст рендерит клиент из `content/strings/ru.json`. Поле `message` запрещено. `L248`.

Транспортные коды — категория `transport` в `codes.json`. Ни один не `idle`, ни один не в `requires` элемента, ни один не `DecisionRecord.reason`. `L247`. `RENDER_NO_GPU` — код состояния клиента (нет WebGL), не транспорт и не reason записи.

---

## §2. Команды

Множество `POST /command/X` ≡ множество различных `commit:*` в `screens.json` плюс синтетика осей research (`commit:research_start`, `L161`). Биекция в обе стороны. Ручной список путей запрещён. `L232`. `derived.command_endpoints`. `commit:build` / `POST /command/build` в проводе ещё несут `build_place` (`R-V-55`, долг `docs/archive/plans/PLAN_ISLAND.md` §5): посадка лот-плитки на пустой тайл. Живой канон — свободный авторский якорь (`R-V-100`). Вода, берег, дорога и занятый лот — `BUILD_TILE_ILLEGAL`.

Заглушка `v1 = stub` отвечает `FEATURE_NOT_IN_V1` и ничего не меняет: `spend = none`. `L234`.

`screen_id` не встречается ни в одном пути. Эндпоинтов «на экран» нет. `L235`.

<!-- GEN:api.endpoints -->

Каждая мутирующая команда несёт `intent_id` и `expected_city_time`. Повтор отдаёт **байты первого ответа** (тот же HTTP). Команды одного города сериализуются в процессе. Реплика без аренды `tick_locks` отвечает `SERVICE_DEGRADED` и **не** пишет intent; повтор уже сохранённого intent отдаётся. Устаревшая `expected_city_time` — отказ. `L249`.

Лимит команд выводится: `2 × slots_cap`, не хранится. `L250`.

`commit:claim_prize` отвечает по каждому активу корзины (`prize_assets`): атомы на тикер, не одно число `$CORP`. Перевод на цепи — `PrizeTreasury.claimPrize`, только если RPC и адреса контрактов заданы (`selectApiPort`); иначе `paid` не выдаётся как кастодиал (`PRIZE_CLAIM_UNCOVERED`). Срезка доли — `PRIZE_SHARE_CAPPED[cap]`. `seasons.prize_basket` живёт в канале aggregate; ETH в пути, `$CORP` vault и ETH студии — в канале price. Нового канала нет. `seasons.influence_rank` отдаёт живой `board` всех не-демо кошельков и отдельно `prize_board` — Zipf топ-N приза периода (`zipfPayout` движка, пул `treasury_leaderboard_eth`). Демо в строки не входит.

`commit:open_district` берёт `district_id` (роль пака) или `ticker`; стейк сравнивается с замороженным `s_min`; демо — `WALLET_NOT_CONNECTED`. `corp_held > 0` — гейт, не списание: hop `$CORP` — `buy_stock`.

`commit:stake` переносит Stock Token в `stake_settled`. `source: "ledger"` (и запрос без `source`) на мок-порте списывает `tokens_held`, сеть не вызывается; на живом порте это `STAKE_LEDGER_LIVE`. `source: "wallet"` на живом порте идёт `prepare`/`confirm`: `approve` реестра, только если allowance токена меньше суммы, и `stake(account, ticker, amount)`. `confirm` не считает сумму сам: после чеков он применяет `stakeRegistry.snapshot`, ту же сверку, что синхронизация, идемпотентно по `stake_chain`, и не трогает `tokens_held`. Чек есть, а снимок ещё старый — `CHAIN_TX_UNCONFIRMED` с `retryable`, и этот ответ не пишется под ключ. Повтор того же хеша не удваивает стейк. Нехватка до кратности — `STAKE_MULT_SHORT`. Падение снимка ниже `stake_settled` идёт через движковый `unstake` (отсрочка района); на живом порте `tokens_held` не меняется. В `oracle.stock_price` у строки тикера поле `stocks` на моке — `tokens_held`; на живом порте — `balanceOf` кошелька, а пропуск чтения поле опускает.

`commit:unstake` на мок-порте по-прежнему сразу зовёт движковый `unstake` (`stake_settled` → `tokens_held`, отсрочка района). На живом порте это `prepare`/`confirm`: одна транзакция `requestUnstake(ticker, amount)` на реестр, в ответе `cooldown_s` из пака, а если бакет тикера ещё не созрел по `latestBlockTime` — `restarts_timer` и текущий `ready_at_s`. `confirm` сверяет чек и применяет `snapshot` и `coolingSnapshot`: стейк падает через тот же движковый `unstake`, `unstake_cooldown` пишется из сети, `tokens_held` не меняется. Созревший бакет, выплаченный внутри запроса, даёт `unstake_claimed` на разницу. Отставший снимок — `CHAIN_TX_UNCONFIRMED` с `retryable`, под ключ не пишется. Снимок состояния кладёт `unstake_cooldown` в `tick.building_level`.

`commit:claim_unstaked` на мок-порте отвечает `UNSTAKE_NOTHING_PENDING`. На живом порте `prepare` читает `coolingSnapshot` и `latestBlockTime`: бакета нет — `UNSTAKE_NOTHING_PENDING`, `now < readyAtS` — `UNSTAKE_COOLING` с `ready_at_s` и без транзакции, иначе одна `claimUnstaked(ticker)`. `confirm` снимает строку `unstake_cooldown`, когда в сети бакета уже нет, и пишет `unstake_claimed` на сумму из сети. Бакет ещё на снимке — `CHAIN_TX_UNCONFIRMED` с `retryable`, под ключ не пишется. Демо — `DEMO_NO_CLAIM`.

`commit:unlock_tier` открывает следующий тир района по `generated.progression.tier_gates` и `tier_cost`; тир 1 стоит 0. Закрытый район — `DISTRICT_LOCKED`; потолок тиров — `TIER_NOT_UNLOCKED`.

`commit:pick_node` берёт `node_id` из `generated.progression.progression_nodes`; exclusive-пара без респека — `NODE_SIDE_LOCKED`; тир ниже узла — `TIER_NOT_UNLOCKED`.

`commit:merge` берёт `merge_id` из `generated.progression.progression_merges` (или пару районов); оба района открыты и тира ≥ `merge_min_tier`; величина эффекта — как в паке (`C-20` не выравнивать); активные merge — паросочетание, иначе `MERGE_MATCHING_BLOCKED`; стоимость — `generated.progression.merge_cost`. Респека нет.

`commit:upgrade` берёт `building_id`, списывает `generated.balance.level_cost` следующего уровня (та же таблица, что `build` для L1). Предпостроенный `city_hall` и неактивированная функция — `CITY_LEVEL_TOO_LOW`; заморозка — `DISTRICT_FROZEN`; потолок `building_level_max` — `TIER_NOT_UNLOCKED`. `body.level` игнорируется: только current+1.

`commit:claim_fragment` на моке платит `fragment_owed` в `tokens_held`. Если окно due — сначала `settleCities` по всем городам с леджером/пулом (`windowSettleDue`, длина окна — `fragment_window_city_days`, не горизонт фонда). Демо — `DEMO_NO_CLAIM`. Пустой пул — `FRAGMENT_POOL_EMPTY` (леджер сгорает). Нечего платить — `FRAGMENT_NO_CLAIMS` (пул не трогать). На живом порте это подпись игрока: `prepare` читает `owed(FARM)` до лока и собирает `claimPrize` только на тикеры с суммой > 0; все нули при живом `fragment_owed` — `FRAGMENT_SLICE_PENDING`, при нуле и в городе — `FRAGMENT_NO_CLAIMS`. `confirm` переносит `fragment_sliced` в `fragment_claimed` и не увеличивает `tokens_held`. Нарезка FARM (`sliceFarm`) идёт после коммита тика, вне транзакции: пачка `keccak256` от адреса токена, id окна и индекса через NUL; `sent` только когда `batchUsed` истинен. `Σ owed` кошельков больше `unsliced(FARM)` — `FRAGMENT_POOL_EMPTY`, без нарезки. `commit:claim_prize` готовит только котёл MONTH и только тикеры с `owed > 0`; все нули — `PRIZE_NOTHING_OWED`.

`commit:deposit` берёт `amount` в $CORP, зовёт `mintFromBacking` (сбор vault из пака, dest — город, не фонд). Мок/оффчейн списывает `corp_held` и отвечает `phase: "applied"`. Живой RPC не шлёт `vault.deposit`: `phase: "prepare"` проверяет кошелёк, сумму и `mint_rate`, ничего не пишет в город и возвращает `approve` (только если allowance меньше суммы) и `deposit`. `phase: "confirm"` до лока сверяет рецепт по хешам, затем минтит. Повтор того же хеша отдаёт первый ответ. `vault.mintCapital` остаётся серверным (повтор одного вызова; неуспех пишет `chain_mint_capital`). `mint_rate = 0` — `STALE_PRICE`. Кошелёк — `WALLET_NOT_CONNECTED`; нехватка на моке — `NOT_ENOUGH_CORP`. Часы банка депозит не режут.

`commit:withdraw` на мок-порте берёт `amount` Capital, проверяет демо/кошелёк/часы/лимит, затем `authorize` и `present`: $CORP выходит из vault в `corp_held` по `bank_markup_bps`, не по полу Trader. На живом порте игрок не подписывает. До лока читается `latestBlockTime` (тишина — `SERVICE_DEGRADED`). Под локом неконечный ваучер даёт `VOUCHER_PENDING`, потолок истёкших за сутки города — `VOUCHER_EXPIRE_LIMIT`; дальше те же проверки банка. `authorize` без `present` списывает Capital и пишет ваучер `signing`. `corp_held`, `vault_corp`, `capital_outstanding` и `withdrawn_capital` на этом шаге не меняются. После коммита роль `voucher` вызывает `issueVoucher`. Чек успешен — `open`. Откат при пустом `issued` ставит `rejected`, снимает резерв и возвращает Capital один раз (`VOUCHER_REJECTED` или `VAULT_EXIT_UNCOVERED`). Тишина оставляет `signing`. Ответ `{ effect: "withdraw", phase: "voucher", voucher: { id, status, corp, expires_at_s } }`, `expires_at_s = issued_at_s + voucher_ttl_s`, `issued_at_s` — время блока. Тиковый `bankWithdraw`/`withdraw_intent` не зовётся (`C-22`).

`commit:present_voucher` на мок-порте только подтверждает уже settled резерв и не двигает балансы второй раз. На живом порте это рецепт: `prepare` отдаёт одну `presentVoucher` на `CORPORATOR_VAULT` с `issued_at_s` строки; `confirm` после чека и `outcomeOf = presented` финализирует — `present` резерва, `capital_outstanding` и `vault_corp` падают, `withdrawn_capital` растёт, `corp_held` не меняется, строка `presented`. Часы банка при предъявлении не проверяются. Чек со `status = 0` и отстающий `outcomeOf = 0` — `CHAIN_TX_UNCONFIRMED` (отставание `retryable`, под ключ хеша не пишется). `outcomeOf = released` не финализирует.

Сверщик ваучеров читает сеть после коммита тика. `signing` с непустым `issued` становится `open`. `outcomeOf = presented` финализирует тем же путём, что `confirm`. Пустой `signing` после срока становится `rejected`, Capital возвращается. `open` после срока вызывает `releaseExpiredVoucher`; Capital возвращается, когда повторное чтение даёт `released`, и строка становится `expired` (счётчик `vouchers_expired_day`). Пока чтение сети молчит, строка ждёт. Мок-порт этот проход пропускает.

`commit:buy_stock` берёт `ticker` и `amount` $CORP. Мок списывает `corp_held` и зачисляет `tokens_held` со стрижкой hop; сток не минтится. На живом порте касса не читается: до лока `balanceOf` кошелька (`NOT_ENOUGH_CORP`, сеть молчит — `SERVICE_DEGRADED`). Hop POST несёт `recipient` = кошелёк. Если `allowance` на hop меньше суммы, первая транзакция — `approve` на `CORPORATOR_CORP_TOKEN`. Confirm принимает только `ERC-20` `Transfer` `CORPORATOR_STOCK_<T>` на кошелёк с `value > 0`; иначе `EXCHANGE_DELIVERY_UNVERIFIED`, касса и пул не двигаются. Успех не трогает `corp_held` и `tokens_held`, двигает зеркало пула и пишет в журнал сумму из лога, без стрижки. Нет `to`/`data`/`value` — `EXCHANGE_HOP_UNAVAILABLE`. `claim_prize` на клиенте `live`, когда все пять строк `launch.deployed` заполнены; до этого `refusal-only`.

---

## §3. Чтение и REST/WebSocket

`GET /city/{city_id}/state` отдаёт снимок из `state_sources`: каждый источник — ровно одна секция. Экран — забота клиента. Контракт REST и WebSocket — этот документ. Клиент подписан на `WS /city/{city_id}/ws`: пульс — живость, патч класса частоты не перечитывает весь снимок, часов на сокете нет. После тика API публикует по одному кадру `{ channel, sections }` на класс частоты, не полный конверт. При старте состояние мира поднимается из ряда `cities` с ключом `world`; если его нет — из прежнего ряда первого города; иначе из последнего снимка и `tick_inputs`. Писатель пишет `cities` в той же транзакции, что intent после команды и что `tick_inputs` после тика. Планировщик зовёт `catchUp`: догон ≡ реплей, оффлайн срезается `offline_hard_cap` из пака. Секция `log.events` — `{ rows }` с бейджем, корнем и CID; Verified только когда оба поля непусты. Агрегаты, здания, агенты, оракул, сезоны, фрагменты и стейк проецирует `projectState` из движка; `wallet.chain` и `wallet.corp_balance` заполняются чтением сети на живом порте; тишина чтения ставит `wallet.corp_known` в ноль и не подставляет `corp_held`. Без живого порта секция баланса пустая. `aggregate.payroll_boost_bps` и `aggregate.payroll_boost_days_left` считает движок (`payrollBoostBps` / `payrollBoostDaysLeft` по `tick_index`, не `state.day`); клиент их не выводит. После окна `days_left` = 0. Аттестатор берёт живой RPC, когда заданы `CORPORATOR_RPC_URL` и валидные адреса контрактов (`readPlayerReady`); иначе мок. Корни минуты и CID суток пишутся в `attest_roots` той же миграции, что api. API клейма приза зовёт `PrizeTreasury` тем же правилом env; мок не считается выдачей.

<!-- GEN:api.snapshot -->

`GET /pack/{pack_hash}` отдаёт неизменяемый `content/out/pack.json`. Кеш — `immutable`. Клиент грузит этот пак, затем `GET /city/{city_id}/state`; без `city_time` в конверте экономического HUD нет. Адрес API — `VITE_CORPORATOR_API_ORIGIN`, если переменная непустая, иначе bind из пака. Снимок и сокет несут сессию: Node шлёт `Authorization`, браузер предлагает подпротокол `Bearer.<session_id>`, сервер читает его как тот же bearer. Часы держат якорь снимка и сбрасывают его на каждый новый снимок. Если за `client_resync_ticks` тиков сокет молчал, клиент запрашивает снимок снова.

`GET /ready` отдаёт `pack_hash` и `migration_version` в том же конверте и наблюдения метрик с `observe_src`; ни одно не равно порогу пака. Реплика без блокировки тика отвечает на GET и не шагает город.

`GET /rating` не требует сессии. В том же конверте поле `rows` — живая доска `seasons.influence_rank`: один ряд на кошелёк, без демо, без обрезки топ-N, порядок Influence, затем Day GDP (`gdp`), затем меньший `city_id`. `self` здесь всегда 0: у запроса нет кошелька зрителя. Снимок города по-прежнему требует сессию.

---

## §4. Каналы

Пять классов частот экранного/API-контракта, ни одного шестого. Канала часов нет:
часы и плашка банка считаются локально. Каждый `state_source` — ровно один канал.
Экономический источник `source = server`. Каденция канала цен равна периоду сэмплера,
не хранится. `L236` `L237` `L238`.

<!-- GEN:api.channels -->

Пульс сокета — `ws_heartbeat_s`: три пульса внутри одного сэмпла. Путь сокета — `path_rules.ws`.

---

## §5. Коды и HTTP

Домен: отказ игрока — `409` и код из `idle`/`refusal`/`state`. Транспорт: закрытый набор из шести кодов, HTTP на самом коде.

<!-- GEN:api.http -->

`L247` `L248`. Коды ошибок на проводе не дублируют `codes.json`.

---

## §6. Идемпотентность и пакет

`intent_id` уникален у клиента. Сервер хранит `(city_id, intent_id) → результат`. Версионирование пака — `docs/CONTENT.md` §5: опубликованный пак не мутирует, сверка `pack_hash` падает закрыто. Вход тика читает последний по `city_time` образец `price_samples`: `eth_usd_8dec`, `corp_eth_wei_per_whole` и оборот этой строки, если образец не старше `price_staleness_max_city_hours`. Старше, нулевая цена, пустая таблица или ошибка чтения — `feed_live = 0` и оборот 0; сид пака остаётся запасной ценой. Сэмплер пишет эту таблицу в Postgres API; молчание `eth_getLogs` строку не пишет. В `tick_inputs` он не пишет.

Срок ваучера банка выводится из длины тика. `L258`.

POST байбека на его `ready` с пустым телом остаётся `SERVICE_DEGRADED`: депозита нет. Кадр с долями, спросом и глубинами, без филлов, запускает хоп; в котёл пишется только `stock_out` после лога `Transfer` на исполнителя. Тик этот POST не ждёт.

---

## §7. Идентичность

Пак и ready читает кто угодно. Снимок города и сокет требуют ту же сессию, что команда. Пишет только владелец: мутация несёт сессию в `Authorization`, `city_id` берётся из сессии, не из тела. TTL сессии и nonce — производные `session_ttl_s` и `nonce_ttl_s`. Нет сессии — `API_UNAUTHORIZED`.
