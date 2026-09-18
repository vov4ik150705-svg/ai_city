# T6 recon — фарм сток-токенов (фрагменты)

Исследовательский отчёт задачи T6. Канон — `DESIGN.md` §2.9 и `docs/PRIZES.md`. Широкие таблицы — `content/out/GENERATED.md` секции «T6: …», команда `python content/build.py`. Чистая функция — `content/fragments.py`. Settlement **не** в `tick.py` / `sim.py` (T11).

---

## 1. Решения (не переоткрывать)

Фрагменты — внутренние фишки требования, не ERC-20 и не «игровой NVDA». Шесть леджеров из `districts[].ticker`. Начисление только на валидный оплаченный тик маяка с одним играбельным районом. База = gross output **до** `payroll_ratio`. `fragment_rate_bps` — fused mul стадии `post`. Efficiency второй раз не умножается.

Окно derived = `payroll_daily_divisor` (14), не хранится. Settlement в `efficiency_recalc_hour` (06:00). Потом леджер сгорает. Пустой пул → 0 + `FRAGMENT_POOL_EMPTY`. `Σ=0` → деления нет, пул цел, `FRAGMENT_NO_CLAIMS`.

Краны: tax 0, cork 0 (**R-T6-1** vs LAUNCH §10), NFT 0, `spend_protocol` сплит 6000/4000 (T7 не тратится). Hop 3 bps (LAUNCH §13, $10k). COIN quote WETH через один `weth_quote_ticker`, тот же haircut (**R-T6-2**). Покупка снаружи тика; settlement читает записанный пул. Аллокация по спросу, не 1/6.

`payout = floor(frag_i × pool / Σ)`. Кап 5000 bps только при N_claiming ≥ 2. N=1 без капа. Два равных не режутся. Пыль остаётся. Инвариант: стоков к выплате ≤ стоков в пуле по тикеру.

v1: окна фрагментов играбельных районов входят. Сезоны — v1.1. **R-T6-3**: окно ≠ сезон Influence.

pack_version 12, rules_version 0.9.0. 14-го ключа нет. Unpaid `output_bps` T6 не добавляет (форточка L77 13300).

---

## 2. Пересчитанные числа

Не копия прозы TZ. Источники: `payroll_daily_divisor=14`, `city_day_real_hours=25` → 350 ч; `efficiency_recalc_hour=6`; `deposit_capital_net=96000000`; `season_city_days=90`; `spend_protocol_bps=1000`; `protocol_fragments_bps=6000`; `fragment_hop_haircut_bps=3`; `capital_unit_usd=100` (usd_8dec); T1 low/mid/hype = 50k / 300k / 2M $.

```
spend = deposit_net × window // season × (scenario_usd × BPS // low_usd) // BPS
proto = spend × spend_protocol_bps // BPS
frag  = proto × protocol_fragments_bps // BPS
usd_8dec_net = frag × unit × (BPS − hop) // BPS
```

| сценарий | Capital / город | usd_8dec / город | < 1$ |
|---|---:|---:|---|
| low | 895999 | 89573020 | да ($0.90) |
| mid | 5375999 | 537438620 | нет |
| hype | 35839999 | 3582924700 | нет |

**R-T6-4:** low < 1$ на город за окно. Не доливать налогом фонда, APY не обещать.

Свидетели floor (кап 5000 bps):

| вход | выплаты | пыль | кап |
|---|---|---:|---|
| 1,1,1 × пул 10 | 3+3+3=9 | 1 | нет (никто не 50%) |
| 5000/5000 × 100 | 50+50 | 0 | нет |
| 9000/1000 × 100 | 50+10 | 40 | кит |
| N=1 × 100 | 100 | 0 | нет |
| Σ=0, пул 50 | 0,0 | 50 | — |

Ceil на тройке: `(1×10+3−1)//3 = 4`, сумма 12 > 10 — L90.

Маршруты: NVDA/TSLA/AAPL USDG v1; AMZN/MSFT USDG не v1; COIN WETH. Из одного параметра.

Трение круга не трогалось: 14.47% (Trader 11.67%). Касса: settlement не минтит Capital. Protocol-CORP уже изъят в `_apply_spend`.

---

## 3. `fragments_season` (R-T6-6)

TZ: `produced × fragment_stack / BPS`. Прокси суммы величин `paper` снят.

Первый проход с `produced` **после** `output_bps` оставил **3702** билда без свидетеля (L69): широкий город с одной paper-веткой бил узкий paper на той же цели. Контрольные L66 18/2/1/7695 не менялись.

Счёт доминирования: линия нормировки сценария `gdp` (workshop × ticks × uptime × n_prod) × стек, скоуп как T4 spot. Identity-стек (`mag=0` → `stack=BPS`) = 0, иначе L64 не ловит обнуление paper. Settlement по-прежнему gross × стек. Пул в цель не входит.

После правки: `python content/builds.py` — eval 9753, **justified 6321**, dominating 0, dead 0, mandatory 0, witnesses 3432 (vector 502, sibling 2394, between 408, slice 128), uncovered 0. Paper жив (`n_*_paper` в `node_best`).

---

## 4. Расхождения

| id | суть |
|---|---|
| **R-T6-1** | LAUNCH §10 предлагал cork в пул. T6 пробку не забирает: канал фонда, не приз. |
| **R-T6-2** | Haircut 3 bps и на COIN/WETH. Отдельный slip ~54 k$ не моделируется. Транш T12. |
| **R-T6-3** | §11/§12 склеивали сезоны и призовой фонд. Окна фрагментов в v1; сезоны Influence — v1.1. |
| **R-T6-4** | Бюджет окна на low — пыль < 1$/город. Не чинить налогом фонда. |
| **R-T6-5** | Кап на город, не на кошелёк. Сивил шести городов — антисивил T7, когда пул реальный. |
| **R-T6-6** | `produced` после `output_bps` схлопнул L69. Скоринг: линия нормировки × стек. |
| **R-T6-7** | `fragments.json` `src` части params ссылается на `T6_tz.md`, не на `DESIGN.md` §2.9. Пак не трогали: why канонен, это гигиена ссылок. |

---

## 5. Атаки T6 (L90–L103) и L21-ветка

Каждое новое правило поймало свою поломку. L01–L89 живы. L77 +700 unpaid output: **13535 > 13300**.

| мутация | правило | сторона |
|---|---|---|
| `rounding=ceil` на 1,1,1×10 → 4+4+4=12 | L90 | floor 3+3+3 пыль 1 (construction) |
| `force_fragment_accrual` на workshop | L91 | маяк playable+paid >0; IDLE/синергия 0 |
| `fragment_claim_window_city_days=7` в params | L92 | derived 14 |
| `protocol_fragments_bps=6001` | L93 (+L04) | 6000+4000 |
| tax share 100 | L94 | 0 |
| hop 2 | L95 | 3 |
| cap 2500 режет 50/50 → 25+25 | L96 | 50/50 при 5000 живы |
| `force_cap_n1` → N=1 выплата 50 | L96 | N=1 выплата 100 |
| `fragments.rows` unpaid output +700 | L97 | fragments.json без rows |
| `demo_claim_real=1` | L99 | DEMO_NO_CLAIM |
| `fragments_season_proxy=1` | L100 | прокси снят; paper жив |
| `pools.corp_nvda` | L101 | quote только USDG/WETH |
| `wipe_pool_on_zero_claims` | L102 | пул 50 остаётся |
| cork share 500 | L103 | 0; budget = protocol×6000 |
| `playable_tickers` ручной список | L21 | скоуп из `playable_v1` |
| `specialist_home2` +700 output | L77 | T6 не отменил форточку |
| paper `sign/effect_mult=0` | L64 | identity-стек не держит paper в живых |

Construction T6 (все held): floor тройка; N=1 без капа; 50/50; маяк; payroll_ratio=0 всё равно капает; Σ=0 пул цел; окно 14; сплит; демо; L77 +700 всё ещё падает.

Обходы TZ §8, которые T6 фиксирует текстом, а не кодом тика: кит в последний час окна селится по замороженному леджеру (T11); сивил городов — **R-T6-5**; hop stale → pool_in=0; `protocol_prizes_bps` не тратится; двойной efficiency запрещён.

---

## 6. Что искал и что выстояло

- Ceil на тройке печатает сток: L90, 12>10.
- Окно-литерал, cork>0, tax>0, hop<3, CORP/NVDA, прокси paper, N=1 кап, демо-клейм: все падают на своём правиле.
- +700 unpaid output после T6: L77 13535>13300 (не декорация; урок R-T5-14).
- Construction +500 (13282) и +649 (13299) по-прежнему молчат.
- N=1 без капа: 100 из 100. Два равных при 5000: 50+50.
- `payroll_ratio=0`: валидный тик всё равно капает (задумано).
- Identity-стек при mag=0 сначала оставлял paper живым — L64 не стрелял. Закрыто: `stack > BPS`.
- Construction L77 на deepcopy тащила `_lint_t5` с честного прогона и молчала. Закрыто: сброс кэша. Сама атака L77 с начала шага ловила 13535.

Касса на числах шага: изъятие protocol уже в `_apply_spend`; Σ выплат ≤ пул; минта стоков нет.

---

## 7. Гейты

| прогон | результат |
|---|---|
| `python content/build.py` ×2 | 199725 байт, SHA256 `83cf7fe2b2378d9f7f852f0a0e70d4a01bd74c7813f75cf09138a010aae21999` совпал |
| `python content/lint.py` | rules 103, ERRORS none, WARNINGS none, PENDING 32 (без `fragment_season_proxy` / `fragment_pool_sources`; есть `fragment_claim_screens` T9 и `fragment_tick_wiring` T11) |
| `python content/builds.py` | justified 6321, dominating/dead/mandatory/uncovered 0, v1 raw 7695 |
| `python content/attack.py` | 208 (147 мутаций + 5 прямых + 56 construction), UNATTACKED empty, SURVIVED empty, construction held, exit 0 |
| импорт `content.fragments` | тройка [3,3,3] пыль 1; окно 14/350/час 6; сплит 10000 |

Исключений 0. `exceptions.json` не жгли на COIN.

---

## 8. Файлы шага

Созданы: `docs/PRIZES.md`, `content/params/fragments.json`, `content/fragments.py`, `docs/reports/T6_recon.md`.

Правлены: `DESIGN.md` §2.3/§2.4/§2.8/§2.9/§4.8/§5.13/§6.1/§11/§12; `HUD.md` §6.2; `docs/CONTENT.md`; `docs/BALANCE.md` §14; `docs/LAUNCH.md` §10; `docs/PROGRESSION.md`; `docs/SIMULATION.md`; `content/pack.py`; `content/schema/corporator.schema.json`; `content/build.py`; `content/lint.py` L90–L103; `content/attack.py`; `content/builds.py`; `content/params/meta.json` 0.9.0/12; `content/params/codes.json` + `content/strings/ru.json`; `content/params/pending.json`; `content/out/*` генератором.

Не трогались: ставки круга T1, кривые T2, сиды T3, 13 ключей T5, `tick.py` порядок, `sim.py` ряды, `exceptions.json`.

---

## 9. Дальше
