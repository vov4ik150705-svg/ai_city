# C8 — разведка

Дерево, корни и CID суток локально, fail-open, без чейна. Строка ROADMAP `attestor_no_chain`. Зависит от C1, C3. Live root — C10/C11.

## Прочитано

PLAN_CODE §4 C8, D-C-5, D-C-10, R-C-6, RK-2, RK-11; TICK.md §9; DESIGN.md §6.2/§6.4; L201–L207, L246, L268, L269; record.py merkle; engine `merkleRoot`/`sha256`; vectors `merkle_shapes`; C2 `pack_hash_mismatch_halts`; C7_final.

## Дерево до шага

`services/attestor/src/index.ts` = `export {}`. Gate = `tsc --noEmit`. `construction_tests` пустые. `VECTOR_DEFERRED = cid_city_day`. PENDING `cid_city_day_codec` owner C8.

## Решения

- Merkle только `merkleRoot` из engine (как TWAP в C6). L203 сканирует attestor src.
- CID: CIDv1 raw sha2-256 канонических байт `{city_day, city_id, root}`; коды — `attest.params.cid_*`. Оракул `content/cid.py` + вектор `cid_city_day`.
- `pack_hash_mismatch_halts` уже C2 (L268 1:1). C8 держит L207 и вызов tick в `attestor_down_pay_continues`. **R-C-20.**
- Vitest: `attestor_down_pay_continues`, `cid_matches_oracle`. Шаг чистый: `wall_s` инъекция, не `Date`.
- IPFS/RPC = флаги; outbox + `attest_lag_ticks`; `SERVICE_DEGRADED` при пороге пака. Тик не импортируется.

## Риски

RK-2 (CID/keccak drift), RK-11 (блок выплаты), RK-1 (canonical).
