# G3 — журнал кода

`research_tree`: пять осей (Grid, Tools, Handbook, Circuits, Lathe); цена `fused_effect_cost(..., steps=0)`; объектив `research` открывает узел за compute. `launchToken` не подписывался. Водяной знак призов 19. `rules_version` 0.20.0.

Пак после `python content/build.py`: **561 482** канонических байт, хеш **`cc83992b51883aed8caccf61eb5a83223d747ee3fa8f9726736596d557763028`**, `pack_version` **58**, `rules_version` **0.20.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/engine/test/g3.test.ts` | три имени `research_tree.construction_tests` |
| `docs/reports/G3_recon.md` | разведка |
| `docs/reports/G3_code.md` | этот журнал |
| `docs/reports/G3_rules.md` | пробы и поимки |
| `docs/reports/G3_final.md` | гейт и атаки |

## 2. Изменено

`content/params/research.json` — оси, не `nodes`. Circuits `compute_cost_bps` −2 кванта; Lathe `upgrade_speed_bps` +2. `content/params/meta.json` 57→58. `content/params/arch.json` — три `construction_tests` у `research_tree`. Схема: `axes` обязательны, `nodes` опциональны только для красного входа L309.

`content/build.py` — узлы и modifier rows из осей; cost = fused at `steps=0`. `content/screens.py` — экран = оси. `content/sim.py` — Tools из оси. `content/tick.py` — `_advance_research` после `_pay`; `_compute_ok` требует compute на objective research.

`content/lint.py` — L309: оси >3; нет авторских `nodes`/литералов цены; unique keys; forbidden keys; cost == fused; research v1 + compute без energy; AST `_advance_research` после `_pay`; хелпер открывает на ready tick; cfg несёт id `research`. L161/L02/L03/L40 читают оси.

`content/attack.py` — четыре атаки L309; три конструкции; `_live_flags_errors` оси >3.

`packages/engine/src/{config,economy,tick,index}.ts` — зеркало. `packages/contentpack/test/g0.test.ts` — ветка `research_tree`.

`DESIGN.md` §5.11/§11, `docs/PROGRESSION.md`, `BALANCE.md` §8, `SCREENS.md`, `HUD.md`, `CONTENT.md` §6: Circuits/Lathe во «входит»; «шире трёх» убрано из «режем».

Кодоген 19 артефактов под хеш `cc83992b…55763028`. Векторы 21 файл, sha256 `7e11cd35e13fce911ad865057efbcccd02c6566c20f22f1f67e25127e1f419af`.

## 3. Решения, которые не открывают развилку

- Эффект = `sign × key_unit × tier`. Без новых литералов экономики.
- `steps=0` у fused: v1 Grid/Tools/Handbook цены не едут (Grid 10265363, Tools/Handbook 6843575).
- Lathe на `upgrade_speed_bps`, не второй `output_bps` и не `offline_cap_hours` (`A-G-10`).
- Города без research не трогать: skip если objective иной и нет `research_*` полей.
- Compute не слит с energy (`A-G-8`).
- Окно A не подогнано: этап не band; пересечение осталось `[12275, 15783]` (`A-G-11`).

Экономических литералов нет. `prize_live_min_rules_minor` не поднят. Форма денег Rev-A не тронута. `creator_tax_bps` 200.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `season_prizes_live` 1. `companion_rows_live` 0. Research nodes 5. `demo_companion` 0. `robotics_lab` не тронут.
