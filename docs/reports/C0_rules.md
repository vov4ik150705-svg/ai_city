# C0 — спека правил L267–L272

Зона: `content/lint.py` блок L267–L272, `content/attack.py`, `docs/CONTENT.md` §6. `tick.py` / калибровка T3 не менялись.

Пак: **481 003** байт, хеш **`c2527351315c069bf0d825d2b0e7ef6b9fc09bf65cc7bc115d10ce5d6e667b65`**, `pack_version` **25**, `rules_version` **0.17.0**.

Прогон атак C0: `python content/attack.py --only L267,L268,L269,L270,L271,L272 --skip-construction`. Поимки — дословные строки после `→`.

| id | что ловит | вход | дословная поимка |
|---|---|---|---|
| L267 | `engines` / `packageManager` / npm-версия ≠ `arch.toolchain`; engine `dependencies` не пуст; неизвестный npm | overlay манифеста `engines.node='>=0.0.0'` | `L267  package.json engines.node '>=0.0.0' != toolchain '>=24.0.0'` |
| L268 | пустой `ts_gate_cmd`; имя vitest ≠ `construction_tests` 1:1 | `pack_gate.ts_gate_cmd=""` | `L268  stage pack_gate has no ts_gate_cmd` |
| L269 | нет класса D-C-5 (кроме `cid_city_day`); нет файла; лишний файл | снят `empty_tick` | `L269  vector_classes missing ['empty_tick']` |
| L269 | лишний вектор вне манифеста | overlay `_vector_files` + `ghost_class` | `L269  vector files not in the required set: ['ghost_class']` |
| L270 | эмиттер ≠ `arch.codegen`; неуникальный artifact | строка `ghost_wire` без эмиттера | `L270  arch.codegen rows without emitter: ['ghost_wire']` |
| L271 | eslint не содержит Date/Math/I/O/`node:fs`/`no-magic-numbers`/`no-restricted-syntax`/`value>=2`/`packages/engine/src` | конфиг без Date | `L271  eslint.config.js does not mention Date` |
| L272 | GEN-артефакт без шапки `GENERATED from pack <hash>; do not edit` | overlay файла без шапки | `L272  packages/protocol/src/codes.ts is missing GENERATED from pack …; do not edit` |

L269 диск: extra JSON в `content/out/vectors/` тоже ошибка (когда нет overlay).

L272 рендерит кодоген в памяти от дискового пака: lint идёт до `codegen.py` в гейте и не требует уже записанных артефактов.

Конструкции vitest (`code_form.construction_tests`), все красные на подготовленном входе, затем зелёные на чистом дереве:

| имя | вход падения | факт |
|---|---|---|
| `toolchain_matches_manifests` | (здоровый) pin ≠ манифест | сравнение с `arch.toolchain` |
| `vectors_bytes_stable` | два прогона `vectors.py` | один `vectors.sha256` |
| `codegen_check_catches_hand_edit` | лишний байт в `codes.ts` | `--check` exit 1, `drift packages/protocol/src/codes.ts` |
| `engine_eslint_rejects_date_now` | `Date.now()` в `packages/engine/src` | `pnpm -w run gate` exit 1; `no-restricted-globals` / `no-restricted-properties` |
| `engine_eslint_rejects_magic_number` | `export const leakedTwo = 2` | `pnpm -w run gate` exit 1; `no-restricted-syntax` `Literal[value>=2]` |

L01 по-прежнему с диска. Overlay манифестов / eslint / векторов / GEN-файлов — швы атак.
