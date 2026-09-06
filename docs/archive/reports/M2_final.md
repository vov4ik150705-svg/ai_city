# M2 final

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 48; 530615 байт; hash `8e850c0eb1f09cbb57ec7bf99b41bc4532f902ffa00a0ca21bd67cb9a0e18360`; period 30d; opt 270750 > lazy 24780; qualify 6; круг 1445 |
| `python content/lint.py` | 285 / 0 |
| `python content/vectors.py` | 21 files; sha256 `df8a20a483c7336fb61f048f4b1189d37c205e95536e6e126c1444de406b2f29` |
| `python content/codegen.py --check` | 19 artifacts match |
| `python content/sim.py` | 10 сценариев; calibration `A_t2=14217` ∈ [12278, 15787] |
| `pnpm -w run gate` | tsc/eslint/depcruise 0; vitest 82/0 (EBUSY ретрай) |
| `python content/attack.py --only L282,L106,L107,L121,L220` | 7/7 OK |
| `python content/attack.py --jobs 8` | 581/0; construction 179/0 |

`rules_version` 0.19.0. `launch.deployed` пуст.

## Атаки

Харнесс 581, все пойманы. Дополнительно: хранимые `_real_hours` и `_index` → L282; день периода+1 час settle → только `PRIZE_PERIOD_SETTLED`; день сезона+1 → оба кода; день периода и час+1 → пусто; клон need 6. Делитель 1: L282 молчит (деление точное), ловят vitest `periods===3` и construction.

## Расхождения

Новых `R-M-*` нет. `RK-M-6` закрыт L282. `RK-M-7` (qualify 6) — скоуп M3 (кап доли).

## Next

M3 — `prize_basket`: шесть стоков без `$CORP`, Zipf, кап доли.
