# T4 recon

Исследовательский отчёт задачи T4 (дерево прогрессии районов). Канон-документ — `docs/PROGRESSION.md`. Широкие таблицы — `content/out/GENERATED.md`, доминирование — `content/out/BUILDS.md`.

---

## 1. Пересчёт контрольных точек

Генератор: `fused_effect_cost(workshop_l1, per_effect, effect_bps, growth, steps)` — все умножения, одно деление.

Живые входы: `workshop_cost_l1` из `content/out/GENERATED.md` (T2), `research_cost_per_effect_bps` и `cost_growth_bps` из `balance.json` (канон `docs/BALANCE.md` §4: 25000; 15000 — это `city_level_population_growth_bps`, другое имя), `node_effect_base_bps` из `progression.json`.

```
t=2: effect=2000, steps=1
  num = workshop_l1 × research_cost_per_effect_bps × 2000 × cost_growth_bps
  den = 10000^3
  = 33519552   остаток 0

t=3: effect=3000, steps=2
  num = workshop_l1 × research_cost_per_effect_bps × 3000 × cost_growth_bps²
  den = 10000^4
  = 125698320  остаток 0

merge: effect=1000, steps=2
  = 41899440   остаток 0
```

Контроль: `22346368 × 30000 × 3000 × 625000000 / 10^16 = 125698320`, деление нацело.

Тир 1 = 0. Гейты `city_level_req`: `city_level_at_slots_cap = 7`, `building_level_max = 3` → `1 + 6×(t−1)//3` = 1 / 3 / 5. `stake_mult` = t.

Automation: дивиденды 1, 2, 3 часов, база 12 → 18.

Паросочетания непокрытого графа (9 рёбер): 29 = пустое + 9 синглтонов + 16 двоек + 3 тройки. `merge_active_cap = 3`. v1: 3 района, 2 ребра через `consumer`, cap = 1. `builds_raw_v1 = 7695`. Полный `builds_raw = 160608177`.

Прикидка ТЗ t=3 ≈ 125699820 — описка черновой арифметики (`workshop_l1 × 3 × 0.3 × 6.25` и есть 125698320). Floor ни при чём, остаток 0. Генератор прав. R-T4-7.

---

## 2. own_key / cost_key

Из `provides`, без таблицы район→ключ:

| район | provides | own_key | знак | cost_key |
|---|---|---|---|---|
| compute | compute | compute_cost_bps | − | compute_cost_bps |
| energy | energy | energy_cost_bps | − | energy_cost_bps |
| logistics | idle_reduction_bps | idle_reduction_bps | + | energy_cost_bps |
| consumer | population_conversion_bps | population_conversion_bps | + | energy_cost_bps |
| automation | offline_cap_hours | offline_cap_hours | + | energy_cost_bps |
| finance | fund_share_bps | fund_share_bps | + | energy_cost_bps |

---

## 3. v1 простор 7695

Состояния района: 1 закрыт + 2×тир1 + 4×тир2 + 8×тир3 = 15. Три играбельных: 15³ = 3375 без merge (T = ∅).

Две v1-merge пары, обе требуют `consumer` тира ≥ 2, несовместимы. Для T={compute,consumer}: 12² × 15¹ = 2160. Симметрично energy+consumer: 2160. Итого 3375+2160+2160 = **7695**.

Полная сумма по шести районам — генератор, 160608177. Не подгонялась.

---

## 4. Доминирование: модель скоринга

Семейство ≠ все 160M: v1 cartesian + 6×15 одиночных + 9×12×12 пар merge ≈ 9753. Иначе прогон не укладывается в гейт.

`n_prod = slots_start` (8): это стартовые слоты агентов, не GDP в ТЗ; одна Workshop × 8 даёт t3 окупаемым, иначе capital/paper районов вне v1 мертвы.

Бюджет affordable = `deposit_net + gdp`. Терминальные-only (ТЗ) выкидывают merge: 2×(t2+t3) > сезон одной линии. R-T4-8.

Ничья всех affordable по цели не оправдывает никого (иначе `offline_tolerance=12` на всём v1 помечает все узлы живыми).

`fragments_season`: не `produced × stacked fragment_rate`. Иначе шесть `paper` — один ключ, energy/finance paper мертвы. В `spot` считается только бумага района-прожектора; иначе 3×v1 paper бьёт любой одиночный сток. Прокси T6, pending.

`thrift` в `deficit+spot`: дополнительный множитель `|mag|` на производство, если взята бережливость **того** района. Иначе finance scale+capital забирает withdraw, `n_finance_thrift` мёртв. Invert energy/compute в дефиците оставлен.

Итог прогона: сценариев 432 (×3 горизонта), justified 6321, dominating 0, dead 0, mandatory 0, L69 uncovered 0 (vector 502, sibling 2394, between 408, pair_slice 128). depth/breadth flips 2, automation забирает 10000 bps пар offline (дивиденд, не обязательный узел). Ось горизонта — ответ на 3561 неоправданных: без неё тир-1 трёх районов не был argmax.

---

## 5. Инварианты канона на числах T4

- §2.3 касса: узлы не минтят Capital. Нет кода минта в `builds.py` / генераторе узлов.
- §2.8 стройка ничего не платит: узлы — множители, не выплата за факт взятия.
- §2.6 круг 1447 bps: ни один ключ узла не vault/bank/DEX. `fund_share_bps` stacking `add`, city: растущая доля режет остальных через `raw × (BPS+fund) / (n_cities×BPS + fund)`, не печатает.
- §5.3: новые модификаторы — существующие ключи и стадии; целочисленно; `scope_kind` — minor (поле ключа, которого никто не читал), не смена набора стадий. Пак 10.
- §6 записи: набор стадий не менялся. major не требуется.
- Гейт стейка в кратностях `S_min`: проверяем без фида.
- Respec запрещён. Последовательность «тир 3 раньше тира 2» невозможна (`requires_prev`).

---

## 6. Атаки L56–L69

Правило без срабатывания — декорация. Прогон `python content/attack.py`.

| # | мутация | правило |
|---|---|---|
| 1 | `own_key.flat_countable=4` → дивиденды 4/4/4, потолок 24 | L58 |
| 2 | `progression.merge_pairs=["compute+energy"]` (снятие synergy ломает L21 KeyError) | L59 |
| 3 | DIRECT: `{compute+consumer, consumer+energy}` | L60 |
| 4 | `params.merge_active_cap=4` | L60 (+L68) |
| 5 | `params.city_level_req=8` и `building_level_max=1` → req(3)=13>7 | L62 |
| 6 | `stake_mult_step=0` (+ authored `stake_req`) | L62 |
| 7 | `selectors.force_dominating` | L63 |
| 8 | `axes.paper.sign=0` | L64 |
| 9 | `params.tier_cost=1` | L61 (+L68) |
| 10 | `node_effect_base_bps=1` < jitter 500 | L61 |
| 11 | `progression.nodes` = 36 авторских | L57 (+L68) |
| 12 | `offline_cap_hours.scope_kind=building` | L56 |
| 13 | `logistics.playable_v1=true` + stale `v1_nodes` | L66 (+L21) |

Дополнительно: L65 `selectors.force_taken`; L67 снят `pending.modifier_caps` + `output_bps_cap`; L68 копия `cost_growth_bps`; L69 `selectors.zero_effect_orphan` (нулевой узел: недоминируемое и невыигрывающее состояние).

Конструкция: respec=0; узлы ≠ friction keys; stake_mult целая кратность; fund_share add/city; круг 1447 не двинут.

### Что искал и что выстояло

- Обход L59 через live complement без сверки с дисковым каноном: закрыт сверкой с `districts.json` на диске.
- L63 при all-tie offline: определение сужено до непустых argmax, иначе правило декорация. Атака — явный флаг, потому что честный «один билд выигрывает 144×4» ломает взаимоисключающие цели (offline vs capital vs paper).
- L64 paper=0 ловит шесть мёртвых; глобальный stacked fragment_rate обходил бы правило на живом паке.
- L66: формула `6 × playable` плюс замок 18/2/1/7695 к канону §11. Сдвиг флага без авторского списка всё равно падает на 24≠18.
- L62 authored gates: формула из max=7, bmax=7 не даёт req=8; поэтому атака пишет гейт параметром и ломает `building_level_max`.
- Ноль районов / пустое паросочетание: enumerator возвращает `{()}` , cap 0, L60 держит.
- Все шесть на тире 3: terminal-счётчик генератора, не анализ доминирования.
- Нет снимка фида: гейты остаются `t × S_min`.
- Какое число сдвинуть, чтобы гейт молчал, а экономика поехала: `node_effect_base_bps=499` при jitter 500 ловит L61; `498` тоже. `research_cost_per_effect_bps=19999` ловит L44 и L61.

---

## 7. HUD / T9

`HUD.md` §4.3 DISTRICTS: стейк, efficiency, состояния ЗАКРЫТ/ОТКРЫТ. Узлов тира нет. RESEARCH — заглушка. T4 завёл коды отказа; экран — T9 (`pending.progression_hud_screens`).

---

## 8. Список R-T4-*

См. `docs/PROGRESSION.md` §9. Кратко: R-T4-1 канон §4.8/§11/§5.11; R-T4-2 caps T5; R-T4-3 12→18 в v1.1; R-T4-4 paper/T6; R-T4-5 scope_kind minor; R-T4-6 HUD T9; R-T4-7 прикидка ТЗ ошибочна, остаток 0; R-T4-8 affordable vs terminal; R-T4-9 respec=0.
