# Сгенерированные таблицы

Артефакт сборки. Источник — `content/params/`, генератор — `content/build.py`,
версия правил `0.24.0`, пак `204`, хеш `16ed396bc2a98085…`.
Руками не править: следующая сборка перезапишет.

## Соответствие роли и здания

Выведено из полей `contour` и `contour_secondary` каждого здания и `home_contours` каждой роли.
Сверено клетка за клеткой с `DESIGN.md` §5.8. Легенда: `@` родной, `o` сосед, `-` слот роль не берёт.

| Здание | engineer | logistician | trader | scientist | manager |
|---|---|---|---|---|---|
| `agent_hub` | - | - | - | o | - |
| `ai_research_center` | o | - | - | @ | - |
| `bank` | - | - | @ | - | o |
| `city_hall` | - | - | - | - | @ |
| `clearing_house` | - | - | o | - | @ |
| `cloud_campus` | - | - | - | o | @ |
| `data_center` | o | - | - | @ | - |
| `drone_depot` | - | @ | - | - | - |
| `energy_plant` | @ | o | - | - | - |
| `exchange` | - | - | @ | - | - |
| `finance_tower` | - | - | @ | - | o |
| `flagship_store` | - | o | @ | - | - |
| `fleet_yard` | o | @ | - | - | - |
| `logistics_hub` | o | @ | - | - | - |
| `power_node` | @ | o | - | - | - |
| `retail_complex` | - | o | @ | - | - |
| `robotics_lab` | o | - | - | - | - |
| `workshop` | @ | o | - | - | - |

## Экономика: выведенные величины

| Величина | Значение | Из чего |
|---|---|---|
| Курс минта в vault | 1960 Capital за $CORP | якорь × (1 − сбор vault) |
| Курс вывода через банк | 2200 Capital за $CORP | **на потолке якоря** × (1 + надбавка); рабочий курс — mint_rate × (1 + надбавка), R-T3-1 |
| Лучший курс вывода с Trader | 2130 Capital за $CORP | якорь × (1 + потолок надбавки) |
| Цена входа | 2.00% | сбор vault |
| Цена выхода | 9.10% | 1 − якорь / курс вывода |
| Цена выхода с Trader | 6.11% | 1 − якорь / лучший курс |
| **Полный круг** | **14.45%** | 2% → 2% → выход → 2% |
| Круг с максимальным Trader | 11.64% | то же с курсом 2130 |
| Сбор, видимый трейдеру на DEX | 3.00% на сторону | наш сбор + комиссия кривой pons |
| Эффективная ставка фонда | 100 bps оборота | тело ставки; приращение в корзину |
| Сплит сбора (фонд / leaderboard / active-work / студия) | 100 / 20 / 60 / 20 bps | D-M-12 |
| Сумма долей траты | 100% | сжигание + фонд + протокол |

## Время

| Величина | Значение |
|---|---|
| Темп времени города | 9600 bps от реального |
| Тиков в сутках города | 24 |
| Потолок оффлайна в тиках | 12 |
| Полный прокрут фазы | 24 суток |
| Часов работы банка в неделю | 72 |

## Слоты агентов по уровню города

| Уровень | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Слотов | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 20 | 20 | 20 | 20 | 20 |

Потолок достигается на уровне 7.

## Покрытие пар районов синергиями

Покрыто 6 пар из 15. Не покрыты: `automation+consumer`, `automation+energy`, `automation+logistics`, `compute+consumer`, `compute+finance`, `consumer+energy`, `consumer+finance`, `energy+finance`, `finance+logistics`.

## Скоуп первой версии

Выведено из `playable_v1` районов: base играбельно всегда, маяк — по своему району,
синергия — если играбельны оба района. Сверено с `DESIGN.md` §11.

Играбельно 18 зданий из 18: `agent_hub`, `ai_research_center`, `bank`, `city_hall`, `clearing_house`, `cloud_campus`, `data_center`, `drone_depot`, `energy_plant`, `exchange`, `finance_tower`, `flagship_store`, `fleet_yard`, `logistics_hub`, `power_node`, `retail_complex`, `robotics_lab`, `workshop`.

Синергии играбельны 6: `clearing_house`, `data_center`, `drone_depot`, `fleet_yard`, `retail_complex`, `robotics_lab` — правилом `requires`, не списком. Автономный слот: `robotics_lab`.

## Запуск: стоимость доли supply (ETH)

Выведено из `eth_phantom_quote` и `eth_graduation_threshold`. Команда: `python content/build.py`.
Чистая котировка — без сбора; брутто — с `curve_fee_bps` + `creator_tax_bps`. ETH/USD = 2500.87 $ (снимок `eth_usd_8dec`, не константа).

| Доля supply | Чистый ETH (wei) | Брутто ETH (wei) | В долларах |
|---|---:|---:|---:|
| 1.00% | 16969696969696969 | 17494532958450483 | 43.75 |
| 2.00% | 34285714285714285 | 35346097201767304 | 88.40 |
| 2.50% | 43076923076923076 | 44409199048374305 | 111.06 |
| 3.00% | 51958762886597938 | 53565734934637049 | 133.96 |
| 5.00% | 88421052631578947 | 91155724362452522 | 227.97 |
| 10.00% | 186666666666666666 | 192439862542955325 | 481.27 |
| 15.00% | 296470588235294117 | 305639781685870223 | 764.37 |
| 20.00% | 420000000000000000 | 432989690721649484 | 1082.85 |
| 30.00% | 720000000000000000 | 742268041237113402 | 1856.32 |
| 40.00% | 1120000000000000000 | 1154639175257731958 | 2887.60 |
| 50.00% | 1680000000000000000 | 1731958762886597938 | 4331.40 |
| 71.42% (sold_at_grad) | 4200000000000000000 | 4329896907216494845 | 10828.51 |

## Запуск: выбранные величины и контроль KOTS

| Величина | Значение | Из чего |
|---|---|---|
| Q0 / T | 4000 bps | getLaunchConfig(0) ETH |
| Доля supply к graduation | 7142 bps | T / (Q0 + T) = 5/7 |
| Покупка на лаунче, доля 0.00% | 0 wei чистыми / 0 брутто | launch_buy_share_bps = 0 |
| Покупка на лаунче, $ | 0.00 | брутто × снимок ETH/USD; 0 значит деплой без покупки |
| Покупка на лаунче, токены | 0 | S × net / (Q0 + net); 0 при share 0 |
| Разовый доход фазы кривой | 553996800000000000 wei | ставка × churn × T |
| Точка перелома внешний/внутренний | 72250 bps | круг / (2 × ставка фонда) |
| Точка перелома на полной ставке | 36125 bps | круг / (2 × creator_tax) |
| Глубина пула после graduation | 4200000000000000000 wei | сид ≈ T; владелец сид не доливает |
| Токены в пул | 204081632653061224489795918 | 10/49 supply при Q0/T = 0.4 |
| Дневной лимит банка (на сиде) | 210000000000000000 wei | 500 bps живой глубины; абсолют не параметр |
| KOTS первая покупка (формула) | 29110503406203983883234356 | сверка с фикстурой |
| KOTS чистая продажа кривой | 714285714285714285714285714 | S × T / (Q0 + T) |

## Плавающий якорь минта

Курс минта — не 2000. 2000 — абсолютный потолок. Рабочий курс = min(храповик(clamp(P_CORP_USD / capital_unit_usd, EMA±band)), 2000).
Вниз — сразу. Вверх — не быстрее шага за сутки города. Трение §2.6 считается вокруг этого курса и от него не зависит.

| Величина | Значение | Из чего |
|---|---|---|
| Рабочий курс на сиде (rate_raw) | 51 Capital за $CORP | P_CORP_USD / capital_unit_usd |
| Курс минта после зажима, храповика и потолка | 51 | min(ratchet(clamp), capital_anchor) |
| Полоса зажима | 43 … 58 | ±anchor_band_bps от rate_ref |
| Потолок связывает при цене $CORP | 0.002000 $ | capital_unit_usd × 2000 |
| ETH на удержание сдвига +band (не цена атаки) | 303998223800715489 wei | CPMM; покупка $CORP, не убыток |
| Внешних входов цены | 2 | eth_usd, corp_eth |
| Суток города до честного 10× | 117 | храповик выбранного шага |
| Суток удержания края полосы | 8 | пока шаг не съест ±band |

Таблица компромисса по `anchor_rise_max_bps_per_city_day`. Команда: `python content/build.py`.
Колонка «сид» — следующий курс при seed rate после одних суток; 0 значит целочисленный floor заморозил сид.
Выигрыш — держатель, уже сидящий в $CORP на 50 000 $ (разбор: сдвиг пула не убыток). Бледа удержания TWAP с нашей стороны не ограничена: атака окупается, когда бледа меньше этой колонки.

| шаг bps | суток до 10× | суток до полосы | сид после суток | выигрыш на 50 000 $ | выбрано |
|---:|---:|---:|---:|---:|:---:|
| 50 | 464 | 29 | 51→51 стоп | 250 $ |  |
| 100 | 232 | 15 | 51→51 стоп | 500 $ |  |
| 200 | 117 | 8 | 51→52 | 1000 $ | да |
| 300 | 78 | 5 | 51→52 | 1500 $ |  |
| 500 | 48 | 3 | 51→53 | 2500 $ |  |
| 1000 | 25 | 2 | 51→56 | 5000 $ |  |

## Запуск: доход протокола в месяц

Оборот — обеих сторон суммарно, в долларах: от актива котировки не зависит. Ставка — на сторону. Команда: `python content/build.py`.

| Ставка | Низкий 50 000 $ | Средний 300 000 $ | Хайп 2 000 000 $ |
|---|---:|---:|---:|
| 0.50% | 250 $ | 1500 $ | 10000 $ |
| 1.00% | 500 $ | 3000 $ | 20000 $ |
| 2.00% | 1000 $ | 6000 $ | 40000 $ |

## T2: масштабная цепочка и точка нормировки

Выведено из `reference_deposit_usd_8dec`, `capital_unit_usd`, `vault_fee_bps`, `starter_city_cost_share_bps` и весов стартового набора. Команда: `python content/build.py`.

| Величина | Значение |
|---|---:|
| deposit_capital_gross | 150000000 |
| deposit_capital_net | 147000000 |
| starter_city_cost | 73500000 |
| starter_weight_bps | 21480 |
| **workshop_cost_l1** | **34217877** |
| Остаток деления стартового набора | 2 |
| payback_gross_ticks | 240 |
| payback_net_ticks | 319 |
| payback_net_city_days | 13.29 (132916 bps) |
| tick_length_real_seconds | 3750 |
| reference_deposit_wei | 59979127263712228 |

Стартовый набор (пять позиций):

| Позиция | Capital |
|---|---:|
| `workshop` | 34217877 |
| `power_node` | 11291899 |
| `agent_hub` | 17108938 |
| `hire_1` | 5132681 |
| `hire_2` | 5748603 |

## T2: кривые уровней (18 архетипов × 3 уровня)

Источники: `workshop_cost_l1`, `cost_weight_bps` / тирный вес, `cost_growth_bps`, `output_growth_bps`, `energy_growth_bps`, `build_time_growth_bps`. Команда: `python content/build.py`.
Колонка Compute у `output: compute` — выпуск в склад, не забор. City Hall предпостроен: стоимость и время 0, уровень равен уровню города.
ROI Lmax/L1 = 5184 bps. inputs выведены, не хранятся.

| Здание | L | Стоимость | Выход/тик | Energy | Compute | Время |
|---|---:|---:|---:|---:|---:|---:|
| `agent_hub` | 1 | 17108938 | 0 | 0 | 0 | 1 |
| `agent_hub` | 2 | 42772346 | 0 | 0 | 0 | 1 |
| `agent_hub` | 3 | 106930865 | 0 | 0 | 0 | 2 |
| `ai_research_center` | 1 | 85544692 | 0 | 250 | 250 | 3 |
| `ai_research_center` | 2 | 213861731 | 0 | 400 | 400 | 4 |
| `ai_research_center` | 3 | 534654328 | 0 | 640 | 640 | 7 |
| `bank` | 1 | 51326815 | 0 | 0 | 0 | 2 |
| `bank` | 2 | 128317038 | 0 | 0 | 0 | 3 |
| `bank` | 3 | 320792596 | 0 | 0 | 0 | 4 |
| `city_hall` | 1 | — | — | — | — | — |
| `city_hall` | 2 | — | — | — | — | — |
| `city_hall` | 3 | — | — | — | — | — |
| `clearing_house` | 1 | 136871508 | 0 | 0 | 0 | 4 |
| `clearing_house` | 2 | 342178770 | 0 | 0 | 0 | 7 |
| `clearing_house` | 3 | 855446925 | 0 | 0 | 0 | 11 |
| `cloud_campus` | 1 | 85544692 | 0 | 0 | 0 | 3 |
| `cloud_campus` | 2 | 213861731 | 0 | 0 | 0 | 4 |
| `cloud_campus` | 3 | 534654328 | 0 | 0 | 0 | 7 |
| `data_center` | 1 | 136871508 | 0 | 400 | 400 | 4 |
| `data_center` | 2 | 342178770 | 0 | 640 | 640 | 7 |
| `data_center` | 3 | 855446925 | 0 | 1024 | 1024 | 11 |
| `drone_depot` | 1 | 136871508 | 0 | 0 | 0 | 4 |
| `drone_depot` | 2 | 342178770 | 0 | 0 | 0 | 7 |
| `drone_depot` | 3 | 855446925 | 0 | 0 | 0 | 11 |
| `energy_plant` | 1 | 85544692 | 0 | 1818 | 0 | 3 |
| `energy_plant` | 2 | 213861731 | 0 | 2908 | 0 | 4 |
| `energy_plant` | 3 | 534654328 | 0 | 4654 | 0 | 7 |
| `exchange` | 1 | 41061452 | 0 | 0 | 0 | 2 |
| `exchange` | 2 | 102653631 | 0 | 0 | 0 | 2 |
| `exchange` | 3 | 256634077 | 0 | 0 | 0 | 4 |
| `finance_tower` | 1 | 85544692 | 0 | 0 | 0 | 3 |
| `finance_tower` | 2 | 213861731 | 0 | 0 | 0 | 4 |
| `finance_tower` | 3 | 534654328 | 0 | 0 | 0 | 7 |
| `flagship_store` | 1 | 85544692 | 0 | 0 | 0 | 3 |
| `flagship_store` | 2 | 213861731 | 0 | 0 | 0 | 4 |
| `flagship_store` | 3 | 534654328 | 0 | 0 | 0 | 7 |
| `fleet_yard` | 1 | 136871508 | 0 | 0 | 0 | 4 |
| `fleet_yard` | 2 | 342178770 | 0 | 0 | 0 | 7 |
| `fleet_yard` | 3 | 855446925 | 0 | 0 | 0 | 11 |
| `logistics_hub` | 1 | 85544692 | 0 | 0 | 0 | 3 |
| `logistics_hub` | 2 | 213861731 | 0 | 0 | 0 | 4 |
| `logistics_hub` | 3 | 534654328 | 0 | 0 | 0 | 7 |
| `power_node` | 1 | 11291899 | 0 | 120 | 0 | 1 |
| `power_node` | 2 | 28229748 | 0 | 192 | 0 | 1 |
| `power_node` | 3 | 70574371 | 0 | 307 | 0 | 1 |
| `retail_complex` | 1 | 136871508 | 0 | 0 | 0 | 4 |
| `retail_complex` | 2 | 342178770 | 0 | 0 | 0 | 7 |
| `retail_complex` | 3 | 855446925 | 0 | 0 | 0 | 11 |
| `robotics_lab` | 1 | 136871508 | 570297 | 400 | 400 | 4 |
| `robotics_lab` | 2 | 342178770 | 1026534 | 640 | 640 | 7 |
| `robotics_lab` | 3 | 855446925 | 1847762 | 1024 | 1024 | 11 |
| `workshop` | 1 | 34217877 | 142574 | 100 | 0 | 1 |
| `workshop` | 2 | 85544692 | 256633 | 160 | 0 | 2 |
| `workshop` | 3 | 213861731 | 461939 | 256 | 0 | 3 |

Выведенные `inputs` (забор > 0). Команда: `python content/build.py`.

| Здание | inputs |
|---|---|
| `city_hall` | — |
| `workshop` | energy |
| `agent_hub` | — |
| `power_node` | — |
| `bank` | — |
| `exchange` | — |
| `ai_research_center` | energy |
| `energy_plant` | — |
| `logistics_hub` | — |
| `flagship_store` | — |
| `cloud_campus` | — |
| `finance_tower` | — |
| `robotics_lab` | energy, compute |
| `drone_depot` | — |
| `data_center` | energy |
| `fleet_yard` | — |
| `retail_complex` | — |
| `clearing_house` | — |

## T2: найм агентов 1..20

Полный ростер: 108069 bps = 10.8069 Workshop-эквивалента.

| N | weight_bps | Capital |
|---:|---:|---:|
| 1 | 1500 | 5132681 |
| 2 | 1680 | 5748603 |
| 3 | 1881 | 6438435 |
| 4 | 2107 | 7211048 |
| 5 | 2360 | 8076373 |
| 6 | 2643 | 9045538 |
| 7 | 2960 | 10131003 |
| 8 | 3316 | 11346723 |
| 9 | 3713 | 12708330 |
| 10 | 4159 | 14233330 |
| 11 | 4658 | 15941329 |
| 12 | 5217 | 17854289 |
| 13 | 5843 | 19996804 |
| 14 | 6545 | 22396420 |
| 15 | 7330 | 25083991 |
| 16 | 8210 | 28094069 |
| 17 | 9195 | 31465358 |
| 18 | 10299 | 35241201 |
| 19 | 11534 | 39470145 |
| 20 | 12919 | 44206563 |

## T2: уровень агента и XP

Сезон: 2160 тиков. С Handbook: 2376 тиков. xp_total(Lmax) = 2221.

| L | множитель bps | xp_to_next | xp_total |
|---:|---:|---:|---:|
| 1 | 10000 | 240 | 0 |
| 2 | 11500 | 384 | 240 |
| 3 | 13000 | 614 | 624 |
| 4 | 14500 | 983 | 1238 |
| 5 | 16000 | 1572 | 2221 |

## T2: research

| Узел | ключ | effect_bps | Capital | time_ticks |
|---|---|---:|---:|---:|
| `circuits` | `compute_cost_bps` | -1000 | 10265363 | 24 |
| `grid` | `energy_cost_bps` | -1500 | 15398044 | 36 |
| `handbook` | `xp_rate_bps` | 1000 | 10265363 | 24 |
| `lathe` | `upgrade_speed_bps` | 1000 | 10265363 | 24 |
| `tools` | `output_bps` | 1000 | 10265363 | 24 |

## T2: уровень города и слоты застройки

city_level_max = 7. Автономных играбельных архетипов: 3.

| L | population_threshold | agent_slots | build_slots |
|---:|---:|---:|---:|
| 1 | 0 | 8 | 11 |
| 2 | 400 | 10 | 13 |
| 3 | 600 | 12 | 15 |
| 4 | 900 | 14 | 17 |
| 5 | 1350 | 16 | 19 |
| 6 | 2025 | 18 | 21 |
| 7 | 3037 | 20 | 23 |

## T2: лестница банка

bank_level_max = 4. L=0 — банка нет, лимит 0. Персональный предел = доля от 500 bps живой глубины; при превышении суммы запросов — пропорциональное урезание, код `BANK_DAILY_LIMIT_REACHED`.

| L | share_bps | daily_limit_wei (сид) |
|---:|---:|---:|
| 0 | 0 | 0 |
| 1 | 2500 | 52500000000000000 |
| 2 | 4375 | 91875000000000000 |
| 3 | 5782 | 121422000000000000 |
| 4 | 6836 | 143556000000000000 |

## T2: стейк S_min

Снимок Chainlink `latestRoundData` 2026-08-29T23:19:30Z, RPC `https://rpc.mainnet.chain.robinhood.com`, chain 4663. `S_min` = `district_stake_usd_target_8dec` × 10^18 // answer, атомы токена. `S_ref` = `S_min`, не хранится. Гейт района иммунен к курсу.

| тикер | answer (8dec) | S_min (atoms) |
|---|---:|---:|
| AAPL | 31971273059 | 312780788601878113 |
| AMZN | 26608500000 | 375819756844617321 |
| COIN | 17771685000 | 562692845388605526 |
| MSFT | 51296000000 | 194946974422956955 |
| NVDA | 21815545000 | 458388731521490753 |
| TSLA | 34836125000 | 287058333841665799 |

| k × S_min | bonus_bps (гипербола, S_ref = S_min) |
|---:|---:|
| 1 | 0 |
| 2 | 500 |
| 3 | 666 |
| 10 | 900 |

Цена `S_min` в Capital относительно номинала: полоса [8695, 11500] bps; храповик держит нижнюю границу 8 суток города; на потолке 2000 отклонение вверх не ограничено.

## T2: возврат депозита и окно A

Замкнутый круг одного игрока, захват ровно своего взноса в фонд — потолок системы. Когорты делят фонд пропорционально аптайму 2:1.

| Величина | bps |
|---|---:|
| deposit_to_capital_bps | 9604 |
| fund_contribution_bps | 5762 |
| bank_exit_return_bps | 8908 |
| return_at_unit_capture_bps | 5132 (51.32%) |
| uptime_minimalist_bps | 4750 |
| uptime_optimizer_bps | 9500 |
| capture_min_bps | 19486 |
| capture_opt_bps | 38972 |
| return_min_bps | 10000 (100.00%) |
| return_opt_bps | 20000 (200.00%) |
| amplification_window A | [29229, 32152] |

Окно A в разах: [2.9229, 3.2152]. T3: проверить, что при сценариях `docs/LAUNCH.md` §3 усиление попадает в это окно, и назвать число активных городов.

## T2: дрожь и энергия

jitter_bps = 10000 + (sha256(`city_id:tick_index:agent_id`)[:8] mod 1001) − 500. Границы [9500, 10500], симметрия вокруг 10000. Steady: [9750, 10250].

| Величина | Значение |
|---|---:|
| power_node_cost_weight_bps | 3300 |
| power_node_output_per_tick | 120 |
| energy_plant_output_per_tick | 1818 |
| energy_plant_vs_nodes_bps | 19998 |
| robotics_lab_output_weight_bps | 10000 |
| upgrade_roi_lmax_over_l1_bps | 5184 |


## M1: состав трения при 2%

Сгенерировано. Источники: `economy.json` ставка и vault, `seasons.json` `prize_creator_tax_share_bps`, `fragments.json` `active_work_creator_tax_bps`, `meta.json` `fund_effective_tax_floor_bps`. Команда: `python content/build.py`.

| величина | значение |
|---|---:|
| creator_tax_bps | 200 |
| vault_fee_bps | 200 |
| round_trip_cost_bps | 1445 |
| trader_round_trip_cost_bps | 1164 |
| vault_entry_cost_bps | 200 |
| bank_exit_cost_bps | 910 |
| bank_exit_cost_best_bps | 611 |
| dex_visible_fee_bps | 300 |
| creator_tax_fund_bps | 100 |
| creator_tax_prize_bps | 100 |
| tax_split_total_bps | 200 |
| fee_split fund/leaderboard/farm/studio | 100 / 20 / 60 / 20 |
| external_vs_internal_breakeven_bps | 72250 |
| protocol_take_breakeven_bps | 36125 |
| vault_mint_rate | 1960 |


## M2: период призов

Сгенерировано. Источники: `seasons.json` prize_periods_per_season, `balance.json` season_city_days, `time.json` city_day_real_hours. Команда: `python content/build.py`.

Делитель хранится, длина периода derived. Вторую длину сезона не хранят. Интеграл Influence и qualify_days считаются в окне периода.

| величина | значение |
|---|---:|
| prize_periods_per_season | 3 |
| prize_period_city_days | 30 |
| prize_period_real_hours | 750 |
| qualify_days | 6 |
| optimizer days | 30 |
| optimizer I_period | 270750 |
| lazy_whale I_period | 12390 |
| optimizer_beats_lazy | 1 |


## M3: корзина Zipf и кап доли

Сгенерировано. Источники: `districts.json` ticker, `seasons.json` derived basket, `sim.json` archetypes deposit_multiple_bps, `fragments.json` protocol split. Команда: `python content/build.py`.

Корзина = все `districts[].ticker`, never CORP. Zipf по каждому активу. Кап доли derived. Десятка трат — фарм (`protocol_prizes_bps` = 0).

| величина | значение |
|---|---:|
| prize_assets | `NVDA`, `TSLA`, `AMZN`, `AAPL`, `MSFT`, `COIN` |
| basket_size | 6 |
| prize_share_cap_over_contribution_bps | 70716 |
| n1_takes_each_pool | 1 |
| n10_harmonic | 3224,1651,1127,865,707,602,527,471,427,393 |
| empty_asset_does_not_block | 1 |
| per_asset_within_pool | 1 |
| dust_by_asset | NVDA=0, TSLA=0, AMZN=0, AAPL=0, MSFT=0, COIN=0 |
| optimizer_unclipped | 1 |
| farm_clones_clipped | 1 |
| farm_clones_paid | 700 |
| farm_clones_max | 707 |
| n1_share_cap_applied | 0 |
| split_check | 10000 |


## M4: равномерный бюджет и тонкие пулы

Сгенерировано. Источники: `arch.basket_routes`, `launch.params.buyback_tranche_cap_bps`, `fragments.params.fragment_hop_haircut_bps`, `districts.json` ticker. Команда: `python content/build.py`.

Нога корзины — floor, остаток фонду. Студия — floor с призовой ноги. Транш тикера капается глубиной своего пула; недобранное остаётся за ним.

| величина | значение |
|---|---:|
| n | 6 |
| eth_in | 60000 |
| fund | 30000 |
| prize | 30000 |
| studio | 6000 |
| stocks | 24000 |
| per_ticker | 4000 |
| uniform_ok | 1 |
| thin_ticker | AMZN |
| thin_spent | 330 |
| thin_cap | 330 |
| thin_carry | 3670 |
| thin_throttled | 1 |
| others_budget_unchanged | 1 |
| reallocates | 0 |
| hop_fail_spent | 0 |
| hop_fail_lag | 1 |
| odd_wei_fund_ge_prize | 1 |
| cadence_count | 1 |
| tranche_cap_count | 1 |
| hop_haircut_copies | 1 |
| haircut_ref_ok | 1 |
| prize_hop_haircut_bps | 0 |


## M5: казна призов и предохранитель vault

Сгенерировано. Источники: `arch.port.groups`, `arch.custody`, `contracts/src/Vault.sol`, `contracts/src/PrizeTreasury.sol`, `codes.json`. Команда: `python content/build.py`.

Пять групп порта. returnUnsettled не трогает owed. refundPlayer ≤ availableOf. Бот не забирает весь vault.

| величина | значение |
|---|---:|
| groups_n | 5 |
| groups_ok | 1 |
| kettles_ok | 1 |
| pool_in_measured | 1 |
| forbidden_ok | 1 |
| return_skips_settled | 1 |
| no_pause_controls | 1 |
| uncovered_ok | 1 |
| over_backing_rejected | 1 |
| reserved_coverage_rejected | 1 |
| available_refund_ok | 1 |
| bot_whole_rejected | 1 |
| has_setSigner | 0 |
| proxy | 0 |


## M6: поверхность призов HUD

Сгенерировано. Источники: `generated.seasons.prize_assets`, `prize_period_real_hours`, `api.channel_map`. Команда: `python content/build.py`.

Treasury = tick.capital. Корзина на aggregate. Плашка протокола на price. Кнопок слива нет.

| величина | значение |
|---|---:|
| prize_assets_n | 6 |
| prize_assets | NVDA, TSLA, AMZN, AAPL, MSFT, COIN |
| prize_period_real_hours | 750 |
| prize_basket_channel | aggregate |


## T4: узлы прогрессии

Сгенерировано. Источники: `progression.json` оси и селекторы, `districts.json` provides и synergies, `balance.json` workshop/research/growth, `modifier_keys.json` scope_kind. Команда: `python content/build.py`.

Узлов 36, из них v1 36. Имя собирается из шаблона район + ось, не пишется руками.

| id | район | ось | тир | ключ | величина | scope | v1 | исключает |
|---|---|---|---:|---|---:|---|---|---|
| `n_automation_breadth` | `automation` | `breadth` | 2 | `build_cost_bps` | -1000 | building | да | `n_automation_depth` |
| `n_automation_capital` | `automation` | `capital` | 3 | `output_bps` | 1500 | building | да | `n_automation_paper` |
| `n_automation_depth` | `automation` | `depth` | 2 | `upgrade_speed_bps` | 1000 | building | да | `n_automation_breadth` |
| `n_automation_paper` | `automation` | `paper` | 3 | `fragment_rate_bps` | 1500 | building | да | `n_automation_capital` |
| `n_automation_scale` | `automation` | `scale` | 1 | `output_bps` | 500 | building | да | `n_automation_thrift` |
| `n_automation_thrift` | `automation` | `thrift` | 1 | `energy_cost_bps` | -500 | building | да | `n_automation_scale` |
| `n_compute_breadth` | `compute` | `breadth` | 2 | `build_cost_bps` | -1000 | building | да | `n_compute_depth` |
| `n_compute_capital` | `compute` | `capital` | 3 | `output_bps` | 1500 | building | да | `n_compute_paper` |
| `n_compute_depth` | `compute` | `depth` | 2 | `upgrade_speed_bps` | 1000 | building | да | `n_compute_breadth` |
| `n_compute_paper` | `compute` | `paper` | 3 | `fragment_rate_bps` | 1500 | building | да | `n_compute_capital` |
| `n_compute_scale` | `compute` | `scale` | 1 | `output_bps` | 500 | building | да | `n_compute_thrift` |
| `n_compute_thrift` | `compute` | `thrift` | 1 | `compute_cost_bps` | -500 | building | да | `n_compute_scale` |
| `n_consumer_breadth` | `consumer` | `breadth` | 2 | `build_cost_bps` | -1000 | building | да | `n_consumer_depth` |
| `n_consumer_capital` | `consumer` | `capital` | 3 | `output_bps` | 1500 | building | да | `n_consumer_paper` |
| `n_consumer_depth` | `consumer` | `depth` | 2 | `upgrade_speed_bps` | 1000 | building | да | `n_consumer_breadth` |
| `n_consumer_paper` | `consumer` | `paper` | 3 | `fragment_rate_bps` | 1500 | building | да | `n_consumer_capital` |
| `n_consumer_scale` | `consumer` | `scale` | 1 | `output_bps` | 500 | building | да | `n_consumer_thrift` |
| `n_consumer_thrift` | `consumer` | `thrift` | 1 | `energy_cost_bps` | -500 | building | да | `n_consumer_scale` |
| `n_energy_breadth` | `energy` | `breadth` | 2 | `build_cost_bps` | -1000 | building | да | `n_energy_depth` |
| `n_energy_capital` | `energy` | `capital` | 3 | `output_bps` | 1500 | building | да | `n_energy_paper` |
| `n_energy_depth` | `energy` | `depth` | 2 | `upgrade_speed_bps` | 1000 | building | да | `n_energy_breadth` |
| `n_energy_paper` | `energy` | `paper` | 3 | `fragment_rate_bps` | 1500 | building | да | `n_energy_capital` |
| `n_energy_scale` | `energy` | `scale` | 1 | `output_bps` | 500 | building | да | `n_energy_thrift` |
| `n_energy_thrift` | `energy` | `thrift` | 1 | `energy_cost_bps` | -500 | building | да | `n_energy_scale` |
| `n_finance_breadth` | `finance` | `breadth` | 2 | `build_cost_bps` | -1000 | building | да | `n_finance_depth` |
| `n_finance_capital` | `finance` | `capital` | 3 | `output_bps` | 1500 | building | да | `n_finance_paper` |
| `n_finance_depth` | `finance` | `depth` | 2 | `upgrade_speed_bps` | 1000 | building | да | `n_finance_breadth` |
| `n_finance_paper` | `finance` | `paper` | 3 | `fragment_rate_bps` | 1500 | building | да | `n_finance_capital` |
| `n_finance_scale` | `finance` | `scale` | 1 | `output_bps` | 500 | building | да | `n_finance_thrift` |
| `n_finance_thrift` | `finance` | `thrift` | 1 | `energy_cost_bps` | -500 | building | да | `n_finance_scale` |
| `n_logistics_breadth` | `logistics` | `breadth` | 2 | `build_cost_bps` | -1000 | building | да | `n_logistics_depth` |
| `n_logistics_capital` | `logistics` | `capital` | 3 | `output_bps` | 1500 | building | да | `n_logistics_paper` |
| `n_logistics_depth` | `logistics` | `depth` | 2 | `upgrade_speed_bps` | 1000 | building | да | `n_logistics_breadth` |
| `n_logistics_paper` | `logistics` | `paper` | 3 | `fragment_rate_bps` | 1500 | building | да | `n_logistics_capital` |
| `n_logistics_scale` | `logistics` | `scale` | 1 | `output_bps` | 500 | building | да | `n_logistics_thrift` |
| `n_logistics_thrift` | `logistics` | `thrift` | 1 | `energy_cost_bps` | -500 | building | да | `n_logistics_scale` |

Дивиденды тира (автомат при взятии тира):

| id | район | тир | ключ | величина | scope |
|---|---|---:|---|---:|---|
| `div_automation_1` | `automation` | 1 | `offline_cap_hours` | 1 | city |
| `div_automation_2` | `automation` | 2 | `offline_cap_hours` | 2 | city |
| `div_automation_3` | `automation` | 3 | `offline_cap_hours` | 3 | city |
| `div_compute_1` | `compute` | 1 | `compute_cost_bps` | -500 | building |
| `div_compute_2` | `compute` | 2 | `compute_cost_bps` | -1000 | building |
| `div_compute_3` | `compute` | 3 | `compute_cost_bps` | -1500 | building |
| `div_consumer_1` | `consumer` | 1 | `population_conversion_bps` | 500 | building |
| `div_consumer_2` | `consumer` | 2 | `population_conversion_bps` | 1000 | building |
| `div_consumer_3` | `consumer` | 3 | `population_conversion_bps` | 1500 | building |
| `div_energy_1` | `energy` | 1 | `energy_cost_bps` | -500 | building |
| `div_energy_2` | `energy` | 2 | `energy_cost_bps` | -1000 | building |
| `div_energy_3` | `energy` | 3 | `energy_cost_bps` | -1500 | building |
| `div_finance_1` | `finance` | 1 | `fund_share_bps` | 500 | city |
| `div_finance_2` | `finance` | 2 | `fund_share_bps` | 1000 | city |
| `div_finance_3` | `finance` | 3 | `fund_share_bps` | 1500 | city |
| `div_logistics_1` | `logistics` | 1 | `idle_reduction_bps` | 500 | building |
| `div_logistics_2` | `logistics` | 2 | `idle_reduction_bps` | 1000 | building |
| `div_logistics_3` | `logistics` | 3 | `idle_reduction_bps` | 1500 | building |

## T4: тиры и гейты

Сгенерировано. Источники: `progression.json` оси и селекторы, `districts.json` provides и synergies, `balance.json` workshop/research/growth, `modifier_keys.json` scope_kind. Команда: `python content/build.py`.

| тир | city_level_req | stake_mult | cost Capital |
|---:|---:|---:|---:|
| 1 | 1 | 1×S_min | 0 |
| 2 | 3 | 2×S_min | 51326815 |
| 3 | 5 | 3×S_min | 192475558 |

Тир 1 стоит 0 Capital: открытие — только стейк (`DESIGN.md` §4.5). Merge cost = 64158519.

## T4: узлы-слияния и паросочетания

Сгенерировано. Источники: `progression.json` оси и селекторы, `districts.json` provides и synergies, `balance.json` workshop/research/growth, `modifier_keys.json` scope_kind. Команда: `python content/build.py`.

Непокрытых пар 9: `automation+consumer`, `automation+energy`, `automation+logistics`, `compute+consumer`, `compute+finance`, `consumer+energy`, `consumer+finance`, `energy+finance`, `finance+logistics`.
 Паросочетаний включая пустое: 29. `merge_active_cap` = 3. v1 merge: 9, cap v1 = 3.

| id | районы | min_tier | эффекты | v1 |
|---|---|---:|---|---|
| `m_automation_consumer` | `automation+consumer` | 2 | `automation` `offline_cap_hours` +1; `consumer` `population_conversion_bps` +500 | да |
| `m_automation_energy` | `automation+energy` | 2 | `automation` `offline_cap_hours` +1; `energy` `energy_cost_bps` -500 | да |
| `m_automation_logistics` | `automation+logistics` | 2 | `automation` `offline_cap_hours` +1; `logistics` `idle_reduction_bps` +500 | да |
| `m_compute_consumer` | `compute+consumer` | 2 | `compute` `compute_cost_bps` -500; `consumer` `population_conversion_bps` +500 | да |
| `m_compute_finance` | `compute+finance` | 2 | `compute` `compute_cost_bps` -500; `finance` `fund_share_bps` +500 | да |
| `m_consumer_energy` | `consumer+energy` | 2 | `consumer` `population_conversion_bps` +500; `energy` `energy_cost_bps` -500 | да |
| `m_consumer_finance` | `consumer+finance` | 2 | `consumer` `population_conversion_bps` +500; `finance` `fund_share_bps` +500 | да |
| `m_energy_finance` | `energy+finance` | 2 | `energy` `energy_cost_bps` -500; `finance` `fund_share_bps` +500 | да |
| `m_finance_logistics` | `finance+logistics` | 2 | `finance` `fund_share_bps` +500; `logistics` `idle_reduction_bps` +500 | да |

Паросочетания по размеру: 0: 1, 1: 9, 2: 16, 3: 3. Примеры максимума: `automation+logistics+compute+finance+consumer+energy`, `automation+logistics+compute+consumer+energy+finance`, `automation+energy+compute+consumer+finance+logistics`.

## T4: счёт билдов

Сгенерировано. Источники: `progression.json` оси и селекторы, `districts.json` provides и synergies, `balance.json` workshop/research/growth, `modifier_keys.json` scope_kind. Команда: `python content/build.py`.

| величина | значение |
|---|---:|
| builds_raw | 160608177 |
| builds_raw_v1 | 160608177 |
| builds_terminal | 3911153 |
| t_lt2_states | 3 |
| t_ge2_states | 12 |
| t3_side_states | 8 |

Affordable / meaningful считает `python content/builds.py` → `content/out/BUILDS.md`.


## T5: потолки ключей

Сгенерировано. Источники: `modifiers.json` якоря и формулы, `modifier_keys.json` стадии и режимы, `balance.json` кривые, `research.json` axes / `progression.json` / `districts.json` / `agents.json`. Команда: `python content/build.py`.

| ключ | режим | стадия | скоуп | cap_min | cap_max | якорь | content_floor high | запас |
|---|---|---|---|---:|---:|---|---:|---:|
| `agent_slots` | add | post | city | 0 | 12 | slots_cap - slots_start | 0 | 12 |
| `build_cost_bps` | mul | post | building | 4000 | 25000 | balance.cost_growth_bps | 10000 | 15000 |
| `compute_cost_bps` | mul | base | building | 6250 | 16000 | balance.energy_growth_bps | 13050 | 2950 |
| `energy_cost_bps` | mul | base | building | 6250 | 16000 | balance.energy_growth_bps | 12325 | 3675 |
| `fragment_rate_bps` | mul | post | building | 5555 | 18000 | balance.output_growth_bps | 11500 | 6500 |
| `fund_share_bps` | add | post | city | 0 | 3500 | node_effect_base_bps * sum_1_to(tier_count) + merge | 3500 | 0 |
| `idle_reduction_bps` | mul_remainder | base | building | 0 | 9500 | 10000 - balance.residual_idle_bps | 5523 | 3977 |
| `jitter_bps` | mul_remainder | jitter | building | 0 | 5000 | modifiers.trait_relief_share_bps | 5000 | 0 |
| `offline_cap_hours` | add | post | city | 0 | 6 | countable_unit * sum_1_to(tier_count) | 6 | 0 |
| `output_bps` | mul | post | building | 802 | 124591 | balance.output_bps_reachable_max_bps | 16802 | 107789 |
| `population_conversion_bps` | mul | post | building | 5555 | 18000 | balance.output_growth_bps | 13946 | 4054 |
| `upgrade_speed_bps` | mul | post | building | 6250 | 16000 | balance.build_time_growth_bps | 12100 | 3900 |
| `xp_rate_bps` | mul | post | building | 6250 | 16000 | balance.xp_growth_bps | 12100 | 3900 |

## T5: строки модификаторов

Сгенерировано. Источники: `modifiers.json` якоря и формулы, `modifier_keys.json` стадии и режимы, `balance.json` кривые, `research.json` axes / `progression.json` / `districts.json` / `agents.json`. Команда: `python content/build.py`.

Черты, задачи и research. Узлы/дивиденды/merge — секция T4, сюда не копируются.

| id | источник | kind | ключ | величина | условие | from |
|---|---|---|---|---:|---|---|
| `frugal_compute` | `frugal` | trait | `compute_cost_bps` | -2000 | always | frugal_input |
| `frugal_energy` | `frugal` | trait | `energy_cost_bps` | -2000 | always | frugal_input |
| `frugal_output` | `frugal` | trait | `output_bps` | -500 | always | frugal_out |
| `night_owl_energy` | `night_owl` | trait | `energy_cost_bps` | -1000 | night | night_owl_energy |
| `overclock_energy` | `overclock` | objective | `energy_cost_bps` | 4500 | always | overclock_energy |
| `overclock_output` | `overclock` | objective | `output_bps` | 1000 | always | overclock_out |
| `research_compute` | `research` | objective | `compute_cost_bps` | 4500 | always | research_compute |
| `route_idle` | `route` | objective | `idle_reduction_bps` | 1000 | always | route_idle |
| `specialist_away` | `specialist` | trait | `output_bps` | -1500 | affinity_not_home | specialist_away |
| `specialist_home` | `specialist` | trait | `output_bps` | 1500 | affinity_home | specialist_home |
| `steady_jitter` | `steady` | trait | `jitter_bps` | 5000 | always | steady_jitter |
| `stockpile_idle` | `stockpile` | objective | `idle_reduction_bps` | 2000 | always | stockpile_idle |
| `stockpile_output` | `stockpile` | objective | `output_bps` | -500 | always | stockpile_out |
| `train_compute` | `train` | objective | `compute_cost_bps` | 4500 | always | train_compute |
| `train_xp` | `train` | objective | `xp_rate_bps` | 1000 | always | train_xp |
| `research_circuits` | `circuits` | research | `compute_cost_bps` | -1000 | always | research axis unit*t*sign |
| `research_grid` | `grid` | research | `energy_cost_bps` | -1500 | always | research axis unit*t*sign |
| `research_handbook` | `handbook` | research | `xp_rate_bps` | 1000 | always | research axis unit*t*sign |
| `research_lathe` | `lathe` | research | `upgrade_speed_bps` | 1000 | always | research axis unit*t*sign |
| `research_tools` | `tools` | research | `output_bps` | 1000 | always | research axis unit*t*sign |

Всего строк в паке 92, из них авторских черт/задач 15.

## T5: стек и окупаемость

Сгенерировано. Источники: `modifiers.json` якоря и формулы, `modifier_keys.json` стадии и режимы, `balance.json` кривые, `research.json` axes / `progression.json` / `districts.json` / `agents.json`. Команда: `python content/build.py`.

| величина | значение |
|---|---:|
| capex_trade_ratio_bps | 40303 |
| output_bps_reachable_max_bps | 124591 |
| форточка бесплатного выхода bps | 13300 |
| Specialist output_bps | 11500 |
| бесплатный стек o | 12650 |
| бесплатный стек e | 14500 |
| net_payback база | 319 |
| net_payback Specialist | 277 |
| net_payback бесплатный стек | 280 |
| запас до форточки bps | 650 |
| горизонт L32 тиков | 324 |
| Overclock Δout / Δenergy | 1000 / 4500 |
| Overclock net_payback | 322 |
| Frugal Δout / Δenergy | -500 / -2000 |
| Frugal net_payback | 319 |
| Night Owl эффективная надбавка | 800 |
| Stockpile I* idle bps | 3571 |
| paid o без цены | 16802 |
| paid net_payback без цены | 211 |
| paid net_payback с полом цены | 274 |
| Steady полоса | [9750, 10250] |

## T5: арифметика

Сгенерировано. Источники: `modifiers.json` якоря и формулы, `modifier_keys.json` стадии и режимы, `balance.json` кривые, `research.json` axes / `progression.json` / `districts.json` / `agents.json`. Команда: `python content/build.py`.

| величина | значение |
|---|---:|
| делений (схема) | 14 |
| делений при 50 нулевых строках | 14 |
| нулевая строка no-op | 1 |
| свидетель stepwise a→b | 5 |
| свидетель stepwise b→a | 4 |
| свидетель fused | 5 |
| fused по стадии ключа | 10674 |
| fused по стадии строки | 10674 |
| битность худшего числителя | 138 |

Клип потолком пишет код `MODIFIER_CAP_CLAMPED`. Клиент считает выход в BigInt: битность > 53.


## T6: источники пула

Сгенерировано. Источники: `fragments.json` active_work_creator_tax_bps и `fragments.json` fragment_window_city_days and active_work_creator_tax_bps, `economy.json` capital_unit_usd, `districts.json` ticker/playable_v1, `time.json` city_day_real_hours и efficiency_recalc_hour, `launch.json` T1 scenarios и eth_usd_8dec (снимок 2026-08-27). Команда: `python content/build.py`.

Краны. Creator tax и пробка фонда — ноль (R-T6-1). NFT — ноль до T8. Живой кран — creator-tax active-work leg; `spend_protocol` закрыт.

| кран | bps |
|---|---:|
| creator tax | 0 |
| reserve_cork | 0 |
| protocol → fragments | 10000 |
| protocol → prizes (T7) | 0 |
| NFT companion | 0 |
| сплит protocol всего | 10000 |

Окно клейма 7 суток города (175 реальных часов), settlement в 6:00. Не хранится: равно `fragment_window_city_days`. Горизонт фонда зарплат остаётся `payroll_daily_divisor`.

## T6: маршруты тикеров

Сгенерировано. Источники: `fragments.json` active_work_creator_tax_bps и `fragments.json` fragment_window_city_days and active_work_creator_tax_bps, `economy.json` capital_unit_usd, `districts.json` ticker/playable_v1, `time.json` city_day_real_hours и efficiency_recalc_hour, `launch.json` T1 scenarios и eth_usd_8dec (снимок 2026-08-27). Команда: `python content/build.py`.

Один параметр `weth_quote_ticker`. Haircut hop 3 bps на всех, включая COIN (R-T6-2). Пар CORP/сток нет.

| тикер | quote_asset | v1 леджер |
|---|---|---|
| `NVDA` | `USDG` | да |
| `TSLA` | `USDG` | да |
| `AMZN` | `USDG` | да |
| `AAPL` | `USDG` | да |
| `MSFT` | `USDG` | да |
| `COIN` | `WETH` | да |

## T6: свидетели settlement

Сгенерировано. Источники: `fragments.json` active_work_creator_tax_bps и `fragments.json` fragment_window_city_days and active_work_creator_tax_bps, `economy.json` capital_unit_usd, `districts.json` ticker/playable_v1, `time.json` city_day_real_hours и efficiency_recalc_hour, `launch.json` T1 scenarios и eth_usd_8dec (снимок 2026-08-27). Команда: `python content/build.py`.

| свидетель | выплаты | сумма | пыль | кап | инвариант |
|---|---|---:|---:|---|---|
| 1,1,1 × пул 10 | 3,3,3 | 9 | 1 |  | да |
| 5000/5000 × пул 100 | 50,50 | 100 | 0 |  | да |
| 9000/1000 × пул 100 | 50,10 | 60 | 40 | да | да |
| N=1 10000 × пул 100 | 100 | 100 | 0 |  | да |
| sum_frag=0, пул 50 | 0,0 | 0 | 50 |  | да |

## T6: бюджет окна (DEX active-work leg)

Сгенерировано. Источники: `fragments.json` active_work_creator_tax_bps и `fragments.json` fragment_window_city_days and active_work_creator_tax_bps, `economy.json` capital_unit_usd, `districts.json` ticker/playable_v1, `time.json` city_day_real_hours и efficiency_recalc_hour, `launch.json` T1 scenarios и eth_usd_8dec (снимок 2026-08-27). Команда: `python content/build.py`.

Сценарий LAUNCH §3 даёт месячный оборот DEX. Для farm берётся доля active-work за 14-дневное окно и применяется hop haircut. Доллар — производная снимка ETH/USD 2026-08-27.

| сценарий | оборот T1 $ | Capital в пул / город | $ / город (8dec) | < 1$ |
|---|---:|---:|---:|---|
| low | 50000 | 69996000 | 6997500120 |  |
| mid | 300000 | 420000000 | 41987400000 |  |
| hype | 2000000 | 2799996000 | 279915600120 |  |

## T6: fragments_season

Сгенерировано. Источники: `fragments.json` active_work_creator_tax_bps и `fragments.json` fragment_window_city_days and active_work_creator_tax_bps, `economy.json` capital_unit_usd, `districts.json` ticker/playable_v1, `time.json` city_day_real_hours и efficiency_recalc_hour, `launch.json` T1 scenarios и eth_usd_8dec (снимок 2026-08-27). Команда: `python content/build.py`.

Метод `produced_x_stack`. Прокси суммы величин `paper` снят. Счёт: линия нормировки (`gdp` сценария) × `fragment_stack_bps / BPS`, скоуп района как T4 spot. Не `produced` после `output_bps` (R-T6-6). Пул settlement в цель доминирования не входит.


## T7: длина сезона

Сгенерировано. Источники: `seasons.json`, `balance.json` season_city_days, `time.json` city_day_real_hours и efficiency_recalc_hour, `sim.json` архетипы, `economy.json` creator_tax_bps/studio_eth_share_bps и stake_bonus_max_bps, `fragments.json` active_work_creator_tax_bps, `launch.json` T1 scenarios. Команда: `python content/build.py`.

Длина = `season_city_days`, не второй параметр. Реальные часы — вывод. Окно фрагментов ≠ период призов ≠ сезон (R-T6-3). Settlement периода в `efficiency_recalc_hour` первого часа нового периода.

| величина | значение |
|---|---:|
| суток города | 90 |
| реальных часов | 2250 |
| целых суток 24 ч | 93 |
| остаток часов | 18 |
| период суток | 30 |
| период часов | 750 |
| qualify_days | 6 |
| час settlement | 6 |
| live выплата | 1 |
| hop bps | 0 |
| asset | `NVDA,TSLA,AMZN,AAPL,MSFT,COIN` |
| сплит protocol | 10000 |

## T7: Influence свидетели

Сгенерировано. Источники: `seasons.json`, `balance.json` season_city_days, `time.json` city_day_real_hours и efficiency_recalc_hour, `sim.json` архетипы, `economy.json` creator_tax_bps/studio_eth_share_bps и stake_bonus_max_bps, `fragments.json` active_work_creator_tax_bps, `launch.json` T1 scenarios. Команда: `python content/build.py`.

uptime_opt 9500, uptime_lazy 4750. optimizer_beats_lazy=1. active_beats_optimizer=1 (R-T7-5: гейт — вялый кит).

| зонд | gdp | capex | intensity | stability | efficiency | coverage | дни | I_day | I_season | qual |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| optimizer_ref | 9500 | 10000 | 9500 | 9500 | 10000 | 10000 | 30 | 9025 | 270750 | да |
| lazy_whale | 47500 | 100000 | 4750 | 4750 | 11000 | 1666 | 30 | 413 | 12390 | да |
| active_whale | 95000 | 100000 | 9500 | 9500 | 11000 | 10000 | 30 | 9927 | 297810 | да |
| last_day_clone | 9500 | 10000 | 9500 | 9500 | 10000 | 10000 | 1 | 9025 | 9025 |  |

## T7: Zipf топ-N

Сгенерировано. Источники: `seasons.json`, `balance.json` season_city_days, `time.json` city_day_real_hours и efficiency_recalc_hour, `sim.json` архетипы, `economy.json` creator_tax_bps/studio_eth_share_bps и stake_bonus_max_bps, `fragments.json` active_work_creator_tax_bps, `launch.json` T1 scenarios. Команда: `python content/build.py`.

n=10, α=8000, pool свидетеля 10000. Floor. Пыль остаётся. Ceil — шов L107.

| k | вес | payout |
|---:|---:|---:|
| 1 | 8200 | 3224 |
| 2 | 4200 | 1651 |
| 3 | 2866 | 1127 |
| 4 | 2200 | 865 |
| 5 | 1800 | 707 |
| 6 | 1532 | 602 |
| 7 | 1342 | 527 |
| 8 | 1200 | 471 |
| 9 | 1088 | 427 |
| 10 | 1000 | 393 |

Σ payout 9994 пыль 6 инвариант да.
Тройка × пул 10: [5, 2, 1] сумма 8 пыль 2.
N=1: [10000] пыль 0. N=0: pool_left 10000.

## T7: бюджет сезона

Сгенерировано. Источники: `seasons.json`, `balance.json` season_city_days, `time.json` city_day_real_hours и efficiency_recalc_hour, `sim.json` архетипы, `economy.json` creator_tax_bps/studio_eth_share_bps и stake_bonus_max_bps, `fragments.json` active_work_creator_tax_bps, `launch.json` T1 scenarios. Команда: `python content/build.py`.

Горизонт — месячный prize period, доля leaderboard creator-tax leg. Не Capital spending и не cork. Таблицы считают пул как при live=1 (сайзинг); флаг выплаты отдельно.

| сценарий | оборот T1 $ | Capital в пул / город | $ / город (8dec) | < 1$ |
|---|---:|---:|---:|---|
| low | 50000 | 100000000 | 10000000000 |  |
| mid | 300000 | 600000000 | 60000000000 |  |
| hype | 2000000 | 4000000000 | 400000000000 |  |

## T7: антисивил

Сгенерировано. Источники: `seasons.json`, `balance.json` season_city_days, `time.json` city_day_real_hours и efficiency_recalc_hour, `sim.json` архетипы, `economy.json` creator_tax_bps/studio_eth_share_bps и stake_bonus_max_bps, `fragments.json` active_work_creator_tax_bps, `launch.json` T1 scenarios. Команда: `python content/build.py`.

qualify_days 6, слот `wallet`, живой стейк на settlement, интеграл не снимок. Кап фрагментов на город не менялся.

| N_cities / сценарий | пул $ 8dec | rank1 | rank10 | rank10>депозит |
|---|---:|---:|---:|---|
| n=1000 hype | 400000000000000 | 128991662733994 | 15730690577316 | да |
| n=1000 low | 10000000000000 | 3224791568349 | 393267264432 | да |
| n=1000 mid | 60000000000000 | 19348749410099 | 2359603586597 | да |
| n=100 hype | 40000000000000 | 12899166273399 | 1573069057731 | да |
| n=100 low | 1000000000000 | 322479156834 | 39326726443 | да |
| n=100 mid | 6000000000000 | 1934874941009 | 235960358659 | да |
| n=1 hype | 400000000000 | 400000000000 | 0 |  |
| n=1 low | 10000000000 | 10000000000 | 0 |  |
| n=1 mid | 60000000000 | 60000000000 | 0 |  |

Стоимость защит: депозит 15000000000 usd_8dec, стейк 10000000000 usd_8dec, время 150 реальных часов. N ключей × 90 суток — остаточный сивил R-T7-4, не KYC.


## T9: инвентаризация экранов

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| id | kind | mount | v1 | loading | empty |
|---|---|---|---|---|---|
| `active_events` | panel | `left_panel` | live | `skeleton` | `no_events_yet` |
| `agent_card` | screen | `modal` | live | `skeleton` | `no_entities_yet` |
| `agents` | screen | `fullscreen` | live | `skeleton` | `no_entities_yet` |
| `agents_panel` | panel | `right_panel` | live | `skeleton` | `no_entities_yet` |
| `bank` | screen | `fullscreen` | live | `stale_freeze` | `no_entities_yet` |
| `bottom_menu` | panel | `bottom_menu` | live | `skeleton` | `no_events_yet` |
| `build` | screen | `fullscreen` | live | `skeleton` | `no_entities_yet` |
| `building_card` | screen | `modal` | live | `skeleton` | `no_entities_yet` |
| `city_card` | panel | `right_panel` | live | `skeleton` | `no_events_yet` |
| `district_card` | screen | `modal` | live | `skeleton` | `nothing_to_claim` |
| `district_overview` | panel | `right_panel` | live | `skeleton` | `no_entities_yet` |
| `districts` | screen | `fullscreen` | live | `skeleton` | `no_entities_yet` |
| `districts_panel` | panel | `left_panel` | live | `skeleton` | `no_entities_yet` |
| `exchange` | screen | `fullscreen` | live | `stale_freeze` | `no_entities_yet` |
| `flow_return_continue` | flow | `overlay` | live | `skeleton` | `no_events_yet` |
| `flow_return_summary` | flow | `overlay` | live | `skeleton` | `no_events_yet` |
| `leaderboard` | screen | `fullscreen` | live | `skeleton` | `no_entities_yet` |
| `log_panel` | panel | `right_panel` | live | `skeleton` | `no_events_yet` |
| `missions` | screen | `fullscreen` | stub | `skeleton` | `no_events_yet` |
| `offline_return` | screen | `overlay` | live | `skeleton` | `no_events_yet` |
| `overview` | panel | `left_panel` | live | `stale_freeze` | `no_events_yet` |
| `research` | screen | `fullscreen` | live | `skeleton` | `no_entities_yet` |
| `scene` | panel | `fullscreen` | live | `skeleton` | `no_entities_yet` |
| `settings` | screen | `fullscreen` | live | `skeleton` | `no_events_yet` |
| `stock_bar` | panel | `bottom_bar` | live | `stale_freeze` | `no_events_yet` |
| `topbar` | panel | `topbar` | live | `stale_freeze` | `no_events_yet` |
| `wallet_connect` | screen | `fullscreen` | live | `spinner_inline` | `no_entities_yet` |

kind=screen 14, kind=panel 11, kind=flow 2. Пятнадцать экранов против тринадцати пунктов BRIEF: `exchange` выделен из `DISTRICTS и Exchange`, `district_card` несёт дерево узлов и клейм фрагментов.

## T9: панели и поля

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| панель | экран | поля |
|---|---|---|
| `active_events` | `active_events` | `events_list` |
| `agent_detail` | `agent_card` | `agent_level` |
| `agents_panel` | `agents_panel` | `agents_slots` |
| `agents_roster` | `agents` | `roster_slots` |
| `bank_desk` | `bank` | `bank_daily_limit`, `bank_mint_rate` |
| `bottom_menu` | `bottom_menu` | `menu_items` |
| `build_catalog` | `build` | `build_slots` |
| `building_detail` | `building_card` | `building_level` |
| `city_card` | `city_card` | `city_rank`, `city_card_treasury` |
| `district_overview` | `district_overview` | `overview_zones` |
| `district_tree` | `district_card` | `district_stake`, `fragment_stock` |
| `districts_list` | `districts` | `districts_stake` |
| `districts_panel` | `districts_panel` | `districts_rows` |
| `exchange_quote` | `exchange` | `exchange_quote_capital` |
| `leaderboard_table` | `leaderboard` | `leaderboard_rank`, `leaderboard_live_board`, `leaderboard_basket`, `leaderboard_period_hours` |
| `log_panel` | `log_panel` | `log_lines` |
| `missions_stub` | `missions` | `missions_placeholder` |
| `offline_summary` | `offline_return` | `offline_ticks` |
| `overview` | `overview` | `overview_gdp`, `overview_payroll`, `overview_payroll_boost`, `overview_payroll_boost_days`, `overview_happiness`, `overview_stability`, `overview_treasury` |
| `protocol_plaque` | `city_card` | `protocol_eth_in_flight`, `protocol_vault_corp`, `protocol_prize_kettles`, `protocol_studio_eth` |
| `research_list` | `research` | `research_cost` |
| `scene` | `scene` | `scene_footprint` |
| `settings_list` | `settings` | `settings_si` |
| `stock_bar` | `stock_bar` | `stock_price`, `stock_effect` |
| `topbar` | `topbar` | `topbar_capital`, `topbar_corp`, `topbar_clock`, `topbar_bank_timer`, `topbar_energy`, `topbar_compute` |
| `wallet_status` | `wallet_connect` | `wallet_chain_id` |

| поле | kind | value_kind | source | pointer |
|---|---|---|---|---|
| `agent_level` | int | live_state | server | `tick.agent_state` |
| `agents_slots` | int | live_state | server | `tick.agent_state` |
| `bank_daily_limit` | int | pack_derived | server | `generated.screens.bank_daily_limit_live` |
| `bank_mint_rate` | int | pack_derived | server | `generated.economy.anchor_mint_rate` |
| `build_slots` | int | pack_derived | server | `generated.balance.build_slots` |
| `building_level` | int | live_state | server | `tick.building_level` |
| `city_card_treasury` | int | live_state | server | `tick.capital` |
| `city_rank` | int | live_state | server | `seasons.influence_rank` |
| `district_stake` | int | live_state | server | `wallet.stake_tokens` |
| `districts_rows` | list | live_state | server | `oracle.district_efficiency` |
| `districts_stake` | int | live_state | server | `wallet.stake_tokens` |
| `events_list` | list | live_state | server | `log.events` |
| `exchange_quote_capital` | interval | pack_derived | server | `generated.screens.exchange_quote_capital_bps` |
| `fragment_stock` | int | live_state | server | `fragments.city_ledger` |
| `leaderboard_basket` | list | live_state | server | `seasons.prize_basket` |
| `leaderboard_live_board` | list | live_state | server | `seasons.influence_rank` |
| `leaderboard_period_hours` | int | pack_derived | server | `generated.seasons.prize_period_real_hours` |
| `leaderboard_rank` | int | live_state | server | `seasons.influence_rank` |
| `log_lines` | list | live_state | server | `log.events` |
| `menu_items` | list | client_local | client_format |  |
| `missions_placeholder` | text | client_local | client_format |  |
| `offline_ticks` | int | pack_derived | server | `generated.screens.offline_return_ticks_cap` |
| `overview_gdp` | int | live_state | server | `aggregate.gdp` |
| `overview_happiness` | int | live_state | server | `aggregate.happiness` |
| `overview_payroll` | bps | live_state | server | `aggregate.payroll_ratio` |
| `overview_payroll_boost` | bps | live_state | server | `aggregate.payroll_boost_bps` |
| `overview_payroll_boost_days` | int | live_state | server | `aggregate.payroll_boost_days_left` |
| `overview_stability` | int | live_state | server | `aggregate.stability` |
| `overview_treasury` | int | live_state | server | `tick.capital` |
| `overview_zones` | list | client_local | client_format |  |
| `protocol_eth_in_flight` | int | live_state | server | `wallet.protocol_eth_in_flight` |
| `protocol_prize_kettles` | list | live_state | server | `seasons.prize_basket` |
| `protocol_studio_eth` | int | live_state | server | `wallet.protocol_studio_eth` |
| `protocol_vault_corp` | int | live_state | server | `wallet.protocol_vault_corp` |
| `research_cost` | int | pack_derived | server | `generated.balance.research_node_cost` |
| `roster_slots` | int | pack_derived | server | `agents.params.slots_cap` |
| `scene_footprint` | text | live_state | server | `tick.energy` |
| `settings_si` | text | client_local | client_format |  |
| `stock_effect` | bps | live_state | server | `oracle.district_efficiency` |
| `stock_price` | price | live_state | server | `oracle.stock_price` |
| `topbar_bank_timer` | timer | client_local | client_clock |  |
| `topbar_capital` | int | live_state | server | `tick.capital` |
| `topbar_clock` | timer | client_local | client_clock |  |
| `topbar_compute` | int | live_state | server | `tick.compute` |
| `topbar_corp` | int | live_state | server | `wallet.corp_balance` |
| `topbar_energy` | int | live_state | server | `tick.energy` |
| `wallet_chain_id` | text | live_state | server | `wallet.chain` |

## T9: элементы и отказы

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| экран | элемент | эффект | spend | v1 | коды | блокирующий | без демо |
|---|---|---|---|---|---|---|---|
| `agent_card` | `agent_assign` | `commit:assign` | none | live |  |  |  |
| `agent_card` | `agent_set_objective` | `commit:set_objective` | none | live | `IDLE_OUT_OF_HOURS` |  |  |
| `agents` | `agents_hire` | `commit:hire` | capital | live | `NO_FREE_AGENT_SLOT`, `NOT_ENOUGH_CAPITAL` | `NO_FREE_AGENT_SLOT` | `NO_FREE_AGENT_SLOT` |
| `agents` | `agents_open_card` | `navigate:agent_card` | none | live |  |  |  |
| `bank` | `bank_deposit` | `commit:deposit` | corp | live | `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CORP` | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` |
| `bank` | `bank_present_voucher` | `commit:present_voucher` | none | live | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` |
| `bank` | `bank_withdraw` | `commit:withdraw` | capital | live | `DEMO_NO_WITHDRAW`, `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CAPITAL`, `BANK_CLOSED`, `BANK_SUNDAY`, `BANK_DAILY_LIMIT_REACHED` | `DEMO_NO_WITHDRAW` | `WALLET_NOT_CONNECTED` |
| `build` | `build_place` | `commit:build` | capital | live | `CITY_LEVEL_TOO_LOW`, `BUILD_TILE_ILLEGAL`, `NO_FREE_BUILD_SLOT`, `NOT_ENOUGH_CAPITAL` | `CITY_LEVEL_TOO_LOW` | `CITY_LEVEL_TOO_LOW` |
| `building_card` | `building_activate` | `commit:build` | none | live |  |  |  |
| `building_card` | `building_build` | `commit:build` | capital | live | `CITY_LEVEL_TOO_LOW`, `NO_FREE_BUILD_SLOT`, `NOT_ENOUGH_CAPITAL` | `CITY_LEVEL_TOO_LOW` | `CITY_LEVEL_TOO_LOW` |
| `building_card` | `building_deactivate` | `commit:build` | none | live |  |  |  |
| `building_card` | `building_upgrade` | `commit:upgrade` | capital | live | `NOT_ENOUGH_CAPITAL` | `NOT_ENOUGH_CAPITAL` | `NOT_ENOUGH_CAPITAL` |
| `district_card` | `district_claim_fragment` | `commit:claim_fragment` | none | live | `DEMO_NO_CLAIM`, `WALLET_NOT_CONNECTED` | `DEMO_NO_CLAIM` | `WALLET_NOT_CONNECTED` |
| `district_card` | `district_claim_unstaked` | `commit:claim_unstaked` | none | live | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` |
| `district_card` | `district_merge` | `commit:merge` | none | live | `MERGE_MATCHING_BLOCKED` | `MERGE_MATCHING_BLOCKED` | `MERGE_MATCHING_BLOCKED` |
| `district_card` | `district_pick_node` | `commit:pick_node` | none | live | `NODE_SIDE_LOCKED` | `NODE_SIDE_LOCKED` | `NODE_SIDE_LOCKED` |
| `district_card` | `district_stake_more` | `commit:stake` | none | live | `STAKE_MULT_SHORT` | `STAKE_MULT_SHORT` | `STAKE_MULT_SHORT` |
| `district_card` | `district_unlock_tier` | `commit:unlock_tier` | none | live | `TIER_NOT_UNLOCKED` | `TIER_NOT_UNLOCKED` | `TIER_NOT_UNLOCKED` |
| `district_card` | `district_unstake` | `commit:unstake` | none | live | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` |
| `districts` | `districts_open` | `commit:open_district` | none | live | `WALLET_NOT_CONNECTED`, `STAKE_BELOW_THRESHOLD` | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` |
| `districts` | `districts_open_card` | `navigate:district_card` | none | live |  |  |  |
| `districts` | `districts_select_automation` | `select:automation` | none | live | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` |
| `districts` | `districts_select_finance` | `select:finance` | none | live | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` |
| `districts` | `districts_select_logistics` | `select:logistics` | none | live | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` | `DISTRICT_LOCKED` |
| `districts` | `districts_to_exchange` | `navigate:exchange` | none | live |  |  |  |
| `exchange` | `exchange_buy` | `commit:buy_stock` | corp | live | `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CORP`, `EXCHANGE_HOP_UNAVAILABLE` | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` |
| `leaderboard` | `leaderboard_claim` | `commit:claim_prize` | none | live | `DEMO_NO_PRIZE`, `WALLET_NOT_CONNECTED` | `DEMO_NO_PRIZE` | `WALLET_NOT_CONNECTED` |
| `leaderboard` | `leaderboard_inspect` | `select:city` | none | live | `DEMO_NO_PRIZE`, `PRIZE_NOT_QUALIFIED` | `DEMO_NO_PRIZE` | `PRIZE_NOT_QUALIFIED` |
| `leaderboard` | `leaderboard_stake_gate` | `select:stake` | none | live | `PRIZE_STAKE_REQUIRED` | `PRIZE_STAKE_REQUIRED` | `PRIZE_STAKE_REQUIRED` |
| `bottom_menu` | `menu_agents` | `navigate:agents` | none | live |  |  |  |
| `bottom_menu` | `menu_bank` | `navigate:bank` | none | live |  |  |  |
| `bottom_menu` | `menu_build` | `navigate:build` | none | live |  |  |  |
| `bottom_menu` | `menu_districts` | `navigate:districts` | none | live |  |  |  |
| `bottom_menu` | `menu_leaderboard` | `navigate:leaderboard` | none | live |  |  |  |
| `bottom_menu` | `menu_missions` | `navigate:missions` | none | live | `FEATURE_NOT_IN_V1` | `FEATURE_NOT_IN_V1` | `FEATURE_NOT_IN_V1` |
| `bottom_menu` | `menu_research` | `navigate:research` | none | live |  |  |  |
| `missions` | `missions_start` | `commit:noop` | none | stub | `FEATURE_NOT_IN_V1` | `FEATURE_NOT_IN_V1` | `FEATURE_NOT_IN_V1` |
| `offline_return` | `offline_continue` | `navigate:build` | none | live |  |  |  |
| `research` | `research_unlock_circuits` | `commit:research_start` | capital | live | `CITY_LEVEL_TOO_LOW`, `NOT_ENOUGH_CAPITAL` | `CITY_LEVEL_TOO_LOW` | `CITY_LEVEL_TOO_LOW` |
| `research` | `research_unlock_grid` | `commit:research_start` | capital | live | `CITY_LEVEL_TOO_LOW`, `NOT_ENOUGH_CAPITAL` | `CITY_LEVEL_TOO_LOW` | `CITY_LEVEL_TOO_LOW` |
| `research` | `research_unlock_handbook` | `commit:research_start` | capital | live | `CITY_LEVEL_TOO_LOW`, `NOT_ENOUGH_CAPITAL` | `CITY_LEVEL_TOO_LOW` | `CITY_LEVEL_TOO_LOW` |
| `research` | `research_unlock_lathe` | `commit:research_start` | capital | live | `CITY_LEVEL_TOO_LOW`, `NOT_ENOUGH_CAPITAL` | `CITY_LEVEL_TOO_LOW` | `CITY_LEVEL_TOO_LOW` |
| `research` | `research_unlock_tools` | `commit:research_start` | capital | live | `CITY_LEVEL_TOO_LOW`, `NOT_ENOUGH_CAPITAL` | `CITY_LEVEL_TOO_LOW` | `CITY_LEVEL_TOO_LOW` |
| `scene` | `scene_building` | `navigate:building_card` | none | live |  |  |  |
| `settings` | `settings_language` | `toggle:language` | none | live |  |  |  |
| `topbar` | `topbar_corp` | `navigate:bank` | none | live | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` | `WALLET_NOT_CONNECTED` |
| `topbar` | `topbar_settings` | `navigate:settings` | none | live |  |  |  |
| `wallet_connect` | `wallet_confirm` | `external:chain` | none | live | `WALLET_WRONG_CHAIN` | `WALLET_WRONG_CHAIN` | `WALLET_WRONG_CHAIN` |
| `wallet_connect` | `wallet_connect_start` | `external:wallet` | none | live |  |  |  |

## T9: капабилити и порядок гейтов

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| token | tier | kind | code |
|---|---:|---|---|
| `not_demo_claim` | 10 | blocking | `DEMO_NO_CLAIM` |
| `not_demo_prize` | 10 | blocking | `DEMO_NO_PRIZE` |
| `not_demo_withdraw` | 10 | blocking | `DEMO_NO_WITHDRAW` |
| `wallet` | 11 | blocking | `WALLET_NOT_CONNECTED` |
| `wallet_chain` | 12 | blocking | `WALLET_WRONG_CHAIN` |
| `v1_feature` | 20 | blocking | `FEATURE_NOT_IN_V1` |
| `city_level` | 30 | blocking | `CITY_LEVEL_TOO_LOW` |
| `district_open` | 30 | blocking | `DISTRICT_LOCKED` |
| `merge_free` | 30 | blocking | `MERGE_MATCHING_BLOCKED` |
| `node_side` | 30 | blocking | `NODE_SIDE_LOCKED` |
| `season_qualified` | 30 | blocking | `PRIZE_NOT_QUALIFIED` |
| `season_stake` | 30 | blocking | `PRIZE_STAKE_REQUIRED` |
| `stake_mult` | 30 | blocking | `STAKE_MULT_SHORT` |
| `stake_threshold` | 30 | blocking | `STAKE_BELOW_THRESHOLD` |
| `tier_unlocked` | 30 | blocking | `TIER_NOT_UNLOCKED` |
| `build_tile` | 31 | blocking | `BUILD_TILE_ILLEGAL` |
| `agent_slot` | 40 | blocking | `NO_FREE_AGENT_SLOT` |
| `build_slot` | 40 | blocking | `NO_FREE_BUILD_SLOT` |
| `capital` | 50 | blocking | `NOT_ENOUGH_CAPITAL` |
| `corp` | 50 | blocking | `NOT_ENOUGH_CORP` |
| `bank_open` | 60 | blocking | `BANK_CLOSED` |
| `bank_weekday` | 60 | blocking | `BANK_SUNDAY` |
| `building_hours` | 60 | warning | `IDLE_OUT_OF_HOURS` |
| `bank_limit` | 70 | blocking | `BANK_DAILY_LIMIT_REACHED` |
| `fragment_city_cap` | 70 | warning | `FRAGMENT_CITY_CAPPED` |
| `fragment_pool` | 70 | warning | `FRAGMENT_POOL_EMPTY` |
| `period_open` | 70 | warning | `PRIZE_PERIOD_SETTLED` |
| `prize_pool` | 70 | warning | `PRIZE_POOL_EMPTY` |
| `prize_share_capped` | 70 | warning | `PRIZE_SHARE_CAPPED` |
| `prize_uncovered` | 70 | warning | `PRIZE_CLAIM_UNCOVERED` |
| `prize_unsettled` | 70 | warning | `PRIZE_UNSETTLED_RETURNED` |
| `season_open` | 70 | warning | `SEASON_SETTLED` |
| `bank_limit_depth` | 80 | warning | `BANK_LIMIT_FROM_DEPTH` |
| `district_freezing` | 80 | warning | `DISTRICT_FREEZING` |
| `district_frozen` | 80 | warning | `DISTRICT_FROZEN` |
| `fragment_hop` | 80 | warning | `FRAGMENT_HOP_STALE` |
| `hop_priced` | 80 | blocking | `EXCHANGE_HOP_UNAVAILABLE` |
| `mint_cap` | 80 | warning | `MINT_RATE_CAPPED` |
| `oracle_alive` | 80 | warning | `ORACLE_DECAYING` |
| `oracle_fresh` | 80 | warning | `ORACLE_STALE` |
| `price_fresh` | 80 | warning | `STALE_PRICE` |
| `prize_hop` | 80 | warning | `PRIZE_HOP_STALE` |
| `vault_cover` | 80 | warning | `VAULT_EXIT_UNCOVERED` |

Порядок на элементе — `(tier, token)`. Блокирующий код — первый `blocking` в этом порядке. Колонка «без демо» пропускает `not_demo_*`: реальный город без кошелька.

## T9: поверхности состояний

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| код | поверхности |
|---|---|
| `BANK_CLOSED` | `topbar`, `bank` |
| `BANK_DAILY_LIMIT_REACHED` | `bank`, `topbar` |
| `BANK_LIMIT_FROM_DEPTH` | `bank` |
| `BANK_SUNDAY` | `topbar`, `bank` |
| `CHAIN_REORG` | `bank`, `exchange` |
| `DISTRICT_FREEZING` | `districts_panel`, `district_card` |
| `DISTRICT_FROZEN` | `districts_panel`, `district_card`, `district_overview` |
| `EXCHANGE_DELIVERY_UNVERIFIED` | `exchange` |
| `EXCHANGE_HOP_UNAVAILABLE` | `exchange` |
| `FEATURE_NOT_IN_V1` | `missions`, `leaderboard` |
| `FRAGMENT_CITY_CAPPED` | `district_card` |
| `FRAGMENT_HOP_STALE` | `district_card` |
| `FRAGMENT_NO_CLAIMS` | `district_card` |
| `FRAGMENT_POOL_EMPTY` | `district_card` |
| `FRAGMENT_SLICE_PENDING` | `exchange` |
| `FRAGMENT_WINDOW_SETTLED` | `district_card` |
| `IDLE_BANK_CLOSED` | `log_panel`, `agents_panel` |
| `IDLE_DISTRICT_FROZEN` | `log_panel`, `agents_panel` |
| `IDLE_NO_AGENT` | `log_panel`, `agents_panel`, `scene` |
| `IDLE_NO_COMPUTE` | `log_panel`, `agents_panel`, `scene` |
| `IDLE_NO_ENERGY` | `log_panel`, `agents_panel`, `scene` |
| `IDLE_NO_MATERIALS` | `log_panel`, `agents_panel` |
| `IDLE_NO_RESEARCH_FOCUS` | `log_panel`, `agents_panel` |
| `IDLE_NO_TRAIN_TARGET` | `log_panel`, `agents_panel` |
| `IDLE_OFFLINE_CAP_REACHED` | `log_panel`, `agents_panel`, `offline_return` |
| `IDLE_OUT_OF_HOURS` | `log_panel`, `agents_panel` |
| `IDLE_UNDER_CONSTRUCTION` | `log_panel`, `agents_panel` |
| `IDLE_WRONG_ROLE` | `log_panel`, `agents_panel` |
| `LEDGER_NOT_EMPTY_LIVE` | `bank` |
| `MINT_RATE_CAPPED` | `bank` |
| `MODIFIER_CAP_CLAMPED` | `building_card`, `log_panel` |
| `ORACLE_DECAYING` | `stock_bar`, `districts_panel` |
| `ORACLE_STALE` | `stock_bar`, `districts_panel` |
| `PAYROLL_TRIMMED` | `overview`, `agents_panel` |
| `PRIZE_CLAIM_UNCOVERED` | `leaderboard` |
| `PRIZE_HOP_STALE` | `leaderboard` |
| `PRIZE_NOTHING_OWED` | `exchange` |
| `PRIZE_NOT_QUALIFIED` | `leaderboard` |
| `PRIZE_NO_ELIGIBLE` | `leaderboard` |
| `PRIZE_PERIOD_SETTLED` | `leaderboard` |
| `PRIZE_POOL_EMPTY` | `leaderboard` |
| `PRIZE_SHARE_CAPPED` | `leaderboard` |
| `PRIZE_STAKE_REQUIRED` | `leaderboard` |
| `PRIZE_UNSETTLED_RETURNED` | `leaderboard` |
| `PRIZE_WALLET_MERGED` | `leaderboard` |
| `RENDER_NO_GPU` | `scene` |
| `SEASON_SETTLED` | `leaderboard` |
| `STAKE_LEDGER_LIVE` | `district_card` |
| `STALE_PRICE` | `stock_bar`, `bank`, `exchange` |
| `UNSTAKE_COOLING` | `district_card` |
| `UNSTAKE_NOTHING_PENDING` | `district_card` |
| `VAULT_EXIT_UNCOVERED` | `bank` |
| `VOUCHER_EXPIRED` | `bank` |
| `VOUCHER_EXPIRE_LIMIT` | `bank` |
| `VOUCHER_PENDING` | `bank` |
| `VOUCHER_PENDING_SIGN` | `bank` |
| `VOUCHER_REJECTED` | `bank` |
| `WALLET_NOT_CONNECTED` | `topbar`, `wallet_connect` |
| `WALLET_WRONG_CHAIN` | `wallet_connect` |

invisible_state_codes: пусто.
idle_codes_surfaced: 12.

## T9: пустота и загрузка

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| kind | ids |
|---|---|
| loading | `skeleton`, `spinner_inline`, `stale_freeze` |
| empty | `no_entities_yet`, `no_events_yet`, `not_qualified_yet`, `nothing_to_claim` |

## T9: демо-гарды

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| код | экраны | элементы |
|---|---|---|
| `DEMO_NO_CLAIM` | `district_card` | `district_claim_fragment` |
| `DEMO_NO_COMPANION` |  |  |
| `DEMO_NO_PRIZE` | `leaderboard` | `leaderboard_claim`, `leaderboard_inspect` |
| `DEMO_NO_WITHDRAW` | `bank` | `bank_withdraw` |

## T9: онбординг и возвращение

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| поток | шаг | учит | коды |
|---|---:|---|---|
| `offline_return` | 1 | caught-up ticks capped by offline window | `IDLE_OFFLINE_CAP_REACHED` |
| `offline_return` | 2 | continue is navigate, never a commit |  |

## T9: свидетели

Сгенерировано. Источники: `screens.json` реестр, `research.json` узлы, `codes.json` / `strings/ru.json`, `balance.json` лестница банка, `meta.json` `bank_daily_limit_pool_share_cap_bps`, `launch.json` глубина, `economy.json` `creator_tax_bps` / vault, `fragments.json` hop, `time.json` оффлайн. Команда: `python content/build.py`.

| величина | значение |
|---|---|
| bank_daily_limit_live.wei | 143556000000000000 |
| ladder_ceiling_wei | 143556000000000000 |
| pool_cap_wei | 210000000000000000 |
| binds_from_depth | 0 |
| exchange_quote lo | 397 |
| exchange_quote hi | 399 |
| hop_lo/hi bps | 1/3 |
| offline_return_ticks_cap | 12 |
| screens_total | 27 |
| actions_total | 49 |
| panels_total | 26 |
| fields_total | 47 |
| field sources server/clock/format | 41/2/4 |
| economic_non_server | 0 |
| unreachable_refusal | пусто |


## T10: кварталы и лоты

Сгенерировано. Источники: `placement.json` авторские параметры, `time.json` часы фаз, `districts.json` зоны и синергии, `buildings.json` база и заполнитель, `balance.json` `building_level_max`, `codes.json` / `screens.json` бейджи, `fixtures/hud_layout.json` геометрия HUD, `art/pipeline/assets.json` и `art/pipeline/assets_pending.json`. Команда: `python content/build.py`.

| величина | значение |
|---|---|
| block_side | 6 |
| lot_ring_depth | 2 |
| courtyard_side | 2 |
| island_radius_tiles | 29 |
| grid_size | 63 |
| lots_per_block | 6 |
| lots_needed | 38 |
| blocks_required | 25 |
| blocks_on_land | 25 |
| lots_total | 150 |
| min_road_period | 8 |

| зона | кварталов | лотов |
|---|---:|---:|
| `automation` | 4 | 24 |
| `compute` | 4 | 24 |
| `consumer` | 4 | 24 |
| `core` | 1 | 6 |
| `energy` | 4 | 24 |
| `finance` | 4 | 24 |
| `logistics` | 4 | 24 |

## T10: счётчики декора и мосты

Сгенерировано. Источники: `placement.json` авторские параметры, `time.json` часы фаз, `districts.json` зоны и синергии, `buildings.json` база и заполнитель, `balance.json` `building_level_max`, `codes.json` / `screens.json` бейджи, `fixtures/hud_layout.json` геометрия HUD, `art/pipeline/assets.json` и `art/pipeline/assets_pending.json`. Команда: `python content/build.py`.

| величина | значение | роль |
|---|---|---|
| park_slots | 7 | economic_bridge |
| plaza_slots | 6 | economic_bridge |
| filler_occupied_total | 30 | economic_bridge |
| lantern_count | 10 | counter |
| tree_count | 0 | counter |
| vehicle_count | 161 | counter |
| drone_count | 6 | counter |
| mini_island_count | 5 | counter |
| land_tiles | 2629 | counter |
| water_tiles | 1340 | counter |
| road_tiles | 1153 | counter |
| decor_realized_share_bps | 1087 | counter |
| layout_hash | `7c090c51a1eaac97e1c1de321a7f82ebbe5ebc0de4d7b0ac0c1910e10774f324` | artifact |

## T10: сутки и зум

Сгенерировано. Источники: `placement.json` авторские параметры, `time.json` часы фаз, `districts.json` зоны и синергии, `buildings.json` база и заполнитель, `balance.json` `building_level_max`, `codes.json` / `screens.json` бейджи, `fixtures/hud_layout.json` геометрия HUD, `art/pipeline/assets.json` и `art/pipeline/assets_pending.json`. Команда: `python content/build.py`.

| фаза | start | duration | ramp | alpha_bps | lights |
|---|---:|---:|---|---:|---:|
| `dawn` | 6 | 2 | `amber` | 2800 | 1 |
| `day` | 8 | 12 | `highlight` | 0 | 0 |
| `dusk` | 20 | 2 | `crimson` | 3200 | 1 |
| `night` | 22 | 8 | `navy` | 4500 | 1 |

phase_hours_sum 24. lanterns_on_phases: `dawn`, `dusk`, `night`

| зум num/den |
|---|
| 1/8 |
| 1/4 |
| 1/2 |
| 1/1 |
| 2/1 |

safe_rect 504×432 px; iso 4032×2016; min 1/8.

## T10: арт-работы

Сгенерировано. Источники: `placement.json` авторские параметры, `time.json` часы фаз, `districts.json` зоны и синергии, `buildings.json` база и заполнитель, `balance.json` `building_level_max`, `codes.json` / `screens.json` бейджи, `fixtures/hud_layout.json` геометрия HUD, `art/pipeline/assets.json` и `art/pipeline/assets_pending.json`. Команда: `python content/build.py`.

| id | footprint | ramps | status |
|---|---|---|---|

## T11: record fields

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

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
| `seed` | str | hex of sha256 digest[:8] |
| `output` | int | Capital this tick |
| `payroll_ratio_bps` | int |  |
| `status` | str | paid|idle|gap|construction |
| `reason` | str | idle code or empty string |
| `fragments_delta` | int | 0 when none accrue |
| `stage_bps` | object | base and post; empty stack is BPS |

Заголовок тика (лист 0): `layout_version`, `city_id`, `tick_index`, `city_time`, `pack_hash`, `corp_eth_wei_per_whole`, `eth_usd_8dec`, `feed_live`, `dex_turnover_usd_8dec`, `price_sample_city_time`, `companion_commands_hash`, `prev_state_hash`, `stake_snapshot`

## T11: remainder sinks

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

| функция | `//` | смысл | сток остатка |
|---|---:|---|---|
| `_apply_spend` | `6` | burn / fund / protocol with explicit dust | dust is routed to the fund; protocol is never the residual |
| `split_creator_tax_atoms` | `3` | creator-tax fund / prize / active-work floors | integer remainder stays in the prize-derived split |
| `_assert_i1` | `1` | vault coverage identity | slack floor stays unminted |
| `_assert_i2` | `2` | entry vs exit bps | identity remainder is not a second printer |
| `_bank_withdraw` | `14` | Capital to CORP at markup | wei dust stays as Capital |
| `_buyback` | `3` | ETH tax to CORP to vault | below buyback_min stays in treasury |
| `_check_term_clamp` | `1` | jobs / park_capacity fixture | test remainder, not a payout |
| `_collect_requests` | `6` | output chain x bps / BPS | per-step floor, not redistributed |
| `collect_slot_requests` | `17` | slot output and draw x bps / BPS | per-step floor, not redistributed |
| `_cork_return` | `1` | cork extra to CORP | wei remainder unconverted |
| `_equal_weights` | `1` | BPS / 4 | test helper; pack holds the four params |
| `_fix_day_budget` | `2` | max(horizon, inflow) then / ticks_day | remainder stays in the day budget |
| `_smoothed_inflow` | `1` | sum of fund_in_day_buf / n days | inflow dust stays unbudgeted until the next freeze |
| `_flush_week_drip` | `2` | week shortfall to CORP | wei remainder unconverted |
| `_focus_scale` | `1` | manager focus quantum x (BPS ± node_effect_base) / BPS | per-step floor, not redistributed |
| `_fund_cap` | `1` | I7 coverage vs vault | uncovered remainder is the plaque |
| `_note_virgin_week_drain` | `1` | drained / week_start | remainder of the week share |
| `_pay` | `5` | boost pool, ratio, fund-share claim, and payout | unpaid remainder stays in the fund; nobody zero while fund > 0 |
| `_payroll_boost_days_left` | `1` | ceil remaining window ticks / ticks_day | partial city day still counts as one day left |
| `_recalc_efficiency` | `2` | `ema_24h` / `ema_30d` then k x delta | clamp eats the overshoot |
| `_reserve_drip` | `2` | virgin x drain_bps / BPS | unused room waits for next week |
| `_resolve_city_time` | `1` | tick_index from city_time | sub-tick hours refused as CITY_TIME |
| `_update_mint_rate` | `2` | ema mean and mint_rate_limit ceiling | over-ceiling mint is dropped, not banked |
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
| `scale_by_modifier_key` | `1` | value x live key clip / BPS | per-step floor, not redistributed |
| `split_bank_limit` | `1` | ask x cap / sum asks | floor, remainder undistributed |
| `tick` | `1` | I7 coverage bps | remainder of vault vs exit |

## T11: prng streams

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

| id | stream | src |
|---|---|---|
| `jitter_legacy` | `(empty)` | DESIGN.md §5.3, D11 |

## T11: day-boundary contours

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

| контур | hour | события |
|---|---:|---|
| `midnight` | 0 | `payroll_budget_freeze`, `ema_step`, `mint_ratchet`, `stale_mint_decay`, `gdp_stability_close`, `virgin_week_boundary` |
| `efficiency_recalc` | 6 | `district_efficiency_recalc`, `fragment_settle`, `season_prize_settle` |

## T11: attest params

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

| величина | значение | единица |
|---|---:|---|
| `attest_root_period_s` | 60 | seconds |
| `merkle_leaf_domain_byte` | 0 | count |
| `merkle_node_domain_byte` | 1 | count |
| `attest_roots_per_day` | 1440 | count |
| `tick_length_real_seconds` | 3750 | seconds |

IPFS key `(city_id , city_day)`. header leaf 0; records 1..n sorted by agent_id UTF-8 bytes. open: payout already in state, records in outbox, HUD logged not Verified

## T11: happiness weights

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

| член | вес bps |
|---|---:|
| `housing_bps` | 2500 |
| `parks_bps` | 2500 |
| `energy_bps` | 2500 |
| `payroll_bps` | 2500 |

park_capacity_jobs 2. energy_buffer_ticks 12.

## T11: tick codes

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

| код | поверхность | когда |
|---|---|---|
| `PACK_HASH` | tick halt | recorded pack_hash mismatches cfg |
| `CITY_TIME` | tick halt | city_time and tick_index disagree |
| `STALE_PRICE` | topbar / log | feed silent or zero |
| `BANK_DAILY_LIMIT_REACHED` | bank plaque | global 1% depth fill |
| `IDLE_NO_ENERGY` | scene / agents | energy stock or energy_ok fails |
| `IDLE_NO_COMPUTE` | scene / agents | compute stock empty on prod path |
| `IDLE_NO_TRAIN_TARGET` | agents | scientist train has no living other agent |
| `IDLE_NO_RESEARCH_FOCUS` | agents | scientist research has no live research_focus |
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
| `aggregate.payroll_boost_bps` | `produce_aggregate_payroll_boost_bps` |
| `aggregate.payroll_boost_days_left` | `produce_aggregate_payroll_boost_days_left` |
| `aggregate.happiness` | `produce_aggregate_happiness` |
| `aggregate.stability` | `produce_aggregate_stability` |
| `wallet.stake_tokens` | `produce_wallet_stake_tokens` |
| `seasons.influence_rank` | `produce_seasons_influence_rank` |
| `fragments.city_ledger` | `produce_fragments_city_ledger` |
| `log.events` | `produce_log_events` |
| `oracle.stock_price` | `produce_oracle_stock_price` |
| `oracle.district_efficiency` | `produce_oracle_district_efficiency` |

## T11: lint L196+

Сгенерировано. Источники: `tick.json`, `attest.json`, `time.json` `efficiency_recalc_hour`, `agents` слоты, `districts` playable_v1, `sim.real_day_seconds`, `screens.state_sources`. Команда: `python content/build.py`.

Правила следующей волны. Этот шаг пак и проводку отдаёт, линтер L196+ не пишет.

| id | title |
|---|---|
| `L196` | DecisionRecord key set equals layout v1 |
| `L197` | null forbidden in record and header |
| `L198` | float forbidden in record and header |
| `L199` | canonical bytes ignore input key order |
| `L200` | layout_version=1; layout change is major |
| `L201` | merkle leaf/node prefixes from params and differ |
| `L202` | keccak vectors empty/abc/135/136/137 |
| `L203` | positional merkle, odd level not duplicated |
| `L204` | attest_root_period_s divides 3600 and <= tick length |
| `L205` | IPFS aggregate key is (city_id, city_day) |
| `L206` | pay before record in tick.py AST |
| `L207` | pack_hash mismatch halts the tick |
| `L208` | no network or wall clock on the tick path |
| `L209` | no /, round, float, math, Decimal on tick path |
| `L210` | every // on the tick path has a remainder sink |
| `L211` | tick_index is derived; city_time is the input |
| `L212` | two day-boundary contours; each event once |
| `L213` | 06:00 hour from efficiency_recalc_hour, not a literal |
| `L214` | catch-up = min(elapsed, cap) plus a gap record |
| `L215` | Happiness weights sum to BPS; terms clamped |
| `L216` | happiness_penalty_live = 0 in v1 |
| `L217` | productivity_bps is not a stored param |
| `L218` | Stability has one definition in seasons |
| `L219` | fragments accrue only on a paid beacon tick |
| `L220` | live=0 mints no CORP; live=1 needs recount |
| `L221` | companion commands are an input, not a record field |
| `L222` | every T11 state_source has a producer |
| `L223` | jitter % span is the named exception |
| `L224` | brief_t11_tick items appear in TICK.md |
| `L225` | TICK.md has no bare two-digit literals after strip |

## T12: packages

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| id | path | layer | deps | preview |
|---|---|---:|---|---|
| `engine` | `packages/engine` | 0 | — | `0` |
| `protocol` | `packages/protocol` | 1 | — | `0` |
| `contentpack` | `packages/contentpack` | 1 | `protocol` | `0` |
| `chainport` | `packages/chainport` | 2 | `protocol` | `0` |
| `render` | `packages/render` | 2 | `protocol`,`contentpack` | `0` |
| `api` | `services/api` | 3 | `engine`,`protocol`,`contentpack`,`chainport` | `0` |
| `sampler` | `services/sampler` | 3 | `engine`,`protocol`,`contentpack`,`chainport` | `0` |
| `buyback` | `services/buyback` | 3 | `engine`,`protocol`,`contentpack`,`chainport` | `0` |
| `attestor` | `services/attestor` | 3 | `engine`,`protocol`,`contentpack`,`chainport` | `0` |
| `client` | `apps/client` | 4 | `protocol`,`engine`,`contentpack`,`render` | `1` |

layer_order: `engine`, `protocol`, `chainport`, `contentpack`, `api`, `attestor`, `buyback`, `render`, `sampler`, `client`

## T12: services

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| id | package | fail_mode | blocks_tick | money |
|---|---|---|---:|---|
| `api` | `api` | `open` | `0` | `1` |
| `sampler` | `sampler` | `open` | `0` | `0` |
| `buyback` | `buyback` | `open` | `0` | `0` |
| `attestor` | `attestor` | `open` | `0` | `0` |
| `pack_gate` | `engine` | `closed` | `1` | `0` |

## T12: codegen

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| id | source | artifact | consumer |
|---|---|---|---|
| `codes` | `codes.json` | `packages/protocol/src/codes.ts` | `api` |
| `screens` | `screens.json` | `packages/protocol/src/screens.ts` | `client` |
| `modifier_keys` | `modifier_keys.json` | `packages/protocol/src/modifier_keys.ts` | `engine` |
| `districts` | `districts.json` | `packages/protocol/src/districts.ts` | `client` |
| `buildings` | `buildings.json` | `packages/protocol/src/buildings.ts` | `client` |
| `units` | `schema/$defs.unit` | `packages/protocol/src/units.ts` | `protocol` |
| `versions` | `meta.json` | `packages/protocol/src/versions.ts` | `contentpack` |
| `schema_ddl` | `arch.schema_tables` | `services/api/migrations/001_from_pack.sql` | `api` |
| `command_routes` | `derived.command_endpoints` | `packages/protocol/src/routes.ts` | `api` |
| `layer_cruiser` | `arch.packages` | `.dependency-cruiser.cjs` | `engine` |
| `ws_channels` | `arch.channel_rules` | `packages/protocol/src/channels.ts` | `client` |
| `tsconfig_refs` | `arch.packages` | `tsconfig.json` | `engine` |
| `listen` | `arch.listen` | `packages/protocol/src/listen.ts` | `api` |
| `dockerfile` | `arch.image` | `deploy/Dockerfile` | `api` |
| `compose` | `arch.postgres` | `deploy/compose.yaml` | `api` |
| `compose_prod` | `arch.image` | `deploy/compose.prod.yaml` | `api` |
| `env_example` | `arch.secrets, arch.env` | `deploy/.env.example` | `api` |
| `restore_sh` | `arch.backup` | `deploy/restore.sh` | `api` |
| `dump_sh` | `arch.backup` | `deploy/dump.sh` | `api` |
| `ci_runner` | `arch.ci_steps` | `scripts/ci.mjs` | `api` |
| `ci_workflow` | `arch.ci_steps` | `.github/workflows/ci.yml` | `api` |
| `env_manifests` | `arch.environments` | `deploy/environments.json` | `api` |
| `foundry_toml` | `arch.toolchain` | `contracts/foundry.toml` | `chainport` |
| `pack_constants` | `economy.json` | `contracts/test/PackConstants.sol` | `chainport` |

## T12: schema

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| table | key | holds | storage | money | account_kind |
|---|---|---|---|---:|---|
| `accounts` | `account_id` | `none` | `canonical_bytes` | `1` | `1` |
| `cities` | `city_id` | `none` | `canonical_bytes` | `1` | `1` |
| `tick_inputs` | `city_id, city_time` | `tick_input_header` | `canonical_bytes` | `0` | `0` |
| `records` | `city_id, city_time, agent_id` | `decision_record` | `canonical_bytes` | `1` | `1` |
| `state_snapshots` | `city_id, city_time` | `none` | `canonical_bytes` | `0` | `1` |
| `outbox` | `id` | `none` | `canonical_bytes` | `0` | `0` |
| `attest_roots` | `root_id` | `none` | `canonical_bytes` | `0` | `0` |
| `price_samples` | `sampled_at` | `none` | `canonical_bytes` | `0` | `0` |
| `buyback_batches` | `batch_id` | `none` | `canonical_bytes` | `1` | `1` |
| `vouchers` | `nonce` | `none` | `canonical_bytes` | `1` | `1` |
| `intents` | `city_id, intent_id` | `none` | `canonical_bytes` | `1` | `1` |
| `fragments_ledger` | `city_id, ticker, window` | `none` | `canonical_bytes` | `1` | `1` |
| `seasons` | `city_id, season_id` | `none` | `canonical_bytes` | `1` | `1` |
| `prize_pools` | `period_id, kettle, asset` | `none` | `canonical_bytes` | `1` | `1` |
| `prize_payouts` | `period_id, kettle, asset, wallet` | `none` | `canonical_bytes` | `1` | `1` |
| `basket_batches` | `batch_id` | `none` | `canonical_bytes` | `1` | `1` |
| `prize_returns` | `return_id` | `none` | `canonical_bytes` | `1` | `1` |
| `schema_migrations` | `version` | `none` | `canonical_bytes` | `0` | `0` |
| `sessions` | `session_id` | `none` | `canonical_bytes` | `0` | `1` |
| `city_owners` | `subject` | `none` | `canonical_bytes` | `0` | `1` |
| `command_rates` | `city_id, tick_index` | `none` | `canonical_bytes` | `0` | `0` |
| `tick_locks` | `world` | `none` | `canonical_bytes` | `0` | `0` |

Field homes: `agent_id`→`records`, `building_id`→`records`, `city_id`→`tick_inputs`, `city_time`→`tick_inputs`, `companion_commands_hash`→`tick_inputs`, `corp_eth_wei_per_whole`→`tick_inputs`, `dex_turnover_usd_8dec`→`tick_inputs`, `district_efficiency_bps`→`records`, `eth_usd_8dec`→`tick_inputs`, `feed_live`→`tick_inputs`, `fragments_delta`→`records`, `inputs`→`records`, `layout_version`→`tick_inputs`, `objective`→`records`, `output`→`records`, `pack_hash`→`tick_inputs`, `payroll_ratio_bps`→`records`, `prev_state_hash`→`tick_inputs`, `price_sample_city_time`→`tick_inputs`, `reason`→`records`, `seed`→`records`, `stage_bps`→`records`, `stake_snapshot`→`tick_inputs`, `status`→`records`, `tick_index`→`tick_inputs`

## T12: port

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| group | DESIGN.md §10 |
|---|---|
| `corp_token` | token $CORP with creator fee in the pool |
| `vault` | vault deposit mints Capital, withdraw via signed voucher |
| `stake_registry` | stock staking contract |
| `merkle_roots` | merkle root registry |
| `prize_treasury` | prize treasury for farm and month stock kettles |

implementations `mock`, `rpc`; rpc_import_only `rpc`.

## T12: metrics

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| metric | invariant | service | threshold_src |
|---|---|---|---|
| `vault_cover` | `I1_I3` | `api` | `economy.params.capital_anchor` |
| `friction_budget` | `L13_L14` | `api` | `meta.params.round_trip_floor_bps` |
| `payroll_ratio` | `payroll_proportional` | `api` | `time.derived.ticks_per_city_day` |
| `i5_reserve_drain` | `I5` | `api` | `economy.params.reserve_weekly_drain_bps` |
| `i7_exit_cover` | `I7` | `api` | `pending.items.exit_uncovered_at_band_floor` |
| `i11_flow` | `I11` | `api` | `generated.balance.fund_contribution_bps` |
| `tick_determinism` | `tick_pure` | `engine` | `tick.params.layout_version` |
| `catchup_eq_replay` | `catchup_eq_replay` | `api` | `time.params.offline_cap_city_hours_base` |
| `layout_v1_bytes` | `layout_v1_bytes` | `attestor` | `tick.params.layout_version` |
| `demo_barrier` | `demo_isolated` | `api` | `screens.params.demo_isolated` |

## T12: environments

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| env | migrations |
|---|---|
| `dev` | `forward` |
| `staging` | `forward` |
| `prod` | `forward` |

readiness requires `pack_hash`, `migration_version`.

derived: snapshot_every `24`, sampler_age_alert `3`, sampler_period_s `50`, samples_per_window `1800`, rate_limit `40`, voucher_ttl_s `3750`, unstake_cooldown_s `2700000`.

## T12: endpoints

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| effect | path | refusals |
|---|---|---|
| `assign` | `/command/assign` | — |
| `build` | `/command/build` | `CITY_LEVEL_TOO_LOW`, `BUILD_TILE_ILLEGAL`, `NO_FREE_BUILD_SLOT`, `NOT_ENOUGH_CAPITAL` |
| `buy_stock` | `/command/buy_stock` | `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CORP`, `EXCHANGE_HOP_UNAVAILABLE` |
| `claim_fragment` | `/command/claim_fragment` | `DEMO_NO_CLAIM`, `WALLET_NOT_CONNECTED` |
| `claim_prize` | `/command/claim_prize` | `DEMO_NO_PRIZE`, `WALLET_NOT_CONNECTED` |
| `claim_unstaked` | `/command/claim_unstaked` | `WALLET_NOT_CONNECTED` |
| `deposit` | `/command/deposit` | `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CORP` |
| `hire` | `/command/hire` | `NO_FREE_AGENT_SLOT`, `NOT_ENOUGH_CAPITAL` |
| `merge` | `/command/merge` | `MERGE_MATCHING_BLOCKED` |
| `noop` | `/command/noop` | `FEATURE_NOT_IN_V1` |
| `open_district` | `/command/open_district` | `WALLET_NOT_CONNECTED`, `STAKE_BELOW_THRESHOLD` |
| `pick_node` | `/command/pick_node` | `NODE_SIDE_LOCKED` |
| `present_voucher` | `/command/present_voucher` | `WALLET_NOT_CONNECTED` |
| `research_start` | `/command/research_start` | `CITY_LEVEL_TOO_LOW`, `NOT_ENOUGH_CAPITAL` |
| `set_objective` | `/command/set_objective` | `IDLE_OUT_OF_HOURS` |
| `stake` | `/command/stake` | `STAKE_MULT_SHORT` |
| `unlock_tier` | `/command/unlock_tier` | `TIER_NOT_UNLOCKED` |
| `unstake` | `/command/unstake` | `DISTRICT_LOCKED` |
| `upgrade` | `/command/upgrade` | `NOT_ENOUGH_CAPITAL` |
| `withdraw` | `/command/withdraw` | `DEMO_NO_WITHDRAW`, `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CAPITAL`, `BANK_CLOSED`, `BANK_SUNDAY`, `BANK_DAILY_LIMIT_REACHED` |

## T12: channels

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| state_source | channel |
|---|---|
| `aggregate.gdp` | `aggregate` |
| `aggregate.happiness` | `aggregate` |
| `aggregate.payroll_boost_bps` | `aggregate` |
| `aggregate.payroll_boost_days_left` | `aggregate` |
| `aggregate.payroll_ratio` | `aggregate` |
| `aggregate.stability` | `aggregate` |
| `fragments.city_ledger` | `aggregate` |
| `log.events` | `log` |
| `oracle.district_efficiency` | `efficiency` |
| `oracle.stock_price` | `price` |
| `seasons.influence_rank` | `aggregate` |
| `seasons.prize_basket` | `aggregate` |
| `tick.agent_state` | `tick` |
| `tick.building_level` | `tick` |
| `tick.capital` | `tick` |
| `tick.compute` | `tick` |
| `tick.energy` | `tick` |
| `wallet.chain` | `price` |
| `wallet.corp_balance` | `price` |
| `wallet.protocol_eth_in_flight` | `price` |
| `wallet.protocol_studio_eth` | `price` |
| `wallet.protocol_vault_corp` | `price` |
| `wallet.stake_tokens` | `tick` |

price_channel_period_s `50`.

## T12: http

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| code | http |
|---|---:|
| `API_INTENT_REPLAY` | `200` |
| `API_MALFORMED` | `400` |
| `API_PACK_STALE` | `409` |
| `API_RATE_LIMITED` | `429` |
| `API_UNAUTHORIZED` | `401` |
| `CHAIN_TX_UNCONFIRMED` | `409` |
| `SERVICE_DEGRADED` | `200` |
| `WALLET_TX_REJECTED` | `400` |

domain_conflict_http `409`. envelope error: `code`, `slots`, `city_time`

## T12: snapshot

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| section |
|---|
| `aggregate.gdp` |
| `aggregate.happiness` |
| `aggregate.payroll_boost_bps` |
| `aggregate.payroll_boost_days_left` |
| `aggregate.payroll_ratio` |
| `aggregate.stability` |
| `fragments.city_ledger` |
| `log.events` |
| `oracle.district_efficiency` |
| `oracle.stock_price` |
| `seasons.influence_rank` |
| `seasons.prize_basket` |
| `tick.agent_state` |
| `tick.building_level` |
| `tick.capital` |
| `tick.compute` |
| `tick.energy` |
| `wallet.chain` |
| `wallet.corp_balance` |
| `wallet.protocol_eth_in_flight` |
| `wallet.protocol_studio_eth` |
| `wallet.protocol_vault_corp` |
| `wallet.stake_tokens` |

## T12: roadmap

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| stage | gate_cmd | ts_gate_cmd | tests | invariants |
|---|---|---|---|---|
| `pack_gate` | `python content/lint.py` | `pnpm -w run gate` | `L01`, `L13`, `vault_cover` | `I1_I3`, `L13_L14`, `I5`, `I7` |
| `code_form` | `python content/vectors.py && python content/codegen.py --check` | `pnpm -w run gate` | `L267`, `L268`, `L269`, `L270`, `L271`, `L272` | `tick_pure`, `layout_v1_bytes` |
| `engine_from_spec` | `python content/attack.py --since-rule L196` | `pnpm --filter @corporator/engine run gate` | `L208`, `layout_v1_bytes`, `catchup_eq_replay` | `tick_pure`, `layout_v1_bytes`, `catchup_eq_replay` |
| `protocol_loader` | `python content/codegen.py --check` | `pnpm --filter @corporator/protocol --filter @corporator/contentpack run gate` | `pack_hash_mismatch_halts`, `record_fields_have_homes`, `loader_rejects_float`, `loader_keeps_bigint`, `loader_rejects_duplicate_key`, `pack_by_hash_is_immutable` | `layout_v1_bytes` |
| `host_db_replay` | `python content/attack.py --construction-only` | `pnpm --filter @corporator/api run gate` | `replay_from_storage`, `snapshot_tail_equals_full_replay` | `catchup_eq_replay`, `layout_v1_bytes` |
| `port_mock` | `python content/attack.py --only L256,L257,L258` | `pnpm --filter @corporator/chainport run gate` | `port_two_implementations`, `voucher_single_use` | `I1_I3` |
| `client_on_mock` | `python content/lint.py` | `pnpm --filter @corporator/client run gate` | `L158`, `demo_barrier_holds` | `demo_isolated` |
| `sampler` | `python content/attack.py --only L239,L241,L242,L243` | `pnpm --filter @corporator/sampler run gate` | `sampler_twap_recompute`, `sampler_twap_sensitive`, `sampler_silence_keeps_age` | `tick_pure` |
| `buyback` | `python content/attack.py --only L244,L245` | `pnpm --filter @corporator/buyback run gate` | `mint_after_deposit_only`, `buyback_tranche_at_three_depths`, `buyback_below_min_batch_waits` | `I1_I3`, `I11` |
| `attestor_no_chain` | `python content/attack.py --only L246,L207` | `pnpm --filter @corporator/attestor run gate` | `attestor_down_pay_continues`, `pack_hash_mismatch_halts` | `tick_pure` |
| `observability_ci` | `python content/lint.py` | `pnpm -w run ci` | `image_pins_pack_hash`, `image_has_no_python`, `ci_step_has_red_run` | `tick_pure`, `I1_I3` |
| `chain_v1_1` | `python content/lint.py` | `pnpm --filter @corporator/chainport run gate` | `L204`, `L205` | `layout_v1_bytes` |
| `seasons_prizes_v1_1` | `python content/lint.py` | `pnpm --filter @corporator/api run gate` | `L115`, `L220` | `payroll_proportional` |
| `live_form` | `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268` | `pnpm --filter @corporator/contentpack run gate` | `L262`, `L268`, `live_stage_keys_exist`, `code_phase_rule_not_always` | `layout_v1_bytes` |
| `prize_claim_live` | `python content/lint.py && python content/attack.py --only L162,L165,L155` | `pnpm --filter @corporator/api --filter @corporator/client run test -- -t stub_endpoint_no_spend -t demo_barrier_holds` | `L162`, `L165`, `stub_endpoint_no_spend`, `demo_barrier_holds` | `demo_isolated` |
| `process_hosts` | `pnpm -w run gate && pnpm --filter @corporator/api run test -- -t process_listens -t services_do_not_block_tick` | `pnpm --filter @corporator/api run gate` | `process_listens`, `ws_heartbeat_derived`, `tick_scheduler_uses_city_time`, `services_do_not_block_tick`, `pack_hash_mismatch_halts`, `attestor_down_pay_continues` | `tick_pure` |
| `client_on_host` | `pnpm --filter @corporator/client run gate && pnpm --filter @corporator/client run test -- -t client_boot_requires_city_time -t client_preview_is_readonly` | `pnpm --filter @corporator/client run gate` | `client_boot_requires_city_time`, `command_posts_intent`, `client_preview_is_readonly`, `demo_barrier_holds` | `demo_isolated` |
| `pg_compose` | `pnpm --filter @corporator/api run migrate:check && pnpm --filter @corporator/api run test -- -t replay_from_storage -t image_has_no_python` | `pnpm --filter @corporator/api run gate` | `replay_from_storage`, `image_has_no_python`, `readiness_requires_pack` | `catchup_eq_replay` |
| `art_ground` | `python art/pipeline/tiles.py && python art/pipeline/layout.py && python art/pipeline/scene.py && python art/pipeline/tiles_probe.py && python content/lint.py` | `python art/pipeline/tiles_probe.py` | `L16`, `L178`, `L184` | `layout_v1_bytes` |
| `art_sprites` | `python art/pipeline/pixelize.py --report && python content/lint.py` | `python art/pipeline/pixelize.py --report` | `L16`, `L178`, `L184`, `L273` | `layout_v1_bytes` |
| `owner_freeze` | `python content/lint.py && python content/attack.py --only L39` | `pnpm -w run gate` | `L39`, `L41`, `smin_frozen_in_tokens` | `I5` |
| `contracts` | `forge test --root contracts && pnpm --filter @corporator/chainport run test -- -t rpc_parity_with_mock` | `pnpm --filter @corporator/chainport run gate` | `port_two_implementations`, `voucher_single_use`, `vault_deposit_then_mint`, `bank_not_onchain` | `I1_I3` |
| `rpc_live` | `python content/attack.py --only L246,L257,L278 && pnpm --filter @corporator/chainport --filter @corporator/attestor run test -- -t rpc_silence_is_open` | `pnpm --filter @corporator/chainport run gate` | `rpc_silence_is_open`, `attestor_down_pay_continues`, `rpc_http_eth_methods`, `attestor_putroot_retries`, `client_bundle_has_no_keys` | `tick_pure` |
| `pons_launch` | `python content/lint.py && python content/build.py && python content/attack.py --only L24,L13,L14,L279` | `pnpm -w run gate` | `L24`, `L13`, `L14`, `L279` | `L13_L14` |
| `money_form` | `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268` | `pnpm --filter @corporator/contentpack run gate` | `L262`, `L268`, `money_stage_keys_exist`, `launch_precondition_not_launched` | `layout_v1_bytes` |
| `fee_split` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/codegen.py --check && python content/sim.py && python content/attack.py --only L13,L14,L22,L24,L32,L33,L48,L147,L279,L280,L290` | `pnpm -w run gate` | `L13`, `L14`, `L22`, `L24`, `L32`, `L33`, `L48`, `L220`, `L280`, `L281`, `L290`, `L295`, `L296` | `L13_L14` |
| `prize_period` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/attack.py --only L282,L106,L107,L121,L220` | `pnpm -w run gate` | `L106`, `L107`, `L121`, `L220`, `L282` | `I7` |
| `prize_basket` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/codegen.py --check && python content/attack.py --only L283,L284,L291,L292,L294,L304,L90,L93,L107,L112` | `pnpm -w run gate` | `L90`, `L93`, `L107`, `L112`, `L283`, `L284`, `L291`, `L292`, `L294`, `L304` | `demo_isolated` |
| `basket_conveyor` | `python content/lint.py && python content/codegen.py --check && python content/attack.py --only L285,L286,L22` | `pnpm --filter @corporator/buyback run test` | `L22`, `L285`, `L286`, `L295`, `L296`, `services_do_not_block_tick`, `basket_failure_does_not_block_tick` | `tick_pure` |
| `prize_treasury` | `python content/lint.py && python content/codegen.py --check && python content/attack.py --only L287,L288,L289,L297,L298,L112` | `pnpm -w run gate` | `L112`, `L287`, `L288`, `L289`, `L297`, `L298` | `demo_isolated` |
| `vault_safety` | `python content/lint.py && python content/attack.py --only L299,L303,L300,L301,L305` | `pnpm -w run gate` | `L299`, `L303`, `L300`, `L301`, `L305` | `I1_I3` |
| `prize_surface` | `python content/lint.py && python content/attack.py --only L155,L162,L165,L302` | `pnpm --filter @corporator/client run gate` | `L155`, `L162`, `L165`, `L302`, `client_strings_from_pack`, `channels_partition_state_sources` | `demo_isolated` |
| `launch_freeze` | `python content/build.py && python content/lint.py && python content/attack.py --only L24,L13,L14,L279,L293` | `pnpm -w run gate` | `L13`, `L14`, `L24`, `L279`, `L293` | `L13_L14` |
| `v11_form` | `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268,L306` | `pnpm --filter @corporator/contentpack run gate` | `L262`, `L268`, `L306` | `layout_v1_bytes` |
| `districts_live` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/sim.py && python content/builds.py && python content/attack.py --only L58,L59,L60,L66,L69,L307` | `pnpm -w run gate` | `L58`, `L59`, `L60`, `L66`, `L69`, `L307` | `L13_L14`, `I1_I3`, `payroll_proportional` |
| `archetypes_live` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/sim.py && python content/attack.py --only L70,L72,L73,L85,L86,L308` | `pnpm -w run gate` | `L70`, `L72`, `L73`, `L85`, `L86`, `L308` | `L13_L14`, `tick_pure` |
| `research_tree` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/attack.py --only L61,L62,L68,L71,L309` | `pnpm --filter @corporator/engine run gate` | `L61`, `L62`, `L68`, `L71`, `L309` | `tick_pure` |
| `synergy_buildings` | `python content/build.py && python content/lint.py && python content/attack.py --only L05,L07,L08,L66,L310` | `pnpm --filter @corporator/engine run gate` | `L05`, `L07`, `L08`, `L66`, `L310` | `demo_isolated` |
| `companion_live` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/sim.py && python content/attack.py --only L77,L140,L143,L311` | `pnpm -w run gate` | `L77`, `L140`, `L143`, `L311` | `payroll_proportional`, `demo_isolated` |
| `companion_revenue` | `python content/build.py && python content/lint.py && python content/attack.py --only L143,L280,L312` | `pnpm --filter @corporator/api run gate` | `L143`, `L280`, `L312` | `I11` |
| `rebalance_close` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/codegen.py --check && python content/sim.py && python content/builds.py && python content/attack.py --jobs 8` | `pnpm -w run gate` | `L13`, `L14`, `L45`, `L47`, `L63`, `L64`, `L65`, `L313` | `L13_L14`, `I1_I3`, `I5`, `I7`, `I11`, `payroll_proportional` |
| `release_form` | `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268,L314` | `pnpm --filter @corporator/contentpack run gate` | `L262`, `L268`, `L314` | `layout_v1_bytes` |
| `player_identity` | `python content/build.py && python content/lint.py && python content/vectors.py && python content/codegen.py --check && python content/attack.py --only L232,L235,L247,L248,L249,L250,L251,L255,L315,L316,L317,L318` | `pnpm -w run gate` | `L232`, `L235`, `L247`, `L248`, `L249`, `L250`, `L251`, `L255`, `L315`, `L316`, `L317`, `L318` | `demo_isolated`, `layout_v1_bytes` |
| `ci_tracks` | `python content/lint.py && python content/codegen.py --check && python content/attack.py --only L259,L260,L319` | `node scripts/ci.mjs` | `L259`, `L260`, `L319` | `tick_pure` |
| `contract_audit` | `python content/lint.py && python content/attack.py --only L277,L297,L298,L299,L300,L301,L303,L305,L320,L321` | `pnpm --filter @corporator/chainport run gate` | `L277`, `L297`, `L298`, `L299`, `L300`, `L301`, `L303`, `L305`, `L320`, `L321` | `I1_I3` |
| `prod_image` | `python content/build.py && python content/lint.py && python content/codegen.py --check && python content/attack.py --only L259,L260,L314,L322,L323,L324` | `pnpm --filter @corporator/api run gate` | `L259`, `L260`, `L314`, `L322`, `L323`, `L324` | `catchup_eq_replay` |
| `time_rehearsal` | `python content/lint.py && python content/vectors.py && python content/attack.py --only L285,L286,L291,L292,L304,L325` | `pnpm -w run gate` | `L285`, `L286`, `L291`, `L292`, `L304`, `L325` | `catchup_eq_replay`, `tick_pure`, `demo_isolated` |
| `ops_watch` | `python content/build.py && python content/lint.py && python content/attack.py --only L259,L302,L326,L327` | `pnpm --filter @corporator/api run gate` | `L259`, `L302`, `L326`, `L327` | `I1_I3`, `I5`, `I7`, `I11` |
| `visual_form` | `python content/lint.py && python content/build.py && python content/attack.py --only L306,L329,L347,L348,L353` | `pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L306`, `L329`, `L347`, `L348`, `L353` | `layout_v1_bytes` |
| `art_atlas` | `python content/lint.py && python content/build.py && python content/attack.py --only L330,L331,L332,L178,L359` | `pnpm --filter @corporator/contentpack run gate` | `L330`, `L331`, `L332`, `L178`, `L359` | `layout_v1_bytes` |
| `art_content` | `python content/lint.py && python content/build.py && python content/attack.py --only L169,L174,L184,L186,L187,L189,L190,L191,L354,L355,L360,L361 && python art/pipeline/layout.py` | `pnpm --filter @corporator/contentpack run gate` | `L169`, `L174`, `L184`, `L186`, `L187`, `L189`, `L190`, `L191`, `L354`, `L355`, `L360`, `L361` | `layout_v1_bytes` |
| `render_ground` | `python content/lint.py && python content/attack.py --only L333,L334,L339,L340,L352,L362 && pnpm --filter @corporator/render run gate && pnpm --filter @corporator/client run gate` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/client run gate` | `L333`, `L334`, `L339`, `L340`, `L352`, `L362`, `L226`, `L227`, `L228`, `L229`, `L230` | `layout_v1_bytes` |
| `render_sprites` | `python content/lint.py && python content/attack.py --only L180,L181,L345,L356 && pnpm --filter @corporator/render run gate` | `pnpm --filter @corporator/render run gate` | `L180`, `L181`, `L345`, `L356` | `layout_v1_bytes` |
| `render_light` | `python content/lint.py && python content/attack.py --only L179,L331,L335,L336 && pnpm --filter @corporator/render run gate` | `pnpm --filter @corporator/render run gate` | `L179`, `L331`, `L335`, `L336` | `layout_v1_bytes` |
| `render_camera` | `python content/lint.py && python content/attack.py --only L185,L337 && pnpm --filter @corporator/render run gate && pnpm --filter @corporator/client run gate` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/client run gate` | `L185`, `L337` | `layout_v1_bytes` |
| `render_motion` | `python content/lint.py && python content/attack.py --only L190,L338,L357 && pnpm --filter @corporator/render run gate` | `pnpm --filter @corporator/render run gate` | `L190`, `L338`, `L357` | `tick_pure` |
| `hud_shell` | `python content/lint.py && python content/attack.py --only L146,L341,L342,L343,L344 && pnpm --filter @corporator/client run gate` | `pnpm --filter @corporator/client run gate` | `L146`, `L341`, `L342`, `L343`, `L344` | `layout_v1_bytes` |
| `hud_screens` | `python content/lint.py && python content/attack.py --only L145,L148,L150,L151,L358 && pnpm --filter @corporator/client run gate` | `pnpm --filter @corporator/client run gate` | `L145`, `L148`, `L150`, `L151`, `L358` | `layout_v1_bytes` |
| `companion_screen` | `python content/lint.py && python content/build.py && python content/attack.py --only L128,L163,L311,L312,L346` | `pnpm --filter @corporator/client run gate` | `L128`, `L163`, `L311`, `L312`, `L346` | `demo_isolated` |
| `attest_live` | `python content/lint.py && python content/attack.py --only L349,L350` | `pnpm --filter @corporator/attestor run gate && pnpm --filter @corporator/api run gate` | `L349`, `L350` | `tick_pure` |
| `visual_close` | `python content/lint.py && python content/build.py && python content/attack.py --jobs 8 && python content/sim.py` | `pnpm -w run gate` | `L351`, `L13`, `L14` | `L13_L14`, `I1_I3`, `layout_v1_bytes` |
| `visual3_form` | `python content/lint.py && python content/build.py && python content/attack.py --only L370,L348,L353` | `pnpm --filter @corporator/contentpack run gate` | `L370`, `L348`, `L353` | `layout_v1_bytes` |
| `visual3_engine` | `python content/lint.py && python content/build.py && python content/attack.py --only L370,L348,L371,L372,L373` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L370`, `L348`, `L371`, `L372`, `L373` | `layout_v1_bytes` |
| `visual3_assets` | `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L374,L375` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L370`, `L372`, `L374`, `L375` | `layout_v1_bytes` |
| `visual3_light` | `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L376,L377` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L370`, `L372`, `L376`, `L377` | `layout_v1_bytes` |
| `visual3_input` | `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L378,L379` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L370`, `L372`, `L378`, `L379` | `layout_v1_bytes` |
| `visual3_units` | `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L380,L381` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L370`, `L372`, `L380`, `L381` | `layout_v1_bytes` |
| `visual3_world` | `python content/lint.py && python content/build.py && python content/attack.py --only L370,L372,L382,L383` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L370`, `L372`, `L382`, `L383` | `layout_v1_bytes` |
| `visual3_close` | `python content/lint.py && python content/build.py && python content/attack.py --jobs 8 && python content/sim.py` | `pnpm -w run gate` | `L370`, `L384`, `L351`, `L13`, `L14` | `L13_L14`, `I1_I3`, `layout_v1_bytes` |
| `island_form` | `python content/lint.py && python content/build.py && python content/attack.py --only L385,L370,L353` | `pnpm --filter @corporator/contentpack run gate` | `L385`, `L370`, `L353` | `layout_v1_bytes` |
| `island_terrain` | `python content/lint.py && python content/build.py && python content/attack.py --only L385` | `pnpm --filter @corporator/contentpack run gate` | `L385` | `layout_v1_bytes` |
| `island_ground` | `python content/lint.py && python content/build.py && python content/attack.py --only L385` | `pnpm --filter @corporator/contentpack run gate` | `L385` | `layout_v1_bytes` |
| `island_decor` | `python content/lint.py && python content/build.py && python content/attack.py --only L385` | `pnpm --filter @corporator/contentpack run gate` | `L385` | `layout_v1_bytes` |
| `island_light` | `python content/lint.py && python content/build.py && python content/attack.py --only L385` | `pnpm --filter @corporator/contentpack run gate` | `L385` | `layout_v1_bytes` |
| `island_compose` | `python content/lint.py && python content/build.py && python content/attack.py --only L385` | `pnpm --filter @corporator/contentpack run gate` | `L385` | `layout_v1_bytes` |
| `island_anchors` | `python content/lint.py && python content/build.py && python content/attack.py --only L385` | `pnpm --filter @corporator/contentpack run gate` | `L385` | `layout_v1_bytes` |
| `island_client` | `python content/lint.py && python content/build.py && python content/attack.py --only L333,L338,L340,L351,L352,L362,L371,L372,L375,L377,L378,L379,L380,L381,L382,L383,L384,L385,L386` | `pnpm --filter @corporator/render run gate && pnpm --filter @corporator/contentpack run gate && pnpm --filter @corporator/client run gate` | `L385`, `L386` | `layout_v1_bytes` |
| `island_close` | `python content/lint.py && python content/build.py && python content/attack.py --jobs 8 && python content/sim.py` | `pnpm -w run gate` | `L385`, `L13`, `L14` | `L13_L14`, `I1_I3`, `layout_v1_bytes` |
| `mainnet_launch` | `python content/build.py && python content/lint.py && python content/attack.py --only L13,L14,L24,L279,L293` | `pnpm -w run gate` | `L13`, `L14`, `L24`, `L279`, `L293` | `L13_L14`, `I1_I3` |
| `season_one` | `python content/lint.py && python content/attack.py --only L282,L283,L284,L289,L291,L292,L294,L304` | `pnpm -w run gate` | `L282`, `L283`, `L284`, `L289`, `L291`, `L292`, `L294`, `L304` | `demo_isolated`, `I7`, `I11` |

## T12: toolchain

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| id | version | kind | npm | engines |
|---|---|---|---|---|
| `node` | `24.13.1` | `runtime` | `—` | `>=24.0.0` |
| `pnpm` | `11.24.0` | `runtime` | `pnpm` | `—` |
| `python` | `3.12` | `tool` | `—` | `—` |
| `typescript` | `5.9.3` | `package` | `typescript` | `—` |
| `vitest` | `4.1.11` | `package` | `vitest` | `—` |
| `fast_check` | `4.9.0` | `package` | `fast-check` | `—` |
| `dependency_cruiser` | `18.2.0` | `package` | `dependency-cruiser` | `—` |
| `eslint` | `9.39.5` | `package` | `eslint` | `—` |
| `eslint_js` | `9.39.5` | `package` | `@eslint/js` | `—` |
| `typescript_eslint` | `8.68.0` | `package` | `typescript-eslint` | `—` |
| `vite` | `8.2.2` | `package` | `vite` | `—` |
| `pixijs` | `8.20.1` | `package` | `pixi.js` | `—` |
| `threejs` | `0.185.1` | `package` | `three` | `—` |
| `gltf_transform_cli` | `4.4.2` | `package` | `@gltf-transform/cli` | `—` |
| `react` | `19.2.8` | `package` | `react` | `—` |
| `react_dom` | `19.2.8` | `package` | `react-dom` | `—` |
| `types_react` | `19.2.8` | `package` | `@types/react` | `—` |
| `types_react_dom` | `19.2.5` | `package` | `@types/react-dom` | `—` |
| `lucide_react` | `1.46.0` | `package` | `lucide-react` | `—` |
| `pg` | `8.23.0` | `package` | `pg` | `—` |
| `postgres` | `16` | `database` | `—` | `—` |
| `embedded_postgres` | `18.4.0-beta.17` | `package` | `embedded-postgres` | `—` |
| `prettier` | `3.9.6` | `package` | `prettier` | `—` |
| `types_node` | `24.13.3` | `package` | `@types/node` | `—` |
| `corporator_protocol` | `workspace:*` | `package` | `@corporator/protocol` | `—` |
| `corporator_engine` | `workspace:*` | `package` | `@corporator/engine` | `—` |
| `corporator_contentpack` | `workspace:*` | `package` | `@corporator/contentpack` | `—` |
| `corporator_chainport` | `workspace:*` | `package` | `@corporator/chainport` | `—` |
| `corporator_render` | `workspace:*` | `package` | `@corporator/render` | `—` |
| `electric_sql_pglite` | `0.5.7` | `package` | `@electric-sql/pglite` | `—` |
| `foundry` | `1.8.1` | `tool` | `—` | `—` |
| `solc` | `0.8.28` | `tool` | `—` | `—` |
| `noble_secp256k1` | `2.3.0` | `package` | `@noble/secp256k1` | `—` |

## T12: vector_classes

Сгенерировано. Источники: `arch.json`, `api.json`, `screens.json`, `codes.json`, `launch.json`, `time.json`, `agents.params.slots_cap`, `economy.params.twap_window_city_hours`. Команда: `python content/build.py`.

| id | src |
|---|---|
| `empty_tick` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `payroll_trim` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `day_boundary` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `feed_dead` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `stack_nonempty` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `cyrillic` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `over_2_53` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `layout_v1_edge` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `keccak_l202` | `L202, content/keccak.py` |
| `merkle_shapes` | `D-C-5, docs/reports/PLAN_CODE.md` |
| `cid_city_day` | `D-C-5, DESIGN.md §6.2, docs/TICK.md §9, R-C-6` |
| `slotted_tick` | `PLAN_LAUNCH M8, DESIGN.md §5.3` |

vector_class_ids: `cid_city_day`, `cyrillic`, `day_boundary`, `empty_tick`, `feed_dead`, `idle_idle_bank_closed`, `idle_idle_district_frozen`, `idle_idle_no_agent`, `idle_idle_no_compute`, `idle_idle_no_energy`, `idle_idle_no_materials`, `idle_idle_no_research_focus`, `idle_idle_no_train_target`, `idle_idle_offline_cap_reached`, `idle_idle_out_of_hours`, `idle_idle_under_construction`, `idle_idle_wrong_role`, `keccak_l202`, `layout_v1_edge`, `merkle_shapes`, `over_2_53`, `payroll_trim`, `slotted_tick`, `stack_nonempty`
