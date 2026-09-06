# V7 — код

`render_motion`: позы машин, дронов, дыма и FX — чистая функция `city_time` и сида планировки (`demo_seed`), не кадровой дельты. Форма денег и живые флаги не трогались. `launch.deployed` пуст. Пак 76 → 77.

## Написано

- `packages/render/src/motion.ts` — `worldPrng` = sha256[:8] как `content/world.py`; `vehiclePose` по дорогам без разворота, если есть иной ход; `dronePose` по периметру квартала; `atlasFrame` / `smokeSpriteId` / `birdVisible`. Сид — строка `placement.demo_seed`, не per-player `city_id`.
- `fx.ts` — `popupPose` пропускает `event.amount`; `glowGainWithTick`.
- `pixiMotion.ts` — движущиеся спрайты; дым на `wind_turbine`/`energy_plant`; баннер на `city_hall`; слой FX если `fxEnabled`.
- `objects.ts` пропускает `vehicle`/`drone` (лот не держат, L190); `camera.ts` `objectAtTile` тоже.
- Клиент: `packview.motion`; блоки квартала из `x0`/`y0` + `road_period_tiles` (в `generated.placement.blocks` нет `west`/`north`). `popups: []` — в снимке нет per-building output.
- Пак: скорости/кадры/FX в `render.json`. L338, L357. `construction_tests` три имени.

Vitest имена = L268: `motion_is_pure_of_city_time`, `no_wall_clock_in_render`, `background_units_hold_no_lot`.

## Решения

- Поворот машины: `world_prng % n` как TZ_RENDER §8, не `draw_below` (**R-V-28**).
- Нет PNG `turbine_blade_*` / `flag_*` / `bird_*` (D-V-12): кадр турбины 1, флаг = `banner`, птицы считаются и не рисуются.
- `fx_popup_ms` в паке; длительность позы — 1 тик города, пока HUD/clock не смапит мс (**R-V-29**). Число попапа не выдумывается.

## Не делалось

`art/raw`, `pixelize.py` на v2, правка существующих `*_v2.png`, спавн `commit:build`, `--jobs 8`, `sim.py`, `launchToken`, каркас HUD (V8).
