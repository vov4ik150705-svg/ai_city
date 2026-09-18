# T11 — отчёт: пак и проводка тика

Исполнитель шага T11 (пак + проводка, без L196+ и без новых атак). Канон `docs/TICK.md` не тронут: таблицы `<!-- GEN:... -->` подставит следующая волна. Модули `content/keccak.py`, `content/record.py`, `content/aggregates.py` переиспользованы без дубля логики.

Пак после финальной сборки: **`e33df7283de9ad9707428388b5d4d6534055baac97bd3cf2732f0166d4101c5d`**, 411235 канонических байт, `pack_version` **22**, `rules_version` **0.15.0**.

`docs/CONTENT.md` §5: major, если меняется выход уже записанных смен или порядок стадий. Layout v1 DecisionRecord + стадии в записи — major. Бамп 0.14.0 → 0.15.0 по таблице, не произвольно.

---

## 1. Что сделано

### Создано

| путь | роль |
|---|---|
| `content/params/tick.json` | layout v1, веса Happiness 2500×4, live-флаги штрафа; derived park/energy не хранятся |
| `content/params/attest.json` | `attest_root_period_s=60`, доменные байты 0/1 |
| `content/fixtures/brief_t11_tick.json` | инвентарь BRIEF §6 T11 |
| `content/fixtures/tick_aggregates.json` | векторы keccak / агрегаты для следующей волны |

### Изменено

`content/pack.py` (`PARAM_FILES`), `content/schema/corporator.schema.json` (`$defs` tick/attest + две фикстуры, `producer` у `state_source_row`, пары L01), `content/build.py` (`build_tick`, `build_attest`, `report_t11`, `IMPLEMENTED_DERIVED`, `apply_stack` отдаёт `stage_bps`/`stage_fused`), `content/tick.py` (проводка), `content/params/meta.json`, `pending.json`, `screens.json`, `exceptions.json`, `sim.json`, `requirements.txt` (`jsonschema==4.23.0`), `content/README.md`, `content/sim.py` (эндогенный сценарий + census кодов), `content/lint.py` и `content/attack.py` — только совместимость пака.

### Генераторы (`generated.tick` / `generated.attest`)

- `park_capacity_jobs = slots_at_city_level[city_level_at_slots_cap] // (1 + playable_v1_count)` = `20 // 4` = **5**. Расхождения с формулой нет.
- `energy_buffer_ticks = offline_cap_ticks_base` = **12**. Второго авторского 12 в params нет.
- Веса Happiness: 2500+2500+2500+2500 = **10000**.
- `attest_roots_per_day = real_day_seconds // attest_root_period_s` = `86400 // 60` = **1440**.
- Контуры суток: `midnight` hour 0 (бюджет, EMA, храповик, stale, GDP/Stability, неделя) и `efficiency_recalc` hour 6 (E района, fragment settle, season settle). Каждое событие ровно в одном контуре.
- PRNG: стрим `jitter_legacy` с пустой строкой — sha256 без хвостового `:`.
- `state_sources` T11 → имена `produce_*`. `wallet.stake_tokens` — T11 (`stake_snapshot` в заголовке). `wallet.corp_balance` и `wallet.chain` — **T12** (**R-T11-12**).

Секции `content/out/GENERATED.md`: `T11: record fields`, `remainder sinks`, `prng streams`, `day-boundary contours`, `attest params`, `happiness weights`, `tick codes`, `lint L196+`. Имена совпадают с заглушками `docs/TICK.md`.

### Проводка `tick.py` (инертность T3)

- `city_time` отсутствует во входе → тождество `anchor + tick_index * length` (как раньше). Оба ключа и несостыковка → `TickError("CITY_TIME")`, без предпочтения одного из двух.
- Ветка **06:00** после DEX, **до** `_fix_day_budget`. Полночь (`hour == 0`) не сдвинута ни строкой.
- Пустой `city["nodes"]`: `apply_stack` не вызывается, `mod_bps` не переписывается (тождество T3).
- Happiness считается при наличии полей жилья/парка; штраф `request * hap / BPS` только если `happiness_penalty_live=1`. В паке флаг **0**.
- `season_prizes_live=0` — ранжирование возможно, минта нет. У когорты T3 нет леджера фрагментов и season rows — settlement 06:00 пустой.
- Запись layout v1: `output` не `payout`, `reason=""` не `None`, нет `codes`/`pack_hash`. `tick_header` / `catch_up` снаружи `tick()`.
- Спека: вложенные `stage_bps.base` / `post` **без** `unit: bps` — иначе `validate_record` требует суффикс `_bps` у имени `base`.

### Долги pending

Сняты: `fragment_tick_wiring`, `season_tick_wiring`.

`sampler_corp_eth_endogenous` переформулирован, owner **T12**: харнесс (сценарий рядом с замороженным рядом) закрыт здесь; сервис сэмплера остаётся T12. Калибровка **не** пересчитывалась.

---

## 2. Числовая инертность SIM

Эталон до правок: `%TEMP%\T11_SIM_before.md` (пак 21 / 0.14.0 / `78d28465629df668…`). После правок тело от `## A_t2_comparable` до секции T11 — **байт-в-байт то же**. Разошлись только шапка (пак 22 / 0.15.0 / хеш) и новая секция в конце.

| величина | до | после |
|---|---:|---:|
| `A_t2` калибровка | 14011 | 14011 |
| `F_reserve/F_deposit` bps | 3978 | 3978 |
| возврат minimalist / optimizer bps | 2837 / 8213 | 2837 / 8213 |
| `N_min` low / mid / hype | 229 / 705 / 1057 | 229 / 705 / 1057 |
| `N_bank` low / mid / hype | 137 / 183 / 483 | 137 / 183 / 483 |
| `A_∞` low / mid / hype | 13986 / 13986 / 13988 | 13986 / 13986 / 13988 |

Экономика не ехала. Двигать числа было нельзя.

### Эндогенный ряд (находка, не блокер)

Сценарий `endogenous_corp_eth` (`kind: endogenous_twap`) **не** в `required_scenarios`. Live TWAP пула, калибровка заморожена.

`A_t2=32473` вне окна `[12278, 15787]`, `in_window=0`. `F_reserve=6618352361`, `F_deposit=9503999800`. Экономику не крутили. Это предмет отчёта, не правки T2.

---

## 3. Гейт

| прогон | результат |
|---|---|
| `python content/build.py` | 0 проблем канона, хеш `e33df728…`, 411235 байт |
| `python content/lint.py` | **195 правил / 0 ошибок**, PENDING 30 (19 art T10 + 11 pending; три wiring T11 сняты) |
| `python content/sim.py` | инертность таблицы выше; эндоген 32473 вне окна |
| `python content/attack.py --jobs 8` | один полный прогон: **367** проб, правила L01–L195 OK, **0 UNATTACKED / 0 SURVIVED / 0 CRASHES**, **2 CONSTRUCTION FAILED** (T8 pending / T8 exceptions). После починок оба зонда `None`. Повторный полный (~9 мин) не гонялся. |

Новых правил L196+ нет. Новых атак нет.

---

## 4. Починки lint.py / attack.py / sim.py (совместимость, не новые правила)

1. **`lint.py` L01** — в цикл фикстур добавлены пары `brief_t11_tick` / `fixture_t11_tick_file` и `tick_aggregates` / `fixture_tick_aggregates_file`. Без этого L01 не видел новые файлы (или падал на неизвестных). Нового номера правила нет.

2. **`attack.py` `construction_t8_pending_kept`** — ТЗ закрыло `season_tick_wiring`, `fragment_tick_wiring`. Конструкция требовала их на месте → CONSTRUCTION FAILED. Теперь требует оставшиеся T8/T12/T2/T10 долги и падает, если закрытые wiring снова открыты.

3. **`attack.py` `construction_t8_exceptions_zero`** — D10 завела именованное исключение `tick_jitter_bps` / `remainder_mod_span`. Конструкция требовала пустой `exceptions`. Теперь разрешён только этот ключ с полем `remainder_mod_span`; любой другой extra — отказ.

4. **`sim.py` census кодов** — layout v1 убрал `codes` из записи. Было `rec["codes"]` → KeyError или молчаливый сдвиг счёта. Стало `rec.get("codes")` и фолбэк `state["codes"] + city["codes"]` (старое поведение ×N записей).

5. **`sim.py` эндогенный сценарий** — единственное разрешённое касание экономики харнесса: `kind == "endogenous_twap"` и секция в конце `SIM.md`. Базовая калибровка не пересчитывается.

---

## 5. Расхождения R-T11-*

Тексты правок канона живут в `docs/TICK.md` §14 (следующая волна подставляет). Этим шагом DESIGN/HUD/CONTENT/TICK не переписывались.

| id | суть | статус этого шага |
|---|---|---|
| R-T11-1 | DESIGN.md §6.2 пословная правка (кадр аттестации) | текст в TICK.md §14; канон не править |
| R-T11-2 | `payroll_ratio` → `payroll_ratio_bps`, `payout` → `output` | код и спека v1; канон §6.1 правит следующая волна |
| R-T11-3 | `pack_hash` не в записи, только в заголовке | так в коде; CONTENT.md §5 / докстринг `pack_hash` — пословно позже |
| R-T11-4 | полночь и 06:00 — разные контуры; §2.3 не сливать с §4.6 | ветка 06:00 заведена, полночь не тронута |
| R-T11-5 | DESIGN §3 личные часы vs когорта T3 с общей фазой | `sim_cohort_shared_epoch=1`; T3 не переписывался |
| R-T11-6 | T5 закрыт наполовину: механизм и порядок есть, на калибровке стек пуст | `nodes=[]` → fused 10000, `mod_bps` не переписывается |
| R-T11-7 | пороги HUD 50%/70% в паке | `happiness_penalty_threshold_bps=5000`, `stability_hint_threshold_bps=7000`; HUD.md не править |
| R-T11-8 | производственная модель vs проекция харнесса оффлайна | квадратная волна T3 не тронута; `catch_up` — отдельная функция |
| R-T11-9 | Productivity — измерение цепочки, не второй множитель | `aggregates.productivity_bps`; слот стадии тождество BPS |
| R-T11-10 | live-отправка корня вырезана из v1; формат каноничен | outbox + fail-open; чейн — v1.1 |
| R-T11-11 | лист merkle = keccak(доменный байт \|\| canonical) | `record.py` + params 0/1; DESIGN §6.2 правит следующая волна |
| **R-T11-12** | `wallet.stake_tokens` — вход тика (T11); `wallet.corp_balance` и `wallet.chain` — T12, в чистую функцию не входят | смена владельца vs исходное ТЗ «все wallet.* → T11». Следующий агент называет это в `docs/TICK.md` |

Дополнительно (не номер из ТЗ): эндогенный `A_t2=32473` вне окна калибровки — находка, экономику не трогать.

`park_capacity_jobs` на паке **5**, как формула. Подгонки не было.

---

## 6. Адверсариальный проход

По каждому новому механизму вход, на котором он **должен** упасть. Молча выживших нет.

| атака | ожидание | факт |
|---|---|---|
| запись без `stage_bps` | отказ `validate_record` | HELD: `record.stage_bps: missing field` |
| лишнее поле `foo` | отказ | HELD: `record.foo: extra field` |
| `reason: None` и `output: 1.0` | отказ | HELD: null + float |
| `output: True` (bool ⊂ int в Python) | отказ | HELD: `bool is not a legal int` |
| `layout_version=2` при спеке 1 | отказ | HELD: `2 != spec 1` |
| `attest_root_period_s=7` | сборка видит | HELD: не делит 3600 |
| `attest_root_period_s=4000` | сборка видит | HELD: не делит 3600 **и** `> tick_length 3750` |
| сумма весов Happiness 9999 | отказ `build_tick` | HELD: `sum to 9999, not 10000` |
| `happiness_penalty_live=1` на грустном городе | выход едет, флаг не декорация; в паке 0 | HELD: request `95000→23750`, payout `5e11→2e11`; пакетный флаг 0 |
| тики 17/18/19 (hour 5/6/7 при anchor 12) | settlement один раз | HELD: флаги `[0, 1, 0]` |
| пустой `apply_stack([])` | fused **10000** | HELD |
| непустой ряд `output_bps` magnitude 500 | fused **не** 10000 | HELD: **10500** |
| `city_time=99` при `tick_index=0` | `CITY_TIME`, не молчаливый выбор | HELD: derived=87 |
| T8 constructions после починки | `None` | HELD |

Замечания прохода (не провалы):

- Штраф Happiness на одном городе с полным бюджетом не доказывает движение payout (формула `request * budget / total` при N=1 отдаёт весь бюджет). Смотреть `request` или N≥2. Сделано на двух городах.
- Поле `fragment_settlement` на городе не сбрасывается в остальные часы: это снимок последнего 06:00, не второй вызов. Проба чистит ключ перед тиком.
- `fragments.settle_from_data` ждёт `list[int]` долей, не dict-строк. У когорты T3 леджера нет.
- Первый полный attack сломался на T8 constructions; это совместимость пака, не дыра экономики.

---

## 7. Следующей волне

1. Правила **L196–L225** и атаки CONSTRUCTION из `docs/reports/T11_tz.md`.
2. Подстановка GEN-таблиц в `docs/TICK.md` (`GEN:tick.record_fields`, `remainder_sinks`, `prng_streams`, `day_boundary_contours`, `attest_params`, `happiness_weights`, `codes`, `lint_l196`).
3. Пословные правки DESIGN/HUD/CONTENT по R-T11-1…11 и **явно R-T11-12** в §14.
4. Сервис сэмплера CORP/ETH (pending `sampler_corp_eth_endogenous`, owner T12). Эндоген 32473 — не калибровка.
5. Повторный полный `python content/attack.py --jobs 8` после L196+, когда constructions T8 уже в новой семантике.

Не трогать этим заходом: полночь тика, базовые числа T3, `content/keccak.py` / `record.py` / `aggregates.py`.

---

## 8. git status --short

Репозиторий на диске показывает всё как неотслеженное (`?? content/`, `?? docs/`, `?? requirements.txt`, …). Отдельного staged diff нет. Файлы шага — перечисленные в §1.
