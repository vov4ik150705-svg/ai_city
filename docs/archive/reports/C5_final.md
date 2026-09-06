# C5 — итоговый отчёт шага

Клиент Vite/React/Pixi на mock-снимке. Экономика не тронута. Neon не нужен. C3 не блокирует.

Пак **30**, `rules_version` **0.17.0**, хеш **`28772ba035dac0316a24b670e1f784db5583d3cf1062fe9dace1860fda634bb8`**, 486405 байт.

---

## 1. Что закрыто

- Строки HUD ⊂ `content/strings/ru.json` (`strings` ∪ `ui`). Кириллический литерал в `src` роняет eslint.
- `Preview` readonly: присваивание не компилируется (TS2542).
- Бандл `dist-web` без `chainport` / pglite / `pg`. L230 на src и package.json.
- Все `screens.actions` достижимы (T9: unreachable 0). Safe rect > 0, остров на zoom_min (L185).
- Демо: withdraw → `DEMO_NO_WITHDRAW`; stub+demo claim → `DEMO_NO_PRIZE` раньше `FEATURE_NOT_IN_V1`.
- `it("demo_barrier_holds")` ровно один, на `@corporator/client` (R-C-17).

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 30; круг 14.47% / Trader 11.67% |
| хеш | `28772ba035dac0316a24b670e1f784db5583d3cf1062fe9dace1860fda634bb8` |
| байты | 486405 |
| `python content/lint.py` | **272/0**, PENDING 27 |
| `python content/vectors.py` | 20; sha256 `96d72b5d57f1df1d82b1502b63061f8ba17334dbf3eaaa51314893b617f75f7b` |
| `python content/codegen.py --check` | 12 match `28772ba035dac031` |
| `python content/attack.py --only L230` | 3/3 пойманы |
| `python content/attack.py --jobs 8` | **499/0**, construction **145/0**, 437.4s |
| `pnpm --filter @corporator/client run gate` | tsc; vitest **5/0** |
| `vitest run -t demo_barrier_holds` | **1/0** (4 skipped) |
| `pnpm -w run gate` | tsc-b + eslint + depcruise **267/0**; vitest **39/0** |

## 3. Конструкционные пробы C5

`demo_barrier_holds`, `client_strings_from_pack`, `client_preview_is_readonly`, `client_sees_no_chainport`, `hud_safe_rect_positive`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-6 | CID | C8 |
| R-C-11 | engine magic-numbers off | C1 |
| R-C-13 | canonical копия в contentpack | C2 |
| R-C-14 | C2-имена не дублировать | C3 |
| R-C-15 | PGlite не Neon | C3 |
| R-C-16 | список RPC-модулей | принято |
| R-C-17 | `demo_barrier_holds` имя на C5, SQL CHECK в C3 | **принято** |

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| chainport в allowed_deps | L230 | поймано | держит |
| import chainport в src | L230 | поймано | не декорация |
| pglite в package.json | L230 | поймано | манифест |
| таблица без `ui` | нет UI_BANK | undefined | закрыто merge |
| `fs.execFileSync` | tsc/vite | not a function | `child_process` |
| 4×`../` в main | vite build | UNRESOLVED_IMPORT | 3×`../` |
| `p.fund = 2n` | tsc ≠ 0 | TS2542 permits reading | matcher |
| кириллица в index.ts | eslint ≠ 0 | status ≠ 0 | A-4 |
| demo withdraw | DEMO_NO_WITHDRAW | код | RK-12 |
| leaderboard_claim demo | DEMO_NO_PRIZE | не FEATURE_NOT_IN_V1 | identity first |
| HUD column 0 | L185 | поймано | safe rect |
| vitest 5s + `-w` parallel | пробы живы | timeout | 60s на клиенте |

Выжившее: живой RPC — C10. CID — C8. `build_tile_refusal` текст — автор канона, не код. Pixi chunk >500 kB — warning, бюджета в GATE_PERF нет.

## 6. Незакрытое

C6: sampler. C10: rpc parity. Спрайты T10. `build_tile_refusal` — T10.

Next: C6 — `services/sampler`.
