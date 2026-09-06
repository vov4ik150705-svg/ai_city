# T7 TZ — сезоны и лидерборд (Influence)

Исполнять целиком. Не сокращать. Не выводить в чат полные тексты файлов, таблицы, формулы с выкладкой и отчёты длиннее 15 строк. Всё писать на диск. В чат — только паспорт: пути, lint rules/errors, attack count, pack SHA256, next step.

Канон механик — `DESIGN.md`. Канон интерфейса — `HUD.md`. Форма данных — `docs/CONTENT.md`. ТЗ задачи — `docs/BRIEF.md` §6 T7. Hand-off T6 — сообщение архитектора и `docs/reports/T6_recon.md`. Кран `protocol_prizes_bps = 4000` уже зарезервирован T6 и не тратится T6.

Прочитать целиком до первой правки: `DESIGN.md` (§2.3/§2.4/§2.8/§2.9/§8/§11/§12), `HUD.md` (§5.1, §6.2, §9), `docs/BRIEF.md` (инварианты §3 + T7), `docs/PRIZES.md`, `docs/LAUNCH.md` §3 и §10, `docs/BALANCE.md` §14, `docs/SIMULATION.md` §3 (кит vs оптимизатор), `docs/PROGRESSION.md` (строки T7 про `fund_share_bps`), `docs/CONTENT.md` §2 тип `season`/`prize` и таблица L01–L103, `content/params/pending.json`, `content/params/fragments.json`, `content/params/balance.json` `season_city_days`, `content/params/time.json` `city_day_real_hours` / `efficiency_recalc_hour`, `content/params/sim.json` архетипы optimizer/whale/minimalist, `content/params/economy.json` `spend_protocol_bps` / `stake_bonus_max_bps`, `content/fragments.py`, `content/lint.py` RULES и L90–L103, `content/attack.py` ATTACKS/CONSTRUCTION, `content/build.py` `IMPLEMENTED_DERIVED` и секции T6 в GENERATED, `content/pack.py` `PARAM_FILES`, `content/schema/corporator.schema.json`.

Не открывать заново: ставки круга T1, кривые T2, сиды T3, 13 ключей T5, settlement фрагментов T6, `tick.py` порядок, `sim.py` ряды, `exceptions.json`.

---

## 0. Что это за задача

BRIEF T7: формула Influence, устойчивая к размеру кошелька (оптимизатор среднего города обгоняет **вялого** кита); длина сезона в сутках города и в реальных днях при 25-часовых сутках; кривая призов на топ-N; антисивил R-T6-5 (кап T6 на город, не на кошелёк); источник пула с привязкой к T1.

Выход BRIEF: `docs/PRIZES.md` раздел «сезоны». Плюс машинные параметры `content/params/seasons.json` и чистая функция `content/seasons.py`.

Не T7: экраны клейма/лидерборда (T9), проводка в `tick.py` и дельта в `DecisionRecord` (T11), NFT-кран (T8), транш hop / slip COIN (T12 / R-T6-2). Как T5/T6: чистая функция + гейт здесь, движок тика не переписывать.

---

## 1. Инварианты, которые ломать нельзя

- Касса: `Capital игроков + Capital фонда ≤ vault_CORP × 2000`. Приз — уже изъятый `$CORP`. Минта Capital нет. Минта «игрового NVDA» нет. PnL бумаги на баланс игрока нет.
- Фонд зарплат: /14, пропорция, пробка 30 дней, слив ≤5%/нед. **Не забирать** creator tax и `reserve_cork` в призы (как T6: R-T6-1 жив).
- Трение 14.47%, вход дешевле выхода. Сезоны не трогают vault/bank/DEX.
- Тик детерминирован: Influence за сутки и settlement призов — чистые функции записанных входов. Покупка/выплата `$CORP` снаружи тика. Размер пула на сезоне — записанный вход, не спот. LLM нет. Random нет (тай-брейк — `city_id`, не hash-случайность поверх уже достаточного ключа).
- Стройка не платит: ни $CORP, ни Capital, ни Influence за факт постройки. Influence только с валидной истории тиков.
- 13 ключей. Четырнадцатый не заводить. `fund_share_bps` не становится компонентом Influence (GDP уже несёт долю фонда). Новая бесплатная строка на `output_bps` запрещена (форточка L77: +700 → 13535>13300 обязана жить).
- Выводимое не хранится. `season_city_days` живёт в `balance.json` (90). В `seasons.json` **не** копировать. Реальное время = 90 × `city_day_real_hours`.
- Демо изолирован: `DEMO_NO_PRIZE`, как `DEMO_NO_CLAIM`.
- Круг 14.47% не тронут. Сплит protocol 6000+4000 не тронут (L93).

---

## 2. Архитектурные решения (по одной рекомендации, не список)

### 2.1 Длина сезона

`season_len_city_days := season_city_days` (=90). Не второй параметр. Горизонт возврата T2, прогон T3 и призовой сезон — одно число.

Реальные часы (вывод, не параметр): `season_real_hours = 90 × 25 = 2250`. В сутках по 24 ч: `2250 / 24 = 93` целых дня и `18` часов (`season_real_hours % 24 = 18`). Не хранить 93.75 float.

90 не кратно окну фрагментов 14 (6 окон + 6 суток). **Не** сдвигать на 84. Это R-T6-3: окно ≠ сезон. Выравнивание переоткрыло бы L5/полосы T2.

Граница: `season_index = (city_day − 1) // season_city_days`. Settlement в `efficiency_recalc_hour` (06:00) первого часа нового сезона — тот же именованный якорь, что у фрагментов и efficiency. Код `SEASON_SETTLED`.

### 2.2 Influence — интенсивность, не кошелёк

Канон §8: GDP/день, Stability, открытые районы, efficiency против среднего. Не тратится.

Сырой GDP и счёт открытых районов → таблица депозитов. Формула — **произведение четырёх интенсивностей** за сутки города, затем **интеграл** по сезону.

Все четыре входа — целые bps. `BPS = 10000`.

```
intensity_bps   = gdp_day × BPS / max(capex_live, 1)
stability_bps   = valid_ticks_today × BPS / ticks_per_city_day
efficiency_bps  = mean(district_efficiency_bps of opened playable)   # 0 opened → BPS (нейтраль)
coverage_bps    = producing_opened_playable × BPS / max(opened_playable, 1)
                  # 0 opened → BPS (нештрафуем за отсутствие стейка: T3-оптимизатор районы не открывает)

I_day = intensity_bps
      × stability_bps / BPS
      × efficiency_bps / BPS
      × coverage_bps / BPS
      # fused mul/div, floor после каждой пары mul→div, как T5 fused-mulDiv
```

`influence_season = Σ I_day` по суткам, в которых город существовал в этом сезоне. Бэкфилла нет.

**capex_live** — сумма стоимостей стоящих зданий и нанятых агентов (Capital, уже потраченный). Не депозит, не Treasury. Непотраченный кит на Influence невидимый: кошелёк сам по себе очков не даёт.

**gdp_day** — Capital валидных оплаченных тиков за сутки (тот же поток, что GDP/день HUD). IDLE, стройка, демо-книга — ноль вклада в GDP этого счёта.

**efficiency против среднего** = против **канонической нейтрали 10000**, не против среднего по серверу. Иначе тик/суточный счёт тянет чужие города. Расхождение с буквальным чтением §8 назвать **R-T7-3**. Кламп efficiency §4.6 (±1500) и потолок стейка `stake_bonus_max_bps` (=1000) уже режут кита: +10% максимум, не «всё за размер».

**Открытые районы** — coverage открытых **playable_v1**, не count. Count купил бы кит. Скоуп `playable_v1`, не ручной список трёх тикеров (L21). Неиграбельные открытые в v1 в покрытие не входят.

Четыре экспоненты в params (это и есть закрытие `pending.influence_weights`), все = 10000 (= степень 1, простой продукт). Не взвешенная сумма: ноль в любом множителе (мёртвый день) даёт I_day = 0.

```
influence_intensity_exp_bps = 10000
influence_stability_exp_bps = 10000
influence_efficiency_exp_bps = 10000
influence_coverage_exp_bps  = 10000
```

В v1 экспонента ≠ 10000 запрещена линтером (произведение, не тюнинг «на глаз»). Поле нужно, чтобы вес был параметром, а не литералом в коде (L45).

`fund_share_bps` в формулу **не** входит. Иначе второй источник доли фонда (R-T5) стал бы очком лидерборда. GDP уже отражает выплату.

14-го ключа нет.

### 2.3 Свидетель «оптимизатор бьёт вялого кита»

T3-кит — **не** вялый: `login_period_city_hours = 1`, как оптимизатор; депозит ×10; глубина; районы. BRIEF просит вялого. Не делать четвёртый архетип `sim.json` (mix уже 10000, L53 жив). Пробы — в `seasons.py` из **уже существующих** params:

```
uptime_opt  = 10000 − residual_idle_bps                    # 9500
uptime_lazy = offline_cap_city_hours_base × 10000 / ticks_per_city_day
              × (10000 − residual_idle_bps) / 10000        # 12×10000/24×9500/10000 = 4750
mult_opt    = optimizer.deposit_multiple_bps               # 10000
mult_lazy   = whale.deposit_multiple_bps                   # 100000
```

Прокси GDP (только для зонда, не для тика): `gdp = deposit_multiple × uptime / BPS` в относительных единицах; `capex = deposit_multiple` (потратил то, что внёс).

| зонд | gdp | capex | intensity | stability | efficiency | coverage | дни |
|---|---:|---:|---:|---:|---:|---:|---:|
| optimizer_ref | 9500 | 10000 | 9500 | 9500 | 10000 | 10000 | 90 |
| lazy_whale | 47500 | 100000 | 4750 | 4750 | 11000 | 3333 | 90 |
| active_whale | 95000 | 100000 | 9500 | 9500 | 11000 | 10000 | 90 |
| last_day_clone | как opt за 1 день | — | — | — | — | — | 1 |

- `lazy_whale.efficiency = BPS + stake_bonus_max_bps` (11000) — кит купил потолок стейка.
- `lazy_whale.coverage = BPS / 3` (3333): открыл три playable, штабит один (вялость).
- `optimizer_ref.coverage = BPS` при нуле открытых: T3-оптимизатор `districts_opened = []`.
- **Обязано:** `influence_season(optimizer_ref) > influence_season(lazy_whale)` (L106).
- **Не обязаны** обгонять `active_whale`. При равном аптайме активный кит выигрывает не больше чем на `stake_bonus_max` через efficiency. Назвать **R-T7-5**: BRIEF требует обогнать вялого, не активного T3-кита. Не подгонять формулу, чтобы активный кит проигрывал — это уже L53 в деньгах.

Числа зонда **пересчитать** из params, не копировать 9500/4750/11000 из этой прозы. Если params сдвинулись — зонд едет, литералы в тесте запрещены (L45).

`last_day_clone` интеграл 1 дня vs 90: квалификация (ниже) режет; даже без неё Σ меньше.

### 2.4 Антисивил (закрывает R-T6-5 для призов)

Кап T6 остаётся на город. Призы — на **кошелёк**.

1. **Один кошелёк — один слот.** `influence_wallet = max(influence_season)` среди городов кошелька, не сумма (сумма возвращает кита из шести городов) и не среднее (прячет мёртвый город). Два города одного кошелька не занимают два места в топ-N.
2. **Интеграл, не снимок.** Клон в последний час не получает 89 нулевых дней задним числом.
3. **Квалификация.** `season_qualify_bps = 2000` (20%). `qualify_days = season_city_days × season_qualify_bps / BPS` (=18). Город с числом суток `I_day > 0` строго меньше порога — вне топа, код `PRIZE_NOT_QUALIFIED`. 18 не хранить.
4. **Живой стейк на settlement.** `prize_require_live_stake = 1`. Хотя бы один `playable_v1` стейк не заморожен. Снял стейк в день 89 — нет клейма. Порог в токенах не выдумывать (S_min всё ещё pending RPC 403); гейт — «стейк жив», не доллар.
5. **Демо.** `DEMO_NO_PRIZE`.

Остаточный сивил N ключей × N оптимизированных городов × 90 суток назвать **R-T7-4**. KYC нет. Кривую не плющить, чтобы приз #10 < $100: это убивает топ-N. Налог фонда не забирать.

Стоимость защит (в PRIZES.md таблицей, числа — GENERATED): депозит референс 100 $; стейк-ориентир `district_stake_usd_target_8dec` = 100 $; время = qualify_days × city_day_real_hours. Сравнение с призом #10 при N_cities ∈ {1, 100, 1000} и сценариях T1 — сгенерировать, не набивать.

### 2.5 Кривая топ-N

`prize_top_n = 10` (HUD «простая таблица», не 20). `prize_curve_alpha_bps = 10000` (α = 1, дискретная гармоника). Ручной ряд из 10 долей запрещён.

```
weight_k = BPS // k                         # k = 1..n, n = min(N_eligible, prize_top_n)
payout_k = floor( pool × weight_k / Σweight )
assert Σ payout ≤ pool
dust остаётся в пул следующего сезона
```

Почему не равные доли: 10 сивилов забирают пул. Почему не геометрическая 1/2: #1 ест половину, турнир «кто на 1 bps выше». Почему α=1: #1 ≈ 34%, #10 ≈ 3.4% при n=10 — круто для мотивации, не winner-take-all.

N_eligible = 0 → деления нет, пул цел, `PRIZE_NO_ELIGIBLE` (как FRAGMENT_NO_CLAIMS).
N_eligible = 1 → 100% пула, Zipf на пустых местах не ест вес (как T6 N=1 без капа).
N_eligible > 10 → режутся по Influence, выплата только топ-10, веса H_10.
Ceil на гармонике — атака L107: сумма может превысить пул.

Тай-брейк: меньший `city_id` (строка) выше. Не random.

Свидетель: pool=10000, n=10, floor, Σ ≤ 10000, пыль ≥ 0. Пересчитать. Второй: тройка eligible × pool 10 — как T6, floor не печатает.

### 2.6 Источник пула и актив

Живой кран — тот же, что T6 оставил: `spend_protocol` × `protocol_prizes_bps` (4000). Creator tax 0, cork 0, NFT 0.

Приз **в `$CORP`**, уже изъятом при трате. Не Capital (минт запрещён). Не сток (это T6). Лишняя нога ETH→USDG→сток **не нужна**. BRIEF T7 предполагал конвертацию сбора ETH в приз — T6 закрыл tax как корм фонда. Назвать **R-T7-1**. Доллар в таблицах — снимок ETH/USD × CORP/ETH с датой, как T6, не спот внутри settlement.

Hop для приза = 0. `fragment_hop_haircut_bps` не копировать (L68). R-T6-2 не закрывать здесь.

Конвейер снаружи тика. `pool_in` сезона — записанный вход. Отказ RPC → `pool_in=0`, `PRIZE_HOP_STALE` / пул пуст, экономика тика жива. Тот же транш выкупа 0.33% (L22), не новый лимит.

Бюджет сезона (GENERATED «T7: бюджет сезона»), та же форма что T6, но горизонт сезон, не окно, и доля 4000:

```
spend = deposit_net × (scenario_usd × BPS // low_usd) // BPS
proto = spend × spend_protocol_bps // BPS
prize = proto × protocol_prizes_bps // BPS
```

(у T6 ещё был × window // season; здесь fraction = 1). Пересчитать, не копировать 38.40 $ из головы архитектора. Low < 1 $/город за **окно** был R-T6-4; за сезон 90/14 раз больше — проверить, упал ли low-приз на город под 1 $, и назвать, если да, **R-T7-6** (не лечить налогом фонда).

`season_prizes_live = 0`. Influence-ранг в v1 **считается**. Выплата `$CORP` — v1.1, когда касса уже живая (`DESIGN.md` §12). BRIEF «сезоны в скоупе» закрывается спекой и рангом, не выплатой в v1. Это продолжение R-T6-3, id **R-T7-2**. Пока live=0: 4000 bps по-прежнему изымается (сплит иммутабелен), но **не** аккумулируется в призовой пул и не уходит во фрагменты. Сидит как protocol-owned CORP (казна протокола, не фонд). Первый сезон v1.1 стартует с нуля, без джекпота из v1. Таблицы GENERATED считают пул **как при live=1** (сайзинг), флаг отдельно.

### 2.7 Где живёт счёт

Суточный I_day — чистая функция состояния **одного** города плюс записанные gdp/capex/stability/efficiency/coverage. Глобальный топ — снаружи тика (сортировка кошельков). T11 вставит вызов; T7 даёт `seasons.py`.

HUD §9: `LEADERBOARD` — таблица по Influence **без выплаты**. Ранг из интеграла текущего сезона. Клейм приза — T9, не рисовать экран.

---

## 3. Параметры `content/params/seasons.json`

Только якоря. Why + src у каждого. Ни одного выводимого в `params`.

| id | v | u | почему |
|---|---:|---|---|
| `influence_intensity_exp_bps` | 10000 | bps | степень 1; продукт, не сумма |
| `influence_stability_exp_bps` | 10000 | bps | то же |
| `influence_efficiency_exp_bps` | 10000 | bps | то же |
| `influence_coverage_exp_bps` | 10000 | bps | то же |
| `prize_top_n` | 10 | count | HUD-таблица; Zipf n |
| `prize_curve_alpha_bps` | 10000 | bps | α=1; вес = BPS//k при α=10000. Иное α в v1 — L-ошибка |
| `season_qualify_bps` | 2000 | bps | 20% сезона |
| `prize_require_live_stake` | 1 | flag | 0/1 |
| `season_prizes_live` | 0 | flag | выплата v1.1 |
| `prize_creator_tax_share_bps` | 0 | bps | как T6 tax 0 |
| `prize_cork_share_bps` | 0 | bps | R-T6-1 |
| `prize_nft_share_bps` | 0 | bps | T8 |
| `prize_hop_haircut_bps` | 0 | bps | натив $CORP |
| `leaderboard_scope` | `wallet` | enum | не `city` |

`derived` (имена — в `IMPLEMENTED_DERIVED` и в этом блоке):

- `season_len_city_days` = `balance.season_city_days` (не хранится)
- `season_real_hours` = len × `city_day_real_hours`
- `season_real_whole_days_24h` = hours // 24
- `season_real_remain_hours_24h` = hours % 24
- `qualify_days` = len × qualify_bps / BPS
- `zipf_weights` / `zipf_payout_witness`
- `influence_witnesses` (optimizer_ref, lazy_whale, active_whale, last_day_clone)
- `prize_season_budget` (low/mid/hype, путь spend_protocol × 4000)
- `sybil_cost_vs_rank10`
- `settle_hour` = `efficiency_recalc_hour`
- `prize_asset` = `CORP`
- `split_check` = fragments 6000 + prizes 4000 = 10000

Не класть `season_city_days` в params этого файла.

---

## 4. Чистая функция `content/seasons.py`

Зеркало стиля `fragments.py`. Без DEX, без `tick.py`, без `sim.py` (полный сезон T3 не гонять).

Обязательный API:

- `season_days(data) -> int` из balance
- `season_real_hours(data) -> int`
- `season_index(day, days) -> int`
- `qualify_days(data) -> int`
- `intensity_bps(gdp, capex) -> int`
- `coverage_bps(producing, opened) -> int`  # opened=0 → BPS
- `i_day(...)` fused
- `i_season(days_rows) -> int` сумма
- `qualified(positive_days, data) -> bool`
- `wallet_influence(city_scores: dict[city_id, int]) -> int` = max
- `rank_wallets(wallet_scores, top_n) -> list`
- `zipf_weights(n, bps) -> list[int]`
- `zipf_payout(pool, n, rounding=floor) -> {payouts, dust, invariant_ok}`
- `settle_prizes(...)` с кодами, live-флагом, demo, stake-гейтом
- `witnesses(data) -> dict` все зонды, числа из params
- `season_budget(data) -> dict` как `fragments.window_budget`, доля prizes
- `build_seasons(data, generated) -> dict` для пака

Округление ceil — шов атаки, как T6. Литералов экономики в коде нет (L45): BPS из pack, residual/offline/deposit_multiple/stake_bonus_max/top_n только из data.

---

## 5. Документы (хирургия, не переписывать разделы)

- `docs/PRIZES.md` — заменить заглушку §6 на полный канон сезонов: Influence, длина, кривая, антисивил, кран, расхождения T7, ссылки на GENERATED «T7: …». Широкие таблицы не копировать. Заголовок документа: фрагменты **и** сезоны. T6-разделы 1–5 не ломать.
- `DESIGN.md` §8 — одно-два предложения: формула интенсивности, интеграл, нейтраль 10000, не тратится; числа — PRIZES. §11 — ранг Influence в v1, выплата призов v1.1 (не вычёркивать «сезоны» из v1.1). §12 абзац «Когда сезоны» — выплата по-прежнему не v1; дописать что **счёт** Influence живёт в v1 для HUD. §2.4 уже указывает 40% T7 — не дублировать сплит.
- `HUD.md` §9 строка LEADERBOARD: таблица по текущему интегралу Influence, **без** клейма приза в v1. §5.1 ранг — ссылка на тот же счёт.
- `docs/CONTENT.md` — тип `season`/`prize` закрыт T7; L104–… в реестр; прогон: новое число правил / pack 13 / rules 0.10.0; pending T7 снят.
- `docs/BALANCE.md` §14 строка T7 закрыта.
- `docs/LAUNCH.md` §10 — одна фраза: T7 забрал 4000 как приз в $CORP, tax/cork не трогает.
- `docs/PROGRESSION.md` строки «T7 веса Influence vs fund_share 3500» — закрыть: Influence не содержит fund_share.
- `docs/SIMULATION.md` — абзац: T7 не перегоняет sim; зонды из архетипов/uptime; активный кит ≠ вялый.
- `docs/reports/T7_recon.md` — как T6_recon: решения, пересчитанные числа, расхождения, атаки, гейты, файлы. Числа из прогона, не из этой прозы.

`pending.json`: закрыть `influence_weights` и `prize_curve`. Добавить `season_claim_screens` owner T9 и `season_tick_wiring` owner T11 (как фрагменты).

`meta.json`: `rules_version` 0.10.0 (новая формула генератора), `pack_version` 13.

Коды + `strings/ru.json` (L11/L12):

- `SEASON_SETTLED` state `{season}`
- `PRIZE_POOL_EMPTY` state
- `PRIZE_NO_ELIGIBLE` state
- `PRIZE_NOT_QUALIFIED` refusal `{have_days, need_days}`
- `PRIZE_STAKE_REQUIRED` refusal
- `DEMO_NO_PRIZE` refusal
- `PRIZE_HOP_STALE` state (пул 0; hop 0, но RPC всё равно может не отдать CORP)
- `PRIZE_WALLET_MERGED` state `{kept_city}` (информативно: max, не сумма)

Схема: `$defs.seasons_file`. `pack.py` PARAM_FILES. L01 подхватит.

`resources.json` metric `influence` why обновить: формула T7, не «ждёт T7».

---

## 6. Генератор и GENERATED

`build.py`: `generated["seasons"] = seasons.build_seasons(...)`. Секции в `content/out/GENERATED.md`:

- T7: длина сезона (90 / 2250 ч / 93д+18ч) — числа из params
- T7: Influence свидетели (четыре зонда, I_day и I_season)
- T7: Zipf топ-N (веса, payout при pool-свидетеле)
- T7: бюджет сезона (low/mid/hype, $/город, CORP)
- T7: антисивил (qualify_days, слот кошелька, стейк-гейт, rank10 vs депозит)

Контрольный блок stdout как у T6.

Литералы 90, 25, 4000, 6000 не писать в build.py — читать params.

---

## 7. Линтер L104–L118

Каждое правило — в RULES. Каждое ловит свою мутацию в attack.py. Construction на честный вход молчит. Правило без атаки роняет coverage. Исключение вместо fail — тоже fail харнесса.

| id | суть | мутация | честный |
|---|---|---|---|
| **L104** | `season_city_days` не хранится в seasons.params; len derived = balance 90 | записать `season_city_days` в seasons.params | derived 90 |
| **L105** | `season_real_hours` = len × 25 | подменить city_day_real_hours в формуле (или хранить 2160) | 2250 |
| **L106** | optimizer_ref I_season > lazy_whale | coverage_opened=0 трактовать как 0 (оптимизатор умирает) **или** intensity = сырой gdp | opt > lazy |
| **L107** | Zipf floor Σ ≤ pool; ceil превышает | rounding=ceil на pool 10000 n=10 | floor invariant_ok |
| **L108** | T7 не тратит 6000 фрагментов; prizes 4000 | protocol_prizes_bps=5000 | 6000+4000, L93 жив |
| **L109** | приз CORP, не Capital; hop 0 | prize_hop_haircut_bps=3 или prize_asset=Capital | hop 0, asset CORP |
| **L110** | слот кошелька = max, не сумма | leaderboard_scope=city **или** settle суммирует два города | два города → одно место, score=max |
| **L111** | last_day_clone не qualified | qualify_bps=0 | 1 < 18 |
| **L112** | DEMO_NO_PRIZE | demo_claim_real-аналог demo_prize_real=1 | 0 |
| **L113** | N_eligible=0 пул цел | wipe_pool_on_zero | pool_left=pool |
| **L114** | N=1 забирает пул (ренорм) | применить H_10 к одному живому и девяти нулям | payout=[pool] |
| **L115** | season_prizes_live=0 в v1 | live=1 | 0 |
| **L116** | 13 ключей; seasons не содержит fund_share как компонент | добавить fund_share в i_day | 13 ключей, L72 жив |
| **L117** | α=10000; нет ручного rows долей | prize_curve_alpha_bps=5000 **или** seasons.rows с 10 долями | α=10000, rows нет |
| **L118** | 0 opened → coverage BPS | coverage 0/0 = 0 | BPS |
| **L119** | qualify_days derived, не литерал 18 | хранить qualify_days=18 | derived |
| **L120** | tax/cork/nft призов = 0 | prize_cork_share_bps=500 | 0; бюджет = protocol×4000 без cork |
| **L121** | интеграл, не last-day snapshot | i_season = last I_day | clone 1 дня < opt 90 |

L01–L103 не ломать. L77 +700 unpaid обязана падать (construction_t6_l77_700_still_fails жив; добавить construction_t7_l77_700_still_fails или оставить T6 — не удалять). L53 кит не богаче — не трогать sim.

L45: в seasons.py нет литералов 90/25/4000/9500/4750.

---

## 8. Атаки construction (честный вход, правило молчит)

Минимум:

- Zipf  n=10 pool=10000: Σ ≤ 10000, L107 молчит
- N=1 забирает пул, L114 молчит
- N=0 пул цел, L113 молчит
- opt I > lazy I, L106 молчит
- 0 opened coverage=BPS, L118 молчит
- два города одного кошелька: rank count 1, score=max, L110 молчит
- last_day_clone not qualified, L111 молчит
- live=0, L115 молчит
- сплит 6000+4000, L93/L108 молчат
- L77 +700 всё ещё падает
- круг 14.47% цел
- касса: settle призов не минтит Capital
- active_whale может быть ≥ opt (не construction-fail; задокументировать в recon)

Обходы, которые T7 фиксирует текстом, не кодом тика (как T6 про последний час окна): кит перекладывает узлы в последний день — интеграл уже накоплен, снимок узлов не пересчитывает 89 дней (проводка T11). Сивил ключей — R-T7-4.

---

## 9. Что считать и сверить (пересчёт, не проза)

После реализации, в T7_recon.md, **пересчитанные** с диска:

- 90 × 25 = ? часов; ? // 24 и ? % 24
- qualify_days = 90 × 2000 // 10000
- uptime_opt, uptime_lazy из residual и offline_cap
- I_day и I_season четырёх зондов
- Zipf веса BPS//k, Σ weights, payouts на pool-свидетеле, пыль
- бюджет сезона low/mid/hype в Capital и usd_8dec (дата снимка как T6)
- rank1/rank10 $ при N_cities 1/100/1000
- круг 14.47% (Trader 11.67%) не изменился
- L77 мутация +700 → 13535>13300
- SHA256 двух сборок pack совпал
- justified builds 6321, dominating/dead/mandatory/uncovered 0 (builds.py не ломать; fragments_season не трогать)

Касса шага: изъятие protocol уже в `_apply_spend`; приз не минтит Capital; Σ payout ≤ pool.

---

## 10. Расхождения назвать явно

| id | суть |
|---|---|
| **R-T6-3** жив | окно фрагментов ≠ сезон |
| **R-T6-5** закрыт для призов | слот кошелька + интеграл + qualify + стейк; кап фрагментов на город не менять |
| **R-T7-1** | BRIEF хотел ногу ETH→приз с tax. Кран — protocol CORP. Приз = $CORP, hop 0 |
| **R-T7-2** | BRIEF: сезоны в скоупе. §12: выплата не v1. Счёт v1, выплата v1.1, `season_prizes_live=0` |
| **R-T7-3** | §8 «efficiency против среднего» = нейтраль 10000, не среднее сервера |
| **R-T7-4** | остаточный сивил N ключей × 90 суток. Не KYC |
| **R-T7-5** | активный T3-кит может вести за счёт стейк-бонуса ≤1000 bps; гейт — вялый кит |
| **R-T7-6** | если low-бюджет сезона на город < 1 $ — назвать, не лечить фондом (как R-T6-4) |

Не молча переписывать канон.

---

## 11. Версии и запреты

- pack 13, rules 0.10.0
- Не гонять полный `sim.py` 90 суток (T3 закрыт; хеш SIM не обязан меняться)
- Не менять `tick.py` / `sim.py` логику (импорт seasons в tick — T11)
- Не менять `exceptions.json`
- Не тратить `protocol_prizes_bps` на фрагменты
- Не обещать APY и «все в плюсе»
- Комментарии и идентификаторы — английский; документы — русский
- ReadLints на правленные файлы; JSON — схема; `python content/lint.py`, `python content/build.py` дважды, `python content/attack.py`, `python content/builds.py`
- Адверсариально: каждое новое правило сломать; поискать обход (сумма городов, last-day, coverage 0/0, ceil Zipf, live=1 контрабандой, fund_share в формуле, season_days=84 чтобы «выровнять окна»)

---

## 12. Критерии приёмки

- `python content/lint.py` — 0 ERRORS, правил ≥ 121 (было 103 + L104–L121)
- `python content/attack.py` — UNATTACKED empty, SURVIVED empty, construction held, L77 +700 жив
- `python content/build.py` ×2 — байты и SHA256 совпали
- `python content/builds.py` — justified/dominating/dead как после T6
- Импорт `content.seasons`: opt > lazy; Zipf floor invariant; окно 90/2250; сплит 10000
- PRIZES.md § сезоны полный, заглушки нет
- pending T7 веса/кривая закрыты
- Касса и 13 ключей выстояли

---

## 13. Чат саб-агента

Строго паспорт ≤ 15 строк:

```
=== T7 SUB-AGENT ===
files: ...
lint: rules N / errors 0 / pending M
attack: total / mutations / construction / uncovered 0
pack: bytes / SHA256 / v13 / rules 0.10.0
witness: opt I > lazy I; zipf dust; season 90/2250h
divergences: R-T7-1 … 
next: T8
```

Полный текст — только в файлах.
