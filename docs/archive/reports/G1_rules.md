# G1 — пробы и поимки

Новое правило **L307**. Изменены L66 (v1 = полное при шести), L21 (объявленные роли), L91 (маяк logistics), `builds_gate` / `pair_slice`.

Пак: **559 250** байт, хеш **`730c7fdde2a9423c92be914464fb67f457735fb01b9bc728650ad86063d214be`**, `pack_version` **56**, `rules_version` **0.20.0**.

## L307

| что ловит | вход падения | поимка |
|---|---|---|
| играбельных ≠ 6 | `logistics.playable_v1=false` | `playable districts 5 != 6` |
| automation не жив | `automation.playable_v1=false` | `playable districts 5 != 6` (и `automation not playable`) |
| finance не жив / доля | `finance.playable_v1=false` | `playable districts 5 != 6` (и `3000+0 < cap 3500`) |
| оффлайн ≠ 18 при шести | база оффлайна 11 | `offline 11+6 != 18` |
| возвраты вне полос | `fund_amplification_target_bps=10000` | `return_min_bps 2851 outside envelope` |

План §5: красный вход L307 — оставить `logistics.playable_v1 = false`. Пойман.

## L66 / L69 / L91 / L160 / L283

| id | вход | поимка |
|---|---|---|
| L66 | авторский `v1_nodes` | `v1_nodes is authored` |
| L69 | `zero_effect_orphan` | unwitnessed family member |
| L91 | workshop IDLE | accrues while IDLE |
| L91 | logistics_hub `tier=basic` | `playable logistics_hub accrual is 0` |
| L160 | automation `playable_v1=false` + ungated live | `plays non-v1 district automation without DISTRICT_LOCKED` |
| L283 | logistics false + basket = playable | `prize_assets` ≠ all tickers |

## Конструкции `districts_live.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `six_districts_playable` | logistics false | L307 |
| `offline_cap_reaches_eighteen` | automation false | L307 |
| `fund_share_reaches_cap` | finance false | L307 |
| `merge_active_cap_is_three` | cut района | L307 |
| `window_a_in_envelope` | A=10000 | L307 |

Vitest: пять `it()` = пять имён. Зелёный пакет + синтетический красный внутри теста.

Конструкций в харнессе: **206**.
