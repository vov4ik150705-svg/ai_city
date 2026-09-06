# L7 — разведка

Solidity четырёх групп. Банк остаётся на сервере. L6 закрыт.

Вход: пак **42**, `rules_version` **0.18.0**, хеш **`c4d69e0eacdd2f66a8e97b0410598ba38b705d44c618002ee45921c0e261d16f`**, lint **276/0**, vitest **66/0**, attack **541/0**, PENDING **3**.

## Прочитано

PLAN_LIVE §4 L7, D-L-7, D-L-8, RK-L-10/11, R-L-6; DESIGN.md §2.1 / §2.2 / §2.3 / §10 / §10.1; ARCHITECTURE.md §6; `packages/chainport/src/port.ts` четыре группы; `mock.ts` депозит→pending→минт, ваучер одноразовый, TTL из `voucher_ttl_s`; C10 `rpc_parity_with_mock` на фикстурах включая `2**53+1`; `arch.port.groups` длина 4; `arch.roadmap.contracts.construction_tests` пустой; `arch.toolchain.kind` ∈ {runtime, package, database}; `.sol` в дереве нет; Foundry/Hardhat нет.

## Дерево до шага

- `AssetPort`: mock полный, rpc — кодек над транспортом, не `eth_*`.
- `$CORP` в проде деплоит фабрика pons (`DESIGN.md` §2.1); налога на перевод нет; `creatorTaxBps` живёт в пуле.
- Capital не ERC-20; в моке — mapping. Минт без pending → `API_MALFORMED`.
- Банк: часы и дневной лимит пула на сервере; контракт по §10.1 проверяет подпись, срок, лимит по адресу.
- `contracts` в `roadmap_order` есть; `it()` L7 нет; L268 пустой список не роняет, пока нет новых имён.

## ТЗ на шаг (не сокращать)

1. Каталог `contracts/` вне `packages/engine`. Четыре src-файла = четыре ключа `port.groups` (PascalCase). Пятый `.sol` в src и `Bank.sol` — L277.
2. Toolchain: Foundry, не Hardhat (Solidity-тесты рядом с `.sol`, viem не входит до L8, npm-стек ethers не тащить). `kind: tool` в схеме. `solc` пин — единственное число компилятора; `foundry.toml` из кодогена.
3. `CorpToken`: ERC-20 без сбора на перевод; `creatorTaxBps` immutable, сеттера нет. Локальный двойник фабричного токена.
4. `Vault`: deposit → pending; mintCapital только minter и только при pending>0; `capitalAmount <= pending * capital_anchor`; issueVoucher только signer; presentVoucher одноразовый nonce, TTL по `block.timestamp`. Часов банка нет.
5. `StakeRegistry`, `MerkleRoots`. Тестовый ERC-20 стока — в `test/`, не пятая группа.
6. Два `it()`: `vault_deposit_then_mint`, `bank_not_onchain`. Пара с `construction_tests` в одном заходе. `tests` строки `contracts` дополняются ими. `gate_cmd` = forge test + существующий `rpc_parity_with_mock`.
7. Пак **43**. `rules_version` 0.18.0 (формула генератора не менялась). Layout 1.
8. Паритет C10 против локальных контрактов — Foundry-прогон той же последовательности. TS `rpc_parity_with_mock` остаётся кодек↔mock (L8 — живой RPC).

## Риски

- RK-L-10 пятый контракт / банк ончейн — длина групп + L277 + grep часов.
- RK-L-11 RPC блокирует тик — L7 не вводит viem/`eth_*`.
- `nowS` в порте vs `block.timestamp` в контракте — назвать расхождением, формула TTL та же.
- Дневной лимит пула (`LAUNCH.md` §6) на чейн не копируется: это функция глубины, не константа. Ончейн — replay+TTL; лимит пула остаётся сервером.
- Foundry не в PATH на машине гейта — критерий падает честно.
