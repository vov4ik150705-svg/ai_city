# G0 final

`v11_form`: пак несёт восемь этапов v1.1; `rules_version` 0.20.0; инвентарь рычагов непуст. `launch.deployed` пуст. Водяной знак призов 19.

Пак **55**, хеш **`2a39425f88b7d0c23b610e0691b06803c3836c4c7eca900d09299f3432a0162e`**, 556183 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 55; 556183 байт; hash `2a39425f…162e`; rules 0.20.0; круг 1445; вход 200; выход 910; mint 51; окно A [12275, 15783] |
| `python content/lint.py` | 306 / 0 |
| `python content/codegen.py --check` | 19 artifacts match `2a39425f` |
| `python content/vectors.py` | 21 files; sha256 `9890b66d1e7be500a088dba17bc140bd6e9a59680f20ee1bf96709ba410f38a7` (новый из-за `pack_hash` в заголовке; арифметика тика не ехала) |
| `corepack pnpm --filter @corporator/contentpack run gate` | tsc 0; vitest 26/0 |
| `python content/attack.py --only L262,L268,L306,L290` | 7/0 пойманы |
| три конструкции G0 | OK на зелёном паке; красный вход внутри каждой |

`sim.py` / `builds.py` / `attack.py --jobs 8` на G0 не в команде этапа (`A-G-16`).

## Атаки

| вход | ожидание | факт |
|---|---|---|
| снят `v11_form` | L306 | caught |
| `rules_version` 0.19.0 | L306 | caught |
| `v11_levers={}` | L306 | caught |
| водяной знак 18 | L290 | caught |
| водяной знак 20 | L290 | caught |
| `gate_cmd=""` | L262 | caught |
| `ts_gate_cmd=""` | L268 | caught |
| девятый ключ / ghost / дубль / вставка | construction | caught |
| `logistics.playable_v1=true` | construction | caught |
| синтетический `v11-phase.mdc` | vitest | не ровно одно фазовое |
| `deployed` заполнен | не этот этап | поля пустые (`A-G-2`) |

Выстояло (принято): неопределённость окна A до пересчёта на G1; `R-T8-2`; `R-T5-12`. Нового дырявого обхода нет.

## Расхождения

Новых `R-G-*` нет. L290 пин 19 — исполнение `D-G-3`, не расхождение.

Вход фазы на диске был пак 54 (план писал 53 — паспорт M7). G0: 54→55.

## Незакрытое


Next Step: **G1** — `districts_live` (AMZN/MSFT/COIN `playable_v1=true`, `sim.py` + `builds.py`).
