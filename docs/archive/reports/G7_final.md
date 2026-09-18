# G7 final

`rebalance_close`: четыре рычага вместе; доминирование на всех `C(6,3)` 3-кубах; окно A ратифицировано флагом `window_a_ratified=1`; пак опубликован. `launch.deployed` пуст. Водяной знак призов 19.

Пак **62**, хеш **`4ca9bba362f2b1d5799d79415a4819ff6bc93474e792a019499e6c0f2a41ac4f`**, 562954 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 62; 562954 байт; hash `4ca9bba3…1ac4f`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 313 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `4ca9bba3` |
| `python content/vectors.py` | 21 files; sha256 `b282376c07e58c279dfd479ef44a14287435332bed4a9aade05afde5777615f0` |
| `python content/sim.py` | 0; calibration A_t2 **14217** ∈ [12275, 15783]; T2 return 3991 / 7983; measured bank 2798 / 8100 |
| `python content/builds.py` | eval 131777; justified 92622; dominating 0; dead 0; mandatory 0; uncovered 0; cube_slice 2528 |
| `python content/attack.py --only L13,L14,L45,L47,L63,L64,L65,L313` | targeted caught; 16 probes |
| `corepack pnpm -w run gate` | tsc+eslint+depcruise 0; vitest 133/0 (38 files) |
| `python content/attack.py --jobs 8` | 313 rules covered; construction 227 held; SURVIVED 0 |

## Атаки

| вход | ожидание | факт |
|---|---|---|
| A=10000 | L313 | caught `return_min 2851` (план §5, `A-G-11`) |
| `window_a_ratified=0` | L313 | caught |
| `bank_markup_bps=200` | L313 | caught круг 774 |
| `vault_fee_bps=1500` | L313 | caught вход ≥ выход |
| logistics `playable_v1=false` | L313 | caught `5 != 6` |
| `force_dominating` | L313 | caught |
| `capital_unit_usd=0` | L313 | caught касса |
| три конструкции G7 | L313 | OK на зелёном; красный внутри |
| четыре рычага вместе | окно A в конверте | A_t2 14217; полосы 3991/7983; конверт meta не подогнан (`A-G-13`) |
| `season_prizes_live` | 1, watermark 19 | так (`A-G-17`) |
| `launch.deployed` | пуст | пять полей пустые (`A-G-2`) |
| краны NFT | 0 | 0; L312 жив |
| I11 / L305 | нет селектора резерва | constructions held |
| 15^6 в линтер | нет | `R-G-5`; `builds_gate` не вызывает `analyse()` (`A-G-16`) |

Первый прогон семьи: uncovered 2528 на 3-open тир-1 новых кубов. Закрыто здесь: свидетель `cube_slice` (класс G1 `pair_slice`). Повтор: uncovered 0.

## Расхождения

- **R-G-5.** Семья доминирования — все `C(6,3)` 3-кубы + одиночные + пары, не 15^6. `R-G-3` закрыт. `cube_slice` для 3-open, которые не выигрывают ни одну пару (сценарий, цель).
- Конверт T2 не подогнан под A (`A-G-11`). Форма денег не тронута. `rules_version` 0.20.0.

## Незакрытое


Next Step: фаза v1.1 закрыта. `PLAN_RELEASE` P0–P8 — по решению владельца; `launchToken` не раньше P7.
