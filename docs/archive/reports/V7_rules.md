# V7 — правила

| id | что ловит | вход падения |
|---|---|---|
| L338 | `Date`/`performance`/`Math.random`/`deltaTime` в render src; нет `vehiclePose`/`worldPrng`/`dronePose`/`popupPose`; `world_prng_bytes` ≠ 8; скорость/кадры ≤ 0 | overlay `Math.random`; `world_prng_bytes=4`; `vehicle_tiles_per_city_minute=0` |
| L357 | `fx.ts` изобретает `amount` / читает capital/output; `fx_popup_ms` ≤ 0; клиент считает попап из capital | overlay `amount: 62n`; клиент `amount = snap.capital`; `fx_popup_ms=0` |
| L190 | машина/дрон на лоте, с `modifier_key`, или `background≠1` | (затронут) юнит на тайле лота |

Затронутые: L268 (три имени vitest), L353 (`gate_cmd` цитирует L338, L357).

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `motion_is_pure_of_city_time` | `worldPrng` = python `world_prng`; два вызова с одним `city_time` совпадают; машина на дороге | `Math.random` → L338; `prng_bytes=4` → L338 |
| `no_wall_clock_in_render` | греп Date/delta/random по `packages/render/src` пуст | скорость 0 → L338; `62n` в fx → L357 |
| `background_units_hold_no_lot` | vehicles+drones `background=1`, вне лотов, без `modifier_key` | capital-попап клиента → L357; `fx_popup_ms=0` → L357 |
