# Тик и аттестация

Канон движка Corporator. Механика экономики — `DESIGN.md`. Интерфейс — `HUD.md`. Порядок шагов T3 — `docs/SIMULATION.md` §1. Стадии модификаторов — `docs/PROGRESSION.md` `T5.2`. Фрагменты и сезоны — `docs/PRIZES.md`.  Догон на экране — `docs/SCREENS.md` §5. Парки как счётчик — `docs/WORLD.md` `R-T10-1`. Числа баланса — `docs/BALANCE.md` и `content/out/GENERATED.md`, не копия.

Широкие таблицы — маркеры `<!-- GEN:... -->`, секции пака «T11: …», команда `python content/build.py`. Ни одного голого двухзначного литерала вне бэктиков, GEN и ссылок.

Инвентарь BRIEF §6 T11 — `content/fixtures/brief_t11_tick.json`. Покрытие — `L224`. Пункты: `step_order` §3 `L206 L212 derived.day_boundary_contours`; `tick_signature` §2 `tick(state, inputs) -> (state, records)`; `integer_math` §4 `L209 L210 derived.remainder_sinks`; `prng_hash` §5 `D11 derived.tick_prng_streams L223`; `decision_record` §8 `L196 L197 L198 L199 L200 derived.record_fields`; `offline_catchup` §6 `D8 L214 catch_up`; `day_boundary` §6 `D4 L212 derived.day_boundary_contours`; `hour_six` §3 `D4 L213 efficiency_recalc_hour`; `price_as_input` §7 `D12 L208`; `ratchet_whole_days` §7 `D4 hour==0 apply_ratchet`; `stale_price_down` §7 `DESIGN.md §2.3 L29`; `zero_mints_zero` §7 `rate_raw_from_samples`; `batcher_minute` §9 `D1 L204 attest_root_period_s`; `root_contents` §9 `D2.1 D3 derived.merkle_leaf_order`; `ipfs_city_day` §9 `D1 L205 derived.ipfs_aggregate_key`; `gate_rpc_fail_open` §2 `D9 derived.attest_failure_mode`.

---

## 1. Назначение и границы

Тик — чистая функция одного часа города: записанные входы плюс состояние → новое состояние плюс запечатанные записи. Аттестация (дерево, CID, корень) живёт **снаружи** тика: после выплаты, асинхронно, неблокирующе (`DESIGN.md` §6.4).

Живой эталон — `content/tick.py`. Рантайм — `packages/engine` (T12 закрыт); байты записи с эталоном совпадают.

Снаружи тика и почему:

| что | почему снаружи |
|---|---|
| LLM (сводка, личность найма) | `DESIGN.md` §5.4: отказ → шаблон, экономика не замечает |
| сэмплер TWAP `$CORP` и ETH/USD | T12, `docs/ARCHITECTURE.md` §7; тик читает поля входа, не сеть (`DESIGN.md` §2.3, BRIEF T11) |
| конвейер выкупа как сервис | T12, `docs/ARCHITECTURE.md` §7; тик уже кладёт попавший ETH в `_buyback` |
| REST/WS, деплой | T12, `docs/API.md`, `docs/ARCHITECTURE.md` §9 |
| IPFS, RPC, гейт корня | отказ не стопит доход (D9) |

Планировка города во вход тика не входит (`docs/WORLD.md` §1). Мост — счётчики вроде `park_slots`.

---

## 2. Сигнатура и чистота

```
tick(state: dict, inputs: dict) -> tuple[dict, list[dict]]
```

BRIEF: `tick(state, inputs) -> (state, records)`.

`state` — экономика одного прогона (фонд, vault, города, `cfg`). Состав ключей T3-харнесса — `docs/archive/reports/T11_recon.md` §1.2; боевой город добавляет склады Energy/Compute, здания, агентов, леджер фрагментов, `nodes`, `park_slots`, кошелёк как **записанный** снимок, не RPC. Выводимое (`tick_index`, агрегаты) в params не кладётся.

`inputs` — записанные входы этого тика. Обязательные в боевом пути: `pack_hash`, `city_time` (или `tick_index` для харнесса, см. §6), TWAP-поля, `feed_live`, оборот DEX, `price_sample_city_time`, `stake_snapshot` (`wallet.stake_tokens`: стейк гейтит районы, без него реплей `DESIGN.md` §6.3 не сходится; `R-T11-12`). Харнесс T3 сегодня без `city_time` — тик выводит часы из `tick_index` (D5). Пустой `pack_hash` пропускает сверку только если ключа нет; ключ есть и не совпал → `PACK_HASH` (D9). `wallet.corp_balance` и `wallet.chain` во вход тика не входят (T12).

Возврат: новый `state` и список `DecisionRecord` layout v1. Заголовок тика (`TickInputHeader`) хост кладёт в дерево как лист `0`; чистая функция его считает, но не обязана класть в тот же список, что записи агентов — иначе верификатор путает типы листьев. Контракт: хост получает header из той же канонизации, что лист `0`.

Запрещено внутри `tick` и модулей записи/агрегатов на этом пути: вызов LLM; `random` без сида; системное время; сеть; диск; `float`, `Decimal`, `math` кроме целого `//`. Случайность — только `hash` стрима §5. Время — только `city_time` с сервера.

**Экономика падает закрыто. Аттестация падает открыто.** Несовпавший `pack_hash` — отказ считать. Упавший IPFS/RPC — выплата уже в `state`, записи в outbox, HUD `· logged` (`HUD.md` §5.3, §9). `derived.attest_failure_mode` — open. Ни одного `raise` аттестации внутрь тика.

---

## 3. Порядок шагов

Одиннадцать пунктов `docs/SIMULATION.md` §1 плюс два фактических шага, которых в списке нет (оборот DEX между курсом и бюджетом; проверка покрытия выхода между пробкой и `I11`), плюс ветка `06:00`. Не переставлять без правки этого раздела и major `rules_version`.

Канон агента `DESIGN.md` §5.3 (активность → входы → IDLE или списание → выход → payroll → запись) вкладывается в шаги 4–5 и `11б`. Стадии `base`/`post` — T5.2, вокруг проверки входов и до payroll (D6).

| # | шаг | читает | пишет | инвариант |
|---|---|---|---|---|
| 0 | I2 ставки входа дешевле выхода | `cfg` | — | L14; не живой курс |
| 1 | записанные входы, сверка пака | `inputs` | `tick_index` (вывод), коды | D9 `PACK_HASH` |
| 1б | часы | `city_time` / индекс, `cfg` якоря | `day`, `hour`, `weekday` | tick `0` = полдень дня `1` |
| 2 | курс минта | TWAP-вход, EMA, храповик | `mint_rate`, `STALE_PRICE` | §7; целые сутки на `hour==0` |
| 2б | оборот DEX | `dex_turnover_usd_8dec` | ETH казны | в SIMULATION §1 не назван; не выкидывать |
| 2в | ветка `06:00` | `efficiency_recalc_hour` | E районов, settle фрагментов; settle призов на границе периода | D4; не храповик |
| 3 | заморозка бюджета | `hour==0` или tick `0` | `day_budget`, `tick_budget` | внутри суток не пересчёт |
| 4 | запросы | расписание, склады/флаг energy, дрожь, T5 `base`/`post` на `city["nodes"]` | `request`, `idle` | пустой стек = `BPS`; когорта T3 без узлов |
| 5 | выплата | запросы, бюджет | Capital, `payroll_ratio_bps` | пропорция; остаток в фонде |
| 6 | траты | intent | burn/fund/protocol | пыль → protocol |
| 7 | банк | часы, глубина, `split_bank_limit` | вывод | воскресенье и ночь закрыты |
| 8 | выкуп | казна ETH | CORP → vault → фонд | транш снаружи как сервис T12 |
| 9 | капля virgin | неделя, спрос | фонд | cork потолок не расширяет |
| `10` | пробка + cork return | окно `30` суток | `reserve_cork` | неполное окно не коркует |
| `10б` | I7 покрытие | vault vs заявки выхода | `VAULT_EXIT_UNCOVERED` | не raise |
| `11а` | `I11` поток | acc | — | тождество кассы |
| `11б` | запись | выплаченное | `DecisionRecord` | сначала выплата, потом запись (`L206`) |

Ветка `06:00` стоит после курса и оборота, до запросов: новая efficiency действует на этот час. На `hour==0` шаг 2в — no-op. На `hour==6` шаг 3 — no-op. Час ветки — `efficiency_recalc_hour`, не литерал (`L213`).

Cork-канал, `I11` и `split_bank_limit` копируются из `docs/SIMULATION.md` §9, не изобретаются.

---

## 4. Целочисленная арифметика

Единственный примитив ставки — `pack.mul_bps(value, rate_bps) = value * rate_bps // BPS`. `BPS` — `content/pack.py`. Округление — floor к нулю на неотрицательных. Float на всём пути запрещён (`L10`, `L198`, `L209`).

Сплав T5 — один продукт с одним делением на ключ плюс финальное: `docs/PROGRESSION.md` T5.5, `build.apply_stack`. Второй сплав писать нельзя (D6).

<!-- GEN:tick.remainder_sinks -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: remainder sinks». Команда: `python content/build.py`.

| функция | `//` | смысл | сток остатка |
|---|---:|---|---|
| `_apply_spend` | `5` | burn / fund / protocol | protocol is the accounting residual |
| `_assert_i1` | `1` | vault coverage identity | slack floor stays unminted |
| `_assert_i2` | `2` | entry vs exit bps | identity remainder is not a second printer |
| `_bank_withdraw` | `14` | Capital to CORP at markup | wei dust stays as Capital |
| `_buyback` | `3` | ETH tax to CORP to vault | below buyback_min stays in treasury |
| `_check_term_clamp` | `1` | jobs / park_capacity fixture | test remainder, not a payout |
| `_collect_requests` | `6` | output chain x bps / BPS | per-step floor, not redistributed |
| `_cork_return` | `1` | cork extra to CORP | wei remainder unconverted |
| `_equal_weights` | `1` | BPS / 4 | test helper; pack holds the four params |
| `_fix_day_budget` | `2` | day_budget / ticks_day | remainder stays in the day budget |
| `_flush_week_drip` | `2` | week shortfall to CORP | wei remainder unconverted |
| `_fund_cap` | `1` | I7 coverage vs vault | uncovered remainder is the plaque |
| `_note_virgin_week_drain` | `1` | drained / week_start | remainder of the week share |
| `_pay` | `3` | ratio and payout | unpaid remainder stays in the fund; nobody zero while fund > 0 |
| `_recalc_efficiency` | `2` | `ema_24h` / `ema_30d` then k x delta | clamp eats the overshoot |
| `_reserve_drip` | `2` | virgin x drain_bps / BPS | unused room waits for next week |
| `_resolve_city_time` | `1` | tick_index from city_time | sub-tick hours refused as CITY_TIME |
| `_update_mint_rate` | `1` | mean of last ema_city_days samples | integer mean floor |
| `apply_dex_turnover` | `2` | tax usd to wei | dust stays in the quoted turnover |
| `catch_up` | `4` | city_time gap / tick length | prefix beyond cap is one gap record |
| `city_clock` | `1` | day from absolute hour | hour via modulo, not a second clock |
| `cpmm_buy_corp` | `1` | constant-product buy | wei dust in reserves |
| `cpmm_sell_corp` | `1` | constant-product sell | wei dust in reserves |
| `energy_term_bps` | `1` | stock / demand window | clamped remainder dropped |
| `exit_coverage_corp` | `1` | outstanding to CORP at markup | wei dust uncovered |
| `happiness_bps` | `1` | weighted term sum / BPS | clamped; remainder dropped |
| `housing_term_bps` | `1` | housing / population | clamped remainder dropped |
| `merkle_proof` | `1` | parent index / 2 | odd child is the unpaired leaf |
| `mint_from_backing` | `4` | vault deposit to Capital | fee and dust unminted |
| `parks_term_bps` | `1` | park slots / jobs | clamped remainder dropped |
| `pool_price_wei_per_whole` | `1` | ETH per whole $CORP | wei remainder in pool |
| `productivity_bps` | `1` | realized / nominal | gauge only, not a second fuse |
| `rate_raw_from_samples` | `2` | usd per capital unit | dust stays unminted |
| `split_bank_limit` | `1` | ask x cap / sum asks | floor, remainder undistributed |
| `tick` | `1` | I7 coverage bps | remainder of vault vs exit |
<!-- /GEN -->

Новый `//` без строки стока — `L210`. Ceil на экономическом пути — шов атаки (уже `L90` у фрагментов). `derived.remainder_sinks` — таблица выше.

---

## 5. PRNG и стримы

Канон движка: `sha256(msg).digest()[:8]` big-endian, `msg` из `D11`. Пустой стрим **опускает** суффикс `:{stream}`, иначе хвостовое двоеточие ломает записанные смены. Непустой стрим: `f"{city_id}:{tick_index}:{agent_id}:{stream}"`.

Дрожь смены — пустой стрим, `build.tick_jitter_bps`, `% span` — именованное исключение (`D10`, `exceptions.json`, `L223`). Новый код выборок — rejection sampling, как мир T10.

<!-- GEN:tick.prng_streams -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: prng streams». Команда: `python content/build.py`.

| id | stream | src |
|---|---|---|
| `jitter_legacy` | `(empty)` | DESIGN.md §5.3, `D11` |
<!-- /GEN -->

`derived.tick_prng_streams` — таблица выше.

---

## 6. Время

Личные часы — модель движка (`DESIGN.md` §3). `city_time` — записанный вход, часы города от anchor. `tick_index` выводится, не хранится (D5, `L211`).

Обратная совместимость харнесса: нет `city_time` → `city_time = city_time_at_tick0 + tick_index * tick_length_city_hours`. `city_time_at_tick0` не параметр: первый заход ставит понедельник `12:00` дня `1` (`time.anchor_*`).

Когорта T3 с общей фазой — тестовая проекция, `sim_cohort_shared_epoch` (D5, `R-T11-5`). Батчер D1 исходит из личных часов.

Два контура границы — D4. Часы банка `08`–`20`, воскресенье закрыт — `time.json`, `DESIGN.md` §3.2. Потолок оффлайна — база `offline_cap_city_hours_base`; тики считаются, не хранятся. Догон — шаг хоста `catch_up` плюс D8 (`L214`): `catch_up` = `min(elapsed, cap)` и одна gap-запись.

<!-- GEN:tick.day_boundary_contours -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: day-boundary contours». Команда: `python content/build.py`.

| контур | hour | события |
|---|---:|---|
| `midnight` | 0 | `payroll_budget_freeze`, `ema_step`, `mint_ratchet`, `stale_mint_decay`, `gdp_stability_close`, `virgin_week_boundary` |
| `efficiency_recalc` | 6 | `district_efficiency_recalc`, `fragment_settle`, `season_prize_settle` |
<!-- /GEN -->

`derived.day_boundary_contours` — таблица выше. Каждое событие ровно в одном контуре (`L212`).

Tick `0` = полдень дня `1`: первая заморозка бюджета в полдень, первая полночь на тике `12`. Anchor, не баг.

---

## 7. Цена как записанный вход

Контракт сэмплера (сервис — T12): TWAP по фиксированным шагам `city_time` пишется во вход вместе с `price_sample_city_time`. Тик не ходит наружу (`L208`). Спот нашего пула в минт не входит.

Храповик роста — целыми сутками на контуре полуночи, `D4 hour==0 apply_ratchet`, params `anchor_rise_max_bps_per_city_day`. Полоса и потолок — `docs/BALANCE.md` / `economy.json`, не копия. Деградация при молчании — только вниз, код `STALE_PRICE`, шаг `price_stale_decay_bps_per_city_day` (`DESIGN.md` §2.3 `L29`). Ноль в ответе → минт `0` (`rate_raw_from_samples`).

Сток оракула районов (efficiency) — другой контур: держим последнее + `ORACLE_STALE`, затем сход к нейтрали; не смешивать с минтом (recon §8.6).

Эндогенный ряд `corp_eth` в харнессе — сценарий рядом с замороженным, калибровка T3 не пересчитывается (`D12`, `R-T3-20`). Риск амплификации — `R-T11-13`, не правка ставок.

---

## 8. DecisionRecord layout v1 и заголовок

T11 **устанавливает** layout, не меняет его (D2). Миграции нет. Нулевые поля (в том числе `inputs.materials`) держатся, чтобы не мигрировать (CONTENT.md R2).

Множество ключей и типы, не порядок в литерале: `pack.canonical` сортирует ключи, разделители `,` `:`, UTF-8, без пробелов, без `null`, без float.

Отсутствующая причина — пустая строка. Отсутствующее здание — пустая строка. `pack_hash` в записи нет — в заголовке (`R-T11-3`).

`status`: `paid` \| `idle` \| `gap` \| `construction`. `reason`: код или `""`. `output` — Capital за тик. `stage_bps` — сплав `base`/`post`; пустой стек — `BPS`.

<!-- GEN:tick.record_fields -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: record fields». Команда: `python content/build.py`.

| поле | тип | v1 |
|---|---|---|
| `layout_version` | int | 1 |
| `city_id` | str |  |
| `tick_index` | int | derived from city_time |
| `city_time` | int | hours from anchor |
| `agent_id` | str |  |
| `building_id` | str | empty string if no shift |
| `objective` | str |  |
| `inputs` | object | compute,energy,materials; materials always 0 |
| `district_efficiency_bps` | int |  |
| `seed` | str | hex of `sha256` digest[:8] |
| `output` | int | Capital this tick |
| `payroll_ratio_bps` | int |  |
| `status` | str | paid\|idle\|gap\|construction |
| `reason` | str | idle code or empty string |
| `fragments_delta` | int | 0 when none accrue |
| `stage_bps` | object | base and post; empty stack is BPS |
<!-- /GEN -->

`derived.record_fields` — таблица выше. Заголовок `TickInputHeader` — лист `0` тика. Поля пака: `layout_version`, `city_id`, `tick_index`, `city_time`, `pack_hash`, `corp_eth_wei_per_whole`, `eth_usd_8dec`, `feed_live`, `dex_turnover_usd_8dec`, `price_sample_city_time`, `prev_state_hash`, `stake_snapshot`. Записи — листья `1`…n по `agent_id` UTF-8. Без заголовка реплей `DESIGN.md` §6.3 не из чего считать.

Имена: канон `output`, единица в `payroll_ratio_bps` / `district_efficiency_bps` (`R-T11-2`).

---

## 9. Аттестация

`keccak256` листьев, `sha256` пака (D3, докстринг `pack.pack_hash`). Реализация — `content/keccak.py`, без зависимостей. Ethereum keccak, не SHA3.

```
leaf = keccak256(domain_leaf || canonical_bytes)
node = keccak256(domain_node || left || right)   # позиционно
```

Доменные байты — params, не литералы. Нечётный уровень: последний узел поднимается как есть. Один лист: корень = лист. Дубликат узла запрещён. `derived.merkle_leaf_order`: header leaf `0`; records `1`..n sorted by `agent_id` UTF-8 bytes.

Батчер: все запечатанные тики всех городов за минуту стены → одно дерево → один корень (`attest_root_period_s`, `L204`). IPFS: один объект `derived.ipfs_aggregate_key` `(city_id, city_day)` (`L205`); CID в событии корня, который закрывает сутки города (тик этого города с `hour==0`). CID суток — канонические `{city_id, city_day, root}` и коды `attest.params.cid_*`. Хост зовёт аттестатор после COMMIT; отказ IPFS/RPC не откатывает выплату (`L349`). Реализация `rpc` пишет тот же hex, что локальный `merkleRoot`; отказ — `SERVICE_DEGRADED`, тик не ждёт.

Отказ IPFS/RPC: outbox, `attest_lag_ticks`, HUD `· logged`. Игрок кликает бейдж — proof и CID, когда слой включён (`HUD.md` §5.3).

<!-- GEN:tick.attest_params -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: attest params». Команда: `python content/build.py`.

| величина | значение | единица |
|---|---:|---|
| `attest_root_period_s` | `60` | seconds |
| `merkle_leaf_domain_byte` | 0 | count |
| `merkle_node_domain_byte` | 1 | count |
| `attest_roots_per_day` | `1440` | count |
| `tick_length_real_seconds` | `3750` | seconds |
<!-- /GEN -->

IPFS key `(city_id , city_day)`. header leaf `0`; records `1`..n sorted by `agent_id` UTF-8 bytes. open: payout already in state, records in outbox, HUD logged not Verified.

---

## §10. Публичная проверка

Открытый верификатор без цепочки пакетов (`DESIGN.md` §6.3):

1. merkle-proof записи и заголовка против корня в чейне (доменные префиксы, позиционные узлы);
2. прогон `tick` из заголовка (входы) и сверка `output` / байт записи.

Заголовок обязан быть листом: иначе шаг 2 не из чего запускать. Нужен пак с `pack_hash` заголовка: опубликованный пак не мутирует (`docs/CONTENT.md` §5). Старая смена находит свой пак по хешу, не по «последнему».

---

## §11. Агрегаты города

Чистые функции `content/aggregates.py`. Когорта T3 их не считает (нет зданий и складов) — граница харнесса.

**Productivity** — измерение цепочки выхода, не второй множитель (D7, `R-T11-9`): `realized * BPS // max(1, nominal)`.

**Happiness** — четыре члена `DESIGN.md` §8, веса из пака, сумма весов `BPS`, clamp `[0, BPS]`. Штраф к Productivity выключен: `happiness_penalty_live = 0`. Пороги HUD — params, не текст интерфейса (`R-T11-7`).

<!-- GEN:tick.happiness_weights -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: happiness weights». Команда: `python content/build.py`.

| член | вес bps |
|---|---:|
| `housing_bps` | `2500` |
| `parks_bps` | `2500` |
| `energy_bps` | `2500` |
| `payroll_bps` | `2500` |
<!-- /GEN -->

`park_capacity_jobs` `5`. `energy_buffer_ticks` `12`.

**Stability** — только `seasons.stability_bps`. **GDP/день** — `docs/PRIZES.md` §6.2. **Population** — `docs/BALANCE.md` §9. **Influence** — `docs/PRIZES.md` §6.2, тик зовёт `seasons.i_day`, не дублирует.

---

## §12. Проводка T5, фрагментов и сезонов

**T5.** `apply_stack` на `city["nodes"]`. Пустой стек — тождество `BPS`, полосы T2 не двигаются (D6, `R-T11-6` / `R-T5-12` наполовину). Стадии в порядке T5.2: `base` до проверки входов, `post` после выхода до payroll. Слот `productivity` в сплаве — тождество; измерение — §11.

**Фрагменты.** Начисление только если `fragments.tick_accrues` (валидный оплаченный маяк). База — gross до `payroll_ratio` (`DESIGN.md` §2.9, `docs/PRIZES.md`). Дельта в записи. Settlement в час `efficiency_recalc_hour`. Неоплаченный тик — дельта `0` (`L219`).

**Сезоны.** `I_day` на закрытии суток. Текущий pack имеет
`season_prizes_live = 1`: ранг и sizing призов включены, а фактическая
передача Stock Tokens всё равно требует внешнего custody/claim-провода
(`L220`, `docs/PRIZES.md`).



---

## §13. Версионирование

`pack_version` растёт при любой публикации. Текущий reference pack —
`138`, `rules_version` — `0.24.0`, `layout_version` — `1`. Исторические
значения конкретного шага не являются текущим pack.

Совместимое (minor): новая сущность, которой не было; текст без смены слотов; ключ, который никто не читает; обоснование.

Несовместимое (major): формула генератора; параметр, меняющий выход смен; порядок стадий; удаление/переименование ключа записи; смена `layout_version`.

Реплей старой смены: пак с хешем из заголовка тика. Новый пак старую смену не переоценивает.

`layout_version = 1` установлен. Поле с нулём с первого дня миграции не требует. Поле, добавленное в v2, потребует.

---

## §14. Расхождения `R-T11-*`

Пословные правки `DESIGN.md` / `HUD.md` этого шага помечены **внесено**. Одно-два предложения, не раздел целиком (`DESIGN.md` §12). `docs/CONTENT.md` этой зоной не правится.

### `R-T11-1` — период корня: час → минута; CID суток города

`DESIGN.md` §6.2. BRIEF уже помечал противоречие (таблица §2, T11). **Внесено** в `DESIGN.md` §6.2.

**Было:**

- Записи собираются в батч на сутки города на город.
- Лист = `keccak(канонические байты)`.
- Батчи всех городов за реальный час → одно дерево → **один корень в чейн раз в час**.
- Полные батчи в IPFS, CID в событии контракта.

**Стало:**

- Три оси разведены: период корня — минута стены; IPFS-агрегат — сутки **города**; дерево минуты группируется по стене, объект IPFS — по календарю города (`docs/TICK.md` §9).
- Батчер собирает все запечатанные тики всех городов за минуту реального времени → одно дерево → **один корень в чейн раз в минуту**.
- Полные записи суток города — один объект IPFS на `(city_id, city_day)`. CID публикуется в событии того корня, который закрывает сутки этого города.
- При личных часах аккаунта (`DESIGN.md` §3) сутки городов разнесены по реальному времени: часовой корень оставляет до `3600` секунд выплаченного, но не аттестованного, минутный — `60`.

### `R-T11-2` — имена полей записи и место списка

`DESIGN.md` §6.1. **Внесено** в `DESIGN.md` §6.1.

**Было:** литерал полей с `payroll_ratio`, `output`, `district_efficiency`; «дельта фрагментов войдёт … layout здесь не меняется».

**Стало:** состав и типы layout v1 — `docs/TICK.md` §8. Имена с единицей: `output`, `payroll_ratio_bps`, `district_efficiency_bps`. T11 устанавливает layout v1, не мигрирует его. Дельта фрагментов и `stage_bps` входят в v1 с нулём, когда начисления нет.

### `R-T11-3` — `pack_hash` в заголовке, не в записи

Не названо в BRIEF; факт `docs/CONTENT.md` §5 и докстринг `pack.pack_hash` против D2. **Внесено** в `DESIGN.md` §6.1, `docs/CONTENT.md` §5 и докстринг `pack.pack_hash`.

**Было (CONTENT.md §5):** хеш пака — идентификатор внутри `DecisionRecord`.

**Стало:** хеш пака — идентификатор в `TickInputHeader` (лист `0` тика). В теле `DecisionRecord` поля `pack_hash` нет: иначе одно число лежит в каждой записи.

Докстринг `pack_hash`: «carried inside DecisionRecord» → «carried in TickInputHeader, not in DecisionRecord».

### `R-T11-4` — два контура границы; канон уточняется, числа не двигаются

`DESIGN.md` §2.3 и §4.6 молча про разные часы. **Не вносилось** (не в списке правок этого шага).

**Было (§2.3):** «Храповик применяется **целыми сутками города**, как пересчёт efficiency в §4.6».

**Стало:** «Храповик применяется **целыми сутками города на полуночи** (`hour==0`). Пересчёт efficiency — отдельно в `efficiency_recalc_hour` (§4.6, `06:00`). Это разные контуры; см. `docs/TICK.md` §6».

§4.6 час `06:00` не двигать.

### `R-T11-5` — личные часы vs когорта T3

`DESIGN.md` §3 vs `content/sim.py`. Расхождение модели и харнесса, не правка канона часов. **Внесено** в `docs/SIMULATION.md` §9.

**В канон не вносить смену формулы §3.** В `DESIGN.md` §3 после формулы `city_time` — одно предложение: «Прогон T3 держит общую фазу когорты как тестовую проекцию (`sim_cohort_shared_epoch`); батчер аттестации исходит из личных часов. Канон движка — `docs/TICK.md` §6».

### `R-T11-6` — T5 наполовину

`docs/PROGRESSION.md` `R-T5-12`. Механизм стадий и поле `stage_bps` есть; содержимое строк на калибровочной когорте нулевое. Не писать «закрыто». Строка `R-T5-12` дополняется: «T11 провёл механизм и запись; паковые rows в когорту T3 не входили». **Внесено** в `docs/PROGRESSION.md`.

### `R-T11-7` — пороги Happiness / Stability в пак

`HUD.md` §4.1. **Внесено** в `HUD.md` §4.1.

**Было:** «Ниже `50%` — штраф к Productivity, строка краснеет»; «Ниже `70%` — подсказка «проверь energy»».

**Стало:** «Ниже `happiness_penalty_threshold_bps` — строка краснеет; штраф к Productivity в v1 выключен (`happiness_penalty_live`, `docs/TICK.md` §11)». «Ниже `stability_hint_threshold_bps` — подсказка «проверь energy»». Числа порогов живут в паке, не в этом абзаце.

### `R-T11-8` — две модели оффлайна

Не правка канона `DESIGN.md` §3.2 (потолок `12` часов). Явно: производственный догон от `last_login` / `city_time` (D8); харнесс T3 — квадратная волна `_in_offline_window`. Экран возвращения только показывает потолок (`docs/SCREENS.md` §5).

### `R-T11-9` — Productivity измеряется, не умножает второй раз

`DESIGN.md` §5.3 шаг 5 и §8. **Внесено** в `DESIGN.md` §8 и минимально в §5.3 шаг 5 (иначе §8 противоречит формуле выхода).

**Было (шаг 5):** `выход = база × … × E_района × Productivity × …`

**Стало:** `выход = база × affinity × уровень × E_района × модификатор_задачи × дрожь × сплав T5`. `Productivity` — отношение реализованного выхода к номиналу (`docs/TICK.md` §11), не второй множитель.

**Было (§8, строка Productivity):** «Множитель выхода».

**Стало:** «Измерение выхода (реализованный / номинал). Не второй множитель поверх §5.3». Формула Happiness — ссылка на `docs/TICK.md` §11, не копия. Штраф Happiness → Productivity в v1 выключен (`happiness_penalty_live`); когда включится — строка таблицы модификаторов T5.

### `R-T11-10` — merkle live в `v1.1`, формат сейчас

`DESIGN.md` §11 уже режет live merkle+IPFS и держит формат с первого дня. **Не вносилось**. Уточнение одним предложением в §11 после скобок про merkle: «Спека дерева, keccak и layout v1 — `docs/TICK.md`; отправка корня в чейн остаётся `v1.1`».

### `R-T11-11` — доменный префикс keccak

Часть правки §6.2 (см. `R-T11-1`). **Внесено** в `DESIGN.md` §6.2. Отдельно: «Лист = keccak(канонические байты)» → «Лист = `keccak256`(байт домена листа ‖ канонические байты); узел = `keccak256`(байт домена узла ‖ left ‖ right), позиционно (`docs/TICK.md` §9)». Без доменов лист можно выдать за узел.

### `R-T11-12` — владельцы `state_sources` кошелька

Исходное ТЗ отдавало все `wallet.*` тику. Правка `DESIGN.md` / `HUD.md` не нужна: стейк уже гейт района (`DESIGN.md` §4.5); баланс `$CORP` и сеть — `HUD.md` §3 / T12.

**Было:** все `wallet.*` — T11.

**Стало:** `wallet.stake_tokens` входит в тик записанным входом (`stake_snapshot` в заголовке): стейк гейтит открытие районов, без него реплей `DESIGN.md` §6.3 не сходится; owner T11, producer `produce_wallet_stake_tokens`. `wallet.corp_balance` и `wallet.chain` — T12: в чистую функцию не входят, втаскивать их значило бы добавить внешнее чтение.

### `R-T11-13` — эндогенный ряд `corp_eth` (риск, не правка баланса)

Сценарий `endogenous_corp_eth` заведён рядом с замороженным рядом.
Исторический прогон дал `A_t2 = 32473` вне старого окна
`[12278, 15787]`; это не текущая pack-калибровка. Текущий static envelope
L42 — `[10230, 13154]`, а динамическая проверка нового target остаётся
отдельным вопросом. Базовые ставки не подгонялись под этот сценарий.

Это **не** доказанное свойство экономики: параллельно проверяется, не артефакт ли пробы (моделируется ли давление продаж игроков наравне с выкупом). Решение — T2/T3 до запуска, при любом исходе проверки: либо ряд/окно, либо проба. T11 окно и ставки не двигает.

### `R-T11-14` — HUD Productivity «множитель» vs §8

После `R-T11-9` `DESIGN.md` §8 больше не зовёт Productivity множителем, а `HUD.md` §4.1 в соседней строке ещё писал «Множитель выхода». **Внесено** минимально: смысл строки Productivity в `HUD.md` §4.1 — измерение выхода, ссылка на `docs/TICK.md` §11.

### `R-T11-15` — `DESIGN.md` §6.3 и лист-заголовок

После `R-T11-1/2` заголовок — лист `0`, без него реплей шага 2 не из чего считать. Канон §6.3 говорил только «merkle-proof записи». **Внесено** минимально: «записи и заголовка тика».

---

## §15. Коды

<!-- GEN:tick.codes -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: tick codes». Команда: `python content/build.py`.

| код | поверхность | когда |
|---|---|---|
| `PACK_HASH` | tick halt | recorded pack_hash mismatches cfg |
| `CITY_TIME` | tick halt | city_time and tick_index disagree |
| `STALE_PRICE` | topbar / log | feed silent or zero |
| `BANK_DAILY_LIMIT_REACHED` | bank plaque | global 1% depth fill |
| `IDLE_NO_ENERGY` | scene / agents | energy stock or energy_ok fails |
| `IDLE_NO_COMPUTE` | scene / agents | compute stock empty on prod path |
| `IDLE_OUT_OF_HOURS` | agents | schedule closed |
| `IDLE_BANK_CLOSED` | bank | withdraw while door closed |
| `IDLE_OFFLINE_CAP_REACHED` | agents | offline window or catch-up gap |
| `IDLE_NO_AGENT` | scene | output_base is 0 |
| `VAULT_EXIT_UNCOVERED` | log | I7 coverage negative |
| `ORACLE_STALE` | district efficiency | oracle older than stale hours |
| `WALLET_NOT_CONNECTED` | wallet echo | stake snapshot missing |

| state_source | producer |
|---|---|
| `tick.capital` | `produce_tick_capital` |
| `tick.energy` | `produce_tick_energy` |
| `tick.compute` | `produce_tick_compute` |
| `tick.agent_state` | `produce_tick_agent_state` |
| `tick.building_level` | `produce_tick_building_level` |
| `aggregate.gdp` | `produce_aggregate_gdp` |
| `aggregate.payroll_ratio` | `produce_aggregate_payroll_ratio` |
| `aggregate.happiness` | `produce_aggregate_happiness` |
| `aggregate.stability` | `produce_aggregate_stability` |
| `wallet.stake_tokens` | `produce_wallet_stake_tokens` |
| `seasons.influence_rank` | `produce_seasons_influence_rank` |
| `fragments.city_ledger` | `produce_fragments_city_ledger` |
| `log.events` | `produce_log_events` |
| `oracle.stock_price` | `produce_oracle_stock_price` |
| `oracle.district_efficiency` | `produce_oracle_district_efficiency` |
<!-- /GEN -->

Новые коды не заводить, пока существующие (`STALE_PRICE`, `IDLE_*`, `PACK_HASH` как `TickError`, `ORACLE_*`, `FRAGMENT_*`, `PRIZE_*`) покрывают ветку.

---

## §16. Правила L196+

<!-- GEN:tick.lint_l196 -->
Сгенерировано. Источники: `content/out/GENERATED.md` «T11: lint L196+». Команда: `python content/build.py`.

Правила следующей волны. Этот шаг пак и проводку отдаёт, линтер L196+ не пишет.

| id | title |
|---|---|
| `L196` | DecisionRecord key set equals layout v1 |
| `L197` | null forbidden in record and header |
| `L198` | float forbidden in record and header |
| `L199` | canonical bytes ignore input key order |
| `L200` | layout_version=1; layout change is major |
| `L201` | merkle leaf/node prefixes from params and differ |
| `L202` | keccak vectors empty/abc/`135`/`136`/`137` |
| `L203` | positional merkle, odd level not duplicated |
| `L204` | attest_root_period_s divides `3600` and <= tick length |
| `L205` | IPFS aggregate key is (city_id, city_day) |
| `L206` | pay before record in tick.py AST |
| `L207` | pack_hash mismatch halts the tick |
| `L208` | no network or wall clock on the tick path |
| `L209` | no /, round, float, math, Decimal on tick path |
| `L210` | every // on the tick path has a remainder sink |
| `L211` | tick_index is derived; city_time is the input |
| `L212` | two day-boundary contours; each event once |
| `L213` | `06:00` hour from efficiency_recalc_hour, not a literal |
| `L214` | catch-up = min(elapsed, cap) plus a gap record |
| `L215` | Happiness weights sum to BPS; terms clamped |
| `L216` | happiness_penalty_live = 0 in v1 |
| `L217` | productivity_bps is not a stored param |
| `L218` | Stability has one definition in seasons |
| `L219` | fragments accrue only on a paid beacon tick |
| `L220` | live=0 mints no CORP; live=1 needs recount |
| `L222` | every T11 state_source has a producer |
| `L223` | jitter % span is the named exception |
| `L224` | `brief_t11_tick` items appear in TICK.md |
| `L225` | TICK.md has no bare two-digit literals after strip |
<!-- /GEN -->

Спека правил — `docs/archive/reports/T11_tz.md` §5. Атаки — там же §6.

---

## §17. Воспроизведение

```
python content/build.py
python content/lint.py
python content/attack.py
python content/sim.py
```

Хеш пака — поле `hash` в `content/out/pack.json`. Инертность T3 — `docs/SIMULATION.md` §3–§4 и `docs/archive/reports/T11_tz.md` §7. Широкие таблицы — GENERATED «T11: …».
