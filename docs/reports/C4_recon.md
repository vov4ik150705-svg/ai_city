# C4 — разведка

Порт активов: две реализации, RPC только в `rpc`, ваучер одноразовый. Строка ROADMAP `port_mock`. Зависит от C2, не от C3. Neon / БД не трогаем.

## Прочитано

PLAN_CODE §4 C4, D12 (T12_tz), ARCHITECTURE §6, DESIGN.md §10–§10.1, API.md §6, GENERATED «T12: port», L256 L257 L258, C3_final (закрыт), arch.port / arch.keys, schema port additionalProperties false, chainport `export {}`.

## Дерево до шага

`packages/chainport/src/index.ts` = `export {}`. Gate = `tsc --noEmit`. `port_mock.construction_tests` пустые. `allowed_deps` = `protocol` (не contentpack).

## Решения

- Mock полный по четырём группам §10. Rpc — `FEATURE_NOT_IN_V1`, spend none, до C10.
- TTL и ключи читает тест из пака; src порта чисел не хранит. Адреса launch — C10.
- Повтор nonce → `API_INTENT_REPLAY`. Истечение / минт без депозита → `API_MALFORMED`.
- L257: скан `src` вне `rpc/` плюс токены в eslint (как L271). Список модулей `viem|ethers|web3` в lint и eslint.
- Клиент: grep `apps/client` на ключи и `@corporator/chainport` (бандла ещё нет).
- L268: ровно два `it()` = `port_two_implementations`, `voucher_single_use`.

## Риски этапа

RK-9 rpc-заглушка не блокирует тик (тик порт не зовёт). RK-10 I1: mint после deposit в mock.
