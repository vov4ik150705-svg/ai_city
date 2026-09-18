# V8 final


Пак **78**, хеш **`e9558ac9dbf5f20ed73b7e184e5a80687ecde16351abc7d6266022ea9bb0d51f`**, 622349 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров, magenta 0, sha `acd419041ca4`. `layout_hash` `63aa7ce8cc09…` (геометрия не сдвинулась). Шрифты: pixel `af0af491df93` Press Start 2P, log `ba711a3085ff` IBM Plex Sans.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 352 / 0 |
| `python content/build.py` | 0; pack 78; 622349 байт; hash `e9558ac9…0d51f`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `e9558ac9`; `--check` match |
| `python content/attack.py --only L146,L341,L342,L343,L344` | 11/0 пойманы |
| construction четыре имени V8 | OK на зелёном (None); красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `8a9ff3ee…0cf8b6b` (сдвиг с pack_hash, R-V-14); `layout_version` 1; `record_field_homes` 25, тот же инвентарь |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 14/0 (10 прежних + 4 V8) |
| contentpack `v0.test.ts` | 5/0 |
| eslint `apps/client/src/hud` + packview/index/v8.test | 0 |
| `vite build` JS | 766430 B < `client_bundle_max_bytes` 2500000 (woff2 в бандле) |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`/`vite`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26). `len(CONSTRUCTION)` = **276**.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `width:260px` после HUD_TOKENS_END | L341 | caught |
| `@media (max-width:900px)` в блоке токенов | L341 media | caught |
| `column_width_px=200` | L341 fixture | caught |
| снять BankPlaque | L342 | caught |
| снять PAYROLL_TRIMMED | L342 | caught |
| сток без `data-stock-effect` | L342 | caught |
| кириллица в App | L343 | caught |
| `@import` CDN | L344 | caught |
| omit woff2 | L344 | caught |
| sha mismatch | L344 | caught |
| L146 label кириллица | L146 | caught |
| payroll bps vs bps−1 (A-V-17) | строка только при trim | vitest |
| три кода плашки (A-V-19) | SUNDAY/CLOSED/UI_BANK | vitest |
| клик сквозь HUD (A-V-11) | панели `z-index:1; pointer-events:auto` | CSS |
| `--jobs 8` в `gate_cmd` этапа | нет (A-V-26) | нет |
| CDN шрифта в src | нет | L344 |
| `city_id` задаёт геометрию | нет | `layout_hash` прежний |
| `missions_live` / NFT / window A | не тронуты | L348 |

Выстояло (не закрывается кодом V8): GPU-голден Pixi (**R-V-25**, V12); глиф-шрифт подписей (**R-V-26**); один кадр воды (**R-V-24**); различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations.

## Расхождения

- **R-V-6** закрыт: Press Start 2P + IBM Plex Sans.
- **R-V-31.** TZ §4 city LV/XP, Productivity, 7-day sparkline и TZ §10 WebSocket не в гейте PLAN V8 — не реализованы.
- **R-V-32.** `SceneHost` остаётся `apps/client/src/hud/SceneHost.tsx` (TZ дерево писало `center/`).
- **R-V-33.** Узкий порог выведен (`2 × column_width_px + packSafeW`), ключ `render.hud_narrow_threshold_px` не заведён (L09).
- Наследуются **R-V-14, 24, 25, 26, 27, 28, 29**. `build_place` до **V9**. `L353`/`L328` — владелец фазы выхода.

## Готовность

Критерий PLAN_VISUAL §4 V8: плашка банка, Payroll при урезании, причина простоя и два числа сток-бара покрыты тестами; px вне блока токенов нет; бандл JS под потолком пака. Next: V9 — `hud_screens`.
