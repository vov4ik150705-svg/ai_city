# P2 — пробы и поимки

Новое правило **L319**. L259/L260 не ослаблены. Конструкция C9 `ci_step_has_red_run` больше не считает `--jobs` на `nightly` дефектом.

Пак: **579 952** байт, хеш **`c9ca4e391ece88390ff9b4e1e74f3f2c4ea64035106708a3e515a179df0138b6`**, `pack_version` **65**, `rules_version` **0.20.0**.

## L319

| что ловит | вход падения | поимка |
|---|---|---|
| `--jobs 8` на push | `pack_lint.cmd` = `attack.py --jobs 8` | `push step pack_lint runs --jobs 8` |
| `sim.py` на push | `pack_build.cmd` = `content/sim.py` | `push step pack_build runs sim.py` |
| нет `--jobs 8` ночью | `attack_full.cmd` без `--jobs 8` | `nightly track has no --jobs 8` |
| ручная правка workflow | `_ci_workflow` = patched yaml | `workflow does not match pack ci_steps` |
| `codegen.py --check` | `name: ci` → `name: patched` на диске | `drift .github/workflows/ci.yml` (exit 1), восстановлено |

Нет `track` / нет `attack_full` на nightly — тоже L319.

## Конструкции `ci_tracks.construction_tests`

| имя | вход падения | факт |
|---|---|---|
| `nightly_track_has_full_attack` | снят `--jobs 8` с `attack_full` | L319; yaml nightly содержит cmd |
| `push_track_has_no_full_attack` | `--jobs 8` / `sim.py` на push | L319; job `push` без обоих; `ci.mjs` фильтрует `push` |
| `workflow_matches_pack_steps` | yaml не из пака | L319; каждый id пака в своём job |

Vitest: три `it()` = три имени. Python CONSTRUCTION 232 (+3).
