# M5 final

Пятая группа — казна призов (`PrizeTreasury.sol`). Vault — предохранитель: `refundPlayer` ≤ `backingOf`, страж ≠ подписант. `pool_in` measured. `returnUnsettled` не ест settled. `rules_version` 0.19.0. `launch.deployed` пуст. `port.groups` = 5.

Пак **51**, хеш **`832630c42ecd85466d9462a478f0a8e0f33b4d523c72368d102c9f1ef088d7c9`**, 540926 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 51; 540926 байт; hash `832630c4…d7c9`; круг 1445; fee split 100/80/20 |
| `python content/lint.py` | 302 / 0 |
| `python content/vectors.py` | 21 files; sha256 `26442f46f07a357fcdda8f7426b4085a2bc3fbd39c92cdfff3a6f3a7e960f1f3` |
| `python content/codegen.py --check` | 19 artifacts match `832630c4` |
| `pnpm -w run gate` | tsc/eslint/depcruise 0 (460/1373); vitest 98/0 |
| `pnpm --filter @corporator/api run migrate:check` | 0; DDL `prize_returns` |
| `python content/attack.py --only L287,L288,L289,L297,L298,L299,L300,L301,L303,L112,L277` | все пойманы |
| `python content/attack.py --jobs 8` | 629/0; construction 195/0; 302 covered; 694.4s |

`sim.py` на M5 не обязателен. Новых зависимостей нет. Арт не тронут. ReadLints на `treasury.ts` / `m5.test.ts` — 0.

Свидетель GENERATED «M5: казна призов и предохранитель vault»: groups_n=5; groups_ok=1; kettles_ok=1; pool_in_measured=1; forbidden_ok=1; return_skips_settled=1; paused_claim_silent=1; uncovered_ok=1; over_backing_rejected=1; bot_whole_rejected=1; has_setSigner=0; proxy=0.

Критерий: пять групп; vault/фонд/резерв не drain; return skips owed; клейм на паузе молчит; UNCOVERED при пустом pool_in; refund ≤ backing; бот ≠ весь vault; recover своего актива закрыт.

## Атаки

Харнесс 629, все пойманы. Этапные:

| вход | ожидание | факт |
|---|---|---|
| vault убран из `drain_forbidden` | L287 | caught |
| `pool_in=accumulated` | L288 | caught |
| снят `PRIZE_UNSETTLED_RETURNED` | L288 | caught |
| снят `PRIZE_CLAIM_UNCOVERED` | L289 | caught |
| шестая группа `pool` | L297 | caught |
| `refundPlayer` на казне | L297 | caught |
| `delegatecall` | L297 | caught |
| `treasury_return_settled` | L298 | caught |
| `treasury_claim_when_paused` | L298 | caught |
| снят backing cap | L299 | caught |
| `setSigner` | L300 | caught |
| снят `guardian_ != signer_` | L300 | caught |
| recover `$CORP` | L301 | caught |
| `_refund` по `balanceOf(vault)` | L303 | caught |
| `Bank.sol` / `Pool.sol` | L277 | caught |
| `demo_prize_real=1` | L112 | caught |

A-28…A-32, A-36, A-37 закрыты правилами. Обход «returnUnsettled читает owed соседней функции» закрыт нарезкой `_sol_fn`. Construction ×8 имена = `it()` = roadmap.

Выжившего, которое надо чинить кодом, нет.

## Расхождения

Новых `R-M-*` нет. `R-M-13` закрыт: `port.groups` = 5, казна в `DESIGN.md` §10. Принятые без кода: `R-M-6`, `R-M-9`, `R-M-10`, горячий ключ подписанта, видимость бота ончейн.

RPC-методы `AssetPort` по-прежнему четыре (mock/rpc); пятая группа живёт в паке и в `.sol`. Клейм/HUD — M6.

## Незакрытое


Next: M6 — `prize_surface` (L302, HUD).
