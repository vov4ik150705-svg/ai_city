# P0 — журнал кода

Форма фазы выхода. Девять ключей в паке. `launchToken` не подписывался. `rules_version` 0.20.0. Водяной знак призов 19.

Пак после `python content/build.py`: **572 712** канонических байт, хеш **`4f26daf18e7ac2c61d8275babd9cf53e3f931b85efd1000f96a1cd8712d93071`**, `pack_version` **63**, `rules_version` **0.20.0**, `layout_version` **1**. Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`.

Причина `pack_version` 62→63 (`CONTENT.md` §5): новая сущность — девять ключей roadmap фазы P и правило L314.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/p0.test.ts` | два имени `release_form.construction_tests` |
| `docs/reports/P0_recon.md` | разведка |
| `docs/reports/P0_code.md` | этот журнал |
| `docs/reports/P0_rules.md` | пробы и поимки |
| `docs/reports/P0_final.md` | гейт и атаки |

## 2. Изменено

`content/params/arch.json` — девять ключей в `roadmap` и `roadmap_order` после `rebalance_close`; `construction_tests` пустые кроме `release_form`. `content/params/meta.json` 62→63. `content/lint.py` — L314; `L306` хвост после `launch_freeze` — префикс из восьми. `content/attack.py` — три атаки L314, атака пустых `construction_tests` у `release_form`, две конструкции, классификатор `P0` / запрет `release-phase.mdc`. `packages/contentpack/test/g0.test.ts` / `m0.test.ts` / `l0.test.ts` — классификатор P0; G0 префикс из восьми. `packages/contentpack/test/g7.test.ts` — `pack_version` больше не равен 62, пол ≥62. `docs/ROADMAP.md` — одно предложение. `docs/CONTENT.md` §5/§6. `docs/reports/PLAN_RELEASE.md` §4 `gate_cmd` и §5: `L314`–`L328`. Кодоген 19 артефактов. Векторы 21 файл (pack_hash в заголовке).

Второго `.mdc` нет. Экономических литералов нет. `prize_live_min_rules_minor` не поднят. `launch.deployed` пуст.

## 3. Решения, которые не открывают развилку

- Девять ключей D-P-1 после `rebalance_close`. Десятого нет. Имена C/L/M/G не использованы.
- `L306`/`L306`–`L313` не переименованы. Хвост v1.1 после `launch_freeze` — префикс из восьми, иначе ключи P ломают G0.
- L314 ловит только `0x`+64 и `0x`+40. Непрефиксные 64 hex — шапка GENERATED, не ключ.
- Белый список: Foundry HEVM и нулевой адрес; значения из `launch.deployed` / `chain.deployed`. Шов атаки — `_repo_source`, не запись на диск.
- `code-phase.mdc` уже текст P0–P8; второго файла нет.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `creator_tax_bps` 200. `season_prizes_live` 1. `companion_revenue_live` 0. Краны NFT 0. `window_a_ratified` 1.
