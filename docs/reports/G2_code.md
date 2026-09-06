# G2 — журнал кода

`archetypes_live`: Scientist и Manager `v1:true`; `train`/`research`/`focus` живые; величины `xp_rate_bps` / `compute_cost_bps` строкой, не веткой. `launchToken` не подписывался. Водяной знак призов 19. `rules_version` 0.20.0.

Пак после `python content/build.py`: **559 806** канонических байт, хеш **`56f98bfaef0ad769d1b880bacb161ef3a47eefd55b67cccef23f44d103cee564`**, `pack_version` **57**, `rules_version` **0.20.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/g2.test.ts` | пять имён `archetypes_live.construction_tests` |
| `docs/reports/G2_recon.md` | разведка |
| `docs/reports/G2_code.md` | этот журнал |
| `docs/reports/G2_rules.md` | пробы и поимки |
| `docs/reports/G2_final.md` | гейт и атаки |

## 2. Изменено

`content/params/agents.json` — `scientist`/`manager` `v1:true`; `train`/`research`/`focus` `v1:true`. Hire pool 5000/2500/2500 не тронут. `content/params/modifiers.json` — `train_xp`/`train_compute`/`research_compute` `magnitude_from` с `v1_1_zero` на одноимённые формулы. `content/params/meta.json` 56→57. `content/params/arch.json` — пять `construction_tests` у `archetypes_live`. `content/fixtures/design_11_scope.json` — `roles_playable` пять ролей.

`content/build.py` — `resolve_magnitude`: `train_xp` = `overclock_out` (2×base = 1000); `train_compute`/`research_compute` = `overclock_energy` (ceil по `capex_trade_ratio` = 4500). `v1_1_zero` оставлен для красных входов.

`content/lint.py` — L308: пять ролей live; train/research/focus `v1`; 9 объективов; focus `keys=[]`; train XP+compute без energy; research compute без energy; авторский `magnitude_from ≠ v1_1_zero`; величины ненулевые и в потолке; окно A в конверте meta.

`content/attack.py` — шесть атак L308; пять конструкций; `_live_flags_errors` требует архетипы true; `expected_ct` включает `archetypes_live`; конструкции сбрасывают `_lint_t5` после deepcopy.

`DESIGN.md` §5.7/§5.9/§5.11 и §11: пять ролей во «входит»; Scientist/Manager убраны из «режем»; числа 1000/4500. `docs/PROGRESSION.md` T5.1; R-T5-5 закрыт. `docs/CONTENT.md` L308, 308 правил, пак 57 / 559806. `docs/COMPANION.md` — роль Manager жива, `set_manager_focus` запрещён до G5. `docs/BALANCE.md` — G2 не сдвинул пересечение окна A (`R-T5-12`).

Кодоген 19 артефактов под хеш `56f98bfa…cee564`. Векторы 21 файл, sha256 `0827368be93592b02c2c30432daa2a3da3f112cf75c3432da7bd7bf5edb3f649`.

## 3. Решения, которые не открывают развилку

- Величины = скелет Overclock, не новые литералы (`R-T5-5`).
- Hire pool стартовый 50/25/25: пять ролей live ≠ пять весов найма (§5.12).
- Focus без строк (`L85`). `set_manager_focus` компаньона — G5.
- Окно A не подогнано: калибровка 14217 ∈ [12275, 15783] (`A-G-11`, `R-T5-12`).
- Compute не слит с energy (`A-G-8`). Потолок семьи держит L70/L308 (`A-G-9`).
- Авторский `magnitude_from` читается правилом: deepcopy с `_lint_t5` не прячет `v1_1_zero`.

Экономических литералов нет. `prize_live_min_rules_minor` не поднят. Форма денег Rev-A не тронута. `creator_tax_bps` 200.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. T2 return 3991 / 7983. `season_prizes_live` 1. `companion_rows_live` 0. Research nodes 3. `demo_companion` 0.
