# C2 — журнал кода

Сгенерированный протокол и bigint-safe загрузчик пака. Экономические формулы не тронуты. Круг 14.47% / Trader 11.67%.

Пак после `python content/build.py`: **482547** канонических байт, хеш **`961a17a3d3a0686e2e766d820cc72b48f4eed3c86a56ff2b6ca9b7714cd6718c`**, `pack_version` **27**, `rules_version` **0.17.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/protocol/src/index.ts` | реэкспорт GEN (codes, screens, keys, districts, buildings, units, versions, routes, channels) |
| `packages/contentpack/src/parse.ts` | потоковый JSON: целое→bigint; float/`-0`/`NaN`/Infinity/дубликат/усечение → `API_MALFORMED` |
| `packages/contentpack/src/canonical.ts` | sort_keys, `,` `:`, `null` разрешён (пак содержит 60 null) |
| `packages/contentpack/src/sha256.ts` / `utf8.ts` | копия engine (слой contentpack не импортирует engine) |
| `packages/contentpack/src/load.ts` | `loadPack`: sha256(canonical без `hash`) === `pack.hash` иначе `API_PACK_STALE` |
| `packages/contentpack/src/registry.ts` | реестр по хешу; `getPack` → `Cache-Control` из `path_rules.pack.cache`; копия байт |
| `packages/contentpack/src/values.ts` | `LoadError` с `code`, без prose на проводе |
| `packages/contentpack/test/c2.test.ts` | шесть имён `protocol_loader.construction_tests` |

## 2. Изменено

`content/params/meta.json` (26→27), `arch.json` (construction_tests, toolchain `@corporator/protocol` = `workspace:*`), `api.json` (`path_rules.pack.cache` = `immutable`), `content/schema/corporator.schema.json` (version `workspace:*`, optional `cache`), `content/codegen.py` (`emit_layer_cruiser` разрешает `@corporator/{id}`), `packages/protocol/package.json` (exports), `packages/contentpack/package.json` (deps protocol, vitest gate), `vitest.workspace.ts`, `eslint.config.js` (JSON.parse/Date/fs на contentpack src), `docs/CONTENT.md` §5 байты, GEN-артефакты (шапка хеша 27).

## 3. Решения, которые не открывают развилку

- Коды загрузчика — существующие transport: `API_MALFORMED` / `API_PACK_STALE`. Новых кодов нет.
- `Cache-Control` = токен `immutable` из пака, без `max-age` литерала.
- `GET /pack/{hash}` — хелпер; HTTP-хост в C3.
- Импорт `@corporator/protocol` + cruiser pathNot включает workspace-имя (иначе 5 violations).
- `tsc --noEmit` contentpack без project references: иначе резолв шёл в stale `protocol/dist/index.d.ts` (`export {}`).
- Негатив float/дубликат/усечение проверяется `parseJson`, не `loadPack` (иначе `{"a":1,"a":2}` падал бы на отсутствии `hash`).

## 4. Инертность

`python content/build.py`: круг 14.47% / с Trader 11.67%. 57 JSON-целых > `2**53`. `worst_numerator` — строка.
