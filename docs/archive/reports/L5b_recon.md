# L5b recon — спрайты T10 и отказ тайла

## Что прочитано

- `docs/reports/PLAN_LIVE.md` §4 `L5b`, §6 `RK-L-8`, §7 `R-L-13`/`R-L-15`, таблица pending.
- `docs/reports/L5a_final.md`, `L0_final.md`.
- `docs/WORLD.md` §2, §5, §11. `DESIGN.md` §9. `docs/SCREENS.md` `build_place`.
- `.cursor/rules/art-pipeline.mdc`. `art/pipeline/assets_pending.json` (19 `todo`), `assets.json` (14 нарисованных).
- `content/params/pending.json` `build_tile_refusal`. `codes.json` / `strings/ru.json`. `screens.json` `build_place`.
- `content/lint.py` L11/L12/L16/L148/L149/L151/L178/L184. `content/attack.py` `a_l178_footprint_5x3`, `construction_t8_pending_kept`.
- `art/pipeline/pixelize.py`, `scene.py` (ключ манифеста), `world.py` (объект попадает в сцену только если `id` в `assets.json`).

## Что найдено в дереве

| факт | где | следствие |
|---|---|---|
| 19 id со `status=todo` | `assets_pending.json` | L16 печатает 19 строк PENDING |
| 12 зданий и 10 filler без `sprite` | `buildings.json` | L16 считает `null` недорисованным |
| `world.py` кладёт объект в сцену только из `load_assets()` | `world.py:1293` | пока спрайта нет, лот на эталоне пустой — отсюда «остров из деревьев» |
| `scene.py` падает на `manifest["sprites"][id]` | `scene.py:228` | новые id обязаны пройти `pixelize.py` до `scene.py` |
| `a_l178` ломает футпринт `workshop` в pending | `attack.py:1212` | после переноса workshop в `assets.json` атака станет декорацией, если не перенацелить |
| `construction_t8_pending_kept` требует `build_tile_refusal` | `attack.py:3785` | закрытие pending без правки пробы роняет конструкцию T8 |
| `build_place.requires` = city_level / build_slot / capital | `screens.json:230` | отказ тайла недостижим, пока нет capability и кода |
| L151: новый токен без группы | `LAW_C_TOKEN_GROUP` | токен обязан быть в unlock 30–39, иначе L151; на `build_place` min tier 30 уже занят `city_level` → новый unlock только 31–39 |
| `LAW_C_TOKEN_GROUP` не содержит ключ для тайла | `lint.py:3141` | завести `build_tile` → unlock 31 |
| Сырьё существующих спрайтов 1024×1024, фон `#FF00FF` | `art/raw/` | новые raw — тот же контракт, существующие raw не трогать |
| Палитра 53 цвета, квант жёсткий | `pixelize.py` `quantize` | RK-L-8 держится квантом и счётом цветов в кадре |
| `art_sprites.construction_tests` пустой | `arch.json` | как у `art_ground`: пробы не vitest, L268 не трогать новым `it()` |
| `pack_version` 37, rules 0.18.0 | `meta.json` | код+строка — minor, +1 к pack_version; formulas не трогать |

## Риски этапа

- `RK-L-8` — новый цвет в кадре. Держится квантом в палитру и пробой `sprite_pixels_in_palette`.
- `a_l178` молчит после переноса 19 id в `assets.json` — закрыть перенацеливанием на ghost-вид.
- Смешение стиля: маяки — диффузия, новые — нет. Сырьё гонится тем же контрактом raw (magenta, без земли и тени).
- `layout_hash` поедет: в сцену войдут workshop/filler, которых не было. Это не дефект: планировка не вход тика (`L182`).
- Пустой `assets_pending.json` vs удаление файла: файл оставить с `assets: []`, на него ссылаются WORLD/CONTENT/build.

## Решение по коду отказа

Один код `BUILD_TILE_ILLEGAL`, категория `refusal`, слотов нет. Текст закрывает грамматику WORLD.md §2: вода, берег, дорога и двор. Capability `build_tile` (unlock, tier 31) на `build_place`. L150: min blocking остаётся `city_level`=30 единственным.
