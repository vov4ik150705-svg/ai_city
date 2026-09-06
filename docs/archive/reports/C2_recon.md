# C2 — разведка

Вход: C1 закрыт. Пак **26**, `rules_version` **0.17.0**, хеш **`c5a6fc304d2aded494366459ef7578681dec19aaddb231a75923bf8e9277b26d`**, 481391 канонических байт, lint **272/0**.

## 1. Что уже есть

- GEN в `packages/protocol/src`: codes, screens, modifier_keys, districts, buildings, units, versions, routes, channels. `index.ts` пустой `export {}`.
- `packages/contentpack/src/index.ts` — заглушка. Gate обоих пакетов — только `tsc --noEmit`.
- `protocol_loader.construction_tests` — `[]`. Заполнение меняет пак → `pack_version` 26→27.
- Семь артефактов «T12: codegen» в protocol/src плюс routes/channels (C0). Правка любого GEN роняет `codegen.py --check` (C0 `codegen_check_catches_hand_edit`).
- `pack["hash"] = pack_hash(pack)` считается **до** вставки поля `hash`. Сверка: `sha256(canonical(pack без hash)) === pack.hash`. `canonical(pack с hash) === content/out/pack.json`.
- Пересчёт на диске: **57** JSON-целых > `2**53`, **0** float, **60** `null` (в т.ч. `generated.arch.layer_cycle`, `generated.screens.blocking_code.*`). `worst_numerator` — десятичная строка. D-C-6 запрещает `null` в layout v1; пак — нет. Парсер пака принимает `null`.
- Слои: contentpack → protocol только. Engine импортировать нельзя (cruiser `packages/contentpack/src`). Канонизация и sha256 копируются в contentpack (**R-C-13**).
- Коды загрузчика: не заводить новых. `API_MALFORMED` (float, `-0`, `NaN`, дубликат, усечение), `API_PACK_STALE` (хеш, неизвестный GET).
- `GET /pack/{pack_hash}` — хелпер в contentpack, HTTP-хост в C3. `Cache-Control` из `path_rules.pack.cache = immutable`, без `max-age` литерала.
- L268: шесть имён `it()` ровно один раз на репозиторий. C3 не повторяет `pack_hash_mismatch_halts`.
- L267: `@corporator/protocol` = `workspace:*` требует строку toolchain и расширение `arch_toolchain_row.version` (`workspace:*` не semver).

## 2. Чего нет

Потокового bigint-парсера, реестра по хешу, сверки closed, отдачи секций, vitest contentpack, реэкспорта GEN, шести конструкционных имён.

## 3. ТЗ на шаг

1. Пак 27: `protocol_loader.construction_tests` = шесть имён PLAN_CODE §4 C2; `path_rules.pack.cache`; toolchain `@corporator/protocol`; schema version pattern.
2. `packages/protocol/src/index.ts` реэкспорт GEN. Gate protocol = tsc.
3. `packages/contentpack`: парсер, canonical+sha256, `loadPack`, реестр, `getPack`. Gate = tsc + vitest.
4. Тесты с именами 1:1. Негатив: `1.0`, `1e3`, `-0`, `NaN`, дубликат, усечение — код, не значение.
5. `codegen.py` после build (баннер хеша 27). Векторы пересобрать: header несёт `pack_hash`.
6. Не делать: C3 api, Solidity, RPC, CID.

Критерий готовности — командами плана §4 C2 плюс `lint.py` / `vectors.py` / attack затронутых правил.
