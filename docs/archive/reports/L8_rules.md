# L8 — правила и пробы

| id | что ловит | вход падения |
|---|---|---|
| L278 | нет `eth_chainId`/`eth_call` в `rpc/live.ts`; `eth_*` вне `rpc/`; ключ 32 байт в клиенте | `net_version` вместо `eth_chainId`; нет `live.ts`; `eth_call` в `mock.ts`; `0x`+64 hex в `boot.ts` |
| `rpc_http_eth_methods` | живой транспорт шлёт внутренние `corp_token_*`; JSON-число проходит codec | poster с `result: Number(chainId)` → `SERVICE_DEGRADED`; тик после silent |
| `attestor_putroot_retries` | тихий `putRoot` роняет тик; outbox не ретраит | silent drain: rest=jobs, `SERVICE_DEGRADED`; `tick()` не throw; mock drain empties |
| `client_bundle_has_no_keys` | ключ в клиенте | overlay `boot.ts` с 32-байтным hex → L278 |

Атаки L278: `a_l278_no_eth_methods`, `a_l278_missing_live`, `a_l278_client_privkey`, `a_l278_eth_outside_rpc`.
