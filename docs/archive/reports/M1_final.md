# M1 — итоговый отчёт шага

Ставка 200 bps, вход vault 200 bps (вариант A). Сплит DEX 100 / 80 / 20. Пол фонда 100 bps. `launchToken` не подписан. `launch.deployed` пуст.

Пак **47**, `rules_version` **0.19.0**, хеш **`394cb00b63bbabc851d6d28edca9abb72712565abbc10e77b3229136f7bfbaf9`**, 529209 байт.

---

## 1. Что закрыто

- `creator_tax_bps` 100→200, `vault_fee_bps` 400→200 одной правкой. Круг **1445** ∈ [1400, 1600]; Trader **1164** ≥ 1100 и < 1445; вход 200 < выход 910 (Trader 611).
- `fund_effective_tax_floor_bps` = 100; `prize_creator_tax_share_bps` = 5000; `fragment_creator_tax_share_bps` = 0. Derived fund/prize = 100/100.
- `studio_eth_share_bps` = `ceiling` = 2000; recipient `""`. Take студии в тике не снимается (M4).
- `rules_version` 0.19.0, watermark 19. Три `it()` = три имени `fee_split.construction_tests`.
- `pending.exit_uncovered_at_band_floor` v=**409** (M1 2026-08-30, формула L48).
- Канон пословно: DESIGN §2.1/§2.3/§2.5/§2.6/§12, LAUNCH §3/§5, BRIEF, BALANCE, CONTENT, economy-determinism.mdc.
- `R-M-2` закрыто. `R-M-4` не открывать: `sim.py` `A_t2=14217` ∈ [12278, 15787].

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0; pack 47; круг 1445 / Trader 1164; вход 200 / выход 910; mint 51; visible 300; split 100/80/20; breakeven 72250 / 36125; vault_mint 1960 |
| хеш пака | `394cb00b63bbabc851d6d28edca9abb72712565abbc10e77b3229136f7bfbaf9` |
| канонические байты | 529209 |
| `python content/lint.py` | **284/0**, PENDING 3 |
| `python content/vectors.py` | 21; sha256 `3beaae8a07b3085115c976318ee89f1bb798a81e001f0cc5b7b0b069f542b430` |
| `python content/codegen.py --check` | 19 match `394cb00b63bbabc8` |
| tsc / eslint | ok |
| depcruise | **450/0** (1343 deps) |
| vitest run | **79/0** (было 76; +3) |
| `python content/attack.py --only L13,L14,L22,L24,L32,L33,L48,L147,L279,L280,L290` | пойманы |
| `python content/attack.py --jobs 8` | **576/0**, construction **176/0**, 284 covered, 597.0s |
| `python content/sim.py` | `A_t2=14217`, банк 2798/8100 |

`pnpm` на хосте — `corepack pnpm`. Новых зависимостей нет. Арт не тронут.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| tax 200, vault 400 | L13 | 1620 bps | компенсация не декорация |
| prize share 7500 | L280 | fund 50 < 100 | пол фонда |
| хранимый `creator_tax_fund_bps` | L281 | stored | сплит derived |
| live=1, watermark 18, `0.19.0` | L290 | L220 молчит | знак не L220 |
| prize 0 + studio 2000 | L295 | take would cut the fund | L280 обойдён — L295 ловит |
| studio share 10000 | L296 | > ceiling 2000 | потолок |
| транш `tax//3+1` = 67 | L22 | 201 > 200 | старый cap=50 молчал |
| PackConstants tax+1 | L279 | mismatch | drift, не replace 100 |
| снят pending L48 | L48 | drop 1091 < band 1500 | v=409 держит зелёный |
| A=12277 (старое window-1) | L42 | **молчание**: 12277 ∈ [12275, 15783] | закрыто: A=`window_lo-1` → min 3499 |
| construction vault 400 | L13 | 1620 | три имени `fee_split` |
| construction prize 7500 | L280 | fund 50 | |
| construction tax 1100 | factory cap | > 1000 | |

Найденный обход «A=12277 внутри нового окна T2» закрыт. Выжившего, которое надо чинить кодом, нет.

## 4. Расхождения R-M-* / R-L-*

| id | суть | статус |
|---|---|---|
| R-M-2 | канон называл 1% и состав 1/4/~9/1 | **закрыто** (2% и 2/2/~9/2) |
| R-M-4 | усиление фонда vs окно A | **не открывать**: 14217 ∈ [12278, 15787] |
| R-M-6 | витрина 300 bps | принято |
| R-L-22 | нет живой сверки `TokenLaunched` | принято; пустой deployed |
| R-M-9, R-M-10 | три границы / watermark дальше | не этот этап |

Окно T2 формулы съехало [12278, 15787] → **[12275, 15783]** из-за unit capture 4277. Derived, не подгонка полосы. Критерий M1 смотрит `sim.py` A, не freeze концов T2.

Нового R-M-* нет.

## 5. Незакрытое


`studio_eth_recipient` пуст — адрес не выдумывать (M4). Студия в тике не снимается.

Next Step: **M2** — `prize_period`.
