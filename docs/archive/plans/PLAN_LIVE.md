# План живой фазы: L0–L9

Назначение: превратить закрытые C0–C11 из библиотек с тестами в город, в который можно зайти. Адреса канона не меняются: механика — `DESIGN.md`; границы — `docs/ARCHITECTURE.md`; провод — `docs/API.md`; тик — `docs/TICK.md`; экраны — `docs/SCREENS.md`; запуск токена — `docs/LAUNCH.md`; арт — `docs/WORLD.md` и `.cursor/rules/art-pipeline.mdc`. Предыдущий план исполнения — `docs/reports/PLAN_CODE.md` (закрыт).

**Этот файл не канон.** Канон этапов — `docs/ROADMAP.md` и секция пака «T12: roadmap». Строк живой фазы в паке ещё нет: `R-L-1`. План лежит в `docs/reports/`, чтобы не стать вторым источником этапов (`R-C-10`). Первая работа L0 — внести строки в `arch.json.roadmap`, иначе следующие чаты будут исполнять отчёт.

---

## §1. Где мы стоим

Паспорт входа: пак **36**, `rules_version` **0.18.0**, хеш **`08867647fa2983a661fff0718cbb1224b970cb297371592dd792188d0d4a8ddb`**, `python content/lint.py` — **272/0**, PENDING 26, vectors 21 / `7ab1922c…`, vitest **56/0**, attack **515/0**. C0–C11 закрыты (`docs/reports/C11_final.md`).

Что есть физически: монорепо `packages/*`, `services/*`, `apps/client`; движок байт-стабилен layout v1; хост умеет `route()` и реплей из PGlite; клиент рисует сцену Pixi с `emptySnapshot`; порт `rpc` паритетен `mock` на фикстуре; сэмплер/выкуп/аттестатор/LLM — чистые `step*`, без процесса; Dockerfile пинит `PACK_HASH` и копирует `services/api/dist`; призы сезонов в движке `season_prizes_live=1` после пересчёта 0.18.0.

Чего нет (проверено деревом, не речью):

1. Ни одного `listen` / `createServer` / Fastify / Hono. `services/api/src/http.ts` — функция `route`. Процесса нет.
2. Клиент `apps/client/src/main.tsx` грузит пак с диска, ставит `demo: true`, `emptySnapshot()`, `firstLoginMs = Date.now()`. Это нарушает «время только `city_time`» на границе UI, пока нет сервера (`R-L-3`).
3. `leaderboard_claim` всё ещё `v1=stub`, `requires` включает `v1_feature`, `screens.params.leaderboard_claim_live.v = 0`. Движок уже платит Zipf, кнопка отвечает `FEATURE_NOT_IN_V1` (`R-L-2`).
4. БД продакшена нет: `openPglite()` (`R-C-15`). `pg` в runtime-образе не заявлен.
5. Транспорт RPC — фикстура `transportFromPort`, не вызов Robinhood Chain. Solidity отсутствует (`PLAN_CODE` §8).
6. Девятнадцать спрайтов `art/pipeline/assets_pending.json` `status=todo`. Текста `build_tile_refusal` нет.
6a. Вода — дефект генератора, не вкусовщина (`R-L-13`). `art/pipeline/tiles.py:tex_water` кладёт рябь как `sin((uu-vv)*16)` и `sin((uu+vv)*9)` в UV **до** `iso_warp`, одним сидом `37` на все тайлы: частоты не кратны периоду тайла, гребни режутся о границу, узор одинаков в каждом ромбе — на сцене это читается сеткой-рабицей, а не водой. Контраст добит полосой `0d0f18` → `2a5a9e` на однопиксельных линиях. Береговой линии нет вообще: трава встречает воду без прибоя и без градиента глубины.
7. Шесть `S_min` и снимок цены LLM — `owner`. RPC фида 403 не чинится кодом.

Кодовая фаза **не проектировала заново T0–T12**. Живая фаза **не проектирует заново C0–C11**. Она поднимает процессы, провод, арт и чейн поверх уже зелёного гейта.

**Рекомендация порядка:** L0 форма → L1 клейм (пакет, не процесс) → L2 процессы → L3 клиент на сервере → L4 Postgres/compose → L5a земля и вода, L5b спрайты — оба параллельны L2–L4, но L5a строго раньше L5b → L6 owner, когда фид ответит → L7 контракты → L8 живой RPC → L9 запуск на pons. Районы AMZN/MSFT/COIN, Scientist, Manager — **не эта фаза** (`DESIGN.md` §11).
---

## §2. Принцип фазы

Пак по-прежнему единственный источник чисел и форм. TypeScript — единственный рантайм. Python — оракул и гейт. Новое: появляется **процесс**. Процесс не считает экономику — он вызывает уже написанный `tick` / `stepSampler` / `stepBuyback` и пишет байты в таблицы из пака.

Четыре потока, не один список «сделай всё»:

| поток | что закрывает | блокируется чем |
|---|---|---|
| Runtime | HTTP, WS, планировщик тика, процессы сервисов, Postgres, compose | ничем: код уже есть |
| Surface | клейм приза, экраны из пака на живом снимке, кошелёк в UI | Runtime (без сервера кнопка — бутафория) |
| Art | 19 спрайтов, отказ тайла | ничем; параллелен Runtime |
| Chain | Solidity четырёх групп, живой `eth_*`, pons | Surface на mock достаточен, чтобы не отлаживать контракт и HUD сразу |


---

## §3. Решения `D-L-1` … `D-L-12`

### `D-L-1`. Не продолжать нумерацию C12

Решение: новая фаза `L0`–`L9`. C-этапы закрыты; C12 без строки roadmap — намерение.
Причина: `L262` / `L268` держат таблицу этапов. Тихий C12 обошёл бы пак.
Как проверяется: L0 добавляет ключи в `arch.json.roadmap` и `stage_order`; линтер падает, если этап L исполняется, а ключа нет.

### `D-L-2`. Процесс — тонкая оболочка

Решение: `main.ts` каждого `services/*` только слушает, читает env (`PACK_HASH`, DSN), зовёт уже экспортированные функции. Новой экономики в `main` нет.
Причина: иначе появится второй тик.
Как проверяется: grep `main.ts` на `mulBps` / `tick(`; eslint ban на арифметику `value_kind` в mains.

### `D-L-3`. Listen-порт — ключ пака

Решение: bind-адреса и порты живут в `arch.environments` / новый блок `arch.listen`, не литерал в Dockerfile.
Причина: одно число в двух местах.
Как проверяется: L-правило «литерал порта в src роняет»; образ читает env, дефолт из пака.

### `D-L-4`. Время клиента — экстраполяция часов, не источник экономики

Решение: `Date.now()` допустим только для плашки банка и часов (`HUD.md` §8 `client_clock`). Снимок, тик, `expected_city_time` — с сервера. Boot клиента без `city_time` сервера — ошибка готовности, не «покажем пустое».
Причина: `R-L-3`. Закрыто в L3: `Date.now` только в `clock.ts`, boot без `city_time` — код отказа.
Как проверяется: eslint на `Date.now` в `apps/client/src` с allowlist `clock.ts`; тест `client_boot_requires_city_time`.

### `D-L-5`. Клейм приза живой, миссии нет
Решение: `leaderboard_claim_live=1`, действие `v1=live`, `requires` без `v1_feature`. `missions_live` остаётся 0 / stub (`DESIGN.md` §11, HUD §9).

Причина: C11 включил выплату в движке, экран лжёт (`R-L-2`). Миссии в §11 нет.
Как проверяется: `stub_endpoint_no_spend` больше не включает `leaderboard_claim`; отказ демо — `DEMO_NO_PRIZE`, не `FEATURE_NOT_IN_V1`.

### `D-L-6`. PGlite остаётся в тесте, Postgres — в образе

Решение: `Store` уже интерфейс. Вторая реализация `openPg` в том же пакете `services/api`. Тесты C3 не переписываются на сеть.
Причина: `R-C-15` принял PGlite как харнесс, не как прод.
Как проверяется: `replay_from_storage` на Postgres в compose; образ runtime без `@electric-sql/pglite`.

### `D-L-7`. Контракты появляются после играбельного круга на mock

Решение: L3 закрывается на `AssetPort.kind=mock`. Solidity — L7.
Причина: отладка HUD против Foundry одновременно скрывает, чей баг.
Как проверяется: критерий L3 не требует `rpc` live; критерий L7 — паритет с `mock` на тех же фикстурах C10.

### `D-L-8`. Четыре группы контрактов = четыре пункта `DESIGN.md` §10

Решение: `$CORP`+сбор в пуле, vault+ваучер, стейк стоков, реестр корней. Банк не в чейне (`DESIGN.md` §10.1).
Причина: пятый контракт — новая механика.
Как проверяется: `arch.port.groups` остаётся длиной 4; линтер на лишний `.sol`.

### `D-L-9`. Арт не объявляет готовность Runtime

Решение: L5a и L5b не блокируют L2–L4. Силуэты остаются в пределах `L178`, пока raw не нарисован. Обратное тоже верно: L2–L4 не блокируют воду — `art/` не входит в пак экономики.
Причина: `R-C-8`. Город должен тикать на существующих спрайтах T10.
Как проверяется: критерий L2/L3 не читает `assets_pending.json`.

### `D-L-10`. Owner-числа не выдумываются

Решение: `S_min` и цена LLM появляются только со датированным снимком (фид / счёт провайдера). Этап L6 без снимка **не закрывается**.
Причина: `docs/CONTENT.md` §1.4, `R-T12-7`.
Как проверяется: попытка записать `district_stake_threshold` без поля `snapshot_at` роняет L39.

### `D-L-11`. Имя теста = имя пробы в roadmap, связь двусторонняя

Решение: как `D-C-13`. Новые пробы L-фазы — колонка `construction_tests` новых строк roadmap, **в том же заходе**, что сам `it()`.
Причина: `L268` проверяет в обе стороны — `construction test X occurs N times, want 1` и `vitest names not in construction_tests`. Новый `it()` без строки в паке роняет линтер сразу; строка без теста роняет его тоже. Пары «сначала тесты, потом пак» не существует.
Как проверяется: `python content/lint.py` после каждого нового `it()`; `_vitest_names` собирает `*.test.ts` по `packages`, `services`, `apps`.

### `D-L-12`. Правило агента живой фазы — одно, на месте прежнего

Решение: содержимое `.cursor/rules/code-phase.mdc` **заменено** правилом живой фазы (сделано, `R-L-16`). Второго файла правил фазы не заводится.
Причина: иначе агент требует C-отчёты на L-этапе; а два файла — два always-apply правила и второй список этапов через месяц.
Как проверяется: в `.cursor/rules/` ровно одно фазовое правило с `alwaysApply: true`, и его `description` говорит про L0–L9.

---

## §4. Этапы `L0` – `L9`

Анатомия та же, что у C: `цель`, `строка ROADMAP`, `входы`, `выходы`, `команда гейта`, `инвариантные тесты`, `критерий готовности`, `объём`, `зависит от`, `риски этапа`.

### `L0` — форма живой фазы

- **цель.** Внести этапы в пак и сменить правило агента, ничего не слушая.
- **строка ROADMAP.** Строк нет: `R-L-1`. Этот этап их создаёт (`code_form` живой фазы).
- **входы.** `docs/reports/PLAN_LIVE.md`, `docs/reports/C11_final.md`, `docs/ARCHITECTURE.md` §3 §9, `arch.roadmap`, `arch.roadmap_order`.
- **выходы.** Ключи `live_form`, `prize_claim_live`, `process_hosts`, `client_on_host`, `pg_compose`, `art_ground`, `art_sprites`, `owner_freeze`, `contracts`, `rpc_live`, `pons_launch` в `arch.json.roadmap` и в массив **`roadmap_order`** (ключа `stage_order` в паке нет — `R-L-11`); отчёты `L0_*.md`; пак +1. Правило агента уже заменено (`R-L-16`) — второго `.mdc` не создавать.
- **команда гейта.** `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268`.
- **инвариантные тесты.** `L262`, `L268`; новые `live_stage_keys_exist`, `code_phase_rule_not_always`.
- **критерий готовности.** Каждая новая строка несёт все семь обязательных полей `$defs.arch_stage`: `goal` ≥ 8 символов, `gate_cmd`, `ts_gate_cmd`, непустые `tests` и `invariants`, `src`, `why`; `additionalProperties: false` — восьмого поля не изобретать, `construction_tests` заводить пустым и наполнять на своём этапе. `roadmap_order` содержит новые id, `L262` и `L268` зелёные, `docs/ROADMAP.md` после `build.py` показывает их в таблице. У `art_ground` `construction_tests` пустой — его пробы живут в `art/pipeline/tiles_probe.py` и `L268` не касаются. В `.cursor/rules/` ровно одно фазовое правило с `alwaysApply: true`. Ни одного `listen` этот этап не требует.
- **объём.** S.
- **зависит от.** C11 закрыт.
- **риски этапа.** `RK-L-1`, `RK-L-13`.

### `L1` — клейм приза на экране

- **цель.** Согласовать HUD с C11: клейм `$CORP` живой, миссии нет.
- **строка ROADMAP.** `prize_claim_live` (после L0).
- **входы.** `docs/PRIZES.md` §6–7, `docs/SCREENS.md` §9, `screens.params.leaderboard_claim_live`, `seasons.params.season_prizes_live`, `codes` `DEMO_NO_PRIZE` / `FEATURE_NOT_IN_V1`, `DESIGN.md` §11.
- **выходы.** `leaderboard_claim_live.v` 0→1 и `leaderboard_claim.v1` stub→live **одной правкой** (`L162` падает ровно на рассинхроне); `requires` теряет `v1_feature` и **сохраняет `wallet`** (`L165`: `commit:claim_prize` в `VALUE_MOVE_EFFECTS`, действие без `wallet` роняет правило) и `not_demo_prize`; `construction_stub_endpoint_no_spend` в `content/attack.py` сужается с кортежа `("missions_start", "leaderboard_claim")` до `("missions_start",)` — иначе проба требует `v1=="stub"` и падает на собственной правке; `why` переписан; `docs/SCREENS.md` §9 строка про призы; `DESIGN.md` §12 абзац «Выплата призов» — пословно: клейм жив после пересчёта `rules_version` 0.18.0; bump пака по `CONTENT.md` §5 (minor: слоты записи не едут).
- **команда гейта.** `python content/lint.py && python content/attack.py --only L162,L165,L155 && python content/attack.py --construction-only && pnpm --filter @corporator/api --filter @corporator/client run test -- -t stub_endpoint_no_spend -t demo_barrier_holds`.
- **инвариантные тесты.** `L162`, `L165`, `stub_endpoint_no_spend` (после сужения ловит только `missions_start`), `demo_barrier_holds`, `refusal_matrix_matches_t9`.
- **критерий готовности.** `claim_prize` на wallet-аккаунте не возвращает `FEATURE_NOT_IN_V1`; на demo возвращает `DEMO_NO_PRIZE` раньше любого другого кода и не пишет ни одной money-строки; `missions_start` по-прежнему stub и по-прежнему ловится сужённой пробой; три предиката-предупреждения на `leaderboard_claim_live` (`PRIZE_POOL_EMPTY`, `SEASON_SETTLED`, `PRIZE_HOP_STALE`) остаются видимыми на экране `leaderboard`; GENERATED строка `leaderboard_claim` = `live`. `L155` к этому действию **не применяется** — экран `leaderboard` сам `v1: live`, правило смотрит только действия на stub-экранах; «чинить» его не нужно.
- **объём.** S.
- **зависит от.** L0.
- **риски этапа.** `RK-L-2`, `RK-L-12`.

### `L2` — процессы

- **цель.** Пять сервисов и api слушают; тик идёт по `city_time`; ни один main не блокирует тик I/O чейна.
- **строка ROADMAP.** `process_hosts`.
- **входы.** `docs/ARCHITECTURE.md` §3, `docs/API.md` §1–4, `arch.services`, `api.params.ws_heartbeat_s`, `time.derived.tick_length_real_seconds`, `arch.derived.sampler_period_s`.
- **выходы.** `services/*/src/main.ts`; HTTP из `route`; WS-каналы из `arch.channel_rules`; планировщик: записали входы → `tick` → выплата → запись → outbox (`D-C-10`); сэмплер/выкуп/аттестатор/LLM — отдельные процессы, `fail_mode=open`.
- **команда гейта.** `pnpm -w run gate && pnpm --filter @corporator/api run test -- -t process_listens -t services_do_not_block_tick`.
- **инвариантные тесты.** `services_do_not_block_tick`, `pack_hash_mismatch_halts`, `attestor_down_pay_continues`, новые `process_listens`, `ws_heartbeat_derived`, `tick_scheduler_uses_city_time`.
- **критерий готовности.** `GET /city/{id}/state` с живого процесса отдаёт конверт с `city_time` и `pack_hash`; три пульса WS внутри одного `arch.derived.sampler_period_s`; убитый attestor не останавливает выплату (лаг-метрика растёт); в `main.ts` нет `Date` внутри пути тика.
- **объём.** L.
- **зависит от.** L0. L1 желателен, не блокер listen.
- **риски этапа.** `RK-L-3`, `RK-L-4`, `RK-L-11`.

### `L3` — клиент на хосте

**Статус: закрыт.** Отчёты — `docs/reports/L3_*.md`.

- **цель.** Браузер читает снимок и шлёт `POST /command/*`; предпросмотр engine по-прежнему readonly.
- **строка ROADMAP.** `client_on_host`.
- **входы.** `HUD.md` §8, `docs/SCREENS.md`, `docs/API.md` §3–4, `apps/client` C5, `screens.actions`.
- **выходы.** Boot: `GET /pack/{hash}` immutable, затем `GET /city/.../state`; `expected_city_time` с конверта; `demo` с `account_kind`; кошелёк — UI из пака, не новый экран; `Date.now` только в `clock.ts`.
- **команда гейта.** `pnpm --filter @corporator/client run gate && pnpm --filter @corporator/client run test -- -t client_boot_requires_city_time -t client_preview_is_readonly`.
- **инвариантные тесты.** `client_strings_from_pack`, `client_preview_is_readonly`, `client_sees_no_chainport`, `demo_barrier_holds`, новые `client_boot_requires_city_time`, `command_posts_intent`.
- **критерий готовности.** Путь без сервера не рисует экономический HUD (ошибка кода, не пустые нули); после connect множество отрендеренных строк ⊂ `content/strings/ru.json`; `hire`/`build` на mock меняют `tick.capital` в следующем снимке; бандл без chainport/pg.
- **объём.** L.
- **зависит от.** L2.
- **риски этапа.** `RK-L-3`, `RK-L-7`, `RK-L-12`.

### `L4` — Postgres и compose

- **цель.** Прод-хранилище и один состав сервисов; PGlite остаётся тестовым драйвером.
- **строка ROADMAP.** `pg_compose`.
- **входы.** `arch.schema_tables`, `arch.environments`, `arch.readiness`, `deploy/Dockerfile`, `D-C-9`.
- **выходы.** `openPg`; docker-compose `dev`/`staging`/`prod` из пака; миграции те же `001_from_pack.sql`; readiness = `pack_hash` + `migration_version`; runtime-образ без python и без pglite.
- **команда гейта.** `pnpm --filter @corporator/api run migrate:check && pnpm --filter @corporator/api run test -- -t replay_from_storage -t image_has_no_python`.
- **инвариантные тесты.** `replay_from_storage`, `snapshot_tail_equals_full_replay`, `demo_barrier_holds` (CHECK), `readiness_requires_pack`, `image_pins_pack_hash`, `image_has_no_python`.
- **критерий готовности.** Реплей суток города на Postgres даёт те же байты, что PGlite-харнесс; `INSERT` demo→wallet падает CHECK; compose поднимает api+sampler+buyback+attestor+llm; `PACK_HASH` в env ≠ хеш пака → readiness красный.
- **объём.** M.
- **зависит от.** L2.
- **риски этапа.** `RK-L-5`, `RK-L-6`, `RK-L-14`.

### `L5a` — земля, вода, береговая линия

Идёт **раньше** спрайтов и раньше L3: стиль земли — фон, под который рисуются девятнадцать объектов. Перевернуть порядок значит перерисовать девятнадцать спрайтов после смены фона (`RK-L-16`).

**Статус: выполнено досрочно, до L0** (`R-L-15`). Отчёты — `docs/reports/L5a_*.md`.

- **цель.** Убрать сетку-рабицу с воды и завести толщину острова с берегом, не расширяя палитру и не трогая пак экономики.
- **строка ROADMAP.** `art_ground`.
- **входы.** `art/pipeline/tiles.py` (`tex_water`, `iso_warp`, `quantize`), `art/pipeline/scene.py` (`darken_lut`, ground pass), `art/palette/corporator.hex`, `docs/WORLD.md` §11, `art-pipeline.mdc`, `L16`, `L178`, `L184`, дефекты `R-L-13`, `R-L-14`.
- **выходы.** Три группы правок, все в `art/`, хеш пака не двигают.

  1. Океан перестал быть функцией одного тайла и стал одним **обёрнутым блоком 8×8 клеток**: `water_block(deep)` рисует поле 512×512, `tex_water(pu, pv)` берёт срез, фаза равна `(tx % 8, ty % 8)`, блок отдаётся сценой как два атласа `water_atlas` / `water_deep_atlas`. Аналитическая волна выброшена совсем: волна, достаточно короткая, чтобы её было видно, имеет период, достаточно короткий, чтобы читаться решёткой — первая попытка дала рабицу, вторая с частотами `2π·k` дала горошек с периодом в четыре клетки. Рябь теперь — короткие штрихи, посеянные по блоку (`dash_centres` + `dash_mask`, обёртка по модулю), плюс низкоконтрастное value-noise поле `wrapped_blobs`. Штрих держит экранную горизонталь, потому что `iso_warp` отправляет экранный x в `(u−v)`, а y в `(u+v)`.
  2. У острова появилась толщина. Земля рисуется поднятой на `CLIFF_DEPTH = 11` px над плоскостью воды, под её южными гранями `draw_cliff` кладёт две фаски (`3a2a18` запад, `5c4426` восток), 1 px дерна `0f3d1f` сверху и 3 px тёмной линии `0d0f18` у воды; земля идёт в порядке глубины, поэтому борт остаётся только по силуэту. Спрайты, тени объектов и сетка `--grid` подняты тем же смещением. Остров кладёт на воду собственную тень: силуэт со сдвигом `(7, 7)` минус сам силуэт. Береговые клетки не вводятся заново — они и есть граница поднятой земли, определение совпадает с `content/world.py:shore_tiles` (`R-L-14`).
  3. Тень перестала быть дырой в траве. `darken_lut` брал ближайшую запись к `src × 0.55`, и для травы `2e3a16` это почти-чёрный `0d0f18`; теперь тень — шаг вниз по **своей рампе**, отсортированной по яркости, а для самой тёмной записи рампы — ближайшая по яркости к `0.7 × luma`.

  Отдельно: открытое море посажено на цвет фона `12203f`, поэтому край конечной карты больше не читается берегом посреди неба.
- **команда гейта.** `python art/pipeline/tiles.py && python art/pipeline/layout.py && python art/pipeline/scene.py && python art/pipeline/tiles_probe.py && python content/lint.py`.
- **инвариантные тесты.** `L16`, `L178`, `L184` плюс новый файл `art/pipeline/tiles_probe.py`: `water_block_wraps`, `water_tiles_differ_by_coord`, `water_crest_share_is_low`.

  `water_block_wraps` не сравнивает первый столбец тайла с последним: `uv_grid` строит `linspace(0,1,64, endpoint=False)`, последний столбец — это `63/64`, и такое сравнение даёт ложный красный на любых частотах. Проба проверяет то, чем блок держится: штрих в углу блока покрывает столько же пикселей, сколько тот же штрих в середине, а шаг поля на шве не больше внутреннего шага.
- **критерий готовности.** Достигнуто: пробы 3/0, каждая показала красный прогон на подготовленном входе — снятый `% size` в `dash_mask` даёт «corner dash covers 3 px, same dash in the middle covers 55»; блок, забитый одним тайлом, даёт «phase (0,0) and (1,0) are byte-identical»; возврат прежней плотности штрихов даёт «bright share 0.3992 over the 0.1 ceiling» против 37.1% исходной маски. `lint 272/0`, хеш пака `08867647…` не сдвинулся, `layout.sha256` совпал, в кадре ровно 53 цвета — палитра не расширена.
- **объём.** S по строкам, M по проходам: три подхода к воде, каждый смотрен на кропах 1:1.
- **зависит от.** ничего. Параллелен L2–L4. Пак экономики не двигает — это `art/`, не `content/params`.
- **риски этапа.** `RK-L-8`, `RK-L-16`.
- **не входило.** Анимация воды, шейдеры, свет фонарей, туман: это кадровый бюджет клиента, а строки бюджета в `GATE_PERF.md` нет — она заводится в L3.

### `L5b` — спрайты T10 и отказ тайла

**Статус: закрыт.** Отчёты — `docs/reports/L5b_*.md`.

- **цель.** Закрыть `assets_pending` и отказ тайла текстом канона.
- **строка ROADMAP.** `art_sprites`.
- **входы.** выход L5a (стиль земли зафиксирован), `docs/WORLD.md` §11, `art-pipeline.mdc`, `art/pipeline/assets_pending.json`, `L178`, `L16`, pending `build_tile_refusal`.
- **выходы.** `art/raw/raw_<id>.png` для каждого pending id; записи в `assets.json`; `pixelize.py` + `scene.py`; код+строка отказа в `codes.json` / `strings/ru.json`; pending-строки удалены или `status=done`.
- **команда гейта.** `python art/pipeline/pixelize.py --report && python content/lint.py` (L16, L178, L011, L012).
- **инвариантные тесты.** `L16`, `L178`, `L184`; новый `build_tile_refusal_has_string`.
- **критерий готовности.** `lint.py` PENDING без 19 строк sprite; `build_tile_refusal` нет в `pending.json`; сцена собирается; палитра не расширена.
- **объём.** L (рисунок — не код).
- **зависит от.** L5a. Параллелен L2–L4.
- **риски этапа.** `RK-L-8`.

**Что в арт-фазу не входит.** Анимация воды, шейдеры, свет, тонировка по времени суток. Любая анимация — это кадровый бюджет в клиенте и новое число (период кадра) в паке, а бюджета клиента в `GATE_PERF.md` пока нет вовсе (`R-C-12`). Сначала L3 ставит клиент на хост и заводит строку бюджета, только потом обсуждается движение картинки.

### `L6` — freeze owner-чисел

- **цель.** Записать шесть `S_min` и точку цены LLM, когда есть датированный снимок. Без снимка этап не стартует.
- **строка ROADMAP.** `owner_freeze`.
- **входы.** `docs/CONTENT.md` §1.4, `DESIGN.md` §4.5 / §12, `pending.json`, Chainlink `latestRoundData`, счёт провайдера LLM.
- **выходы.** Шесть записей `districts.stake.s_min.<TICKER>` с единицей токена — **не** `usd` и не `usd_8dec`, иначе `L39` падает первым же полем; `districts.stake.snapshot` из `null` в объект с обязательным `at` (дата) и хотя бы одним из `src` / `rpc` — форма именно такая, поля `snapshot_at` в паке нет (`R-L-12`); `district_stake_reference` как derived; закрытие `district_stake_usd_assumption`; дата снимка в `why`; пак bump.
- **критерий готовности.** PENDING без `district_stake_*`; порог в токене, не в долларе. Три красных прогона показаны руками: `s_min` с `u: "usd"`; `s_min` при `snapshot: null`; `snapshot` без `at`. Каждый даёт `L39`.
- **команда гейта.** `python content/lint.py && python content/attack.py --only L39`.
- **инвариантные тесты.** `L39`, `L41` (не ломается Handbook); новый `smin_frozen_in_tokens`.
- **объём.** S кода, блокер — внешний фид.
- **зависит от.** L0. Не зависит от L7: порог — параметр, стейк уже порт.
- **риски этапа.** `RK-L-9`.

### `L7` — Solidity четырёх групп

- **цель.** Тупые контракты под `AssetPort`, банк остаётся на сервере.
- **строка ROADMAP.** `contracts`.
- **входы.** `DESIGN.md` §10, `docs/ARCHITECTURE.md` §6, `packages/chainport/src/port.ts`, `api.derived.voucher_ttl_s`, `launch.json`.
- **выходы.** Каталог контрактов **вне** `packages/engine`; Foundry/Hardhat по `arch.toolchain` (новая запись с обоснованием); тесты паритета с `mock` на фикстурах C10; `creatorTaxBps` иммутабелен после деплоя.
- **команда гейта.** toolchain test + `pnpm --filter @corporator/chainport run test -- -t rpc_parity_with_mock`.
- **инвариантные тесты.** `port_two_implementations`, `voucher_single_use`, новые `vault_deposit_then_mint`, `bank_not_onchain`.
- **критерий готовности.** Набор фикстур C10 проходит против развёрнутых локально контрактов; повтор ваучера отвергается; минт Capital без депозита не проходит; в контракте нет часов банка.
- **объём.** L.
- **зависит от.** L3 (круг на mock уже играется), L0.
- **риски этапа.** `RK-L-10`, `RK-L-11`.

### `L8` — живой RPC

- **цель.** `RpcTransport` зовёт Robinhood Chain; молчание = `SERVICE_DEGRADED`; тик не ждёт.
- **строка ROADMAP.** `rpc_live`.
- **входы.** `docs/LAUNCH.md` §1 (chain id, RPC), C10 codec, `arch.keys`, `L257`.
- **выходы.** Реализация транспорта только в `packages/chainport/src/rpc/`; ключи не в клиенте; attestor `putRoot` в outbox с ретраями; `wallet.chain` / `wallet.corp_balance` канал `price`.
- **команда гейта.** `python content/attack.py --only L246,L257 && pnpm --filter @corporator/chainport --filter @corporator/attestor run test -- -t rpc_silence_is_open`.
- **инвариантные тесты.** `rpc_silence_is_open`, `attestor_down_pay_continues`, `stake_snapshot_is_recorded_input`.
- **критерий готовности.** Нет транспорта → тик идёт, `feed_live`/`SERVICE_DEGRADED` по канону; JSON-число в RPC не проходит codec; клиентский бандл без ключей; `rpc_import_only` держит viem внутри `rpc/`.
- **объём.** M.
- **зависит от.** L7, L4.
- **риски этапа.** `RK-L-9`, `RK-L-11`.

### `L9` — запуск на pons

- **цель.** `launchToken` параметрами из пака, без покупки, не новая калибровка.
- **строка ROADMAP.** `pons_launch`.
- **входы.** `docs/LAUNCH.md`, `content/fixtures/kottara_launch.json`, `launch.json`, `economy.params.creator_tax_bps`, решение владельца не покупать.
- **выходы.** Чеклист деплоя в `docs/reports/L9_final.md`: адреса в `launch.deployed.*` после факта, не до; сверка `creatorTaxBps=100` с кривой; `launch_buy_share_bps = 0`.
- **команда гейта.** `python content/lint.py && python content/build.py` (L24 против фикстуры не ломается адресами — адреса post-factum в `launch.deployed.*` либо пустые до факта).
- **инвариантные тесты.** `L24`, `L13`, `L14`; `deployed_tax_matches_pack`.
- **критерий готовности.** Pack `creator_tax_bps` = `PackConstants.CREATOR_TAX_BPS`; доля покупки 0 и derived buy = 0; круг 14.47% не пересчитан. Живой `launchToken` на Robinhood — `R-L-22`.
- **объём.** M.
- **зависит от.** L8, L6 (порог района иначе в USD-допущении).
- **риски этапа.** `RK-L-10`, `RK-L-9`.

---

## §5. Инварианты D13 → этап

Касса, трение, фонд, I5/I7/I11, детерминизм, догон, layout v1, демо — уже закрыты C1/C3/C7. Живая фаза их **не ослабляет**.

| инвариант | где может сломаться сейчас | этап |
|---|---|---|
| `I1_I3` | Solidity mint, buyback process | L2, L7, L8 |
| `L13_L14` | «подкрутить» запуск | L9 запрещает |
| `payroll_proportional` | хост выплачивает иначе, чем engine | L2 зовёт engine |
| `tick_pure` | `Date` в планировщике | L2 |
| `catchup_eq_replay` | Postgres vs PGlite | L4 |
| `layout_v1_bytes` | новый ABI записи | ни один L не двигает layout |
| `demo_isolated` | клейм приза, клиент | L1, L3 |

---

## §6. Риски `RK-L-1` … `RK-L-16`

| id | риск | где | как ловится | чем закрывается |
|---|---|---|---|---|
| `RK-L-1` | план стал вторым roadmap | L0 | этап без ключа в паке | `D-L-1` |
| `RK-L-2` | призы в движке, клейм stub | L1 | GENERATED `v1=stub` при `season_prizes_live=1` | `D-L-5` |
| `RK-L-3` | `Date.now` в экономике клиента | L3 | eslint + `client_boot_requires_city_time` | `D-L-4` |
| `RK-L-4` | экономика в `main.ts` | L2 | grep/eslint | `D-L-2` |
| `RK-L-5` | Postgres DEFAULT/литерал порога | L4 | `codegen --check` DDL | `D-C-9` |
| `RK-L-6` | образ тащит python/pglite | L4 | `image_has_no_python` расширить | C9 + `D-L-6` |
| `RK-L-7` | клиент пишет preview state | L3 | TS2542 | `D-C-12` |
| `RK-L-8` | новый цвет / футпринт > лимита | L5a, L5b | L178, палитра | art-pipeline |
| `RK-L-9` | выдуманный `S_min` / цена LLM | L6 | L39, pending why | `D-L-10` |
| `RK-L-10` | пятый контракт / банк ончейн | L7 | длина `port.groups`, тест часов | `D-L-8` |
| `RK-L-11` | RPC блокирует тик | L2, L8 | `services_do_not_block_tick` | `fail_mode=open` |
| `RK-L-12` | демо берёт приз | L1, L3 | `DEMO_NO_PRIZE`, CHECK | `L112` |
| `RK-L-13` | C-правило душит L-чаты | L0 | alwaysApply | `D-L-12` |
| `RK-L-14` | порт listen зашит в двух местах | L2 | литерал vs пак | `D-L-3` |
| `RK-L-15` | новый `it()` без строки `construction_tests` | L2–L4 | `L268` в обе стороны | `D-L-11` |
| `RK-L-16` | стиль земли меняется после 19 спрайтов | L5a | порядок L5a → L5b | `R-L-13` |

---

## §7. Расхождения `R-L-*`

**`R-L-1`.** В `arch.json.roadmap` нет строк живой фазы.
Было: двенадцать стадий C. Стало: предлагается одиннадцать ключей §4 (арт разделён на `art_ground` и `art_sprites`). Статус: закрыто в L0 — ключи в `roadmap` и `roadmap_order`, пак 37.

**`R-L-2`.** C11 `season_prizes_live=1`, экран `leaderboard_claim` stub / `leaderboard_claim_live=0`.
Было: выплата v1.1 в HUD. Стало: движок уже платит. Статус: **закрыто в L1** — `leaderboard_claim_live=1`, действие live, `requires` без `v1_feature`, `wallet` и `not_demo_prize` на месте.

**`R-L-3`.** `apps/client/src/main.tsx` использует `Date.now()` и пустой снимок.
Было: допустимо для C5 mock. Стало: для живого города — дефект. Статус: **закрыто в L3** — boot `GET /pack/{hash}` затем state; `Date.now` только в `clock.ts`; без `city_time` — `API_PACK_STALE`.

**`R-L-4`.** Нет процесса HTTP. Статус: **закрыто в L2** — `GET /city/{id}/state` с живого сокета, WS-пульс, пять `main.ts`.

**`R-L-5`.** PGlite ≠ Postgres. Статус: **закрыто в L4** — `openPg` на `pg.Client`; реплей суток совпадает с PGlite; PGlite остаётся харнессом (`R-C-15`).

**`R-L-6`.** `rpc` паритетен mock на фикстуре, чейна нет. Статус: L7–L8. C10 закрыл кодек, не сеть.

**`R-L-7`.** `R-C-22` (watermark `prize_live_min_rules_minor` в том же паке) жив. Статус: не чинить отдельным этапом, пока L не добавляет второй watermark; если понадобится — правило «floor не в том же объекте, что флаг».

**`R-L-8`.** Миссии остаются stub. Статус: **принято**, канон §11. Не закрывать в L1.


**`R-L-9`.** `bank_withdraw_rate_ceiling_only` и `exit_uncovered_at_band_floor` остаются owner/T3. Статус: не L-фаза; не выдумывать.

**`R-L-10`.** Dockerfile копирует только `api/dist`. Статус: **закрыто в L4** — кодоген копирует все пять `services/*/dist`.

**`R-L-11`.** Первая редакция этого плана называла массив порядка этапов `arch.stage_order`.
Было: `stage_order` в выходах L0. Стало: в паке и в `L262`/`L268` ключ называется **`roadmap_order`**, схема `arch_file` требует его и запрещает лишние поля (`additionalProperties: false`). Статус: исправлено в §4 L0 до начала работ; исполнителю не искать несуществующий ключ.

**`R-L-12`.** Первая редакция называла снимок фида полем `snapshot_at`.
Было: `snapshot_at` в выходах L6. Стало: `L39` читает `districts.stake.snapshot` как объект с `at` и `src`/`rpc`. Статус: **закрыто в L6**.


**`R-L-21`.** viem не встал (TLS registry). Статус: принято в L8; ABI локальный.

**`R-L-22`.** L9 не отправляет живой `launchToken` на Robinhood: ключа владельца в репозитории нет, адреса `launch.deployed` пустые. Кодирование без покупки, налог из пака и `eth_sendRawTransaction` на инъецированном HTTP закрывают критерий кодирования. Заполнение адресов — факт владельца после подписанной tx.

**`R-L-16`.** Правило агента живой фазы лежит не в новом файле, а на месте прежнего.
Было: `D-L-12` предлагал завести `.cursor/rules/live-phase.mdc` и погасить `code-phase.mdc`. Стало: содержимое `code-phase.mdc` заменено правилом L0–L9 по просьбе владельца. Статус: принято, `D-L-12` перезаписан. Имя файла историческое, как и имя папки `ai_city`; второго фазового правила не заводить — это тот же дефект, что второй список этапов.

**`R-L-15`.** L5a выполнен раньше L0, то есть раньше своей строки в `roadmap`.
Было: этапы идут по номерам. Стало: правка воды и берега сделана по прямой просьбе владельца до L0. Основание, по которому это не ломает форму фазы: этап целиком лежит в `art/`, не добавляет ни одного `it()` в vitest, не двигает пак и не может уронить `L268`. Статус: строки `art_ground` и `art_sprites` всё равно вносятся в L0; в отчёте L0 отмечается, что `art_ground` закрыт заранее, а `construction_tests` для него остаются пустыми — пробы живут в `art/pipeline/tiles_probe.py`, а не в vitest.

**`R-L-14`.** Береговая линия существует в данных и не существует в рендере.
Было: считалось, что берег — новая сущность арт-этапа. Стало: `content/world.py` держит PRNG-поток `shore`, функцию `shore_tiles`, `apply_shore_jitter` и отдаёт поле `shore` в артефакте layout; правила `L172`, `L187`, `L191` его охраняют — а в `art/pipeline/scene.py` слова `shore` нет ни разу, эти клетки рисуются обычной травой. Статус: закрывается L5a чтением готового поля, новых чисел не требуется.

**`R-L-13`.** Вода — дефект генератора, а не предмет вкуса, и первая редакция его не называла.
Было: L5 «закрыть assets_pending». Стало: `tex_water` даёт одинаковый узор в каждом тайле с гребнями, режущимися о границу ромба — видимая решётка; берега нет. Статус: выделено в отдельный этап L5a с двумя пробами (`water_tile_edges_wrap`, `water_tiles_differ_by_coord`) и порядком L5a → L5b.

**`R-L-17`.** В том же рабочем дереве, что L1, закрылись `build_tile_refusal` / L273 и арт-pending (PENDING 26→6).
Было: L1 двигает только клейм. Стало: `screens.json` `build_place` несёт `build_tile`, пак 38 содержит оба. Статус: принято как параллельный T10/L5a в том же дереве; L1 не откатывает чужой гейт. Не второй список этапов.

**`R-L-18`.** Compose из пака — bind-mount + `strip-types`, не `docker compose up` пяти контейнеров; runtime Dockerfile без `node_modules`/`pg`; тестовый `embedded-postgres` 18 при образе compose `postgres:16`.
Было: критерий L4 «compose поднимает api+sampler+buyback+attestor+llm». Стало: YAML и L276 это доказывают; Docker в PATH нет, живой `compose up` не гонялся. Харнесс реплея — `embedded-postgres` (major 18), compose image major из `toolchain.postgres` (16). Статус: принято; полный образ с prod-deps — не L4.

---

## §8. Что не входит в живую фазу
- Играбельные AMZN, MSFT, COIN; Scientist; Manager; research шире трёх узлов; NFT-кран — `DESIGN.md` §11, отдельная контент-фаза после L3.

- Локализация кроме `ru.json`.
- Перенос `content/sim.py` в TS (`R-C-7`).
- Второй пул `$CORP`, игровой NVDA, минт Capital без депозита.
- Solidity до L7; живой RPC до L8; выдуманный фид до L6.

---

## §9. Протокол шага

Как C, с префиксом отчётов `docs/reports/L<N>_recon.md` / `_code.md` / `_rules.md` / `_final.md`.

Цикл `.cursor/rules/verification-loop.mdc` обязателен. Гейт:

```
python content/build.py
python content/lint.py
python content/vectors.py
python content/codegen.py --check
pnpm -w install --frozen-lockfile
pnpm -w run gate
python content/attack.py --only <затронутые>
python content/attack.py --jobs 8   # перед публикацией пака
```

Плюс команда этапа из §4. Критерий готовности — буквально. Молча не переписывать `DESIGN.md`.

Стартовый промпт чата: паспорт прошлого L-шага + «выполни Next Step». Не копировать этот файл в чат.

---

## §10. PENDING → этап

| item | владелец сейчас | адрес |
|---|---|---|
| `district_stake_threshold` | T2 | **закрыто L6** |
| `district_stake_reference` | T2 | **закрыто L6**, derived |
| `district_stake_usd_assumption` | T3 | **закрыто L6** |
| `bank_withdraw_rate_ceiling_only` | T3 | не L; `R-T3-1` |
| `exit_uncovered_at_band_floor` | owner | не L |
| `build_tile_refusal` | T10 | **закрыто L5b** |
| 19 sprite todo | T10 | **закрыто L5b** |

---

## §11. Воспроизведение

Сейчас (C11):

```
python content/build.py
python content/lint.py
python content/vectors.py
python content/codegen.py --check
pnpm -w run gate
python content/attack.py --jobs 8
```

Появляется в L2: процессный smoke (`process_listens`). В L4: compose up + replay на Postgres. В L7: тест контрактов из `arch.toolchain`.

Хеш пака — поле `hash`. План его не копирует вперёд.

---

## §12. Атаки на план

| id | атака | что нашлось | как исправлено |
|---|---|---|---|
| `A-1` | Объявить фазу закрытой, потому что C11 зелёный | Процесса нет, клейм stub | §1 факты дерева; L2/L1 обязательны |
| `A-2` | Сделать C12 без пака | Обход `L262` | `D-L-1`, L0 |
| `A-3` | Начать Solidity до клиента на хосте | Два неизвестных сразу | `D-L-7` |
| `A-4` | Закрыть L6 без фида | Выдуманный `S_min` | `D-L-10`, критерий «этап не стартует» |
| `A-5` | Критерий L2 «сервис слушает» без HTTP-кода | Пустой main export | `process_listens` бьёт в сокет |
| `A-6` | Включить миссии «заодно» с призом | Ломает §11 | `R-L-8` |
| `A-7` | Арт как блокер Runtime | Город не тикает месяцами | `D-L-9` |
| `A-8` | Слушать на `:3000` в Dockerfile и в коде | Два числа | `D-L-3` |
| `A-9` | Оставить `code-phase` alwaysApply | Агент требует C-паспорт | `D-L-12` |
| `A-10` | L1 без правки `DESIGN.md` §12 | Канон врёт «выплата не в первой версии» | L1 пословная правка |
| `A-11` | Флипнуть `leaderboard_claim` на live и прогнать гейт | `construction_stub_endpoint_no_spend` жёстко перечисляет `leaderboard_claim` и требует `v1=="stub"`: гейт L1 падает на собственной правке | §4 L1 — сужение кортежа пробы до `("missions_start",)` названо выходом этапа |
| `A-12` | Снять с клейма `v1_feature` вместе с `wallet` | `L165`: `commit:claim_prize` в `VALUE_MOVE_EFFECTS`, действие без `wallet` «двигает деньги без токена» | §4 L1 — `wallet` и `not_demo_prize` сохраняются явно |
| `A-13` | Дописать `it()` для процессов, пак поднять потом | `L268` бьёт в обе стороны: `vitest names not in construction_tests` | `D-L-11` переписан, `RK-L-15` |
| `A-14` | Нарисовать 19 спрайтов, потом поправить воду | Фон меняется под готовыми объектами — 19 перерисовок | Порядок L5a → L5b, `RK-L-16` |
| `A-15` | Проверить бесшовность воды сравнением первого и последнего столбца тайла | `uv_grid` использует `endpoint=False`: последний столбец — `63/64`, проба даёт ложный красный на любых частотах | §4 L5a — проба переформулирована как периодичность `mask(u+1,v)==mask(u,v)`, замер приложен |
| `A-16` | Завести берег как новую сущность арт-этапа | Берег уже в layout (`world.py` поток `shore`), дублирование данных | `R-L-14` — `scene.py` читает готовое поле |

Выжившее и принятое: `R-L-7` (watermark C11), `R-L-9` (T3/owner полосы), `R-L-18` (compose YAML без живого `compose up`; embedded 18 vs image 16), `R-L-19` (LLM точка без счёта), `R-L-21` (viem), `R-L-22` (пустой `launch.deployed`). Не молчат.

Next Step исполнения: **L7** — Solidity четырёх групп.
