# L9 — разведка

Запуск на pons без покупки. L8 закрыт. Владелец: `launch_buy_share_bps = 0`.

Вход: пак **44**, `rules_version` **0.18.0**, хеш **`fb79ffed32cbbeba359d5a46650a4b499a34b384ac3a45f4fb8396c45e69f7e7`**, lint **278/0**, vitest **71/0**, attack **557/0**, PENDING **3**.

## Прочитано

PLAN_LIVE §4 L9, L13_L14, RK-L-9/10; DESIGN.md §2.1 / §6.4; LAUNCH.md §2 / §4; BRIEF §2 п.5; launch.json; L24; L277 PackConstants; L278 live.ts; `eth_sendRawTransaction` из L8_final.

## Дерево до шага

- `launch_buy_share_bps = 250`. GENERATED жёстко печатает 2.5% и ищет строку 250.
- `launch.deployed` нет. Адреса не выдумывать.
- `launchAndBuy` в коде нет, в каноне есть.
- live.ts: unsigned `eth_sendTransaction`. Ключей в клиенте нет.
- Селектор `creatorTaxBps()` на кривой: `0xc1bb8901` (LAUNCH.md §8).
- Живой `launchToken` на Robinhood без ключа владельца не отправляется.

## ТЗ на шаг

1. Пак: `launch_buy_share_bps = 0`. Круг 14.47% не пересчитан. L24/L13/L14 зелёные.
2. `launch.deployed` пустые адреса; частично заполнить — отказ.
3. `rpc/launch.ts`: intent value 0, `eth_sendRawTransaction` подписанного hex, `eth_call` налога. Не пятая группа порта.
4. L279 + три `it()` = `construction_tests`. Пак **45**.
5. Канон: DESIGN §2.1, LAUNCH §4, BRIEF п.5, PLAN_LIVE критерий L9. Адреса post-factum: **R-L-22**.

## Риски

- RK-L-10: не добавлять группу порта.
- Выдуманный ABI `launchToken` не кодировать: verified source нет (LAUNCH.md §11.1).
- Подпись raw — аргумент края, не ключ в репозитории.
