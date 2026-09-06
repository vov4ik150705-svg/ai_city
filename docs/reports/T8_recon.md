# T8 recon — NFT-компаньон

Исследовательский отчёт задачи T8. Канон — `DESIGN.md` §5.14 / §5.4 / §5.6 и `docs/COMPANION.md`. Широкие таблицы — `content/out/GENERATED.md` секции «T8: …», команда `python content/build.py`. Чистая функция — `content/companion.py`. Проводка в тик — **T11**. Экраны — **T9**. Снимок цены вызова — **T12**. `tick.py` / `sim.py` / `exceptions.json` не трогались.

---

## 1. Решения (не переоткрывать)

D1–D15 из `docs/reports/T8_tz.md`. Кратко: компаньон продаёт внимание; величина на всех 13 ключах — ноль; единственный разрешённый ключ `idle_reduction_bps` со значением 0; `offline_cap_hours` даже с нулём запрещён (ось MSFT); автопилот — чистая функция до тика, две живые команды, LLM снаружи; 1 команда на агента на тик; советник derived из расписаний; краны NFT 0/0; fail-closed владение; предикат форточки T5.6 включает `companion`.

pack_version 15, rules_version 0.11.1. Пак вырос с 14: в hashed meta поднята версия правил (L143) и переписан `why` флага `companion_rows_live`.

---

## 2. Пересчитанные числа

Источники с диска: `time.json` schedules + `efficiency_recalc_hour`, `economy.twap_window_city_hours` / `tick_length_city_hours` → ticks=24, `agents.slots_cap`, `balance.residual_idle_bps=500` / `season_city_days=90` / окно A, `companion.llm` 8dec lo=100000 hi=1000000, `companion_idle_relief_bps=0`.

```
advisor_hours = {0, 6, 8, 9, 20, 21}     # close_hour=ticks → 0, не седьмой слот
advisor_calls_per_city_day = 6
advisor_cooldown_city_hours = 24 // 6 = 4
commands_per_city_day_bound = 24 × 20 = 480
llm_calls_per_holder_city_day = 6
(+1 сводка на город = 7; не расход компаньона)
llm_calls_at_10k_holders = 6 × 10000 = 60000
per-call usd_8dec ∈ [100000, 1000000)     # [0.001, 0.01) $
holder / сутки ∈ [600000, 6000000)        # [0.006, 0.06) $
holder / сезон 90д ∈ [54000000, 540000000) # [0.54, 5.40) $
uptime_minimalist = 12 × 10000 / 24 × 9500 / 10000 = 4750
uptime_companion  = 4750                  # нулевые величины
uptime_optimizer  = 10000 − 500 = 9500
```

Живых команд 2. Ненулевых ключей 0. Новых ключей 0. Краны NFT 0/0. Сплит 6000/4000. Круг 14.47% (Trader 11.67%). Окно A [12278, 15787]. L77: 12650 / 13300 / запас 650. Строк модификаторов в паке **91** (было 90: +`companion_idle`).

Касса: компаньон не минтит Capital и не трогает vault (`deposit`/`withdraw` в forbidden). `DecisionRecord` layout не менялся.

---

## 3. Расхождения

| id | суть |
|---|---|
| **R-T8-1** | BRIEF «меньше простоя». Связывающее ограничение — окно оффлайна; `residual_idle` компаньону нельзя. v1 — поведенческий простой, величина 0. |
| **R-T8-2** | T8 просит стоимость LLM числом. Цены провайдера нет. Интервал из §5.2 + pending на снимок. |
| **R-T8-3** | §5.4 «советник с лимитом» без числа. Выведено 6/сутки и кулдаун 4 ч. Канон — одно предложение. |
| **R-T8-4** | Предикат форточки покрывал {trait, objective}. Расширен `companion` (D15). |
| **R-T8-5** | PRIZES §3 держит NFT в кранах. T8 оставляет ноль и объясняет почему. |
| **R-T8-6** | §5.6 описывал агента. Одна строка «Компаньон» в таблице, раздел не переписан. |
| **R-T8-7** | Тумблер автопилота не в HUD §5.2. Экран — T9 (`companion_screens`). |

Седьмое — экран, не экономика. Восьмого канонного расхождения нет.

GENERATED прошлых задач: свидетели T2–T7 совпали с `docs/reports/T7_recon.md` (круг, окно A, T4 36/18/7695, T6 14d/[3,3,3], T7 812250>74340 / пыль 5). Единственная названная дельта — «Всего строк в паке **90 → 91**» (`companion_idle`). Пак 210006 → 224639 байт: новая секция companion + строка.

---

## 4. Атаки T8 (L122–L143)

Каждое новое правило поймало свою поломку. L01–L121 живы. Dual +700: L125 и L77 (13535 > 13300). Именованные 18 после +6 оффлайна целы (L80 молчит, L126 стреляет).

| мутация | правило | сторона |
|---|---|---|
| `withdraw` в allowed | L122 | ∩ forbidden; spending |
| pop `stake` из forbidden | L123 | unclassified |
| `companion_idle_relief_bps=1000` при live=0 | L124 | honest zero |
| строка на `output_bps` | L125 | keys.allowed |
| нулевая строка на `offline_cap_hours` | L126 | ось MSFT |
| ключ `companion_bonus_bps` | L127 | ⊆ 13 keys |
| `fragment_nft_share_bps=1000` | L128 | revenue_live=0 |
| хранение `advisor_calls_per_city_day=24` | L129 | derived |
| хранение cooldown=0 | L130 | ticks//calls ≥1 |
| per_tick=2 | L131 | вторая команда no-op |
| `policy_kind=llm` | L132 | deterministic |
| `tie_break=random` | L133 | lexicographic |
| `companion_carry_over=1` | L134 | скрытое удлинение окна |
| `companion_replan_on_login=1` | L135 | реплей §6.3 |
| снят `COMPANION_WINDOW_CLOSED` | L136 | молчаливый ноль |
| `journal_code` set_objective снят | L137 | код+текст |
| `hold_stale_action=keep` | L138 | fail-open |
| `demo_companion=1` | L139 | DEMO_NO_COMPANION |
| `companion_extends_window` + uptime 9600 | L140 | ≤ optimizer 9500 |
| точка `companion_llm_cost_usd_8dec` | L141 | интервал + pending |
| шов `free_kinds_no_companion` +700 | L142 | предикат companion |
| `a_t8_companion_free_output_700` | L125 + L77 | dual 13535>13300 |
| `a_t8_companion_offline_plus_6` | L126 | named 18 целы |
| `a_t8_companion_fund_share` | L125 | изъятие выплаты |
| `a_t8_companion_beats_optimizer` | L140 | 9600>9500 |
| `a_t8_companion_llm_in_tick` | L132 | LLM в политике |
| `a_t8_companion_burst_on_return` | L134 | carry+replan |
| `a_t8_companion_hold_fail_open` | L138 | keep |
| `a_t8_companion_taps_on` | L128 | оба крана; сплит 10000 |
| `companion_rows_live=1` | L143 | флаг заперт, как L115 |
| `live=1` + `relief=1000` | L143 + L140 | dual: флаг и свидетель 4750→выше |

Construction T8 (все held): zero noop fuse; A unmoved; L77 12650/13300/650; dual L125+L77; +6 offline named 18; PENDING 4 новые + старые; не минтит; exceptions 0; plan deterministic (тай-брейк `a` before `b`); круг 14.47%; свидетель читает величину, не флаг.

---

## 5. Что искал и что выстояло

- `withdraw` в автопилоте: L122.
- +700 unpaid `output_bps` paid=0: L125 и L77 (расширенный предикат). Construction +649 / +500 по-прежнему молчат.
- Нулевая строка на `offline_cap_hours`: L126; L80 не переписывает 12+6=18.
- `fund_share_bps` компаньону: L125 (вес в пропорциональном делении).
- Аптайм 9600: L140.
- LLM в политике / `policy_kind=llm`: L132. Детерминизм `plan()` не зависит от флага случайно: равный вход → равный выход (construction).
- Накопленные команды при заходе: L134/L135.
- Устаревшее владение keep: L138, plan пишет `COMPANION_HOLD_STALE`.
- Краны NFT on: L128, сплит 6000+4000 цел.
- Ceil/точка цены без снимка: L141.
- Откат предиката к {trait, objective}: L142.
- Касса / vault / DecisionRecord / exceptions 0 / круг 14.47% — construction.

Дыры собственной конструкции, закрытые здесь или названные:

1. **`companion_rows_live=1` (в том числе с `relief=1000`).** Дыра закрыта правилом **L143** (как L115 для `season_prizes_live`): флаг обязан быть нулём в v1. Свидетель аптайма читает величину через `mul_remainder` на `residual_idle_bps`, не флаг; L140 больше не условен. Зонд `live=1` → только L143; `live=1 + relief=1000` → L143 и L140 (4775 ≠ 4750). Больше не проходит молча.
2. **`COMPANION_RATE_LIMITED` в `plan()` почти мёртв** при уникальных `agent_id`: вторая команда не попадает в выход через `used`. Код живёт для ingest T11. Не молчаливый ноль окна — окно пишет `COMPANION_WINDOW_CLOSED`.
3. **Свежесть владения NFT.** T8 задаёт fail-closed флаг; запись `hold`/`hold_stale` — вход тика. Если T11 не обновит чтение, автопилот продолжит после продажи NFT. Владелец — `companion_tick_wiring` (T11).
4. **L45 не сканирует `companion.py`.** Float/random ловят L132/L133; окно A — construction из `build_balance`, не литерал.
5. **Пустая политика / нет совпадений** → пустой plan, без журнала. Это «нечего делать», не простой. Закрытое окно всегда пишет код.
6. **Последовательность seat+objective в одном тике:** побеждает меньший `priority`; вторая команда no-op. Игрок ждёт следующий тик (D7).
7. **Отказ LLM** → шаблон, экономика не замечает. Отказ RPC владения → меньше, не больше (D13).
8. **Число, которое гейт проглотит, а экономика поедет:** закрыто. `companion_idle_relief_bps` при `live=1` ловят L143 (флаг) и L140 (свидетель). Хранение derived под другим именем, не `advisor_calls_per_city_day`, L129 не видит — величина всё равно считается из расписаний, не из params.

На харнессе приёмки: зонд `live=1` и `live=1 + relief=1000` больше не проходят молча.

---

## 6. Гейты

| прогон | результат |
|---|---|
| `python content/build.py` ×2 | 224666 байт, SHA256 `7984c9ac7597b1d44e6c6637e304e226a9147613b60be88e747d1972e0bdb929` совпал; rules 0.11.1, pack_version 15 |
| `python content/lint.py` | rules 143, ERRORS none, WARNINGS none, PENDING 36 (из них T12 `companion_llm_price_snapshot` / `companion_queue_capacity`, T9 `companion_screens`, T11 `companion_tick_wiring`) |
| `python content/builds.py` | justified 6321, dominating/dead/mandatory/uncovered 0, v1 raw 7695 — счёт билдов не изменился: строка компаньона в нём не участвует |
| `python content/attack.py` | 284 (200 мутаций + 5 прямых + 79 construction), UNATTACKED empty, SURVIVED empty, construction held, 143 rules covered, exit 0 |
| импорт `content.companion` | calls 6, cool 4, bound 480, uptime 4750/4750/9500, mags все 0, plan байт-равен, тай-брейк `a` |

Исключений 0. `exceptions.json` не жгли. `tick.py` / `sim.py` не трогались.

Инварианты на числах шага: касса — нет минта без депозита; вход 5.0% < выход 10.0%; круг 14.47% в бюджете 14–16%; тик без LLM/random/wall-clock (компаньон снаружи, `policy_kind=deterministic`).

---

## 7. Файлы шага

Созданы: `content/params/companion.json`, `content/companion.py`, `docs/COMPANION.md`, `docs/reports/T8_recon.md`.

Правлены: `DESIGN.md` §5.4 / §5.6 (строка) / **§5.14** / §11; `HUD.md` §5.3 / §9; `docs/PRIZES.md` §3 / §6.5; `docs/PROGRESSION.md` T5.6 / T5.7 (90→91) / T5.9; `docs/CONTENT.md` типы + L122–L143; `docs/SIMULATION.md`; `docs/BALANCE.md` §14; `content/pack.py`; `content/schema/corporator.schema.json`; `content/build.py` (слияние rows, предикат D15, GENERATED T8); `content/lint.py` L122–L143; `content/attack.py`; `content/params/meta.json` 0.11.1/15; `content/params/codes.json` + `content/strings/ru.json`; `content/params/pending.json` (4 новые); `content/params/seasons.json` / `fragments.json` только why кранов NFT; `content/out/*` генератором.

`tick.py` / `sim.py` / `exceptions.json` / `fixtures/design_11_scope.json` не трогались. §5.13 — по-прежнему 13 ключей.

---

## 8. Следующий шаг

**T9** — экраны и клики: журнал компаньона в `LOG`, тумблер автопилота (`companion_screens`). T11 — команды как записанный вход и догон без `companion_replan_on_login`. T12 — снимок цены вызова LLM и ёмкость очереди на деплой.
