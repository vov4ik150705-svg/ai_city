# C10 — разведка

Живой RPC и живой корень без сдвига layout v1. Строка ROADMAP `chain_v1_1`. Зависит от C4, C8, C9.

## Прочитано

PLAN_CODE §4 C10, D-C-11, RK-9, RK-2, RK-7; DESIGN.md §10–§11; TICK.md §9, §13; ARCHITECTURE.md §6, §10 `R-T12-9`; LAUNCH.md RPC; L200 L204 L205 L246 L256 L257 L266 L268; arch.port.groups / rpc_import_only; C4 stub `FEATURE_NOT_IN_V1`; C8 `stepAttestor` флаги без putRoot; C9_final.

## Дерево до шага

`packages/chainport/src/rpc/index.ts` — все методы `stubErr`. `chain_v1_1.construction_tests` пустые. Attestor/sampler `allowed_deps` включают chainport, в `package.json` его нет. `wallet.chain` / `wallet.corp_balance` в канале `price`, producer нет. `stake_snapshot` — поле заголовка, тик порт не зовёт. Solidity нет (`PLAN_CODE` §8). `S_min` остаётся pending (RPC 403).

## Решения

- Три новых `it()`: `rpc_parity_with_mock`, `rpc_silence_is_open`, `stake_snapshot_is_recorded_input`. `layout_v1_bytes` остаётся C1. **не дублировать.**
- `rpc` — кодек JSON поверх инжектируемого транспорта; фикстура = второй `mock`. Без viem (контрактов нет). Молчание / ложь → `SERVICE_DEGRADED`, не throw.
- Корень: `putRoot` hex из `merkleRoot` engine = локальный аттестатор. `submitMinuteRoot` снаружи тика.
- `stake_snapshot` замораживается до `tick()`. `wallet.*` читаются портом, живут в `price`, во вход тика не входят.
- L257 плюс: rpc без `FEATURE_NOT_IN_V1`; engine src без chainport.

## Риски

RK-9 ложь RPC, RK-2 байты корня, RK-7 время не из клиента. `S_min` не выдумывается.
