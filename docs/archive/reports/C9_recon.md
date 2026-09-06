# C9 — разведка

Инварианты измеримы, один гейт CI, образ пинит `pack_hash`, LLM снаружи тика с шаблоном. Строки ROADMAP нет: `R-C-1` / `observability_ci`. Зависит от C3, C6, C7, C8.

## Прочитано

PLAN_CODE §4 C9, D-C-1, R-C-1, R-C-4, A-5; ARCHITECTURE §8 §9; DESIGN.md §5.4 §6.4; L246 L259 L260 L268 L270 L272; GATE_PERF (полный attack не в CI коммита); C3 `readiness_requires_pack` / `invariants_all_metered` / `services_do_not_block_tick`; C8_final.

## Дерево до шага

`services/llm/src/index.ts` = `export {}`. `package.json` `ci` = `pnpm -w run gate`. Dockerfile нет. `observability_ci.construction_tests` пустые. Метрики C3 читают `threshold_src`, литерал в src не сканируется. PENDING `companion_llm_price_snapshot` остаётся owner (цена не выдумывается).

## Решения

- Vitest C9 только четыре новых имени: `image_pins_pack_hash`, `image_has_no_python`, `llm_refusal_falls_back_to_template`, `ci_step_has_red_run`. Три C3-имени не дублировать. **R-C-21.**
- CI-таблица и образ — кодоген из пака. `pnpm -w run ci` гоняет шаги независимо. Полный `attack.py --jobs 8` в таблицу не входит (`R-C-4`).
- L259: плюс скан `services/api/src/metrics.ts` на литеральный порог. L260: плюс `arch.image` pin / no python / no content.
- LLM: `on_provider_fail=template`, код `COMPANION_LLM_TEMPLATE`, очередь `companion_queue_capacity`. Engine в src запрещён.

## Риски

RK-14 (пин образа), RK-13 (кодоген), RK-11 (LLM не блокирует тик), RK-6 (DDL не трогаем).
