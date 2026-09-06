# P4 — журнал кода

`prod_image`: прод собирается, не монтируется; секреты названы в паке; восстановление доказано реплеем; две реплики тикают город один раз. `launchToken` не подписывался. `rules_version` 0.20.0. Водяной знак призов 19.

Пак после `python content/build.py`: **587 138** канонических байт, хеш **`b1505f61e3f43a5eb45b3c3ba8dd91e25267421bfa60a58a9a3bffad9af09093`**, `pack_version` **67**, `layout_version` **1**. Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`.

Причина `pack_version` 66→67 (`CONTENT.md` §5): новые сущности — `arch.secrets`, `arch.backup`, таблица `tick_locks`, артефакты `compose.prod` / `.env.example` / `restore.sh`, правила L322–L324, три новые пробы `prod_image`.

---

## 1. Создано

| путь | роль |
|---|---|
| `services/api/src/tick_lock.ts` | аренда писателя: `INSERT … ON CONFLICT DO NOTHING` |
| `services/api/src/migrate_main.ts` | одноразовый job миграций, без планировщика |
| `services/api/test/p4.test.ts` | три имени `prod_image.construction_tests` кроме уже существующего `image_pins_pack_hash` |
| `docs/OPS.md` | образ, секреты, бэкап |
| `docs/reports/P4_recon.md` | разведка |
| `docs/reports/P4_code.md` | этот журнал |
| `docs/reports/P4_rules.md` | пробы и поимки |
| `docs/reports/P4_final.md` | гейт и атаки |

## 2. Изменено

`content/codegen.py` — runtime печёт `/app/pack.json`, не дерево `content/`; `compose.yaml` монтирует репозиторий только у dev/staging; `compose.prod.yaml` без bind-mount, job `migrate`, `env_file`, healthcheck/restart. `main.ts` тикает только с арендой `tick_locks`. `listen.ts` — CSP без `unsafe-inline`. `content/{lint,attack}.py` — L322–L324. `packages/contentpack/test/p0.test.ts` — канон четырёх имён P4. `docs/API.md` §3, `docs/ARCHITECTURE.md` §9, `docs/CONTENT.md` §5/§6. Кодоген 23 артефакта.

Экономика не ехала. `launch.deployed` пуст. `image_pins_pack_hash` остаётся одним `it()` в C9.

## 3. Решения

- Пак в образе — файл, не `content/` (`L276` / `copy_content=0`).
- Секреты в yaml не перечисляются: `env_file` достаточно; ноль вхождений имени — не дубль (`L323` ловит только `>1`).
- Аренда не `putBytes` upsert: конфликт не ворует чужую строку.
- Живой `docker compose up` на этой машине нет (`R-P-6`). Форма доказана yaml + L322 и пробами.

## 4. Инертность

Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`. `creator_tax_bps` 200. `window_a_ratified` 1. `prize_live_min_rules_minor` 19. `rules_version` 0.20.0.
