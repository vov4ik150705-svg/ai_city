# M0 — разведка

Форма денежной фазы: ключи в паке, ставка не двигается. L9 закрыт. Фазовое правило уже M0–M7 (`R-L-16`). Rev-A: девять ключей, не восемь.

Вход: пак **45**, `rules_version` **0.18.0**, хеш **`76e99b6f2704bfa4d1781a184c8b310201f146529a656d4135620cd4d32478c3`**, lint **279/0**, PENDING **3**, vectors **21** / `1349acda…`, vitest **74/0**, attack **565/0**.

## Предусловие §0

Команда `python -c` по `content/params/launch.json`:

```
{'token': '', 'curve': '', 'pool': '', 'hook': '', 'tx': ''}
```

Пять полей пустые. `creator_tax_bps` = 100, `vault_fee_bps` = 400. Живой `TokenLaunched` CI не читает (`R-L-22`).

## Прочитано

PLAN_MONEY §0, §4 M0, D-M-1, §15.8/§15.9 (девять ключей), R-M-1, RK-M-1, RK-M-2; L9_final; `$defs.arch_stage` (семь required + `construction_tests`, `additionalProperties: false`); L262, L268, L266, L279; CONTENT.md §5 (новая сущность → minor, пак +1, `rules_version` не двигается); L0 как шаблон формы; `.cursor/rules/` — одно alwaysApply фазовое (`code-phase.mdc`), `live-phase.mdc` нет, `money-phase.mdc` нет.

## Дерево до шага

`arch.roadmap_order` — 13 C + 11 L, денежных нет (`R-M-1`). `packages/contentpack/test/` — `c2`, `l0`, `l6`. `construction_tests` будущих M-строк нет. Экономика не тронута.

Ключа `owner_drain` нет и не заводить. `stage_order` нет (`R-L-11`): порядок — `roadmap_order`.

## ТЗ на шаг

Выходы буквально из PLAN_MONEY §4 M0 через §15.8:

1. Девять ключей в `arch.json.roadmap` и в `roadmap_order`: `money_form`, `fee_split`, `prize_period`, `prize_basket`, `basket_conveyor`, `prize_treasury`, `vault_safety`, `prize_surface`, `launch_freeze`. После `pons_launch`, этим порядком. `owner_drain` не заводить.
2. У каждой — поля `$defs.arch_stage`. `construction_tests` пустые, кроме `money_form`.
3. Два `it()` = два имени: `money_stage_keys_exist`, `launch_precondition_not_launched`. Пара с паком в одном заходе (`D-L-11` / `L268`).
4. Пак +1. `rules_version` 0.18.0, `layout_version` 1. Второго `.mdc` фазы не создавать. Description `code-phase.mdc` говорит про M0–M7 (уже так).
5. `docs/ROADMAP.md` после `build.py` показывает ключи. Отчёты `M0_*.md`.
6. Ни одного нового числа экономики. `launchToken` не подписывать.

Критерий готовности — командами: `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268` плюс полный гейт протокола фазы.

## Риски

`RK-M-1` план как второй roadmap. `RK-M-2` `launch.deployed` непуст. `A-19` `launchToken` до M1.
