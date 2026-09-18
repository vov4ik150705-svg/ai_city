# P4 final

`prod_image`: прод-образ без mount исходников; секреты в паке; единственный писатель тика; бэкап со свидетелем реплея. `launch.deployed` пуст. Водяной знак 19. `rules_version` 0.20.0.

Пак **67**, хеш **`b1505f61e3f43a5eb45b3c3ba8dd91e25267421bfa60a58a9a3bffad9af09093`**, 587138 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 324 / 0 |
| `python content/build.py` | 0; pack 67; 587138 байт; hash `b1505f61…f09093`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 23 artifacts match `b1505f61` |
| `python content/attack.py --only L259,L260,L314,L322,L323,L324` | 14/0 пойманы |
| `tsc -b && eslint . && depcruise && vitest run` | tsc 0; eslint 0; depcruise 503/1557; vitest 149/0 (43 files) |
| три новые конструкции P4 | OK на зелёном; красный вход внутри каждой |
| `python content/attack.py --jobs 8` | 324 rules covered; construction 238 held; SURVIVED 0; elapsed 7.3s |

`sim.py` / `builds.py` / `vectors.py` на P4 не в команде этапа (`A-P-5`). Полный `--jobs 8` — правка `lint.py` / `attack.py` (L322–L324). `pnpm --filter @corporator/api run gate` на этой машине упирается в TLS npm; tsc/eslint/depcruise/vitest прогнаны локальными бинарниками.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `volumes: ..:/app` в прод-yaml | L322 | caught |
| `USER root` в runtime | L322 | caught |
| нет job `migrate` | L322 | caught |
| нет таблицы `tick_locks` | L322 | caught |
| секрет дважды в yaml | L323 | caught |
| роль без `env` в secrets | L323 | caught |
| снят `replay_witness` | L324 | caught |
| два `tickOnce` без замка на общем state | 2 строки `tick_inputs` | caught (проба) |
| секрет 0 раз в yaml (`env_file`) | L323 молчит | by design |
| `docker compose up` | живой стек | нет Docker на машине (`R-P-6`) |

Выстояло (принято, не дефект пака): горячий ключ подписанта; `R-M-6`/`R-M-9`/`R-M-10`; имя секрета не дублируется перечислением в Dockerfile; живой compose на этой машине (`R-P-6`); секунды `unpauseDelay` и адреса (`R-P-3`, owner, P7).

## Расхождения

`R-P-6`. Docker CLI отсутствует; критерий «стек из образа» доказан формой (`compose.prod.yaml` + L322 + три пробы), не `compose up`. На машине с Docker — nightly `image_smoke` и P5. `R-P-4` (mount) закрыт L322, не переоткрывается.

## Незакрытое


Next Step: **P5** — `time_rehearsal` (нужны зелёные P3 и P4).
