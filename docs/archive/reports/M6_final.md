# M6 final

HUD `prize_surface` (`D-M-15`): городской Treasury = Capital; плашка протокола отдельно; лидерборд — шесть стоков и следствие пустоты/непокрытия, без кнопок слива/паузы и без «залочено навсегда». `rules_version` 0.19.0. `launch.deployed` пуст. Канала WS не добавлено.

Пак **52**, хеш **`08d68458ce32d8028572c152ca6963a881b45ed5f867551225f13ac4fd71b4fa`**, 545478 байт.

## Гейт

| команда | итог |
|---|---|
| `python content/build.py` | 0; pack 52; 545478 байт; hash `08d68458…b4fa`; круг 1445; вход 200; выход 910; fee split 100/80/20; `prize_period_real_hours` 750; `prize_assets` NVDA TSLA AMZN AAPL MSFT COIN; канал корзины aggregate |
| `python content/lint.py` | 303 / 0 |
| `python content/vectors.py` | 21 files; sha256 `57f5cf16310f6361d3c36c21502582ba50e2798075d071e0f6f0ce5a68710f53` |
| `python content/codegen.py --check` | 19 artifacts match `08d68458` |
| `pnpm -w run gate` | tsc/eslint/depcruise 0 (461/1381); vitest 101/0 |
| `pnpm --filter @corporator/client run gate` | 0; vitest 10/0 |
| `pnpm --filter @corporator/api run test` | 22/0 (повтор после EBUSY teardown Windows) |
| `python content/attack.py --only L155,L162,L165,L302` | все пойманы |
| `python content/attack.py --jobs 8` | 633/0; construction 195/0; 303 covered; 789.3s |

`sim.py` на M6 не обязателен. Новых зависимостей нет. Арт не тронут. ReadLints на client/api HUD — 0.

Свидетель GENERATED «M6: поверхность призов HUD»: prize_assets_n=6; без CORP; period hours 750; prize_basket_channel=aggregate.

Критерий: строки HUD ⊆ `ru.json`; чисел экономики в клиенте нет; каналы — разбиение `state_sources`; `PRIZE_POOL_EMPTY` / `PRIZE_CLAIM_UNCOVERED` приходят из `codes` и конверта, не из фикстуры-прозы; клейм — ряд на каждый `prize_assets`.

## Атаки

Харнесс 633, все пойманы. Этапные:

| вход | ожидание | факт |
|---|---|---|
| кнопка `owner_drain` на лидерборде | L302 | caught |
| «овнер вывел, залочено навсегда» | L302 | caught |
| `overview_treasury` ← `wallet.corp_balance` | L302 | caught |
| снят `PRIZE_CLAIM_UNCOVERED` с rank | L302 | caught |
| spend на missions / claim без wallet / v1_feature | L155/L162/L165 | caught |
| пустой / ghost `prize_surface.construction_tests` | L268 | caught |
| канал `clock` | L237 | caught |
| сухой `pool_in` на шести активах | `PRIZE_CLAIM_UNCOVERED` ×6 | test |
| CORP в корзине | L294 | caught |

Выстояло: пять каналов, Treasury=`tick.capital`, демо `DEMO_NO_PRIZE`. Нашего нового обхода нет.

Первый прогон `api` `postgres_replay_matches_pglite` упал на `EBUSY` rmdir temp Windows после тела теста; повтор 22/0. Не дефект пака.

## Расхождения

Принятые: `R-M-6`, `R-M-9`, `R-M-10`, горячий ключ подписанта, видимость бота ончейн. Новых `R-M-*` нет.

## Незакрытое


Next: M7 — `launch_freeze`.
