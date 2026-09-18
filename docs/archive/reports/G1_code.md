# G1 — журнал кода

`districts_live`: три флага `playable_v1` сняты. Узлы, merge, дивиденды и скоуп зданий — правилом. `launchToken` не подписывался. Водяной знак призов 19. `rules_version` 0.20.0.

Пак после `python content/build.py`: **559 250** канонических байт, хеш **`730c7fdde2a9423c92be914464fb67f457735fb01b9bc728650ad86063d214be`**, `pack_version` **56**, `rules_version` **0.20.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/g1.test.ts` | пять имён `districts_live.construction_tests` |
| `docs/reports/G1_recon.md` | разведка |
| `docs/reports/G1_code.md` | этот журнал |
| `docs/reports/G1_rules.md` | пробы и поимки |
| `docs/reports/G1_final.md` | гейт и атаки |

## 2. Изменено

`content/params/districts.json` — logistics/automation/finance `playable_v1: true`. `content/params/agents.json` — logistician why без «район закрыт». `content/params/meta.json` 55→56. `content/params/arch.json` — пять `construction_tests` у `districts_live`. `content/fixtures/design_11_scope.json` — шесть районов, 18 зданий.

`content/lint.py` — L66 v1=полное при шести; L307; L21 работаемость по объявленным ролям (R-G-2); L91 маяк logistics при playable; `builds_gate` на шести. `content/attack.py` — четыре+одна атаки L307, L91 hub, пять конструкций, live_flags без требования трёх false. `content/builds.py` — 3-куб + singles + `pair_slice` при шести live (R-G-3).

`DESIGN.md` §11 три района и синергии правилом во «входит»; §4.2 MSFT без откладки. `docs/CONTENT.md` L21/L66/L307, 307 правил, пак 56 / 559250. `docs/PROGRESSION.md` §7 `builds_raw_v1` = полное. `docs/BALANCE.md` — формула окна T2 от базы 12, пересечение не съехало.

Кодоген 19 артефактов. Векторы 21 файл (арифметика тика: `park_capacity_jobs = 20 // 7 = 2`).

## 3. Решения, которые не открывают развилку

- Каскад пяти синергий на G1 — следствие `build_v1_scope`, не второй замок (R-G-1). G4 — свидетель и L310. `robotics_lab` не тронут.
- Cloud Campus открыт с MSFT до Manager: L21 смотрит объявленные контуры, не только `v1` роли (R-G-2).
- Семья доминирования остаётся 3-куб + срезы; полный 15^6 — G7 (R-G-3).
- L160 читает `playable_v1`, не фикстуру §11 (R-G-4). Корзина призов = все тикеры; равенство playable на шести — не дефект.
- Окно A T2 не подогнано: калибровка 14217 ∈ [12275, 15783].

Экономических литералов нет. `prize_live_min_rules_minor` не поднят. Форма денег Rev-A не тронута.

## 4. Инертность
