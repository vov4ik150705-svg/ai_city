# C7 — разведка

Выкуп — транспорт ETH со сборов → покупка `$CORP` → подтверждённый депозит в vault → минт Capital в фонд. Строка ROADMAP `buyback`. Зависит от C3, C4. Живой RPC — C10. Тик `_buyback` / `buyback()` не перекалибруется.

## Прочитано

PLAN_CODE §4 C7, D-C-10, RK-10; ARCHITECTURE §7; DESIGN.md §2.3; L22, L244, L245, L257, L268; arch.py `buyback_tranche` / `buyback_below_min` / `buyback_order_ok`; launch `buyback_*`, meta `buyback_slippage_safety_min`; engine `mulBps` + `buyback()`; chainport `vault.deposit` / `mintCapital`; C6_final.

## Дерево до шага

`services/buyback/src/index.ts` = `export {}`. Gate = `tsc --noEmit`. `buyback.construction_tests` пустые. `allowed_deps` = engine, protocol, contentpack, chainport. `buyback_refs` → launch; `buyback_order` = eth_collected, corp_bought, deposit_confirmed, mint.

## Решения

- Транш = `mulBps(depth, tranche_cap_bps, bps)` из engine; bps = spend_burn+fund+protocol. Второй формулы нет.
- Минт без `deposit_confirmed` или с `mint <= deposit` отклоняется (`buybackOrderOk` ≡ Python, плюс отказ пустого депозита).
- Сбор `< min_batch` → `planSend = 0`. Расписание только от `city_time`.
- Vault через AssetPort; `buyback_executor` у buyback, не `voucher_signer`. RPC — C10.
- Vitest-имена: три `roadmap.tests` без четвёртого (L268 1:1).

## Риски этапа

RK-10 (минт раньше депозита, транш сверх глубины, мелкий батч), RK-9 (тик не ждёт: `blocks_tick=0`).
