# P1 — журнал кода

`player_identity`: мутация только с сессией; `city_id` из сессии; идентичность вне байтов; лимит в БД. `launchToken` не подписывался. `DESIGN.md` не менялся. `rules_version` 0.20.0. Водяной знак призов 19.

Пак после `python content/build.py`: **577 238** канонических байт, хеш **`12b0703d8d63f3ade53be3c13345b9685b253f24b35f4781d9f8a286960ee765`**, `pack_version` **64**, `rules_version` **0.20.0**, `layout_version` **1**. Круг 1445, вход 200, выход 910, mint 51, окно A `[12275, 15783]`.

Причина `pack_version` 63→64 (`CONTENT.md` §5): новая сущность — маршруты `/auth/*`, `arch.session`, три таблицы, L315–L318.

---

## 1. Создано

| путь | роль |
|---|---|
| `services/api/src/recover.ts` | чистый recover `personal_sign`; сеть не зовётся |
| `services/api/src/session.ts` | nonce, сессия, `city_id` непрозрачный |
| `services/api/src/rates.ts` | `command_rates` + `SELECT FOR UPDATE` |
| `services/api/test/p1.test.ts` | пять имён `player_identity.construction_tests` |
| `packages/contentpack/src/session_message.ts` | каноническое сообщение подписи |
| `apps/client/src/session.ts` | демо и кошелёк; клиент без noble |
| `apps/client/src/hud/LoginRoot.tsx` | вход; тексты из `ru.json` |
| `docs/reports/P1_recon.md` | разведка |
| `docs/reports/P1_code.md` | этот журнал |
| `docs/reports/P1_rules.md` | пробы и поимки |
| `docs/reports/P1_final.md` | гейт и атаки |

## 2. Изменено

`content/params/{meta,api,arch}.json` — пак 64; `auth_nonce` / `auth_session`; `arch.session`; таблицы `sessions`, `city_owners`, `command_rates`; пять `construction_tests`; пин `noble_secp256k1` 2.3.0. Схема `arch_session`. `content/{lint,attack,build,arch,codegen}.py` — L315–L318, derived TTL, эмиттер listen. `content/strings/ru.json` — `UI_ENTER_DEMO`. `services/api/src/{commands,commit,http,host,listen,pack_ctx}.ts` — сессия до идемпотентности и лимита; `city_id` аргументом `applyLive`; `Authorization` на listen; нет `RateGate`. `services/api/package.json` / `pnpm-lock.yaml` — `@noble/secp256k1` 2.3.0. `apps/client/src/{command,main,index}.ts(x)`, `LiveRoot.tsx` — нет `city_id` в теле. `packages/contentpack/test/p0.test.ts` — канон пяти имён P1. Кодоген 19 артефактов. `docs/API.md` §7, `docs/ARCHITECTURE.md` §5, `docs/CONTENT.md` §5/§6.

Экономических литералов нет. `prize_live_min_rules_minor` не поднят. `launch.deployed` пуст. Новых транспортных кодов нет.

## 3. Решения, которые не открывают развилку

- Recover в `services/api`, не в chainport: чистая функция, без сети; клиент пин не импортирует (`D-P-3`).
- `/auth/*` не `commit:*`: L232 биекция не ослаблена (`L316`).
- `city_id` = 16 байт hex без `0x`, не от адреса (`A-P-24`).
- Первый демо занимает генезис `"a"`; следующие демо спавнят новый город.
- TTL: `session_ttl_s` = сутки города, `nonce_ttl_s` = длина тика; не хранимые часы (`L09`/`L281`).
- Чтение без сессии (`D-P-3`). `API_UNAUTHORIZED` уже был.

## 4. Инертность
