# G1 final

`districts_live`: шесть районов `playable_v1=true`; узлы/merge/дивиденды/синергии правилом; оффлайн 12+6=18 достижим; `fund_share` 3000+500=3500; `merge_active_cap` 3; окно A в конверте. `launch.deployed` пуст. Водяной знак призов 19.

Пак **56**, хеш **`730c7fdde2a9423c92be914464fb67f457735fb01b9bc728650ad86063d214be`**, 559250 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 56; 559250 байт; hash `730c7fdd…14be`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 307 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `730c7fdd` |
| `python content/vectors.py` | 21 files; sha256 `086a8f08de2c7dae3a7368284e4ec089549937efe221a187f0ab250c8981bdfb` (tick: `park_capacity_jobs=2`) |
| `python content/sim.py` | 0; calibration A_t2 **14217** ∈ [12275, 15783]; T2 return 3991 / 7983; measured bank 2798 / 8100 |
| `python content/builds.py` | eval 9753; justified 6321; dominating 0; dead 0; mandatory 0; uncovered 0; slice 128 |
| `python content/attack.py --only L58,L59,L60,L66,L69,L307` | targeted caught (13 probes with L91 extra) |
| `corepack pnpm -w run gate` | tsc+eslint+depcruise 0; vitest 112/0 (32 files) |
| `python content/attack.py --jobs 8` | 307 rules covered; construction 206 held; SURVIVED 0 |

## Атаки

| вход | ожидание | факт |
|---|---|---|
| logistics false | L307 | caught `5 != 6` |
| automation false | L307 | caught |
| finance false | L307 | caught |
| база оффлайна 11 | L307 | caught `11+6 != 18` |
| A=10000 | L307 | caught return_min 2851 |
| авторский v1_nodes | L66 | caught |
| zero_effect_orphan | L69 | caught |
| merge compute+energy | L59 | caught |
| дивиденд 4/4/4 | L58 | caught |
| hub не beacon | L91 | caught accrual 0 |
| здание без контуров | L21 | caught declared role |
| пять конструкций G1 | L307 | OK на зелёном; красный внутри |
| MSFT live без гейта | L160 | caught after R-G-4 (cut playable_v1) |
| корзина = playable на шести | L283 construction | зелёный pack равенство OK; срез района caught |
| повторный флип призов | A-G-17 | `season_prizes_live` остался 1 |

Выстояло (принято): сценарии T3 с A_t2 выше окна — поиск N, не калибровка; `R-T8-2`; `R-T5-12`. Окно не подогнано (`A-G-11`).

## Расхождения

- **R-G-1.** Снятие трёх `playable_v1` открывает пять синергий правилом на G1. G4 — свидетель/L310, не второй замок. `robotics_lab` не тронут.
- **R-G-2.** L21 работаемость — объявленные роли, иначе Cloud Campus красный до Manager (G2).
- **R-G-3.** Семья доминирования — доказанный 3-куб + singles/pairs, не 15^6. Полный набор — G7. `pair_slice` обобщён на шесть live.
- **R-G-4.** L160 гейтит по `districts.playable_v1`, не по фикстуре §11: после шести играбельных фикстура совпадает со всеми, и атака «MSFT live без гейта» иначе выживала. Корзина L283: `got == playable` на зелёном паке — норма; красный вход срезает район.

## Незакрытое

PENDING 4: `companion_llm_price_snapshot` (owner), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3), `pause_ready_delay` (owner).

Next Step: **G2** — `archetypes_live` (Scientist/Manager `v1:true`, величины, `sim.py`).
