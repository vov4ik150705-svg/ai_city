# L8 — разведка

Живой RPC. Молчание открыто. Тик не ждёт. L7 закрыт.

Вход: пак **43**, `rules_version` **0.18.0**, хеш **`14003957f3d9593543e07777250e3980a491ab0ec529767289f4ad2e5e027a10`**, lint **277/0**, vitest **68/0**, attack **550/0**, PENDING **3**.

## Прочитано

PLAN_LIVE §4 L8, D-L-7, RK-L-9/11, R-L-6; DESIGN.md §6.4 / §10; ARCHITECTURE.md §6; LAUNCH.md §1 (RPC, chain id); L246, L257; `packages/chainport/src/rpc/{index,codec,fixture}.ts`; C10 `rpc_silence_is_open` / `rpc_parity_with_mock`; attestor `stepAttestor` outbox CID, `submitMinuteRoot` fail-open; `arch.roadmap.rpc_live.construction_tests` пустой; viem в toolchain нет; `createRpcPort` без транспорта = `silentTransport`; внутренние методы `corp_token_*`, не `eth_call`.

## Дерево до шага

- Кодек отвергает JSON-число и `0x` в amount. Тик не импортирует chainport.
- `wallet.chain` / `wallet.corp_balance` — канал `price`. Ключи `client: 0`.
- Attestor при `publish.rpc=false` копит CID, `putRoot` не ретраит.
- Адреса контрактов в паке нет (L9). URL и chain id — снимок фида `districts.stake.snapshot`.
- `rpc_silence_is_open` и `attestor_down_pay_continues` уже заняты L268 (C10 / C8). Новые `it()` — новые имена.

## ТЗ на шаг (не сокращать)

1. `packages/chainport/src/rpc/live.ts`: POST `eth_chainId` / `eth_call` / `eth_sendTransaction`. viem только здесь. Тишина и JSON-число → `SERVICE_DEGRADED`. URL и chain id с аргумента из пака, не второй литерал.
2. Toolchain `viem` 2.56.0, `kind: package`. Манифест chainport. Адреса контрактов — аргумент рантайма, не `launch.deployed` до L9.
3. Attestor: `rootJobs` + `drainRootOutbox`; повтор `putRoot`; `tick()` после тихого drain.
4. Три `it()` = `construction_tests`: `rpc_http_eth_methods`, `attestor_putroot_retries`, `client_bundle_has_no_keys`. L278.
5. Пак **44**. `rules_version` 0.18.0. Layout 1.
6. Гейт этапа: `attack --only L246,L257,L278` и существующий `-t rpc_silence_is_open`.

## Риски

- RK-L-11 RPC блокирует тик — default silent, catch, fail_mode open.
- R-L-6 закрывается транспортом `eth_*` на инъецированном HTTP; живой Robinhood в CI не обязателен.
- Подпись `eth_sendRawTransaction` и адреса `launch.deployed` — L9.
