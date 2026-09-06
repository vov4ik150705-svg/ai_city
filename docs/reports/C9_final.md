# C9 — итоговый отчёт шага

Инварианты измеримы, образ пинит `pack_hash`, один гейт CI, LLM снаружи тика с шаблоном. Строка ROADMAP `observability_ci` (`R-C-1`).

Пак **34**, `rules_version` **0.17.0**, хеш **`50581c12ac6dc64ab933d2f7fc9544ead00c85afc0583cdea2ca6816841d444c`**, 491810 байт.

---

## 1. Что закрыто

- Десять `arch.metrics`: `exportLive` требует observed на каждый id; литерал `2000n` в `metrics.ts` роняет L259.
- `readiness` красный при чужом `pack_hash` и при сдвиге `migration_version`. Dockerfile: `ARG`/`ENV PACK_HASH`.
- Runtime-стадия без python и без `content/` (`D-C-1`). `arch.image.runtime_python=0`, `copy_content=0`.
- Отказ LLM → `COMPANION_LLM_TEMPLATE`, байты `tick`/`tickHeader` те же. Очередь `companion_queue_capacity`. `blocks_tick=0`.
- CI-таблица из пака, шаги независимы. Полный `attack.py --jobs 8` не в гейте коммита (`R-C-4`). У каждого шага `red_input`.
- L268: четыре новых имени. C3-имена не дублированы. **R-C-21.**

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 34; круг 14.47% / Trader 11.67% |
| хеш | `50581c12ac6dc64ab933d2f7fc9544ead00c85afc0583cdea2ca6816841d444c` |
| байты | 491810 |
| `python content/lint.py` | **272/0**, PENDING 26 |
| `python content/vectors.py` | 21; sha256 `8dd53deba3d8a2ff5b704c53c5d9330fb7ae31bdcd26bbfc5dc30a09f878ead9` |
| `python content/codegen.py --check` | 15 match `50581c12ac6dc64a` |
| `python content/attack.py --only L259,L260` | 4/4 пойманы |
| `python content/attack.py --jobs 8` | **508/0**, construction **148/0**, 464.3s |
| `pnpm -w run ci` | lint + codegen --check + vectors + frozen install + gate; depcruise **338/0**; vitest **52/0** |

## 3. Конструкционные пробы C9

`image_pins_pack_hash`, `image_has_no_python`, `llm_refusal_falls_back_to_template`, `ci_step_has_red_run`. Красный прогон каждого — `C9_rules.md`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-6 | CID | закрыто C8 |
| R-C-11 | engine magic-numbers off | C1 |
| R-C-13 | canonical копия в contentpack | C2 |
| R-C-14 | C2-имена не дублировать | C3 |
| R-C-15 | PGlite не Neon | C3 |
| R-C-16 | список RPC-модулей | принято |
| R-C-17 | `demo_barrier_holds` на C5 | принято |
| R-C-18 | `services_do_not_block_tick` имя на C3 | принято |
| R-C-19 | workspace vitest timeout | принято |
| R-C-20 | `pack_hash_mismatch_halts` имя на C2 | принято |
| R-C-21 | три C3-имени не дублировать на C9; vitest C9 — четыре новых | **принято** |

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `2000n` в metrics.ts | L259 | hardcodes threshold | живой скан |
| `runtime_python=1` | L260 | allows python | RK-14 |
| `0 or 1` в L260 | ложный python | **нашлось** | `not in` |
| `sections.strings.ru` | шаблон | API_MALFORMED | **нашлось**; путь `strings.ru` |
| ARG ждут false | красный | got true | пин живой |
| python в runtime ждут true | красный | got false | D-C-1 |
| ran=1 на двух шагах | красный | got 2 | независимость |
| template false | красный | got true | §5.4 |
| `attack.py --jobs` в cmd | construction | отказ | R-C-4 |
| Date / engine в llm src | eslint | banned | край |

Выжившее: цена LLM не заведена (`companion_llm_price_snapshot` owner). Живой RPC — C10. Спрайты — T10.

## 6. Незакрытое

C10: live RPC + live merkle root, layout v1. Спрайты T10. `build_tile_refusal` — T10.

Next: C10 — `chain_v1_1`.
