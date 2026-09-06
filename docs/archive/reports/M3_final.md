# M3 final

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 49; 533620 байт; hash `2d421df45a899d7f8721546ebdda69d6b231f19235a67343af173446f48ed6b2`; круг 1445; T6 split 10000; period 30d; k 73334 |
| `python content/lint.py` | 291 / 0 |
| `python content/vectors.py` | 21 files; sha256 `4cf42dddb6c4a7aaf4bf8e91a5bb1abd5493f28b7cd475d7d9db2803fab9aba4` |
| `python content/codegen.py --check` | 19 artifacts match `2d421df45a899d7f` |
| `python content/sim.py` | 10 сценариев; calibration `A_t2=14217` ∈ [12278, 15787] |
| `pnpm -w run gate` | tsc/eslint/depcruise 0 (452/1351); vitest 86/0 |
| `python content/attack.py --only L283,L284,L291,L292,L294,L304,L90,L93,L107,L112` | все пойманы |
| `python content/attack.py --jobs 8` | 596/0; construction 183/0 |

`rules_version` 0.19.0. `launch.deployed` пуст.

Свидетели GENERATED «M3: корзина Zipf и кап доли»: n1_takes_each_pool=1; n10 3414,1707,…; empty_asset_does_not_block=1; farm_clones_paid 730 ≤ max 733; optimizer_unclipped=1; n1_share_cap_applied=0; split_check=10000.

## Атаки

Харнесс 596, все пойманы. Дополнительно: playable и тройка → L283; ceil и пыль между тикерами → L284 (ceil n=10 = 10005>10000); stored k / N=1 / k=0 → L291; DEMO после qualify / edges → L292; CORP в списке → L294; 6000/4000 → L304. C11 `sumPayout <= pool` на broadcast шести пулов — сломанный инвариант «сумма ≤ один пул»; держим Σ ≤ пул **по активу**.

## Расхождения

`R-M-11` закрыт: шесть стоков, CORP убран. `R-M-15` закрыт: сплит 10000/0. `R-M-3` инвертирован. `RK-M-8` закрыт L283. `RK-M-9` (доллар) — атомы в пуле, доллар на M6. `RK-M-10` закрыт свидетелем T3.

## Next

M4 — `basket_conveyor`: равномерный откуп, floor ноги корзины, остаток фонду.
