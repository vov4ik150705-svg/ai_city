# M4 final

Конвейер — вторая нога buyback (`stepBasket`). Шесть стоков, never `$CORP`. Floor призовой ноги, остаток фонду. Studio floor до свопа; recipient `""` → hold. Haircut ссылкой. Кап/каденс — launch. `rules_version` 0.19.0. `launch.deployed` пуст. `port.groups` = 4.

Пак **50**, хеш **`e9da822827b4e4b8683483ab1ec4b055a20000ecf955121c704828720f1f391c`**, 536040 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 50; 536040 байт; hash `e9da8228…1f391c`; круг 1445; fee split 100/80/20 |
| `python content/lint.py` | 293 / 0 |
| `python content/vectors.py` | 21 files; sha256 `044f009b61fa8e0b261f9b5501daddf18c084c1f04984330f008ebf40e7463e8` |
| `python content/codegen.py --check` | 19 artifacts match `e9da8228` |
| `pnpm -w run gate` | tsc/eslint/depcruise 0 (456/1365); vitest 90/0 |
| `pnpm --filter @corporator/buyback run test` | 7/0 |
| `python content/attack.py --only L285,L286,L22` | все пойманы; construction 187 held |
| `python content/attack.py --jobs 8` | 607/0; construction 187/0; 293 covered; 627.9s |

`sim.py` на M4 не обязателен. Новых зависимостей нет. Арт не тронут. ReadLints на `basket.ts` / `m4.test.ts` — 0.

Свидетель GENERATED «M4: равномерный бюджет и тонкие пулы»: n=6; eth_in=60000; fund=30000; prize=30000; studio=6000; stocks=24000; per_ticker=4000; uniform_ok=1; AMZN thin_spent=330=cap, carry=3670; others_budget_unchanged=1; reallocates=0; hop_fail_spent=0; hop_fail_lag=1; odd_wei_fund_ge_prize=1; cadence_count=1; tranche_cap_count=1; hop_haircut_copies=1; haircut_ref_ok=1.

Критерий PLAN_MONEY §4 M4: шесть равных бюджетов; тонкий AMZN на капе, carry за ним, NVDA не вырос; отказ hop — ETH в carry, тик не стоп; вторых cadence/cap нет; haircut ссылкой.

## Атаки

Харнесс 607, все пойманы. Этапные:

| вход | ожидание | факт |
|---|---|---|
| `prize_hop_haircut_bps`=3 | L285 | copies 2, want 1 |
| `haircut_ref` не fragment_hop | L285 | not fragments.params… |
| второе `buyback_cadence_city_hours` | L285 | second cadence |
| leftover AMZN → NVDA (`basket_reallocate`) | L286 | `thin_throttled` 0 (carry обнулён; spent 330=cap); флаг `reallocates` тоже красный |
| `basket_no_depth_cap` | L286 | spent 4000 cap 330 |
| `basket_ceil_prize` | L286 | rounding against the fund |
| второй `buyback_tranche_cap_bps` | L286 | must stay a launch ref |
| транш 67 ×3 | L22 | 201 > tax 200 |
| safety 1 | L22 | below floor 3 |
| eth=1 | fund≥prize | fund=1 prize=0 |
| hopOk=0 | spend 0, lag 1, `blocks_tick`=0 | construction held |
| recipient `""` | studioSent=0, held | TS `basket_leg_floor_favours_fund` |
| CORP в тикерах | L283/L294 | не этот пакет; tickers=6 |

Обход «realloc без флага»: witness всё равно ставит `reallocates`, если NVDA вырос, и `others_budget_unchanged`. Обход «haircut только в seasons»: L109 + L285. Обход «поднять кап транша»: L22. Construction ×4 имена = `it()` = `arch.basket_conveyor.construction_tests`.

RK-M-11/12/13 закрыты L286 и двумя пробами. Выжившего, которое надо чинить кодом, нет.

## Расхождения

Новых `R-M-*` нет. `R-M-8` закрыт: haircut ссылкой, второго хранимого 3 нет. `R-M-12` (ETH студии): доля 2000 в паке; адрес recipient по-прежнему `""` — не выдумывать. Принятые без кода: `R-M-6`, `R-M-9`, `R-M-10`, горячий ключ подписанта, видимость бота ончейн.

## Незакрытое


Next: M5 — `prize_treasury` + `vault_safety` (§15; не `owner_drain`).
