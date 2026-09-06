# C9 — журнал кода

Метрики, образ, CI-таблица, LLM-хост снаружи тика. Строка ROADMAP `observability_ci`. Круг 14.47% / Trader 11.67%.

Пак: **491810** байт, хеш **`50581c12ac6dc64ab933d2f7fc9544ead00c85afc0583cdea2ca6816841d444c`**, `pack_version` **34**, `rules_version` **0.17.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `deploy/Dockerfile` | кодоген: ARG/ENV `PACK_HASH`, runtime без python и `content/` |
| `scripts/ci.mjs` | кодоген: шаги пака, все гоняются, exit после цикла |
| `deploy/environments.json` | кодоген: `dev` / `staging` / `prod` |
| `services/llm/src/{values,pack,step,index}.ts` | шаблон `COMPANION_LLM_TEMPLATE`, очередь `companion_queue_capacity` |
| `services/llm/test/c9.test.ts` | `llm_refusal_falls_back_to_template` |
| `services/api/test/c9.test.ts` | `image_pins_pack_hash`, `image_has_no_python`, `ci_step_has_red_run` |

## 2. Изменено

`meta.json` 33→34; `arch.json` `ci_steps`, `image`, codegen×3, `observability_ci.construction_tests`; схема `arch_ci_step` / `arch_image`; `codegen.py` эмиттеры; `lint.py` L259 скан `metrics.ts`, L260 pin/python/content; `attack.py` две атаки + три construction; `metrics.ts` `exportLive`; `package.json` `ci`; eslint llm + ignore deploy/scripts; `vitest.workspace.ts`; `docs/ARCHITECTURE.md` §9; `docs/CONTENT.md` L259/L260/байты.

## 3. Решения

- Четыре новых `it()` имени. C3 держит `invariants_all_metered` / `readiness_requires_pack` / `services_do_not_block_tick`. **R-C-21.**
- Полный `attack.py --jobs 8` не в `ci_steps` (`R-C-4`).
- L260: `0 or 1` считал ноль отсутствием — закрыто проверкой `not in`.
- Строки шаблона: `pack.strings.ru`, не `sections.strings`.

## 4. Инертность

Круг 14.47% / 11.67%. Engine не в `llm` src. Касса и фонд не тронуты. Цена LLM не выдумана.
