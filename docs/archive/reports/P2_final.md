# P2 final

`ci_tracks`: шаговый трек без `--jobs 8` и `sim.py`; оба живут в ночном; workflow из пака. `launch.deployed` пуст. Водяной знак 19. `rules_version` 0.20.0.

Пак **65**, хеш **`c9ca4e391ece88390ff9b4e1e74f3f2c4ea64035106708a3e515a179df0138b6`**, 579952 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 319 / 0 |
| `python content/codegen.py --check` | 20 artifacts match `c9ca4e39` |
| `python content/attack.py --only L259,L260,L319` | 8/0 пойманы |
| `tsc -b && eslint . && depcruise && vitest run` | tsc 0; eslint 0; depcruise 495/1509; vitest 143/0 (41 files) |
| три конструкции P2 | OK на зелёном; красный вход внутри каждой |
| `python content/attack.py --jobs 8` | 319 rules covered; construction 232 held; SURVIVED 0; elapsed 11.6s |
| nightly `python content/sim.py` | 10 сценариев; calibration A_t2 **14217** ∈ [12275, 15783] |
| `codegen.py --check` после `name: patched` | exit 1 `drift .github/workflows/ci.yml` |

`build.py` на P2 не в `gate_cmd` этапа; пак собран для публикации шага. `node scripts/ci.mjs` целиком на этой машине упирается в TLS npm на `install_frozen`; шаговые python-шаги и `pnpm gate` (tsc/eslint/depcruise/vitest) прогнаны отдельно.

Ночной `forge test` / `docker build`: бинарников `forge` и `docker` нет на машине инженера. Команды стоят в паке и в yaml; GitHub nightly их исполнит (`A-P-5` закрыт правилом, не локальным forge).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| `--jobs 8` в push `pack_lint` | L319 | caught |
| `sim.py` в push `pack_build` | L319 | caught |
| нет `--jobs 8` ночью | L319 | caught |
| ручной yaml | L319 | caught |
| `name: patched` на диске | codegen --check | drift, exit 1 |
| метрика без сервиса / литерал порога | L259 | caught |
| ready без pack_hash / python в образе | L260 | caught |
| `ci.mjs` main без фильтра | construction | `stepsOnTrack(..., "push")` |
| секреты в push job | L319 | нет `secrets.` |
| `--jobs 8` в шаговом `gate_cmd` | `A-P-5` | нет |

Выстояло (принято): горячий ключ подписанта; `R-M-6`/`R-M-9`/`R-M-10`; локально нет forge/docker.

## Расхождения

Нет новых `R-P-*` по канону. `R-P-1`/`R-P-2` (sha векторов) не этот этап: `vectors.py` не в `gate_cmd`.

## Незакрытое

PENDING 4: `companion_llm_price_snapshot` (owner), `exit_uncovered_at_band_floor` (owner), `bank_withdraw_rate_ceiling_only` (T3), `pause_ready_delay` (owner, к P3/P7). Адресат уведомлений ночного трека — P6. Forge/docker на машине инженера — среда, не пак.

Next Step: **P3** — `contract_audit` (пять контрактов, `L320`/`L321`; параллельно с ожиданием внешнего аудита можно вести P4).
