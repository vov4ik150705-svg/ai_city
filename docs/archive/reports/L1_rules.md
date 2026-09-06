# L1 — пробы и поимки

Новых `L*` нет. L162 расширен до биекции. Зона: `leaderboard_claim`, `construction_stub_endpoint_no_spend`, `stub_endpoint_no_spend`, `demo_barrier_holds`, L165 на `commit:claim_prize`.

Пак: **507 025** байт, хеш **`a26da3e45b44fafe91d163a6c76bc96594932470534cdc04cf59107082fc8e2f`**, `pack_version` **38**, `rules_version` **0.18.0**.

Vitest (имена прежние), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `stub_endpoint_no_spend` | пак live, старое тело ждёт `FEATURE_NOT_IN_V1` | `expected 'DEMO_NO_PRIZE' to be 'FEATURE_NOT_IN_V1'` |
| `demo_barrier_holds` | пак live, старое тело ждёт `v1=stub` | `expected 'live' to be 'stub'` |

Python-конструкции:

| имя | вход | дословная поимка |
|---|---|---|
| `construction_stub_endpoint_no_spend` | кортеж ещё содержит `leaderboard_claim` | `leaderboard_claim v1=live` |
| то же, после сужения | только `missions_start` | `NONE` |

Поимки правил:

| id | что ловит | вход | дословная поимка |
|---|---|---|---|
| L162 | флаг 0 при `v1=live` | `leaderboard_claim_live.v=0` | `prize claim v1=live while leaderboard_claim_live=0` |
| L162 | `v1=stub` при флаге 1 | `leaderboard_claim.v1=stub` | `prize claim v1=stub while leaderboard_claim_live=1` |
| L162 | `v1_feature` на живом клейме | `requires` += `v1_feature` | `prize claim still gated v1_feature while leaderboard_claim_live=1` |
| L165 | клейм без `wallet` | снят `wallet` | `action leaderboard_claim moves value without identity token wallet` |
| L155 | живой spend на missions | `missions_start` spend=capital | `stub-screen action missions_start is not gated FEATURE_NOT_IN_V1` |

GENERATED: `leaderboard_claim` = `live`, отказы `DEMO_NO_PRIZE`, `WALLET_NOT_CONNECTED`. Три `PRIZE_*` warning на `leaderboard`.
