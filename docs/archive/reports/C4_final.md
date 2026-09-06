# C4 — итоговый отчёт шага

`packages/chainport`: две реализации AssetPort. rpc без живого RPC (C10). Neon не нужен.

Пак **29**, `rules_version` **0.17.0**, хеш **`810be5e54712266ae4404a772794fafc593df18f9e78a76bcd257bbd2d2a68b1`**, 485237 байт.

---

## 1. Что закрыто

- Реализаций ровно две; третья роняет L256.
- `import "viem"` вне `rpc/` роняет eslint и L257.
- TTL = `generated.api.voucher_ttl_s` = tick length; ключа в params нет (L258).
- Повтор nonce → `API_INTENT_REPLAY`; два одновременных present — ровно один ok.
- Ключи не в `apps/client` src/package.json. `client=0` в паке.
- rpc: `FEATURE_NOT_IN_V1`, spend none.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 29; круг 14.47% / Trader 11.67% |
| хеш | `810be5e54712266ae4404a772794fafc593df18f9e78a76bcd257bbd2d2a68b1` |
| байты | 485237 |
| `python content/lint.py` | **272/0**, PENDING 27 |
| `python content/vectors.py` | 20; sha256 `5c0434560dbb7a76539d17968b7b418cd3fc5d21730361532ee1f4f2fb551471` |
| `python content/codegen.py --check` | 12 match `810be5e54712266a` |
| `python content/attack.py --only L256,L257,L258` | все пойманы (L257 два входа) |
| `python content/attack.py --construction-only` | **145/0** |
| `pnpm --filter @corporator/chainport run gate` | tsc; vitest **2/0** |
| `pnpm -w run gate` | tsc-b + eslint + depcruise **202/0**; vitest **35/0** |

## 3. Конструкционные пробы C4

`port_two_implementations`, `voucher_single_use`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-6 | CID | C8 |
| R-C-11 | engine magic-numbers off | C1 |
| R-C-13 | canonical копия в contentpack | C2 |
| R-C-14 | C2-имена не дублировать | C3 |
| R-C-15 | PGlite не Neon | C3 |
| R-C-16 | список RPC-модулей в lint.py и eslint (как L271) | **принято** |

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| третья impl `ws` | L256 | поймано | держит |
| `import "viem"` в mock.ts | eslint+L257 | оба | не декорация |
| viem в overlay, eslint токены на месте | только import | `imported in mock.ts` | скан файлов живой |
| voucher_signer на buyback | L257 | поймано | ключи |
| TTL как param | L258 | поймано | derived |
| mint до deposit | отказ | `API_MALFORMED` | I1 в mock |
| nonce дважды / Promise.all | один эффект | replay / wins=1 | одноразовость |
| nowS > issued+ttl | отказ | `API_MALFORMED` | TTL |
| rpc present | stub, mock цел | FEATURE_NOT_IN_V1 | RK-9 заглушка |

Выжившее: живой RPC и адреса launch — C10. Бандл клиента — C5 (`client_sees_no_chainport`).

## 6. Незакрытое

C5: клиент на mock-порте. C10: rpc parity. CID — C8.

Next: C5 — client_on_mock.
