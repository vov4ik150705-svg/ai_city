# V8 — код

`hud_shell`: каркас плотности мокапа — топбар, две колонки, сток-полоса с двумя числами, нижнее меню, токены, вендоренные OFL-шрифты. Форма денег и живые флаги не трогались. `launch.deployed` пуст. Пак 77 → **78**.

## Написано

- Клиент: дерево `topbar/` `left/` `right/` `center/` `parts/`; `App.tsx` только композиция. Геометрия — CSS-переменные из `hud_layout.json` (`hudShellVars`). Узкий порог — `2 × column_width_px + packSafeW`, не `@media` px.
- Несрезаемое: `BankPlaque` всегда; `PAYROLL_TRIMMED` только при `payrollRatioBps < pack.bps`; `idleText`; сток-ячейка `data-stock-market` + `data-stock-effect`.
- `formatSi` в `parts/si.ts` от `hud_si_min` / `hud_si_base`. Часы тикают `hud_clock_interval_ms` через `clock.ts`.
- Шрифты: `art/fonts/press_start_2p.woff2` + `ibm_plex_sans.woff2` (OFL-1.1), хеш в `derived.render`. `FontFaces` грузит `*?url`, семьи с LiveRoot из пака; логин — алиасы `hud-pixel`/`hud-log`. CDN нет.
- Пак: L341–L344; `hud_shell` gate/tests/construction; `UI_COL_LEFT`/`UI_COL_RIGHT`.
- Vitest L268 1:1: `hud_geometry_from_fixture`, `bank_plaque_always_present`, `payroll_row_appears_when_trimmed`, `stock_bar_shows_two_numbers`.

## Решения

- R-V-6: Press Start 2P + IBM Plex Sans (план, кириллица в cmap).
- SceneHost остаётся `hud/SceneHost.tsx` (**R-V-32**).
- Узкий порог выведен, ключ `hud_narrow_threshold_px` не заводился (**R-V-33**).
- TZ city LV/XP, Productivity, sparkline, WebSocket — не в гейте V8 (**R-V-31**).

## Не делалось

Экраны V9, `build_place` снятие, миссии, NFT, `--jobs 8`, `sim.py`, `launchToken`.
