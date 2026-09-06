# V8 — правила

| id | что ловит | вход падения |
|---|---|---|
| L341 | геометрия не из `hud_layout.json`; `\d+px` после `HUD_TOKENS_END`; `@media` с px; клиент не вяжет `--hud-col` ← `column_width_px`; фикстура ≠ 260/56/40/48 | `width:260px` после END; `@media (max-width:900px)` в блоке токенов; `column_width_px=200` |
| L342 | нет `BankPlaque`, `PAYROLL_TRIMMED`, `idleText`, или нет пары `data-stock-market` + `data-stock-effect` | overlay без plaque / без PAYROLL / одна сток-строка |
| L343 | кириллица в `apps/client/src` `.ts`/`.tsx` или `hud.css` | `<span>банк</span>` в App |
| L344 | CDN (`fonts.googleapis` / gstatic / `@import https`); нет woff2 в клиенте; файлы опущены; sha ≠ derived; нет OFL | `@import` CDN; `_omit_hud_fonts`; sha `0*64` |
| L146 | кириллица в `screens.*.label` (не `ru.json`) | (затронут) label кнопки |

Затронутые: L268 (четыре имени vitest), L353 (`gate_cmd` цитирует L341–L344), L319 (codegen workflow под новый `pack_hash`).

Пробы L268 1:1:

| имя | зелёный | красный |
|---|---|---|
| `hud_geometry_from_fixture` | CSS vars = фикстура 260/56/40/48; после END нет px; SI 9999 / 10.0k | 260px / `@media` px / column=200 → L341 |
| `bank_plaque_always_present` | Topbar импортирует BankPlaque; три кода плашки | снятие BankPlaque → L342 |
| `payroll_row_appears_when_trimmed` | при bps нет строки; при bps−1 есть PAYROLL_TRIMMED | снятие PAYROLL_TRIMMED → L342 |
| `stock_bar_shows_two_numbers` | оба data-атрибута; price и effect непустые | одна строка → L342; кириллица → L343; CDN/omit/hash → L344 |
