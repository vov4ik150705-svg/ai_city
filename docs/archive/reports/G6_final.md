# G6 final

`companion_revenue`: sink `inference_bill`; краны NFT 0 с причиной (`D-G-9`); `companion_revenue_live` остаётся 0. `launch.deployed` пуст. Водяной знак призов 19.

Пак **61**, хеш **`27b09d56e40b6a9dcb0066a26df5aed669e271250d2f9468823007e418f8f47c`**, 562531 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 61; 562531 байт; hash `27b09d56…8f47c`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 312 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `27b09d56` |
| `python content/vectors.py` | 21 files; sha256 `e93c23773414c58e7d25afe11c94d0a33e39f63a1607ffe32c431e2ddecf57ee` |
| `python content/attack.py --only L143,L280,L312` | targeted caught; 10 probes |
| `corepack pnpm --filter @corporator/api run gate` | tsc 0; vitest 25/0 (6 files) |
| `python content/attack.py --jobs 8` | 312 rules covered; construction 224 held; SURVIVED 0 |

`sim.py` / `builds.py` не гейт: краны остались нулём, полосы T2 не ехали. Полный `--jobs 8` — гейт закрытия: правился `lint.py` (L312).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `prize_nft_share_bps=400` | L312 | caught кран prize 400 (план §5, `A-G-7`) |
| `fragment_nft_share_bps=400` | L312 | caught |
| `companion_revenue_live=1` | L312 | caught дверь L128 |
| live=1 + prize=400 | L128 молчит, L312 ловит | так и есть; флаг не поднят |
| `nft_proceeds_sink=prize_pool` | L312 | caught |
| sink снят | L312 | caught `''` |
| интервал `[0,0)` | L312 | caught |
| сплит 6000/4000 | L312 | caught |
| prize share 7500 | L312 / L280 | caught fund 50 < floor 100 |
| L143 A=10000 | L143 | caught `return_min 2851` |
| NFT taps 1000 при live=0 | L128 | caught |
| demo_companion=1 | L139 | caught (`A-G-15`) |
| demo_prize_real=1 | L112 | caught |
| demo_transfer_edges | L292 | caught |
| burn_reserve_rescue / vault selector | L305 | caught (I11) |
| три конструкции G6 | L312 | OK на зелёном; красный внутри |
| повторный флип призов | A-G-17 | `season_prizes_live` 1, watermark 19 |
| `launch.deployed` | A-G-2 | пять полей пустые |

Находка: поднять `companion_revenue_live` замолкает L128 на кране. Закрыто: флаг оставлен 0, L312 ловит и флаг, и кран. Ратификационный бит не заводился.

## Расхождения

Нет `R-G-*`. Полосы и окно A не сдвинулись (краны 0). Форма денег не тронута. `rules_version` 0.20.0.

## Незакрытое

`companion_llm_price_snapshot` — owner (`R-T8-2`). Ненулевые доли NFT — owner; этап закрыт нулём, не ожиданием. `exit_uncovered_at_band_floor`, `pause_ready_delay` — owner.

Next Step: **G7** — `rebalance_close` (холистический пересчёт, доминирование, публикация пака).
