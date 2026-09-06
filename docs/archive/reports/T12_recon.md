# T12 — разведка

Вход: `rules_version 0.15.0`, `pack_version 23`, lint 225 / 0, attack 417 / 225 покрытых / 114 конструкций / 0 UNATTACKED / 0 SURVIVED. `python content/sim.py` → `A_t2 = 14011`. Развилок нет: D1–D17.

## 1. BRIEF §6 T12 (строки 367–373)

| пункт | уже есть | отсутствует до T12 |
|---|---|---|
| структура монорепо | фраза в `docs/TICK.md` §1: каталога `packages/engine` нет, T12 перенесёт границу | таблица слоёв, запреты, топосортировка |
| границы пакетов | L208/L209 на живом `tick.py`; клиент не считает экономику `L158` | граф `arch.json`, закон «только вниз», запрет `services/* → services/*` |
| схема данных | layout v1 + header в `tick.json` / `record.py`; агрегаты в `aggregates.py` | таблицы `accounts`…`intents`, байты+хеш как правда, барьер демо, снапшот = сутки |
| REST/WS | `docs/SCREENS.md` строка 3 обещает T12; `state_sources` 17 строк; `commit:*` в `screens.json` | биекция `POST /command/X`, снимок из `state_sources`, 5 каналов, конверт |
| коды ошибок | `idle` / `refusal` / `state` в `codes.json` | категория `transport`, шесть кодов, HTTP, проза запрещена |
| порт активов mock/rpc | `DESIGN.md` §10 четыре пункта «Ончейн»; ваучер §10.1 | интерфейс `AssetPort`, две реализации, роли ключей |
| интерфейсы контрактов | скоуп §11: merkle+IPFS = v1.1 | порт как данные, не Solidity |
| деплой | нет | окружения, readiness = pack_hash + миграции |
| наблюдаемость | HUD бейдж `· logged`; `attest_lag_ticks` назван в T11 | инвариант → метрика → сервис → порог-источник |
| сэмплер | поля входа тика, `rate_raw_from_samples` потребляет одно число; pending `sampler_corp_eth_endogenous` | сервис, период 50 с, ряд `price_day`, `twap_from_samples`, молчание |
| выкуп | `launch.json` cadence/tranche/min_batch/slippage; тик `_buyback` | хост, порядок депозит→минт, `buyback_batches` |
| снаружи тика, не блокируют | таблица `docs/TICK.md` §1 называет сэмплер/выкуп/REST/WS как T12 | `fail_mode`, `blocks_tick`, адреса в ARCHITECTURE.md |

`docs/ROADMAP.md` в BRIEF §7 есть, владельца в §6 нет (`R-T12-8`).

## 2. Числа, уже посчитанные (не дублировать)

| имя | где | значение (derived, не копировать) |
|---|---|---|
| `tick_length_real_seconds` | `generated.attest` / `balance` | `city_day_real_hours × 3600 / ticks_per_city_day` |
| `ticks_per_city_day` | `time.derived` | `24` |
| `twap_window_city_hours` | `economy.params` | сутки города |
| `price_staleness_max_city_hours` | `economy.params` | `6` |
| `buyback_*` | `launch.json` | cadence `1`, tranche `33` bps, min_batch, slippage `3` |
| `slots_cap` | `agents.params` | `20` (в ТЗ `agents_hard_cap`) |
| `companion_advisor_queue_depth` | `companion.params` | `1` |
| `attest_root_period_s` | `attest.params` | `60` |
| `topbar_height_px`, `column_width_px` | `hud_layout.json` | `56`, `260` |
| risk4 глубины | `launch.json` | три wei для пробы транша |

Вывод T12: `sampler_period_s = tick_length_real_seconds // 75`, `samples_per_twap_window = 24 × 1 × 75`, `command_rate_limit = 2 × slots_cap`, `voucher_ttl_s = tick_length_real_seconds`, `state_snapshot_every_ticks = ticks_per_city_day`, `companion_queue_capacity = 1 × llm_worker_concurrency`, `sampler_age_alert = staleness // 2`.

## 3. Экраны: `commit:*` и источники

Различные `commit:*` в `screens.json` `elements` (биекция D3): `build`, `hire`, `open_district`, `buy_stock`, `deposit`, `withdraw`, `noop` (`missions_start` stub), `claim_prize` (stub), `claim_fragment`, `unlock_tier`, `stake`, `pick_node`, `merge`, `upgrade`, `set_objective`.

Заглушки `v1=stub`, `spend=none`: `missions_start`, `leaderboard_claim`.

`state_sources` — 17 ключей. Owner T12 без producer: `wallet.corp_balance`, `wallet.chain` (`R-T11-12`). Остальные T11 с producer.

Каналы (правила префикса/исключения, не второй список значений): `tick.*`+`wallet.stake_tokens` → `tick`; `aggregate.*`/`seasons.*`/`fragments.*` → `aggregate`; `oracle.stock_price` + wallet chain/CORP → `price`; `oracle.district_efficiency` → `efficiency`; `log.*` → `log`. Канала часов нет.

Матрица отказов T9: `screens.gate_order` = sort `(tier, token)`; `FEATURE_NOT_IN_V1` через токен `v1_feature`.

## 4. HUD / камера

Фикстура: `stock_strip_height_px = null`, `bottom_menu_height_px = null`. `world.hud_layout_geom` вычитает только топбар: `safe_h = vh − top`. Сейчас GEN: `safe_rect 504×520`, `iso 4032×2016`, `zoom_min 1/8`. `R-T10-2` открыт.

После D15: высоты `40` и `48`. Формула должна стать `vh − top − strip − menu`. Ожидание: высота сейфа `520 → 432` (`−88`). Остров `2016/8 = 252 ≤ 432` — `L185` должен остаться зелёным, `zoom_min` формула пересчитывает и может не сдвинуться. Движение назвать в отчёте.

`world.py` сегодня игнорирует strip/menu — без правки генератора D15 не сдвинет числа. Файл не в таблице ТЗ §3, но это единственное место формулы `safe_rect_h_px`.

## 5. Тик / цена / выкуп / аттестация

- `tick.rate_raw_from_samples(cfg, corp_eth_wei_per_whole, eth_usd_8dec)` — одно число, не ряд. T12 добавляет `arch.twap_from_samples`; тик не трогать.
- Молчание: `feed_live`, `price_sample_city_time` уже во входе. Правило: не обновлять метку без нового сэмпла.
- `_buyback` в тике: казна ETH → CPMM → `mint_from_backing`. Порядок хоста (депозит подтверждён → минт) — таблица `buyback_batches`, не вторая калибровка.
- Аттестация fail-open: `construction_ipfs_down_pay_continues`, `construction_pack_hash_mismatch_halts` уже есть. T12 добавляет колонку `fail_mode` и хост.

## 6. Коды, pending, версии

Категории кодов: только `idle` / `refusal` / `state`. `transport` нет (`R-T12-5`).

Pending `owner=T12`: `companion_llm_price_snapshot`, `companion_queue_capacity`, `hud_stock_strip_height_px`, `hud_bottom_menu_height_px`, `sampler_corp_eth_endogenous`. D16: три закрыть, очередь закрыть выводом, снимок цены → `owner`.

`layout_version = 1`. Minor: `0.15.0 → 0.16.0`, `pack_version 23 → 24`.

## 7. Образцы T11, которые копировать

- `PARAM_FILES` + `$defs.*_file` + `L01` фикстура
- `IMPLEMENTED_DERIVED` ↔ блок `derived` (`L09`)
- `report_t11` → секции `## T12: …` в GENERATED
- `TICK_MD_STRIP` → `ARCH_MD_STRIP`
- `L224`/`L225` + оверлеи `_tick_md` → `_architecture_md` / `_api_md` / `_roadmap_md`
- `fail(rule, msg)` начинается с `LNNN`
- `arch.py` не в `L45` (как `keccak.py`)

## 8. Чего нет и нельзя выдумать

TypeScript, `packages/*` на диске, Solidity, движение T2/T3, второй период корня, свой транш, свой staleness, список путей/кодов в `api.json`. Порог `attest_lag_alert_ticks` — авторский, `why` обязан назвать `DESIGN.md` §6.4 и `SERVICE_DEGRADED`. Кап периода сэмплера `60` с — обещание `HUD.md` §8 / D8, параметр с `src`/`why`.
