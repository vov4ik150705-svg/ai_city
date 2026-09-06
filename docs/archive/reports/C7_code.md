# C7 — журнал кода

Выкуп — транспорт ETH со сборов → покупка `$CORP` → депозит в vault → минт Capital в фонд. Строка ROADMAP `buyback`. Круг 14.47% / Trader 11.67%.

Пак: **487217** байт, хеш **`2b6b998541ef16b81ab45e7cb943682e4f321650e2197e93aefdc12bce924acb`**, `pack_version` **32**, `rules_version` **0.17.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `services/buyback/src/values.ts` | bigint-safe asObj/asBig/asText |
| `services/buyback/src/pack.ts` | BuybackPack через `arch.buyback_refs` |
| `services/buyback/src/policy.ts` | транш `mulBps`, min-batch, порядок меток, расписание |
| `services/buyback/src/step.ts` | `stepBuyback` от `city_time` |
| `services/buyback/src/store.ts` | in-memory `buyback_batches` |
| `services/buyback/src/vault.ts` | `depositThenMint` через AssetPort |
| `services/buyback/src/index.ts` | публичный API |
| `services/buyback/test/c7.test.ts` | три имени `buyback.construction_tests` |
| `services/buyback/vitest.config.ts` | timeout 60s |

## 2. Изменено

`meta.json` 31→32, `arch.json` `buyback.construction_tests` + `corporator_chainport`, `lint.py` L244 скан `services/buyback/src` (оверлей `_buyback_source`), `attack.py` литерал транша и метки mint-first, `eslint.config.js` Date/Math на buyback, `vitest.workspace.ts`, `docs/CONTENT.md` §5 байты и L244, векторы (pack_hash в заголовке).

## 3. Решения

- Транш только `mulBps` из engine. bps = spend_burn+fund+protocol. Числа выкупа — `buyback_refs` → launch.
- `buybackOrderOk` ≡ `arch.buyback_order_ok`. `applyStamp` дополнительно отказывает минт без депозита и при `mint <= deposit`.
- Сбор `< min_batch` → `planSend = 0`. Due только от `city_time` и cadence.
- Vault: mock C4; `buyback_executor` ≠ `voucher_signer`. RPC — C10.
- Три vitest-имени, без четвёртого (L268).

## 4. Инертность

Круг 14.47% / 11.67%. Тиковый `buyback()` не тронут. `blocks_tick=0`, `fail_mode=open`.
