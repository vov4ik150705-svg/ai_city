# G6 — разведка

`companion_revenue`: счёт инференса; краны NFT нулём с причиной; без ожидания владельца. `launch.deployed` пуст. Водяной знак призов 19. `rules_version` 0.20.0. Пак 60. G5_final на диске.

## Предусловие

Пять полей `deployed` пустые. G5 закрыт: `companion_rows_live=1`, relief 1000, focus allowed. `companion_revenue_live=0`. `prize_nft_share_bps=0`, `fragment_nft_share_bps=0`. Сплит трат 10000/0 (L304). Пол фонда 100 bps (L280). `demo_companion=0`.

## Что уже есть

L128: краны 0 пока `companion_revenue_live=0`; сплит protocol = 10000. Поднять флаг — L128 перестаёт ловить ненулевой кран. L98: кран без секции companion. L120: prize cork/nft 0. Интервал цены вызова — `companion.llm` (L141); точка ждёт `companion_llm_price_snapshot` (T12). GENERATED «T8: стоимость инференса» считает счёт, но sink выручки в паке не назван. COMPANION.md §10 всё ещё пишет сплит 6000/4000 — это до Rev-A; канон L304 = 10000/0.

`D-G-9`: не направлять в пул без ратификации; этап закрывается зафиксированным нулём, не ожиданием. Band не двигает — `sim.py` не в шаге.

## Решение этапа

Не поднимать `companion_revenue_live` (это замок L128). Не открывать краны. Завести `nft_proceeds_sink=inference_bill`. L312: live=0, оба крана 0, sink на месте, интервал счёта живой, пол L280, сплит 10000. Красный вход плана §5: `prize_nft_share_bps=400`.

## Риски

Направить выручку в пул (`A-G-7`, L312). Поднять `companion_revenue_live` и обойти L128. Ослабить пол фонда (`L280`). Стоять на ожидании владельца. `sim.py` на нулевых кранах. Полный `--jobs 8` на закрытии: правится `lint.py`.
