# L7 — правила и пробы

| id | что ловит | вход падения |
|---|---|---|
| L277 | не 4 src `.sol` под `port.groups`; `Bank.sol`; nested `src/lib`; часы банка; `setCreatorTax*`; налог в `_move`; solc ≠ toolchain | `Bank.sol`; `Pool.sol`; `lib/Ghost.sol`; `weekday()` в Vault; `setCreatorTaxBps`; `creatorTaxBps` в `_move`; `solc_version = "0.8.0"` |
| `vault_deposit_then_mint` | mintCapital без pending; `Bank.sol` обходит L277 | overlay `Bank.sol` → L277; forge `test_vault_deposit_then_mint` |
| `bank_not_onchain` | идентификаторы часов банка в src | `weekday()` в Vault.sol → L277 |

Атаки L277: `a_l277_bank_sol`, `a_l277_fifth_sol`, `a_l277_bank_hours`, `a_l277_tax_setter`, `a_l277_solc_drift`, `a_l277_nested_sol`, `a_l277_tax_on_transfer`.

Красный прогон forge: неверный адрес HEVM (`keccak256("hevm cheatcode")` ≠ `0x7109…`) → `setUp` revert; закрыто каноническим адресом.
