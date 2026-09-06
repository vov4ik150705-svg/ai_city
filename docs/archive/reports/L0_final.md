# L0 — итоговый отчёт шага

Форма живой фазы в паке. Ничего не слушает. Канон механик не тронут.

Пак **37**, `rules_version` **0.18.0**, хеш **`226adb8a4ba399c1894c72a9c1c9cced84a3bcc8bf1a3b6d5db2c94bb497a684`**, 503502 байт.

---

## 1. Что закрыто

- 11 ключей в `arch.roadmap` и `roadmap_order`. Семь полей `$defs.arch_stage` на каждый. `art_ground.construction_tests` пустой.
- Два `it()` = два имени: `live_stage_keys_exist`, `code_phase_rule_not_always`.
- `docs/ROADMAP.md` / GENERATED таблица «T12: roadmap» показывают ключи.
- Ровно одно alwaysApply фазовое правило (`code-phase.mdc`). `live-phase.mdc` нет (`R-L-16`).
- `R-L-1` закрыто. `R-L-15` принято: `art_ground` закрыт раньше строки.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; pack 37; круг 14.47% / Trader 11.67% |
| хеш пака | `226adb8a4ba399c1894c72a9c1c9cced84a3bcc8bf1a3b6d5db2c94bb497a684` |
| канонические байты | 503502 |
| `python content/lint.py` | **272/0**, PENDING 26 |
| `python content/vectors.py` | 21; sha256 `a8a71246f70a1929a72f695172530272b5ac1d72974688a827a90a074b0932dc` |
| `python content/codegen.py --check` | 15 match `226adb8a4ba399c1` |
| `tsc -b` / eslint / depcruise | ok; **362/0** |
| vitest run | **58/0** (было 56; +2) |
| `python content/attack.py --only L262,L268` | оба пойманы; construction **154/0** |
| `python content/attack.py --jobs 8` | **517/0**, construction **154/0**, 272 covered, 763.4s |
| `python content/sim.py` | `A_t2=14011`, возвраты 2837/8213 |

`pnpm` не в PATH; гейт TS — `node_modules/.bin`. Новых зависимостей нет, lockfile не тронут.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| снят `pons_launch` | construction | `live stage keys missing` | ключи не декорация |
| снят `live_form` | vitest / construction | `['live_form']` | D-L-1 |
| `ghost_l0` в construction_tests | L268 | occurs 0, want 1 | D-L-11 |
| `gate_cmd=""` | L262 | no gate command | таблица |
| `ts_gate_cmd=""` | L268 | no ts_gate_cmd | таблица |
| дубль `live_form` в порядке | gaps | `duplicate_order_id` | закрыт обход |
| `ghost_stage` только в dict | gaps | `extra:ghost_stage` | закрыт обход |
| синтетический `live-phase.mdc` alwaysApply | vitest | не ровно одно фазовое | RK-L-13 |
| `art_ground.construction_tests` непустой | construction | must stay empty | R-L-15 |

Найденный обход «ключ в dict вне порядка» закрыт той же пробой. Выжившего нет.

## 4. Расхождения R-L-*

| id | суть | статус |
|---|---|---|
| R-L-1 | не было строк живой фазы | **закрыто** |
| R-L-15 | L5a раньше L0 | принято; строка внесена, `construction_tests` пустой |
| R-L-16 | имя пробы vs alwaysApply | принято: проверяется одно фазовое alwaysApply, не выключение `code-phase.mdc` |

Нового R-L-* нет.

## 5. Незакрытое

PENDING 26. Клейм stub (`R-L-2`). Процесса нет (`R-L-4`). Спрайты / `build_tile_refusal`. `S_min` / цена LLM — owner.

Next Step: **L1** — `prize_claim_live`.
