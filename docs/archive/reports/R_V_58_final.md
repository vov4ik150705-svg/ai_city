# R-V-58 final

Не P7. Пак **103**, хеш `c04834970c3395008d026c3cf2dd49d2f93d366aa3dd4421af0d838c9a2628f9`. Круг 1445 / вход 200 / выход 910. `layout_hash` `5121d30afa1f`. Атлас 2454502 B, 269 кадров. Объектов 687. Деревья 14×40 px. `launch.deployed` пуст.

lint 365/0 (L174 warn 1198 в полосе). attack `--only L365,L366,L367,L359,L361,L174,L175`: 12/12. vectors 21, sha `5f6a18a0…00bbfb`, `layout_version` 1, `record_field_homes` 25. tsc render OK; eslint OK; vitest 22/0.

Атаки: hedge 66; дерево на `s` у здания; scene без `clip_rgba`; render без маски; `pixel_kept` всегда false (стена); всегда true (карниз); L359 ширина/растяжка; будка на траве; L174 target 9000 / лес; L175 лоты от сида. Сломанные входы не выстояли.

Найдено здесь же и закрыто: L175 14 vs 16 деревьев на сиде 5 → `tree_cap_share_bps` 54; дерево на `s` из двора, пересекающего тротуар → skip `walks`; L340 `v[2]`/`v[3]`; `kind=unit` сажал лодки в 20 px.

Расхождения: **R-V-58** (этот шаг). Фасады 3/4 на ромбе 2:1 — принятый остаток R-V-49/57. R-V-38 нет аппаратного GPU. L174 не на точке 1200.

Незакрытое: `attest_testnet` / LLM-снимок / `pause_ready_delay` — owner. P7 не начинать.

Next: смотреть `art/preview/scene.png`. P7 после решения владельца, не из этого шага.
