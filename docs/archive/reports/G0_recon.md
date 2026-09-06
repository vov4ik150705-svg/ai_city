# G0 — разведка

Форма фазы v1.1: ключи в паке, минор, инвентарь рычагов. Механика и живые флаги не снимаются.

## Предусловие §0

Команда по `content/params/launch.json` `deployed`:

```
{'token': '', 'curve': '', 'pool': '', 'hook': '', 'tx': ''}
```

Пять полей пустые. `M7_final.md` на диске, гейт зелёный. `TokenLaunched` CI не читает (`R-L-22`). Фаза стартует с G0 — правильное состояние (`A-G-2`).

Вход на диске (не память плана): пак **54**, `rules_version` **0.19.0**, хеш `164b6f45e813fae3…`, lint **305/0**, CONTENT.md §6 уже 305 правил. План писал пак 53 / 304 — это паспорт M7; после M7 пак уже 54.

`season_prizes_live=1`, `leaderboard_claim_live=1`, `prize_live_min_rules_minor=19`. Дерево шести районов сгенерировано. Три района `playable_v1=false`.

## Прочитано

PLAN_V11 §0, §4 G0, D-G-1, D-G-3, L306, §6 пробы, §8 A-G-2/A-G-16; M7_final; `$defs.arch_stage`; L262, L268, L266, L290; CONTENT.md §5/§6; M0 как шаблон формы; `code-phase.mdc` уже текст G0–G7 (`R-L-16`).

## Дерево до шага

`arch.roadmap_order` кончается `launch_freeze`. Ключей G нет. `v11_levers` нет. `rules_version` 0.19.0. L290 требует `prize_live_min_rules_minor == rules minor` — подъём минора до 20 без сдвига водяного знака красный, а сдвиг знака запрещён D-G-3.

`packages/contentpack/test/` — m0/m1/m2/m3/m7, l0, l6, c2. Пробы G0 отсутствуют. `construction_tests` будущих G-строк нет.

`_money_form_errors` считает хвост после `pons_launch` ровно девятью денежными ключами — восемь ключей G после `launch_freeze` сломают эту пробу, пока не сузить сверку до префикса.

## ТЗ на шаг

Выходы буквально из PLAN_V11 §4 G0:

1. Восемь ключей в `arch.roadmap` и `roadmap_order` после `launch_freeze`: `v11_form`, `districts_live`, `archetypes_live`, `research_tree`, `synergy_buildings`, `companion_live`, `companion_revenue`, `rebalance_close`. Девятого нет. Имена M/P не брать.
2. `rules_version` `0.20.0`. `prize_live_min_rules_minor` остаётся 19.
3. Инвентарь рычагов D-G-5 непуст.
4. L306; три `it()` = три имени. Пара с паком в одном заходе (L268).
5. Пак +1. `layout_version` 1. Второго `.mdc` нет.
6. `docs/ROADMAP.md` одним предложением. Отчёты `G0_*.md`.

Критерий: `build.py` печатает новый pack и `rules 0.20.0`; `lint.py` 306/0; красный прогон L306 (убрать ключ; минор 19; пустой инвентарь).

## Риски

Поднять `prize_live_min_rules_minor` заодно. Девятый ключ. Имя M/P. L290 lockstep ломает D-G-3 — править L290 на пин 19, не поднимать знак.
