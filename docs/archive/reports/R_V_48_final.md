# R-V-48 final

Не P7. `launch.deployed` пуст. Пак **94**, хеш `fde95ee4501b79c4a12483e79a3883fb091e167cdb5da60f45c6031c66be7cd2`. Круг 1445, вход 200, выход 910. `layout_hash` `82bb5e29709e` (карта не двигалась). Атлас 269 / 1983915 B.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 362/0 (WARN L174 1198≠1200) |
| `python content/build.py` | 0; 659250 B |
| `python content/codegen.py --check` | 23, hash `fde95ee4` |
| `python content/attack.py --only L359,L330,L363,L268` | 14/14 |
| `python content/attack.py --only L351` | 4/4 |
| construction L359 | OK (wide + stretch) |
| `python content/vectors.py` | 21; sha `597acb55…327bc1`; layout_v1; homes 25 |
| render tsc+vitest | 22/0 |
| `python art/pipeline/scene.py --grid` | 4112×2200 |

## Атаки

Ширина 235, растяжка h×2, L330 cap/sha/shelf, L268 имена, L363 pad, L351 порог. Сломанные входы не выстояли.

Остаётся: угол камеры у отдельных `*_v2` может чуть расходиться с кубом 2:1 — это исходник, не squash. R-V-38 без WebGL.

## Next

Смотреть `art/preview/scene.png`. P7 не начинать.
