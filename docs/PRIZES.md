# Corporator — фрагменты и призы

Канон пула стоков, клейма **и** сезонов Influence. Механика фрагментов — `DESIGN.md` §2.9. Сезоны — `DESIGN.md` §8 и этот документ §6. Широкие таблицы — `content/out/GENERATED.md` секции «T6: …» и «T7: …», команда `python content/build.py`. Экраны клейма и лидерборда — `docs/SCREENS.md`. Проводка в `tick.py` — **T11**. NFT как кран — **T8**.

Игрок фармит в городе настоящую NVDA. Протокол не обещает доходность, которую не может покрыть, не минтит «игровой NVDA» и не становится маркет-мейкером по шести бумагам.

---

## 1. Что такое фрагмент

Внутренняя фишка требования, как Capital: не ERC-20, не перевод между игроками, не продаётся на DEX. Шесть леджеров — по одному на `districts[].ticker`. v1 живые леджеры считаются из `playable_v1`, не из ручного списка трёх тикеров.

Начисление только за **валидный оплаченный тик** в здании `tier=beacon` с одним `district`, район играбелен. Workshop, синергии (`requires` ≥ 2, в том числе `robotics_lab`), заполнитель, IDLE, стройка, неиграбельный маяк — ноль. Иначе синергия плодит второй сток без своей paper-ветки, а база без стейка фармит NVDA.

База = gross output тика **до** `payroll_ratio`. `fragment_rate_bps` (стадия `post`, `mul`) — тот же fused-mulDiv, что T5. Efficiency района уже в output — второй раз не умножаем. Тонкий фонд не убивает оба контура: фрагменты — требование к другому пулу.

AAPL / `flagship_store`: валидный тик маяка consumer даёт фрагменты AAPL. Population-конверсия остаётся output.

---

## 2. Окно и settlement

`fragment_claim_window_city_days := payroll_daily_divisor`. Не хранится. Реальное время = окно × `city_day_real_hours` (вывод). Граница: `window_index = (city_day − 1) // 14`. Settlement в `efficiency_recalc_hour` (06:00) первого часа нового окна, код `FRAGMENT_WINDOW_SETTLED`. Потом леджер обнуляется.

```
payout_i = floor( fragments_i × pool / Σfragments )     # Σ>0
если claiming_cities ≥ 2:
    cap = floor( pool × fragment_city_cap_bps / 10000 )
    payout_i = min(payout_i, cap)                        # FRAGMENT_CITY_CAPPED
assert Σ payout_i ≤ pool
dust остаётся в пуле
fragments_i := 0
```

Пустой пул → 0 + `FRAGMENT_POOL_EMPTY`, фрагменты сгорают. `Σ=0` → деления нет, пул не трогать, `FRAGMENT_NO_CLAIMS`. Второго прохода redistrib нет: это обход капа. Floor может дать 0 при пыли — как банк.

N=1: кап **не** применяется. N≥2: один город ≤ половины пула (`fragment_city_cap_bps` = 5000). Два равных кап не задевает. Кит 90% против 10%: кит 50%, минноу 10%, 40% пыль на следующее окно — пыль минноу не перекладывать.

Покупка стока **снаружи** тика. Размер пула на окне — записанный вход, не спот. Отказ hop → `pool_in=0`, код `FRAGMENT_HOP_STALE`, экономика тика жива. Кит, который в последний час окна перекладывает узлы, селится по **замороженному** леджеру, не по споту узлов (проводка T11).

Демо: начисление в изолированной книге, клейм ERC-20 — `DEMO_NO_CLAIM`. Прогресс не переносится.

Свидетели (пересчёт в GENERATED «T6: свидетели settlement»): 1,1,1×10 → 3+3+3 пыль 1; 50/50 без капа; кит 90/10 кап на ките; N=1 без капа; Σ=0 пул цел. Ceil на первой тройке даёт 12>10 — L90.

---

## 3. Источники пула

| Кран | bps | Почему |
|---|---:|---|
| Creator tax | 100 payroll / 30 leaderboard / 50 active-work / 20 studio | Из creator tax 200 bps оборота: 100 bps payroll, 30 bps `month`, 50 bps `farm`, 20 bps studio. |
| `reserve_cork` | 0 | Пробка — восстановление фонда, не приз. **R-T6-1** против `docs/LAUNCH.md` §10. |
| `spend_protocol` | 0 | Capital spending no longer funds a stock kettle; spend is 4000 burn + 6000 payroll + 0 protocol. |
| NFT | 0 | G6 зафиксировал ноль (`D-G-9`). Выручка сначала закрывает счёт инференса (`nft_proceeds_sink`); доля в пул — обещание доходности. |

Creator-tax stock split is 30/50 bps of turnover for `month`/`farm`; the raw prize leg is 100 bps of turnover and its 20 bps studio take is removed before the stock split. The old `spend_protocol` 10000/0 split is inactive because `spend_protocol_bps=0`.

Конвейер снаружи тика, тот же транш выкупа (L22), не новый лимит. 1% налога с продажи CORP **возвращается в фонд** — побочный сбор DEX, не кран фрагментов. Аллокация `budget_t = eth_net × frag_t / Σfrag`. Нулевой леджер → не покупать (нет мёртвого COIN, пока Finance в v1.1).

Hop: `fragment_hop_haircut_bps` = 3, замер `docs/LAUNCH.md` §13 строка 10 000$. Таблицу 1/1/3 bp в params не копировать (L09/L68). `quote_asset(ticker) = WETH if ticker==weth_quote_ticker else USDG`. Один параметр `weth_quote_ticker = COIN`. Haircut тот же 3 bps на COIN: отдельная модель проскальзывания не выдумывается (**R-T6-2**). Покупка только Uniswap USDG или WETH. Пар `CORP/сток` нет (L101).

Бюджет окна в Capital и в $ — только историческая sizing-метрика; живой источник `farm` теперь creator-tax active-work leg, не `spend_protocol`. Доллар — снимок ETH/USD 2026-08-27. Если на low < 1$ на город за окно — фарм остаётся требованием на тонкую долю дома, пока нет оборота трат; из налога фонда не доливать и APY не обещать.

---

## 4. `fragments_season`

Скоринг билдов, не ожидаемые штуки стока. Вес требования = линия нормировки сценария (`gdp` = workshop × ticks × uptime × n_prod) × `fragment_stack_bps / BPS`. Скоуп как T4 spot: в `spot` только бумага района-прожектора. Стек — сплав `fragment_rate_bps`, не сырая величина узла. **R-T6-6:** `produced` после `output_bps` схлопывал цель paper в широкий город (L69: 3702 без свидетеля). Settlement по-прежнему считает gross output тика. Тонкий пул не входит в цель доминирования.

Прокси R-T4-4 снят. `pending.fragment_season_proxy` закрыт.

---

## 5. Расхождения

| id | суть |
|---|---|
| **R-T6-1** | T1 `LAUNCH.md` §10 предлагал и `spend_protocol`, и излишек пробки. T6 пробку не забирает. |
| **R-T6-2** | Haircut 3 bps и на COIN/WETH. Пул WETH ~54 k$ — отдельный slip не моделируется. Транш T12. |
| **R-T6-3** | `DESIGN.md` §11/§12 склеивал «сезоны и призовой фонд». Разрезали: окна фрагментов в v1 для играбельных районов; период призов derived из делителя; сезоны Influence — горизонт T2. |
| **R-T6-4** | Бюджет окна на low может быть пылью < 1$/город. Не чинить налогом фонда. |
| **R-T6-5** | Кап фрагментов на город, не на кошелёк. Для призов закрыт T7: слот кошелька + интеграл + qualify + живой стейк. |
| **R-T6-6** | `produced` после `output_bps` в `fragments_season` оставил 3702 без свидетеля. Счёт: линия нормировки × стек. Settlement не менялся. |

Касса: settlement не минтит Capital. Protocol-CORP уже вычтен в `_apply_spend`. Σ стоков к выплате ≤ пул.

---

## 6. Сезоны и Influence

Канон ранга и призового пула. Чистая функция — `content/seasons.py`. Широкие таблицы — GENERATED «T7: …». Проводка в тик — T11. Экраны клейма и лидерборда — `docs/SCREENS.md`.

### 6.1 Длина

`season_len_city_days := season_city_days`. Не второй параметр: горизонт возврата T2, прогон T3 и призовой сезон — одно число. Реальные часы = длина × `city_day_real_hours` (вывод; не хранить float суток). 90 не кратно окну фрагментов 14 — **не** сдвигать на 84 (**R-T6-3** жив: окно ≠ период ≠ сезон).

Период призов: `prize_periods_per_season` хранится как делитель, `prize_period_city_days := season_city_days / prize_periods_per_season` — derived, не вторая длина (L282). Реальные часы периода — вывод. Граница: `prize_period_index = (city_day − 1) // prize_period_city_days`. Settlement в `efficiency_recalc_hour` первого часа нового периода, код `PRIZE_PERIOD_SETTLED`. `SEASON_SETTLED` — только на границе сезона, архив HUD.

Числа — GENERATED «T7: длина сезона» и «M2: период призов».

### 6.2 Influence — интенсивность, не кошелёк

Не тратится. Стройка, IDLE, демо-книга — ноль вклада в GDP этого счёта. `capex_live` — стоимость стоящих зданий и нанятых агентов, не депозит и не Treasury.

Четыре входа — целые bps. Сутки:

```
intensity_bps  = gdp_day × BPS / max(capex_live, 1)
stability_bps  = valid_ticks_today × BPS / ticks_per_city_day
efficiency_bps = mean(district_efficiency opened playable)   # 0 opened → BPS
coverage_bps   = producing_opened_playable × BPS / max(opened_playable, 1)
                 # 0 opened → BPS
I_day = fused mul/div of the four, floor after each pair
influence_season = Σ I_day   # без бэкфилла; окно — период призов
```

Экспоненты в params все = 10000 (степень 1). Иное в v1 — ошибка линтера. Взвешенная сумма запрещена: мёртвый день (ноль в любом множителе) даёт I_day = 0.

`fund_share_bps` в формулу не входит. 14-го ключа нет.

Efficiency — против канонической нейтрали 10000, не против среднего сервера (**R-T7-3**). Покрытие — открытые `playable_v1`, не count районов и не ручной список тикеров.

Свидетель: оптимизатор среднего города обгоняет **вялого** кита (L106). Активный T3-кит при равном аптайме может вести за счёт потолка стейка ≤ `stake_bonus_max_bps` — это не дыра формулы (**R-T7-5**). Числа зондов — GENERATED «T7: Influence свидетели», из params, не литералы.

### 6.3 Антисивил

Кап T6 остаётся на город. Призы — на кошелёк (**R-T6-5** закрыт для призов).

1. Один кошелёк — один слот: `max` Influence городов, не сумма и не среднее. Код `PRIZE_WALLET_MERGED`.
2. Интеграл, не снимок. Клон в последний день периода не получает нули задним числом (L121).
3. Квалификация: `season_qualify_bps` от длины периода (`qualify_days` derived). Клон на предпоследнем дне периода — `PRIZE_NOT_QUALIFIED`. Строго меньше порога — `PRIZE_NOT_QUALIFIED`.
4. Живой стейк на settlement: хотя бы один `playable_v1` не заморожен. Порог в токенах не выдумывается. `PRIZE_STAKE_REQUIRED`.
5. Демо: `DEMO_NO_PRIZE`.

Остаточный сивил N ключей × оптимизированных городов × сезон — **R-T7-4**. KYC нет. Кривую не плющить, чтобы #10 был мелким. Налог фонда не забирать.

Стоимость защит vs rank-10 — GENERATED «T7: антисивил».

### 6.4 Кривая топ-N

`prize_top_n` = 10, `prize_curve_alpha_bps` = 10000 (α = 1, дискретная гармоника). Ручной ряд долей запрещён. Веса одни на всех; выплата — **по каждому активу корзины** (`prize_assets` = шесть `districts[].ticker`, never `$CORP`).

```
weight_k = BPS // k
payout_k(asset) = floor( pool[asset] × weight_k / Σweight )
assert Σ payout[asset] ≤ pool[asset]
dust[asset] → следующий период того же актива
```

N_eligible = 0 → деления нет, пул цел, `PRIZE_NO_ELIGIBLE`. N = 1 → 100% **каждого** пула, H_10 на пустых местах не ест вес. N > 10 → топ-10, веса H_10. Ceil на гармонике — атака L107/L284. Перелив пыли NVDA в TSLA — атака L284. Тай-брейк: меньший `city_id` (строка) выше. Не random.

Кап доли `prize_share_cap_over_contribution_bps` (derived): при N_eligible ≥ 2 доля кошелька в пуле ≤ доля qualifying active-work вклада × k. Срезанное остаётся в пуле, `PRIZE_SHARE_CAPPED[cap]`. N = 1 без капа. Свидетели — GENERATED «M3: корзина Zipf и кап доли».

### 6.5 Источник пула

Два накопителя, не смешанные. **Месяц (`month`)** — 0.3% оборота DEX на сторону, Zipf Influence, окно периода. **Фарм (`farm`)** — 0.5% оборота DEX, талоны за валидную смену в маяке, окно 14 суток. `spend_protocol` равен нулю, поэтому Capital spending не создаёт стоковый поток. Tax, cork и NFT не являются дополнительными кранами. Hop обоих котлов = 0: конвейер (M4) покупает стоки снаружи тика. Актив приза — сток, не `$CORP`.

Конвейер снаружи тика. Он получает три непересекающиеся ETH-ноги: `treasury_fund_eth` для buyback `$CORP` и payroll, `treasury_leaderboard_eth` для котла `month`, `treasury_farm_eth` для котла `farm`; одна нога не пересчитывается из другой. `pool_in` — записанный вход по активу, измерение баланса, не накопитель ожиданий. `returnUnsettled` на паузе возвращает боту-вкладчику только unsliced выбранного котла; нарезанное `owed` не входит. Отказ RPC → `pool_in=0`, `PRIZE_HOP_STALE`, экономика тика жива. Тот же транш выкупа 0.33% (L22).

Бюджет сезона по ноге трат — 0 после `D-M-16`. Таблицы GENERATED считают пул как при live=1 (сайзинг). Флаг без пересчёта роняет `L220`. Клейм отвечает по каждому активу, не одним числом `$CORP`. Лидерборд показывает пустой пул и непокрытый клейм, не вывод владельца.

### 6.6 Расхождения T7

| id | суть |
|---|---|
| **R-T6-3** жив | окно фрагментов ≠ период призов ≠ сезон Influence |
| **R-T6-5** закрыт для призов | слот кошелька + интеграл + qualify + стейк; кап фрагментов на город не менять |
| **R-T7-1** | Исторический BRIEF предлагал ETH→приз с tax и `$CORP`-приз. Текущий pack использует Stock Token legs `month`/`farm`; hop выполняется снаружи тика по существующим пулам |
| **R-T7-2** | Историческая phase-label формулировка говорила «выплата v1.1». Текущий pack имеет `season_prizes_live=1`; sizing и custody-контракт описаны, но production buyback/claim transport остаётся отдельным runtime-проводом |
| **R-T7-3** | §8 «efficiency против среднего» = нейтраль 10000, не среднее сервера |
| **R-T7-4** | остаточный сивил N ключей × сезон. Не KYC |
| **R-T7-5** | активный T3-кит может вести за счёт стейк-бонуса; гейт — вялый кит |

Касса: приз не минтит Capital. Protocol-CORP уже вычтен в `_apply_spend`. Σ payout ≤ pool.

