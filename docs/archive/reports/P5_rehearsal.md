# P5 rehearsal

Один пак, один хеш, один пин образа. Ускорение — только каденция вызова тика. `city_day_real_hours=25`, `tick_length_city_hours=1`, `ticks_per_city_day=24`. `python content/sim.py` — оракул ожиданий, не гейт шага. `python content/rehearsal.py` — не `gate_cmd`.

`launch.deployed` пуст. Образ не поднимался (`R-P-6`). Календарные трое суток тестнета не ждались (`R-P-7`).

## Прогон A — механика

Команда: `python content/rehearsal.py`. Стена ~2.1 s на 2160 тиков (~1 ms/тик). `GATE_PERF.md` задаёт бюджеты атаки и бандла, не длительность тика; полный `--jobs 8` на этом шаге занял 7.0 s.

| поле | число |
|---|---|
| pack_hash | `1e50885daa47c397d5a3f405a6e1a7ef883b3f4f5057ddd6fa2670f51ce69147` |
| pack_version | 68 |
| ticks_run | 2160 (90 × 24) |
| farm | сутки 15 час 6, tick 330, dust 0, `FRAGMENT_WINDOW_SETTLED` |
| prize | сутки 31 час 6, tick 714, `PRIZE_POOL_EMPTY` + `PRIZE_PERIOD_SETTLED`, n_eligible 1, dust 0 |
| season | сутки 91 час 6, tick 2154, `PRIZE_POOL_EMPTY` + `PRIZE_PERIOD_SETTLED` + `SEASON_SETTLED`, dust 0 |
| assets | NVDA TSLA AMZN AAPL MSFT COIN |
| payroll_ratio_bps | min 10000, max 10000, 90 суток |
| PRIZE_SHARE_CAPPED | 0 тиков (N=1, кап не вяжет — L291) |
| studio_eth_share_bps | 2000 (доля призовой ноги DEX); сплит оборота студии 20 bps (`build.py`) |
| snaps d14/d30/d90 | true / true / true |
| snap14_tail_eq | true (хвост от снапшота суток 14 ≡ полный реплей) |
| full | mint 51, fund 62011, idx 2159, payroll 10000 |

`dex_turnover_usd_8dec=0` весь круг: пул призов пуст, Zipf не режет атомы, пыль 0. Состав корзины — шесть тикеров районов. Кап доли на одном городе не срабатывает по канону.

## Прогон Б — транспорт

Форма: in-process харнесс (`packages/chainport/test/p5.test.ts` + L246 + существующая `llm_refusal_falls_back_to_template`). Не живая тестовая сеть, не трое суток стены (`R-P-7`). RPC/IPFS провайдеры — владелец (`PLAN_RELEASE` §9).

| инъекция | реакция | тик |
|---|---|---|
| RPC молчит | `SERVICE_DEGRADED` | не блокирован |
| RPC врёт JSON-числом | `silence` | не блокирован |
| фид устарел (`feed_live=0`) | тик пишет `tick_index`, `mint_rate` остаётся bigint (сид 51, не бросок) | идёт |
| out of gas | JSON-RPC `error` с числом → `silence` | не блокирован |
| nonce занят | повтор `issueVoucher` / `presentVoucher` → `API_INTENT_REPLAY` | не платит дважды |
| реорг hop | `putRoot` тот же `(cityId, day)` дважды, root тот же; ключ hop = `voucher.nonce` | идемпотентно по tx id |
| пин IPFS | `submitMinuteRoot` на silent → `SERVICE_DEGRADED`; attestor `ipfs:false` растит lag (существующие l8/c8) | не блокирован |
| LLM отказал | `fail_mode=open`, `blocks_tick=0`; текст шаблона | не блокирован |


## Сверка с пином образа

`arch.rehearsal.pack_pin = prod`. `arch.image.pin = pack_hash`. Dockerfile несёт `ENV PACK_HASH`. Отдельного пака репетиции нет.
