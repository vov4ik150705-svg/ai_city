# M5 code

Пак 51, `rules_version` 0.19.0 не двигался. Два ключа roadmap в одном шаге: `prize_treasury` (`D-M-13`) и `vault_safety` (`D-M-14`). Ключ `owner_drain` не заводился.

## Контракты

`contracts/src/PrizeTreasury.sol` — пятая группа: котлы 0=farm / 1=month, `deposit` ботом, `slice` подписантом, `returnUnsettled` на паузе шлёт unsliced боту, `owed` не трогает, `claimPrize` `require(!paused)`, `recoverWrongToken` кроме шести стоков.

`Vault.sol` — `guardian` immutable ≠ `signer`; `proposeSigner`/`acceptSigner`; `pauseReadyAt`; `refundPlayer` ≤ `backingOf`, Capital клип на `backing * capitalAnchor`; `refundRoot` + `claimRefund`; `recoverWrongToken` кроме `corp`. Нет `setSigner`, нет proxy.

## Оракул / рантайм

`content/treasury.py` / `packages/engine/src/treasury.ts`: `returnUnsettled`, `claimPrize` (пауза молчит, `pool_in` < owed → `PRIZE_CLAIM_UNCOVERED`), `refundPlayer` (потолок backing). Свидетель `arch.derived.treasury_safety_witness`.

## Пак

`arch.port.groups` = 5 (+ `prize_treasury`). `arch.custody`: kettles farm/month, `return_fn`=`returnUnsettled`, `depositor_key`=`buyback_executor`, `pool_in`=`measured`, `drain_forbidden` vault/fund/reserve/fragments, `refund_fn`=`refundPlayer`, `refund_root`=1. Ключи `guardian`, `signer`, `pending_signer`. Таблица `prize_returns`. Коды `PRIZE_UNSETTLED_RETURNED`, `PRIZE_CLAIM_UNCOVERED`. PENDING: `pause_ready_delay`, `burn_reserve_rescue`.

Кодоген переписан командой. DDL `prize_returns` в `001_from_pack.sql`.
