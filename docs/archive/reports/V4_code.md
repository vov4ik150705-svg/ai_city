# V4 — код

`render_sprites`: спрайты из атласа на `foot_anchor` переднего угла верхней грани куба, контактная тень, порядок художника, оверлеи уровня, бейджи нехватки на сцене, подсветка футпринта, подписи с порога зума. Механика и живые флаги не трогались. `launch.deployed` пуст. Пак 73 → 74.

## Написано

- Арт (D-V-12, только дозапись): `overlay_pip_v2`, `overlay_antenna_v2`, `badge_shortage_v2`, `badge_occupancy_v2`. `badge_verified` — V11. Hover — Graphics, не `select_ring`.
- `packages/render/src/sprites.ts` — чистый слой: `spriteScreenPos` = `frontVertex − foot_anchor − cubeH − lift`; `sortPlaced` как `scene.py` `(depth, tx)`; `labelsVisible`; `sceneMarkers`; `skipOverlappingLabels`. Без `tileCenter`.
- `objects.ts` / `pixi.ts` — слои `objShadow`, `sprites`, `overlays`, `labels`. Бочка `index.ts` по-прежнему без Pixi.
- Клиент: `packview` читает pip/pulse/hover/select/label и `level_overlays` / `scene_badges`; `SceneHost` держит `foot_anchor`/`kind`; клик стейк/карточка — V6.
- Пак: `level_pip_*`, `badge_pulse_city_minutes`, `hover_outline_*`, `select_lift_px`, `label_min_zoom_*`. L345, L356.
- Vitest имена = `construction_tests` (L268): `sprite_sits_on_foot_anchor`, `painter_order_matches_python`, `level_overlay_from_pack`, `shortage_badge_on_scene`.

## Решения

- Нехватка на сцене: building-kind, когда energy или compute города = 0. У агента нет per-building idle в снимке. Демо `energy=0` → красные бейджи на зданиях — намеренно.
- Подписи — плашки Graphics без `Pixi.Text` (**R-V-26**: глиф-атласа TZ_ART §5 в репо нет; шрифт HUD — V8 / R-V-6). Порог `1/2`. Коллизия — AABB skip, не кегль.
- `hover_outline_alpha_bps` упакован; обводка живёт, пока `hover_outline_px > 0` (делить bps на 10000 в render src нельзя, L340).
- GPU-голдены кадра — V12 (**R-V-25**).

## Не делалось

`art/raw`, `pixelize.py` на v2, правка существующих `*_v2.png`, `commit:build` спавн, камера/клик (V6), грейд (V5), `--jobs 8`, `sim.py`, `launchToken`.
