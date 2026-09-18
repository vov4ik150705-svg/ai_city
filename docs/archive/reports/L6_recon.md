# L6 — разведка

Freeze owner-чисел. Без датированного снимка этап не стартует (`D-L-10`, `A-4`).

Вход: пак **41**, `rules_version` **0.18.0**, хеш **`d4714818738c59832538059532c268cef9aea8e91170abe4fada967b88315be3`**, lint **276/0**, PENDING **6**, vitest **65/0**. L4 закрыт. L5a/L5b закрыты. `districts.stake.snapshot` = `null`.

## Прочитано

PLAN_LIVE §4 L6, D-L-10, R-L-12, RK-L-9, A-4; DESIGN.md §4.5 / §12; CONTENT.md §1 п.4, L39; BALANCE.md §3 / снимок; LAUNCH.md §9 прокси; `pending.json`; схема `district_stake`; L141 (точка LLM).

## Фид 2026-08-29T23:19:30Z

RPC `https://rpc.mainnet.chain.robinhood.com` без `Origin` даёт Cloudflare **1010/403**. С `Origin: https://robinhood.com` — `eth_chainId` = `0x1237` (4663), блок **49538311**. Селектор `latestRoundData()` = `0xfeaf968c` (не `0xfeaf827c`). Все шесть прокси + ETH/USD отвечают, `decimals` = 8, код 9571 байт.

| тикер | answer (8dec) | updatedAt UTC | S_min atoms (target×10^18 // answer) |
|---|---:|---|---:|
| NVDA | 21815545000 | 2026-08-28T19:56:29Z | 458388731521490753 |
| TSLA | 34836125000 | 2026-08-28T19:54:49Z | 287058333841665799 |
| AMZN | 26608500000 | 2026-08-28T19:30:33Z | 375819756844617321 |
| AAPL | 31971273059 | 2026-08-28T17:37:31Z | 312780788601878113 |
| MSFT | 51296000000 | 2026-08-28T19:32:53Z | 194946974422956955 |
| COIN | 17771685000 | 2026-08-28T20:02:21Z | 562692845388605526 |

Единица `tokens` как у `token_supply`: атомы 18 dec (`docs/LAUNCH.md` §13). Целое 1 бумагу дало бы $178–$513 и выбило полосу 50–150 $. Floor держит стейк ≤ 100 $. `round_id` > 2^53 в пак не кладётся.

Сток-фиды с пятницы: heartbeat 86400 с, воскресенье не печатает. ETH/USD свежее (2026-08-29T19:13:35Z). Стейк стоков, не ETH.

## LLM


## ТЗ на шаг

Записать snapshot + шесть `s_min`. `district_stake_reference` derived. Снять `district_stake_*` из pending. Усилить L39: формула, все тикеры, `at`. Три красных прогона L39 руками. `smin_frozen_in_tokens`. Пак +1. LLM не трогать.
