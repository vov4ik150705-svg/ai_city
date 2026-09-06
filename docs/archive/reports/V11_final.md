# V11 final

`attest_live`: смены уходят fail-open — минутный корень, суточный CID, бейдж Verified только при обоих. `launch.deployed` пуст. `missions_live=0`, краны NFT 0, `companion_revenue_live=0`, `window_a_ratified=1`, `season_prizes_live=1`, `prize_live_min_rules_minor` 19.

Пак **81**, хеш **`05628a0b839d0e351a8d23666cb84e553ac5ba46277b9995fb2b197ee938f8e8`**, 628281 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров, magenta 0. `layout_hash` `63aa7ce8cc09…` (геометрия не от `city_id`).

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 356 / 0 |
| `python content/build.py` | 0; pack 81; 628281 байт; hash `05628a0b…e938f8e8`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 23 artifacts, hash `05628a0b` |
| `python content/attack.py --only L349,L350` | 5/5 пойманы |
| `python content/attack.py --only L221,L317` | 3/3 пойманы |
| construction два имени V11 | OK на зелёном; красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `1b7f0447…4be2cb86` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| attestor `tsc --noEmit` + `vitest run` | tsc 0; vitest 4/0 |
| api `tsc --noEmit` + `vitest run` | tsc 0; vitest 37/0 |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 20/0 |
| contentpack vitest | 59/0 |
| chainport tsc + vitest | tsc 0; 16/0 |
| eslint edited src | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `attestor.blocks_tick=1` | L349 | caught |
| hex-адрес в attestor src | L349 | caught |
| `void attestor` без submit | L349 | caught |
| `attestBadge` всегда verified | L350 | caught |
| HUD Verified без корня/CID | L350 | caught |
| `commands` в DecisionRecord | L221 | caught |
| `owner_address` в спеке записи | L317 | caught |
| `layout_version=2` | L317 | caught |
| IPFS down | выплата + logged | vitest A-V-24 |
| Verified без корня | logged | vitest A-V-25 |
| `--jobs 8` в `attest_live.gate_cmd` | нет | A-V-26 |
| hex в attestor/api src | пусто | grep |
| `city_id` задаёт геометрию | `layout_hash` прежний | `63aa7ce8cc09…` |
| `missions_live` / NFT / revenue | нули | L348 |
| `launch.deployed` | пять пустых | команда |

## Расхождения

- **R-V-5 / R-V-36.** Живой `getRoot` на тестовой сети не гонялся: нет имени сети, RPC, адреса `MerkleRoots`, ключа аттестатора, пина IPFS. Софт-путь: mock roundtrip + fail-open. Env `CORPORATOR_MERKLE_ROOTS` / `CORPORATOR_IPFS_PIN_URL` читаются, значений в репо нет.
- **R-V-37.** Проба C11 ждала `rules_version == 0.20.0`; с V0 минор `0.21.0`. Сверка `>= 20`, как L306.
- Принятые: горячий ключ аттестатора; бот и аттестатор видны ончейн; тонкий пул тестовой сети — ждут R-V-5.

## Готовность

Критерий PLAN V11 выполнен на софт-пути. Живая сеть — владелец / R-V-5. Форма денег не сдвинута. Next: V12 `visual_close`.
