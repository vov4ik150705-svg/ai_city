# C5 — разведка

Клиент на протоколе и mock-порте, без счёта экономики. Строка ROADMAP `client_on_mock`. C3 закрыт (PGlite, Neon не нужен) и **не блокирует** C5. C4 закрыт. Смотрит на C3 для живых данных, обязан работать на fixture/mock snapshot.

## Прочитано

PLAN_CODE §4 C5, D-C-12, D-C-13; HUD.md §2 §6–§9; WORLD.md §8; SCREENS.md; L158 L185 L230 L268; art/out/scene.json + sprites.json; hud_layout fixture; C3_final / C4_final.

## Дерево до шага

`apps/client/src/index.ts` = `export {}`. Gate = `tsc --noEmit`. `client_on_mock.construction_tests` пустые. `allowed_deps` = protocol, engine. PNG в `art/out` нет — сцена рисуется Graphics из карты и палитры.

## Решения

- **R-C-17.** Имя `demo_barrier_holds` перенесено с C3 на C5: гейт C5 буквально `pnpm --filter @corporator/client run test -- -t demo_barrier_holds`, L268 запрещает два `it()`. SQL CHECK `demo→wallet` остаётся внутри C3 `replay_from_storage`. Python `construction_demo_barrier_holds` / L255 не трогаты.
- `allowed_deps` += `contentpack` (D-C-12, bigint-safe pack). Не chainport, не сервисы, не драйверы БД.
- Движок: только `preview()` readonly. `tick` / агрегаты банятся eslint.
- Часы: `nowMs` инъекция; `Date.now` только на краю `main.tsx`.
- Сцена: PixiJS v8, тайлы из `scene.json` + `corporator.hex`. Без `art/raw`.

## Риски этапа

RK-7 (время клиента), RK-12 (демо), RK-13 (бандл).
