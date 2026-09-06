# L1 — разведка

Клейм `$CORP` на экране. Движок уже платит Zipf (C11). HUD лжёт (`R-L-2`). Миссии остаются stub (`R-L-8`). Процесс не поднимается.

Вход: пак **37**, `rules_version` **0.18.0**, хеш **`226adb8a4ba399c1894c72a9c1c9cced84a3bcc8bf1a3b6d5db2c94bb497a684`**, lint **272/0**, vectors **21** / `a8a71246…`, vitest **58/0**, attack **517/0**, PENDING **26**.

## Прочитано

PLAN_LIVE §4 L1, D-L-5, A-11, A-12, RK-L-2, RK-L-12, R-L-2, R-L-8; DESIGN.md §11 (не переписывать) и §12 абзац «Выплата призов»; HUD.md §9; docs/SCREENS.md экран `leaderboard` и §9; screens.json `leaderboard_claim_live` / `leaderboard_claim`; L155, L162, L164, L165, L234; `construction_stub_endpoint_no_spend`; `stub_endpoint_no_spend`; `demo_barrier_holds`; CONTENT.md §5 (minor: слоты записи не едут, `rules_version` 0.18.0).

## Дерево до шага

- `leaderboard_claim_live.v = 0`, `leaderboard_claim.v1 = stub`, `requires` = `not_demo_prize`, `wallet`, `v1_feature`.
- L162 односторонний: ловит только `live=0` при `v1≠stub`. После флипа атака `a_l162_prize_claim_live` (ставит `v1=live` и снимает `wallet`) перестанет ловить L162 и попадёт в L165 (`RK-L-12` / A-12).
- `construction_stub_endpoint_no_spend` жёстко требует `leaderboard_claim` stub + `FEATURE_NOT_IN_V1` (A-11).
- Хост `handleCommand`: stub → `FEATURE_NOT_IN_V1`; иначе первый код матрицы. После снятия `v1_feature` первый код — `DEMO_NO_PRIZE`.
- Клиент `attemptAction`: сначала `not_demo_*`, потом `v1==="stub"`. Демо уже получает `DEMO_NO_PRIZE` раньше stub.
- `prize_claim_live.construction_tests` пустой. Имя `stub_endpoint_no_spend` уже у `host_db_replay`. Новых `it()` нет (L268).
- L155 смотрит только действия на экранах `v1=stub`. Экран `leaderboard` уже live.
- Три warning-предиката `PRIZE_POOL_EMPTY` / `SEASON_SETTLED` / `PRIZE_HOP_STALE` сидят на `leaderboard_claim_live.v` — не трогать.
- `HUD.md` §9 и фикстура `hud_screens.cut_v1` всё ещё режут `leaderboard_claim`.

## ТЗ на шаг (не сокращать)

Выходы буквально из PLAN_LIVE §4 L1:

1. Одной правкой `screens.json`: `leaderboard_claim_live.v` 0→1; `leaderboard_claim.v1` stub→live; `requires` без `v1_feature`, с `wallet` и `not_demo_prize`; `why` переписан.
2. L162 биективный: флаг и `v1` совпадают. Атаки на рассинхрон, не на снятие `wallet`.
3. `construction_stub_endpoint_no_spend` сужается до `("missions_start",)`.
4. `docs/SCREENS.md` экран `leaderboard` и §9: клейм `live`. Без `\d{2,}` (L164). `DESIGN.md` §12 пословно: клейм жив после пересчёта `rules_version` 0.18.0. §11 не переписывать.
5. `pack_version` 37→38. `rules_version` 0.18.0. `layout_version` 1.
6. `stub_endpoint_no_spend` и `demo_barrier_holds` — те же имена, новые тела. `prize_claim_live.construction_tests` пустой.
7. Отчёты `L1_*.md`. `R-L-2` закрыто. Next Step → L2.

Критерий готовности — командами: `python content/lint.py && python content/attack.py --only L162,L165,L155 && python content/attack.py --construction-only` плюс vitest `-t stub_endpoint_no_spend -t demo_barrier_holds` плюс полный гейт протокола §9.

## Риски

`RK-L-2` GENERATED `v1=stub` при `season_prizes_live=1`. `RK-L-12` снять `wallet` вместе с `v1_feature`. `A-11` проба конструкции. L162 после флипа без биекции — декорация.
