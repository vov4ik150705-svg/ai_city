# R-V-60 final

Не P7. Пак **104**, хеш `70fde0b8c0305e7cca8b19aa65b07f2359778f3e5d61dbb62cc69c7cf4adb597`. Круг 1445 / вход 200 / выход 910. Окно A `[12275, 15783]`. `layout_hash` `9cfe5934e08b`. `launch.deployed` пуст. Фикстура пустая.

lint 367/0 (L174 warn 1198). attack `--only L177,L184,L175,L368,L329,L273,L367,L369` 16/16. vectors 21, sha `6ec7ade5…9d4357`, `layout_version` 1. tsc render OK; eslint изменённых TS OK; vitest 22/0.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| пустой оверлей | объекты только `id`,`tile` | 669 / extra_keys 0 |
| `oy=2` / `lift=3` | dy +2 / −3 | стояло после фикса `instance_place` |
| патч `r` в `.` | дорога жива | `r` @ 24,3 |
| `w_px=40` `h_px=50` | размер инстанса | 40×50 |
| JPEG 4112 на GET | img не рвётся | закрыто: земля PNG 561625 B за 0.29 с + живой слой |
| L177 без hall | падает | падает |
| отдельное имя vitest | L268 | сначала красный; вшито в `ground_matches_python_scene` |
| три процесса на :8765 | один сервер | убиты, слушает один |

Выстояло: identity оверлея, запрет красить `r`, L177/L184/L368. Найдено и закрыто: `oy` не двигал спрайт; JPEG рвал кадр; студия не показывала размер без пересборки.

## Расхождения

R-V-60 (этот шаг). Кэш `art/preview/studio_ground.png` в `.gitignore`. Фасады 3/4 — R-V-49/57. L353/L328 — выход. L174 не на точке 1200.

## Как собрать карту

```
python content/studio.py
# тащить спрайт, длина/высота, кисть пола, Save
python content/build.py
python art/pipeline/scene.py
```

Незакрытое: `attest_testnet` / LLM-снимок / `pause_ready_delay` — owner. P7 не начинать.

Next: владелец правит остров в студии. Не P7.
