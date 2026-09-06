# M5 recon

M4 closed: pack 50, rules 0.19.0, lint 293/0. `launch.deployed` empty. `rules_version` stays.

## Canon (PLAN_MONEY §4 M5 through §15)

Two roadmap keys, one step: `prize_treasury` (`D-M-13`) and `vault_safety` (`D-M-14`). `owner_drain` is not a key. `arch.port.groups` 4 → 5; fifth `.sol` is the prize treasury, not a bank. `L287` is rewritten (groups length 5; vault/fund/reserve/fragments are not return sources). New rules `L297`–`L301`, `L303`. Codes: `PRIZE_UNSETTLED_RETURNED`, `PRIZE_CLAIM_UNCOVERED`. `pool_in` measured. `returnUnsettled` skips settled. `refundPlayer` ≤ `backingOf`; bot ≠ whole vault; recover skips own asset. Guardian ≠ signer; no `setSigner`; unpause after `pauseReadyAt`. Merkle `refundRoot` plus surgical `refundPlayer` (recommendation). HUD drain buttons are M6 (`L302`).

## Tree

`contracts/src` has four files. Vault has deposit/mint/voucher only. No `PrizeTreasury.sol`. `arch.custody` absent. `guardian`/`signer`/`pending_signer` absent. `construction_tests` of both keys empty. `PRIZE_UNSETTLED_RETURNED` / `PRIZE_CLAIM_UNCOVERED` absent. `port.groups` length 4. `L277` still forbids a fifth `.sol`.

## Open (do not invent)

`pauseReadyAt` delay value: pending owner; constructor takes delay, `require(delay > 0)`. Burn-reserve rescue form: pending owner; `refundPlayer` must not take basket 3.

## Not this stage

`L302`, HUD drain copy, `launchToken`, sixth `.sol`, proxy, `owner_drain`.
