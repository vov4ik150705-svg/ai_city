# Дорожная карта

Этапы после закрытия T0–T12. Цель одной фразой, измеримый критерий, **команда гейта**, идентификаторы инвариантных тестов. Этап без команды — намерение. Каждый инвариант D13 встречается минимум в одном этапе. `L262`. `R-T12-8`: этот файл не имел задачи-владельца в BRIEF §6 — владелец T12.

Сезоны и призы: выплата `$CORP` после пересчёта пака (`season_prizes_live` flipped). Live-корень merkle включён.

Широкая таблица — маркер ниже, секция пака «T12: roadmap», команда `python content/build.py`.

<!-- GEN:arch.roadmap -->

Порядок диктуют зависимости: пак и гейт, форма кода, движок из спеки, протокол и загрузчик, хост с БД и реплеем, порт-мок, клиент на моке, сэмплер, выкуп, аттестатор без чейна, метрики и CI, чейн-слой `v1.1`, сезоны, затем живая фаза: `live_form`, `prize_claim_live`, `process_hosts`, `client_on_host`, `pg_compose`, `art_ground`, `art_sprites`, `owner_freeze`, `contracts`, `rpc_live`, `pons_launch`, затем денежная фаза: `money_form`, `fee_split`, `prize_period`, `prize_basket`, `basket_conveyor`, `prize_treasury`, `vault_safety`, `prize_surface`, `launch_freeze`, затем фаза v1.1: `v11_form`, `districts_live`, `archetypes_live`, `research_tree`, `synergy_buildings`, `companion_live`, `companion_revenue`, `rebalance_close`, затем фаза выхода: `release_form`, `player_identity`, `ci_tracks`, `contract_audit`, `prod_image`, `time_rehearsal`, `ops_watch`, затем фаза картинки: `visual_form`, `art_atlas`, `art_content`, `render_ground`, `render_sprites`, `render_light`, `render_camera`, `render_motion`, `hud_shell`, `hud_screens`, `companion_screen`, `attest_live`, `visual_close`, затем фаза кадра v3: `visual3_form`, `visual3_engine`, `visual3_assets`, `visual3_light`, `visual3_input`, `visual3_units`, `visual3_world`, `visual3_close`, затем фаза острова: `island_form`, `island_terrain`, `island_ground`, `island_decor`, `island_light`, `island_compose`, `island_anchors`, `island_client`, `island_close`, затем `mainnet_launch`, `season_one`. У каждой строки есть `ts_gate_cmd`. `L268`. Ключи `visual3_*` закрыты. Ключи `island_*` стоят после `visual3_close`. Живая работа кадра до `mainnet_launch` — `docs/reports/PLAN_ISLAND.md`, не повтор `docs/archive/plans/PLAN_VISUAL_V3.md`.

`gate_cmd` шага острова берётся из своей строки роадмапа, не из `visual3_*`. Текущая работа — `docs/reports/PLAN_ISLAND.md`.

Инварианты D13, которые обязаны появиться в таблице: касса `I1`/`I3`, бюджет трения `L13`/`L14`, пропорциональное урезание фонда, `I5`, `I7`, `I11`, детерминизм тика, `догон ≡ реплей`, байтовая стабильность layout v1, барьер демо.

Воспроизведение гейта **шага** — команда `gate_cmd` своей строки roadmap (там уже `--only`). Общий каркас:

```
python content/build.py
python content/lint.py
python content/attack.py --only <затронутые L>
```

Полный `python content/attack.py --jobs 8` и `python content/sim.py` — закрытие фазы и публикация пака, не каждый шаг. `R-C-4`.
