# G3 — пробы и поимки

Новое правило **L309**. Затронуты L61, L62, L68, L71 (гейт `--only`, регрессия красным входом).

Пак: **561 482** байт, хеш **`cc83992b51883aed8caccf61eb5a83223d747ee3fa8f9726736596d557763028`**, `pack_version` **58**, `rules_version` **0.20.0**.

## L309

| что ловит | вход падения | поимка |
|---|---|---|
| авторский узел с ценой | `research.nodes.ghost.cost_capital=1` | `research.nodes is authored` |
| дерево снова тройка | pop Circuits/Lathe | `research axes 3 <= 3` |
| объектив не live | `research.v1=false` | `objective research v1 is false` |
| cfg без id | `"research_objective": ""` в tick.py | `tick load_config research_objective is not the live research id` |
| дубль ключа | lathe → `output_bps` | `duplicates key output_bps already on tools` |
| запретный ключ | `offline_cap_hours` / `fund_share_bps` / `idle_reduction_bps` | `is forbidden on research` |
| литерал на оси | `effect_bps` или `cost_capital` | `stores a price or effect literal` |
| compute слит с energy | keys + `energy_cost_bps` | `compute merged with energy` |
| opening не за compute | keys без `compute_cost_bps` | `research has no compute_cost_bps` |

План §5: красный вход L309 — четвёртый узел с ценой-числом. Пойман.

## L61 / L62 / L68 / L71

| id | вход | поимка |
|---|---|---|
| L61 | tier_cost в progression.params | costs are generated |
| L61 | `node_effect_base_bps=1` | thinner than tick jitter |
| L62 | `city_level_req` хранится | gates are generated |
| L62 | stake_req шаг 0 | gates are generated |
| L68 | `cost_growth_bps` скопирован | must be referenced not copied |
| L71 | потолок литералом в якоре | caps are derived |
| L71 | потолок в modifiers.params | a cap as a param |

## Конструкции `research_tree.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `research_wider_than_three` | тройка осей | L309 `3 <= 3` |
| `research_cost_derived` | авторский `nodes` с ценой | L309 authored |
| `research_objective_opens_node` | `research.v1=false` | L309; хелпер открывает `(research,"",research,0,1)`, не открывает `IDLE_NO_COMPUTE` |

Vitest: три `it()` = три имени. Зелёный пакет + синтетический красный внутри теста.

Конструкций в харнессе: **214**.
