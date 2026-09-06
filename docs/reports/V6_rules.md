# V6 — правила

| id | что ловит | вход падения |
|---|---|---|
| L337 | зум 3/2 в render src; нет `clampCamera`/`snapZoomIndex`/`zoomInPack`/`tileFromWorld`/`routeSceneClick`; `camera_bounds` min≥max; порог ввода ≤ 0; zoom_levels не степень двойки | overlay `{ num: 3n, den: 2n }`; stub без `clampCamera`; invert min/max; `pan_deadzone_px=0` |
| L185 | зум не степень двойки; safe rect; HUD geometry | `zoom_levels` 3/1; колонка HUD 0 |

Затронутые: L268 (три имени vitest), L353 (`gate_cmd` цитирует L337).

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `zoom_levels_from_pack` | только packed ratios; 3/2 не уровень; остров влезает на min | overlay 3/2 → L337; 3/1 → L185 |
| `camera_clamped_to_bounds` | центр вне min/max прижимается | invert bounds; нет `clampCamera` → L337 |
| `click_maps_to_tile` | центр+4 угла ромба; вода → `""`; маяк закрыт → `districts`; workshop → `building_card`; не `commit:build` | `pan_deadzone_px=0` → L337 |

Мутатор bounds снимает `_lint_t10`.
