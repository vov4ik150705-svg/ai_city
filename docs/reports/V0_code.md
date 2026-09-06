# V0 — код

Форма фазы картинки в паке. Механика, живые флаги и контракты не трогались.

## Написано

- `content/params/render.json` — потолки PLAN_VISUAL §7 (R-V-3): fps 60, draw 96, sprites 1024, atlas 4194304 B, texture 67108864 B, page 2048 px, golden 50 bps / 2. Derived `frame_budget_us = 1000000 // fps_target` → 16666.
- Схема `$defs.render_file`; единицы `bytes`, `px`; `PARAM_FILES` и `build_render`.
- 13 ключей roadmap между `ops_watch` и `mainnet_launch`. `visual_form.construction_tests` — пять имён. Остальные 12: `construction_tests: []`, `gate_cmd` только на зарегистрированные L (R-V-19).
- `rules_version` 0.21.0, `pack_version` 70. `prize_live_min_rules_minor` 19.
- L306: минор `>= 20`. L329, L347, L348, L353.
- `mainnet_launch.gate_cmd`: `L328` снят (R-V-8). L353 ловит вставку.
- `releaseOrderAfterV11` / `_release_order_after_v11` фильтруют 13 визуальных ключей. Негатив: вставка после `ops_watch`.
- `packages/contentpack/test/v0.test.ts` — ровно пять `it()`.
- Клиент src не менялся: `packview.ts` уже читает `placement["scene"]`.

## Решения

- Потолки — первая редакция §7, не замер V12.
- P7 не регистрирует L328; строка `gate_cmd` правится.
- Зарезервированные этапы V1–V12 не цитируют L330+ до своего шага.

## Не делалось

`packages/render`, `art/out`/`art/raw`, `pixelize.py` на v2, `launchToken`, полный `--jobs 8`, `sim.py`.
