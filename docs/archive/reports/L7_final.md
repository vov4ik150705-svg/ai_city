# L7 — итоговый отчёт шага

Solidity четырёх групп под `AssetPort`. Банк остаётся на сервере. `R-L-6` (живой RPC) остаётся L8. `R-L-20`: TTL в контракте — `block.timestamp`; дневной лимит доли пула — сервер.

Пак **43**, `rules_version` **0.18.0**, хеш **`14003957f3d9593543e07777250e3980a491ab0ec529767289f4ad2e5e027a10`**, 516809 байт.

## 1. Что закрыто

- Четыре src `.sol` = `port.groups`. Foundry 1.8.1, solc 0.8.28 из toolchain. `kind: tool`.
- `creatorTaxBps` immutable, сеттера нет, `transfer` без сбора. Минт Capital только после pending-депозита и ≤ `pending × capital_anchor`. Ваучер одноразовый.
- C10-последовательность на локальных контрактах (Foundry). TS `rpc_parity_with_mock` — кодек↔mock.
- L277 + `vault_deposit_then_mint` + `bank_not_onchain`. Часов банка в src нет.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0; pack 43; круг **14.47%** / Trader **11.67%** |
| хеш пака | `14003957f3d9593543e07777250e3980a491ab0ec529767289f4ad2e5e027a10` |
| канонические байты | 516809 |
| `python content/lint.py` | **277/0**, PENDING **3** |
| `python content/vectors.py` | 21; sha256 `30e4e26ff58e3a9316c15443dd6ff322b59ccfed9f2305242c3b3724cc332564` |
| `python content/codegen.py --check` | 19 match `14003957f3d95935` |
| tsc -b / eslint | ok |
| depcruise | **430/0** |
| vitest run | **68/0** |
| `forge test --root contracts` | **4/0** |
| `python content/attack.py --only L277 --jobs 1` | **7/0** |
| `python content/attack.py --jobs 8` | **550/0**, construction **165/0**, 277 covered, 856.2s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |

Касса: минт Capital только через депозит $CORP в vault. Круг и sim не сдвинулись. Новая toolchain-запись: Foundry/solc, не npm.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `Bank.sol` в src | L277 | fifth mechanic | OK |
| `Pool.sol` пятый | L277 | extra src | OK |
| `weekday()` в Vault | L277 | bank hours | OK |
| `setCreatorTaxBps` | L277 | setter after deploy | OK |
| `solc_version = 0.8.0` | L277 | pin drift | OK |
| `src/lib/Ghost.sol` | L277 | nested src | **нашлось**, закрыто rglob |
| `creatorTaxBps` в `_move` | L277 | tax on transfer | **нашлось**, закрыто count>2 |
| mint без pending | revert | forge PASS | OK |
| ваучер повтор | revert | forge PASS | OK |
| transfer 100 → 100 | без сбора | forge PASS | OK |
| mint > pending×anchor | revert | forge PASS | OK |
| keccak HEVM address | cheatcode | setUp revert | **нашлось**, адрес `0x7109…` |
| `nowS` порта vs `block.timestamp` | формула TTL та же | контракт на штампе блока | R-L-20 |
| дневной лимит доли пула ончейн | не копировать | сервер | R-L-20 |
| viem / `eth_*` | L8 | нет | не L7 |

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-6 | rpc паритетен mock, чейна нет | L8 |
| R-L-20 | контракт: nonce+TTL по `block.timestamp`; лимит доли пула и часы банка — сервер | принято; `DESIGN.md` §10.1 уточнён |
| R-L-19 | LLM точка без счёта | принято (L6) |

## 5. Незакрытое

PENDING 3: `companion_llm_price_snapshot` (owner, R-L-19), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3). Живой `eth_*` — L8. Foundry должен быть в `PATH` или `%USERPROFILE%\.foundry\bin`.

Next Step: **L8** — живой RPC.
