# L0 — журнал кода

Форма живой фазы. Процесс не поднимался. Экономические числа не двигались.

Пак после `python content/build.py`: **503 502** канонических байт, хеш **`226adb8a4ba399c1894c72a9c1c9cced84a3bcc8bf1a3b6d5db2c94bb497a684`**, `pack_version` **37**, `rules_version` **0.18.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/l0.test.ts` | два имени `live_form.construction_tests` |
| `docs/reports/L0_recon.md` | разведка |
| `docs/reports/L0_code.md` | этот журнал |
| `docs/reports/L0_rules.md` | пробы и поимки |
| `docs/reports/L0_final.md` | гейт и атаки |

## 2. Изменено

`content/params/arch.json` — 11 ключей в `roadmap` и `roadmap_order`, семь полей `$defs.arch_stage` на каждый, `construction_tests` пустые кроме `live_form`. `content/params/meta.json` 36→37. `content/attack.py` — две конструкции. `docs/ROADMAP.md` — живые id в порядке. `docs/CONTENT.md` §5 байты / §6 текущий пак. `docs/reports/PLAN_LIVE.md` — `R-L-1` закрыто. Кодоген и векторы пересобраны (хеш в шапке).

Новых `L*` нет. Второго `.mdc` нет. `listen` нет.

## 3. Решения, которые не открывают развилку

- `construction_tests` у `art_ground` пустой (`R-L-15`): пробы в `tiles_probe.py`, `L268` их не видит.
- Имя `code_phase_rule_not_always` оставлено дословно из плана; после `R-L-16` проверяет «ровно одно alwaysApply фазовое правило», а не `alwaysApply: false` у `code-phase.mdc`.
- Список 11 id в пробе — атака на удаление, не второй roadmap. Канон — `roadmap_order`. Проба ловит ещё дубль в порядке и ключ в dict вне порядка.
- `rules_version` 0.18.0: новые сущности roadmap, формула записи не менялась (CONTENT.md §5 minor, L266).

## 4. Инертность

`python content/build.py`: круг 14.47% / с Trader 11.67%. `python content/sim.py`: `A_t2=14011`, возвраты 2837/8213.
