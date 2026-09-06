# C2 — итоговый отчёт шага

Сгенерированный протокол и bigint-safe загрузчик пака по хешу. CID не делался (`R-C-6`). Solidity/RPC/C3 хост не делались.

Пак **27**, `rules_version` **0.17.0**, хеш **`961a17a3d3a0686e2e766d820cc72b48f4eed3c86a56ff2b6ca9b7714cd6718c`**, 482547 канонических байт.

---

## 1. Что закрыто

- `packages/protocol/src/index.ts` реэкспортирует GEN. `codegen --check` зелёный; правка одного символа GEN роняет `--check`.
- `packages/contentpack`: парсер, canonical+sha256, `loadPack` closed на `pack.hash`, реестр, `getPack` с `immutable`.
- Шесть имён `protocol_loader.construction_tests` = шесть `it()` в `c2.test.ts`. L268 1:1.
- 57 целых > `2**53` и строка `worst_numerator` переживают круг. `canonical(loaded) === pack.json`.
- Шесть негативов: `1.0`, `1e3`, `-0`, `NaN`, дубликат, усечение — `API_MALFORMED`. Чужой hash / неизвестный GET — `API_PACK_STALE`.
- Гейт плана §4 C2 зелёный командами.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; `pack_version` 27; круг 14.47% / Trader 11.67% |
| хеш пака | `961a17a3d3a0686e2e766d820cc72b48f4eed3c86a56ff2b6ca9b7714cd6718c` |
| канонические байты | 482547 |
| `python content/lint.py` | **272 правила, 0 ошибок**, PENDING 27 |
| `python content/vectors.py` | 20 файлов; sha256 `a573b7554fb22fd383fc2d6bd818454eba4108cc1b69d6c4169c07dc92f949c3` |
| `python content/codegen.py --check` | 12 артефактов match `961a17a3d3a0686e` |
| `pnpm --filter @corporator/protocol --filter @corporator/contentpack run gate` | protocol tsc ok; contentpack tsc + vitest **6/0** |
| `pnpm --filter @corporator/engine run gate` | vitest **13/0** |
| eslint contentpack/protocol index | 0 |
| depcruise `packages/contentpack/src` | 9 modules, 0 violations |
| `python content/attack.py --only L01,L207,L231,L232,L235,L247,L248,L266,L267,L268,L270,L272` | все атаки пойманы; 143 конструкции |

## 3. Конструкционные пробы C2 (имена дословно)

`pack_hash_mismatch_halts`, `record_fields_have_homes`, `loader_rejects_float`, `loader_keeps_bigint`, `loader_rejects_duplicate_key`, `pack_by_hash_is_immutable`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-5 | целые > 2^53 | **закрыто** `loader_keeps_bigint` (57 значений + строка `worst_numerator`) |
| R-C-6 | нет CID в оракуле | не в C2; PENDING C8 |
| R-C-11 | engine `no-magic-numbers` off | C1, не трогали |
| R-C-13 | canonical/sha256 скопированы в contentpack | принято: слой 1 не импортирует engine; паритет = recanonicalize байт пака |

Нового R-C кроме **R-C-13** нет. `bank_withdraw_rate_ceiling_only` остаётся owner T3.

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| сверка hash выключена | `pack_hash_mismatch_halts` ≠ | принял чужой hash | закрыто |
| дубликат ключа без `key in obj` | `loader_rejects_duplicate_key` ≠ | parse принял | закрыто; негатив через `parseJson` |
| `-0` без ветки | `loader_rejects_float` ≠ | вернул `0n` | закрыто |
| `getPack` без копии байт | `pack_by_hash_is_immutable` ≠ | `body[0]` уехал | закрыто |
| символ в GEN codes.ts | `--check` ≠ | drift | закрыто |
| cruiser pathNot только fs-пути | 0 violations | 5 errors на `@corporator/protocol` | закрыто в codegen |
| `{"a":1,"a":2}` через `loadPack` | дубликат | упал бы на no `hash` | закрыто: тест зовёт `parseJson` |
| `1.0` без проверки `.` | float | всё равно хвост `i !== n` | названо: ветка `.`/`e` не единственная |

Выжившее без исправления: engine test `jsonBigint` по-прежнему перезаписывает дубликаты (не прод, C1). HTTP `GET /pack` живой — C3.

## 6. Незакрытое

C3: `services/api` + БД, `GET /pack/{pack_hash}` на хосте, реплей. CID — C8. `bank_withdraw_rate_ceiling_only` — T3.

Next: C3 — host_db_replay.
