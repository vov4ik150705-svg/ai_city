# V3-0 code

Ключи `visual3_form`…`visual3_close` в `arch.roadmap_order` сразу после `visual_close`. `visual3_form.construction_tests` = `visual3_stage_keys_exist`. Поздние этапы — пустой CT. `render.params.visual3_frame_live=0`. `rules_version` 0.22.0, `pack_version` 120. `pending.visual3_threejs_pin` owner=`owner`.

`L370` в `lint.py`. Атаки в `attack.py`. Vitest: `packages/contentpack/test/v0.test.ts`. `p0.test.ts` / `_release_order_after_v11` фильтруют visual+visual3 (`D-V-14`).

## Геометрия (R-V-79 / R-V-80)

Ядро пакует NS-лоты только по футпринтам `base`; `pick_lot` берёт наименьший подходящий лот. Оверлей: пустые `placements`/`props`, `replace_*=0`, тайлы земли сохранены. Кисть не затирает derived `p/w/d/b`; inland `b/d` → трава. Будки не на `s/p` после патча снимаются.

Three.js не импортирован. `world.py` генератор легенды не менял сетку 63 / R 29 / 150 лотов. Круг денег не двигался.

## Файлы

`content/params/{arch,meta,render,pending}.json`, `content/lint.py`, `content/attack.py`, `content/world.py`, `content/fixtures/authored_layout.json`, `packages/contentpack/test/{v0,p0}.test.ts`, канон `DESIGN.md` / `WORLD.md` / `ARCHITECTURE.md` / `HUD.md` / `PLAN_RELEASE.md` / `PLAN_VISUAL.md` / `PLAN_VISUAL_V3.md` / `ROADMAP.md` / `CONTENT.md` / `_STYLE_V3.txt` / `code-phase.mdc`.
