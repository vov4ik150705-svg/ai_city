# P6 — журнал кода

`ops_watch`: каждая из десяти метрик снимается с `observe_src`, не с порога; алерт возраста сэмпла раньше среза курса; семь инцидентов с runbook и кодом. `launchToken` не подписывался. `rules_version` 0.20.0. Водяной знак призов 19.

Пак после `python content/build.py`: **592 068** канонических байт, хеш **`e823c7296b8bd7fcfbe3e86ae99ab38c2f180627dc9d1bca04e1136dbd2057ad`**, `pack_version` **69**, `layout_version` **1**. Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `launch.deployed` пуст.

Причина `pack_version` 68→69 (`CONTENT.md` §5): сущности `arch.ops`, `arch.incidents`, поля `observe_src` / `alert_channel` у метрик, правила L326/L327, три пробы `ops_watch`.

---

## 1. Создано

| путь | роль |
|---|---|
| `services/api/test/p6.test.ts` | три имени `ops_watch.construction_tests` |
| `docs/reports/P6_recon.md` | разведка |
| `docs/reports/P6_code.md` | этот журнал |
| `docs/reports/P6_rules.md` | пробы и поимки |
| `docs/reports/P6_final.md` | гейт и атаки |

## 2. Изменено

`content/params/arch.json` — `observe_src` и `alert_channel` у десяти метрик; `arch.ops.channel=ops_log`; семь `arch.incidents`; `ops_watch.tests` и `construction_tests`. Схема `arch_ops` / `arch_incident`. `content/{lint,attack}.py` — L326, L327 и три конструкции. `services/api/src/{metrics,pack_ctx,host,http,index}.ts` — `observeFromState` на `GET /ready`; `observedFromThresholds` не в прод-барреле. `packages/contentpack/test/p0.test.ts` — канон трёх имён P6. `docs/OPS.md` — семь заголовков runbook. `docs/ARCHITECTURE.md` §8, `docs/API.md` §3, `docs/CONTENT.md` §5/§6. Кодоген 23 артефакта, banner `e823c729`.

Экономика не ехала. `sim.py` / `builds.py` / `vectors.py` не в гейте шага (`A-P-5`). Полный `--jobs 8` — правка `lint.py` / `attack.py`.

## 3. Решения

- Наблюдение живёт в хосте `GET /ready`, не в тике (`A-20`). Новый путь `/metrics` не заводился (`L235`).
- `observedFromThresholds` остаётся помощником тестов (`c9.test.ts`). Импорт вне `test/` красный (`L326`, `A-P-6`, `R-P-5` закрыт).
- Алерт возраста = `price_staleness_max_city_hours // 2` (3 раньше 6). Второе хранимое 3 не заводилось (`L09`).
- Семь инцидентов, коды только из `codes.json`. `AUTH_*` не добавлялся (`A-P-22`). Подписант: пауза стража, `refundPlayer` ≤ `backingOf` (`R-M-17`).
- Пороги из чисел P5, не из головы: круг 1445 vs 1400; payroll 10000 vs 24; vault 0 vs 2000; fund 100 vs 4802.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `creator_tax_bps` 200. `window_a_ratified` 1. `prize_live_min_rules_minor` 19. `rules_version` 0.20.0. `companion_revenue_live` 0. Краны NFT 0.
