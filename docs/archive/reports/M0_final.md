# M0 — итоговый отчёт шага

Форма денежной фазы в паке. Ничего не слушает. Канон механик не тронут. Ставка 100 bps. `launch.deployed` пуст.

Пак **46**, `rules_version` **0.18.0**, хеш **`80abab53042634c4d8ea8f4a82cee004a6b8d9c83e4b01c6608f8ff6e07509e0`**, 527288 байт.

---

## 1. Что закрыто

- Девять ключей в `arch.roadmap` и `roadmap_order` после `pons_launch`: `money_form`, `fee_split`, `prize_period`, `prize_basket`, `basket_conveyor`, `prize_treasury`, `vault_safety`, `prize_surface`, `launch_freeze`. Семь required-полей `$defs.arch_stage` на каждый. `owner_drain` нет.
- Два `it()` = два имени: `money_stage_keys_exist`, `launch_precondition_not_launched`.
- `docs/ROADMAP.md` / GENERATED таблица «T12: roadmap» показывают ключи.
- Ровно одно alwaysApply фазовое правило (`code-phase.mdc`), description говорит про M0–M7. `money-phase.mdc` нет (`R-L-16`).
- `R-M-1` закрыто. `launch.deployed` = `{token,curve,pool,hook,tx}` все `''` (команда в recon).

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; pack 46; круг 14.47% / Trader 11.67%; buy 0 / share 0 |
| хеш пака | `80abab53042634c4d8ea8f4a82cee004a6b8d9c83e4b01c6608f8ff6e07509e0` |
| канонические байты | 527288 |
| `python content/lint.py` | **279/0**, PENDING 3 |
| `python content/vectors.py` | 21; sha256 `edec89148dfc04c8407b5b9062760884d280f734d6d903145b0207e4e4f00df9` |
| `python content/codegen.py --check` | 19 match `80abab53042634c4` |
| tsc / eslint | ok |
| depcruise | **449/0** (1339 deps) |
| vitest run | **76/0** (было 74; +2) |
| `python content/attack.py --only L262,L268` | оба пойманы |
| `python content/attack.py --jobs 8` | **567/0**, construction **173/0**, 279 covered, 731.8s |
| `python content/sim.py` | `A_t2=14011`, возвраты 2837/8213 |

`pnpm` не в PATH; гейт TS — `corepack pnpm`. Новых зависимостей нет, lockfile не тронут.

## 3. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| снят `money_form` | construction | `missing: ['money_form']` | ключи не декорация |
| `owner_drain` 10-й ключ | construction | `owner_drain is not a money-phase key` | §15.8 |
| `ghost_stage` только в dict | construction | `extra:ghost_stage` | закрыт обход |
| дубль `money_form` в порядке | construction | `duplicate_order_id` | закрыт обход |
| вставка после `pons_launch` | construction | suffix ≠ 9 | хвост жёсткий |
| `fee_split.construction_tests` непустой | construction | must stay empty | L268 не заранее |
| `deployed.token` заполнен | construction | filled `['token']` | RK-M-2 |
| все пять `deployed` заполнены | construction | filled пять; L279 молчит | A-19 / M0 ≠ L279 |
| `gate_cmd=""` | L262 | no gate command | таблица |
| `ts_gate_cmd=""` | L268 | no ts_gate_cmd | таблица |
| синтетический `money-phase.mdc` alwaysApply | vitest | не ровно одно фазовое | R-L-16 |
| `creator_tax_bps` / `vault_fee_bps` | 100 / 400 | 100 / 400 | M0 не двигает ставки |
| живой Robinhood без ключа | не шлём | пустой deployed | **R-L-22** |

Найденный обход «ключ §4 `owner_drain`» закрыт явной пробой. Выжившего, которое надо чинить кодом, нет.

## 4. Расхождения R-M-* / R-L-*

| id | суть | статус |
|---|---|---|
| R-M-1 | не было строк денежной фазы | **закрыто** (девять ключей §15.8) |
| R-L-22 | CI не шлёт `launchToken`; нет живой сверки `TokenLaunched` | принято; пустой `deployed` — гейт M0 |
| R-M-6, R-M-9, R-M-10 | витрина / три границы / watermark | приняты, не этот этап |

Нового R-M-* нет.

## 5. Незакрытое


Next Step: **M1** — `fee_split` (ставка 200 bps, вход vault 200 bps, вариант A).
