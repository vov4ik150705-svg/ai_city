# T11 — итоговый отчёт шага

Тик как чистая функция и аттестация. Живой эталон — `content/tick.py`. Канон движка — `docs/TICK.md`. Пак **23**, `rules_version` **0.15.0** (без бампа на этой волне), хеш **`de32ef8d33206e2b25c9e47fc4134e0cc08c50739ac423efc8099bf5570c48df`**, 412963 канонических байт.

`docs/CONTENT.md` §5: `floor_divs` в `generated.tick.remainder_sinks` — документация живого AST, не формула записанных смен и не порядок стадий. `rules_version` не бампался. `pack_version` 22 → 23, потому что опубликованный пак не мутирует.

---

## 1. Что закрыто за шаг T11 целиком

- Пословные правки `DESIGN.md` §5.3 / §6.1–6.3 / §8 и `HUD.md` §4.1.
- Пак: `tick.json`, `attest.json`, фикстуры BRIEF T11 и keccak/агрегаты, `keccak.py` / `record.py` / `aggregates.py`, проводка `tick.py`, `apply_stack` → `stage_bps`.
- Layout v1 DecisionRecord + `TickInputHeader` лист 0. `pack_hash` в заголовке, не в записи (R-T11-3).
- Правила L196–L225, атаки, 114 конструкционных проб.
- Эндогенный сценарий `corp_eth` рядом с замороженным рядом; калибровка T3 не пересчитывалась.
- Эта волна: L224 / L225; L204 вторая конъюнкта достижима; L210 сверяет счётчики `//`, не имена; канон R-T11-3/5/6; пак 23; таблица `GEN:tick.remainder_sinks` со столбцом `//`.

---

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; `pack_version` 23; `rules_version` 0.15.0 |
| хеш пака | `de32ef8d33206e2b25c9e47fc4134e0cc08c50739ac423efc8099bf5570c48df` |
| канонические байты | 412963 |
| `python content/lint.py` | **225 правил, 0 ошибок**, 0 предупреждений, PENDING 30 |
| `python content/attack.py --jobs 8` | **417 проб**, **225 покрыто**, **114 конструкций** |
| UNATTACKED | **0** |
| SURVIVED | **0** |
| CRASHES | **0** |
| CONSTRUCTION FAILED | **0** |
| exit | 0 |
| elapsed | 532.9 s (jobs=8) |
| исключений | 1 (`tick_jitter_bps` / `remainder_mod_span`) |

`docs/CONTENT.md` §6: 225 строк `| **L…** |` = `len(RULES)` = 225.

`python content/sim.py` — инертность:

| величина | канон | факт |
|---|---:|---:|
| `A_t2` калибровка | 14011 | 14011 |
| `F_reserve/F_deposit` | 3978 bps | 3978 |
| возврат min / opt | 2837 / 8213 | 2837 / 8213 |
| `N_min` low/mid/hype | 229 / 705 / 1057 | 229 / 705 / 1057 |
| `N_bank` low/mid/hype | 137 / 183 / 483 | 137 / 183 / 483 |
| `A_∞` low/mid/hype | 13986 / 13986 / 13988 | 13986 / 13986 / 13988 |

---

## 3. Правило L196–L225 → что ловит → текст поимки

Префикс `LNNN  ` — дословная строка после `→` с `python content/attack.py --jobs 8`.

| id | что ловит | дословная поимка |
|---|---|---|
| L196 | множество ключей DecisionRecord v1 ≠ канон | `L196  record fields extra [] missing ['stage_bps']; canon ['agent_id', 'building_id', 'city_id', 'city_time', 'district_efficiency_bps', 'fragments_delta', 'inputs', 'layout_version', 'objective', 'output', 'payroll_ratio_bps', 'reason', 'seed', 'stage_bps', 'status', 'tick_index']` |
| L197 | `null` в записи/заголовке | `L197  record.reason: null is forbidden in layout v1 (use empty string)` |
| L198 | float в записи/заголовке | `L198  float at $.output: hashed content must be integer-only` |
| L199 | канонизация не устойчива к порядку ключей | `L199  key permutation changed bytes: 3 vs 3` |
| L200 | `layout_version≠1` без major bump | `L200  layout_version=2 at rules_version 0.15.0: layout change requires a major bump, v1 is 1` |
| L201 | префиксы листа и узла совпали | `L201  leaf and node domain bytes are both 0: a leaf can pose as a node` |
| L202 | пин keccak empty разошёлся с живой реализацией | `L202  vector empty n=0 pinned 0000000000000000000000000000000000000000000000000000000000000000 != live c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` |
| L203 | нечётный узел дублируется / пары сортируются | `L203  odd-level node is duplicated; 3-leaf root collides with 4-leaf copy` |
| L204 | период не делит 3600 | `L204  attest_root_period_s 7 does not divide wall-hour 3600 s` |
| L204 | период делит 3600, но длиннее тика | `L204  attest_root_period_s 3600 > tick_length_real_seconds 150` |
| L205 | IPFS-ключ стенный час | `L205  IPFS aggregate key uses wall_hour: ['wall_hour']` |
| L206 | `_records` раньше `_pay` | `L206  _pay at line 3 does not precede _records at line 2` |
| L207 | нет остановки по `PACK_HASH` | `L207  tick.py has no PACK_HASH halt; a foreign pack_hash would mint` |
| L208 | сеть / файл / стенные часы / несидированный random | `L208  tick.py has forbidden I/O ['import urllib']` |
| L209 | `/`, `round`, `float`, `math.`, `Decimal` на пути тика | `L209  non-integer arithmetic on the tick path: ['aggregates.py: true division /']` |
| L210 | новая функция с `//` без стока | `L210  // in ['l210_orphan'] has no remainder-sink row` |
| L210 | лишнее `//` внутри покрытой функции | `L210  _pay floor-div count 4 != sink table 3` |
| L211 | `tick_index` сохранён параметром | `L211  tick_index stored as param v=0: a derived index in two places` |
| L212 | храповик на 06:00 или событие в двух контурах | `L212  mint_ratchet hung on hour 6, not midnight 0` |
| L213 | литерал `6` вместо `efficiency_recalc_hour` | `L213  _hour_six uses literal 6 at lines [2]; hour must come from efficiency_recalc_hour` |
| L214 | догон без cap / без `gap` | `L214  catch_up does not apply offline cap` |
| L215 | веса Happiness ≠ 10000 | `L215  Happiness weights sum to 9999, not 10000: {'happiness_weight_housing_bps': 2500, 'happiness_weight_parks_bps': 2500, 'happiness_weight_energy_bps': 2500, 'happiness_weight_payroll_bps': 2499}` |
| L216 | `happiness_penalty_live=1` без строки T5 | `L216  happiness_penalty_live=1 without a T5 output_bps happiness row: would multiply exit` |
| L217 | `productivity_bps` сохранён параметром | `L217  productivity_bps stored as param v=10000: a gauge in two places` |
| L218 | вторая формула Stability | `L218  aggregates.py defines stability_bps; the only formula is seasons.stability_bps` |
| L219 | фрагменты на idle / не-маяке | `L219  idle tick accrued fragments_delta=100, expected 0` |
| L220 | `season_prizes_live=0` и выплата > 0 | `L220  season_prizes_live=0 but sum_payout=40 at non-zero rank` |
| L222 | T11 `state_source` без `producer` | `L222  state_source aggregate.happiness owner T11 has no producer` |
| L223 | нет исключения jitter `% span` | `L223  exceptions missing tick_jitter_bps / remainder_mod_span` |
| L224 | пункт BRIEF §6 T11 без раздела в `TICK.md` | `L224  BRIEF item batcher_minute tick_section §9 is not in TICK.md` |
| L225 | голое `\d{2,}` в `TICK.md` после strip | `L225  docs/TICK.md has numeric literals ['99']: numbers live in the pack` |

L204: первая атака оставляет `city_day_real_hours=25` (тик `3750` с). Вторая ставит `attest_root_period_s=3600` (делит час стены) и `city_day_real_hours=1` (тик `150` с) — падает **вторая** половина.

L210: каталог `REMAINDER_SINK_CATALOG` пинит `floor_divs` на функцию. Генератор сверяет с AST `tick.py` / `aggregates.py` / `record.py`. Правило сравнивает счётчики, не множества имён. Вставка `1 // 1` в `_pay` даёт 4 против таблицы 3.

---

## 4. `R-T11-1…15`

| id | суть | статус |
|---|---|---|
| R-T11-1 | корень раз в минуту; IPFS сутки города | внесено в `DESIGN.md` §6.2 |
| R-T11-2 | имена полей записи; layout v1 устанавливается | внесено в `DESIGN.md` §6.1 |
| R-T11-3 | `pack_hash` в `TickInputHeader`, не в записи | внесено в `DESIGN.md` §6.1, `docs/CONTENT.md` §5, докстринг `pack.pack_hash` |
| R-T11-4 | два контура границы (полночь ≠ `06:00`) | названо расхождением; канон §2.3/§4.6 не переписывался этим шагом |
| R-T11-5 | когорта T3 — общая фаза, мир — личные часы | внесено в `docs/SIMULATION.md` §9; формула `DESIGN.md` §3 не менялась |
| R-T11-6 | T5 механизм есть, стек калибровки пуст | внесено в `docs/PROGRESSION.md` `R-T5-12`; не закрыто |
| R-T11-7 | пороги Happiness/Stability в пак | внесено в `HUD.md` §4.1 |
| R-T11-8 | две модели оффлайна (догон vs волна T3) | названо расхождением; `DESIGN.md` §3.2 не двигался |
| R-T11-9 | Productivity измеряется, не множит выход | внесено в `DESIGN.md` §8 и §5.3 шаг 5 |
| R-T11-10 | merkle live в `v1.1`, формат сейчас | названо; отправка корня отдана T12 |
| R-T11-11 | доменный префикс keccak | внесено в `DESIGN.md` §6.2 (с R-T11-1) |
| R-T11-12 | `wallet.stake_tokens` — T11; баланс/сеть — T12 | названо; отдано T12 |
| R-T11-13 | эндогенный `A_t2` вне окна на hype | названо; окно A на живом ряде — T2/T3 до запуска |
| R-T11-14 | HUD Productivity «множитель» | внесено в `HUD.md` §4.1 |
| R-T11-15 | лист-заголовок в реплее §6.3 | внесено в `DESIGN.md` §6.3 |

---

## 5. Адверсарий: что атаковал, что выстояло, что нашлось, что починено

**Атаки L196–L225** — все пойманы (тексты §3). Конструкции T11 (догон ≡ реплей, дерево 1/2/3/5, drop header, IPFS fail-open, `PACK_HASH`, пустой стек T5 = 10000, …) — held.

**Починено на этой волне**

1. **L204 вторая конъюнкта.** При тике `3750` с любой делитель `3600` автоматически ≤ длины тика. Атака мутирует период **и** `city_day_real_hours=1` → тик `150` с, период `3600` делит час стены и длиннее тика. Поимка: `3600 > tick_length_real_seconds 150`. Условие не лишнее: оно защищает корень не реже тика города, когда сутки города короче часа стены.
2. **L210 счётчики, не имена.** Allowlist `T11_FLOORDIV_COVERED` не видел новое `//` внутри `_pay`. Каталог несёт `floor_divs`; правило сравнивает AST с таблицей. Поимка: `_pay floor-div count 4 != sink table 3`. Таблица `GEN:tick.remainder_sinks` — 35 функций, столбец `//` в бэктиках (иначе L225 падает на `ema_24h` / `14`).
3. **L224 / L225** — покрытие BRIEF и запрет голых чисел, образец L194/L195. `TICK_MD_STRIP` снимает ещё HTML-комментарии.
4. **L208** — в бан добавлены `subprocess` и `os.system` / `os.popen` / `subprocess.run|Popen|call|check_output`. Старая атака `import urllib` ловится тем же текстом.

**Выстояло (контракт, не дыра)**

- Инертность T3: ни одно экономическое число калибровки не сдвинулось после bump пака и смены таблицы стоков.
- Пустой стек T5 = тождество `BPS`; паковые rows в когорту не входят (R-T11-6).
- Отказ IPFS моделируется хостом снаружи `tick()` (L208).

**Названо, не закрыто (рекомендация)**

1. **L206** сравнивает номера строк AST, не CFG. ТЗ просит AST-порядок. Вызов `_records` из хелпера выше `_pay` даст ложное срабатывание.
2. **L207** — присутствие литерала `PACK_HASH`, не живой raise. Живой контракт — конструкция `pack_hash_mismatch_halts`.
3. **L199** атака — оверлей байт. Живая устойчивость к порядку ключей — конструкция `record_key_permutation`.
4. **L208** не смотрит `pathlib.Path.open` / `Path.write_text`. Тик их не использует.
5. **L212** сверяет замороженный набор имён событий. Новое событие в `tick.py`, не попавшее в таблицу контуров, правило не видит, пока не расширят `DAY_BOUNDARY_EVENTS`. Рекомендация: сверка имён вызовов на ветках `hour==0` / `_hour_six` со списком пака.
6. **L222** проверяет, что `def producer(` есть в `tick.py`, не что `tick()` его вызывает.
7. **`apply_stack` / `compose_terms`** сняты с таблицы стоков: L209/L210 смотрят `tick.py` / `aggregates.py` / `record.py`. Сплав T5 по-прежнему держит L75 (число делений от схемы). `pack.mul_bps` — тот же периметр.
8. **Эндогенный `A_t2=32473`** вне окна — свойство hype-выкупа, не дыра харнесса (R-T11-13).

Границы, которые пробы уже бьют: N=0 догона; N > cap; пустой стек T5; live=0 → 0; idle → fragments 0; период > тика при укороченных сутках; лишнее `//` в `_pay`.

---

## 6. Что остаётся T12

Явный список (BRIEF §6 T12 + долги T11):

- сервис сэмплера (снятие TWAP, расписание, деплой; харнесс-сценарий закрыт T11);
- конвейер выкупа `ETH → $CORP → vault → фонд` как отдельный сервис (тик уже делает `_buyback` на попавшем ETH);
- `wallet.corp_balance` / `wallet.chain` (R-T11-12): не вход чистой функции, RPC снаружи;
- live-отправка корня в чейн `v1.1` (формат и дерево — с первого дня, R-T11-10);
- окно A на эндогенном ряде для T2/T3 (R-T11-13): ставки/оборот/связь минт↔пул, не выключение продаж в харнессе;
- высоты полос HUD (`hud_bottom_menu_height_px`, `hud_stock_strip_height_px` — pending);
- REST / WebSocket, коды ошибок API, монорепо `packages/*` (`packages/engine` копирует `docs/TICK.md`), деплой, наблюдаемость;
- паковые rows T5 в боевой город (не в калибровочную когорту), когда полосы T2 будут пересчитаны сознательно.

---

## 7. Канон этой волны (пословно)

| путь | правка |
|---|---|
| `content/pack.py` `pack_hash` | «inside DecisionRecord» → «in TickInputHeader, not in DecisionRecord» |
| `docs/PROGRESSION.md` `R-T5-12` | механизм `base`/`post` и `stage_bps` есть; `nodes = []` на калибровке; ссылка `docs/TICK.md` |
| `docs/SIMULATION.md` §9 | когорта T3 — `sim_cohort_shared_epoch = 1`; мир — личные часы `DESIGN.md` §3 |
| `docs/CONTENT.md` §6 | 225 правил, L224–L225, пак 23 |
| `docs/TICK.md` §14 | R-T11-3/5/6 помечены «внесено»; таблица `remainder_sinks` подставлена с `floor_divs` |
| `content/README.md` | 225 правил |

`docs/TICK.md` проза про bump `21` → `22` не трогалась (только GEN `remainder_sinks`). Это bump введения T11; публикация этой волны — пак 23.
