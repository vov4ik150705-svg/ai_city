# V5 — код

`render_light`: четыре фазы суток цветовым грейдом (D-V-4), слой свечения из `city_glow.png`. Форма денег и живые флаги не трогались. `launch.deployed` пуст. Пак 74 → 75.

## Написано

- `packages/render/src/light.ts` — чистый слой: `hourOfDay`, `phaseBlendBps`, `glowGainBps` (0 при `lights=0`), `gradeRgb`. Без Pixi, без `Date`/`Math.random`, без литералов часа.
- `pixi.ts` — контейнер `graded` с `ColorMatrixFilter`; соседний `glow` `blendMode: add`. `setCityTime` обновляет грейд и видимость свечения. Бочка `index.ts` без Pixi.
- Клиент: `packview.light` читает фазы, фонари, окно перехода, `grade_bps`; `SceneHost` грузит `city_glow.png`. Клик стейк/карточка — V6.
- Пак: `phase_blend_city_minutes=120`, `city_minutes_per_hour`, `emissive_gain_bps=8000`, `grade_bps`. L335, L336; L331 требует `gradeRgb`.
- Vitest имена = `construction_tests` (L268): `frame_has_no_magenta_leak`, `lights_off_at_day`, `phase_blend_is_monotonic`.

## Решения

- TZ_RENDER §6.2–6.4 (палитровый LUT / snap) не исполнен: канон шага — D-V-4, ColorMatrix + маска.
- Glow не внутри `graded`: иначе ночной navy тонирует окна. Днём `glow.visible=false` (ноль пикселей слоя).
- GPU-голден кадра — V12 (R-V-25). Доказательство грейда — чистый `gradeRgb`.
