# P3 — пробы и поимки

Новые правила **L320**, **L321**. L277/L297–L301/L303/L305 не ослаблены.

Пак: **583 491** байт, хеш **`eb97948f355c0f807c73760de03a4486fcba54d35052bd515072db663be5f2d9`**, `pack_version` **66**, `rules_version` **0.20.0**.

## L320

| что ловит | вход падения | поимка |
|---|---|---|
| голый `transfer` | снят `require` с `returnUnsettled` | `PrizeTreasury.sol ERC-20 call without require` |
| кредит запросом | `unsliced += amount` | `deposit credits amount instead of the measured delta` |
| `decimals == 18` у стока | `require(decimals() == 18)` в казне | `PrizeTreasury.sol assumes decimals = 18` |
| `got` с запроса | `got = amount` при неиспользуемой дельте | `does not assign got from the measured delta` |
| `got` переписан | `got = afterBal - before; got = amount` | `reassigns got from amount` |
| кредит `+ amount` | `unsliced = unsliced + amount` | `adds amount into the credit path` |

Последние два входа найдены адверсариальным проходом этого шага и закрыты тем же правилом.

## L321

| что ловит | вход падения | поимка |
|---|---|---|
| открытая critical + непустой `deployed` | `ghost_critical` + `deployed.token` | `open critical ghost_critical with deployed token` |
| `closed_code` без пробы | снят `construction` | `closed_code has no construction name` |
| нет `status` | снят `status` | `has no status` |

Открытая critical при **пустом** `deployed` L321 не красит: красный вход плана — оба сразу (`A-P-1`). Сейчас открытых critical ноль.

## Конструкции `contract_audit.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `erc20_return_value_checked` | голый `transfer`; `decimals() == 18` | L320; vitest сажает ту же строку |
| `balance_delta_accounting` | `+= amount`; `got = amount`; overwrite; `+ amount` | L320 |
| `audit_findings_closed` | critical+`deployed`; `closed_code` без пробы; нет статуса | L321 |

Vitest: три `it()` = три имени. Python CONSTRUCTION 235 (+3 к P2).

## Forge (`contracts/test/P3.t.sol`)

`test_total_backing_le_vault_balance`, `test_guardian_cannot_slice_or_refund`, `test_fee_on_transfer_credits_delta` (1000→900), `test_stake_fee_credits_delta` (100→90), `test_deposit_zero_and_empty_slice`, `test_claim_after_return_unsettled`, `test_pause_blocks_claim_and_deposit`, `testFuzz_depositGot`. Вместе с M5/L7: **15** тестов, 256 fuzz.
