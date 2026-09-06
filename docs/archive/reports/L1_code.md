# L1 — журнал кода

Клейм `$CORP` на экране согласован с C11. Миссии остаются stub. Процесс не поднимался. Экономические числа не двигались.

Пак после `python content/build.py`: **507 025** канонических байт, хеш **`a26da3e45b44fafe91d163a6c76bc96594932470534cdc04cf59107082fc8e2f`**, `pack_version` **38**, `rules_version` **0.18.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `docs/reports/L1_recon.md` | разведка |
| `docs/reports/L1_code.md` | этот журнал |
| `docs/reports/L1_rules.md` | пробы и поимки |
| `docs/reports/L1_final.md` | гейт и атаки |

Новых `it()` нет. `prize_claim_live.construction_tests` пустой.

## 2. Изменено

`content/params/screens.json` — `leaderboard_claim_live.v` 0→1, `leaderboard_claim.v1` stub→live, `requires` без `v1_feature`, `wallet` и `not_demo_prize` на месте, `why`/`src` на §12. `content/params/meta.json` 37→38. `content/lint.py` L162 биективный + запрет `v1_feature` при флаге 1. `content/attack.py` — три атаки L162, `a_l165_claim_without_wallet`, `construction_stub_endpoint_no_spend` только `missions_start`. `docs/SCREENS.md` экран `leaderboard` и §9. `DESIGN.md` §12 абзац выплаты. `HUD.md` §9. `content/fixtures/hud_screens.json` — `leaderboard_claim` снят с `cut_v1`. `services/api/test/c3.test.ts` и `apps/client/test/c5.test.ts` — те же имена, новые тела. Кодоген и векторы пересобраны.

## 3. Решения, которые не открывают развилку

- L162 после флипа односторонним молчал бы (`RK-L-12`). Правило сверяет `v1` с флагом в обе стороны и ловит живой клейм с оставленным `v1_feature`.
- Атака L162 больше не снимает `wallet`: это L165 (`A-12`).
- Имя `stub_endpoint_no_spend` не дублируется на `prize_claim_live` (`L268`).
- `rules_version` 0.18.0: слоты записи не едут (CONTENT.md §5 minor, L266).

## 4. Инертность

`python content/build.py`: круг 14.47% / с Trader 11.67%. `python content/sim.py`: калибровка `A_t2=14011`, возвраты 2837/8213.

## 5. Чужое в том же дереве

`R-L-17`: L273 / `build_tile` / арт-pending закрыты не этим шагом. Пак 38 их содержит. L1 их не откатывал.
