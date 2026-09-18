# T11 — отчёт: правила L196–L223, атаки, конструкции, эндогенный ряд

Зона: `content/lint.py`, `content/attack.py`, `docs/CONTENT.md`. Канон `docs/TICK.md` / `DESIGN.md` / `HUD.md` не тронут. Params, `build.py`, `tick.py`, схема и модули keccak/record/aggregates не менялись. `sim.py` не менялся: эндогенный `A_t2` — свойство, не артефакт харнесса.

Пак после `python content/build.py`: **411235** байт, хеш **`e33df7283de9ad9707428388b5d4d6534055baac97bd3cf2732f0166d4101c5d`**, `pack_version` **22**, `rules_version` **0.15.0**. Хеш не сдвинулся.

---

## 0. Резерв L224 / L225

Правила ТЗ §5, которые **не** делались (документ `docs/TICK.md` правит другой агент):

| id | аналог | что должно ловить |
|---|---|---|
| **L224** | L194 | каждый item фикстуры `brief_t11_tick` имеет `tick_section` и `rule_or_derived` в тексте `docs/TICK.md` |
| **L225** | L195 | в `docs/TICK.md` нет голых `\d{2,}` после `TICK_MD_STRIP` |

Это **два последних** номера после занятого блока. `TICK_MD_STRIP` уже лежит в `lint.py` (после `WORLD_MD_STRIP`), правил и атак под него нет. Остальные строки ТЗ §5 — L196–L223, без дыр.

---

## 1. Правила L196–L223: поимка с консоли

Прогон: `python content/attack.py --since-rule L196 --jobs 8` (и повтор `--only L197,L198` после усиления обхода дерева). Префикс `LNNN  ` — дословная строка после `→`.

| id | что ловит | вход | дословная поимка |
|---|---|---|---|
| L196 | множество ключей DecisionRecord v1 ≠ канон | отобран `stage_bps` | `L196  record fields extra [] missing ['stage_bps']; canon ['agent_id', 'building_id', 'city_id', 'city_time', 'district_efficiency_bps', 'fragments_delta', 'inputs', 'layout_version', 'objective', 'output', 'payroll_ratio_bps', 'reason', 'seed', 'stage_bps', 'status', 'tick_index']` |
| L197 | `null` в записи/заголовке, включая вложенные поля | `reason: null` | `L197  record.reason: null is forbidden in layout v1 (use empty string)` |
| L198 | float в записи/заголовке, включая вложенные поля | `output: 1.0` | `L198  float at $.output: hashed content must be integer-only` |
| L199 | канонизация не устойчива к порядку ключей | оверлей `_l199_bytes` разных буферов | `L199  key permutation changed bytes: 3 vs 3` |
| L200 | `layout_version≠1` без major bump | `layout_version=2` при `0.15.0` | `L200  layout_version=2 at rules_version 0.15.0: layout change requires a major bump, v1 is 1` |
| L201 | префиксы листа и узла совпали | оба байта `0` | `L201  leaf and node domain bytes are both 0: a leaf can pose as a node` |
| L202 | пин keccak empty разошёлся с живой реализацией | дайджест empty = `00…0` | `L202  vector empty n=0 pinned 0000000000000000000000000000000000000000000000000000000000000000 != live c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` |
| L203 | нечётный узел дублируется / пары сортируются | оверлей `record.py` с `node_hash(level[i], level[i])` | `L203  odd-level node is duplicated; 3-leaf root collides with 4-leaf copy` |
| L204 | период корня не делит 3600 или длиннее тика | `attest_root_period_s=7` | `L204  attest_root_period_s 7 does not divide wall-hour 3600 s` |
| L205 | IPFS-ключ стенный час | `wall_hour` | `L205  IPFS aggregate key uses wall_hour: ['wall_hour']` |
| L206 | `_records` раньше `_pay` | AST: `_records` строка 2, `_pay` строка 3 | `L206  _pay at line 3 does not precede _records at line 2` |
| L207 | нет остановки по `PACK_HASH` | из `tick.py` вырезан код | `L207  tick.py has no PACK_HASH halt; a foreign pack_hash would mint` |
| L208 | сеть / файл / стенные часы / несидированный random | `import urllib` | `L208  tick.py has forbidden I/O ['import urllib']` |
| L209 | `/`, `round`, `float`, `math.`, `Decimal` на пути тика | `x / BPS` в `aggregates.py` | `L209  non-integer arithmetic on the tick path: ['aggregates.py: true division /']` |
| L210 | новое `//` без стока остатка | функция `l210_orphan` с `//` | `L210  // in ['l210_orphan'] has no remainder-sink row` |
| L211 | `tick_index` сохранён параметром | param `v=0` в `tick.json` | `L211  tick_index stored as param v=0: a derived index in two places` |
| L212 | храповик на 06:00 или событие в двух контурах | `mint_ratchet` на hour 6 | `L212  mint_ratchet hung on hour 6, not midnight 0` |
| L213 | литерал `6` вместо `efficiency_recalc_hour` | `_hour_six` с `hour != 6` | `L213  _hour_six uses literal 6 at lines [2]; hour must come from efficiency_recalc_hour` |
| L214 | догон без cap / без `gap` | `catch_up` без потолка | `L214  catch_up does not apply offline cap` |
| L215 | веса Happiness ≠ 10000 | payroll weight 2499 | `L215  Happiness weights sum to 9999, not 10000: {'happiness_weight_housing_bps': 2500, 'happiness_weight_parks_bps': 2500, 'happiness_weight_energy_bps': 2500, 'happiness_weight_payroll_bps': 2499}` |
| L216 | `happiness_penalty_live=1` без строки T5 | live=1 | `L216  happiness_penalty_live=1 without a T5 output_bps happiness row: would multiply exit` |
| L217 | `productivity_bps` сохранён параметром | param `v=10000` | `L217  productivity_bps stored as param v=10000: a gauge in two places` |
| L218 | вторая формула Stability | `def stability_bps` в `aggregates.py` | `L218  aggregates.py defines stability_bps; the only formula is seasons.stability_bps` |
| L219 | фрагменты на idle / не-маяке | `force_fragment_accrual` + idle | `L219  idle tick accrued fragments_delta=100, expected 0` |
| L220 | `season_prizes_live=0` и выплата > 0 | probe `sum_payout=40` | `L220  season_prizes_live=0 but sum_payout=40 at non-zero rank` |
| L222 | T11 `state_source` без `producer` | снят у `aggregate.happiness` | `L222  state_source aggregate.happiness owner T11 has no producer` |
| L223 | нет исключения jitter `% span` | удалена строка exceptions | `L223  exceptions missing tick_jitter_bps / remainder_mod_span` |

Все 28 правил стоят в `RULES`. Блок помечен `# ---- L196.. T11`. `docs/CONTENT.md` §6: «Двести двадцать три правила», таблица L196–L223, абзац про резерв L224/L225.

---

## 2. Конструкционные пробы T11 (18 новых, всего 114)

Имена как в `CONSTRUCTION`. Ожидание всех — `None` (held). Обязательные из ТЗ §6 и запроса закрыты.

| имя | вход | ожидание | результат |
|---|---|---|---|
| догон ≡ реплей | N=3 онлайн vs `catch_up` | канонические байты записей равны | held |
| перестановка ключей записи | dict в обратном порядке ключей | `encode_record` байты равны | held |
| порча байта + L↔R | XOR первого байта; стороны доказательства | `verify_proof` ложно в обоих случаях | held |
| удаление листа-заголовка | `batch_leaves` без листа 0 | в оставшихся листьях нет `pack_hash` (нет входов реплея §6.3), не «функция упала» | held |
| дерево из 1 листа | `["solo"]` | корень = `leaf_hash` | held |
| дерево из 2 листьев | позиционный `node(left, right)` | корень = node, не `node(right, left)` | held |
| три vs четыре (копия третьего) | `[a,b,c]` vs `[a,b,c,c]` | корни **разные**; нечётный узел поднят как есть | held |
| нечётный уровень n=5 | пять листьев vs шесть с дублем последнего | корни разные | held |
| отказ IPFS не стопит выплату | `tick()` затем хост бросает `OSError` | payout > 0, outbox не пуст, `attest_lag_ticks=1`, из `tick()` исключения нет | held |
| чужой `pack_hash` | `pack_hash=deadbeef` | `TickError("PACK_HASH")`, выплат нет | held |
| пустой стек T5 | `apply_stack([])` vs строка +500 | пустой `stage_bps`/`fused` = **10000**; непустой fused ≠ 10000 | held |
| фрагменты unpaid | idle маяк; paid workshop | `accrue_amount` = 0 | held |
| season live=0 | ненулевой ранг, live=0 | `sum_payout=0` | held |
| догон длины 0 | `elapsed=0` | нет тиков, нет gap | held |
| догон > cap | сначала `tick(0)`, затем elapsed = cap+5 | ровно cap credited + **одна** gap-запись | held |
| граница 06:00 | последовательные тики вокруг `efficiency_recalc_hour` | settle флаги `[0,1,0]`; храповик на этом часе **не** шагнул | held |
| граница полуночи | последовательные тики вокруг hour==0 (tick 12); на самом тике — шок цены ×3 | freeze бюджета `[0,1,0]`; EMA `[0,1,0]`; ratchet_binds `[0,1,0]`; fragment settle нет | held |
| листья header затем UTF-8 | агенты `b` и `a` | порядок `['header','a','b']` | held |

Шок цены на полуночи нужен, потому что `ratchet_binds` растёт только когда суточный шаг **упирается** (`new_rate < target`). На плоском сиде счётчик остаётся 0, хотя ветка hour==0 всё равно исполняется (это проверяет EMA). Без шока проба «храповик шагнул» была бы ложно-красной.

Полный список 114 проб и 0 CONSTRUCTION FAILED — числа полного `python content/attack.py --jobs 8` в §5.

---

## 3. Эндогенный сценарий: свойство, не артефакт

Вопрос: `A_t2=32473` вне окна `[12278, 15787]` — потому что в ряд идёт только выкуп, или продажи игроков тоже есть?

**Ответ: продажи есть. Число — свойство экономики (выкуп >> выход игроков), не дыра харнесса. `sim.py` не трогался. Калибровку не пересчитывали.**

Код:

- `kind == "endogenous_twap"` / `force_live_pool_twap` → `sim.price_inputs` кладёт **живой** `pool_price_wei_per_whole`, не `seed_corp_wei`.
- Города несут `sell_share_bps` из архетипов: минималист **10000**, оптимизатор **5000**.
- `_bank_withdraw` (`tick.py`) при `sell > 0` вызывает `cpmm_sell_corp` — CORP игрока идёт в пул, ETH выходит.
- `_buyback` каждый тик тратит казначейский ETH на `cpmm_buy_corp` — выкуп.

Замер `run_season(pack, "endogenous_corp_eth", n_ref=200)` (90 суток города, тот же прогон, что даёт `A_t2=32473`):

| поток | endogenous | calibration (для масштаба) |
|---|---:|---:|
| `A_t2` | **32473** | 20742 (без `halt_reinvest`; канон калибровки 14011 — с halt) |
| `mint_rate` | 198 | 51 |
| `ratchet_binds` | 90 | 0 |
| `buyback_eth` | 25173131872751940857 | 3861698762406454233 |
| `withdrawn_life_wei` (ETH игрокам на выходе) | 106335118022586857 | 38477243495035734 |
| `tax_spec_eth` (сбор DEX → казна) | 24986824585044404400 | 3748455537472959120 |
| `tax_city_eth` | 106335118022586857 | = withdrawn на этом прогоне |
| `pool_eth` конец | 21565484419774953207 | 5548429488935209994 |
| `f_external` / `f_deposit` / `f_reserve` | 14740611770 / 9503999800 / 6618352361 | — |

`buyback_eth / withdrawn_wei = 236.73`. Почти весь выкуп — рециркуляция `tax_spec` (сбор 1% оборота DEX сценария hype), не «покупка без встречной продажи». Продажи игроков **входят** в ряд (`cpmm_sell_corp`, ненулевой `withdrawn_wei`), но они на два порядка слабее выкупа.

Поэтому живой TWAP ползёт вверх, храповик вяжет **90** раз (раз в сутки сезона), рабочий курс минта 51 → 198, `f_external` раздувается, `A_t2` выходит из окна. Это не «в ряду только buy». Это «на hype-обороте сбор DEX кормит выкуп сильнее, чем банк кормит продажи».

**Риск (T2/T3 до запуска, не T11):** калибровка держит окно, потому что ряд `corp_eth` заморожен сидом. Если в проде минт будет читать живой пул, как этот сценарий, `A_t2` уедет вверх при том же mix и том же `sell_share`. Лечить ставками/оборотом/связью минт↔пул на T2/T3, не выключением продаж в харнессе и не правкой T11.

---

## 4. Адверсарий: что атаковал, что выстояло, что нашлось

Атаки L196–L223 — все пойманы (тексты §1). Конструкции §2 — held. Дополнительно:

**Закрыто здесь**

- L197/L198 смотрели только `reason` / `output` на верхнем уровне: `inputs.compute = null` или `1.0` обходили `has_none`/`has_float`. Теперь `_t11_walk` по дереву. Старые атаки по-прежнему ловятся тем же текстом (`validate_record` остаётся первым источником, если он уже ругается).
- L208 не видел `random.randint` / `randrange` / `choice` (только `random.random`). Добавлены в AST-список.
- `hour_0_branch` прыжок на tick 12 без предшествующих тиков раньше давал ложный I4; сейчас последовательный прогон 0…13. Плоский сид не инкрементирует `ratchet_binds` — на самом midnight подаётся шок ×3, иначе проба «шагнул один раз» молчит на легитимной ветке.

**Названо, не закрыто (рекомендация)**

1. **L210 allowlist `T11_FLOORDIV_COVERED`.** GENERATED «remainder sinks» не покрывает все живые `//` на пути тика. Новая **функция** с `//` ловится (атака `l210_orphan`). Новое `//` **внутри уже перечисленной** функции (`_pay`, `catch_up`, …) правило не видит. Чинить `build.py` сейчас нельзя: строки стока входят в пак и сдвинут хеш. Когда будет законный bump `pack_version` — выгрузить полный список стоков из AST и выкинуть allowlist.
2. **L204 вторая конъюнкта** `period <= tick_length_real_seconds` при текущих числах **недостижима**: любой положительный делитель 3600 ≤ 3600 < 3750. Атака `v=4000` падает на «не делит 3600», не на «длиннее тика». Сработает, если тик города станет короче часа стены.
3. **L206** сравнивает номера строк AST, не CFG: вызов `_records` в хелпере, объявленном выше `_pay`, но вызванном после, даст ложное срабатывание; наоборот — промолчит. ТЗ просит именно AST-порядок.
4. **L207** — присутствие литерала `PACK_HASH` в исходнике, не живой raise. Живой контракт держит конструкция `pack_hash_mismatch_halts`.
5. **L208** по-прежнему не смотрит `os.system`, `subprocess`, `pathlib.Path.open`. Тик их не использует; дыра на случай появления.
6. **L199** атака — оверлей байт, не порча `pack.canonical`. Живая устойчивость к порядку ключей — конструкция `record_key_permutation`.
7. **Отказ IPFS** моделируется **хостом снаружи** `tick()`: внутри тика I/O запрещён (L208). Это контракт D1, не недоделка пробы.
8. **L224/L225** отложены: `docs/TICK.md` без покрытия BRIEF и без запрета голых чисел, пока документ двигают.
9. **`content/README.md`** всё ещё пишет «195 правил» — вне зоны этого шага.

Границы, которые пробы уже бьют: N=0 догона; N > offline cap; пустой стек T5 = 10000; live=0 и ненулевой ранг → 0; idle/не-маяк → fragments 0; пустой keccak vs живой дайджест.

---

## 5. Гейт (числа с консоли, не из прозы)

```
python content/lint.py
  rules run  : 223
  ERRORS     : none
  PENDING    : 30

python content/build.py
  pack       : 411235 canonical bytes
  hash       : e33df7283de9ad9707428388b5d4d6534055baac97bd3cf2732f0166d4101c5d
  rules      : 0.15.0  pack_version 22

python content/attack.py --jobs 8
  attacks    : 413
  jobs       : 8
  every rule caught its attack; 223 rules covered
  construction held; 114 probes
  elapsed    : 512.3s  jobs=8
  exit       : 0
```

UNATTACKED / SURVIVED / CRASHES / CONSTRUCTION FAILED на полном прогоне **не печатались** (ветка успеха). 0 / 0 / 0 / 0. Все 18 новых T11-конструкций — `OK C` / `construction held` (строки консоли 795–830 лога прогона).

---

## 6. Правки вне зоны

Не было. `sim.py` не трогался. Дефекта пака L210-allowlist не чинили в `build.py` (сдвинул бы хеш).

Усиления внутри зоны: `_t11_walk` для L197/L198; `random.randint|randrange|choice` в L208; `hour_0_branch` последовательный + ценовой шок.

---

## 7. Следующий короткий заход

L224 + L225, когда `docs/TICK.md` перестанет меняться: покрытие `brief_t11_tick` и голые числа через уже лежащий `TICK_MD_STRIP`. Атаки DIRECT по образцу L194/L195.
