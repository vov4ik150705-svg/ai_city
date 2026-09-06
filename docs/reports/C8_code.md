# C8 — журнал кода

Дерево и CID суток локально, fail-open, без чейна. Строка ROADMAP `attestor_no_chain`. Круг 14.47% / Trader 11.67%.

Пак: **488352** байт, хеш **`781a85b4f7b1f1206faf52dde1fd322ae9a0bf4ea7cd52ae5edd3ad11cc2fe87`**, `pack_version` **33**, `rules_version` **0.17.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `content/cid.py` | оракул CIDv1: префикс из `attest.params.cid_*` + sha256 payload |
| `services/attestor/src/values.ts` | bigint-safe asObj/asBig/asText/byteOf |
| `services/attestor/src/pack.ts` | AttestorPack, city-day ключ, домены, период |
| `services/attestor/src/cid.ts` | `cidV1` через engine `sha256` |
| `services/attestor/src/tree.ts` | минута: `merkleRoot` из engine; CID `(city_id, city_day)` |
| `services/attestor/src/store.ts` | in-memory корни минуты и CID суток |
| `services/attestor/src/step.ts` | `stepAttestor(wall_s, flags)`; down → outbox + lag, без throw |
| `services/attestor/src/index.ts` | публичный API |
| `services/attestor/test/c8.test.ts` | `cid_matches_oracle`, `attestor_down_pay_continues` |
| `services/attestor/vitest.config.ts` | timeout 60s |

## 2. Изменено

`meta.json` 32→33; `attest.json` `cid_*`; `arch.json` `construction_tests` + `vector_classes.cid_city_day`; `pending.json` снят `cid_city_day_codec`; `arch.py` `VECTOR_AUTHORED_REQUIRED`; `vectors.py` класс `cid_city_day`; `build.py` `build_attest` сверяет `cid_mh_length` с `hashlib.sha256().digest_size`; `lint.py` L203 скан attestor, L269 включает `cid_city_day`; `attack.py` `a_l203_attestor_own_merkle`; `eslint.config.js` Date/Math и запрет `tick`/`catchUp`; `vitest.workspace.ts`; `pnpm-lock.yaml`; `DESIGN.md` §6.2; `docs/TICK.md` §9; `docs/CONTENT.md` §5 байты, L203, L269.

## 3. Решения

- Merkle только `merkleRoot`/`leafHash` из engine. L203 роняет второй `function merkleRoot` в attestor src.
- CID = байты `[cid_version, cid_codec, cid_mh_code, cid_mh_length]` + sha256 канонического `{city_day, city_id, root}`. Коды в паке, не литералы в src.
- IPFS/RPC — булевы флаги шага. Down: outbox, `lagTicks += 1`, `SERVICE_DEGRADED` при `attest_lag_alert_ticks`. `blocks_tick=0`, `fail_mode=open`.
- `pack_hash_mismatch_halts` остаётся C2 (L268 1:1). C8 вызывает `tick` внутри `attestor_down_pay_continues`. **R-C-20.**
- Два vitest-имени: `attestor_down_pay_continues`, `cid_matches_oracle`.

## 4. Инертность

Круг 14.47% / 11.67%. Тик не импортируется в attestor src. Касса и фонд не тронуты.
