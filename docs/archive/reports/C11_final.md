# C11 — итоговый отчёт шага

Призы сезонов включены пересчётом, не флагом. Zipf floor = payroll. Layout v1 без сдвига байт. Строка ROADMAP `seasons_prizes_v1_1`.

Пак **36**, `rules_version` **0.18.0**, хеш **`08867647fa2983a661fff0718cbb1224b970cb297371592dd792188d0d4a8ddb`**, 492314 байт.

---

## 1. Что закрыто

- Zipf Σ ≤ пул при любом N, включая N=0 (пул цел, нет деления) и N=1 (100% пула).
- live=0 на другом городе: ранг есть, минт `$CORP` нет.
- live=1 без пересчёта `rules_version` роняет L115 и L220.
- Приз `$CORP`, не Capital; hop 0; демо `DEMO_NO_PRIZE`; `mintsCapital=0`.
- Доля = `weight × pool / total`, как фонд зарплат. L268: одно новое имя.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 36; круг 14.47% / Trader 11.67%; T7 live 1 |
| хеш | `08867647fa2983a661fff0718cbb1224b970cb297371592dd792188d0d4a8ddb` |
| байты | 492314 |
| `python content/lint.py` | **272/0**, PENDING 26 |
| `python content/vectors.py` | 21; sha256 `7ab1922ca87011443b88c44103af845500cdc7ab0efdd6da08f21cce3445a4bc` |
| `python content/codegen.py --check` | 15 match `08867647fa2983a6` |
| `python content/attack.py --only L115,L220` | 3/3 пойманы |
| `python content/attack.py --construction-only --jobs 8` | **152/0** |
| `python content/attack.py --jobs 8` | **515/0**, construction **152/0**, 629.1s |
| `pnpm --filter @corporator/api run test -- -t season_prize_distribution` | красный 0n≠1n, затем зелёный |
| `pnpm -w run gate` | depcruise **361/0**; vitest **56/0** |

## 3. Конструкционные пробы C11

`season_prize_distribution_proportional`. Красный прогон — `C11_rules.md`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-21 | три C3-имени не дублировать | держится; C11 одно имя |
| R-C-22 | watermark `prize_live_min_rules_minor` внутри пака: live=1 + minor=17 + floor=17 проходит L115 | названо; атака без согласованного отката floor ловится |

Новых формул нет. Major не поднимали (L266).

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| live=1 на `0.17.0` | L115 L220 | without recount | пересчёт живой |
| live=0 + probe 40 | L220 | sum_payout=40 | live=0 не платит |
| N=0 | пул цел | dust=pool | нет 0/0 |
| N=1 | 100% пула | [pool] | не H_10 |
| ceil Zipf | L107 | превышает | floor обязателен |
| Capital как asset | L109 | не CORP | не фишки |
| demo | DEMO_NO_PRIZE | sum 0 | RK-12 |
| hop ≠ 0 | L109 | hop 0 | нет второй надбавки |
| vitest live ждут 0n | красный | got 1n | проба живая |
| T3 без influence | layout v1 | 56 тестов, включая `layout_v1_bytes` | байты записи |
| settle → Capital | запрет | mintsCapital 0 | не минт |
| engine protocol import | запрет | нет | пустой dependencies |
| floor=0 при live=1 и 0.18.0 | L115 молчит | minor≥0 | **R-C-22** intra-pack |
| live=1 + 0.17.0 + floor=17 | L115 молчит | recounted | **R-C-22** согласованная ложь |

Выжившее: R-C-22 (watermark в том же паке). Цена LLM — owner. Шесть `S_min` — T2. Спрайты / `build_tile_refusal` — T10.

## 6. Незакрытое

Кодовая фаза C0–C11 закрыта. Спрайты T10. `build_tile_refusal` — T10. `companion_llm_price_snapshot` — owner. `S_min` — T2.

Next: вне кодовой фазы v1 (Solidity не в скоупе). Лежащее — pending.
