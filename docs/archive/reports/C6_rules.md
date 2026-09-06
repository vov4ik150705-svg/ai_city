# C6 — пробы и поимки

L242 читает `services/sampler/src` (оверлей `_sampler_source`). Новых `L*` нет.

Пак: **486619** байт, хеш **`4a1167a38cf1885bb151347b1e0794a070c29925a318502309d211f3c6ea094d`**, `pack_version` **31**.

Конструкции vitest (`sampler.construction_tests`), красный прогон на подготовленном входе, затем зелёный:

| имя | вход падения | факт |
|---|---|---|
| `sampler_twap_recompute` | заголовок = последний сэмпл, не TWAP ряда | 0n ≠ recompute 1n |
| `sampler_twap_sensitive` | константный TWAP `1n` | full === dropped; проба падает |
| `sampler_silence_keeps_age` | молчание пишет `cityTime` в метку | 8n ≠ 1n |
| `sampler_period_divides_tick` | L239 `samples=25` | период 150 не делит 3750 |

Прочие красные входы:

| вход | правило | факт |
|---|---|---|
| `aggregation = arithmetic_mean` | L242 | `second mean` |
| overlay `function twapFromSamples` в sampler | L242 | `second TWAP definition in services/sampler/mean.ts` |
| `price_day_published=0` | L243 | флаг выключен |
| `silence_bump_time=1` | L241 | метка без сэмпла |
| `spot_wei` во входах | L240 | spot is a sampler input |
| last-sample как «TWAP» | sensitive | **выживает** (последние значения разные); ловит recompute |
| константный `1n` | recompute | **выживает** на ряде `[2]*(n-1)+[0]` (mean=1); ловит sensitive |
| vitest 5s при `-w` + окно 1800 + PGlite | replay_from_storage | timeout; корневой `testTimeout` 60s |

Обе пробы TWAP нужны парой: last-sample обходит sensitive, константа 1 обходит recompute на этом ряде. Python `construction_sampler_*` не трогаты. Имя `services_do_not_block_tick` одно, на C3 (R-C-18).
