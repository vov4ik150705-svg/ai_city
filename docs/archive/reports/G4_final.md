# G4 final

`synergy_buildings`: шесть синергий правилом `requires`; матрица = канон §5.8; автономный слот Robotics Lab. `launch.deployed` пуст. Водяной знак призов 19. `robotics_lab` в params не тронут.

Пак **59**, хеш **`096b9c116c80862ea4b159432e4e1feec655fc2fd29d41cd1435386ffb14f67a`**, 561638 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 59; 561638 байт; hash `096b9c11…b14f67a`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783]; v1 18 зданий |
| `python content/lint.py` | 310 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `096b9c11` |
| `python content/vectors.py` | 21 files; sha256 `93a262d14099fd62ee6864c640b05a123a1c9dd41d706752903b8860f6e8f99c` |
| `python content/attack.py --only L05,L07,L08,L66,L310` | targeted caught; 9 probes |
| `pnpm --filter @corporator/engine run gate` | tsc 0; vitest 28/0 (5 files) |

`sim.py` / `builds.py` на G4 не гейт. Полный `--jobs 8` не гейт шага.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| drone_depot ручной флаг | L310 | caught (план §5, `A-G-12`) |
| logistics false | L310 | caught `3 != 6` |
| клетка аффинити | L310 / L05 | caught |
| lab не autonomous | L310 | caught |
| `build_v1_scope` именует drone_depot | L310 | caught (`A-G-12`) |
| `buildings.playable_synergies` | L310 | caught |
| lab contour | L310 | caught `grew a home contour` |
| merge compute+energy | L59 | caught (`A-G-14`) |
| три конструкции G4 | L310 | OK на зелёном; красный внутри |
| L05/L07/L08/L66 | гейт | 4/4 caught |
| robotics_lab params | не тронут | `inputs lab: energy,compute` |
| повторный флип призов | A-G-17 | `season_prizes_live` 1 |
| демо + компаньон | A-G-15 | `demo_companion=0` |
| `launch.deployed` | A-G-2 | пять полей пустые |
| подгонка окна A | A-G-11 | не подогнано |

Выстояло (принято): `R-G-1` — пять синергий открыты на G1; G4 свидетель. `R-T8-2`; `R-T5-12`. HUD/SCREENS не ехали.

## Расхождения

Новых `R-G-*` нет. `R-G-1` подтверждён.

## Незакрытое

PENDING 4: `companion_llm_price_snapshot` (owner), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3), `pause_ready_delay` (owner).

`companion_rows_live` 0, `set_manager_focus` forbidden (G5).

Next Step: **G5** — `companion_live` (ненулевой idle relief; `set_manager_focus`; пересчёт окна A).
