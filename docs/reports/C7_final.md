# C7 — итоговый отчёт шага

Выкуп — транспорт ETH со сборов → покупка `$CORP` → подтверждённый депозит → минт Capital в фонд. Тик не ждёт. Живой RPC не нужен.

Пак **32**, `rules_version` **0.17.0**, хеш **`2b6b998541ef16b81ab45e7cb943682e4f321650e2197e93aefdc12bce924acb`**, 487217 байт.

---

## 1. Что закрыто

- Числа выкупа только через `arch.buyback_refs` → `launch.params.buyback_*` (L244). Литерал транша в src роняет L244.
- Минт раньше `deposit_confirmed` отклоняется: порядок, метки, `applyStamp`, mock vault (L245, `mint_after_deposit_only`).
- Транш на трёх глубинах risk4 = `mulBps(depth, cap, bps)`, ≤ depth, × slippage ≤ creator_tax (L22).
- Сбор `< min_batch` → ноль отправок; накопление до порога; повтор в тот же `city_time` не шлёт.
- Расписание от `city_time`. Date/Math в src запрещены eslint. `blocks_tick=0`, `fail_mode=open`.
- `buyback_executor` на buyback, не `voucher_signer`.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 32; круг 14.47% / Trader 11.67% |
| хеш | `2b6b998541ef16b81ab45e7cb943682e4f321650e2197e93aefdc12bce924acb` |
| байты | 487217 |
| `python content/lint.py` | **272/0**, PENDING 27 |
| `python content/vectors.py` | 20; sha256 `b199244790f533a1a68e7c53452e76787cf51e2111e537de2ffcdc4c8c3183b7` |
| `python content/codegen.py --check` | 12 match `2b6b998541ef16b8` |
| `python content/attack.py --only L244,L245` | 4/4 пойманы |
| `python content/attack.py --jobs 8` | **502/0**, construction **145/0**, 545.0s |
| `pnpm --filter @corporator/buyback run gate` | tsc; vitest **3/0** |
| `pnpm -w run gate` | tsc-b + eslint + depcruise **306/0**; vitest **46/0** |

## 3. Конструкционные пробы C7

`mint_after_deposit_only`, `buyback_tranche_at_three_depths`, `buyback_below_min_batch_waits`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-6 | CID | C8 |
| R-C-11 | engine magic-numbers off; `1n+1n+1n` обходит L244 scan | C1 |
| R-C-13 | canonical копия в contentpack | C2 |
| R-C-14 | C2-имена не дублировать | C3 |
| R-C-15 | PGlite не Neon | C3 |
| R-C-16 | список RPC-модулей | принято |
| R-C-17 | `demo_barrier_holds` на C5 | принято |
| R-C-18 | `services_do_not_block_tick` имя на C3 | принято |
| R-C-19 | workspace vitest timeout | принято |

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `planSend` = 1n ниже min | below_min падает | 1n ≠ 0n | держит |
| `buybackOrderOk` всегда true | mint_after падает | true ≠ false | держит |
| транш = depth/2 | equality падает | 2.5e19 ≠ 1.65e17 | держит |
| depth/2 | `<= depth` падает | выживает | пара с mulBps+L22 |
| `33n` в overlay src | L244 | cap.ts | D-C-10 |
| свой tranche в arch.params | L244 | duplicates | пак |
| mint в order раньше deposit | L245 | I1/I3 | порядок |
| timestamps mint < deposit | L245 | I1/I3 | метки |
| mintCapital без deposit | mock | API_MALFORMED | C4 |
| Date в buyback src | eslint | banned | край |
| `1n+1n+1n` slippage | L244 | выживает | R-C-11 |

Выжившее: живой RPC — C10. CID — C8. Спрайты — T10.

## 6. Незакрытое

C8: attestor. C10: rpc parity. Спрайты T10. `build_tile_refusal` — T10.

Next: C8 — `services/attestor`.
