# P5 — правила и пробы

## L325 `rehearsal_time_uncompromised`

Ловит: пустой `arch.rehearsal`; `pack_pin ≠ prod`; `city_day_src` не `time.params.city_day_real_hours`; `city_day_real_hours ≠ 25`; `tick_length_src` не `time.params.tick_length_city_hours`; `tick_length_city_hours ≠ 1`; `image.pin ≠ pack_hash`.

Канон 25 и 1 живёт в линтере (`_CITY_DAY_REAL_HOURS_CANON`, `_TICK_LENGTH_CITY_HOURS_CANON`), не вторым параметром пака (`L09`).

| вход падения | правило | факт |
|---|---|---|
| `city_day_real_hours.v = 1` | L325 | `city_day_real_hours=1 is compressed under rehearsal` |
| `arch.rehearsal.pack_pin = "fast"` | L325 | `rehearsal pack_pin 'fast' is not prod` |
| `tick_length_city_hours.v = 2` | L325 | `tick_length_city_hours=2 is compressed under rehearsal` |

Vitest `rehearsal_pack_hash_equals_prod`: `pack_pin=prod`, сутки 25, длина тика 1, Dockerfile `ENV PACK_HASH`, хеш 64.

## Четыре пробы `time_rehearsal` (L268 1:1)

Имена не переиспользуют `rpc_silence_is_open` и `prize_period_divides_season`.

| проба | зелёный | красный вход |
|---|---|---|
| `rehearsal_pack_hash_equals_prod` | L325 healthy; `image.pin=pack_hash`; `pack_pin=prod` | три мутации L325 выше |
| `farm_window_settles_at_fourteen` | `window_days == payroll_daily_divisor == 14`; `window_index(14)=0`, `(15)=1` | хранимый `fragment_claim_window_city_days` → L92 `stored as 1` |
| `prize_period_settles_at_thirty` | период 30; `period_settle_due(31, 6)`; не на дне 30 и не вне часа | `prize_periods_per_season=4` → L282 |
| `chain_silence_does_not_block_tick` | L246 healthy; `feed_live=0` не бросает; llm `fail_mode=open` | `attestor.fail_mode=closed` → L246 `blocks the economy` |

Vitest фарм: прыжок на сутки 15 час 6 (`tickIndex` 330), есть `fragment_settlement`. Vitest приз: сутки 31 час 6 (`tickIndex` 714), код `PRIZE_PERIOD_SETTLED`. Python-драйвер на полном круге: `FRAGMENT_WINDOW_SETTLED`, `PRIZE_PERIOD_SETTLED`, `SEASON_SETTLED`.

## Инъекции прогона Б (тот же `it()`, без пятого имени)

| отказ | реакция |
|---|---|
| RPC молчит | `SERVICE_DEGRADED` |
| JSON-число вместо hex | `postEth` → `silence` |
| out of gas (`error.code` числом) | `silence` |
| пин IPFS / `submitMinuteRoot` на silent | `SERVICE_DEGRADED` |
| nonce hop (`hop-tx-1`) повторно | `API_INTENT_REPLAY` |
| `putRoot` тот же `(city, day)` дважды | тот же root |
| `feed_live=0` | тик завершился, `mint_rate` bigint |
| LLM | `fail_mode=open`, `blocks_tick=0`; шаблон — существующая `llm_refusal_falls_back_to_template` |
