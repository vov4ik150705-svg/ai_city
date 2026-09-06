# G0 — журнал кода

Форма фазы v1.1. Живые флаги не сняты. `launchToken` не подписывался. Водяной знак призов 19.

Пак после `python content/build.py`: **556 183** канонических байт, хеш **`2a39425f88b7d0c23b610e0691b06803c3836c4c7eca900d09299f3432a0162e`**, `pack_version` **55**, `rules_version` **0.20.0**, `layout_version` **1**.

---

## 1. Создано

| путь | роль |
|---|---|
| `packages/contentpack/test/g0.test.ts` | три имени `v11_form.construction_tests` |
| `docs/reports/G0_recon.md` | разведка |
| `docs/reports/G0_code.md` | этот журнал |
| `docs/reports/G0_rules.md` | пробы и поимки |
| `docs/reports/G0_final.md` | гейт и атаки |

## 2. Изменено

`content/params/arch.json` — восемь ключей в `roadmap` и `roadmap_order` после `launch_freeze`, `v11_levers` из четырёх рычагов D-G-5, `construction_tests` пустые кроме `v11_form`. `content/params/meta.json` 54→55, `rules_version` 0.19.0→0.20.0. `content/params/seasons.json` why: знак заморожен (v остаётся 19). `content/schema/corporator.schema.json` — `$defs.arch_v11_lever`, поле `v11_levers`. `content/lint.py` — L306, L290 пин 19. `content/attack.py` — три атаки L306, вторая атака L290, три конструкции, хвост денег после `pons_launch` — префикс из девяти. `packages/contentpack/test/m0.test.ts` / `l0.test.ts` — классификатор G0, префикс денежных ключей. `docs/ROADMAP.md` — одно предложение. `docs/CONTENT.md` §5/§6. Кодоген 19 артефактов. Векторы 21 файл (pack_hash в заголовке).

Второго `.mdc` нет. Экономических литералов нет. `prize_live_min_rules_minor` не поднят.

## 3. Решения, которые не открывают развилку

- Восемь ключей D-G-1 после `launch_freeze`. Девятого нет. Имена M/P не использованы.
- L290 больше не lockstep с `rules_version`: водяной знак пин 19 (последний рекаунт формулы призов). Это D-G-3, не новый R-G-*.
- Инвентарь рычагов — имена существующих ключей, не величины.
- `code-phase.mdc` уже текст G0–G7; пробы M0 читают M0/M7 в теле, не в description.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `creator_tax_bps` 200. `season_prizes_live` 1. Три района `playable_v1=false`. `companion_rows_live` 0.
