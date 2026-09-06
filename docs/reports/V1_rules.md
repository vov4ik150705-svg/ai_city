# V1 — правила и пробы

| id | Что ловит | Вход падения |
|---|---|---|
| L330 | нет хеша; байты > `atlas_max_bytes`; id реестра без `foot_anchor`/`footprint`; x/y/page ≠ каноническая полка | `_atlas_drop_hash`; `atlas_max_bytes = факт−1`; обмен x/y двух кадров |
| L331 | видимый атлас не RGBA или непрозрачный `#FF00FF` | RGB/магента overlay `_atlas_city_png`; key-out выключен тем же overlay |
| L332 | нет alpha; glow другого размера; здание с окнами без `G>0` | RGB без alpha; `_atlas_glow_zero` |
| L178 | спека футпринта 5×3 | существующая атака `a_l178_footprint_5x3` |

Пробы `art_atlas` (L268 1:1):

| имя | Красный вход внутри construction |
|---|---|
| `atlas_pack_is_deterministic` | нет sha; cap−1; shuffle x/y |
| `atlas_key_fully_removed` | непрозрачная магента |
| `atlas_bytes_under_cap` | cap−1; нулевой glow зданий |

Vitest `it()` читает зелёный диск (хеш/магента 0/байты ≤ cap). Красный прогон — Python construction, не vitest.
