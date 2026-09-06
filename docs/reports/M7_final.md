# M7 final

`launch_freeze`: pack tax 200 ready to freeze; `launch.deployed` empty; `launchToken` not signed (`R-L-22`). `rules_version` 0.19.0. Pack **53**, hash **`411900ef713eb94d6172fc12f6f418761a085d18badbc8f6cba7b979417f7b87`**, 545814 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 53; 545814 байт; hash `411900ef…7b87`; круг 1445; Trader 1164; вход 200; выход 910; `dex_visible` 300; buy 0; breakeven fund 72250 / protocol 36125; fee split 100/80/20; mint 51 |
| `python content/lint.py` | 304 / 0 |
| `python content/vectors.py` | 21 files; sha256 `2db024efe2297d16052e463bc82af83b88be260d11a065fd1b1c3c2d24004097` |
| `python content/codegen.py --check` | 19 artifacts match `411900ef` |
| `corepack pnpm -w install --frozen-lockfile` | 0 |
| `corepack pnpm -w run gate` | tsc/eslint/depcruise 0 (462/1385); vitest 103/0 |
| `python content/attack.py --only L24,L13,L14,L279,L293` | все пойманы |
| `python content/attack.py --jobs 8` | 639/0; construction 197/0; 304 covered; 752.9s |

`sim.py` на M7 не в команде этапа. Круг после M1 не пересчитывался: 1445 ∈ [1400,1600], вход 200 < выход 910. `L24` зелёный: фикстура KOTS `creator_tax_bps=100`, `kottara_errors` берёт `fix["creator_tax_bps"]`. `creatorTaxBps()` живой кривой = 200 — блокер подписи владельца.

Промежуточный `pnpm -w run gate` параллельно с attack: `postgres_replay_matches_pglite` EBUSY rmdir Windows; повтор файла 2/0; чистый gate 103/0.

## Атаки

Харнесс 639, все пойманы. Этапные:

| вход | ожидание | факт |
|---|---|---|
| `_onchain_creator_tax_bps=100` при паке 200 | L293 | caught |
| `creator_tax_bps=1100` (PackConstants выровнен) | L293 | caught |
| `curve_fee_bps=900` (витрина 1100) | L293 | caught |
| `max_creator_tax_bps=2000` (+ tax 1100) | L293 | caught (дыра закрыта пином 1000) |
| пустой / ghost `launch_freeze.construction_tests` | L268 | caught |
| Q0 сдвинут | L24 | caught; KOTS 100 ≠ пак 200 |
| vault 400 при tax 200 | L13 1620 | caught |
| PackConstants drift / доля 250 / частичный deployed | L279 | caught |

Выстояло (принято): `R-M-6`, `R-M-9`, `R-M-10`, горячий ключ подписанта, видимость бота ончейн, пустой `deployed` до подписи (`R-L-22`).

## Расхождения

Новых `R-M-*` нет. Проба `deployed_tax_matches_pack` остаётся на `pons_launch` (L9); M7: `pack_tax_equals_deploy_rate`, `vitrine_under_factory_ceiling`.

## Готовность / Next

Код и гейт M7 зелёные. Критерий `creatorTaxBps()=200` на живой кривой — подпись владельца. Next: владелец `launchToken` (200 bps, buy 0); заполнить `launch.deployed` фактом чейна; `pause_ready_delay` / `burn_reserve_rescue` остаются owner PENDING.
