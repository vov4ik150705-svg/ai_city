# Аудит пяти контрактов (P3)

Внутренний проход до подписи `launchToken`. Канон: `docs/archive/plans/PLAN_RELEASE.md` P3, `docs/archive/plans/PLAN_MONEY.md` §15, `DESIGN.md` §10. Таблица статусов в паке (`arch.audit.findings`) — источник для `L321`. Здесь — разбор. Адреса стража и подписанта не выдумываются (`§9`). `pause` / `unpause` / `unpauseDelay` сняты со скоупа production-контрактов.

Статический проход по `contracts/src`: нет `tx.origin`, нет `delegatecall` / proxy, нет `selfdestruct`, нет `.call(` на произвольный адрес. CEI на `claimPrize` / `returnUnsettled` / `_refund`: сначала слот, потом `transfer`. Solidity 0.8.28, роли задаются в конструкторе.

Чеклист токенов: шесть стоков + `$CORP`. Учёт входа по разнице `balanceOf`. Результат `transfer`/`transferFrom` внутри `require`. `decimals` стока не предполагается равным 18. Нулевой `transferFrom` отвергается (`amount > 0`). Пауза/чёрный список эмитента — свойство бумаги, не конструктора казны. Наши контракты не держат `paused`. `issueVoucher` резервирует `backingOf`; `presentVoucher` снимает резерв; просроченный ваучер освобождает его через `releaseExpiredVoucher`. Рефанд и ваучер не тратят одно покрытие дважды. `StakeRegistry.unstake` — держатель, без одобрения owner.

`forge test --root contracts` — инварианты backing, `returnUnsettled`, страж не подписант, fee-on-transfer, границы.

## Находки

### prize_deposit_requested_amount

Серьёзность high. Статус closed_code. Проба `balance_delta_accounting`.

`PrizeTreasury.deposit` кредитовал запрошенную сумму. Сток с комиссией на переводе раздувал `unsliced`; нарезка обещала больше, чем пришло (`A-P-10`). Закрыто: `got = afterBal - before`.

### stake_credits_requested_amount

Серьёзность high. Статус closed_code. Проба `balance_delta_accounting`.

Та же ошибка в `StakeRegistry.stake`. Снимок тика читал бы завышенный стейк. Закрыто той же формулой.

### vault_deposit_requested_amount

Серьёзность high. Статус closed_code. Проба `balance_delta_accounting`.

`Vault.deposit` кредитовал запрошенный `$CORP` в `pending`. Теперь `pending` растёт на измеренную дельту.

### bare_erc20_transfer

Серьёзность high. Статус closed_code. Проба `erc20_return_value_checked`.

Голый `transfer` без проверки результата. Все вызовы в казне, vault и стейке внутри `require`. Красный вход `L320`: снять `require` с `PrizeTreasury.returnUnsettled`.

### stock_decimals_eighteen

Серьёзность high. Статус closed_code. Проба `erc20_return_value_checked`.

Предположение `decimals() == 18` у стоков (`A-P-11`). В `PrizeTreasury` и `StakeRegistry` его нет; атомы кредитуются как пришли. `CorpToken.decimals = 18` — наш токен, не сток.

### deployed_blocks_open_critical

Серьёзность note. Статус closed_code. Проба `audit_findings_closed`.

Открытая критическая находка при непустом `launch.deployed` запрещена (`A-P-1`). Сейчас `deployed` пуст и открытых critical нет.

### constructor_unpause_delay

Серьёзность note. Статус accepted.

Находка устарела: `pause` / `unpause` / `paused` / `unpauseDelay` / `pauseReadyAt` сняты со скоупа. Конструкторы Vault и PrizeTreasury не принимают задержку. `pause_ready_delay` убран из `pending.json` — это не UNKNOWN-секунды. `CORPORATOR_UNPAUSE_DELAY` скрипт не читает. Секунды и адреса не выдуманы. Рефанд, `setRefundRoot`, `claimRefund` и `returnUnsettled` остаются под своими ролями без precondition `paused`.

### constructor_guardian_signer

Серьёзность medium. Статус accepted.

`guardian != signer` уже в конструкторе (`L300`). Адреса читает `PlayerReady` из env. В пак не записываются до P7.

### no_reentrancy_guard

Серьёзность note. Статус accepted.

Депозит: pull, потом кредит. Стоки Robinhood — ERC-20 без хуков. ReentrancyGuard — новый паттерн, не из списка починки Rev-A.

### usdt_void_return

Серьёзность low. Статус accepted.

Callers требуют `returns (bool)`. Низкоуровневый `call` на произвольный адрес запрещён (`A-P-21`).

### outbound_token_fee

Серьёзность note. Статус accepted.

Исходящие `claimPrize` / `returnUnsettled` / `_refund` отправляют owed/unsliced/backing и проверяют результат. Налог эмитента на исходящем переводе — не вторая касса.

### external_audit_vendor

Серьёзность note. Статус accepted.

Подрядчик и бюджет внешнего аудита — владелец. Календарное ожидание не блокирует P4. Открытых critical нет.

### tx_origin_delegatecall_absent

Серьёзность note. Статус accepted.

В `src` нет `tx.origin`, `delegatecall`, proxy. Починка не добавляет их (`A-P-21`, `L297`).

## Заморозка конструкторов

Форма: `guardian`, `signer`, адрес `$CORP`, шесть стоков. Значения адресов — env на P7, не литералы пака. `unpauseDelay` больше не аргумент.
