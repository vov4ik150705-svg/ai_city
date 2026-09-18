# L9 — итоговый отчёт шага

`launchToken` без покупки. `launch_buy_share_bps = 0`. Налог пака = `PackConstants`. Круг 14.47% не пересчитан. Живой tx на Robinhood — `R-L-22`.

Пак **45**, `rules_version` **0.18.0**, хеш **`76e99b6f2704bfa4d1781a184c8b310201f146529a656d4135620cd4d32478c3`**, 517404 байт.

## 1. Что закрыто

- Доля покупки 0, derived buy 0, GENERATED печатает 0.000000 ETH / 0 tokens.
- `rpc/launch.ts`: intent `valueWei = 0n`; подписанный hex через `eth_sendRawTransaction`; `eth_call` `creatorTaxBps()` `0xc1bb8901`.
- `launch.deployed` пуст целиком; частичное заполнение — L279.
- Три `it()` = `construction_tests`. Не пятая группа порта. Ключей в репо нет.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0; pack 45; круг **14.47%** / Trader **11.67%**; buy **0** / share **0** |
| хеш пака | `76e99b6f2704bfa4d1781a184c8b310201f146529a656d4135620cd4d32478c3` |
| канонические байты | 517404 |
| `python content/lint.py` | **279/0**, PENDING **3** |
| `python content/vectors.py` | 21; sha256 `1349acda268bc3771d56e07bccbac49f5437b2f19e79dea966c8604e6ce2c284` |
| `python content/codegen.py --check` | 19 match `76e99b6f2704bfa4` |
| tsc / eslint | ok |
| depcruise | **448/0** (1335 deps) |
| vitest run | **74/0** |
| `python content/attack.py --only L24,L13,L14,L279` | **279 covered**, construction **171**, L279 **5/0**, 210.9s |
| `python content/attack.py --jobs 8` | **565/0**, construction **171/0**, 279 covered, 739.0s |
| `python content/sim.py` | калибровка `A_t2=14011`, возвраты 2837/8213 |

Касса и круг не сдвинулись. Новых npm-зависимостей нет.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| share 250 | L279 | launch buy share is 250 bps | OK |
| `launchAndBuy` в launch.ts | L279 | still buys at launch | OK |
| нет launch.ts | L279 | does not post eth_sendRawTransaction | OK |
| PackConstants tax 200 | L279 | does not match pack | OK |
| только token заполнен | L279 | partial launch.deployed | OK |
| vault fee > bank markup | L14 | entry >= exit | OK |
| bank markup 200 | L13 | 777 bps outside 1400–1600 | OK |
| Q0 ≠ KOTS | L24 | not the measured ETH curve | OK |
| JSON-число в sendRaw | silence | vitest PASS | OK |
| `launchIntent(1n)` | undefined | vitest PASS | OK |
| `test("0x…")` в l9 | L268 vitest name `0x` | поймано, assert убран | закрыто |
| C2 count 63 | 60 после share 0 | 63→60 | закрыто |
| `rm` embedded PG на Win | EBUSY в finally | retry | закрыто |
| все пять deployed выдуманы | формат L279 молчит | нет живой сверки адресов | **R-L-22** |
| живой Robinhood без ключа | не шлём | пустой deployed | **R-L-22** |

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-22 | CI не шлёт `launchToken`; `launch.deployed` пуст; полный фейк-hex формат не ловит | принято; заполнение — факт владельца после tx |
| R-L-21 | viem не установлен | принято (L8) |
| R-L-20 | TTL `block.timestamp`; лимит пула на сервере | принято (L7) |
| R-L-19 | LLM точка без счёта | принято (L6) |

## 5. Незакрытое


Живая фаза L0–L9 закрыта. Следующее — факт владельца: подписать `launchToken` без ETH, записать адреса в `launch.deployed.*`.
