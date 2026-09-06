# L9 — журнал кода

Запуск на pons без покупки. `launchToken`, не `launchAndBuy`. Строка ROADMAP `pons_launch`.

Пак: **517404** байт, хеш **`76e99b6f2704bfa4d1781a184c8b310201f146529a656d4135620cd4d32478c3`**, `pack_version` **45**, `rules_version` **0.18.0**. Круг 14.47% / Trader 11.67%. Покупка 0 ETH / 0 токенов (share 0 bps).

## 1. Создано

| путь | роль |
|---|---|
| `packages/chainport/src/rpc/launch.ts` | `launchIntent` только при share 0; `postSignedRaw` → `eth_sendRawTransaction`; `readCreatorTaxBps` селектор `c1bb8901` |
| `packages/chainport/test/l9.test.ts` | `launch_no_buy`, `deployed_tax_matches_pack`, `launch_raw_tx_has_zero_value` |
| `docs/reports/L9_*.md` | отчёты |

## 2. Изменено

`meta.json` 44→45; `launch_buy_share_bps.v = 0`; `launch.deployed` пять пустых полей; схема `launch_deployed`; `pons_launch` goal/gate/L279/три `it()`; `codegen` `LAUNCH_BUY_SHARE_BPS`; `lint.py` L279; `attack.py` пять атак + три construction; `abi.ts` `creatorTaxBps`; C2 `loader_keeps_bigint` 63→60; `postgres_harness` retry `EBUSY` на `rm`; DESIGN §2.1 / §6.4; LAUNCH §2 / §4; BRIEF п.5; PLAN_LIVE критерий; ARCHITECTURE §6; CONTENT L279.

## 3. Решения

- Ключа владельца в репозитории нет: живой `launchToken` на Robinhood не шлётся. **R-L-22.**
- ABI `launchToken` не кодируется: verified source нет (`LAUNCH.md` §11.1). Подпись — аргумент края.
- Не пятая группа `AssetPort` (`RK-L-10`). Банк на сервере.
- Круг 14.47% не пересчитан. Казна на старте пуста, фонд — со сборов через выкуп.

## 4. Инертность

Круг 14.47% / 11.67%. `A_t2=14011`, банк 2837/8213. Engine без chainport. Касса не тронута. Layout 1. Новых npm-зависимостей нет.
