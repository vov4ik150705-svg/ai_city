# Corporator — балансная таблица v1

Выход задачи T2. Параметры и формулы живут здесь; широкие таблицы значений — в `content/out/GENERATED.md`. Команда: `python content/build.py`. Канон механик — `DESIGN.md`, форма данных — `docs/CONTENT.md`.

---

## 1. Точка нормировки и почему 240 тиков

`Workshop` L1 с агентом L1 даёт за тик `1 / normalization_payback_ticks` своей стоимости постройки. Параметр `normalization_payback_ticks = 240`: десять суток города при `ticks_per_city_day = 24`.

Горизонт фонда зарплат — `payroll_daily_divisor = 14` суток (`DESIGN.md` §2.5): дневной бюджет = баланс / 14. Чистая окупаемость обязана сесть **под** этот горизонт, иначе город растёт быстрее, чем фонд восстанавливается. Energy не плата Capital за юнит (§5); это капекс, отвлечённый в Power Node. Доля `energy_capex_share_bps = 3300` поднимает нетто-окупаемость до 319 тиков = 13.29 суток города — строго меньше `14 × 24 = 336`. Держит L32.

Гросс 240 — точка нормировки выхода. Нетто 319 — следствие капекса энергии, не второго параметра окупаемости.

---

## 2. Масштабная цепочка

От `capital_unit_usd` до `workshop_cost_l1`. Все деления — floor, сначала умножение.

```
deposit_capital_gross = reference_deposit_usd_8dec / capital_unit_usd
deposit_capital_net   = deposit_capital_gross × (10000 − vault_fee_bps) / 10000
starter_city_cost     = deposit_capital_net × starter_city_cost_share_bps / 10000
starter_weight_bps    = cost_weight(workshop) + cost_weight(power_node)
                      + cost_weight(agent_hub) + hire_weight(1) + hire_weight(2)
workshop_cost_l1      = starter_city_cost × 10000 / starter_weight_bps
```

`reference_deposit_usd_8dec = 100 $` — середина полосы 50–150 $ (`DESIGN.md` §12). Дневной лимит банка на сиде 105 $ на всех игроков (`docs/LAUNCH.md` §6): депозит выше этой полосы сделал бы очередь на выход связывающим ограничением вместо экономики.

`starter_city_cost_share_bps = 5000`: половина чистого депозита покупает минимальный рабочий город §5.12, половина остаётся на первый апгрейд. Стартовый набор — Workshop + Power Node + Agent Hub + два найма; без второго агента завод встаёт, когда инженера пересаживают на узел.

Контрольные значения и остаток деления — `content/out/GENERATED.md`, секция «T2: масштабная цепочка». Остаток = `starter_city_cost − Σ пяти позиций`; он не превышает числа позиций (сейчас 3 ≤ 5). Единицу `capital_unit_usd` T2 не трогает: окно `1 < rate_raw < 2000` на сиде даёт курс 51, укрупнение оставляет курс без запаса вниз (R-T2-1).

`tick_length_real_seconds = city_day_real_hours × 3600 / ticks_per_city_day` = 3750. Целое; второго параметра часов тика нет — `tick_length_city_hours = 1` уже в `time.json`.

`reference_deposit_wei = reference_deposit_usd_8dec × 10^18 / eth_usd_8dec` — производная от снимка ETH/USD, с его датой.

---

## 3. Что параметр, а что производное

Граница та же, что в `docs/CONTENT.md` §3: вычислимое не хранится. Сквозные числа нормировки живут в `content/params/balance.json` (T2 — единственный владелец), чтобы не расползтись по шести файлам.

| Величина | Откуда |
|---|---|
| `normalization_payback_ticks` | параметр, 240 |
| `energy_capex_share_bps` | параметр, 3300 |
| `cost_growth_bps`, `output_growth_bps`, `energy_growth_bps`, `build_time_growth_bps` | параметры кривых |
| `workshop_cost_l1` | **выводится** цепочкой §2 |
| `cost(a,L)`, `output(a,L)`, `energy(a,L)`, `build_time(a,L)` | **выводятся**; имена `level_cost` / `level_output` / `level_build_time` закрыты |
| `power_node_cost_weight_bps` | **выводится** = `energy_capex_share_bps`; на архетипе не хранится (L09) |
| `robotics_lab` `output_weight_bps` | **выводится** = `affinity_neighbour_bps`; на архетипе не хранится |
| `hire_cost(N)` | **выводится** из `hire_cost_share_bps` и `hire_growth_bps` |
| `agent_level_mult_bps(L)`, `xp_to_next`, `xp_total` | **выводятся** |
| стоимость и время узла research | **выводятся** из `|effect_bps|` и `research_cost_per_effect_bps` |
| `population_threshold(L)`, `build_slots(L)`, `city_level_max` | **выводятся** |
| `bank_level_share_bps(L)`, `bank_daily_limit_wei(L)` | **выводятся** из живой глубины T1 |
| `S_min(ticker)` | **выводится** из снимка фида; заморожен L6 (2026-08-29) |
| `S_ref` | не хранится: равен `S_min` |
| `building_inputs` | **выводится** из забора energy/compute за тик; на архетипе не хранится |
| `upgrade_roi_lmax_over_l1_bps` | **выводится** `(output_growth / cost_growth)^(Lmax−1)` |
| `return_at_unit_capture_bps`, `return_min_bps`, `return_opt_bps`, окно A | **выводятся** |
| `tick_length_real_seconds`, `reference_deposit_wei` | **выводятся** |

Три отклонения веса стоимости от тирного умолчания, каждое с `why`: `agent_hub` 5000, `bank` 15000, `exchange` 12000. `workshop` `output_weight_bps = 10000` и `energy_base_per_tick = 100` — единицы счёта нормировки.

---

## 4. Формы кривых

Порядок фиксирован и одинаков в `content/build.py` и здесь: одно деление в конце, `num × growth^(L−1) / 10000^(L−1)` после масштаба веса. Итеративный `mulDiv` на каждом шаге дал бы другой floor — другой хеш.

```
cost(a,L)       = workshop_cost_l1 × cost_weight_bps(a) / 10000
                  × cost_growth_bps^(L−1) / 10000^(L−1)
output(a,1)     = cost(a,1) × output_weight_bps(a) / 10000 / normalization_payback_ticks
output(a,L)     = output(a,1) × output_growth_bps^(L−1) / 10000^(L−1)
energy(a,L)     = energy_base(a) × energy_growth_bps^(L−1) / 10000^(L−1)
build_time(a,L) = ceil( cost_weight_bps(a) × build_time_growth_bps^(L−1) / 10000^L ), минимум 1
```

Выход уровня N считается **от** `cost(a,1)` через `output_growth`, не от `cost(a,L)`. Иначе рост выхода поедет вслед за ростом стоимости, и подлинейность пропадёт.

Показатель подлинейности: `output_growth_bps / cost_growth_bps = 18000 / 25000 = 0.72`. ROI уровня = 0.72 предыдущего. `output ∝ cost^0.642`. Ширина побеждает глубину; L33 ловит обе стороны: `output_growth ≥ cost_growth` и `ROI(Lmax)/ROI(L1) < upgrade_roi_floor_bps` (пол 4000 bps в `meta.json`: L3 не хуже 40% ROI первого уровня). Текущая пара даёт 5184 bps.

`energy_growth_bps = 16000` ниже роста выхода: апгрейд покупает энергоэффективность — компенсация за худший ROI. `build_time_growth_bps = 16000`: синергия L3 строится 11 тиков, под потолком оффлайна 12 (L34).

`building_level_max = 3` (`docs/CONTENT.md` §4, §3 T0). City Hall предпостроен: стоимости и времени нет, уровень равен уровню города.

Таблица 18 × 3 — `content/out/GENERATED.md`, «T2: кривые уровней».

L31: `output(workshop,1) × 240` воспроизводит `cost(workshop,1)` в пределах остатка целочисленного деления.

---

## 5. Энергия: разрыв 10 → 13.3 суток это капекс

§5.3 шаг 4 списывает входы **в юнитах** energy и compute. §2.3 такого стока Capital не знает: нет «платы Capital за киловатт». Energy стоит денег один раз — как здание, которое её производит.

На единицу капитала производственного здания отвлекается `energy_capex_share_bps` капитала в Power Node. Поэтому нетто-окупаемость Workshop = `240 × (10000 + 3300) / 10000 = 319` тиков, не 240. Это те самые 13.29 суток под горизонтом 14.

Ночь — половина суток, energy дороже (`night_energy_premium_bps = 2000`, §3.2). Размеренный под ночь узел даёт +10% к капексу энергии в среднем. `power_node_output_per_tick = workshop_energy × (10000 + night) / 10000` = 120. Один узел покрывает Workshop L1 ночью; иначе город по умолчанию простаивает (L38).

`energy_plant_output_per_tick` выводится из веса маяка, выхода узла и `energy_plant_efficiency_bps = 20000`: плита даёт вдвое больше энергии на единицу капитала, чем узел (§4.2). Реализованная кратность после floor — в `GENERATED.md` (19998 bps против параметра 20000: промежуточное деление спрятало бы 2 bps).

`workshop.energy_base_per_tick = 100` — единица счёта. Разрешение модификаторов 1%, все энергетические модификаторы канона не тоньше 5% (Grid 15%, ночь 20%, Overclock, Frugal). Остальные производственные здания выводят потребление из веса стоимости. `inputs` не хранятся: здание расходует `energy`, если выведенный забор energy > 0, и `compute`, если выведенный забор compute > 0. Забор compute у `robotics_lab` — тот же mulDiv от веса, что energy; `ai_research_center` и `data_center` compute производят и не расходуют. L43 читает выведенный список. L32: нетто не больше `горизонт − payback_horizon_margin_ticks` (12 тиков = половина суток города).

---

## 6. Возврат депозита

Депозит тратится на здания, не стейкается: обещать 100% нельзя (`DESIGN.md` §3, запрещённый список). Цель на сезон 90 суток города — полосы 35–45% минималист и 70–90% оптимизатор (`docs/archive/BRIEF.md` §6 T2). Границами полос владеет T2 (`return_minimalist_*` / `return_optimizer_*` в `meta.json`); достижимостью усиления A — T3.

Замкнутый круг одного игрока, захват ровно своего взноса в фонд:

```
deposit_to_capital_bps     = (10000 − creator_tax_bps) × (10000 − vault_fee_bps) / 10000
fund_contribution_bps      = deposit_to_capital_bps × spend_fund_bps / 10000
bank_exit_return_bps       = 10000 × 10000 / (10000 + bank_markup_bps)
                             × (10000 − creator_tax_bps) / 10000
return_at_unit_capture_bps = fund_contribution_bps × bank_exit_return_bps / 10000
```

9604 → 4802 → 8908 → **4277 bps = 42.77%**. Это потолок замкнутой системы. Сто процентов требуют захват `10000 / 4277 ≈ 2.34×` своего взноса, то есть за счёт других городов (`DESIGN.md` §2.7).

Две когорты равного размера делят фонд пропорционально запросам; запросы пропорциональны аптайму. Отношение аптаймов ровно 2:1 = `ticks_per_city_day / offline_cap_city_hours_base` = 24/12; `residual_idle_bps` сокращается в отношении, нового параметра нет.

```
uptime_optimizer_bps = 10000 − residual_idle_bps
uptime_minimalist_bps = offline_cap × 10000 / ticks_per_city_day
                        × (10000 − residual_idle_bps) / 10000
return_* = return_at_unit_capture × 2 × A × uptime_* / ((uptime_min + uptime_opt) × 10000)
```

При `A = fund_amplification_target_bps = 14000` (прежнее имя `fund_external_amplification_target_bps`, R-T3-5): **3991 bps и 7983 bps** — середины полос. Порядок fused (умножения, одно деление) совпадает с генератором; stepwise `capture` затем `× unit` даёт те же 3991/7983 на каноне.

Окно приёмки по A — границы, при которых **оба** возврата остаются в своих полосах. Полосы и потолок оффлайна дают одно отношение 2, поэтому окна должны совпасть. Floor их разводит на верхней границе: пересечение печатает `python content/build.py` (сейчас **[12275, 15783]**). L42 читает границы из `meta.json`, не из констант в коде. G1 открыл MSFT/COIN: формула окна T2 по-прежнему от базы оффлайна 12, пересечение не съехало. G2 снял нули Train/XP; калибровка A_t2 не съехала (когорта T2 без стека Train, `R-T5-12`). G5 снял ноль `idle_reduction` компаньона; формула окна T2 по-прежнему от `residual_idle_bps` в `balance.json`. Калибровка `sim.py` A_t2 — свидетель рычагов, не подгонка полосы. G7 сводит четыре рычага вместе и ставит `window_a_ratified=1`; конверт T2 в `meta.json` не подогнан (`L313`, `A-G-11`).

**Передача T3.** Проверить, что при сценариях оборота `docs/LAUNCH.md` §3 усиление фонда (резерв + внешний сбор) попадает в окно A из генератора, и назвать число активных городов, при котором это так. Параметр-якорь: `fund_amplification_target_bps`.

Полная таблица — `GENERATED.md`, «T2: возврат депозита и окно A».

---

## 7. Агенты

`hire_cost(N) = workshop_cost_l1 × hire_cost_share_bps / 10000 × hire_growth_bps^(N−1) / 10000^(N−1)`, N = 1..`slots_cap` (20). Первый агент — 15% Workshop: связка здание+агент есть единица (§2.8), агент не бесплатный. Пол `hire_cost_floor_share_bps = 1000` (L44): дешевле 10% Workshop — выход за факт постройки. `hire_growth_bps = 11200`: двадцатый стоит 8.6× первого; полный ростер ≈ 10.81 Workshop-эквивалента, около двух третей стоимости зданий L1 стартового города. При 11500 ростер стоил бы дороже города.

```
agent_level_mult_bps(L) = 10000 + (L − 1) × agent_level_gain_bps
xp_to_next(L)           = normalization_payback_ticks × xp_growth_bps^(L−1) / 10000^(L−1)
xp_total(L)             = Σ xp_to_next(1..L−1)
season_ticks            = season_city_days × ticks_per_city_day
```

`agent_level_max = 5`, титулы §5.7 как функция уровня. `agent_level_gain_bps = 1500`: L5 даёт ×1.60, и `affinity_neighbour_bps × 1.60 = 0.96 < 1.0` — прокачка никогда не делает чужую посадку лучше свежего родного (L35).

`xp_growth_bps = 16000`: `xp_total(5) = 2221` против сезона 2160 и против сезона с Handbook 2376. L5 требует узла Handbook +10% XP (§5.11). L41 ловит тривиальность (`≤ season`) и недостижимость (`> season × Handbook`).

Таблица найма 1..20 и XP — `GENERATED.md`.

---

## 8. Research

Узлы — оси в `research.json` (`sign × key_unit × tier`), не список с `effect_bps` и ценой. v1 тройка сохраняется: Grid −1500 bps `energy_cost_bps`, Tools +1000 bps `output_bps`, Handbook +1000 bps `xp_rate_bps`. v1.1 добавляет Circuits −1000 bps `compute_cost_bps` и Lathe +1000 bps `upgrade_speed_bps` той же грамматикой (`DESIGN.md` §5.11).

```
cost(node) = fused_effect_cost(workshop_l1, research_cost_per_effect_bps, effect, cost_growth_bps, 0)
time_ticks(node) = normalization_payback_ticks × |effect_bps| / 10000
```

`research_cost_per_effect_bps = 30000`: 3.0 Workshop за 100% эффекта. Tools +10% выходит в 0.30 Workshop — цена узла равна вкладу +0.1 Workshop в город из трёх. Пол `node_cost_floor_per_effect_bps = 20000` (L44): две трети вклада; дешевле — подпечатка выхода. Отдельных чисел времени нет: 240 переиспользуется как единственный горизонт. L40: стоимость или время, разъехавшиеся с формулой, — ошибка, если нет строки в таблице исключений. Исключений 0.

Узлы — оси `content/params/research.json`. Таблица с Capital и тиками — `GENERATED.md`, «T2: research». С T5 узлы — строки общей таблицы модификаторов и подчинены потолку своего ключа; величины не копируются.

---

## 9. Уровень города, слоты, Population

```
population_threshold(L) = city_level_population_base × city_level_population_growth_bps^(L−2) / 10000^(L−2), L ≥ 2
build_slots(L)          = slots_at_city_level(L) + autonomous_playable_count
population(city)        = занятые слоты агентов × population_per_job + housing_capacity
city_level_max          = уровень, на котором slots_at_city_level упирается в slots_cap
```

`population_per_job = 50`: одно рабочее место содержит домохозяйство (§8). `city_level_population_base = 400` = 8 стартовых слотов × 50: второй уровень города берётся полностью укомплектованным стартовым набором. `city_level_population_growth_bps = 15000`: L7 требует 3037 против 1000, доступных с рабочих мест при потолке 20 агентов — верхние уровни структурно требуют жилья AAPL (§7.2). (Бриф называл 3038; fused floor даёт 3037, R-T2-13.)

`build_slots` = слоты агентов плюс число играбельных автономных архетипов. Новых чисел нет: здание без агента почти не качает (§5.3), поэтому зданий больше, чем агентов, имеет смысл ровно на автономные. Сейчас три автономных в скоупе v1 → L1 даёт 8+3=11 слотов застройки.

Population растёт с рабочих мест с первого тика. Жильё AAPL нужно, чтобы взять уровень города 2 без потолка 20 агентов — иначе Exchange с гейтом «уровень 2» недостижим до открытия AAPL (R-T2-5).

Таблица — `GENERATED.md`, «T2: уровень города».

---

## 10. Банк

```
bank_level_share_bps(L) = 10000 − (10000 − bank_level_gain_bps)^L / 10000^(L−1)
bank_level_max          = 1 + building_level_max
bank_daily_limit_wei(L) = live_depth_wei × bank_daily_limit_pool_share_bps / 10000
                          × bank_level_share_bps(L) / 10000
```

Насыщающаяся лестница доли пула, никогда не достигающая 10000 bps (L37). `bank_level_gain_bps = 2500` → **2500 / 4375 / 5782 / 6836**. Бриф ожидал 5781 на L3 (округление 4218.75→4219); fused floor даёт 5782 (R-T2-10). Персональный предел до урезания — `bank_daily_limit_wei(уровень игрока)`. При превышении суммы запросов над глобальным лимитом — пропорциональное урезание тем же механизмом, что `payroll_ratio` (§2.5), код `BANK_DAILY_LIMIT_REACHED`, коэффициент клиенту. Новой механики нет.

L=0: банка нет, доля 0, лимит 0. «На 1 уровне лимит маленький» (§7.1) теперь число: 2500 bps от 1% живой глубины (R-T2-9). Лестница не меняет круг трения: L13/L14 остаются на ставках vault и markup, не на доле пула.

Таблица — `GENERATED.md`, «T2: лестница банка».

---

## 11. Стейк

`S_min` хранится в атомах токена (18 dec, единица `tokens` как у `token_supply`) и выводится из снимка: `S_min(ticker) = district_stake_usd_target_8dec × 10^18 // price_ticker_usd_8dec`. Цель `district_stake_usd_target_8dec = 100 $` — то же решение по весу, что вход в игру (§12); стейк возвращается, депозит тратится. `S_ref` не хранится: равен `S_min`. При 2×S_min игрок берёт половину максимального бонуса, при 3× — две трети; маржинальная отдача кита умирает внутри одного порядка от порога (§4.5).

Бонус — целочисленная гипербола вместо `exp` (float на хешируемом пути запрещён, L10):

```
stake_bonus_bps = stake_bonus_max_bps × (stake − S_min) / (stake − S_min + S_ref)
```

При `stake ≤ S_min` бонус 0, деления на ноль нет. При 2×S_min — половина максимума (500 bps из 1000), не 63% у `1 − exp(−1)`: киту скупее (R-T2-3).

**Снимок фида снят 2026-08-29T23:19:30Z.** RPC `https://rpc.mainnet.chain.robinhood.com` (chain id 4663), `latestRoundData()` шести прокси из `docs/LAUNCH.md` §9. Голый POST без Origin даёт Cloudflare 1010; с Origin фид отвечает. L39 падает, если порог записан без снимка, в долларах, без `at`, без тикера или с атомами не из формулы.

Цена `S_min` в Capital гуляет, сам гейт — нет. Capital в долларах = `capital_unit_usd × rate_raw / rate`. Полоса ±15% даёт диапазон `[10000/11500, 11500/10000]` = **[8695, 11500] bps** от номинала. Храповик 200 bps/сутки при полосе 1500 держит нижнюю границу **8 суток** города накопленного роста (`docs/LAUNCH.md` §14). На потолке 2000 отклонение вверх не ограничено: `rate_raw` может уйти сколь угодно высоко при зажатом `rate`. Гейт района иммунен, потому что порог заморожен в токенах (§4.5); гуляет только витрина.

---

## 12. Дрожь и ночная надбавка

```
jitter_bps = 10000 + (prng mod (2 × jitter_width_bps + 1)) − jitter_width_bps
prng       = int(sha256(f"{city_id}:{tick_index}:{agent_id}")[:8])
```

`jitter_width_bps = 500`: заметно в логе одного тика, но `2 × 500 < agent_level_gain_bps` — дрожь не переворачивает соседние уровни агента (L36). Черта Steady сужает ширину вдвое. Границы [9500, 10500], симметрия вокруг 10000; Steady [9750, 10250]. Чистая целочисленная функция, без системного времени.

Ночная надбавка — §5. Формат сида — константа генератора, входит в хеш пака через код, не через параметр.

---

## 13. Расхождения с каноном

**R-T2-1. Масштаб чисел §2.2.** «Здание — десятки тысяч, тик — десятки» были иллюстрацией при другой единице. `workshop_cost_l1` и `output(workshop,1)` выведены; `capital_unit_usd` не укрупняется. *Решение: правка §2.2, ссылка сюда.*

**R-T2-2. В `HUD.md` не было правила показа больших чисел Capital.** Топбар с `87 650` не масштабируется до десятков миллионов. *Решение: SI-суффиксы, три значащих, точное целое в тултипе.*

**R-T2-3. `exp` в §4.5 против целочисленного пути.** L10 запрещает float на хешируемом пути. *Решение: гипербола; при 2×S_min половина максимума вместо 63%.*

**R-T2-4. Остаток `CORP/USDG` в §4.1.** Хвост T1: пул уже `CORP/ETH`, hop `CORP → ETH → USDG → сток` в §7.2. *Решение: пословная правка §4.1 и `HUD.md`.*

**R-T2-5. Population как гейт уровня города против гейта Exchange на уровне 2.** Без жилья порог L2 = 400 не набрать с 8 слотов × 50, пока нет AAPL. *Решение: Population растёт с рабочих мест с первого тика; жильё AAPL нужно верхним уровням. Правка §8.*

**R-T2-6. Compute производится и не расходуется в v1.** Scientist в v1.1; AI Research Center даёт compute, потребителя не было. *Решение: забор compute у `robotics_lab` выводится из веса стоимости; `inputs` не хранятся. L43 зеркало L07 по выведенному списку. Правка §4.4 / §7.3.*

**R-T2-7. Статус City Hall.** Кривой стоимости у стола основателя быть не должно. *Решение: `prebuilt: true`, уровень равен уровню города. Правка §7.1.*

**R-T2-8. Слабость L28 на 1499 bps.** Прежний предикат `rise < band` пропускал шаг в 1499 при полосе 1500. *Решение: `rise × ratchet_step_band_divisor ≤ band`; атака на 1499.*

**R-T2-9. «На 1 уровне лимит маленький» §7.1 без числа.** *Решение: 2500 bps от 1% живой глубины; правка §7.1.*

**R-T2-10. Лестница банка L3: 5782 против 5781 в задании T2.** Fused floor `(7500^3)/10000^2 = 4218`, `10000 − 4218 = 5782`. Не подгонять.

**R-T2-11. `workshop_cost_l1` = 22 346 368 при весе 21 480 bps, не ≈22 299 651 при 21 525.** Пример в задании считал второй найм при `hire_growth_bps = 11500`; канон T2 — 11200, иначе ростер дороже города.

**R-T2-12. Окна A по полосам не совпали на верхней границе.** 15789 против 15787 из-за `2×floor` против `floor(2×)`. Пересечение [12278, 15787].

**R-T2-13. Порог Population L7 = 3037, не 3038.** `400 × 1.5^5` с floor.

**R-T2-15. Реализованная кратность Energy Plant 19998 bps против параметра `energy_plant_efficiency_bps = 20000`.** Fused `mulDiv` после floor выхода 1818. Промежуточное деление давало ровно 20000 и прятало 2 bps. *Решение: генератор считает fused; параметр не подгонять.*

**R-T2-16. `inputs` дублировали энергетическую базу и покрывали не все здания.** Workshop и Robotics Lab хранили список, остальные производственные здания — нет, хотя забор выводился. L43 смотрел только поле. *Решение: `inputs` выводятся; хранение ловит L09; L43 читает забор.*

**R-T2-17. L33 молчал на `output_growth = 10001`.** Нижняя граница `≤ 10000` ловила только нулевой рост; ROI L3 падал до 16% от L1. *Решение: пол `upgrade_roi_floor_bps = 4000`; отношение ROI Lmax к L1.*

**R-T2-18. `research_cost_per_effect_bps = 1` и `hire_cost_share_bps = 1` проходили.** L40 сверял формулу, не пол. *Решение: L44, полы 20000 и 1000 в `meta.json`.*

**R-T2-19. L32 молчал на капекс 3999 (нетто 335 против горизонта 336).** Порог без запаса. *Решение: `payback_horizon_margin_ticks = 12` (половина суток города).*

---

## 14. Что передано дальше

| Задача | Параметры и вопросы |
|---|---|
| **T3** | `fund_amplification_target_bps`; окно A `[12278, 15787]`; сценарии `docs/LAUNCH.md` §3 — попадает ли усиление, при скольких активных городах; `season_city_days` как горизонт прогона |
| **T4** | кривые уровней, `building_level_max`, узлы research как строки модификаторов, `cost_weight` / тиры, синергии |
| **T5** | закрыт: форточка 13300, бесплатный стек Specialist×Overclock 12650 / net 280 ∈ [240, 324], запас 650 bps; Tools в платном стеке (16802 / 211 без цены, 274 с полом). `docs/PROGRESSION.md` §T5.6 |
| **T6** | закрыт: `docs/PRIZES.md`. Кран `protocol_prizes_bps` = 4000 зарезервирован, T6 не тратит. Cork в пул не забран (R-T6-1) |
| **T7** | закрыт: `docs/PRIZES.md` сезоны. Длина = `season_city_days`. Influence — продукт интенсивностей, Zipf топ-10, выплата `$CORP` после пересчёта. Кран 4000 bps |
| **T8** | закрыт: `docs/COMPANION.md`. G5 снял ноль `idle_reduction`; формула окна T2 по-прежнему от `residual_idle_bps`; аптайм компаньона читает величину, не флаг |
| **T2 остаток** | нет: шесть `S_min` заморожены L6 |

---

## 15. Как воспроизводится

```
python content/build.py      собрать пак, вывести GENERATED.md, напечатать контрольные T2
python content/lint.py       44 правила
python content/attack.py     каждое правило ловит свою поломку; пробы конструкции
```

Источники параметров: `content/params/balance.json`, `research.json`, `buildings.json`, `districts.json`, `meta.json`, ставки круга в `economy.json`, сид-глубина в `launch.json`. Широкие таблицы не копировать сюда — только `content/out/GENERATED.md`.
