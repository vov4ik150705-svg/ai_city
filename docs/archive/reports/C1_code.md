# C1 — журнал кода

Порт тика в `@corporator/engine`. Канон механик не тронут. BPS в рантайме = сумма `spend_*_bps` (= 10000 на текущем паке). `ticks_day` из `generated.time.ticks_per_city_day`.

Пак после `python content/build.py`: **481 391** канонических байт, хеш **`c5a6fc304d2aded494366459ef7578681dec19aaddb231a75923bf8e9277b26d`**, `pack_version` **26**, `rules_version` **0.17.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/engine/src/keccak.ts` | Ethereum keccak-256, pad `0x01` |
| `packages/engine/src/sha256.ts` | SHA-256; PRNG `digest[:8]` BE; `companion_commands_hash` |
| `packages/engine/src/utf8.ts` | UTF-8 без `TextEncoder` (`types: []`) |
| `packages/engine/src/canonical.ts` | `sort_keys`, separators `,` `:`, `ensure_ascii=False` |
| `packages/engine/src/merkle.ts` | positional; нечётный узел **продвигается**, не дублируется |
| `packages/engine/src/record.ts` | validate/encode layout v1 и header |
| `packages/engine/src/arith.ts` | `mulBps`, TWAP, ratchet/stale/jitter |
| `packages/engine/src/stack.ts` | `buildModifierCaps` + `applyStack` |
| `packages/engine/src/aggregates.ts` | housing/parks/energy/productivity/gdp/happiness |
| `packages/engine/src/config.ts` | `loadConfig`; `wei` циклом `pow10` |
| `packages/engine/src/spawn.ts` | `spawnCity` = `sim.spawn_city` |
| `packages/engine/src/state.ts` | `newState`, `cityClock`, PRNG |
| `packages/engine/src/fragments.ts` | accrue; settle stub |
| `packages/engine/src/economy.ts` | mint, payroll, spend, bank, buyback, reserve/cork |
| `packages/engine/src/tick.ts` | `tick`, `tickHeader`, `catchUp` |
| `packages/engine/src/verify.ts` | `publicVerify`: rerun tick + proof листа 0 |
| `packages/engine/src/values.ts` | `Dict`, `TickError`, bigint helpers |
| `packages/engine/src/index.ts` | публичные экспорты; `identity` снят |
| `packages/engine/test/jsonBigint.ts` | целые → bigint; float/`-0` — ошибка |
| `packages/engine/test/harness.ts` | pack/vectors, `armFund`, live spawn |
| `packages/engine/test/c1.test.ts` | восемь имён `engine_from_spec.construction_tests` |

## 2. Изменено

`content/params/meta.json` (`pack_version` 25→26), `content/params/arch.json` (`engine_from_spec.construction_tests`), `packages/engine/package.json` (`fast-check@4.9.0` dev), `eslint.config.js` (override keccak/sha256/utf8; D-C-2 через `no-restricted-syntax` по `raw` числа и bigint; индекс массива исключён), `docs/CONTENT.md` §5 байты / снимок пака 26, GEN-артефакты кодогена (шапка хеша), `pnpm-lock.yaml`.

## 3. Решения, которые не открывают развилку

- Импорты в `src` — суффикс `.js` (NodeNext). Тесты vitest оставляют `.ts`.
- `no-magic-numbers` на engine src **выключен**: eslint сериализует конфиг через `JSON.stringify` и не принимает `0n` в `ignore`. Запрет литералов ≥2 держит `no-restricted-syntax` (`Literal[raw=/^-?[0-9]/][value>=2]` и bigint-селектор). Индекс `sold[2]` разрешён (`:not(MemberExpression[computed=true] > Literal)`). `2` и `2n` в `index.ts` по-прежнему роняют eslint.
- Криптоконстанты keccak/sha256/utf8 — override, как `content/keccak.py`.
- `numRuns` = `arch.params.property_runs.v` (64), не литерал в vitest.config.
- Загрузчик пака — C2. В C1 тесты читают `content/out/pack.json` своим парсером; `src` не вызывает `JSON.parse`.
- `economy.ts` ~846 строк (один контур `tick.py`). Деление файла не делалось: второй потребитель появится в C3.

## 4. Инертность

`python content/build.py`: круг **14.47%** / с Trader **11.67%**. BPS сумма spend = **10000**.
