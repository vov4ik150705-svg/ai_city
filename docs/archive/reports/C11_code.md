# C11 — журнал кода

Призы сезонов включены пересчётом `rules_version`, не голым флагом. Строка ROADMAP `seasons_prizes_v1_1`. Круг 14.47% / Trader 11.67%.

Пак: **492314** байт, хеш **`08867647fa2983a661fff0718cbb1224b970cb297371592dd792188d0d4a8ddb`**, `pack_version` **36**, `rules_version` **0.18.0**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/engine/src/seasons.ts` | Zipf floor = payroll `weight × pool / total`; `seasonSettle` (слот max, qualify, demo, hop, N=0/1/top-N, live) |
| `services/api/test/c11.test.ts` | один `it("season_prize_distribution_proportional")` |

## 2. Изменено

`meta.json` 35→36, `rules_version` 0.17.0→0.18.0; `seasons.json` live=1 + `prize_live_min_rules_minor`; `arch.json` `construction_tests`; `fragments.json` why; `lint.py` L115/L220 + watermark; `attack.py` overlay live=0 на probe, `a_l220_flag_no_recount`, construction Zipf; `build.py` заголовок L220; `tick.ts` `hourSix` пишет `season_settlement` (как `tick.py`, города без `influence`/`season_row` пропускаются); `fragments.ts` заглушка снята; `DESIGN.md` §12, `docs/TICK.md` §12, `docs/PRIZES.md` §6.5, `docs/CONTENT.md` L115/L220, `docs/ROADMAP.md`, `docs/BALANCE.md` T7.

## 3. Решения

- Один новый `it()`. C3-имена и `layout_v1_bytes` не дублировать.
- live=1 только при minor ≥ `prize_live_min_rules_minor` (18). Флаг на `0.17.0` роняет L115 и L220.
- live=0 на другом городе: ранг есть, выплата 0. Zipf = тот же floor, что фонд зарплат. N=0 пул цел. Приз `$CORP`, hop 0, демо `DEMO_NO_PRIZE`. `mintsCapital` всегда 0.
- Формула Zipf не менялась → minor, не major (L266 layout=1, major=0).

## 4. Инертность

Круг 14.47% / 11.67%. Engine не импортирует protocol. Касса и фонд не тронуты: settle не минтит Capital. `S_min` не выдуман.
