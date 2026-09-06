# V9 — правила

| id | что ловит | вход падения |
|---|---|---|
| L358 | нет `<id>.tsx` у `kind=screen`; лишний `.tsx`; лишний `.ts` кроме `registry.ts`; `PACK_SCREEN_IDS` ≠ пак; `commit:build` в screens | `ghost_screen.tsx`; omit `bank.tsx`; `commit:build` в `build.tsx` |
| L273 | нет кода/текста `BUILD_TILE_ILLEGAL`/`NO_FREE_BUILD_SLOT`; они не в `retired_refusals`; `build_place` или любой `commit:build` живы; capability `build_tile`/`build_slot` сняты | restore `build_place` + `commit:build` |
| L149 | недостижимый refusal; state без поверхности; retired-код всё ещё в живой матрице | `WALLET_NOT_CONNECTED` в `retired_refusals` |
| L145 | экран без `empty_kind`/`loading_kind` | снять `empty_kind` у `agents` |
| L148 | токен вне capabilities / код не refusal | ghost code; blocking с category state |
| L150 | два blocking в одном min-тире | `building_upgrade` + `district_open` и `city_level` |
| L151 | группа тиров вне диапазона | `district_open` tier 55; `wallet_chain` tier 9 |

Затронутые: L268 (три имени vitest), L232 (`/command/build` выпал из биекции), L353 (`gate_cmd` цитирует L358), L319 (codegen под новый `pack_hash`).

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `every_screen_has_empty_and_loading` | 15 `.tsx` = pack ids; empty/loading; registry без `commit:build` | нет `empty_kind` → L145; omit `bank.tsx` → L358 |
| `refusal_shows_one_blocking_code` | withdraw + wallet+capital → `WALLET_NOT_CONNECTED`, rest Capital; 6 шагов онбординга | два unlock на upgrade → L150 |
| `no_cyrillic_in_components` | screens + `hud.css` без кириллицы | кириллица → L343; ghost / `commit:build` → L358 |
