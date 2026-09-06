# C10 — пробы и поимки

L257 дополнительно: `rpc/**` без `FEATURE_NOT_IN_V1`; engine src без `@corporator/chainport` / `createRpcPort` / `createMockPort`. Оверлеи `_chainport_source`, `_engine_source`. Новых `L*` нет.

Пак: **492042** байт, хеш **`8cc0f7a6149a0b11412ac4e1f90ec172cb1e481a714532a2aef13ddf7ae0d451`**, `pack_version` **35**.

Конструкции vitest (`chain_v1_1.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `rpc_parity_with_mock` | `layout` ждут `0n` | expected 0n, got 1n |
| `rpc_silence_is_open` | код ждут `FEATURE_NOT_IN_V1` | expected FEATURE_NOT_IN_V1, got SERVICE_DEGRADED |
| `stake_snapshot_is_recorded_input` | `layout_version` ждут `0n` | expected 0n, got 1n |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| overlay `FEATURE_NOT_IN_V1` в `rpc/index.ts` | L257 | rpc still stubs FEATURE_NOT_IN_V1 |
| overlay import chainport в `tick.ts` | L257 | engine imports chainport |
| overlay `import "viem"` в `mock.ts` | L257 | rpc module imported outside rpc/ |
| `voucher_signer.service=buyback` | L257 | voucher_signer lives on the buyback service |
| третья реализация `ws` | L256 | expected mock and rpc |
| `attestor.fail_mode=closed` | L246 | blocks the economy |
| JSON-число `"amount":1` при `status=ok` | vitest | SERVICE_DEGRADED |
| `"amount":"0x10"` | vitest | **нашлось**; `parseDec` /^[0-9]+$/ |
| `lyingTransport('{"ok":true}')` deposit/mint | vitest | ok=false; capital на другом mock = 0 |
| `createRpcPort` без транспорта | vitest | SERVICE_DEGRADED; `tick()` не throw |
| живой registry после freeze | vitest | header держит frozen, не live sum |

`S_min` не заводился: `district_stake_threshold` остаётся T2 (RPC 403).
