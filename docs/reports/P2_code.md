# P2 — журнал кода

`ci_tracks`: шаговый трек узкий; полный `attack.py --jobs 8` и `sim.py` только ночью; workflow из пака. `launchToken` не подписывался. `rules_version` 0.20.0. Водяной знак призов 19.

Пак после `python content/build.py`: **579 952** канонических байт, хеш **`c9ca4e391ece88390ff9b4e1e74f3f2c4ea64035106708a3e515a179df0138b6`**, `pack_version` **65**, `layout_version` **1**. Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`.

Причина `pack_version` 64→65 (`CONTENT.md` §5): новая сущность — поле `track`, ночные шаги, эмиттер workflow, L319.

---

## 1. Создано

| путь | роль |
|---|---|
| `.github/workflows/ci.yml` | кодоген, два job |
| `packages/contentpack/test/p2.test.ts` | три имени `ci_tracks.construction_tests` |
| `docs/reports/P2_recon.md` | разведка |
| `docs/reports/P2_code.md` | этот журнал |
| `docs/reports/P2_rules.md` | пробы и поимки |
| `docs/reports/P2_final.md` | гейт и атаки |

## 2. Изменено

`content/params/{meta,arch}.json` — пак 65; `track` у каждого шага; `pack_build`; `attack_full` / `sim` / `forge_test` / `image_smoke`; пин `python` 3.12; `ci_workflow` в `codegen`. Схема `arch_ci_step.track`. `content/{lint,attack,codegen}.py` — L319, четыре атаки, три конструкции, `stepsOnTrack` в runner. `packages/contentpack/test/p0.test.ts` — канон трёх имён P2. `services/api/test/c9.test.ts` — `--jobs` разрешён на `nightly`; `break;` не подстрока `break`. `docs/ARCHITECTURE.md` §9, `docs/CONTENT.md` §5/§6. Кодоген 20 артефактов.

`scripts/ci.mjs` печатает все шаги, `main()` гоняет только `push`. Экономика не ехала. `launch.deployed` пуст.

## 3. Решения

- `track` ∈ {`push`,`nightly`}; ночной job = шаговые шаги плюс четыре ночных (`D-P-6`).
- `pack_build` в шаговом: список D-P-6.
- Секретов в push-job нет. `workflow_dispatch` будит ночной без секрета.
- Recover/идентичность не трогались.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `sim.py` calibration A_t2 **14217**. `creator_tax_bps` 200. `window_a_ratified` 1.
