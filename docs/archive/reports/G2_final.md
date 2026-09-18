# G2 final

`archetypes_live`: пять ролей `v1`; `train`/`research`/`focus` живые; `train_xp` 1000, `train_compute`/`research_compute` 4500; Scientist — второй потребитель compute; focus `keys=[]`; окно A в конверте. `launch.deployed` пуст. Водяной знак призов 19.

Пак **57**, хеш **`56f98bfaef0ad769d1b880bacb161ef3a47eefd55b67cccef23f44d103cee564`**, 559806 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 57; 559806 байт; hash `56f98bfa…cee564`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 308 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `56f98bfa` |
| `python content/vectors.py` | 21 files; sha256 `0827368be93592b02c2c30432daa2a3da3f112cf75c3432da7bd7bf5edb3f649` |
| `python content/sim.py` | 0; calibration A_t2 **14217** ∈ [12275, 15783]; T2 return 3991 / 7983; measured bank 2798 / 8100 |
| `python content/attack.py --only L70,L72,L73,L85,L86,L308` | targeted caught; 16 probes |
| `corepack pnpm -w run gate` | tsc+eslint+depcruise 0; vitest 117/0 (33 files) |

`builds.py` на G2 не гейт. Полный `--jobs 8` не гейт шага (замок флага не снимался).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| train.v1 false | L308 | caught |
| scientist.v1 false | L308 | caught `4 != 5` |
| magnitude_from v1_1_zero | L308 | caught authored |
| compute слит с energy | L308 | caught (`A-G-8`) |
| train_xp magnitude 20000 | L308 | caught above cap 16000 (`A-G-9`) |
| A=10000 | L308 | caught return_min 2851 |
| пять конструкций G2 | L308 | OK на зелёном; красный внутри |
| deepcopy + кэш `_lint_t5` | ноль должен ловиться | сначала мимо; закрыто authored `v1_1_zero` + `pop(_lint_t5)` |
| L70/L72/L73/L85/L86 | гейт | 10/10 caught |
| Train на `output_bps` | форточка T5.6 | ключа нет; L77 зелёный на паке |
| hire pool на пять ролей | не мандат | 50/25/25 держится |
| `set_manager_focus` | G5 | остался forbidden |
| повторный флип призов | A-G-17 | `season_prizes_live` остался 1 |
| `launch.deployed` | A-G-2 | пять полей пустые |
| подгонка окна A | A-G-11 | не подогнано |

Выстояло (принято): сценарии T3 с A_t2 выше окна — поиск N, не калибровка; `R-T8-2`; `R-T5-12` (когорта T2 без стека Train, A_t2=14217). Окно не подогнано (`A-G-11`).

## Расхождения

Новых `R-G-*` нет. **R-T5-12** подтверждён: снятие нуля Train/XP не сдвинуло калибровочное A_t2 и полосы T2.

## Незакрытое



Next Step: **G3** — `research_tree` (дерево шире трёх; объектив research открывает узел за compute).
