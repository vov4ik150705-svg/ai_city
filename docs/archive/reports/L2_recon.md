# L2 — разведка

Пять сервисов слушают. Тик по `city_time`. Процесс не считает экономику.

Вход: пак **38**, `rules_version` **0.18.0**, хеш **`a26da3e45b44fafe91d163a6c76bc96594932470534cdc04cf59107082fc8e2f`**, lint **273/0**, vectors **21**, vitest **58/0**, PENDING **6**. `R-L-4` открыт.

## Прочитано

PLAN_LIVE §4 L2, D-L-2, D-L-3, A-5, A-8, A-13, RK-L-3/4/11/14/15, R-L-4, R-L-10; ARCHITECTURE.md §2–3 §9; API.md §1–4; `arch.services`, `arch.packages.entrypoint`, `api.params.ws_heartbeat_s` = 15, `arch.derived.sampler_period_s` = 50; `createHost` / `route` / `runTick`; C3 `services_do_not_block_tick`; C8 `attestor_down_pay_continues`; `process_hosts.construction_tests` пустой.

## Дерево до шага

- Ни одного `services/*/src/main.ts`. Нет `createServer` / `listen`.
- `arch.listen` нет. `environments` только `migrations`. Dockerfile CMD `dist/index.js`, порта нет.
- WS: in-process `createHub`, TCP нет (`ws` нет в toolchain).
- Планировщик тика нет. `runTick` пишет in → tick → records → outbox; `void attestor`.
- Имена `process_listens`, `ws_heartbeat_derived`, `tick_scheduler_uses_city_time` нигде нет.
- Заняты L268: `services_do_not_block_tick` (C3), `pack_hash_mismatch_halts` (C2), `attestor_down_pay_continues` (C8).
- L229: сервисы не зависят друг от друга. Тест api не добавляет `allowed_deps` на sampler.
- PGlite остаётся харнессом (D-L-6 / L4). `openPg` не критерий L2.
- `art/` не входит. `--jobs 8` в этой среде убивается; полный attack — `--jobs 4`.

## ТЗ на шаг

1. `arch.listen` (bind + пять портов). Кодоген `packages/protocol/src/listen.ts`. Dockerfile EXPOSE/ENV из пака, CMD `dist/main.js`.
2. `api.path_rules` `ready` и `ws`. derived `ws_heartbeat_ms`, `sampler_period_ms`, `tick_length_real_ms`.
3. `services/*/src/main.ts` + listen. HTTP из `route`. WS handshake + текстовый пульс. Планировщик `city_time` из state, не `Date`.
4. L274: порты уникальны, ключи = entrypoint `services/*`, литерал `listen(digits)` в `services/*/src` роняет.
5. `process_hosts.construction_tests` = три новых имени. Пак **39**, `rules_version` 0.18.0.
6. Критерий: `GET /city/{id}/state` с сокета; 3 пульса WS в `sampler_period_s`; attestor down → выплата, лаг растёт; в `main.ts` нет `Date` на пути тика.

## Риски

- `it()` без строки L268 (A-13).
- Порт в src и в Dockerfile (RK-L-14).
- `tick(` / `mulBps` в `main.ts` (RK-L-4).
- RPC в процессе блокирует тик (RK-L-11).
- `ws` как npm — новая зависимость; RFC 6455 руками.
- `api_path_rule.template` minLength 4: путь `/ws` короче; брать `/city/{city_id}/ws`.
- L264: не писать порты в ARCHITECTURE.md / API.md / ROADMAP.md.
- Не тащить L3/L4.
