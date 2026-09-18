# C1 — разведка

Вход: C0 закрыт. Пак **25**, `rules_version` **0.17.0**, хеш **`c2527351315c069bf0d825d2b0e7ef6b9fc09bf65cc7bc115d10ce5d6e667b65`**, lint **272/0**, векторы sha256 **`b9d85ea0c1784e5d319129cb15d14662374b04cf1a9e5f09446a2d48dd3fb767`**. `packages/engine` — заглушка `identity(bigint)` и пять проб `code_form`.

## 1. Что уже есть

- Оракул тика: `content/tick.py` (`tick`, `load_config`, `new_state`, `tick_header`, `catch_up`), `record.py`, `keccak.py`, `pack.canonical` / `mul_bps`, `aggregates.py`, `arch.twap_from_samples`, `build.apply_stack` / `mint_rate` / `tick_jitter_bps`, `sim.spawn_city`.
- Золотые векторы `content/out/vectors/*.json`: hex байтов; живые классы собирают state заново в `vectors.py`, не хранят полный state.
- `engine_from_spec.construction_tests` — пустой массив. Заполнение меняет пак → `pack_version` 25→26, `rules_version` без смены формулы.
- `arch.params.property_runs.v` = 64. `arch.toolchain.fast_check` = `fast-check@4.9.0`.
- eslint на `packages/engine/src`: Date/Math/I/O + `Literal[value>=2]`. Keccak/sha256 — криптоконстанты, как в `keccak.py` (не экономика): override на два файла.
- Загрузчик пака — C2. В C1 тесты парсят `pack.json` bigint-safe сами; `src` `JSON.parse` не вызывает.

## 2. Чего нет

Порта тика, канонизации, keccak, merkle, верификатора §6.3, vitest/fast-check в `@corporator/engine`, имён проб `engine_from_spec`.

## 3. Ключи, которые читает C1


BPS в движке = `spend_burn_bps + spend_fund_bps + spend_protocol_bps`, не литерал 10000. `ticks_day` из `generated.time.ticks_per_city_day`, не литерал 24. `wei = 10**wei_decimals` циклом по десятице из единиц.

## 4. Правила и пробы, которые уже держат инвариант

`L196`–`L214`, `L208`, векторы D-C-5. L268: имена `it()` = union `construction_tests`. Восемь имён C1, без лишних `it()`. Классы D-C-5 крутятся внутри `layout_v1_bytes`.

## 5. ТЗ на шаг

2. `dependencies: {}`. vitest + fast-check только `devDependencies`. gate = `tsc --noEmit` + `vitest run`.
3. Тесты: `layout_v1_bytes`, `catchup_eq_replay`, `tick_deterministic`, `catchup_equals_replay`, `payroll_trim_proportional`, `no_float_in_bytes`, `record_key_order_irrelevant`, `merkle_odd_level_not_duplicated`. Сравнение `Uint8Array` с hex вектора. `numRuns` из пака.
4. Пак 26: `engine_from_spec.construction_tests` = эти восемь имён.
5. Гейт плана: `python content/attack.py --since-rule L196 && pnpm --filter @corporator/engine run gate && pnpm -w run vectors`.
6. PENDING `bank_withdraw_rate_ceiling_only`: курс выхода от `capital_anchor`, R-T3-1 не чинить.
7. CID не делать (`R-C-6`). Solidity/RPC не делать.

Критерий готовности — командами плана §4 C1.
