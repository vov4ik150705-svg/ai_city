# V12 — правила и пробы

## L351

`observeVisualBudgets` в `packages/render/src`; `observedFromThresholds` нет в render/client src; `GATE_VISUAL.md` несёт `observe.software` и `observe.desktop`; каждое наблюдение строго ниже потолка пака и не равно ему; сумма файлов атласа ≠ `atlas_max_bytes`.

Падение: импорт `observedFromThresholds` в `budget.ts`; `observe.*` = потолки; нет `GATE_VISUAL.md`; нет `observeVisualBudgets`.

## Пробы (L268)

`visual_budgets_measured` — формула 67 / 466 / 2599413 / 20971520 и бандл dist-web под потолками; `copiedFromCaps` на потолках красный.
`golden_frames_match` — magenta 0 на fallback и scene.png; три пробы в `golden_channel_delta`; доля отличий ≤ `golden_pixel_delta_bps`; `gradeRgb` четырёх фаз не даёт `#FF00FF`; синтетический ключ `isKey`.

## Конструкция атак

`construction_visual_budgets_measured` — четыре красных входа L351. `construction_visual_stage_keys_exist` требует два имени `visual_close`; пустой/ghost список детектируется.

## Инварианты шага

Круг 1445, вход 200, выход 910, A `[12275, 15783]`, A_t2 14217. `layout_version` 1, homes 25. `missions_live=0`. `--jobs 8` на этом этапе обязателен.
