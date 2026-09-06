# C4 — журнал кода

AssetPort: mock полный, rpc заглушен до C10. Экономика не тронута. Круг 14.47% / Trader 11.67%.

Пак: **485237** байт, хеш **`810be5e54712266ae4404a772794fafc593df18f9e78a76bcd257bbd2d2a68b1`**, `pack_version` **29**, `rules_version` **0.17.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/chainport/src/values.ts` | kind, result, TTL/keys config, `isPortKind` |
| `packages/chainport/src/port.ts` | четыре группы §10 |
| `packages/chainport/src/mock.ts` | CORP/vault I1, ваучер nonce+TTL, стейк-снимок, merkle store |
| `packages/chainport/src/rpc/index.ts` | все методы `FEATURE_NOT_IN_V1` |
| `packages/chainport/src/index.ts` | `createPort` exhaustive switch |
| `packages/chainport/test/c4.test.ts` | `port_two_implementations`, `voucher_single_use` |

## 2. Изменено

`meta.json` 28→29, `arch.json` construction_tests, `lint.py` L257 скан src + eslint-токены, `attack.py` overlay `viem` + L256/L257 в конструкции порта, `eslint.config.js` ban viem/ethers/web3 вне `src/rpc`, `package.json` protocol+vitest+contentpack(dev), `vitest.workspace.ts`, `docs/CONTENT.md` §5 байты.

## 3. Решения

- Src порта не импортирует contentpack (`allowed_deps` = protocol). TTL/ключи — аргумент хоста, в тесте из пака.
- Адреса launch не копируются; rpc C10.
- Повтор nonce → `API_INTENT_REPLAY`. Истечение и mint без deposit → `API_MALFORMED`.
- Имена RPC-модулей в lint и eslint (как L271). **не R-C новый канон.**

## 4. Инертность

Круг 14.47% / 11.67%. Касса: mock минтит Capital только после deposit, курс задаёт хост.
