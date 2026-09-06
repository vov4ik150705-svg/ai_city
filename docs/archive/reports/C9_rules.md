# C9 — пробы и поимки

L259 дополнительно сканирует `services/api/src/metrics.ts` (оверлей `_metrics_source`). L260 плюс `arch.image` pin / `runtime_python` / `copy_content`. Новых `L*` нет.

Пак: **491810** байт, хеш **`50581c12ac6dc64ab933d2f7fc9544ead00c85afc0583cdea2ca6816841d444c`**, `pack_version` **34**.

Конструкции vitest (`observability_ci.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `image_pins_pack_hash` | `ARG PACK_HASH` ждут false | expected false, got true |
| `image_has_no_python` | runtime содержит python ждут true | expected true, got false |
| `ci_step_has_red_run` | `ran` после двух шагов ждут 1 | expected 1, got 2 |
| `llm_refusal_falls_back_to_template` | `template` при отказе ждут false | expected false, got true |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| overlay `2000n` в metrics.ts | L259 | hardcodes a metric threshold |
| metric.service пустой | L259 | no owner service |
| readiness без pack_hash | L260 | ready without pinning |
| `runtime_python=1` | L260 | runtime image allows python |
| `int(0 or 1)` в L260 | L260 | ложный python при нуле; **закрыто** `not in` |
| `sections.strings.ru` | loadLlmPack | API_MALFORMED; **закрыто** `strings.ru` |
| `COPY content/` в runtime | `image_has_no_python` | тест красный по `content/` |
| `process.exit` внутри `for` | `ci_step_has_red_run` | `exitIdx > forIdx` и нет `break` |
| `Date` в llm src | eslint | banned |
| `import` engine в llm src | eslint / depcruise | banned |
| полный `attack.py --jobs` в cmd | construction | red_input / запрет в таблице |

Цена вызова LLM не заводилась: `companion_llm_price_snapshot` остаётся owner.
