# G5 final


Пак **60**, хеш **`3faf064f6214329c6b656617971a0fe23a4f364f49b9c6afbf051c81881de600`**, 562065 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 60; 562065 байт; hash `3faf064f…81de600`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 311 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `3faf064f` |
| `python content/vectors.py` | 21 files; sha256 `65280bb792b9026e44088c6bd24e4c60ea29789839826c5b2f80c21329f7fbc5` |
| `python content/sim.py` | 0; calibration A_t2 **14217** ∈ [12275, 15783]; T2 return 3991 / 7983; measured bank 2798 / 8100 |
| `python content/attack.py --only L77,L140,L143,L311` | targeted caught; 14 probes |
| `corepack pnpm -w run gate` | tsc+eslint+depcruise 0; vitest 127/0 (36 files) |
| `python content/attack.py --jobs 8` | 311 rules covered; construction 221 held; SURVIVED 0 |

`builds.py` на G5 не гейт. Полный `--jobs 8` — гейт закрытия: правился `lint.py` (L143).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| live=1, A=10000 | L143 / L311 | caught `return_min 2851` (план §5, `A-G-4`) |
| relief=0 | L311 | caught decorative |
| relief=10000 | L311 | caught above cap 9500 (`A-G-4` пол) |
| focus → forbidden | L311 | caught |
| live=0 | L311 | caught |
| uptime 9600 | L140 | caught > optimizer 9500 |
| live=0 + relief=1000 | L124 | caught |
| demo_prize_real=1 | L112 | caught |
| NFT taps 1000 | L128 | caught (G6) |
| четыре конструкции G5 | L311 | OK на зелёном; красный внутри |
| L40 `research.nodes.tools` | KeyError | сначала crash; закрыто осями |
| повторный флип призов | A-G-17 | `season_prizes_live` 1 |
| `launch.deployed` | A-G-2 | пять полей пустые |
| подгонка окна A | A-G-11 | не подогнано |


## Расхождения

Новых `R-G-*` нет. Формула окна T2 от `residual_idle_bps` 500; пересечение `[12275, 15783]` держится.

## Незакрытое
