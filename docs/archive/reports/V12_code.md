# V12 — код

Закрытие фазы картинки числами. `launch.deployed` пуст. Пак 81 → **82**. `rules_version` 0.21.0.

## Написано

- `packages/render/src/budget.ts`: `observeVisualBudgets` считает draw-calls формулой чанка, texture из `pagePx² × (4×color + glow L)`; потолки снаружи. `copiedFromCaps` ловит копию потолка.
- `docs/reports/GATE_VISUAL.md`: два профиля `observe.software` / `observe.desktop` с замерами, не с потолками. `GATE_PERF.md` §7 указывает на этот файл.
- Пробы L268: `visual_budgets_measured`, `golden_frames_match`. Голдены: `packages/render/test/golden/probes.json` (City Hall foot, вода, glow окна 200) — осознанный снимок 2026-08-31 с `fallback.png` / `city_glow.png`, `layout_hash` `63aa7ce8…`.
- Линтер L351; `visual_close.gate_cmd` несёт `--jobs 8` и `sim.py`.
- `a_l330_cap` считает те же байты, что L330 (страницы манифеста), не `fallback.png`.

## Не делалось
