# T5 recon — система модификаторов

Исследовательский отчёт задачи T5 (порядок стадий, потолки, сплав). Канон-документ — `docs/PROGRESSION.md` §T5. Широкие таблицы — `content/out/GENERATED.md` (секции «T5: …»). Код-половина T5 уже была на диске до этого шага; документ, сверка с каноном, L88/L89 и новый адверсариальный проход — здесь.

---

## 1. Что было на диске до шага

Проверено, не переписано: `content/build.py` (`build_modifier_caps`, `build_modifier_rows`, `build_modifier_content_floor`, `build_stack_probe`, `apply_stack`, `fused_muldiv`), `content/lint.py` L70–L87, `content/attack.py` векторы L70–L87, `content/params/modifiers.json` / `modifier_keys.json`, `pending.modifier_caps` снят. Пак 191735 байт, hash `fb3d27c2dbaa0f94983bff6302bcf0bc7aa9c160a57fee1b9f9a79a7759220ab`, rules 0.8.0, pack_version 11. Параметры T1–T4 не трогались.

Написано на этом шаге: `docs/PROGRESSION.md` §T5.1–T5.9; пословные правки `DESIGN.md` §5.3/§5.9/§5.10/§5.13/§11, `docs/BALANCE.md` §14 строка T5, `docs/CONTENT.md` §2/§6; L88, L89; ≥6 новых векторов и 4 construction-пробы границы.

§12 `DESIGN.md` не тронут: там развилки (пул, стейк, трение, слоты, сезоны), не таблица контента. Система модификаторов — T0/T5 поверх уже существующего §5.3, не новая развилка.

---

## 2. Тринадцать потолков из якоря

Числа — `content/out/GENERATED.md` «T5: потолки ключей». Пересчёт совпал с генератором.

| ключ | якорь | источник | арифметика | cap_max | cap_min | floor high | запас |
|---|---|---|---|---:|---:|---:|---:|
| `output_bps` | `output_growth_bps` | `balance.json` | кривая | 18000 | 5555 | 16802 | 1198 |
| `energy_cost_bps` | `energy_growth_bps` | `balance.json` | кривая | 16000 | 6250 | 12325 | 3675 |
| `compute_cost_bps` | `energy_growth_bps` | `balance.json` | та же кривая | 16000 | 6250 | 10000 | 6000 |
| `build_cost_bps` | `cost_growth_bps` | `balance.json` | кривая | 25000 | 4000 | 10000 | 15000 |
| `upgrade_speed_bps` | `build_time_growth_bps` | `balance.json` | кривая | 16000 | 6250 | 11000 | 5000 |
| `xp_rate_bps` | `xp_growth_bps` | `balance.json` | кривая | 16000 | 6250 | 11000 | 5000 |
| `fragment_rate_bps` | `output_growth_bps` | `balance.json` | twin выхода | 18000 | 5555 | 11500 | 6500 |
| `population_conversion_bps` | `output_growth_bps` | `balance.json` | twin выхода | 18000 | 5555 | 13946 | 4054 |
| `idle_reduction_bps` | `residual_idle_bps` | `balance.json` | `10000 − residual` | 9500 | 0 | 5523 | 3977 |
| `jitter_bps` | `trait_relief_share_bps` | `modifiers.json` | один Steady | 5000 | 0 | 5000 | 0 |
| `agent_slots` | `slots_span` | `agents.json` | `20 − 8` | 12 | 0 | 0 | 12 |
| `offline_cap_hours` | `sum_tiers_countable` | `progression.json` | `1×(1+2+3)` | 6 | 0 | 6 | 0 |
| `fund_share_bps` | `sum_tiers_bps` + merge | `progression.json` | `500×6 + 500` | 3500 | 0 | 3500 | 0 |

`10000² / 18000 = 5555` (floor). `10000² / 16000 = 6250`. `10000² / 25000 = 4000`. Сошлось.

Compute без своей кривой: иначе compute-стек той же глубины обогнал бы energy. L88 держит карту семей.

---

## 3. Пять законов

**A. Платная строка не улучшает окупаемость.** L76. Вход: Overclock `Δenergy=1000` при `Δout=1000` (`a_l76_overclock_cheap`) → `net_payback` ниже базы. Честный: Overclock 322 ≥ 319, Frugal 319 = 319. Сообщение: `{src} net_payback {pb} < base {base}: a free lunch on capital`.

**B. Потолок якорится на кривую семьи.** L71 ловит литерал; L88 ловит чужой реальный параметр. Вход: `cap_anchors.output_bps.max_from = cost_growth_bps` (`a_l88_foreign_anchor`) → потолок стал бы 25000 вместо 18000. L71 молчит (параметр существует). L88: `{kid} anchors to cost_growth_bps, family curve is output_growth_bps`.

**C. Сплав, одно деление, некоммутативность поэтапного.** L75. Вход: `witness_a = witness_b` (`a_l75_witness_equal`) — свидетель нем; `wipe_on_zero` / `count_zeros_as_divs` — ноль перестаёт быть no-op. Честный: 3×1.50×1.30 → 5 / 4 / fused 5; делений 14 при 50 нулях `mul` и при 50 нулях `mul_remainder`.

**D. Остаток никогда не ноль; клип не молчит.** L78 / L87 / L11. Вход: `residual_idle_bps=0` (`a_l78_remainder_zero`) — два источника на потолке дают 0. `silent_clip=1` — клип без кода. Текст `MODIFIER_CAP_CLAMPED` снят из overlay (`a_l87_text_removed`) → L87 и L11.

**E. Бесплатный стек в [240, 324].** L77. Зонд — `unpaid_content_rows` (`paid=0` ∩ trait/objective) через `content_floor`, не два id. Честный стек тот же: Specialist home × Overclock = 12650 / energy 14500 / нетто 280. Вход: specialist 2092 → 13301 > 13300 (`a_l77_window_over`). Сосед +649 (2090 → 13299) — construction. Приёмка нашла дыру: новая строка `specialist_home2` +700 проходила все 89 правил; закрыто `a_l77_new_free_row_700` (13535 > 13300). Energy −5000 на Overclock → нетто 235 < 240.

---

## 4. Атаки T5

Прежние L70–L87 на месте. Новые:

| мутация | правило | сторона |
|---|---|---|
| `output_bps.max_from = cost_growth_bps` | L88 | дыра L71 |
| specialist 2092 → o=13301 | L77 | граница +651 (уже зашитая черта) |
| specialist 2090 → o=13299 | construction | граница +649 |
| `specialist_home2` +700 output (источник specialist) | L77 | дыра приёмки: раньше NONE |
| `specialist_home2_649` +649 output | L77 | третий mul 13470 > 13300 |
| `specialist_home2` +500 output | construction | квант внутри форточки (13282) |
| Overclock energy2 −5000 | L77 | net_payback 235 < 240 |
| `respec_allowed=1` | L89 (и L62) | exclusive |
| `stack_exclusive_pairs=1` | L89 | пол обеих сторон |
| числитель 193 бит | L86 | верх битности |
| числитель 192 бит | construction | низ битности |
| `agent_slots` cap=12 derived | construction | L79 не слишком строг |
| cap=13 stored | L79 | уже было |
| текст `MODIFIER_CAP_CLAMPED` снят | L87 + L11 | молчание внешнего |
| `silent_clip=1` | L87 | клип без кода |
| `count_zeros_as_divs=1` | L75 | 50 remainder-нулей как деления |
| 50 remainder-нулей на честном | construction | делений 14 |

`content_floor` при `respec_allowed=0` берёт одну сторону пары на тир. Стороны пары — **разные ключи**, поэтому пол одной оси не суммирует обе. Оценка не «сверху»: это легальный максимум. Обход — respec (L89).

### Что искал и что выстояло

- Подмена якоря на существующий чужой параметр: L71 пропускал; закрыто L88.
- Бесплатная строка внутри запаса 650 bps (двухфакторный сдвиг specialist): +649 проходит, +651 нет. L77 не слишком строг и не нем.
- Exclusive через пол: код не складывает обе стороны на один ключ (R-T5-7). Дыра — respec, не floor.
- 192 бит проходит, 193 падает: L86 не слишком строг.
- cap слотов 12 проходит, 13 падает.
- Нулевые `mul_remainder` не меняют делений и не обнуляют произведение.

### Что нашлось в адверсариальном ревю приёмки

L77 был декорацией для нового контента. Воспроизведение: строка `specialist_home2` `{source_kind:trait, source:specialist, key:output_bps, magnitude:700, applies_when:affinity_home}` — **700 → NONE** по всем 89 правилам; 900 → только L70 (content_floor vs cap 18000, не форточка 13300). Причина: `free_stack_oe` брал два id (`specialist_home`, `overclock_output`) и не читал таблицу; `a_l77_window_over` двигала уже зашитую величину. Закрыто: unpaid-строки через `content_floor`. После починки 700 → L77 `free output stack 13535 > window 13300`. Третий mul +649 → 13470, тоже выше форточки (это не двухфакторный slack 13299). Проходящая новая строка — квант +500 → 13282. Energy: отдельной форточки 13300 нет; −5000 на Overclock роняет нетто до 235, L77 ловит. R-T5-6 закрыт, дыра названа R-T5-14.

### Что не закрыто (владельцы)

| риск | владелец |
|---|---|
| строки T5 не в `tick.py` / `sim.py` | T11 |
| HUD показ клипа и запаса до потолка | T9 |
| `fragment_rate_bps` без пула | T6 |
| веса Influence vs cap 3500 | T7 |
| Scientist magnitude 0 | v1.1 |
| compute floor ниже cap_min | клип L87; якорь не меняли |

---

## 5. Инварианты канона на числах T5

- Касса: модификаторы не минтят Capital. Нет кода минта в `apply_stack`.
- Фонд: `fund_share_bps` — `add`, вес в пропорции, не множитель выхода.
- Трение 14.47%: ни один ключ не vault/bank/DEX.
- Тик детерминирован: сплав чистый, LLM снаружи, случайность только сид дрожи.
- Стройка не платит: `build_cost_bps` — скидка стоимости, не выплата за факт.
- Запрещённый список: нет LLM в тике, нет минта сверх фонда, нет «NVDA +20% → деньги».

---

## 6. Исключения

`exceptions.json` пуст. Бюджет не тратили.

---

## 7. Гейты этого шага

`python content/build.py` ×2: 191735 байт, hash `fb3d27c2dbaa0f94983bff6302bcf0bc7aa9c160a57fee1b9f9a79a7759220ab` совпал (зонд не двигает пак: 12650/14500/280 те же). `python content/lint.py`: rules run 89, ERRORS none. `python content/attack.py`: 182 (131 мутаций + 5 прямых + 46 construction), every rule caught, 89 covered, construction held 46, exit 0. Добавлено: `a_l77_new_free_row_700`, `a_l77_new_free_row_649`, `a_l77_energy_relief`, `construction_t5_new_free_row_under_window`. `python content/builds.py`: justified 6321, uncovered 0, dominating/dead/mandatory 0.
