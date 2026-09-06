# P0 final

`release_form`: пак несёт девять этапов выхода; в дереве скана нет ключа и hex-адреса вне `launch.deployed` / `chain.deployed`. `launch.deployed` пуст. Водяной знак призов 19. `rules_version` 0.20.0.

Пак **63**, хеш **`4f26daf18e7ac2c61d8275babd9cf53e3f931b85efd1000f96a1cd8712d93071`**, 572712 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 63; 572712 байт; hash `4f26daf1…3071`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 314 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `4f26daf1` |
| `python content/vectors.py` | 21 files; sha256 `ddc1b9d125713a0ff5d3e7a85dc1abc0025c93e316a810c00f495cf7017ffa21` (сдвиг из-за `pack_hash` в заголовке; арифметика тика не ехала) |
| `corepack pnpm --filter @corporator/contentpack run gate` | tsc 0; vitest 45/0 (14 files) |
| `python content/attack.py --only L262,L268,L314` | 6/0 пойманы |
| две конструкции P0 | OK на зелёном паке; красный вход внутри каждой |

`sim.py` / `builds.py` / `attack.py --jobs 8` на P0 не в команде этапа (`A-P-5`).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| 64 hex в boot.ts | L314 | caught |
| hex-адрес в boot.ts | L314 | caught |
| ключ в `deploy/.env` | L314 | caught |
| `release_form.construction_tests=[]` | L268 | caught два имени vitest |
| `gate_cmd=""` | L262 | caught |
| `ts_gate_cmd=""` | L268 | caught |
| снят `release_form` | construction | caught |
| десятый `owner_drain` | construction | caught |
| HEVM в `.sol` | не L314 | не роняет |
| адрес из `launch.deployed` | не L314 | не роняет |
| префикс v1.1 после `launch_freeze` | L306 жив | `_v11_form_errors` None |
| `pack_version===62` в `g7.test.ts` | vitest красный на 63 | нашлось; закрыто полом ≥62 |
| `deployed` заполнен | не этот этап | поля пустые (`A-P-1`) |
| `release-phase.mdc` | запрещён | файла нет |

Выстояло (принято): горячий ключ подписанта (владелец); `R-M-6`/`R-M-9`/`R-M-10`; L314 не сканирует `content/` — корни как в плане; непрефиксные 64 hex.

## Расхождения

`R-P-1`. Свидетель байтов записи на P1 — sha векторов закрытия P0 `ddc1b9d1…ffa21`, не G7 `b282376c…`. P0 обязан поднять `pack_version`; `pack_hash` входит в заголовок вектора. Сдвиг на P0 — тот же класс, что G0. На P1 сдвиг относительно этого sha — дефект.

## Незакрытое

PENDING 4: `companion_llm_price_snapshot` (owner), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3), `pause_ready_delay` (owner, к P3/P7). Числа владельца §9 — к P3/P7.

Next Step: **P1** — `player_identity` (сессия, `city_id` из сессии, `L315`–`L318`).
