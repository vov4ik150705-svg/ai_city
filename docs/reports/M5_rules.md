# M5 rules

| id | ловит | вход падения |
|---|---|---|
| L256/L277 | группы и `.sol` = пять ключей; `Bank.sol` и лишний `Pool.sol` | `Pool.sol`; `Bank.sol`; `weekday()` |
| L287 | не пять групп; vault/фонд/резерв/фрагменты в возврате; нет казны/таблицы | `drain_forbidden` без vault |
| L288 | `pool_in` не measured; нет записи/кода возврата | `pool_in=accumulated`; снят `PRIZE_UNSETTLED_RETURNED` |
| L289 | клейм при пустом `pool_in` без `PRIZE_CLAIM_UNCOVERED` | снят код |
| L297 | шестая группа; `refundPlayer` на казне; proxy | `groups.pool`; `refundPlayer` в `PrizeTreasury`; `delegatecall` |
| L298 | возврат ест settled; клейм на паузе | `treasury_return_settled`; `treasury_claim_when_paused` |
| L299 | рефанд без `amount <= backing` | снят `require(amount <= backing)` |
| L300 | `setSigner`; страж = подписант | дописан `setSigner`; снят `guardian_ != signer_` |
| L301 | recover своего `$CORP` | снят `token != address(corp)` |
| L303 | рефанд бота по `balanceOf(vault)` | `_refund` читает `corp.balanceOf(this)` |

## Construction (имена = `it()`)

| имя | зелёный | красный |
|---|---|---|
| `vault_and_fund_not_drainable` | forbidden = vault/fund/reserve/fragments | vault убран из forbidden → L287 |
| `return_unsettled_skips_settled` | owed 700 после возврата 300 | eat_settled → L298 |
| `pool_in_is_measured_not_accumulated` | `pool_in=measured` | accumulated → L288 |
| `settled_claim_uncovered_is_reported` | код UNCOVERED, paid 0 | код снят → L289 |
| `refund_player_capped_by_backing` | amount > backing rejected | cap снят → L299 |
| `bot_refund_not_whole_vault` | bot amount=vault rejected | cap = balanceOf → L303 |
| `guardian_not_signer` | ключи guardian/signer/pending | `setSigner` → L300 |
| `recover_wrong_token_skips_own` | recover своего актива закрыт | require corp снят → L301 |
