# C5 — журнал кода

Клиент на протоколе и mock-снимке, без счёта экономики. Строка ROADMAP `client_on_mock`. Круг 14.47% / Trader 11.67%.

Пак: **486405** байт, хеш **`28772ba035dac0316a24b670e1f784db5583d3cf1062fe9dace1860fda634bb8`**, `pack_version` **30**, `rules_version` **0.17.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `apps/client/src/values.ts` | bigint-safe asObj/asBig/asText/paramV |
| `apps/client/src/strings.ts` | `strings` + `ui` из `ru.json`; lookup; `labelKey` |
| `apps/client/src/clock.ts` | `nowMs` инъекция; плашка банка |
| `apps/client/src/layout.ts` | safe rect из фикстуры HUD |
| `apps/client/src/preview.ts` | `Preview` readonly, freezeDeep, без tick |
| `apps/client/src/demo.ts` | identity (`not_demo_*`) раньше stub |
| `apps/client/src/packview.ts` | ClientPack из пака |
| `apps/client/src/iso.ts` | сцена + проекция |
| `apps/client/src/palette.ts` | `corporator.hex` → CSS/Pixi |
| `apps/client/src/hud/model.ts` | `buildHud` только ключи `ru.json` |
| `apps/client/src/hud/App.tsx` | React HUD |
| `apps/client/src/hud/SceneHost.tsx` | Pixi Graphics, без PNG |
| `apps/client/src/main.tsx` | край: `Date.now`, fetch пака |
| `apps/client/vite.config.ts` | `dist-web`, `assetsInclude` hex |
| `apps/client/vitest.config.ts` | node env; timeout 60s (tsc/eslint/vite в пробах) |
| `apps/client/test/c5.test.ts` | пять имён `client_on_mock.construction_tests` |
| `apps/client/test/preview_write_fail.ts` | присваивание в `Preview` |

## 2. Изменено

`meta.json` 29→30, `arch.json` `allowed_deps` += contentpack, `types_react` / `types_react_dom`, construction_tests C3→C5 для `demo_barrier_holds`, `lint.py` L230 скан `apps/client/src` и `package.json`, `attack.py` overlay import/pglite, `eslint.config.js` ban chainport/pglite/pg/tick/кириллица, `vitest.workspace.ts`, `.gitignore` `dist-web/`, `docs/CONTENT.md` §5 байты и L230.

## 3. Решения

- Тексты: `strings` (коды) ∪ `ui` (хром). L146. Templates не смешиваются.
- Engine: только `import type { Dict }` + `preview()`. Tick/агрегаты — eslint.
- Часы: SI 3600×1000 только как стена, не ставка пака. `Date.now` только в `main.tsx`.
- Бандл: grep `dist-web` на chainport/pglite. Pixi даёт warning >500 kB — бюджета в GATE_PERF нет.
- `execFileSync` из `node:child_process`. Vitest не берёт `vite.config.ts` (отдельный `vitest.config.ts`).

## 4. Инертность

Круг 14.47% / 11.67%. Клиент не минтит Capital. Касса не считается на клиенте (L158).
