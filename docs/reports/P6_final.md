# P6 final

`ops_watch`: наблюдение измерено, канал один, инцидент с runbook и кодом. `launch.deployed` пуст. Водяной знак 19. `rules_version` 0.20.0.

Пак **69**, хеш **`e823c7296b8bd7fcfbe3e86ae99ab38c2f180627dc9d1bca04e1136dbd2057ad`**, 592068 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 327 / 0 |
| `python content/build.py` | 0; pack 69; 592068 байт; hash `e823c729…d2057ad`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 23 artifacts match `e823c729` |
| `python content/attack.py --only L259,L302,L326,L327` | 13/0 пойманы |
| `tsc -b && eslint . && depcruise && vitest run` | tsc 0; eslint 0; depcruise 506/1583; vitest 156/0 (46 files) |
| три конструкции P6 | OK на зелёном; красный вход внутри каждой |
| `python content/attack.py --jobs 8` | 327 rules covered; construction 245 held; SURVIVED 0; elapsed 7.2s |

`sim.py` / `builds.py` / `vectors.py` не в команде этапа (`A-P-5`). Полный `--jobs 8` — правка `lint.py` / `attack.py` (L326/L327). `pnpm --filter @corporator/api run gate` на этой машине упирается в TLS npm; tsc/eslint/depcruise/vitest прогнаны локальными бинарниками. `--jobs 8` **нет** в `gate_cmd` этапа.

Наблюдения genesis ≠ порог: vault 0 vs 2000; круг 1445 vs 1400; payroll 10000 vs 24; I5 0 vs 500; I7 0 vs 409; I11 100 vs 4802; tick_index 0 vs 1; last_live_tick 0 vs 12; fields 16 vs 1; demo edges 0 vs 1. Алерт 3 раньше среза 6.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `observe_src = threshold_src` | L326 | caught |
| импорт `observedFromThresholds` в `host.ts` | L326 | caught |
| нет `observe_src` | L326 | caught |
| `price_staleness_max_city_hours=0` | L326 | caught |
| `owner drained` в OPS.md | L327 | caught |
| нет `runbook` | L327 | caught |
| `code=AUTH_REQUIRED` | L327 | caught |
| `observedFromThresholds` в прод-барреле `index.ts` | L326 | нет импорта; healthy |
| чтение метрик в `packages/engine` | A-20 | нет импорта |
| новый `AUTH_*` в `codes.json` | A-P-22 | не добавлялся |
| `--jobs 8` в `ops_watch.gate_cmd` | L319 | нет в команде |
| кнопка drain / «залочено навсегда» HUD | L302 | caught (`--only`) |
| `observed = threshold` на `/ready` | A-P-6 | vitest: ни одна строка не равна |

Выстояло (принято, не дефект пака): `c9.test.ts` копирует порог через helper (только тесты); живой compose (`R-P-6`); календарные 3 суток тестнета (`R-P-7`); горячий ключ подписанта; `R-M-6`/`R-M-9`/`R-M-10`; секунды `unpauseDelay` и адреса (`R-P-3`, owner, P7).

## Расхождения

`R-P-5` закрыт: живой экспорт идёт из `observeFromState`; helper вне тестов красный.

`R-P-6` / `R-P-7` без изменений.

## Незакрытое

PENDING 4: `companion_llm_price_snapshot` (owner), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3), `pause_ready_delay` (owner, к P7). Внешний аудит-подрядчик — календарь владельца. Живой compose / тестнет — среда, не пак. Числа P7 (`pause_ready_delay`, `studio_eth_recipient`, `guardian`, `signer`) — владелец (`R-P-3`).

Next Step: **P7** — `mainnet_launch` (не начинать без чисел владельца из `PLAN_RELEASE` §9).
