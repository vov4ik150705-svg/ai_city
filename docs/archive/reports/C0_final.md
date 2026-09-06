# C0 — итоговый отчёт шага

Toolchain, золотые векторы, односторонний кодоген. Канон механик не тронут. Тик не портирован.

Пак **25**, `rules_version` **0.17.0**, хеш **`c2527351315c069bf0d825d2b0e7ef6b9fc09bf65cc7bc115d10ce5d6e667b65`**, 481003 канонических байт.

---

## 1. Что закрыто

- Воркспейс pnpm: 10 пакетов из `arch.packages`, `tsconfig.base.json` strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, eslint D-C-3, GEN cruiser.
- Оракул: 10 авторских классов D-C-5 минус `cid_city_day` + 10 idle; два прогона — один sha256.
- Кодоген: 12 артефактов = `arch.codegen`; `--check` падает на одном лишнем байте.
- `arch.toolchain` = `engines` / `packageManager` / объявленные npm-версии; расхождение роняет L267.
- У каждой стадии `ts_gate_cmd` (L268). Стадии `code_form`, `protocol_loader`, `observability_ci` (`R-C-1`).
- PENDING `cid_city_day_codec` owner **C8** (`R-C-6`).
- `pnpm -w run gate` падает на `Date.now()` и на литерале `2` в `packages/engine/src`.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; `pack_version` 25; `rules_version` 0.17.0 |
| хеш пака | `c2527351315c069bf0d825d2b0e7ef6b9fc09bf65cc7bc115d10ce5d6e667b65` |
| канонические байты | 481003 |
| `python content/lint.py` | **272 правила, 0 ошибок**, 0 предупреждений, PENDING 27 (есть `C8 cid_city_day_codec`) |
| `python content/vectors.py` ×2 | 20 файлов; sha256 `b9d85ea0c1784e5d319129cb15d14662374b04cf1a9e5f09446a2d48dd3fb767` |
| `python content/codegen.py --check` | 12 артефактов; лишний байт в `codes.ts` → exit 1 |
| `pnpm -w install --frozen-lockfile` | Already up to date, pnpm 11.24.0 |
| `pnpm -w run gate` | `tsc -b` ok; eslint ok; depcruise 65 modules / 0 violations; vitest **5/0** |
| `pnpm -w run gate` + `Date.now()` | exit 1 |
| `pnpm -w run gate` + `leakedTwo = 2` | exit 1 |
| `python content/attack.py --jobs 8` | **494 пробы**, **272 покрыто**, **143 конструкции**, elapsed 501.1s |
| UNATTACKED | **0** |
| SURVIVED | **0** |
| CRASHES | **0** |
| CONSTRUCTION FAILED | **0** |

`docs/CONTENT.md` §6: 272 строк `| **L…** |` = `len(RULES)` = 272.

`python content/sim.py` — инертность:

| величина | канон | факт |
|---|---:|---:|
| `A_t2` калибровка | 14011 | 14011 |
| `F_reserve/F_deposit` | 3978 bps | 3978 |
| возврат min / opt | 2837 / 8213 | 2837 / 8213 |
| `N_min` low/mid/hype | 229 / 705 / 1057 | 229 / 705 / 1057 |
| `N_bank` low/mid/hype | 137 / 183 / 483 | 137 / 183 / 483 |
| круг / с Trader | 14.47% / 11.67% | 14.47% / 11.67% |

## 3. L267–L272 → поимка

См. `docs/reports/C0_rules.md`.

## 4. Конструкционные пробы C0 (имена дословно)

`toolchain_matches_manifests`, `vectors_bytes_stable`, `codegen_check_catches_hand_edit`, `engine_eslint_rejects_date_now`, `engine_eslint_rejects_magic_number`.

## 5. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-1 | нет строк toolchain / protocol_loader / observability | закрыто: три стадии в `arch.roadmap`, пак 25 |
| R-C-3 | две реализации тика | принято; векторы в C0, паритет байтов — C1 |
| R-C-5 | целые > 2^53 и десятичная строка | класс `over_2_53` экспортирован; загрузчик — C2 |
| R-C-6 | нет CID в оракуле | `cid_city_day` не в C0; PENDING C8 |
| R-C-9 | нет `ts_gate_cmd` | закрыто; L268 |
| R-C-10 | план вне гейта | принято, не гейтовать `PLAN_CODE.md` |

Нового R-C-* нет.

## 6. Адверсариальное ревю (`verification-loop` §3)

| вход | ожидание | факт | вывод |
|---|---|---|---|
| манифест `engines.node='>=0.0.0'` | L267 | **поймал** | pin держится |
| пустой `ts_gate_cmd` | L268 | **поймал** | A-1 закрыт |
| нет `empty_tick` | L269 | **поймал** | |
| extra `ghost_class` | L269 | **поймал** | лишний файл не декорация |
| codegen row без эмиттера | L270 | **поймал** | |
| eslint без Date | L271 | **поймал** | |
| GEN без шапки | L272 | **поймал** | |
| +1 байт в `codes.ts` | `--check` ≠ 0 | exit 1 `drift` | RK-13 |
| `Date.now()` в engine | `pnpm -w run gate` ≠ 0 | exit 1 | критерий готовности |
| `const leakedTwo = 2` | gate ≠ 0 | сначала **молчал** (`no-magic-numbers` пропускает VariableDeclarator; vitest звал `pnpm` → ENOENT) | закрыто: `no-restricted-syntax` + `eslint.js` через `node` |
| «наблюдаемость» в ROADMAP | атака L263 с overlay только ARCHITECTURE | **молчал** | закрыто: токен только в ARCHITECTURE; атака трёт все три docs |
| extra top-level в cruiser | depcruise schema | падал | закрыто: emitter без `layerOrder` |
| idle tick с jump и fund>0 | I4_ZERO_PAY | падал | закрыто: `_arm_fund` |
| токены L271 в комментарии eslint | L271 мог пройти | **молчит** | инвентарь, не AST; живой бан — vitest+eslint. Остаток, не R-C |
| pin pixi/react/pg не в C0 package.json | L267 мог требовать все pin'ы | **молчит** | сверяет объявленное; C5/C3 поставят зависимости |

Найденное в этом шаге закрыто, кроме двух названных остатков (инвентарь L271; отложенные npm-pin'ы).

## 7. Что не в скоупе C0

Порт тика в TypeScript (C1). bigint-safe загрузчик (C2). Живой RPC, Solidity, призы, live merkle, S_min по RPC, снимок цены LLM.
