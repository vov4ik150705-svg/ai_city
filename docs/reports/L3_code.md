# L3 — код

Клиент на хосте. Предпросмотр readonly. Тик не считает клиент.

## Написано

- Пак **40**: `arch.params.client_bundle_max_bytes`, `client_on_host.construction_tests` = `client_boot_requires_city_time`, `command_posts_intent`. L275.
- Кодоген `listen.ts`: `packTemplate`, `stateTemplate`, `commandTemplate`.
- `clock.ts`: `wallNowMs()` = `Date.now`. eslint allowlist `clock.ts`.
- `boot.ts`: `GET /pack/{hash}` затем `GET /city/{id}/state`. Нет `city_time` → `API_PACK_STALE`. `emptySnapshot` в boot запрещён.
- `command.ts`: `intent_id` + `expected_city_time`. Без `Date`.
- `main.tsx`: HTTP boot; ошибка = `BootError` с `data-key=code`, не нули.
- `LiveRoot.tsx`: `POST /command/*`, refetch state. `account_kind` → demo.
- `http.ts` `projectState`: `tick.capital` / `energy` / `compute`, `aggregate.payroll_ratio`, `account_kind`.
- `commit.ts` `applyLive`: hire/build через `applySpend`. Нет `tile` → `BUILD_TILE_ILLEGAL`. Прочие эффекты — первый код T9.
- Тест сидит Capital через `mintFromBacking` (I1).
- GATE_PERF §7 ссылается на ключ пака, число не дублирует.

## Решения

- `Date.now` только в `clock.ts` (D-L-4).
- Порт тестов — `listenApi(host, 0n)`.
- Клиентский `src` не импортирует `services/*`; harness только из `test/`.
- Потолок бандла — ключ пака; измеренный JS ~712 kB, потолок держит.

## Не это этап

`openPg`, Solidity, compose, RPC live, анимация, WORLD.md геометрия тайла.
