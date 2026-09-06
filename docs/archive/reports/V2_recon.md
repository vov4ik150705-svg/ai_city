# V2 — разведка

`art_content`: плотность мокапа, кубы земли, ребаланс декора. `launch.deployed` пуст. P7 не начат. Вход V1: пак **71**, `rules_version` **0.21.0**, хеш `21bbfc66…3c75aa`, lint **334/0**.

## Дерево

- Спрайты `*_v2.png` уже покрывают мебель, деревья, порт, кран, фонтан, `wind_turbine`. Нет кубов: `sidewalk`, `plaza_tile`, `parking`, `beach`, `crosswalk`, `waterfall`; нет облаков. Дорожные `*_v2.png` не правим (D-V-12): разметка — новый id `crosswalk`, не впись в `road_straight_v2`.
- `world.py` легенда четыре символа `~ . # r`. Деревья: 305 сакур/зелёных, `decor_realized_share_bps` **1411** при цели **1200** ±400 (полоса держится). Двор маяка — `#` бетон без фонтана. `park`/`plaza`/`wind_turbine` в реестре, в `scene.objects` нет.
- `tiles.py` всё ещё пишет `art/out/tiles` 64×32; `scene.py` читает `art/out` и `CLIFF_DEPTH=11`. Пивот D-V-24: кубы, не ромбы, `art/out` не источник.
- `layout.py` пишет `art/out/scene.json` — противоречит D-V-2. Гейт плана цитирует `layout.py`: сделать проверку хеша пака без записи (R-V-22).
- `art_content.construction_tests` пуст; `gate_cmd` без L354/L355. `_visual_form_errors` требует пустые тесты у всех кроме `visual_form`/`art_atlas`.
- `sign_box` в реестре нет. Маяки уже несут логотип на фасаде; тикер крыши слабый — D-V-12 не даёт переписать PNG.

## ТЗ шага

Выходы PLAN §4 V2: новые `*_v2.png` §3–§4 (дозапись), реестр, виды земли в `world.py` + легенда + `tiles.py` как таблица id (не рисовалка), ребаланс доли, новый `layout_hash`, `pack_version` +1, L354, L355, `V2_*.md`.

Критерий: `world.py` на восьми сидах — один вектор `counters`; `decor_realized_share_bps` в полосе; `art/preview/scene.png` по чеклисту TZ_ART §6.

## Риски

R-V-7 блокирует закрытие, пока нет замера. Порядок TZ §8: сначала тротуар/площадь/парковка, не понижать цель. Счётчики `park_slots`/`plaza_slots` не трогать (D-V-24, economic_bridge). Новые виды суши сужают `free` для деревьев — `tree_count` упадёт, L175 обязан остаться пакетным. `layout_hash` поедет — ожидаемо.
