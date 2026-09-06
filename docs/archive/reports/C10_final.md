# C10 — итоговый отчёт шага

Живой RPC-кодек, живой корень merkle, `stake_snapshot` записанным входом. Layout v1 без сдвига байт. Строка ROADMAP `chain_v1_1`.

Пак **35**, `rules_version` **0.17.0**, хеш **`8cc0f7a6149a0b11412ac4e1f90ec172cb1e481a714532a2aef13ddf7ae0d451`**, 492042 байт.

---

## 1. Что закрыто

- `rpc` на каждом методе порта совпадает с `mock` на общем наборе фикстур, включая `2**53+1`.
- `putRoot` hex = `bytesToHex(merkleRoot(...))` локального аттестатора. `layout_version` = 1 (`L200`, `L266`).
- Молчание / ложь / JSON-число / hex-сумма → `SERVICE_DEGRADED`. Тик не блокируется и не минтит.
- `stake_snapshot` в заголовке из входа, не из порта внутри тика. `wallet.chain` / `wallet.corp_balance` — канал `price`.
- L268: три новых имени. `layout_v1_bytes` не дублирован. Закрывает `R-T11-10`, `R-T11-12`, `R-T12-9`.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 35; круг 14.47% / Trader 11.67% |
| хеш | `8cc0f7a6149a0b11412ac4e1f90ec172cb1e481a714532a2aef13ddf7ae0d451` |
| байты | 492042 |
| `python content/lint.py` | **272/0**, PENDING 26 |
| `python content/vectors.py` | 21; sha256 `974dcc3c8ef0f7506872b39af7979e0135fa553ede3abf08d675cfd9f3e67db5` |
| `python content/codegen.py --check` | 15 match `8cc0f7a6149a0b11` |
| `python content/attack.py --only L246,L256,L257` | 6/6 пойманы |
| `python content/attack.py --jobs 8` | **513/0**, construction **151/0**, 1483.9s |
| `pnpm --filter @corporator/chainport run test -- -t rpc_parity` | chainport 5/0 |
| `pnpm -w run gate` | depcruise **357/0**; vitest **55/0** |

## 3. Конструкционные пробы C10

`rpc_parity_with_mock`, `rpc_silence_is_open`, `stake_snapshot_is_recorded_input`. Красный прогон каждого — `C10_rules.md`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-21 | три C3-имени не дублировать на C9 | принято |
| R-T11-10 / R-T11-12 / R-T12-9 | live-корень и wallet.* вне тика | **закрыто C10** |

Новых R-C-* нет.

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| stub `FEATURE_NOT_IN_V1` в rpc | L257 | still stubs | живой скан |
| engine import chainport | L257 | imports chainport | RK-9 |
| viem в mock.ts | L257 | outside rpc/ | rpc_import_only |
| JSON-число amount | silence | SERVICE_DEGRADED | нет float на проводе |
| amount `"0x10"` | silence | BigInt принял бы 16n | **нашлось**; `parseDec` |
| ложь `{"ok":true}` mint | не минт | capital 0, tick идёт | не путь минта |
| нет транспорта | open | SERVICE_DEGRADED | C4 совместим |
| layout ждут 0n | красный | got 1n | L200 живой |
| freeze затем stake ещё | header frozen | live sum другой | записанный вход |
| `S_min` из воздуха | запрет | pending T2 | не выдуман |

Выжившее: цена LLM — owner; шесть `S_min` — T2 (RPC 403); спрайты / `build_tile_refusal` — T10. Solidity нет (`PLAN_CODE` §8).

## 6. Незакрытое

C11: призы сезонов пересчётом. Спрайты T10. `build_tile_refusal` — T10. `companion_llm_price_snapshot` — owner.

Next: C11 — `seasons_prizes_v1_1`.
