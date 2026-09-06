# M0 — журнал кода

Форма денежной фазы. Ставки не двигались. `launchToken` не подписывался.

Пак после `python content/build.py`: **527 288** канонических байт, хеш **`80abab53042634c4d8ea8f4a82cee004a6b8d9c83e4b01c6608f8ff6e07509e0`**, `pack_version` **46**, `rules_version` **0.18.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/m0.test.ts` | два имени `money_form.construction_tests` |
| `docs/reports/M0_recon.md` | разведка |
| `docs/reports/M0_code.md` | этот журнал |
| `docs/reports/M0_rules.md` | пробы и поимки |
| `docs/reports/M0_final.md` | гейт и атаки |

## 2. Изменено

`content/params/arch.json` — девять ключей в `roadmap` и `roadmap_order` после `pons_launch`, поля `$defs.arch_stage` на каждый, `construction_tests` пустые кроме `money_form`. `content/params/meta.json` 45→46. `content/attack.py` — две конструкции, `MONEY_STAGE_IDS`, запрет `owner_drain`, `_is_phase_rule_file` знает M0 / `money-phase.mdc`. `packages/contentpack/test/l0.test.ts` — тот же классификатор. `docs/ROADMAP.md` — денежные id в порядке. `docs/CONTENT.md` §5 байты / §6 текущий пак. `docs/reports/PLAN_MONEY.md` — `R-M-1` закрыто. Кодоген 19 артефактов пересобран (хеш в шапке).

Новых `L*` нет. Второго `.mdc` нет. Экономических литералов нет.

## 3. Решения, которые не открывают развилку

- Девять ключей §15.8, не восемь §4: `owner_drain` не заведён; хвост `roadmap_order` после `pons_launch` — ровно эти девять.
- Список девяти id в пробе — атака на удаление и на лишний ключ, не второй roadmap. Канон — `roadmap_order`.
- `launch_precondition_not_launched` требует пустой `deployed` целиком: полное заполнение (зелёный L279) здесь красное. Живой `TokenLaunched` CI не читает (`R-L-22`).
- `rules_version` 0.18.0: новые сущности roadmap, формула записи не менялась (CONTENT.md §5 minor, L266).
- `code-phase.mdc` уже было правилом M0–M7 до шага (как L0 застал замену правила).

## 4. Инертность

`python content/build.py`: круг 14.47% / с Trader 11.67%; buy 0 / share 0; курс минта 51. `python content/sim.py`: `A_t2=14011`, возвраты 2837/8213. `creator_tax_bps` = 100, `vault_fee_bps` = 400.
