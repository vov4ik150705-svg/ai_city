# P6 — правила и пробы

## L326 `metric_observed_not_threshold`

Ловит: пустой `arch.ops.channel`; метрика без `observe_src`; `observe_src` равен `threshold_src`; `alert_channel` не равен `ops.channel`; путь наблюдения не резолвится; `price_staleness_max_city_hours // 2` не меньше предела; импорт `observedFromThresholds` в `services/**/*.ts` вне определения в `metrics.ts` и вне `test/`.

| вход падения | правило | факт |
|---|---|---|
| `vault_cover.observe_src = threshold_src` | L326 | `observe_src equals threshold_src` |
| overlay `host.ts` импортирует `observedFromThresholds` | L326 | `imports observedFromThresholds outside tests` |
| снят `observe_src` | L326 | `has no observe_src` |
| `price_staleness_max_city_hours.v = 0` | L326 | `price_staleness_max_city_hours is missing` |

Определение `export function observedFromThresholds` в `metrics.ts` пропускается. `c9.test.ts` остаётся в `/test/`.

## L327 `incident_runbook_and_code`

Ловит: нет таблицы инцидентов; нет одного из семи id; нет `docs/OPS.md`; запрещённая копия (`owner drained` / «овнер вывел» / «залочено навсегда»); код не в `codes.json`; нет заголовка `## <runbook>`; нет `sign` / `owner` / `decides`.

| вход падения | правило | факт |
|---|---|---|
| `_ops_md = "owner drained"` | L327 | `forbidden owner-withdraw or forever-lock copy` |
| снят `runbook` у `rpc_silence` | L327 | `has no runbook` |
| `code = AUTH_REQUIRED` | L327 | `not in codes.json` |

## Три пробы `ops_watch` (L268 1:1)

| проба | зелёный | красный вход |
|---|---|---|
| `metric_observed_is_measured` | L326 healthy; все `observed !== threshold`; `GET /ready` несёт `metrics` | три мутации L326 выше |
| `alert_fires_before_decay_cuts_rate` | `sampler_age_alert_city_hours` 3 < stale 6; `ageAlertFiresBeforeDecay(3,3,6)` | `stale=0` → L326 |
| `incident_has_runbook_and_code` | семь id; код в `codes.json`; заголовок OPS | owner drained / нет runbook / AUTH_REQUIRED |

Vitest `metric_observed_is_measured`: genesis `observeFromState` + `exportLive`; ни одна строка не копирует порог; `/ready` отдаёт тот же набор.

Vitest `alert_fires_before_decay_cuts_rate`: 3 < 6; в окне `[3, 6)` алерт горит, на 6 окно закрыто (срез курса уже должен резать).

Vitest `incident_has_runbook_and_code`: семь строк, коды `SERVICE_DEGRADED` / `STALE_PRICE` / `COMPANION_LLM_TEMPLATE` / `PRIZE_CLAIM_UNCOVERED`.
