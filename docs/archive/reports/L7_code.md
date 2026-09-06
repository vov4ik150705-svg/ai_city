# L7 — журнал кода

Четыре тупых контракта под `AssetPort`. Банк на сервере. Строка ROADMAP `contracts`. Круг 14.47% / Trader 11.67%.

Пак: **516809** байт, хеш **`14003957f3d9593543e07777250e3980a491ab0ec529767289f4ad2e5e027a10`**, `pack_version` **43**, `rules_version` **0.18.0**.

## 1. Создано

| путь | роль |
|---|---|
| `contracts/src/CorpToken.sol` | ERC-20 без сбора на перевод; `creatorTaxBps` immutable |
| `contracts/src/Vault.sol` | deposit → pending → mintCapital; ваучер одноразовый; TTL = `block.timestamp` |
| `contracts/src/StakeRegistry.sol` | стейк ERC-20 по тикеру; snapshot лексикографический |
| `contracts/src/MerkleRoots.sol` | putRoot / getRoot, только attestor |
| `contracts/test/L7.t.sol` | deposit-then-mint, C10-последовательность, налог не на transfer, TTL |
| `packages/chainport/test/l7.test.ts` | `vault_deposit_then_mint`, `bank_not_onchain` |
| `docs/reports/L7_*.md` | отчёты этапа |

Кодоген: `contracts/foundry.toml`, `contracts/test/PackConstants.sol` (tax, anchor, TTL из пака).

## 2. Изменено

`meta.json` 42→43; `arch.json` toolchain `foundry` 1.8.1 / `solc` 0.8.28 (`kind: tool`); `contracts.construction_tests`; `gate_cmd` = forge + rpc_parity; схема `arch_toolchain_row.kind` + `tool`; `lint.py` L277; `attack.py` шесть атак + две construction; `ARCHITECTURE.md` §6; `DESIGN.md` §10.1 (лимит пула не копируется в чейн); `CONTENT.md` L277.

## 3. Решения

- Foundry, не Hardhat: Solidity-тесты рядом с `.sol`, viem не входит до L8.
- Локальный `CorpToken` — двойник фабричного токена; налог в пуле, не в `transfer`.
- Каталог вне `packages/engine`. Четыре src-файла = четыре ключа групп. Тестовые хелперы в `test/`.
- Паритет C10 против контрактов — Foundry. TS `rpc_parity_with_mock` остаётся кодек↔mock.

## 4. Инертность

Круг 14.47% / 11.67%. `A_t2=14011`. Engine без `.sol` и без chainport. Касса: минт Capital только после pending-депозита и не выше `pending × capital_anchor`.
