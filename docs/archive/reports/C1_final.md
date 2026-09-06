# C1 — итоговый отчёт шага

Порт тика в единственный рантайм. Layout v1 сходится с Python-оракулом **по байтам**. CID не делался (`R-C-6`). Solidity/RPC не делались.

Пак **26**, `rules_version` **0.17.0**, хеш **`c5a6fc304d2aded494366459ef7578681dec19aaddb231a75923bf8e9277b26d`**, 481391 канонических байт.

---

## 1. Что закрыто

- `packages/engine/src/**`: canonical, keccak pad `0x01`, sha256, merkle positional, tick/header/catch-up, стек, агрегаты, `publicVerify` без цепочки npm.
- `dependencies: {}`. `fast-check@4.9.0` и `vitest@4.1.11` только `devDependencies`.
- Восемь имён `engine_from_spec.construction_tests` = восемь `it()` в `c1.test.ts`. Классы D-C-5 внутри `layout_v1_bytes` (Uint8Array vs hex).
- `numRuns` из `arch.params.property_runs` (64).
- Пак 26: только список проб и баннеры кодогена; формула записи не менялась.
- Гейт плана §4 C1 зелёный командами, не рассуждением.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; `pack_version` 26; `rules_version` 0.17.0 |
| хеш пака | `c5a6fc304d2aded494366459ef7578681dec19aaddb231a75923bf8e9277b26d` |
| канонические байты | 481391 |
| `python content/lint.py` | **272 правила, 0 ошибок**, PENDING 27 |
| `python content/vectors.py` | 20 файлов; sha256 `490a209794495a335be1c1d4db94046e3b9a2ee8e3933d3e1055752d332cfa19` |
| `python content/codegen.py --check` | 12 артефактов match `c5a6fc304d2aded4` |
| `pnpm --filter @corporator/engine run gate` | tsc ok; vitest **13/0** (5 C0 + 8 C1) |
| `pnpm -w run vectors` | sha256 тот же |
| eslint `packages/engine` | 0 |
| depcruise `packages/engine/src` | 18 modules, 0 violations |
| `python content/attack.py --since-rule L196` | все атаки пойманы; 143 конструкции; elapsed 24.8s jobs=8 |

Круг трения (build.py): 14.47% / с Trader 11.67%. Spend BPS = 10000.

## 3. Конструкционные пробы C1 (имена дословно)

`layout_v1_bytes`, `catchup_eq_replay`, `tick_deterministic`, `catchup_equals_replay`, `payroll_trim_proportional`, `no_float_in_bytes`, `record_key_order_irrelevant`, `merkle_odd_level_not_duplicated`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-3 | две реализации тика | **закрыто байтами** векторов; Python остаётся оракулом |
| R-C-5 | целые > 2^53 | класс `over_2_53` в `layout_v1_bytes`; загрузчик — C2 |
| R-C-6 | нет CID в оракуле | не в C1; PENDING C8 |
| R-C-11 | `no-magic-numbers` не умеет `ignore: [0n]` (JSON.stringify конфига) | принято: D-C-2 = `no-restricted-syntax` по numeric `raw` и bigint; индекс массива исключён; `2`/`2n` ловятся |

Нового R-C кроме **R-C-11** нет. `bank_withdraw_rate_ceiling_only` остаётся owner T3 (R-T3-1).

## 5. Адверсариальное ревю (`verification-loop` §3)

| вход | ожидание | факт | вывод |
|---|---|---|---|
| векторы старого `pack_hash` | `layout_v1_bytes` ≠ | падал | закрыто: rebuild пака 26 + `vectors.py` |
| `layout_v1_edge` без `output=0` | rec hex ≠ | падал (`output` 1 vs 0) | закрыто: как `_crafted_record` |
| `nodeHash(left,left)` на нечётном уровне | `merkle_odd_level_not_duplicated` | **поймал** (`r3==r4`) | правило не декорация |
| `Date.now()` | eslint ≠ 0 | exit 1 | D-C-3 |
| `leakedTwo = 2` | eslint ≠ 0 | exit 1 | D-C-2 |
| `leakedTwoN = 2n` | eslint ≠ 0 | exit 1 | D-C-2 bigint |
| `Literal[value>=2]` без фильтра `raw` | ловит строки `"true"` | ловил | закрыто: селектор по `raw=/^-?[0-9]/` |
| `no-magic-numbers` ignore `[0,1]` | 0n проходит | 425 ошибок на 0n/1n | закрыто: правило off, синтаксис держит ≥2 |
| `sold[2]` / `clock[2]` | индекс разрешён | ловил numeric 2 | закрыто: `:not(MemberExpression…)` |
| импорты `.ts` при NodeNext | tsc | TS5097 | закрыто: `.js` |
| `TextEncoder` при `types: []` | tsc | TS2304 | закрыто: `utf8.ts` |
| `JSON.parse` в `src` | запрещён | нет вхождений | |
| `engine.dependencies={protocol}` | L228 | атака L228 ловит | deps остались `{}` |
| L196–L272 overlay | каждое правило падает | все OK | срез гейта C1 |
| payroll 300:100, fund 200 | пропорция floor | vitest зелёный | I4 |
| догон ≡ N тиков | байты записей | vitest зелёный | TICK.md §6 |
| float `.` в байтах записи | `no_float_in_bytes` | нет точки вне строк | L198 |
| cyrillic `город-1` / `смена` | UTF-8 canonical | hex совпал | |
| keccak empty/abc/135/136/137 | `keccak_l202` | hex совпал | L202 |

Выжившее без исправления: инвентарь токенов L271 (не AST) — остаток C0, не R-C. `economy.ts` длиннее ~400 строк — один модуль контура `tick.py`, не второй канон.

## 6. Незакрытое

C2: bigint-safe загрузчик пака и GEN protocol. CID — C8. `bank_withdraw_rate_ceiling_only` — T3.

## 7. Next

C2 — `packages/protocol` + `packages/contentpack`: `--check`, loader rejects float/duplicate key, `pack_hash` mismatch halts.
