# C10 — журнал кода

Живой RPC-кодек и живой корень без сдвига layout v1. Строка ROADMAP `chain_v1_1`. Круг 14.47% / Trader 11.67%.

Пак: **492042** байт, хеш **`8cc0f7a6149a0b11412ac4e1f90ec172cb1e481a714532a2aef13ddf7ae0d451`**, `pack_version` **35**, `rules_version` **0.17.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/chainport/src/rpc/codec.ts` | JSON-кодек; суммы — десятичные строки; JSON-число и `0x` → `SERVICE_DEGRADED` |
| `packages/chainport/src/rpc/fixture.ts` | `transportFromPort` / `lyingTransport` / `transportFromPost`; без `fetch` |
| `packages/chainport/src/wallet.ts` | `recordedStakeSnapshot`, `readWalletPrice` (канал `price`) |
| `packages/chainport/src/submit.ts` | `submitMinuteRoot`; throw → `SERVICE_DEGRADED` |
| `packages/chainport/test/c10.test.ts` | `rpc_parity_with_mock`, `rpc_silence_is_open`, `stake_snapshot_is_recorded_input` |
| `services/attestor/src/submit.ts` | hex из `bytesToHex` + `putRoot` |
| `services/sampler/src/wallet.ts` | `stepWalletPrice` снаружи тика |

## 2. Изменено

`meta.json` 34→35; `arch.json` `chain_v1_1.construction_tests`; `lint.py` L257 (rpc live, engine без chainport); `attack.py` две атаки + три construction; `c4.test.ts` молчание = `SERVICE_DEGRADED`; `values.ts` транспорт; `rpc/index.ts` четыре группы; attestor/sampler `package.json` + `@corporator/chainport`; `DESIGN.md` §6.4; `docs/TICK.md` §9; `docs/ARCHITECTURE.md` §6 / R-T12-9; `docs/CONTENT.md` L257 и байты; `pending.json` S_min остаётся owner.

## 3. Решения

- Три новых `it()`. `layout_v1_bytes` остаётся C1. **не дублировать.**
- `rpc` — кодек над инжектируемым транспортом. Фикстура = второй `mock`. Без viem.
- Молчание / ложь / JSON-число / hex-сумма → `SERVICE_DEGRADED`. Тик не ждёт и не минтит.
- `stake_snapshot` замораживается до `tick()`. `wallet.chain` / `wallet.corp_balance` в `price`, в заголовок не входят.

## 4. Инертность

Круг 14.47% / 11.67%. Engine не импортирует chainport. Касса и фонд не тронуты. `S_min` не выдуман.
