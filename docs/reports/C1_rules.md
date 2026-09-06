# C1 — пробы и поимки

Новых правил `L*` нет. Зона: `packages/engine/test/c1.test.ts`, eslint D-C-2/D-C-3, векторы D-C-5, L268 1:1 с `engine_from_spec.construction_tests`.

Пак: **481 391** байт, хеш **`c5a6fc304d2aded494366459ef7578681dec19aaddb231a75923bf8e9277b26d`**, `pack_version` **26**, `rules_version` **0.17.0**.

Конструкции vitest (`engine_from_spec.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `layout_v1_bytes` | векторы пака 25 при живом `pack_hash` 26; `layout_v1_edge` с `output=1` при оракуле `output=0` | hex header/record ≠ вектору |
| `catchup_eq_replay` | (здоровый) догон ≡ N тиков | байты записей и `mint_rate` |
| `tick_deterministic` | два независимых `newState` на одном `tick_index` | header/root байт-равны; `numRuns` из пака |
| `catchup_equals_replay` | property `n∈[1,4]` | то же, что конструкционная `catchup_eq_replay` |
| `payroll_trim_proportional` | fund=200, заявки 300 и 100 | `payout = request × budget / total`; оба > 0 |
| `no_float_in_bytes` | `.` вне строк в header/record/slice | нет |
| `record_key_order_irrelevant` | перестановка ключей записи | те же байты `encodeRecord` |
| `merkle_odd_level_not_duplicated` | нечётный узел `nodeHash(left,left)` вместо promote | `root(3)==root(4)` → тест падает |

Атаки eslint (живой бан, не инвентарь токенов):

| вход | правило | факт |
|---|---|---|
| `Date.now()` в `index.ts` | `no-restricted-globals` / `properties` | exit 1 (C0 `engine_eslint_rejects_date_now`) |
| `export const leakedTwo = 2` | `Literal[raw=/^-?[0-9]/][value>=2]` | exit 1 |
| `export const leakedTwoN = 2n` | bigint-селектор | exit 1 |

`python content/attack.py --since-rule L196`: все атаки L196–L272 пойманы; 143 конструкционные пробы держатся.
