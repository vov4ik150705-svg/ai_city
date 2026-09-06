# C8 — пробы и поимки

L203 дополнительно сканирует `services/attestor/src` (оверлей `_attestor_source`). L207/L246 без новых `L*`. Класс векторов `cid_city_day` обязателен (L269).

Пак: **488352** байт, хеш **`781a85b4f7b1f1206faf52dde1fd322ae9a0bf4ea7cd52ae5edd3ad11cc2fe87`**, `pack_version` **33**.

Конструкции vitest (`attestor_no_chain.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `cid_matches_oracle` | `bytesEq(leaf, vector)` ждут false | expected false, got true |
| `attestor_down_pay_continues` | `halted` после `pack_hash: deadbeef` ждут false | expected false, got true |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| overlay `function merkleRoot` в attestor | L203 | `attestor defines merkleRoot in services/attestor/tree.ts` |
| `_record_src` дубль нечётного + sort | L203 | odd-level duplicated |
| PACK_HASH вырезан из tick.py | L207 | no PACK_HASH halt |
| `sampler.fail_mode=closed` | L246 | blocks the economy |
| 3 листа vs 4 с копией третьего | `cid_matches_oracle` | корни не равны |
| CID длина ≠ mh_length + префикс | `cid_matches_oracle` | длина 36 байт при mh_length из пака |
| IPFS/RPC false, есть листья | `attestor_down_pay_continues` | outbox, lag 1 затем 2, `SERVICE_DEGRADED` |
| `tick` с верным pack_hash после down | `attestor_down_pay_continues` | не throw |
| пустой список листьев при down | lag | **выживает**: flush не происходит, lag не растёт (нечего аттестовать) |
| `Date` в attestor src | eslint | banned |
| `import { tick }` из engine в src | eslint | importNames tick/catchUp |

Пустая минута без листьев не инкрементирует lag: это не публикация. Листья + down обязаны растить lag — так и есть.
