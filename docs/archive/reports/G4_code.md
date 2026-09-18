# G4 — журнал кода

`synergy_buildings`: шесть синергий открыты правилом `requires`; матрица = `design_5_8.json`; автономный слот Robotics Lab. `launchToken` не подписывался. Водяной знак призов 19. `rules_version` 0.20.0. `robotics_lab` в `buildings.json` не тронут.

Пак после `python content/build.py`: **561 638** канонических байт, хеш **`096b9c116c80862ea4b159432e4e1feec655fc2fd29d41cd1435386ffb14f67a`**, `pack_version` **59**, `rules_version` **0.20.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/engine/test/g4.test.ts` | три имени `synergy_buildings.construction_tests` |
| `docs/reports/G4_recon.md` | разведка |
| `docs/reports/G4_code.md` | этот журнал |
| `docs/reports/G4_rules.md` | пробы и поимки |
| `docs/reports/G4_final.md` | гейт и атаки |

## 2. Изменено

`content/params/meta.json` 58→59. `content/params/arch.json` — три `construction_tests`. `content/build.py` — свидетель GENERATED: шесть синергий правилом `requires`, автономный слот. `content/lint.py` — L310. `content/attack.py` — пять атак L310; три конструкции; `expected_ct`. `packages/contentpack/test/g0.test.ts` — ветка `synergy_buildings`.

`DESIGN.md` §11: шесть имён синергий во «входит». HUD/SCREENS не ехали.

Кодоген 19 артефактов под хеш `096b9c11…b14f67a`. Векторы 21 файл, sha256 `93a262d14099fd62ee6864c640b05a123a1c9dd41d706752903b8860f6e8f99c`.

## 3. Решения

- Свидетель, не второй замок (`R-G-1`): G1 уже открыл пять синергий правилом.
- Скоуп из `requires` + `playable_v1` районов; флаг на здании и имя в `build_v1_scope` — красные.
- `robotics_lab`: autonomous, `contour is None`. Файл здания не правился.
- Окно A не подогнано; этап не band.

Экономических литералов нет. Форма денег Rev-A не тронута. `creator_tax_bps` 200.

## 4. Инертность
