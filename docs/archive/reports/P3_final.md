# P3 final

`contract_audit`: пять контрактов аудированы до подписи; ERC-20 по разнице баланса. `launch.deployed` пуст. Водяной знак 19. `rules_version` 0.20.0.

Пак **66**, хеш **`eb97948f355c0f807c73760de03a4486fcba54d35052bd515072db663be5f2d9`**, 583491 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/lint.py` | 321 / 0 |
| `python content/build.py` | 0; pack 66; 583491 байт; hash `eb97948f…be5f2d9`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/codegen.py --check` | 20 artifacts match `eb97948f` |
| `python content/attack.py --only L277,L297,L298,L299,L300,L301,L303,L305,L320,L321` | 29/0 пойманы |
| `forge test --root contracts` | 15 passed (M5 3 + L7 4 + P3 8, fuzz 256); Foundry 1.8.1 |
| `tsc -b && eslint . && depcruise && vitest run` | tsc 0; eslint 0; depcruise 496/1513; vitest 146/0 (42 files) |
| три конструкции P3 | OK на зелёном; красный вход внутри каждой |
| `python content/attack.py --jobs 8` | 321 rules covered; construction 235 held; SURVIVED 0; elapsed 12.1s |

`sim.py` / `builds.py` на P3 не в команде этапа (`A-P-5`). Полный `--jobs 8` — правка `lint.py` / `attack.py` (L320/L321). `pnpm --filter @corporator/chainport run gate` на этой машине упирается в TLS npm; tsc/eslint/depcruise/vitest прогнаны локальными бинарниками.

## Атаки

| вход | ожидание | факт |
|---|---|---|
| голый `transfer` | L320 | caught |
| `+= amount` | L320 | caught |
| `decimals() == 18` у стока | L320 | caught |
| `got = amount` без дельты | L320 | caught |
| `got = afterBal - before; got = amount` | L320 | найдено ревю, закрыто, caught |
| `unsliced = unsliced + amount` | L320 | найдено ревю, закрыто, caught |
| critical + `deployed.token` | L321 | caught |
| `closed_code` без `construction` | L321 | caught |
| находка без `status` | L321 | caught |
| `delegatecall` в казне | L297 | caught (починка его не добавляла) |
| `recoverWrongToken` своего `$CORP` | L301 | caught |
| открытая critical, `deployed` пуст | L321 молчит | by design; открытых critical нет |

Выстояло (принято, не дефект пака): горячий ключ подписанта; `R-M-6`/`R-M-9`/`R-M-10`; нет `ReentrancyGuard` (стоки без хуков, Rev-A); void-return USDT (нет `.call` на произвольный адрес, `A-P-21`); налог эмитента на исходящем переводе; секунды `unpauseDelay` и адреса стража/подписанта (`R-P-3`, owner, P7); подрядчик внешнего аудита (календарь, P4 параллельно).

## Расхождения

`R-P-3`. Конструктор уже требует `unpauseDelay > 0` и `guardian != signer`. Секунды и адреса из `PLAN_RELEASE` §9 не выдуманы; `pending.pause_ready_delay` остаётся owner. Внутренний P3 закрывается таблицей `accepted`; P7 без этих чисел не закрывается. `R-P-1`/`R-P-2` (sha векторов) не этот этап.

## Незакрытое


Next Step: **P4** — `prod_image` (параллельно календарю внешнего аудита).
