# G2 — разведка

`archetypes_live`: Scientist и Manager `v1:true`; `train`/`research`/`focus` живые; величины `xp_rate_bps` и `compute_cost_bps` ненулевые строкой, не веткой. Band-этап: `sim.py` на шаге. `launch.deployed` пуст. Водяной знак призов 19. `rules_version` 0.20.0. Пак 56.

## Предусловие

`G1_final.md` на диске, гейт зелёный. Шесть районов играбельны. Scientist/Manager и три объектива ещё `v1:false`. Строки `train_xp`/`train_compute`/`research_compute` — `magnitude_from: v1_1_zero`. Focus `keys=[]`. Hire pool стартовый 50/25/25 без весов учёного и менеджера (§5.12).

## Дерево до шага

Роли и объективы уже объявлены; L85 держит ключи ↔ строки. `resolve_magnitude("v1_1_zero")` = 0. Потолки: XP → `xp_growth_bps` 16000; compute → кривая energy 16000. Overclock — канон кванта: `Δout` = 2×base = 1000, плата входа = ceil по `capex_trade_ratio` = 4500. Train/Research переиспользуют ту же арифметику на XP/compute, без нового числа.

L21 сверяет `roles_playable` с фикстурой §11 (сейчас три). Пять живых ролей требуют дописать Scientist и Manager в `design_11_scope.json` и пословно в §11.

`_live_flags_errors` и G0 `live_flags_inventoried` ещё требуют архетипы false — после флипа инвентарь оставшихся нулей: компаньон, дерево research=3, призы живые.

Калибровочная когорта T2 — пустой стек (`R-T5-12`): Train может не сдвинуть A_t2. `sim.py` всё равно гейт; окно не подгонять.

`set_manager_focus` компаньона остаётся запрещённой до G5. Focus роли — выбор контура, не строка модификатора.

## Риски

Слить `compute_cost_bps` с `energy_cost_bps` (`A-G-8`). Величина выше потолка семьи (`A-G-9`, `L70`). Форточка T5.6, если Train тронет `output_bps` (не трогает). Подгонка окна A (`A-G-11`). Новая ветка вместо строки (`R-T5-5`). Hire pool на пять ролей — сломал бы стартовый 50/25/25; не мандат G2. Полный `--jobs 8` не гейт шага (замок флага не снимался).
