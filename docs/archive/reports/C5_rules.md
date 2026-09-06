# C5 — пробы и поимки

Новых `L*` нет. L230 читает `apps/client/src` и `package.json` (оверлеи `_client_source`, `_client_package_json`).

Пак: **486405** байт, хеш **`28772ba035dac0316a24b670e1f784db5583d3cf1062fe9dace1860fda634bb8`**, `pack_version` **30**.

Конструкции vitest (`client_on_mock.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `demo_barrier_holds` | `attemptAction` demo+withdraw | `DEMO_NO_WITHDRAW`; claim-stub → `DEMO_NO_PRIZE` не `FEATURE_NOT_IN_V1` |
| `client_strings_from_pack` | таблица только `strings`, без `ui` | `UI_BANK` undefined; кириллица в `index.ts` → eslint ≠ 0 |
| `client_preview_is_readonly` | `p["fund"] = 2n` | tsc TS2542 «only permits reading» |
| `client_sees_no_chainport` | `../../../../content` (4×`../`); vite не стартовал из-за `fs.execFileSync` | UNRESOLVED_IMPORT; после 3×`../` бандл без chainport/pglite |
| `hud_safe_rect_positive` | колонка 0 (L185) | `safe_rect` не положительный |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| `allowed_deps` += chainport | L230 | `apps/client depends on chainport` |
| overlay `import "@corporator/chainport"` | L230 | `index.ts imports chainport or a DB driver` |
| overlay `package.json` pglite | L230 | `dependencies has @electric-sql/pglite` |
| `execFileSync` из `node:fs` | проба | `is not a function`; импорт с `node:child_process` |
| vitest 5s при параллельном `-w` | проба | timeout на eslint/tsc; `testTimeout` 60s на клиенте |
| Date в `clock.ts` | eslint | `Date.now lives at the React edge` |

Python `construction_demo_barrier_holds` / L255 не трогаты. Имя `it("demo_barrier_holds")` одно, на клиенте (R-C-17). SQL CHECK остаётся в C3 `replay_from_storage`.
