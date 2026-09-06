# GATE_PERF — ускорение адверсариального гейта

Замер на Windows / Python 3.10 / 8 логических ядер. Базовая линия пользователя: `attack.py` 12 m 05 s. На этой машине полный последовательный прогон **до правок** занял **784 s (13 m 04 s)**; это число ниже как «до».

Пак после правок: `pack_version` 21, `rules_version` 0.14.0, хеш `78d28465629df668e43ae670225f56ce67cbb059222c9b9f3b6dfd49d06cf1ee`. `python content/lint.py` — 195 правил, 0 ошибок, 0 предупреждений.

## §1. Профиль

Флаг `--profile` копит `time.perf_counter()` по `check.__name__` и по пробе, печатает топ-20 в конце stdout.

### Один честный проход `lint.RULES` (до мемо мира, старый раннер)

Сумма 2.093 s, 0 ошибок.

| правило | s | доля прохода |
|---|---:|---:|
| l175_counters_seed_invariant | 1.153 | 55.1% |
| l183_layout_deterministic | 0.237 | 11.3% |
| l01_schema | 0.188 | 9.0% |
| l169_road_period_fits | 0.166 | 7.9% |
| l10_integers | 0.143 | 6.8% |
| l45_no_economic_literals | 0.097 | 4.6% |
| l132_policy_deterministic | 0.015 | 0.7% |
| l12_placeholders | 0.013 | 0.6% |
| l70_cap_covers_floor | 0.013 | 0.6% |
| l147_derived_from_resolves | 0.007 | 0.3% |
| l63_no_dominating | 0.005 | 0.2% |
| l56_scope_keys | 0.005 | 0.2% |
| l146_no_cyrillic_outside_why | 0.003 | 0.2% |
| l191_jitter_spares_blocks | 0.002 | 0.1% |
| l164_screens_md_no_literals | 0.002 | 0.1% |
| l61_costs_derived | 0.002 | 0.1% |
| l144_brief_and_hud_inventory | 0.002 | 0.1% |
| l32_city_faster_than_fund | 0.002 | 0.1% |
| l34_build_longer_than_offline | 0.002 | 0.1% |
| l195_world_md_no_literals | 0.002 | 0.1% |

`world.build_world` на сиде 1: **0.12 s**. `build.build_pack()`: **0.22–0.28 s**. На честном паке L63 читает `builds_summary.json` и стоит миллисекунды.

### Полный прогон (266 мутаций × 195 правил)

На честном паке L175 доминирует. На полном гейте картина другая: L175 после первого совпадения fingerprint **пропускает** 8 сидов (модульные `_L175_FP` / `_L183_OK`). Дорогое место — `builds.analyse()` (~73 s), которое L63 вызывает, когда `gate_fingerprint` не совпал с дисковым summary и раньше L01–L62 не накопили `ERRORS`.

Топ правил на полном параллельном прогоне с `--profile` (суммы по воркерам, поэтому доля от wall > 100%):

| правило | суммарные s | доля от wall 488 s |
|---|---:|---:|
| l63_no_dominating | 3053.8 | 626% |
| l175_counters_seed_invariant | 188.3 | 39% |
| l01_schema | 106.4 | 22% |
| l10_integers | 34.2 | 7% |
| l169_road_period_fits | 24.3 | 5% |
| l183_layout_deterministic | 15.5 | 3% |
| l12_placeholders | 9.1 | 2% |
| l132_policy_deterministic | 5.8 | 1% |
| l70_cap_covers_floor | 4.4 | 1% |
| l45_no_economic_literals | 2.6 | 1% |

Топ проб (тот же прогон; пробы с новым T4-fingerprint):

| проба | s | доля wall |
|---|---:|---:|
| L73 ключ output_bps объявил stage=objective | 372.4 | 76% |
| L73 порядок стадий переставлен | 358.9 | 74% |
| L96 кап 2500 режет два равных 50/50 | 358.0 | 73% |
| L68 cost_growth_bps скопирован в progression.json | 354.3 | 73% |
| L94 fragment_creator_tax_share_bps = 100 | 352.5 | 72% |
| L95 hop haircut 2 bps | 350.6 | 72% |
| L64 fragment_rate_bps обнулён на paper | 341.4 | 70% |
| L67 modifier_caps снят из pending | 327.6 | 67% |
| L100 прокси fragments_season | 127.4 | 26% |
| L103 fragment_cork_share_bps = 500 | 120.7 | 25% |

Вывод: не «три правила генерации мира», а **десяток проб, которые доходят до L63 с чужим fingerprint и гоняют `builds.analyse` ~73 s**. Остальные 234 атаки сохраняют честный fingerprint и читают диск. Оценка: 32 пробы меняют fingerprint; из них дорогие те, что не падают на L01–L62 до L63.

## §2. SERIAL_PROBES

Греп по `attack.py`: `write_text`, `unlink`, `mkdir`, `rename`, `replace`, `subprocess`, `shutil`, `os.chdir`, `tempfile`, `open(`, `Path`.

Реальных записей на диск в пробах:

| id | функция | почему serial |
|---|---|---|
| C T10 layout missing pack | `construction_t10_layout_missing_pack` | `importlib` грузит `art/pipeline/layout.py`, `write_layout` на отсутствующий `content/out/no_such_pack.json`, stderr + код 1; временный `out` в `TemporaryDirectory` |
| C T10 layout missing scene | `construction_t10_layout_missing_scene` | `write_text` `pack.json` в temp, `write_layout` пишет `scene.json` в temp `out/` |

Не serial (явно, чтобы не раздувать список):

- `a_l184_hand_scene` — только флаг `_pipeline_scene_exists`, файл `art/pipeline/scene.json` не создаётся.
- `construction_pack_bytes_stable` и прочие `build.build_pack()` — считают пак в памяти, `write_out` вызывает только `build.main()`, не проба.
- L184 в линтере читает `exists()`; никто в параллели этот путь не создаёт.
- `layout.py` на missing pack печатает в **stderr** (не stdout гейта).

Пробы из `SERIAL_PROBES` гоняются в родителе после `pool.map`, печатаются в исходной позиции.

## §3. Изоляция и протечки

`run_rules` по-прежнему чистит `ERRORS/WARNINGS/PENDING/CHECKED` и вызывает `lint.reset_probe_state()`: сбрасываются только `_L175_FP` и `_L183_OK`. Так L175/L183 не пропускают мутацию с тем же placement-fingerprint.

**Находка.** Первый прогон с `reset_probe_state`, который ещё и делал `_BUILDS_MEMO.clear()`, заставил каждую из ~30 проб с чужим fingerprint заново вызывать `builds.analyse` (~73 s). Сумма L63 стала 3053 s CPU. Это не баг правил, а уничтожение кэша с ключом `gate_fingerprint`. Кэш по fingerprint корректен: одинаковый ключ — одинаковый анализ. `_BUILDS_MEMO.clear()` убран.

`maxtasksperchild=None`. `maxtasksperchild=1` на Windows заставил бы каждый воркер заново платить `analyse` и spawn; при 73 s на пробу это хуже последовательного. Строже, чем sequential, изоляция уже есть за счёт spawn-процессов (свой `_BUILDS_MEMO`, свой world memo).

Два UTF-8 прогона `python content/attack.py` (jobs=8): stdout 55090 байт оба раза (367 OK, те же `→`, итог 195 / 0 / 0 / 0); wall 551 s и 641 s, отличается только строка `elapsed`.

PowerShell `> file 2>&1` пишет UTF-16 LE и подмешивает NativeCommandError от stderr `layout.py`. Сравнение эталона с `--jobs 1` по **английским** `→`-строкам, маркам OK/!! и счётчикам: **367/367 совпали**, UNATTACKED/SURVIVED/CRASHES пусты. Русские имена атак в PS-файле битые; канонический stdout — UTF-8 из `subprocess` без 2>&1.

## §4. Клонирование базы

`sections()` ≈ 212 003 байт JSON, 22 ключа. N=20:

| метод | мс / клон |
|---|---:|
| `copy.deepcopy` | 6.291 |
| `json.loads(json.dumps(obj))` | 5.232 |
| `json.loads(заранее dumps)` | **3.086** |

Независимость: мутация вложенного `vault_fee_bps.v` не видна во втором `loads`. Обход листьев: типы совпали с deepcopy (int остаётся int). `assert_no_floats` на клоне проходит (L10). Раннер сериализует базу один раз в `_BASE_JSON` и клонирует через `json.loads`.

## §5. Мемоизация

### `world.build_world` — `content/world.py`

Ключ: `sha256(fingerprint + ":" + seed)`, fingerprint = канонический JSON срезов, которые генератор читает: `placement`, `districts`, `buildings`, `time`, `codes`, `screens.{state_surfaces,fields,state_sources}`, `balance.params.building_level_max`, `progression.params.tier_count`, `_hud_layout`, флаги `_attack_*` из таблицы в коде. Не входят `_lint_*` и экономика.

Значение: полный результат; отдача через `copy.deepcopy`, чтобы мутация лотов в T10-атаках не портила кэш.

Проба (внутри существующей construction `T10 layout_hash = sha256 сцены`, stdout при успехе тот же): `water_margin_tiles=0` → другой `layout_hash` (ключ промахнулся) и L186 ловит `margin < 1`. Состояние `CHECKED` сохраняется/восстанавливается, чтобы не сбить UNATTACKED.

**Находка.** Первая версия писала в `_WORLD_MEMO[key]` после цикла `for lot ...: key = f"{w}x{h}_{side}"`, который **перебивал** sha256 на `"2x2_w"`. Кэш всегда был размера 1 и не попадал. Исправлено: `memo_key`. После фикса: miss 0.095 s, hit 0.010 s, два ключа для margin 2 vs 0.

### `_sim_src_literals` — `content/lint.py`

Ключ: `(sha256(source), tuple(sorted(whitelist)))`. Прямая атака L45 (`economic_literals_in("window_lo = 12278\n", ...)`) — другой source, промах, правило ловит. Файлы `tick.py`/`sim.py`/`builds.py`/`screens.py` после первого разбора — попадание (L45 с 0.097 s до ~0.01 s на повтор).

Не кэшировали `build.build_pack()`: оно всегда читает диск через `sections()`, а не мутацию в памяти; честный miss по ключу потребовал бы порчи param-файлов.

## §6. Соседние скрипты

| команда | s | rc |
|---|---:|---:|
| `python content/build.py` | 0.28 (baseline пользователя) / ~0.5 здесь | 0, хеш 78d284… |
| `python content/lint.py` | 1.72 baseline / 2.76 здесь | 0, 195, 0 err |
| `python content/attack.py` до | **784** (эта машина) / 725 пользователь | 0 |
| `python content/attack.py --jobs 1` после | **640** | 0 |
| `python content/attack.py` jobs=8 после | **551** (повтор 488 с `--profile` при сброшенном `_BUILDS_MEMO`) | 0 |
| `python content/sim.py` | **22.73** | 0 |
| `python content/builds.py` | **92.43** | 0 |
| `python art/pipeline/layout.py` | 0.19 | 0 |

`sim.py` < 60 s — ускорение не предлагается.

`builds.py` / `builds.analyse` — пол гейта. Замер contention spawn:

| процессов | wall s | время одной analyse |
|---|---:|---:|
| 1 | 73.1 | 72.9 |
| 2 | 92.5 | ~92 |
| 4 | 157.2 | ~155 |

Восемь параллельных `analyse` ещё хуже (7 дорогих проб, jobs=8: 294 s vs jobs=1: 468 s — всего ×1.6). Пол: ~9 уникальных дорогих fingerprint × 73 s CPU ≈ 11 мин CPU; на 2 ядрах с contention ≈ 7 мин wall. **Цель ≤ 3 мин на полном гейте на этой машине не берётся без ускорения самого `analyse` (не трогали: это смысл L63–L65/L69).** Не реализовывать: дисковый кэш `out/.analyse/{fp}.json` между запусками гейта (повторный прогон без новых мутаций T4 стал бы секундами) или ограничить одновременные `analyse` семафором 2 при `--jobs 8` для дешёвых проб.

## Итог

| | до | после |
|---|---:|---:|
| `attack.py` полный | 784 s | **551 s** (jobs=8) / 640 s (jobs=1) |
| пробы / покрыто / UNATTACKED / SURVIVED / CRASHES | 367 / 195 / 0 / 0 / 0 | то же, exit 0 |
| цель ≤ 180 s | — | **не достигнута**: упёрлись в `builds.analyse` на T4-пробах |

Раннер: `--jobs` (spawn, индекс пробы, печать по порядку), `--profile`, `--only`, `--since-rule`, `--construction-only`, `--skip-construction`. Гейт шага — без флагов.

## §7. Клиентский бюджет бандла (L3, R-C-12)

Потолок JS в `apps/client/dist-web` живёт в паке: `arch.params.client_bundle_max_bytes`. Число в этом файле не дублируется. Проба `client_sees_no_chainport` сравнивает сумму `.js`/`.mjs` с ключом. Измеренный бандл и бюджеты кадра — `docs/reports/GATE_VISUAL.md` (`L351`): анимация, шейдеры и свет разрешены, пока наблюдение сидит под потолком пака.
