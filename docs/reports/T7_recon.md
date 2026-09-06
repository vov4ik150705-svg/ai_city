# T7 recon — сезоны и лидерборд (Influence)

Исследовательский отчёт задачи T7. Канон — `DESIGN.md` §8 / §12 и `docs/PRIZES.md` §6. Широкие таблицы — `content/out/GENERATED.md` секции «T7: …», команда `python content/build.py`. Чистая функция — `content/seasons.py`. Settlement **не** в `tick.py` / `sim.py` (T11). Экраны — T9.

---

## 1. Решения (не переоткрывать)

Длина сезона = `balance.season_city_days` (90). Не второй параметр. Реальные часы = 90 × 25 = 2250; гражданские сутки 93д + 18ч. 90 не кратно окну фрагментов 14 — не сдвигать на 84 (**R-T6-3** жив).

Influence — произведение четырёх интенсивностей (GDP/капекс, stability, efficiency к нейтрали 10000, покрытие playable), fused mul/div, затем интеграл. Не тратится. `capex_live` — потраченный Capital зданий и агентов, не кошелёк. 0 opened → coverage = BPS. Экспоненты все 10000. `fund_share_bps` не входит. 14-го ключа нет.

Свидетель: оптимизатор обгоняет вялого кита. Активный T3-кит при равном аптайме может вести за счёт стейк-потолка (**R-T7-5**). Зонды из существующих архетипов/uptime, четвёртый архетип не заводился.

Антисивил призов: слот кошелька = max, интеграл, qualify 20% сезона, живой стейк, `DEMO_NO_PRIZE`. Кап фрагментов на город не менялся (**R-T6-5** закрыт для призов).

Zipf α=1, n=10, floor, пыль остаётся. N=0 пул цел. N=1 забирает пул.

Кран: `spend_protocol` × `protocol_prizes_bps` (4000). Tax/cork/NFT = 0. Приз `$CORP`, hop 0 (**R-T7-1**). `season_prizes_live=0`: ранг v1, выплата v1.1 (**R-T7-2**). 4000 bps изымается, не копится в пул и не уходит во фрагменты.

pack_version 13, rules_version 0.10.0.

---

## 2. Пересчитанные числа

Источники с диска: `season_city_days=90`, `city_day_real_hours=25`, `season_qualify_bps=2000`, `residual_idle_bps=500`, `offline_cap_city_hours_base=12`, `ticks_per_city_day=24`, `optimizer.deposit_multiple_bps=10000`, `whale.deposit_multiple_bps=100000`, `stake_bonus_max_bps=1000`, `spend_protocol_bps=1000`, `protocol_prizes_bps=4000`, `deposit_capital_net=96000000`, `capital_unit_usd=100`, T1 50k / 300k / 2M $.

```
season_real_hours = 90 × 25 = 2250
2250 // 24 = 93;  2250 % 24 = 18
qualify_days = 90 × 2000 // 10000 = 18
uptime_opt  = 10000 − 500 = 9500
uptime_lazy = 12 × 10000 / 24 × 9500 / 10000 = 4750
```

| зонд | I_day | дни | I_season | qual |
|---|---:|---:|---:|---|
| optimizer_ref | 9025 | 90 | 812250 | да |
| lazy_whale | 826 | 90 | 74340 | да |
| active_whale | 9927 | 90 | 893430 | да |
| last_day_clone | 9025 | 1 | 9025 | нет |

812250 > 74340 (L106). 893430 ≥ 812250 (**R-T7-5**). 9025 < 18 суток qualify.

Zipf n=10 pool=10000: веса 10000,5000,3333,2500,2000,1666,1428,1250,1111,1000 (Σ=29288). Выплаты 3414+1707+1138+853+682+568+487+426+379+341 = 9995, пыль 5. Тройка × пул 10: [5,2,1] сумма 8 пыль 2. N=1: [10000]. N=0: pool_left 10000.

Бюджет сезона (fraction 1, hop 0):

| сценарий | Capital / город | usd_8dec / город | < 1$ |
|---|---:|---:|---|
| low | 3840000 | 384000000 ($3.84) | нет |
| mid | 23040000 | 2304000000 ($23.04) | нет |
| hype | 153600000 | 15360000000 ($153.60) | нет |

**R-T7-6 не сработал:** low за сезон $3.84 > $1 (окно T6 было $0.90 за 14 суток). Налогом фонда не лечили.

Rank-10 vs депозит 100 $: при N=1 rank10=0; при N=100 low/mid rank10 < депозита; при N=100 hype и любом N=1000 rank10 > депозита. Время qualify = 18 × 25 = 450 ч. Стейк-ориентир 100 $.

Круг трения не тронут: 14.47% (Trader 11.67%). L77 +700 unpaid: **13535 > 13300**. Касса: settle не минтит Capital; Σ payout ≤ pool; protocol-CORP уже изъят в `_apply_spend`.

---

## 3. Расхождения

| id | суть |
|---|---|
| **R-T6-3** жив | окно фрагментов ≠ сезон |
| **R-T6-5** закрыт для призов | слот кошелька + интеграл + qualify + стейк |
| **R-T7-1** | BRIEF хотел ETH→приз с tax. Кран — protocol CORP. hop 0 |
| **R-T7-2** | BRIEF: сезоны в скоупе. Счёт v1, выплата v1.1, live=0 |
| **R-T7-3** | §8 «efficiency против среднего» = нейтраль 10000 |
| **R-T7-4** | остаточный сивил N ключей × 90 суток. Не KYC |
| **R-T7-5** | активный T3-кит ведёт за счёт стейк-бонуса ≤1000 bps |

---

## 4. Атаки T7 (L104–L121)

Каждое новое правило поймало свою поломку. L01–L103 живы. L77 +700: 13535 > 13300.

| мутация | правило | сторона |
|---|---|---|
| `season_city_days=84` в seasons.params | L104 | derived 90 |
| `season_real_hours=2160` в params | L105 | 2250 = 90×25 |
| coverage 0 opened = 0 | L106 | opt I=0 ≤ lazy; honest 812250 > 74340 |
| `rounding=ceil` Zipf n=10 pool=10000 | L107 | floor 9995≤10000 |
| `protocol_prizes_bps=5000` | L108 (+L93) | 6000+4000 |
| hop=3; `prize_asset=Capital` | L109 | hop 0, CORP |
| `leaderboard_scope=city` | L110 | два города → одно место, score=max |
| `season_qualify_bps=0` | L111 | clone 1 < 18 |
| `demo_prize_real=1` | L112 | DEMO_NO_PRIZE |
| `wipe_pool_on_zero` | L113 | N=0 пул цел |
| `force_zipf_pad_top_n` (H_10 на N=1) | L114 | payout=[pool] |
| `season_prizes_live=1` | L115 | 0 в v1 |
| `include_fund_share` в i_day | L116 | 13 ключей, identity BPS |
| α=5000; `seasons.rows` | L117 | α=10000, rows нет |
| coverage 0/0 = 0 | L118 | BPS |
| `qualify_days=18` в params | L119 | derived |
| `prize_cork_share_bps=500` | L120 | 0; budget = protocol×4000 |
| `snapshot_last_day` | L121 | clone 9025 < opt 812250 |

Construction T7 (все held): Zipf floor; N=1; N=0; opt>lazy; coverage 0 opened; wallet max; clone not qualified; live=0; сплит; L77 +700 всё ещё падает; settle не минтит; круг 14.47%.

Обходы TZ §11, которые T7 фиксирует текстом, не кодом тика: кит перекладывает узлы в последний день — интеграл уже накоплен (проводка T11); сивил ключей — **R-T7-4**; `protocol_prizes_bps` не тратится на фрагменты.

На харнессе нашлось и закрыто здесь же:

1. Свидетели сначала подставляли coverage=BPS литералом, шов `coverage_zero_opened_is_zero` не доходил до I_season — L106 был декорацией. Счётчик покрытия зонда идёт через `coverage_bps(0,0,data)`.
2. Второй `_attack_param` в `attack.py` перетёр T4-хелпер (3 аргумента) — L61 упал TypeError. Имя не дублировали, T7 вызывает канонный хелпер.

---

## 5. Что искал и что выстояло

- Ceil Zipf печатает сверх пула: L107.
- Выравнивание сезона на 84: L104.
- Сумма шести городов кошелька: L110, score=max.
- Снимок последнего дня: L121, clone 9025 < 812250.
- live=1 контрабандой: L115.
- fund_share пятым множителем: L116, identity BPS ломается.
- coverage 0/0: L118 → BPS.
- Cork в бюджет призов: L120.
- +700 unpaid output после T7: L77 13535>13300.
- Construction +500 / +649 по-прежнему молчат (T5/T6).
- Активный кит 893430 > opt 812250 — не construction-fail, **R-T7-5**.

Касса на числах шага: изъятие protocol уже в `_apply_spend`; Σ Zipf 9995 ≤ 10000; минта Capital нет.

---

## 6. Гейты

| прогон | результат |
|---|---|
| `python content/build.py` ×2 | 210006 байт, SHA256 `7bcdef08197f3c45d6520526774b8f50bfcd5bb3b372d26d9859902990c4580b` совпал |
| `python content/lint.py` | rules 121, ERRORS none, WARNINGS none, PENDING 32 (без `influence_weights` / `prize_curve`; есть `season_claim_screens` T9 и `season_tick_wiring` T11) |
| `python content/builds.py` | justified 6321, dominating/dead/mandatory/uncovered 0, v1 raw 7695 |
| `python content/attack.py` | 240 (167 мутаций + 5 прямых + 68 construction), UNATTACKED empty, SURVIVED empty, construction held, exit 0 |
| импорт `content.seasons` | opt 812250 > lazy 74340; Zipf пыль 5; сезон 90/2250ч; сплит 10000 |

Исключений 0. `exceptions.json` не жгли.

---

## 7. Файлы шага

Созданы: `content/params/seasons.json`, `content/seasons.py`, `docs/reports/T7_recon.md`.

Правлены: `DESIGN.md` §8/§11/§12; `HUD.md` §5.1/§9; `docs/PRIZES.md`; `docs/CONTENT.md`; `docs/BALANCE.md` §14; `docs/LAUNCH.md` §10; `docs/PROGRESSION.md`; `docs/SIMULATION.md`; `content/pack.py`; `content/schema/corporator.schema.json`; `content/build.py`; `content/lint.py` L104–L121; `content/attack.py`; `content/params/meta.json` 0.10.0/13; `content/params/codes.json` + `content/strings/ru.json`; `content/params/pending.json`; `content/params/resources.json`; `content/params/fragments.json` why призов; `content/out/*` генератором.

`tick.py` / `sim.py` / `exceptions.json` не трогались. Полный прогон `sim.py` 90 суток не гонялся.

---

## 8. Следующий шаг

**T8** — компаньон NFT как кран (`prize_nft_share_bps` / `fragment_nft_share_bps` остаются 0, пока нет companion params). T9 — экраны клейма и `LEADERBOARD`. T11 — проводка I_day и settle в тик.
