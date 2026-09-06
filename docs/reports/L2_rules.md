# L2 — правила и пробы

| id | что ловит | вход падения |
|---|---|---|
| L274 | порт не из пака / дубль / `listen(digits)` / `tick(` в `main.ts`; 3×`ws_heartbeat_s` > `sampler_period_s` | `server.listen(8080)`; sampler=api=7460; `ws_heartbeat_s=30` |
| `process_listens` | нет `main.ts` или нет порта entrypoint | overlay `_main_files` без sampler |
| `ws_heartbeat_derived` | меньше трёх пульсов в периоде сэмплера | `ws_heartbeat_s=30` при периоде 50 |
| `tick_scheduler_uses_city_time` | `Date` или `tick(` в scheduler | overlay `_scheduler_src='Date.now()'` |

Vitest: `GET /city/a/state` с TCP; три текстовых пульса WS; `tickOnce` ставит `city_time=anchor`, затем `+tick_length`; `attestLag=2`; payout ≥ 0 без процесса attestor.
