# P0 — разведка

Форма фазы выхода: девять ключей в паке, охрана секретов, правило `L314`. Механика, окно A, `rules_version` 0.20.0 и водяной знак 19 не двигаются. `launchToken` не подписывается.

## Предусловие §0

Команда по `content/params/launch.json` `deployed`:

```
{"token": "", "curve": "", "pool": "", "hook": "", "tx": ""}
```

Пять полей пустые. `G7_final.md` на диске, гейт зелёный. `M7_final.md` тоже на диске (вход плана). `TokenLaunched` не читался. Фаза стартует с P0 (`A-P-1`).

Вход на диске (не память плана): пак **62**, хеш `4ca9bba362f2b1d5799d79415a4819ff6bc93474e792a019499e6c0f2a41ac4f`, `rules_version` **0.20.0**, lint **313/0**, круг 1445, вход 200 < выход 910, `window_a_ratified=1`. План писал пак 53 / lint 304 / `L306`–`L320` — паспорт M7 до v1.1. `L306`–`L313` заняты v1.1.

Числа владельца из `PLAN_RELEASE` §9 к P0 не нужны; `pause_ready_delay` / адреса — к P3/P7.

## Прочитано

`PLAN_RELEASE` §0, §3 `D-P-1`…`D-P-14`, §4 P0, §5 (черновик id), §6 пробы, §8 `A-P-9`; `G7_final`; `CONTENT.md` §5/§6; `ROADMAP.md` абзац порядка; `arch.roadmap` / `roadmap_order` кончается `rebalance_close`; `L262`, `L268`, `L278` (`PRIVKEY_HEX_RE`), `L306` (хвост после `launch_freeze` равен восьми ключам v1.1); `packages/contentpack/test/{l0,m0,g0}.test.ts`; `M0`/`G0` как шаблон формы; `code-phase.mdc` уже текст P0–P8 (`R-L-16`).

## Дерево до шага

`arch.roadmap_order` кончается `rebalance_close`. Ключей P нет. L314 нет. `packages/contentpack/test/` — g0/m0/l0, проб P0 нет.

`L306` и `_v11_form_errors` требуют `tail after launch_freeze == V11_STAGE_IDS`. Девять ключей P после `rebalance_close` сломают это, пока не сузить сверку до префикса из восьми — тот же приём, что G0 сделал с деньгами после `pons_launch`.

В `contracts/test` и `contracts/script` есть адрес Foundry HEVM `0x7109709ECfa91a80626fF3989D68f67F5b1DD12D`. Это константа инструмента, не ключ. Без белого списка L314 красный на зелёном паке.

Непрефиксные 64 hex в `packages`/`deploy`/`scripts`/`contracts` — хеш пака в шапке `GENERATED`. Правило ловит только `0x`+64 (ключ) и `0x`+40 (адрес), иначе шапка GENERATED — ложное срабатывание.

`L278` уже ловит `0x`+64 в `apps/client/src`. L314 расширяет обход на `packages`, `services`, `apps`, `deploy`, `scripts`, `contracts` и корневые `.env*`. Шов атаки — `_repo_source`, не запись на диск.

`ts_gate_cmd` формы — `pnpm --filter @corporator/contentpack run gate`. Второго `.mdc` нет.

## ТЗ на шаг

Выходы буквально из `PLAN_RELEASE` §4 P0 плюс перебазирование §5:

1. Девять ключей в `arch.roadmap` и `roadmap_order` после `rebalance_close`. Десятого нет. Имена C/L/M/G не брать.
2. `L314` — ключ или hex-адрес вне `launch.deployed` / `chain.deployed`. `L306`–`L313` не переименовываются.
3. Две пробы: `release_stage_keys_exist`, `no_key_material_in_repo`. Пара с паком в одном заходе (`L268`).
4. `PLAN_RELEASE` §5 и `gate_cmd` §4: `L306`–`L320` → `L314`–`L328`.
5. `L306` / конструкции G0: хвост после `launch_freeze` — префикс из восьми.
6. Пак +1. `rules_version` 0.20.0. `layout_version` 1. Второго `.mdc` нет.
7. `docs/ROADMAP.md` одним предложением. Отчёты `P0_*.md`.
