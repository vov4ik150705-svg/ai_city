# V4 — правила

| id | что ловит | вход падения |
|---|---|---|
| L345 | `label_min_zoom_num/den ≤ 0` или в render src нет `labelsVisible` | `label_min_zoom_num=0` |
| L356 | нет `spriteScreenPos` / `frontVertex` / `painterDepth`, или в `sprites.ts` есть `tileCenter` | overlay `sprites.ts` с `tileCenter` |

Затронутые без новых id: L180 (оверлеи уровня из пака), L181 (`IDLE_*` на сцене или `log_only`), L268 (четыре имени vitest), L330/L331 (атлас 179 кадров, magenta 0).

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `sprite_sits_on_foot_anchor` | City Hall: TS `spriteScreenPos` = `scene.py` front − atlas `foot_anchor` − cube drop | overlay `tileCenter` → L356 |
| `painter_order_matches_python` | список id = python `(depth, tx)` по кадрам атласа | то же L356 |
| `level_overlay_from_pack` | L1: 0 pip / 0 antenna; L3: 2 pip / antenna | `sprite_id_depends_on_level=1` → L180 |
| `shortage_badge_on_scene` | energy=0 → `badge_shortage` в `sceneMarkers`; energy>0 → нет; зум ниже порога → `labelsVisible=false` | drop `state_source` → L181; zoom num=0 → L345 |

Мутатор `a_l181_drop_badge_source` снимает `_lint_t10`: иначе deepcopy после зелёного прогона кормит L181 кэшем и атака молчит.
