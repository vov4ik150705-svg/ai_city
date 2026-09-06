# R-V-47 code

Не P7. Пак **93**. `rules_version` 0.21.0. Тела `*_v2` не переписывались (D-V-12).

## Плинтус

`tiles.LOT_PAD = plaza_tile`. `LOT_PAD_SKIP = (park, plaza)`. Derived пака: `lot_pad`, `lot_pad_skip`. Карта не меняет букву: занятость — презентация (`groundTopId` / `apply_lot_pad`). `layout_seed` и `tick_inputs` не трогались.

## Рендер

`padFootprints` → `groundTopId`: трава под футпринтом здания → `plaza_tile`; пустая трава и `r`/`s`/`k` без смены. Pixi верхние кубы через `groundTopId`, не `topSpriteId`.

## Контакт

`drawContact`: эллипс, `contact_shadow_alpha_bps=2800`, `contact_shadow_inset_bps=7500`, знаменатель `grade_bps`. Индекс `pts` через `1+1` (L340). Ромб остаётся у hover.

## Клиент

`packview` читает derived и params. `SceneHost` / `App` прокидывают в Pixi. Occupancy-проверки — внутри существующего `it("ground_matches_python_scene")`, без нового имени (L268).
