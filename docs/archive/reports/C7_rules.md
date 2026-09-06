# C7 — пробы и поимки

L244 читает `services/buyback/src` (оверлей `_buyback_source`). L245 читает порядок и `buyback_timestamps`. Новых `L*` нет.

Пак: **487217** байт, хеш **`2b6b998541ef16b81ab45e7cb943682e4f321650e2197e93aefdc12bce924acb`**, `pack_version` **32**.

Конструкции vitest (`buyback.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `mint_after_deposit_only` | `buybackOrderOk` всегда true | expected false, got true (deposit=5, mint=4) |
| `buyback_tranche_at_three_depths` | транш = depth/2 | 2.5e19 ≠ mulBps 1.65e17 |
| `buyback_below_min_batch_waits` | `planSend` ниже порога возвращает 1n | 1n ≠ 0n |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| `arch.params.tranche_cap_bps=200` | L244 | duplicates launch.json |
| overlay `export const tranche = 33n` | L244 | `services/buyback/cap.ts hardcodes tranche_cap_bps=33` |
| order mint перед deposit | L245 | mints before deposit_confirmed |
| timestamps deposit=5 mint=4 | L245 | mint before deposit |
| `applyStamp` mint на пустых метках | mint_after_deposit_only | undefined |
| mint в тот же city_time, что deposit | mint_after_deposit_only | undefined |
| `vault.mintCapital` без deposit | mint_after_deposit_only | API_MALFORMED |
| `depositThenMint` mintTime < depositTime | mint_after_deposit_only | ok=false |
| capital > corp × capital_anchor | mint_after_deposit_only | ok=false |
| depth/2 как транш | `tranche <= depth` | **выживает** (половина всё ещё ≤ depth); ловят mulBps и L22 |
| `1n+1n+1n` вместо slippage | L244 scan | **выживает** (нет `3n`); R-C-11 magic-numbers off |

Транш: `<= depth` недостаточно — нужна сверка с `mulBps` и `trancheSlipWithinTax`. Python `construction_buyback_*` не трогаты.
