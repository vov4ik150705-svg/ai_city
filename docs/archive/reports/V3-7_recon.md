# V3-7 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.


## Находки

- L370 ещё держит пустой CT у `visual3_close` (`R-V-82`). Непустой CT этапа красный, пока L370 не сузить как на V3-6.
- `GATE_VISUAL.md` — архив V12: `sprites=669`, `atlas_bytes=2484551`, `bundle_bytes=1009486`. Живой пак: objects **483**, atlas **2469767**, бандл dist-web **1291541**. Pixi `staticDrawCalls(63,8)=67`.
- Граф Three.js (как сажает `three.ts`): land **2845** + water 1 + foam **182** + leftover **41** + walkers **15** + decor families **4** + vehicles **161** + drones **6** + heroes visible **18** = **3273** draw. Потолок пака `draw_calls_max=96` скопирован с V12 и не переживает замер (`L351`).
- `art/preview/scene.png` нет; `fallback.png` есть, magenta 0, пробы hall/water/glow на текущем fallback совпадают. Полный vitest архива `V12` без `scene.png` красный (`R-V-84`).
- R-V-85 жив: 151/161 packed vehicles на `.`, 9 на `r`, 1 на `c`. `layout_hash` не двигаем.
- `pnpm` в PATH может отсутствовать; гейт TS — локальные `tsc`/`vitest`. Desktop GPU-extract нет (R-V-38).

## Риски этапа

- Сузить L370: CT `visual3_close` = `visual3_budgets_measured`, `visual3_golden_frames_match`. Поздних ключей нет.
- L384: `visual3_close.gate_cmd` обязан держать `--jobs 8` и `sim.py`; `GATE_VISUAL.md` — редакция v3; есть `observeVisual3Budgets`.
- `draw_calls_max` переснять с 3273, не копировать 96. Observe ≠ cap.
- `scene.png` = копия software-кадра `fallback.png` (нет WebGL). Архив V12 в `GATE_VISUAL` не вытирается: `archive.v12.*`.
- Не физика, не Pixi-кадр, не `launchToken`, не двигать `layout_hash`, не `missions_live`, не краны NFT.
