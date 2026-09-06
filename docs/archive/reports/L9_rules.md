# L9 — правила и пробы

| id | что ловит | вход падения |
|---|---|---|
| L279 | share ≠ 0; derived buy ≠ 0; PackConstants налог/доля ≠ пак; `launchAndBuy` в src; нет `eth_sendRawTransaction` / `valueWei: 0n`; частичный `launch.deployed` | share 250; `launchAndBuy` в `launch.ts`; нет `launch.ts`; `CREATOR_TAX_BPS = 200`; только `token` заполнен |
| `launch_no_buy` | intent с ненулевым value; derived buy не ноль | share 250 → L279; `launchIntent(1n)` = undefined |
| `deployed_tax_matches_pack` | налог в PackConstants уехал; частичные адреса | drift 200 → L279; пустые пять полей до факта |
| `launch_raw_tx_has_zero_value` | unsigned `eth_sendTransaction`; JSON-число в result | нет `launch.ts` → L279; `result: 1` → silence |

Атаки L279: `a_l279_share_not_zero`, `a_l279_launch_and_buy`, `a_l279_no_send_raw`, `a_l279_tax_mismatch`, `a_l279_partial_deployed`.

C2: `loader_keeps_bigint` 63→60: три `launch_buy_*` стали 0 и вышли из множества > 2^53.
