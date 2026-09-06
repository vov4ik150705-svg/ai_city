# G6 — код

`companion_revenue`: sink `inference_bill`; краны NFT 0 с причиной; `companion_revenue_live` остаётся 0. `launchToken` не подписывался. Водяной знак призов 19. `rules_version` 0.20.0.

## Решение

Не поднимать `companion_revenue_live`: L128 ловит кран только при live=0; единица замолкает на `prize_nft_share_bps=400`. Закрытие — зафиксированный ноль (`D-G-9`), не ожидание владельца. Ратификационный флаг не заводился: единица без решения владельца была бы фальшивой ратификацией.

## Пак

`companion.json` — `nft_proceeds_sink=inference_bill`; why `companion_revenue_live` ссылается на G6/D-G-9. `fragments.json` / `seasons.json` — why кранов G6. `arch.json` — три `construction_tests`. `meta.json` — `pack_version` 61. Схема `companion_file` — поле required.

## Код

`content/companion.py` — `nft_proceeds_sink()`, `SINK_INFERENCE_BILL`. Не в `IMPLEMENTED_DERIVED`. `content/lint.py` — `l312_companion_revenue`; RULES 312. `content/attack.py` — девять проб L312, три конструкции, `COMPANION_REVENUE_CONSTRUCTION` в `expected_ct`. `content/build.py` — T8 GENERATED: sink и нулевые краны.

## Тесты

`services/api/test/g6.test.ts` — имена проб дословно (ts_gate api). `packages/contentpack/test/g0.test.ts` — ветка `companion_revenue` и sink в инвентаре.

## Документы

`docs/COMPANION.md` §10 / R-T8-5: сплит 10000/0, sink, live=0. `docs/PRIZES.md` §3 строка NFT. `DESIGN.md` §11: выплата NFT остаётся в «режем»; счёт назван. `docs/CONTENT.md` L312, 312 правил, пак 61 / 562531.

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `season_prizes_live` 1. `companion_revenue_live` 0. `demo_companion` 0. `sim.py` не гейт: краны остались нулём.
