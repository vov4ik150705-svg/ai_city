# C0 — разведка

Вход: пак **24**, `rules_version` **0.16.0**, хеш **`001c9ae7235308673f58cc2489cad4527306646f39deb80193c2537892d47173`**, lint **266/0**, T0–T12 закрыты, `packages/*` нет.

## 1. Что уже есть в паке

- Слои, сервисы, 7 строк `arch.codegen`, схема, порт, метрики, этапы: `content/params/arch.json`.
- Канонизация, keccak, merkle, layout v1: `content/pack.py`, `keccak.py`, `record.py`, `tick.py`.
- Дорожная карта: 10 стадий, у каждой `gate_cmd` и `tests` (`L262`). Строк под toolchain / protocol_loader / observability нет (`R-C-1`).
- `ts_gate_cmd` нет (`R-C-9`).
- Класса векторов нет. CID в оракуле нет (`R-C-6`): в C0 не экспортировать `cid_city_day`.
- Версии инструментов нигде не лежат (`D-C-14`).

## 2. Чего нет в дереве

Ни `packages/`, ни `pnpm-workspace.yaml`, ни манифестов, ни `tsconfig.base.json`, ни eslint, ни cruiser, ни `content/vectors.py`, ни `content/codegen.py`, ни `content/out/vectors/`.

## 3. Ключи, которые читает C0

`arch.packages`, `arch.codegen`, `arch.schema_tables`, `arch.channel_rules`, `arch.roadmap`, `arch.roadmap_order`, `meta.rules_version`, `meta.pack_version`, `tick.params.layout_version`, `attest.params.merkle_*_domain_byte`, `codes.codes` категория `idle`, `schema/$defs.unit`.

## 4. Правила и пробы, которые уже держат инвариант

`L01`, `L13`, `vault_cover` (строка `pack_gate`). `L231` фиксирует семь источников кодогена. `L262` требует команду и тест у стадии. `L264` запрещает голые `\d{2,}` в ROADMAP/ARCHITECTURE/API. `L266` держит `layout_version=1` и minor `0.x`. `L09` сверяет `derived` с `IMPLEMENTED_DERIVED`.

## 5. ТЗ на шаг (не сокращать)

Выходы буквально из плана §4 C0:

1. Воркспейс: `pnpm-workspace.yaml` глоб, корневой манифест, `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `vitest.workspace.ts`, `eslint.config.js` с запретами `D-C-3` на `packages/engine/src`, сгенерированный `.dependency-cruiser.cjs`.
2. Оракул: `content/vectors.py` + `content/out/vectors/*.json` + `content/out/vectors.sha256`. Классы `D-C-5` кроме `cid_city_day`. Два прогона — один хеш.
3. Кодоген: `content/codegen.py` с `--check`. Семь артефактов `arch.codegen` плюс DDL, маршруты, cruiser, каналы, project references. Шапка `GENERATED from pack <hash>; do not edit`.
4. Пак 25: блок `toolchain`, новые стадии `code_form`, `protocol_loader`, `observability_ci`, поле `ts_gate_cmd` у каждой стадии, `construction_tests` у `code_form`, `vector_classes`, `property_runs`. `rules_version` 0.16.0 → 0.17.0 (minor). `layout_version` остаётся 1.
5. `L267`–`L272` + атаки. Конструкционные имена vitest: `toolchain_matches_manifests`, `vectors_bytes_stable`, `codegen_check_catches_hand_edit`, плюс пробы падения eslint на `Date.now()` и литерале.
6. PENDING: адрес C-этапа в `why`; `cid_city_day_codec` владельца C8 (`R-C-6`).
7. Канон: `docs/CONTENT.md` §6 +6 строк; `docs/ARCHITECTURE.md` маркер toolchain; `docs/ROADMAP.md` без голых двузначных.

Критерий готовности — командами, не словами (план §4 C0).
