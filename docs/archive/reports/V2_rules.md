# V2 — правила

| id | что ловит | вход падения |
|---|---|---|
| L354 | вид земли не в `tiles.GROUND_KINDS`, не в `world.SCENE_LEGEND`, спрайт не в реестре, или символ карты вне легенды | `_tiles_extra_kind={"x":…}`; `map[0][0]='x'` |
| L355 | у маяка района нет `sign_box` длины 4 | `_drop_beacon_sign=finance_tower` |

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `new_ground_kinds_registered` | десять символов в легенде и на карте | extra kind / чужой символ → L354 |
| `decor_share_within_band` | realized в `target±tol` | `decor_target_share_bps=9000` → L174 (1749 vs 9000±400) |
| `beacon_has_logo_and_ticker` | шесть маяков с `sign_box` | снятие с `finance_tower` → L355 |

Затронутые без новых id: L169, L174, L184, L186, L187, L189, L190, L191.
