# T12 — журнал кода

Исполнитель шага T12. Развилок нет: D1–D17. Тик не тронут. Каталога `packages/*` нет. `content/arch.py` не на экономическом пути (`L45`).

Пак после `python content/build.py`: **462 884** канонических байт, хеш **`001c9ae7235308673f58cc2489cad4527306646f39deb80193c2537892d47173`**, `pack_version` **24**, `rules_version` **0.16.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `content/params/arch.json` | слои, сервисы, codegen, schema, port, keys, metrics, environments, readiness, channel_rules, buyback_refs/order, roadmap |
| `content/params/api.json` | path_rules, конверт, `sampler_samples_per_tick=75`, `ws_heartbeat_s=15`, `sampler_period_max_s=60`, `domain_conflict_http=409` |
| `content/fixtures/brief_t12_arch.json` | 12 пунктов BRIEF §6 T12 |
| `content/arch.py` | чистые функции: `twap_from_samples`, топосортировка, эндпоинты, отказы, каналы, homes, buyback helpers, `build_arch` / `build_api` |
| `docs/ARCHITECTURE.md` | канон границ, GEN, §R-T12-1…9 |
| `docs/API.md` | канон REST/WS |
| `docs/ROADMAP.md` | этапы и гейты |
| `docs/reports/T12_{recon,code,rules,final}.md` | разведка, журнал, спека правил, итог |

## 2. Изменено


Удалён черновик `content/_t12_schema_check.py`.

## 3. Авторские числа T12

| имя | v | src |
|---|---:|---|
| `sampler_samples_per_tick` | 75 | D8, `HUD.md` §8 |
| `ws_heartbeat_s` | 15 | D5: три пульса внутри одного сэмпла |
| `llm_worker_concurrency` | 1 | D16: наша конкурентность |
| `attest_lag_alert_ticks` | 2 | D13, `DESIGN.md` §6.4, `SERVICE_DEGRADED` |
| `stock_strip_height_px` | 40 | `HUD.md` §6.2, сетка 8 |
| `bottom_menu_height_px` | 48 | `HUD.md` §6.3, сетка 8 |


## 4. Камера (единственное разрешённое неэкономическое движение)

Формула `world.hud_layout_geom`: `safe_h = vh − topbar − stock_strip − bottom_menu`.

| величина | было | стало |
|---|---|---|
| `safe_rect` | 504×520 | 504×432 (−88 px: 40+48) |
| `iso` | 4032×2016 | 4032×2016 |
| `zoom_min` | 1/8 | 1/8 (остров 252 ≤ 432) |

Радиус острова не тронут. `L185` зелёный.

## 5. Проводка, которой нет в `tick.py`

`twap_from_samples` живёт только в `arch.py`. Тик по-прежнему потребляет одно число. Выкуп, сэмплер, аттестация, LLM, REST/WS — снаружи, `fail_mode=open`, `blocks_tick=0`. Единственный `closed` — сверка `pack_hash`.

`authored_actions` читает `screens.actions` (не пустой `elements`): иначе биекция `commit:*` была бы пустой декорацией.

## 6. Инертность

`python content/sim.py`: `A_t2=14011`, `F_reserve/F_deposit=3978`, возвраты 2837/8213, `N_min` 229/705/1057, `N_bank` 137/183/483. Экономическое число не двигалось.
