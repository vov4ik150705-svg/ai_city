# V3-7 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*`; CT engine/assets/light/input/units/world/**close** ≠ пробам этапа; минор < 22 | снят `visual3_form`; ghost; CT ghost/пуст у close; `rules_version` 0.21.0 |
| L384 | `visual3_close.gate_cmd` без `--jobs 8` или `sim.py`; `GATE_VISUAL.md` не редакция v3; нет `observeVisual3Budgets` | stub без jobs; stub без sim; снят fn; заголовок V12 |
| L351 | observe скопирован с потолка; нет `GATE_VISUAL.md`; нет `observeVisualBudgets`; импорт helper | observe=4096; нет файла; снят fn |
| `visual3_budgets_measured` | замер v3 под потолком; close держит jobs 8 | observe=порог → L351; нет `observeVisual3Budgets` → L384; close без `--jobs 8` → L384 |
| `visual3_golden_frames_match` | software-кадр без магенты; GATE v3 | заголовок V12 → L384; close без `sim.py` → L384; пустой CT close → L370 |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. Правил 382. Свободный id **L385**.
