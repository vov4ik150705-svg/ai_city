# L3 — разведка

Клиент на хосте. Предпросмотр readonly. Тик не считает клиент.

Вход: пак **39**, `rules_version` **0.18.0**, хеш **`38611d150835651e40e9c204dba641b9a42f02568dd859bcbbfa0c7d4b5d5db9`**, lint **274/0**, vectors **21**, vitest **61/0**, PENDING **6**. `R-L-3` открыт.

## Прочитано

PLAN_LIVE §4 L3, D-L-4, D-L-7, D-L-11, A-3, RK-L-3/7/12/15, R-L-3, R-C-12; HUD.md §8; SCREENS.md §1–3; API.md §1–4; `apps/client` C5; `screens.actions` `commit:hire` / `commit:build`; GATE_PERF без клиентской строки; `client_on_host.construction_tests` пустой; имена `client_boot_requires_city_time` и `command_posts_intent` в vitest нет.

## Дерево до шага

- `main.tsx`: пак с диска, `emptySnapshot()`, `Date.now()`, `demo: true`.
- `clock.ts` не вызывает `Date.now`; eslint **запрещает** Date в `clock.ts` и оставляет его на краю `main.tsx` — наоборот D-L-4.
- `GET /city/{id}/state` отдаёт пустые `sections`; `tick.capital` не проецируется.
- `handleCommand` не исполняет live: первый код T9. `applySpend` есть в engine, с `index` не экспортируется.
- Клиент не бьёт в HTTP. `L230` запрещает зависимость на `services/*`.
- Бандл: C5 warning Pixi >500 kB, порога в паке и в GATE_PERF нет (`R-C-12`).
- Заняты L268: `client_preview_is_readonly` (C5), `demo_barrier_holds` (C5). Новые имена — только `client_boot_requires_city_time`, `command_posts_intent`.

## ТЗ на шаг

1. Boot: `GET /pack/{hash}` (Cache-Control из пака), затем `GET /city/{id}/state`. Нет `city_time` в конверте или нет сервера — код `API_PACK_STALE`, экономический HUD не рисуется.
2. `expected_city_time` с конверта. `demo` с `account_kind`. Кошелёк — существующий UI пака.
3. `Date.now` только в `clock.ts` (`wallNowMs`). eslint allowlist `clock.ts`.
4. `POST /command/hire` и `/command/build` на mock: `applySpend`, следующий снимок `tick.capital` меньше. Геометрия тайла на mock: поле `tile` есть — ворота пройдены; нет — `BUILD_TILE_ILLEGAL`. Исполнение WORLD.md — не этот этап.
5. L275 + два `construction_tests`. Пак **40**. Строка бюджета клиента в GATE_PERF и ключ пака `client_bundle_max_bytes`.
6. Solidity / Postgres / арт не входят. `AssetPort.kind=mock`.

## Риски

- `it()` без строки L268 (A-13 / RK-L-15).
- `Date.now` в экономике клиента (RK-L-3).
- Запись preview (RK-L-7): Preview остаётся frozen.
- Демо берёт приз (RK-L-12): клейм не исполняется, первый код T9 как в C3.
- Сид Capital без депозита ломает I1: тест минтит через `mintFromBacking`.
- Порт 7460 в параллельном vitest: тесты слушают `0`.
- Клиентский тест не импортирует api из `src`; harness только из `test/`.
