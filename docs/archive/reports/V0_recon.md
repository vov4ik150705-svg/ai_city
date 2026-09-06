# V0 — разведка

Форма фазы картинки: ключи roadmap, секция `render`, минор 0.21.0, сцена из пака. Механика и живые флаги не снимаются.

## Предусловие §0

Команда по `content/params/launch.json` `deployed`:

```
{'token': '', 'curve': '', 'pool': '', 'hook': '', 'tx': ''}
```

Пять полей пустые. `P6_final.md` на диске. `TokenLaunched` в мейннете нет. Фаза стартует с V0.

Вход на диске: пак **69**, `rules_version` **0.20.0**, хеш `e823c7296b8bd7fcfbe3e86ae99ab38c2f180627dc9d1bca04e1136dbd2057ad`, lint **327/0**.

`season_prizes_live=1`, `window_a_ratified=1`, `prize_live_min_rules_minor=19`, краны NFT 0, `companion_revenue_live=0`, `missions_live=0`, `launch.deployed` пуст.

## Прочитано

PLAN_VISUAL §0/§4 V0 / D-V-1…24 / L329,L347,L348,L353 / §6 пробы / §7 потолки / §8 A-V-1,A-V-22,A-V-23,A-V-26 / R-V-2,R-V-3,R-V-8; P6_final; pack.py PARAM_FILES; schema `$defs.param` / `attest_file` / `arch_stage`; L262 L268 L266 L290 L306 L183 L184 L272 L353-план; p0.test.ts `releaseOrderAfterV11`; g0.test.ts `rules_minor_is_twenty`; attack.py `_release_form_errors`; `apps/client/src/main.tsx` (импорта `scene.json?url` уже нет); `packview.ts` читает `placement["scene"]`; `dist/main.js` ещё со старым импортом (артефакт, не src).

## Дерево до шага

`arch.roadmap_order` после `ops_watch` сразу `mainnet_launch`. Ключей V нет. `render.json` нет. `rules_version` 0.20.0. L306 требует минор **== 20**. `rules_minor_is_twenty` и `_v11_form_errors` тоже. `releaseOrderAfterV11` режет хвост после `rebalance_close` — вставка 13 ключей уведёт пробу в красное, пока не фильтр. `mainnet_launch.gate_cmd` цитирует `L328`, которого в линтере нет. Клиент src сцену уже берёт из пака; критерий V0 — закрепить правилом и гейтом.

`art/out` не источник (D-V-12). `code-phase.mdc` уже под D-V-21…24.

## ТЗ на шаг

Выходы буквально из PLAN_VISUAL §4 V0:

1. Тринадцать ключей между `ops_watch` и `mainnet_launch`, имена как в плане, четырнадцатого нет.
2. `content/params/render.json` + схема; потолки §7 (R-V-3, первая редакция).
3. `rules_version` 0.21.0; L306 `>= 20`; водяной знак призов 19.
4. `pack_version` +1.
5. L329, L347, L348, L353; пять `it()` = пять имён `visual_form`.
6. Клиент src без `scene.json?url`; `layout_hash` сходится; `art/out` не воссоздаётся.
7. `releaseOrderAfterV11` — фильтр девяти ключей выхода; негативные ветки снова красные.
8. Отчёты `V0_*.md`.

## Риски, названные до кода

- R-V-8: L353 на живом `L328` в `mainnet_launch` роняет lint. Решение шага: строка `gate_cmd` правится (L328 снимается до P7); атака возвращает L328 и ловит. Регистрировать L328 — работа P7, запрещена до V12.
- Будущие V1–V12 `gate_cmd` из плана цитируют L330+ которых нет. L353 это тот же класс дыры. На V0 в их `gate_cmd` только уже зарегистрированные id.
- `rules_minor_is_twenty` имя не меняется (L268); проверка становится `>= 20`.
