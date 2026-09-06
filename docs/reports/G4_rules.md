# G4 — пробы и поимки

Новое правило **L310**. Затронуты L05, L07, L08, L66 (гейт `--only`).

Пак: **561 638** байт, хеш **`096b9c116c80862ea4b159432e4e1feec655fc2fd29d41cd1435386ffb14f67a`**, `pack_version` **59**, `rules_version` **0.20.0**.

## L310

| что ловит | вход падения | поимка |
|---|---|---|
| ручной флаг на здании | `drone_depot.playable_v1=true` | `stores playable_v1` |
| открыто не шесть | `logistics.playable_v1=false` | `playable synergies 3 != 6` |
| матрица разошлась | bank `contour_secondary=work_research` | `affinity bank/scientist` |
| нет автономного слота | `robotics_lab.autonomous=false` | `autonomous slot missing` |
| скоуп списком | `build_v1_scope` именует `drone_depot` | `scope is a hand list` |
| авторский список в секции | `buildings.playable_synergies` | `is authored` |
| lab получил родной контур | `robotics_lab.contour=work_production` | `grew a home contour` |

План §5: красный вход — открыть `drone_depot` ручным флагом. Пойман.

## L05 / L07 / L08 / L66

| id | вход | поимка |
|---|---|---|
| L05 | второй контур банка | canon says none |
| L07 | energy без производителя | nothing produces it |
| L08 | маяк в чужой район | points at energy |
| L66 | авторский `v1_nodes` | v1 scope must follow playable_v1 |

## Конструкции `synergy_buildings.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `six_synergies_open` | ручной флаг drone_depot | L310 |
| `affinity_matrix_matches_canon` | клетка банка | L310 affinity |
| `autonomous_slot_present` | autonomous false | L310 |

Vitest: три `it()` = три имени.

Конструкций в харнессе: **217**.
