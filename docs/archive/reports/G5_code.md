# G5 — журнал кода

`companion_live`: `companion_rows_live=1`; `companion_idle_relief_bps=1000`; `set_manager_focus` в allowed; L143 — единица только со свидетелем рекаунта; L311. `launchToken` не подписывался. Водяной знак призов 19. `rules_version` 0.20.0.

Пак после `python content/build.py`: **562 065** канонических байт, хеш **`3faf064f6214329c6b656617971a0fe23a4f364f49b9c6afbf051c81881de600`**, `pack_version` **60**, `rules_version` **0.20.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/g5.test.ts` | четыре имени `companion_live.construction_tests` |
| `docs/reports/G5_recon.md` | разведка |
| `docs/reports/G5_code.md` | этот журнал |
| `docs/reports/G5_rules.md` | пробы и поимки |
| `docs/reports/G5_final.md` | гейт и атаки |

## 2. Изменено

`content/params/companion.json` — `companion_rows_live` 0→1; `companion_idle_relief_bps` 0→1000 (два кванта Route); `set_manager_focus` из forbidden в allowed. `content/params/meta.json` 59→60. `content/params/arch.json` — четыре `construction_tests` у `companion_live`.

`content/companion.py` — `residual_after_relief()`. `content/lint.py` — `_return_bands_in_envelope`; L140 companion≠minimalist при relief≠0; L143 recount lock; L311; RULES 311. `content/attack.py` — L124 live=0+relief=1000; атаки L143/L311; T8-пробы на ненулевую величину; четыре конструкции G5; `_live_flags_errors` ждёт live=1; L40-пробы переведены на `axes` (G3 оставил KeyError `nodes`). `content/build.py` — T8 GENERATED: live commands, величина, строка рекаунта.

`packages/contentpack/test/g0.test.ts` — `companion_rows_live===1`; ветка `companion_live`.

`docs/COMPANION.md` §1/§2/§8/§10/R-T8-1. `DESIGN.md` §5.14 и §11: величина и Manager focus во «входит»; выплата NFT остаётся в «режем». `docs/BALANCE.md` — формула окна T2 от `residual_idle_bps`; строка T8. `docs/CONTENT.md` L143/L311, 311 правил, пак 60 / 562065. `docs/PROGRESSION.md` строка компаньона. `HUD.md` §9: Manager focus и ненулевая величина убраны из реза.

Кодоген 19 артефактов под хеш `3faf064f…81de600`. Векторы 21 файл, sha256 `65280bb792b9026e44088c6bd24e4c60ea29789839826c5b2f80c21329f7fbc5`.

## 3. Решения, которые не открывают развилку

- Величина = два кванта Route (1000), потолок `10000 − residual_idle` = 9500. Не новый ключ и не новая ветка (`R-T5-5`).
- Политики `set_manager_focus` нет: G5 только разрешает команду. Разбиение allowed/forbidden сохранено.
- Тик режет запрос `residual_idle_bps` из `balance.json`, не строкой компаньона. Рычаг G5 — свидетель аптайма (4750→4775) и content_floor; формула окна T2 не едет.
- Окно A не подогнано: калибровка 14217 ∈ [12275, 15783] (`A-G-11`).
- Строка на `output_bps` / `offline_cap_hours` запрещена (`A-G-5`, `A-G-6`). Краны NFT 0 (`G6`). Демо без компаньона.

Экономических литералов нет. `prize_live_min_rules_minor` не поднят. Форма денег Rev-A не тронута. `creator_tax_bps` 200.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. T2 return 3991 / 7983. T8: live commands 3; uptime 4750 / 4775 / 9500; free stack 12650 / window 13300. `season_prizes_live` 1. `companion_revenue_live` 0. `demo_companion` 0.
