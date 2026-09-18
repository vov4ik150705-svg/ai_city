# L1 — итоговый отчёт шага

Клейм `$CORP` live. Миссии stub. Канон механик §11 не переписывался. §12 абзац выплаты пословный.

Пак **38**, `rules_version` **0.18.0**, хеш **`a26da3e45b44fafe91d163a6c76bc96594932470534cdc04cf59107082fc8e2f`**, 507025 байт.

---

## 1. Что закрыто

- `leaderboard_claim_live=1`, `leaderboard_claim.v1=live`, `requires` = `not_demo_prize`, `wallet`.
- GENERATED `leaderboard_claim` = `live`; отказы `DEMO_NO_PRIZE`, `WALLET_NOT_CONNECTED`; нет `FEATURE_NOT_IN_V1`.
- `construction_stub_endpoint_no_spend` только `missions_start`.
- L162 биективный + запрет `v1_feature` на живом клейме.
- `R-L-2` закрыто. Три warning `PRIZE_*` на `leaderboard`.
- `stub_endpoint_no_spend`: `claim_prize` → `DEMO_NO_PRIZE`, не `FEATURE_NOT_IN_V1`; `noop` по-прежнему `FEATURE_NOT_IN_V1`; фонд не движется.
- `demo_barrier_holds`: demo → `DEMO_NO_PRIZE` раньше stub; wallet-путь не `FEATURE_NOT_IN_V1`.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; pack 38; круг 14.47% / Trader 11.67% |
| хеш пака | `a26da3e45b44fafe91d163a6c76bc96594932470534cdc04cf59107082fc8e2f` |
| канонические байты | 507025 |
| `python content/lint.py` | **273/0**, PENDING 6 |
| `python content/vectors.py` | 21; sha256 `ad379f822de92d4cacdeac8c6f0bb40b8873a17e0b20ac33cf14f9b2d755f82c` |
| `python content/codegen.py --check` | 15 match `a26da3e45b44fafe` |
| `tsc -b` / eslint / depcruise | ok; **362/0** |
| vitest run | **58/0** |
| `python content/attack.py --only L162,L165,L155` | пойманы; construction после сужения держит |
| `python content/attack.py --jobs 4` | **522/0**, construction **155/0**, 273 covered, 773.1s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |

`--jobs 8` в этой среде убивался (exit 4294967295, пустой stdout). `--jobs 4` зелёный. `pnpm` не в PATH; гейт TS — `node_modules/.bin`. Новых зависимостей нет.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| флаг 0 при `v1=live` | L162 | `v1=live while leaderboard_claim_live=0` | биекция |
| `v1=stub` при флаге 1 | L162 | `v1=stub while leaderboard_claim_live=1` | биекция |
| live + `v1_feature` | L162 | сначала молчал; закрыт | дыра закрыта |
| `wallet` снят с клейма | L165 | `moves value without identity token wallet` | A-12 |
| старый кортеж конструкции | construction | `leaderboard_claim v1=live` | A-11, затем сужение |
| старый vitest `FEATURE_NOT_IN_V1` | красный | `DEMO_NO_PRIZE` | тело сменено |
| старый vitest `v1=stub` | красный | `live` | тело сменено |
| spend на missions | L155 | ловит | миссии stub |
| `demo_blocked=0` при живом клейме | клиент пропускает `not_demo_*` | до-L1; L153 односторонний | названо, не закрыто (не L1) |

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-2 | экран stub при живой выплате | **закрыто** |
| R-L-17 | в дереве закрыты L273 / арт-pending | принято: параллельный T10; пак 38 содержит оба |

## 5. Незакрытое

PENDING 6 (T2/T3/owner). Процесса нет (`R-L-4`). Миссии stub (`R-L-8`).

Next Step: **L2** — `process_hosts`.
