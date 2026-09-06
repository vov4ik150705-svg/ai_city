# P3 recon

P2 closed: pack 65, hash `c9ca4e391ece88390ff9b4e1e74f3f2c4ea64035106708a3e515a179df0138b6`, lint 319/0, constructions 232. `launch.deployed` all empty. `rules_version` 0.20.0. Watermark 19.

## Tree

Five src contracts, two `.t.sol` (M5, L7), `PlayerReady.s.sol` reads `CORPORATOR_UNPAUSE_DELAY` from env. No `docs/AUDIT.md`. `contract_audit.construction_tests` empty; `tests` omit L320/L321.

PrizeTreasury/Vault/StakeRegistry already `require` ERC-20 return values. Deposit and stake credit the **requested** amount, not `balanceOf` delta (`A-P-10`). No `decimals() == 18` on stock paths. CorpToken declares its own `decimals = 18`. No `tx.origin`, no `delegatecall`, no proxy. CEI on claim/return (zero storage, then transfer). Deposit pulls then credits.

`pause_ready_delay`, guardian, signer stay owner PENDING. Constructor already `unpauseDelay_ > 0`. Do not invent seconds or addresses.

This machine had no `forge` at P2 close. P3 found Foundry 1.8.1 at `%USERPROFILE%\.foundry\bin\forge.exe`; `forge test --root contracts` is now a shown count.

## Risks

Fee-on-transfer inflates unsliced (`A-P-10`). `decimals = 18` on stocks (`A-P-11`). Bare `transfer` (`L320` red). Open critical plus nonempty `deployed` (`L321`, `A-P-1`). Audit fix adding proxy/`delegatecall`/arbitrary `call` (`A-P-21`). Inventing `pause_ready_delay` (`§9`).
