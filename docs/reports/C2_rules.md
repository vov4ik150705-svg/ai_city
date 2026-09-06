# C2 — пробы и поимки

Новых правил `L*` нет. Зона: `packages/contentpack/test/c2.test.ts`, L268 1:1 с `protocol_loader.construction_tests`, codegen cruiser workspace-имён.

Пак: **482547** байт, хеш **`961a17a3d3a0686e2e766d820cc72b48f4eed3c86a56ff2b6ca9b7714cd6718c`**, `pack_version` **27**, `rules_version` **0.17.0**.

Конструкции vitest (`protocol_loader.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `pack_hash_mismatch_halts` | сверка `digest !== stored` выключена | `loadPack` принял чужой `hash` |
| `record_fields_have_homes` | (здоровый) все поля record+header ∈ `generated.arch.record_field_homes` | vitest зелёный |
| `loader_rejects_float` | запрет `-0` снят | `parseJson("-0")` вернул `0n` |
| `loader_keeps_bigint` | (здоровый) 57 целых > `2**53`; `worst_numerator` через `BigInt(string)`; canonical(pack) === файл | зелёный |
| `loader_rejects_duplicate_key` | `if (key in obj) fail()` снят | `parseJson('{"a":1,"a":2}')` принял объект |
| `pack_by_hash_is_immutable` | `getPack` отдаёт `entry.bytes` без копии | мутация `body[0]` меняет реестр |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| один символ в шапке `packages/protocol/src/codes.ts` | `codegen.py --check` | `drift packages/protocol/src/codes.ts` |
| cruiser без `@corporator/protocol` в pathNot | layer-contentpack | 5 violations; закрыто в `emit_layer_cruiser` |
| `python content/attack.py --only L01,L207,L231,L232,L235,L247,L248,L266,L267,L268,L270,L272` | overlay | все OK |

Остаток, не дефект загрузчика: явную проверку `.`/`e`/`E` дублирует запрет хвоста (`1.0` без неё всё равно `API_MALFORMED` на `i !== n`). `-0` этой страховки не имеет — отдельная ветка, поймана красным прогоном.
