# L2 — код

Процессы слушают. Тик по `city_time`. Экономики в `main.ts` нет.

## Написано

- `arch.listen` bind `127.0.0.1`, порты api/sampler/buyback/attestor/llm. Кодоген `packages/protocol/src/listen.ts`. Dockerfile `EXPOSE`/`ENV CORPORATOR_LISTEN_PORT` из пака, `CMD dist/main.js`.
- `api.path_rules` `ready` `/ready`, `ws` `/city/{city_id}/ws`. derived `ws_heartbeat_ms`, `sampler_period_ms`, `tick_length_real_ms`.
- `services/api/src`: `boot.ts`, `listen.ts` (HTTP `route` + WS RFC 6455), `ws.ts`, `scheduler.ts` (`nextTickInputs` из `state.city_time`), `main.ts` (env `PACK_HASH`, listen, `setInterval` → `tickOnce`).
- `services/{sampler,buyback,attestor,llm}/src/main.ts` + `ready.ts`: `GET /ready`, `fail_mode=open`, без `tick(`.
- `host.attestLag` растёт на каждом `stepTick` (attestor — другой процесс). `GET /ready` отдаёт `attest_lag`.
- L274. Три `it()` = `process_hosts.construction_tests`.
- Новых npm нет. WS без пакета `ws`.

## Решения

- Порт — ключ пака; env перекрывает дефолт (D-L-3).
- Пульс WS — текстовый кадр (Node `WebSocket` не вскрывает ping).
- Genesis вынесен из `main` в `boot.ts`.
- PGlite остаётся харнессом.

## Не это этап

`openPg`, клиент на хосте, compose, RPC live, арт.
