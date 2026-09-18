# T11 recon — тик как чистая функция и аттестация

Разведка перед `docs/BRIEF.md` §6 T11. Канон механик — `DESIGN.md`, интерфейс — `HUD.md`, эталон тика — `content/tick.py`, порядок шагов — `docs/SIMULATION.md` §1. Выход шага — `TICK.md` (файла нет). Пак: `rules_version` `0.14.0`, `pack_version` 21 (`content/params/meta.json` строки 3–4). Ничего в репозитории кроме этого файла не менялось. `content/attack.py` / `content/lint.py` / `content/README.md` читались, не правились.

`packages/engine` в дереве нет. `docs/TICK.md` нет.

---

## §1. Порядок тика по факту кода

Сигнатура: `tick(state: dict, inputs: dict) -> tuple[dict, list[dict]]` — `content/tick.py` 1005–1075. Докстринг: «One city hour. Order is the T3 spec; do not reorder without TICK.md.»

### 1.1 `inputs` — что реально читает `tick()`

Сборщик ряда — `sim.price_inputs` (`content/sim.py` 207–258). `tick()` читает подмножество:

| ключ | тип | единицы | где читается | обязателен |
|---|---|---|---|---|
| `tick_index` | `int` | часы города с нуля | 1012 | да, `inputs["tick_index"]` |
| `pack_hash` | `str` | hex sha256 пака | 1017–1018 | нет; пустой пропускает сверку |
| `feed_live` | `int` 0/1 | флаг | 447 | нет, дефолт 1 |
| `eth_usd_8dec` | `int` | USD за 1 ETH × 10^8 | 448, 1007 | нет, дефолт `cfg["eth_usd_8dec"]` |
| `corp_eth_wei_per_whole` | `int` | wei ETH за 1 целый $CORP | 449 | нет, дефолт 0 |
| `dex_turnover_usd_8dec` | `int` | USD × 10^8 обе стороны оборота | 1025 | нет, дефолт 0 |

`city_time` во входах **нет**, хотя `docs/SIMULATION.md` §1 п.1 его называет (строка 9). Часы считаются из `tick_index` через `city_clock` (169–178).

Проверка float только на `eth_usd_8dec`: `if "float" in type(...).__name__` → `I9_FLOAT` (1007–1008). Остальные ключи не проверяются.

### 1.2 `state` — ключи `new_state` (`tick.py` 1112–1178)

Глобальные: `cfg`, `tick_index`, `day`, `hour`, `weekday`, `mint_rate`, `rate_ref`, `rate_raw_last`, `ema_buf`, `last_live_tick`, `stale_hours`, `pool_eth`, `pool_corp`, `vault_corp`, `reserve_corp`, `reserve_cork`, `fund`, `capital_outstanding`, `capital_minted_total`, `corp_deposited_total`, `treasury_eth`, `treasury_spec_eth`, `treasury_city_eth`, `day_budget`, `tick_budget`, `day_budget_day`, `week_index`, `week_start_reserve`, `week_start_virgin`, `week_start_cork`, `week_drained_corp`, `week_drained_virgin`, `week_shortfall_cap`, `week_gate`, `week_started`, `payroll_day_buf`, `day_payroll`, `day_mon`, `payroll_ratio_bps`, `codes`, `cities`, `acc`, `mon`, `bank_day`, `bank_used_today_wei`, `reserve_pays_fee`, `jitter_on`.

`acc` — `empty_acc()` 1078–1109. `mon` — slack I1 и покрытие I7. `day_mon` — `empty_day_mon()` 333–344.

Город (`sim.spawn_city` 97–132): `id`, `arch`, `weight`, `capital`, `earned_life`, `earned_left`, `deposit_spent`, `earned_spent`, `output_base`, `energy_ok` (флаг 0/1, не склад), `affinity_bps`, `level_mult_bps`, `mod_bps`, `schedule`, `bank_level`, `bank_usage`, `login_period`, `last_login` (**в `tick.py` не читается**), `sell_share_bps`, `reinvest_bps`, `deposit_multiple_bps`, `withdraw_intent`, `spend_intent`, `spend_from_earned`, `withdrawn_day`, `withdrawn_life_wei`, `withdrawn_capital`, `idle`, `request`, `payout`, `districts`, `offline_denied`, `corp_held`, `codes`.
Нет в `state`: `city_time`, склады Energy/Compute, здания, агенты, леджер фрагментов, `park_slots`, Happiness/Stability/GDP/Population.

`cfg` — плоский срез `load_config` (48–160). В `cfg` кладутся и не используются тиком: `night_energy_premium_bps` (93), `season_city_days` (96). `efficiency_recalc_hour` в `cfg` **не попадает**.

### 1.3 Порядок шагов внутри `tick()`

| # | код | функция | строки | что делает |
|---|---|---|---|---|
| 0 | I2 | `_assert_i2` | 1010, 306–319 | вход дешевле выхода (ставки, не живой курс) |
| 1 | входы | — | 1012–1018 | `tick_index`; сверка `pack_hash` → `PACK_HASH` |
| 1б | часы | `city_clock` | 1013–1014, 169–178 | `(day, hour, weekday)` |
| 2 | курс | `_update_mint_rate` | 1021–1023, 446–500 | полоса, храповик, `STALE_PRICE`, потолок |
| 2б | оборот DEX | `apply_dex_turnover` | 1025, 986–1002 | налог ETH в казну. **В SIMULATION §1 нет** |
| 3 | бюджет | `_fix_day_budget` | 1028, 503–520 | заморозка на `hour==0` или `tick_index==0` |
| 4 | запросы | `_collect_requests` | 1031, 523–561 | расписание, оффлайн, energy, дрожь, residual |
| 5 | выплата | `_pay` | 1032, 564–618 | здесь `payroll_ratio_bps` (573–574) |
| 6 | траты | `_apply_spend` | 1035–1041, 621–658 | burn / fund / protocol |
| 7 | банк | `_bank_withdraw` | 1044, 676–797 | личный кап → `split_bank_limit` |
| 8 | выкуп | `_buyback` | 1047, 800–829 | ETH → CORP → vault → fund |
| 9 | капля | `_reserve_drip` | 1050, 832–865 | спрос копится; реминт — `_flush_week_drip` 867–903 на смене недели |
| 10 | пробка | `_fund_cap` + `_cork_return` | 1053–1054, 906–964 | окно 30 суток; возврат `f_cork` |
| 10б | I7 | `exit_coverage_corp` | 1056–1069, 322–330 | код `VAULT_EXIT_UNCOVERED`, не raise. **В §1 нет** |
| 11а | I11 | `_assert_i11` | 1071, 368–411 | тождество потока |
| 11б | запись | `_records` | 1074, 967–983 | после выплаты |

`payroll_ratio_bps`: `_pay` 573–574. Если `total<=0` → `BPS` (571) и выход без выплат.

### 1.4 Сверка с `docs/SIMULATION.md` §1 (11 пунктов, строки 7–19)

Совпадает: курс (п.2), заморозка бюджета (п.3), запросы (п.4 по составу множителей, см. дыры ниже), пропорция и `payroll_ratio_bps` (п.5), траты (п.6), банк с `split_bank_limit` (п.7), выкуп (п.8), virgin-капля на границе недели (п.9), пробка + отдельный cork (п.10), I11 затем запись (п.11).

Расхождения документ ↔ код:

| # | документ | код |
|---|---|---|
| п.1 | входы включают `city_time` | `city_time` нет |
| — | 11 пунктов, оборот DEX не назван | `apply_dex_turnover` между курсом и бюджетом (1025) |
| п.4 | «energy/compute» | только флаг `energy_ok`; Compute нет; склады не списываются |
| п.4 | база × affinity × уровень × дрожь × модификаторы | `mod_bps` всегда `BPS` у спавна; строки T5 не применяются (R-T5-12) |
| — | — | I7-покрытие между пробкой и I11 |
| п.2 / §4.6 | храповик «как efficiency в 06:00» | `elapsed = ticks_day if hour==0 else 0` — полночь, не 06:00 |

### 1.5 Что код сейчас не делает

- Нет LLM, `random`, `time`, `Decimal`, I/O внутри `tick()`.
- `TODO`/`FIXME` в `tick.py` нет.
- `dest == "probe_forbidden"` (235–236) — только атака I3; иначе `backing<=0` → 0.
- `if new_corp < 0` / `new_eth < 0` в CPMM (203–204, 216–217) — мёртвая ветка на неотрицательных int.
- `seeded_prng` (163–166) объявлен; тик зовёт `build.tick_jitter_bps`, не его.
- `cfg["night_energy_premium_bps"]`, `cfg["season_city_days"]` — загружены, не читаются.
- `efficiency_recalc_hour` — не в `cfg`, не в `tick()`.
- Energy/Compute не списываются (шаги 2–4 канона `DESIGN.md` §5.3).
- Нет `IDLE_NO_COMPUTE`.
- Фрагменты, сезоны, `apply_stack`, Happiness — не вызываются.
- `last_login` спавна в тике не используется.
- `canonical(rec)` в `_records` (982) — побочный `assert_no_floats`; байты записи никуда не пишутся.
- Merkle / keccak / CID / IPFS в коде тика нет.
- `packages/engine` нет.

Оффлайн — не догон с `last_login`. `_in_offline_window` (431–443): `phase = tick_index % login_period`; credитуются первые `min(offline_cap, period)` тиков периода. Минималист (`login_period=24`, cap=12) — квадратная волна 12 ч работы / 12 ч `IDLE_OFFLINE_CAP_REACHED`. Оптимизатор (`period<=1`) всегда в окне.

---

## §2. Детерминизм и арифметика по факту

### 2.1 Случайность

Формат сида: `"{city_id}:{tick_index}:{agent_id}"` — `build.JITTER_SEED_FMT` (`content/build.py` 924). Тик передаёт `agent_id="shift"` (`tick.py` 544, 974).

```
msg = f"{city_id}:{tick_index}:{agent_id}".encode("utf-8")
prng = int.from_bytes(hashlib.sha256(msg).digest()[:8], "big")
```

`tick.seeded_prng` 163–166 — то же. `build.tick_jitter_bps` 1191–1202: `span = 2*w+1`; **`prng % span`**; результат `BPS + (prng % span) - w`. `% n` есть. Rejection sampling нет (в мире T10 — да, здесь нет).

Дрожь включается флагом `state["jitter_on"]` (542–548). В базовых сценариях T3 обычно выключена.

Канон `DESIGN.md` §5.3 строка 361: `hash(city_id, tick_index, agent_id)` — без указания sha256/[:8]/% n.

### 2.2 Деление и остаток

Везде `//` — floor к нулю для неотрицательных. `Decimal`/`float` на пути тика нет (`content/` не импортирует `decimal`). `pack.BPS = 10_000` (`pack.py` 23). bps: `x * bps // BPS`.

| место | остаток |
|---|---|
| `_pay` `payout = request * budget // total` (593) | в фонде |
| `tick_budget = day_budget // ticks` (520) | нераспределённый кусок дневного бюджета в фонде |
| `split_bank_limit` (661–673, докстринг) | «Floor; remainder is not distributed» |
| CPMM `pool_eth * pool_corp // new_*` (202, 214) | в резервах пула |
| минт `backing * rate // wei` затем `* (BPS - fee) // BPS` (241–244) | fee CORP в резерв |
| траты: `proto = amount - burn - to_fund` (627–629) | пыль 40/50/10 → protocol |
| cork: весь `fund - cap` (915) | в `reserve_cork` |
| `_payout_raw` фрагментов (148–153) | пыль в пуле; ceil — шов атаки |

`ceil_div` есть в `build.py` 943 — тик его не зовёт.

### 2.3 `city_time` и `build_time()`

Канон `DESIGN.md` §3 строки 178–179: `city_time = anchor + (now − first_login) × rate`. У каждого города свои часы. В коде: дискретный `tick_index` общий на весь `state["cities"]` (когорта T3). Формулы с `now` / `first_login` нет.

`build_time` (`build.py` 801–812):

| ключ | формула | при текущих params |
|---|---|---|
| `city_time_rate_bps` | `24 * BPS // city_day_real_hours` | 24×10000/25 = 9600 |
| `ticks_per_city_day` | `24 // tick_length_city_hours` | 24 |
| `offline_cap_ticks_base` | `offline_cap_city_hours_base // tick_length_city_hours` | 12 |
| `phase_rotation_days` | `24 // (city_day_real_hours - 24)` | 24 |
| `bank_open_hours_per_week` | `(close-open) × (7 - closed_weekdays)` | 12×6 = 72 |

`time.json`: `city_day_real_hours=25` (4–8), `tick_length_city_hours=1` (10–14), `anchor_weekday=1` пн, `anchor_hour=12` (22–27), `anchor_day_index=1`, `offline_cap_city_hours_base=12` (34–38), банк 08–20 (40–51), воскресенье `bank_closed_weekday=7` (52–57), `efficiency_recalc_hour=6` (58–63).

Длина тика в реальных секундах: `tick_length_real_seconds = city_day_real_hours × 3600 / ticks_per_city_day` (`build.py` 1455, `balance.json` derived 226) = 25×3600/24 = **3750** с. В `cfg` кладётся (135), тик не читает; читает `sim.turnover_per_tick` (176).

`city_clock` (169–178): tick 0 = `anchor_hour` = **12:00 дня 1**, не полночь.

- `hour = (anchor_hour + tick_index) % ticks_day`
- `day = anchor_day + (anchor_hour + tick_index) // ticks_day`
- weekday ISO с пн=1

Следствия:

| событие | когда в коде | когда в каноне |
|---|---|---|
| первая заморозка бюджета / EMA | `tick_index==0` → полдень дня 1 | не сказано |
| далее бюджет / EMA / храповик | `hour==0` = полночь (первый раз tick 12 = день 2 00:00) | храповик «целыми сутками», efficiency **06:00** §4.6 |
| 06:00 | `hour==6` (tick 18 = день 2 06:00), **никем не обрабатывается** | `DESIGN.md` §4.6 строка 288; `time.json` 58–63 |
| банк | `_bank_open`: weekday≠7 и `8 ≤ hour < 20` (423–428) | §3.2, §5.8 |
| оффлайн | cap 12 **часов** в `cfg["offline_cap"]` (100); при `tick_length=1` совпадает с 12 тиками | §3.2; `screens.offline_return_ticks_cap` считает тики |

Храповик `apply_ratchet` (`build.py` 368–393): `days = elapsed_city_hours // 24`; внутри часа роста нет. В тике `elapsed = ticks_day if hour==0 else 0`, на tick 0 принудительно 0 (464–466). Деградация stale — тоже только при `hour==0` (492–500), `stale_decay_rate` целыми сутками (`build.py` 423–452).

---

## §3. DecisionRecord по факту

### 3.1 Код `_records` (`tick.py` 967–983)

Порядок ключей в литерале dict (до `canonical`, который сортирует):

| поле | тип | значение |
|---|---|---|
| `city_id` | str | id города |
| `tick_index` | int | |
| `agent_id` | str | всегда `"shift"` |
| `payout` | int | Capital за тик |
| `reason` | str \| None | idle-код или `None` |
| `payroll_ratio_bps` | int | |
| `mint_rate` | int | |
| `codes` | list[str] | глобальные + городские |

`canonical(rec)` вызывается и результат **отбрасывается**. Байт-точный снимок записи не хранится.

Нет: `city_time`, `building_id`, `objective`, `inputs.{energy,compute,materials}`, `district_efficiency`, `seed`, `output`, `status`. Нет дельты фрагментов и стадий T5.

### 3.2 Канон `DESIGN.md` §6.1 (529–539)

```
city_id, tick_index, city_time,
agent_id, building_id, objective,
inputs { energy, compute, materials },
district_efficiency, seed,
output, payroll_ratio, status, reason
```

«Сериализация каноническая и байт-точная (фиксированный бинарный layout или JCS)». «Дельта фрагментов войдёт в запись на T11, как стадии T5; layout здесь не меняется.»

`docs/CONTENT.md` §11 R2 (497–498): `inputs.materials` всегда ноль — поле нельзя снять, иначе миграция истории.

Имена: канон `payroll_ratio` / `output` / `status`; код `payroll_ratio_bps` / `payout` / idle в `reason`.

### 3.3 §6.2 батчинг (541–546)

- батч на сутки города на город;
- лист = `keccak(канонические байты)`;
- батчи всех городов за реальный час → одно дерево → **один корень в чейн раз в час**;
- полные батчи в IPFS, CID в событии контракта.

В коде этого слоя нет.

### 3.4 §6.3 публичная проверка (548–555)

1. merkle-proof против корня в чейне;
2. прогон тика из записанных входов.

Код даёт (2) как чистую `tick()`, без (1). Реплей требует `pack_hash` во входе (`CONTENT.md` 168–170).

### 3.5 §6.4 выплата не ждёт записи (557–565)

Код: выплата в `_pay` (1032), запись в конце (1073–1074). IPFS/RPC тик не блокируют — их нет. Формат «каноничен с первого дня» — в коде не выполнен (см. 3.1 vs 3.2).

### 3.6 `canonical()` в `content/pack.py` 78–80

```
assert_no_floats(obj)
json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
```

Сортировка ключей, разделители `,` `:`, UTF-8, без пробелов. `int` → десятичная JSON-запись. `float` запрещён (`assert_no_floats` 93–101; загрузчик `_reject_float` 57–58). Это JCS-подобная форма, не фиксированный бинарный layout. `pack_hash` = sha256 этих байт (83–90). Комментарий явно: хеш пака — идентификатор внутри записи, **не** лист merkle; листья остаются keccak по §6.2.

### 3.7 merkle / keccak / CID / IPFS

| место | что |
|---|---|
| `DESIGN.md` §6.2 544–546 | keccak, CID, IPFS |
| `DESIGN.md` §6.3 552 | merkle-proof |
| `DESIGN.md` §6.4 561, 565 | отказ IPFS/RPC не стопит доход; формат с первого дня |
| `DESIGN.md` §10 665, 674 | реестр корней ончейн; батчи в IPFS |
| `DESIGN.md` §11 696, §13 772 | merkle+IPFS вырезаны из v1, формат каноничен |
| `HUD.md` 148, 247 | бейдж Verified после merkle; до — `· logged`; клик → proof и CID |
| `docs/BRIEF.md` 41, 363, 422 | батчер раз в минуту; выход T11 — аттестация |
| `docs/CONTENT.md` 166 | sha256 пака vs keccak листьев — осознанно |
| `content/pack.py` 86–88 | то же |
| `*.py` кроме комментария в `pack.py` | **keccak / IPFS / CID нет** |
| хеши в коде | sha256: пак, сцена, дрожь, `layout_hash` |

---

## §4. Долги, которые обязан закрыть T11

### 4.1 `content/params/pending.json` — `owner: T11` (ровно 4)

| id | kind | что требуется |
|---|---|---|
| `fragment_tick_wiring` | entity | `fragments.py` settlement в тик; дельта фрагментов в DecisionRecord. Строка 8 |
| `season_tick_wiring` | entity | `seasons.py` Influence + `settle_prizes`; писать `I_day`. Строка 9 |
| `sampler_corp_eth_endogenous` | entity | эндогенный ряд `corp_eth` вместо заморозки на `seed_corp_wei` (R-T3-20). Строка 26. BRIEF относит сэмплер и к T12 |

Других `owner: T11` в `pending.json` нет.

### 4.2 `state_sources` в `screens.json` 77–95 — все 17 с `owner: T11`

| ключ | `src` |
|---|---|
| `tick.capital` | DESIGN.md §5.3 |
| `tick.energy` | DESIGN.md §5.3 |
| `tick.compute` | DESIGN.md §5.3 |
| `tick.agent_state` | DESIGN.md §5.6 |
| `tick.building_level` | DESIGN.md §7 |
| `aggregate.gdp` | HUD.md §4.1 |
| `aggregate.payroll_ratio` | DESIGN.md §2.5 |
| `aggregate.happiness` | HUD.md §4.1 |
| `aggregate.stability` | HUD.md §4.1 |
| `wallet.corp_balance` | HUD.md §3 |
| `wallet.stake_tokens` | DESIGN.md §4.5 |
| `wallet.chain` | HUD.md §3 |
| `seasons.influence_rank` | DESIGN.md §8 |
| `fragments.city_ledger` | DESIGN.md §2.9 |
| `log.events` | HUD.md §5.3 |
| `oracle.stock_price` | HUD.md §6.2 |
| `oracle.district_efficiency` | HUD.md §6.2 |

L168 требует: каждый ключ использован полем и `owner ∈ {T11, T12}` (`lint.py` 3147, 3981–4000). T11 обязан **давать значения**, не строки реестра.

### 4.3 Линтер

- `KNOWN_SOURCE_OWNERS = {"T11", "T12"}` — `lint.py` 3147.
- L168 — `lint.py` 3981–4000.
- `docs/CONTENT.md` §10 строки 481–483: T6/T7/T8 закрыты, проводка в тик — T11. T11 в таблице «что ждёт» **не вынесен отдельной строкой**.

### 4.4 Документы — по одной строке

| долг | где | что от T11 |
|---|---|---|
| стадии `base`/`post` в порядке движка, байт-точный сплав в записи | `PROGRESSION.md` T5.2 187–195, R-T5-12 строка 266, T5.9 строка 274 | вставить стадии вокруг шагов 2/5/6 канона §5.3; сейчас `tick.py`/`sim.py` строк T5 не применяют |
| проводка фрагментов, заморозка леджера на границе окна, settlement в 06:00 | `PRIZES.md` строки 3, 15, 23, 39 | начисление с gross до `payroll_ratio`; клейм по замороженному леджеру |
| `I_day` в тик, `season_prizes_live=0` | `PRIZES.md` 91, 108–114; pending `season_tick_wiring` | считать ранг; выплату $CORP не включать |
| Happiness ← `park_slots`, формула | `WORLD.md` 17, 157 R-T10-1 | формула, не слова; счётчик уже `1 + open districts` |
| догон оффлайна; экран возвращения только показывает потолок | `SCREENS.md` 3, 81–85, 145 | посчитать catch-up; `IDLE_OFFLINE_CAP_REACHED`; без `commit:*` |
| копировать порядок §1 включая cork, I11, `split_bank_limit` | `SIMULATION.md` §9 119–121 | эталон `tick.py` |
| T6 settlement не в тике; эндогенный `corp_eth` | `SIMULATION.md` §10 125 | проводка T6; сэмплер не правка экономики |
| спека `packages/engine`, PRNG, layout, догон, 06:00, аттестация | `BRIEF.md` 357–365 | выход `TICK.md` |

---

## §5. Чистые функции, которые надо провести в тик

Сплав T5 живёт в `content/build.py:apply_stack`, **не** в `builds.py`. `builds.py` — перечислитель доминирования билдов.

### 5.1 Сигнатуры

| модуль | имя | аргументы | возврат |
|---|---|---|---|
| `fragments.py` | `tick_accrues` | `data, building, status, idle=False` | `bool` |
| | `accrue_amount` | `data, gross_output, rate_mags, building, status, idle=False` | `int` |
| | `settle` | `fragments, pool, cap_bps, rounding="floor", apply_cap=None, wipe_pool_on_zero=False, redistribute_dust=False` | dict payouts/dust/codes |
| | `settle_hour` | `data` | `efficiency_recalc_hour` (06:00) |
| `seasons.py` | `i_day` | `intensity, stability, efficiency, coverage, data=None` | `int` fused floor |
| | `stability_bps` | `valid_ticks, data` | `valid_ticks * BPS // ticks_per_city_day` |
| | `settle_prizes` | `data, rows, pool, hop_stale=False` | rank + payout; при `season_prizes_live=0` shares=0 |
| | `settle_hour` | `data` | тот же 06:00 |
| | `journal_lines` | `commands, data` | журнал |
| `screens.py` | `offline_return_ticks_cap` | `data, generated` | int тиков |
| | остальные | `data` пака | UI-derived, не экономика тика |
| `build.py` | `apply_stack` | `data, rows, caps=None, extra_zero_rows=0, group_by="key_stage"` | `fused_bps`, clamps, codes |
| `builds.py` | `analyse` | `data, pack=None` | доминирование; **не для тика** |

### 5.2 Что мешает вызвать из `tick()` сейчас

- В `state` нет зданий (маяк/`tier`/`district`), агентов, леджера фрагментов, `pool_in`, GDP/capex суток, `park_slots`, команд.
- `cfg` не содержит params фрагментов/сезонов.
- Импортов `fragments`/`seasons` в `tick.py` нет.
- Город T3 — скаляр `output_base`, не слоты §5.3.
- L45 смотрит `tick.py` (и `sim.py`, `builds.py`, `screens.py`) — новые литералы только из whitelist `{0,1,2,3,8,10,16}` (`sim.json` 156–159). `fragments.py`/`seasons.py` в L45 не входят.
### 5.3 No-op на базовых сценариях T3?

| проводка | no-op для Capital/fund/vault T3? | условие |
|---|---|---|
| фрагменты | **да**, если нет beacon+paid | у спавна нет зданий; workshop не маяк (`tick_accrues` 111–112). Пустой леджер → `FRAGMENT_NO_CLAIMS`, пул не трогать |
| сезоны / `I_day` | **да** для кассы | `season_prizes_live=0` (`seasons.json` 53–57, L115): выплата 0. Ранг — счёт, не минт |
| `offline_return_ticks_cap` | **да** при `tick_length=1` | 12 часов = 12 тиков. Смена модели на `last_login` **сломает** аптайм минималиста T3 |
| `apply_stack` с **пустыми** rows | **да** | пустой mul → тождество `BPS` (`compose_key_mags` / пустые `mul_terms` → BPS, `build.py` 2412–2414) |
| `apply_stack` со **строками пака** | **нет** | R-T5-12: строки не применяются, полосы T2 не сдвинуты. Бесплатный стек T5 ненулевой (`PROGRESSION.md` / L77). `city["mod_bps"]=BPS` (spawn 110). Включение паковых rows сдвинет `output_base` |
| эндогенный `corp_eth` | **нет** | ровно pending `sampler_corp_eth_endogenous`: живой TWAP меняет Capital/ETH (14883 bps к замороженному) |

Итог: проводка T6/T7/T8 при нулевых входах кассу T3 не трогает. Проводка T5 содержимым пака — трогает. Сэмплер — трогает. Смена оффлайна с квадратной волны на `last_login` — трогает аптайм.

---

## §6. Агрегаты города

### 6.1 Канон — слова, не формулы (кроме Influence и Population)

`DESIGN.md` §8 (628–640):

| показатель | что сказано | формула в каноне |
|---|---|---|
| Population | жильё + рабочие места; с первого тика от занятых слотов; жильё AAPL для верхних уровней | нет в §8; есть в `BALANCE.md` §9 |
| Productivity | множитель выхода; агенты, energy, логистика, Happiness | нет числа порога |
| Happiness | жильё vs население, парки, профицит energy, невыплаченные смены; низкое → штраф к Productivity | **в каноне нет** |
| Stability | доля валидных тиков за 24 часа города | словесно; код `seasons.stability_bps` |
| Influence | произведение 4 интенсивностей, интеграл | `docs/PRIZES.md` 108–114 |
| GDP/день | Capital за сутки города | словесно |
| Treasury | баланс Capital | словесно |

`HUD.md` §4.1 (86–91): GDP спарклайн 7 суток; Happiness **ниже 50%** — штраф к Productivity, красная строка; Stability ниже 70% — подсказка energy; Payroll 100% скрыт. Порог 50% / 70% — **только HUD**, не params. Частота: раз в тик агрегатом (`HUD.md` §8 236). Efficiency районов — раз в сутки в 06:00 (238).

`docs/SCREENS.md`: поля `overview_gdp/happiness/stability` читают `aggregate.*` (сервер). Формул нет.

`resources.json` 40–63: `happiness` kind `derived_metric`, gates `productivity`; `stability` ratio; `gdp_per_day` money_flow «ни на что не влияет»; формул нет.

### 6.2 Где формулы уже есть

Population (`BALANCE.md` §9 183–186, `build.population_threshold`):

```
population(city) = занятые слоты × population_per_job + housing_capacity
population_per_job = 50  (balance.json 107–111)
```

В тике слотов/жилья нет — посчитать нельзя.

Stability: `seasons.stability_bps` (`seasons.py` 126–130) = `valid_ticks * BPS // ticks_per_city_day`. Входы: счёт валидных тиков (сейчас только idle-причина, без статуса `paid`).

Influence / GDP-как-интенсивность: `PRIZES.md` 108–114; `i_day` (`seasons.py` 139–152). `gdp_day` = Capital валидных оплаченных тиков (PRIZES.md 103: IDLE/стройка/демо = 0). `capex_live` — стоимость зданий и агентов, не депозит.

Happiness: **в каноне нет**. R-T10-1 отдаёт вход `park_slots`.

### 6.3 Входы, которые уже есть в паке / тике

| вход | ключ | где рождается | в тике сейчас |
|---|---|---|---|
| парки | `generated.placement.park_slots` / `derived.park_slots` | `world.py` 1215: `1 + open_d`; `placement.json` derived 189 | нет |
| площади | `plaza_slots` | `world.py` 1216: `open_d` | нет |
| payroll | `state["payroll_ratio_bps"]` | `_pay` 574 | да |
| простой | `city["idle"]`, коды `IDLE_*` | `_collect_requests` | да, без агрегата за 24 ч |
| население | `population_per_job`, пороги уровня | `balance.json`, `build.population_threshold` | нет слотов |
| уровень зданий | `building_level_max`, оверлеи | balance / world | нет инстансов |
| energy склад | `resources.energy`, `level_energy` | buildings / balance generated | флаг `energy_ok` |
| compute склад | `resources.compute` | то же | нет |
| GDP суток | сумма `payout` | `_pay` / `day_payroll` | `day_payroll` есть (частичный GDP) |
| efficiency | оракул §4.6 | params `anchor_band_bps` 1500 как полоса E | не пересчитывается |

`park_slots` — пакетная константа от `playable_v1`, не от сида (L182). Для демо-сида 4 = 1+3 (`T10_recon`).

---

## §7. Как устроен пак и гейт

### 7.1 Новая секция параметров и generated

1. Файл `content/params/<stem>.json`.
2. Запись в `pack.PARAM_FILES` (`pack.py` 26–49): `"<stem>.json": "<stem>_file"`.
3. `$defs.<stem>_file` в `content/schema/corporator.schema.json` (образец `screens_file` 838–841: `required`, `additionalProperties: false`, `section` const).
4. L01 гоняет каждый `PARAM_FILES` против `$defs` (`lint.py` 83–88).
5. Генератор: `build_*` → ключ в `generated` внутри `build_pack` (2664–2697). Имена derived — в `IMPLEMENTED_DERIVED` (`build.py` 41+) и в `derived` секции params; L09 сверяет три стороны.
6. Таблица в `GENERATED.md`: функция `report_tN(pack) -> list[str]`, подключение в `report()` 3053–3059. `main` пишет `content/out/GENERATED.md` (3989).
7. Хеш: `pack["hash"] = pack_hash(pack)` после сборки объекта **без** поля hash, затем `canonical` всего пака в `pack.json` (2706, 3984–3987). sha256 канонических байт.
8. `rules_version` / `pack_version` — `meta.json` 3–4, кладутся в корень пака 2699–2701.
   - `pack_version`: целое, **растёт при любой публикации**; опубликованный пак не мутирует (`meta.json` 5, `CONTENT.md` 170).
   - `rules_version`: semver. minor/major — таблица `CONTENT.md` §5 174–184 = `meta.compat`. Формула генератора / выход записанных смен / порядок стадий — **major**.

`CONTENT.md` §6 строка 192: «Сто девяносто пять правил» — сейчас L01–L195.

### 7.2 Правила в `lint.py`

```
fail(rule, msg)  → ERRORS
warn(...)        → WARNINGS
rule(id, title)  → CHECKED
PENDING          → collect_pending из pending.json
```

Новое правило: `def lNNN_...`, `rule("LNNN", ...)`, `fail("LNNN", ...)`, строка в `RULES` (4658–4722). Идентификаторы стабильны (`CONTENT.md` 192).

**Последний занятый: L195. Первый свободный: L196.**

### 7.3 `attack.py`

- `ATTACKS`: список `(rule_id, имя, mutate)` — mutate портит копию `sections()`, `run_rules` должен поймать ошибку с этим `rule_id` (1543+, прогон 3557–3568).
- `DIRECT = ("L01","L10","L45","L55","L60")` — правила, которые читают диск; отдельные `attack_lNN()` (1814, 3571–3584).
- `CONSTRUCTION`: `(имя, probe)` — probe(base) → `None` если инвариант жив, иначе строка (3439+, 3586–3598). Не линтер, а живой тик/сборка.

Новая атака: функция + строка в `ATTACKS` **или** `CONSTRUCTION`; `UNATTACKED` = `CHECKED - (ATTACKS∪DIRECT)` → exit 1 (3600–3621). Полный прогон ~12 мин — не запускался.

`--list` печатает три списка без прогона (`attack.py` 4, 3545–3552).

### 7.4 L45 whitelist

`l45_no_economic_literals` (`lint.py` 1147–1160): AST `Constant` int/float в `tick.py`, `sim.py`, `builds.py`, `screens.py`. Белый список: `sim.ast_whitelist.literals` = `[0,1,2,3,8,10,16]` (`sim.json` 156–159). Добавить число — в этот массив (с `src`/`why`), не в код. Прямая атака: литерал `12278` в фейковом источнике (`attack.py` 1848–1851).

### 7.5 Аналоги L194 / L195 для `TICK.md`

| | L194 | L195 | L164 (предшественник) |
|---|---|---|---|
| файл | `lint.py` 4608–4631 | 4634–4648 | 3867–3881 |
| документ | `docs/WORLD.md` | то же | `docs/SCREENS.md` |
| суть | каждый item фикстуры `brief_t10_world` имеет `world_section` и `rule_or_derived` в тексте | `\d{2,}` после strip | то же для SCREENS |
| фикстура | `content/fixtures/brief_t10_world.json` + `$defs.fixture_t10_world_file` + L01 | — | нет отдельной для чисел |
| strip | `WORLD_MD_STRIP` 3202–3211 | то же | `SCREENS_MD_STRIP` 3192–3201 (в т.ч. `R-T9`) |

Для T11: фикстура `brief_t11_tick` по инвентарю BRIEF §6 T11, правило покрытия `TICK.md`, правило литералов со своим `TICK_MD_STRIP` (разрешить `R-T11-*`, `L19x`, hex, §). Образец — пара L194/L195, не выдумывать третий стиль.

### 7.6 Схема: новый файл параметров

`corporator.schema.json` — один документ, файлы как `$defs.*_file`. Шаги: `$defs` + `PARAM_FILES` + (если фикстура) ключ в цикле L01 95–107. `param` требует `v` integer, `u`, `src` minLength 8, `why` minLength 24 (37–49). Float в params схема не допускает.

---

## §8. Кандидаты в расхождения (только фиксация)

### 8.1 Корень в чейн: час vs минута

- `DESIGN.md` §6.2 строка 545: «один корень в чейн раз в час».
- `BRIEF.md` таблица строка 41: «батчер отправляет корень раз в минуту по всем городам» — колонка «меняет §6.2 … противоречие назвать явно».
- `BRIEF.md` T11 строка 363: «корень в чейн раз в минуту, а батч в IPFS агрегатом на сутки города».

Подтверждено. Код аттестационного слоя не имеет.

### 8.2 Батч: сутки города на город vs минута по всем

- `DESIGN.md` §6.2 543: «Записи собираются в батч на сутки города на город».
- `BRIEF.md` 41 и 363: батчер раз в минуту по всем городам; предложение — IPFS-агрегат на сутки города.

Две оси смешаны: (а) период корня в чейне, (б) гранулярность IPFS-батча, (в) ключ группировки city-day vs wall-clock. Канон (а)=час (в)=сутки города на город. BRIEF (а)=минута (в) предлагается сутки города.

### 8.3 keccak vs sha256

- `DESIGN.md` §6.2 544: лист = `keccak(канонические байты)`.
- Весь исполняемый код: sha256 (`pack_hash`, дрожь [:8], `layout_hash`). keccak не импортируется.
- `CONTENT.md` 166 и `pack.py` 86–88: развилка названа осознанной для **хеша пака**, не для листьев.

Подтверждено: листья по канону keccak, реализации keccak нет.

### 8.4 «Layout не меняется» vs дельта фрагментов / T5

`DESIGN.md` §6.1 539: «Дельта фрагментов войдёт в запись на T11, как стадии T5; layout здесь не меняется.»


Факт кода: текущий layout уже **не** равен §6.1 (восемь полей, другие имена). `CONTENT.md` R2 держит `inputs.materials=0`, чтобы не мигрировать. Два требования в одном предложении: добавить дельту и не менять layout. Версионирования записи в каноне нет.
### 8.5 Личные часы vs общий `tick_index`

- `DESIGN.md` §3 174–179: отдельный календарь на аккаунт; `city_time = anchor + (now − first_login) × rate`.
- Код: один `tick_index` на `state`, все `cities` в одной фазе. `now`/`first_login` нет. `city_time` не вход.
- Учтено как личное: часы банка/расписаний через `city_clock` (если бы у города был свой индекс).
- Общий clock предполагается: весь T3-харнесс, `sim.price_inputs`, `depth_shock` на `hour==0`.

Границы суток разных городов в реальном времени разнесены — в коде не смоделировано. Аттестационный батчер «раз в минуту по всем городам» обязан это учесть: сутки города не совпадают.

### 8.6 `STALE_PRICE`, храповик, деградация только вниз

Минт ($CORP / ETH+USD):

- `DESIGN.md` §2.3 91–100: вниз сразу, вверх храповиком **целыми сутками**, потолок 2000 последним; молчание >6 ч → `STALE_PRICE`, деградация **вниз** к нижней границе полосы шагом `price_stale_decay_bps_per_city_day`; ноль → минт 0.
- `docs/LAUNCH.md` 184, 216, 356–361, таблица 370–371: stale 6 ч, decay 500 bps/сутки, храповик 200 bps.
- `economy.json` 22–27 rise 200; 34–45 stale 6 ч / decay 500 down; `price_feeds.eth_usd`/`corp_eth` 180–193 `decay_direction: down`, `stale_code: STALE_PRICE`.
- Код `_update_mint_rate` 446–500: совпадает по направлению; целые сутки = `hour==0` (полночь), не 06:00.

Стоки (другой контур, `DESIGN.md` §4.6 298–302):

- >6 ч → держим последнее, HUD `STALE` (не обязательно `STALE_PRICE`);
- >48 ч → тянем к 1.0 по 5%/сутки (может резать бонус, это сход к нейтрали, не «только вниз» рабочего курса минта).

Не смешивать два stale. Тик сейчас реализует только минт-контур. `oracle.district_efficiency` в `state_sources` — T11, кода нет.

Прочее, не из чеклиста запроса, но стоит рядом: запись кода ≠ §6.1; оффлайн ≠ догон при заходе; 06:00 пустой; Dex-оборот вне списка §1; `materials` всегда ноль (R2).

---

## §9. Вопросы к архитектору

Не более семи. Развилка + чем стоит.

1. **Кадр аттестации (час × сутки-на-город vs минута × IPFS-сутки).** BRIEF уже помечает противоречие с §6.2. От этого зависят контракт корня, CID-нагрузка и то, что реплейер считает «батчем». Молчание = два несовместимых TICK.md.


2. **Версия DecisionRecord.** §6.1 запрещает менять layout и одновременно требует дельту фрагментов и стадии T5. Код уже не равен §6.1. Стоит миграция истории vs опциональные хвосты vs команды только во входах. Без решения L-правила на байт-точность не написать.
3. **keccak листьев vs sha256 всего кода.** Паковый sha256 назван осознанным (`CONTENT.md` 166). Лист merkle по канону — keccak, реализации нет. Стоит зависимость верификатора (§6.3 «без keccak в каждом языке») против пословной правки §6.2.

4. **Граница суток: полночь / 06:00 / tick 0 = полдень.** Сейчас бюджет, EMA, храповик и stale-decay — в `hour==0` плюс особый полдень tick 0. Канон efficiency и fragment/season settlement — `efficiency_recalc_hour=6`. Свести к одному часу или держать два контура. Это двигает все «целыми сутками».

5. **Личный `city_time` vs когорта T3.** Спека engine — часы на город от `first_login`. Эталон и симуляция — общий `tick_index`. Батчер «по всем городам» при разнесённых сутках. Стоит переписывание T3 vs оговорка «когорта — тестовая проекция».

6. **T5 `apply_stack` содержимым пака.** Пустые rows — no-op. Строки пака сдвинут выход и полосы T2 (R-T5-12 держит их нетронутыми). Стоит калибровка T3 vs честный движок §5.3 с первого дня записи.

7. **Happiness: вывести формулу из слов §8 + порог HUD 50% + `park_slots`, или метрика-заглушка до живых складов energy/жилья?** Сейчас нет ни формулы, ни складов. Любое число без якоря в params нарушит L195-логику «числа живут в паке». Оффлайн тем же пунктом: квадратная волна T3 vs `last_login` catch-up ломает измеренный аптайм минималиста.

---

Конец разведки. Следующий шаг — ТЗ T11 (`docs/reports/T11_tz.md`) и `TICK.md`, не правки `tick.py`.
