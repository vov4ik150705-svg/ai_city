# V4 final

`render_sprites`: здания/декор/юниты из атласа на `foot_anchor`, тень, порядок художника, оверлеи, бейдж нехватки на сцене, подписи с порога зума. `launch.deployed` пуст. Водяной знак 19. `missions_live=0`, краны NFT 0, `companion_revenue_live=0`, `window_a_ratified=1`, `season_prizes_live=1`, `prize_live_min_rules_minor` 19.

Пак **74**, хеш **`63f6157f06d525711c45a9159019e21bfc8c3d1f0baa30fc5473191e9c964145`**, 614766 байт. `rules_version` 0.21.0. Круг 1445, вход 200, выход 910, mint 51, окно A [12275, 15783]. Атлас 179 кадров (было 175), 1 страница, 2599413 B ≤ 4194304, magenta 0, sha `acd419041ca4`. `layout_hash` `63aa7ce8cc09…` (геометрия не сдвинулась). Объектов сцены **466** (PLAN пишет 424 — живой счёт, не копия).

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 343 / 0 |
| `python content/build.py` | 0; pack 74; 614766 байт; hash `63f6157f…964145`; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py` | 23 artifacts, hash `63f6157f` |
| `python content/attack.py --only L180,L181,L345,L356` | 4/0 пойманы |
| construction четыре имени V4 | OK на зелёном; красный вход внутри каждой |
| `python content/vectors.py` | 21 файл; sha `b6456951…e3c9d41a` (сдвиг с pack_hash, R-V-14); `layout_version` в homes; инвентарь 25, тот же |
| render `tsc --noEmit` + `vitest run` | tsc 0; vitest 7/0 (3 V3 + 4 V4) |
| client `tsc --noEmit` + `vitest run` | tsc 0; vitest 10/0 |
| contentpack vitest | 59/0 |
| eslint `packages/render/src` | 0 |

`pnpm` registry на машине падает `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Гейт пакетов — локальные `tsc`/`vitest`. `sim.py` / `builds.py` / `--jobs 8` не в команде этапа (A-V-26).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `sprite_id_depends_on_level=1` | L180 | caught |
| `_attack_drop_badge_source` (кэш `_lint_t10` снят) | L181 | caught |
| `label_min_zoom_num=0` | L345 | caught |
| overlay `tileCenter` в `sprites.ts` | L356 | caught |
| vitest порядок ≠ python | падение | id-список равен, 466 |
| energy=0 без `badge_shortage` | падение | маркер на сцене |
| `--jobs 8` в `gate_cmd` | нет (A-V-26) | нет |
| `scene.json?url` | нет (A-V-1) | клиент читает пак |
| `Math.random` / `Date.now` / engine в render | нет | нет |
| `city_id` задаёт геометрию | нет (D-V-21) | `layout_hash` прежний |
| `commit:build` спавнит модель | нет | objects.ts не знает commit |
| непрозрачная магента в атласе | L331 | magenta 0 |
| construction L181 при живом `_lint_t10` | молчит | **нашлось**, закрыто pop кэша |

Выстояло (не закрывается кодом V4): GPU-голден Pixi (**R-V-25**, V12); глиф-шрифт подписей (**R-V-26**, плашки без текста); один кадр воды (**R-V-24**); различие пикселя GPU; сглаживание шрифта ОС; горячий ключ аттестатора; тонкий пул тестовой сети; `R-M-6`/`R-M-9`/`R-M-10`; TLS npm-attestations.

## Расхождения

- **R-V-25.** GPU-голдены Pixi отложены до V12.
- **R-V-26.** TZ_ART §5 glyph/font atlas отсутствует; подписи — Graphics-плашки без `Pixi.Text` (L343/L344 не этого шага; шрифт HUD — V8).
- **R-V-14.** sha векторов сдвинулся с `pack_hash`; состав 21 / layout v1 / homes 25 тот же.
- **R-V-24.** Атлас воды 1 кадр.

## Готовность

Критерий PLAN_VISUAL §4 V4: порядок отрисовки совпадает с `scene.py` (vitest `painter_order_matches_python`, 466 id); нехватка ресурса даёт красный бейдж **на сцене** (`shortage_badge_on_scene`, `IDLE_NO_ENERGY` не `log_only`). Next: V5 — `render_light`.
