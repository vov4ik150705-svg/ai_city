# P5 final

`time_rehearsal`: 90 суток механики на прод-паке; транспорт fail-open на инъекциях. `launch.deployed` пуст. Водяной знак 19. `rules_version` 0.20.0.

Пак **68**, хеш **`1e50885daa47c397d5a3f405a6e1a7ef883b3f4f5057ddd6fa2670f51ce69147`**, 587690 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 325 / 0 |
| `python content/build.py` | 0; pack 68; 587690 байт; hash `1e50885d…ce69147`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 23 artifacts match `1e50885d` |
| `python content/vectors.py` | 21; sha256 `80c67ebf06dfa7ab4cbb4ea494e25d4d902427bd1209f1d52bdf5ca679fe8273` (два прогона совпали; не G7: в заголовке pack_hash пака 68) |
| `python content/attack.py --only L285,L286,L291,L292,L304,L325` | 16/0 пойманы |
| `tsc -b && eslint . && depcruise && vitest run` | tsc 0; eslint 0; depcruise 505/1574; vitest 153/0 (45 files) |
| четыре конструкции P5 | OK на зелёном; красный вход внутри каждой |
| `python content/rehearsal.py` | 2160 тиков; farm/prize/season границы; snap14_tail_eq true |
| `python content/attack.py --jobs 8` | 325 rules covered; construction 242 held; SURVIVED 0; elapsed 7.0s |

`sim.py` / `builds.py` не в команде этапа (`A-P-5`). Полный `--jobs 8` — правка `lint.py` / `attack.py` (L325). `pnpm -w run gate` на этой машине упирается в TLS npm; tsc/eslint/depcruise/vitest прогнаны локальными бинарниками. `--jobs 8` **нет** в `gate_cmd` этапа.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `city_day_real_hours=1` | L325 | caught |
| `pack_pin=fast` | L325 | caught |
| `tick_length_city_hours=2` | L325 | caught |
| хранимое окно фарма | L92 | caught |
| `prize_periods_per_season=4` | L282 | caught |
| `attestor.fail_mode=closed` | L246 | caught |
| `feed_live=0` бросает | тик идёт | выстояло: не бросает |
| RPC silence / JSON-число / out of gas | `SERVICE_DEGRADED` / `silence` | caught |
| повтор nonce hop | `API_INTENT_REPLAY` | caught |
| hop ключ = номер попытки | платит дважды | не проходит: ключ = `voucher.nonce` |
| `--jobs 8` в шаговом `gate_cmd` | L319 | нет в `time_rehearsal.gate_cmd` |
| демо-ребро / DEMO после qualify | L292 | caught (`--only`) |
| `presentVoucher` без депозита | ok | нашлось в харнессе; закрыто `deposit` |
| засчитать A за B | календарь тестнета | не заявлено (`R-P-7`) |
| `city_day_real_hours` сжат в драйвере | RuntimeError | `rehearsal.py` отказывается |
| `volumes: ..:/app` | не этот шаг | L322 с P4 держит |

Выстояло (принято, не дефект пака): календарные 3 суток тестнета (`R-P-7`); живой `compose up` / локальная цепь образа (`R-P-6`); тонкий пул тестнета; `PRIZE_SHARE_CAPPED` на N=1 (L291); горячий ключ подписанта; `R-M-6`/`R-M-9`/`R-M-10`; секунды `unpauseDelay` и адреса (`R-P-3`, owner, P7).

## Расхождения

`R-P-7`. Трое реальных суток тестнета и провайдеры RPC/IPFS — владелец. Форма Б доказана инъекциями fail-open, не ожиданием стены. Не переоткрывать как «прогон A = прогон B».

`R-P-6` без изменений: образ не поднимался; хеш пака равен пину.

## Незакрытое

PENDING 4: `companion_llm_price_snapshot` (owner), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3), `pause_ready_delay` (owner, к P7). Внешний аудит-подрядчик — календарь владельца. Живой compose / тестнет — среда, не пак.

Next Step: **P6** — `ops_watch` (пороги из чисел P5, не из головы).
