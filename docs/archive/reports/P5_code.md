# P5 — журнал кода

`time_rehearsal`: 90 суток города на прод-паке, ускорение только каденции вызова тика; транспорт — инъекции отказов fail-open. `launchToken` не подписывался. `rules_version` 0.20.0. Водяной знак призов 19.

Пак после `python content/build.py`: **587 690** канонических байт, хеш **`1e50885daa47c397d5a3f405a6e1a7ef883b3f4f5057ddd6fa2670f51ce69147`**, `pack_version` **68**, `layout_version` **1**. Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `launch.deployed` пуст.

Причина `pack_version` 67→68 (`CONTENT.md` §5): сущность `arch.rehearsal`, правило L325, четыре пробы `time_rehearsal`, драйвер `content/rehearsal.py`.

---

## 1. Создано

| путь | роль |
|---|---|
| `content/rehearsal.py` | прогон A: 2160 последовательных тиков, границы 14/30/90, хвост снапшота |
| `packages/engine/test/p5.test.ts` | три имени: pin пака, фарм на 14, период на 30 |
| `packages/chainport/test/p5.test.ts` | `chain_silence_does_not_block_tick` |
| `docs/reports/P5_recon.md` | разведка |
| `docs/reports/P5_code.md` | этот журнал |
| `docs/reports/P5_rules.md` | пробы и поимки |
| `docs/reports/P5_rehearsal.md` | числа прогонов A и Б |
| `docs/reports/P5_final.md` | гейт и атаки |

## 2. Изменено

`content/params/arch.json` — `rehearsal.pack_pin=prod`, `time_rehearsal.tests` включает L325, `construction_tests` четыре имени. Схема `arch_rehearsal`. `content/{lint,attack}.py` — L325 и четыре конструкции. `packages/contentpack/test/p0.test.ts` — канон четырёх имён P5. `packages/engine/src/seasons.ts` — `seasonSettleDue` экспортирован для пробы периода. `DESIGN.md` §3.1, `docs/ARCHITECTURE.md` §9, `docs/CONTENT.md` §6. Кодоген 23 артефакта, banner `1e50885d`.

Экономика не ехала. `city_day_real_hours` остался 25, `tick_length_city_hours` остался 1. `sim.py` / `builds.py` не в гейте шага (`A-P-5`). `rehearsal.py` не в `gate_cmd`.

## 3. Решения

- Ускорение — цикл `tick.tick`, не правка `time.params` (`A-P-4`, `D-P-9`).
- Прогон A на этой машине — in-process оракул, не `compose up` образа (`R-P-6`). Хеш пака = пин образа.
- Прогон Б — in-process инъекции, не трое календарных суток тестнета (`R-P-7`).
- Hop после реорга ключуется `voucher.nonce` (id транзакции), не порядком попытки (`A-P-15`).
- `presentVoucher` без депозита в vault возвращает `NOT_ENOUGH_CORP`: харнесс сначала `deposit`, это не дефект пака.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `creator_tax_bps` 200. `window_a_ratified` 1. `prize_live_min_rules_minor` 19. `rules_version` 0.20.0. `companion_revenue_live` 0. Краны NFT 0.
