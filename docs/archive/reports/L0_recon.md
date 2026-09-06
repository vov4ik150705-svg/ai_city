# L0 — разведка

Форма живой фазы: ключи в паке, ничего не слушает. C11 закрыт. L5a закрыт досрочно (`R-L-15`). Правило агента уже заменено (`R-L-16`).

Вход: пак **36**, `rules_version` **0.18.0**, хеш **`08867647fa2983a661fff0718cbb1224b970cb297371592dd792188d0d4a8ddb`**, lint **272/0**, vectors **21** / `7ab1922c…`, vitest **56/0**, attack **515/0**, PENDING **26**.

## Прочитано

PLAN_LIVE §4 L0, D-L-1, D-L-11, D-L-12, R-L-1, R-L-11, R-L-15, R-L-16, RK-L-1, RK-L-13; C11_final; ARCHITECTURE §3 §9; ROADMAP.md `<!-- GEN:arch.roadmap -->`; `$defs.arch_stage` (семь обязательных полей, `additionalProperties: false`); L262, L268; CONTENT.md §5 (новая сущность → minor, `pack_version` +1, `rules_version` не двигается); `.cursor/rules/` — шесть `.mdc`, фазовое одно (`code-phase.mdc`, `alwaysApply: true`), `live-phase.mdc` нет.

## Дерево до шага

`arch.roadmap_order` — 13 C-ключей, живых нет (`R-L-1`). `construction_tests` у будущих L-строк нет. `packages/contentpack/test/` — только `c2.test.ts`. `listen` / `createServer` нет. `docs/reports/L0_*.md` нет.

Ключа `stage_order` нет (`R-L-11`): порядок — `roadmap_order`.

`art_ground` закрыт в `art/`, `it()` не добавлял, `L268` не касается. Строка всё равно вносится, `construction_tests` пустой.

## ТЗ на шаг (не сокращать)

Выходы буквально из PLAN_LIVE §4 L0:

1. Одиннадцать ключей в `arch.json.roadmap` и в `roadmap_order`: `live_form`, `prize_claim_live`, `process_hosts`, `client_on_host`, `pg_compose`, `art_ground`, `art_sprites`, `owner_freeze`, `contracts`, `rpc_live`, `pons_launch`.
2. У каждой — семь полей `$defs.arch_stage`. Восьмого поля нет. `construction_tests` пустые, кроме `live_form` (имена этого шага) и кроме `art_ground` (пробы в `tiles_probe.py`).
3. Два `it()` = два имени: `live_stage_keys_exist`, `code_phase_rule_not_always`. Пара с паком в одном заходе (`D-L-11`).
4. Пак +1. `rules_version` 0.18.0, `layout_version` 1. Второго `.mdc` фазы не создавать.
5. `docs/ROADMAP.md` после `build.py` показывает ключи. Отчёты `L0_*.md`.
6. Ни одного `listen`.

Критерий готовности — командами: `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268` плюс полный гейт протокола §9.

## Риски

`RK-L-1` план как второй roadmap. `RK-L-13` второе alwaysApply фазовое правило. `RK-L-15` `it()` без строки.
