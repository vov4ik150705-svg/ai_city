# P1 final

`player_identity`: мутирующая команда требует сессию; `city_id` из сессии, не из тела; идентичность не в байтах записи; лимит в `command_rates`. `launch.deployed` пуст. Водяной знак призов 19. `rules_version` 0.20.0.

Пак **64**, хеш **`12b0703d8d63f3ade53be3c13345b9685b253f24b35f4781d9f8a286960ee765`**, 577238 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 64; 577238 байт; hash `12b0703d…e765`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 318 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `12b0703d` |
| `python content/vectors.py` | 21 files; sha256 `c72de9113f8d790016151aec7aa1221743a62ea5be92446b10c907a13d106b39` (`R-P-2`) |
| `tsc -b && eslint . && depcruise && vitest run` | tsc 0; eslint 0; depcruise 494/1505; vitest 140/0 (40 files) |
| `python content/attack.py --only L232,L235,L247,L248,L249,L250,L251,L255,L315,L316,L317,L318` | 18/0 пойманы |
| пять конструкций P1 | OK на зелёном хосте; красный вход внутри каждой |
| `python content/attack.py --jobs 8` | 318 rules covered; construction 229 held; SURVIVED 0; elapsed 7.5s |

`sim.py` / `builds.py` на P1 не в команде этапа (`A-P-5`). Полный `--jobs 8` — правка `lint.py` (L315: `sessionFromHeaders`, не слово session).

`pnpm -w run gate` на этой машине упирается в TLS npm; гейт прогнан теми же четырьмя командами из скрипта `gate`.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `city_id` из тела в `commands.ts` | L315 | caught |
| командный путь без `sessionFromHeaders` | L315 | caught |
| литерал `/auth/session` в `http.ts` | L316 | caught |
| снят `auth_nonce` | L316 | caught |
| `message_fields=["domain"]` | L316 | caught |
| `owner_address` в DecisionRecord | L317 | caught |
| `layout_version=2` | L317 | caught |
| `RateGate` на хосте | L318 | caught |
| нет `command_rates` | L318 | caught |
| нет инкремента `command_rates` | L318 | caught |
| эндпоинт без `commit:*` | L232 | caught |
| `GET /screen/bank` | L235 | caught |
| транспорт в `requires` / `message` в конверте | L247/L248 | caught |
| команда без `intent_id` / хранимый лимит | L249/L250 | caught |
| поле без дома / ребро demo→wallet | L251/L255 | caught |
| POST без сессии | construction | 401 `API_UNAUTHORIZED` |
| тело `city_id=zzz` | construction | сессия `"a"`, `zzz` не создан (`A-P-2`) |
| GET снимка без сессии | `A-P-23` | 200 |
| демо-сессия | нет `address` | так |
| маркеры идентичности в байтах тика | L317 + construction | нет (`A-P-3`) |
| рестарт хоста | L318 | лимит жив (`A-P-13`) |
| код `AUTH_REQUIRED` | запрещён | нет (`A-P-22`) |
| `city_id` от адреса | `A-P-24` | `randomBytes(16)` hex |
| `rules_version` / watermark | `A-P-25` | 0.20.0 / 19 |
| `--jobs 8` в `gate_cmd` шага | `A-P-5` | нет |
| `deployed` заполнен | не этот этап | поля пустые (`A-P-1`) |
| noble в клиенте | запрещён | нет импорта |

Выстояло (принято): горячий ключ подписанта (владелец); `R-M-6`/`R-M-9`/`R-M-10`; отдельного `it()` на recover кошелька нет (L268 1:1 с пятью именами; recover чистый, путь в `session.ts`).

## Расхождения

`R-P-2`. sha256 векторов P1 `c72de911…06b39` ≠ свидетель P0 `ddc1b9d1…ffa21`. Причина — `pack_version` 64 и таблицы/маршруты auth меняют `pack_hash` в заголовке тика. Идентичность в байты не попала: `L317` и `identity_absent_from_record_bytes`. Это тот же класс, что `R-P-1`, не дефект `D-P-4`. Печатный sha в `PLAN_RELEASE` P1 (`2db024ef…4097`) и формулировка «тот же что G7» — устарели на P0.

## Незакрытое

PENDING 4: `companion_llm_price_snapshot` (owner), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3), `pause_ready_delay` (owner, к P3/P7). Числа владельца §9 — к P3/P7.

Next Step: **P2** — `ci_tracks` (два трека CI, `L319`; не зависит от P1).
