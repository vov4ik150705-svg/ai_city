# C0 — журнал кода

Форма кодовой фазы. Тик не портирован. Экономические числа не двигались.

Пак после `python content/build.py`: **481 003** канонических байт, хеш **`c2527351315c069bf0d825d2b0e7ef6b9fc09bf65cc7bc115d10ce5d6e667b65`**, `pack_version` **25**, `rules_version` **0.17.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `pnpm-workspace.yaml` | глоб `packages/*`, `services/*`, `apps/*` |
| `package.json` | имя `corporator`, `packageManager` `pnpm@11.24.0`, `engines.node` `>=24.0.0`, pin'ы из `arch.toolchain` |
| `pnpm-lock.yaml` | заморозка; `pnpm -w install --frozen-lockfile` |
| `tsconfig.base.json` | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `tsconfig.json` | GEN project references из `arch.packages` |
| `vitest.workspace.ts` | `packages/engine` |
| `eslint.config.js` | D-C-3 на `packages/engine/src`; `no-restricted-syntax` `Literal[value>=2]` |
| `.dependency-cruiser.cjs` | GEN из слоёв; только `forbidden` + `options` (схема cruiser не принимает лишние top-level) |
| `content/vectors.py` | оракул D-C-5 минус `cid_city_day`; idle через `encode_record` |
| `content/out/vectors/*.json` | 20 файлов, байты hex |
| `content/out/vectors.sha256` | `b9d85ea0c1784e5d319129cb15d14662374b04cf1a9e5f09446a2d48dd3fb767` |
| `content/codegen.py` | 12 эмиттеров = `arch.codegen`; `--check` |
| `packages/*/`, `services/*/`, `apps/client/` | заглушки всех 10 пакетов; engine `dependencies: {}` |
| `packages/engine/src/index.ts` | `identity(bigint)` |
| `packages/engine/test/c0.test.ts` | пять имён `code_form.construction_tests` |
| `packages/protocol/src/{codes,screens,modifier_keys,districts,buildings,units,versions,routes,channels}.ts` | GEN |
| `services/api/migrations/001_from_pack.sql` | GEN DDL |

## 2. Изменено

`content/params/arch.json` (`toolchain`, `vector_classes`, `property_runs`, стадии `code_form` / `protocol_loader` / `observability_ci`, `ts_gate_cmd`, доп. строки codegen), `content/params/meta.json` (0.17.0 / 25), `content/params/pending.json` (`cid_city_day_codec` owner C8), `content/schema/corporator.schema.json`, `content/arch.py` (`VECTOR_AUTHORED_REQUIRED`, helpers), `content/lint.py` (`L267`–`L272`), `content/attack.py` (7 атак), `docs/CONTENT.md` §5 байты / §6 +6 правил, `docs/ARCHITECTURE.md` маркер toolchain, `docs/ROADMAP.md` порядок стадий без голого `\d{2,}` и без токена BRIEF «наблюдаемость».

## 3. Решения, которые не открывают развилку

- TypeScript **5.9.3**, не 7: peer `typescript-eslint` `<6.1`. Записано в `arch.toolchain.typescript.why`.
- Node **24.13.1**, engines `>=24.0.0`; pnpm **11.24.0**.
- `cid_city_day` не экспортируется (`R-C-6`); класс ждёт C8.
- Доп. артефакты кодогена — строки `arch.codegen`, не второй список.
- Pin'ы pixi/react/pg/fast-check/prettier в паке есть, в C0-манифестах нет: L267 сверяет объявленные зависимости, не требует все pin'ы сразу.
- eslint `no-magic-numbers` не ловит `const x = 2` (VariableDeclarator). Реальный запрет D-C-2 — `no-restricted-syntax` `Literal[value>=2]` / bigint ≥ 2n. Vitest гоняет `node_modules/eslint/bin/eslint.js`, не `pnpm` из PATH.

## 4. Инертность

`python content/sim.py`: `A_t2=14011`, `F_reserve/F_deposit=3978`, возвраты 2837/8213, `N_min` 229/705/1057, `N_bank` 137/183/483. `python content/build.py`: круг 14.47% / с Trader 11.67%.
