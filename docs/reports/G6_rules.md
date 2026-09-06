# G6 — правила

Новое правило **L312**. Замок **L128** не менялся. Пол **L280** переиспользуется внутри L312. Полный `--jobs 8` на закрытии: правился `lint.py`.

## L312

Ловит: `companion_revenue_live ≠ 0`; `nft_proceeds_sink ≠ inference_bill` (в том числе снятие поля); `prize_nft_share_bps` или `fragment_nft_share_bps ≠ 0`; сплит protocol не 10000/0; пустой интервал `companion.llm`; `advisor_calls_per_city_day ≤ 0`; эффективная ставка фонда ниже пола (`L280`); `demo_companion ≠ 0`.

План §5: красный вход — `prize_nft_share_bps = 400` без ратификации. Пойман (`a_l312_prize_tap`).

## Почему live остаётся 0

При `companion_revenue_live=1` и `prize_nft_share_bps=400` L128 молчит. L312 ловит и флаг, и кран. Поднять флаг на этом этапе — открыть дверь A-G-7.

## Пробы

| id | красный вход | что ловит |
|---|---|---|
| `nft_crane_zero_by_default` | `prize_nft_share_bps=400` | L312 кран |
| `revenue_not_in_pool_without_ratification` | `sink=prize_pool`; `companion_revenue_live=1` | L312 пул / дверь L128 |
| `inference_account_present` | интервал `[0,0)` | L312 счёт |

## Затронутые

L143 — замок компаньона, без правки. L280 — пол фонда, без правки, повтор в L312. L128 — краны при live=0, без правки.
