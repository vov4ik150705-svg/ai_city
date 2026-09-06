# C6 — итоговый отчёт шага

Сэмплер пишет TWAP и фид во входы тика. Тик не ждёт. Ряд `price_day` публикуется. Живой RPC не нужен.

Пак **31**, `rules_version` **0.17.0**, хеш **`4a1167a38cf1885bb151347b1e0794a070c29925a318502309d211f3c6ea094d`**, 486619 байт.

---

## 1. Что закрыто

- TWAP заголовка = `twapFromSamples` опубликованного ряда до разряда (`sampler_twap_recompute`).
- Ряд минус один сэмпл даёт другое число (`sampler_twap_sensitive`).
- Молчание: значение старое, `feed_live=0`, возраст растёт, метка не двигается.
- Алерт возраста (3) раньше устаревания (6). Период 50 с делит 3750, ≤ 60.
- Второго `twapFromSamples` в `services/sampler` нет (L242 grep). Спот не во входах.
- `stepSampler` синхронный; `blocks_tick=0`, `fail_mode=open`. Тик sampler не импортирует.

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | pack 31; круг 14.47% / Trader 11.67% |
| хеш | `4a1167a38cf1885bb151347b1e0794a070c29925a318502309d211f3c6ea094d` |
| байты | 486619 |
| `python content/lint.py` | **272/0**, PENDING 27 |
| `python content/vectors.py` | 20; sha256 `d8bdff4fb61bd720773414e48fc859e3f526309601d8660493d21780b58bbc6a` |
| `python content/codegen.py --check` | 12 match `4a1167a38cf1885b` |
| `python content/attack.py --only L239,L241,L242,L243` | 5/5 пойманы |
| `python content/attack.py --jobs 8` | **500/0**, construction **145/0**, 467.6s |
| `pnpm --filter @corporator/sampler run gate` | tsc; vitest **4/0** |
| `pnpm -w run gate` | tsc-b + eslint + depcruise **285/0**; vitest **43/0** |

## 3. Конструкционные пробы C6

`sampler_twap_recompute`, `sampler_twap_sensitive`, `sampler_silence_keeps_age`, `sampler_period_divides_tick`.

## 4. Расхождения R-C-*

| id | суть | статус |
|---|---|---|
| R-C-6 | CID | C8 |
| R-C-11 | engine magic-numbers off | C1 |
| R-C-13 | canonical копия в contentpack | C2 |
| R-C-14 | C2-имена не дублировать | C3 |
| R-C-15 | PGlite не Neon | C3 |
| R-C-16 | список RPC-модулей | принято |
| R-C-17 | `demo_barrier_holds` на C5 | принято |
| R-C-18 | `services_do_not_block_tick` имя на C3; C6 — sync step + pack `blocks_tick=0` | **принято** |
| R-C-19 | workspace vitest 5s игнорирует пакетный timeout; корень 60s | **принято** |

## 5. Адверсариальное ревю

| вход | ожидание | факт | вывод |
|---|---|---|---|
| last-sample как TWAP | recompute падает | 0n ≠ 1n | держит |
| константа 1n | sensitive падает | full === dropped | держит |
| last-sample | sensitive падает | выживает | пара проб |
| константа 1n | recompute падает | выживает на этом ряде | пара проб |
| bump метки при молчании | silence падает | 8n ≠ 1n | RK-9 |
| свой `twapFromSamples` в sampler | L242 | mean.ts | D-C-11 |
| `aggregation=arithmetic_mean` | L242 | second mean | пак |
| `samples=25` | L239 | период 150 | период |
| `spot_wei` | L240 | поймано | не спот |
| `price_day_published=0` | L243 | поймано | ряд |
| Date в sampler src | eslint | banned | край |
| `-w` + 1800 + PGlite | 5s timeout | replay 5.9s | R-C-19 |

Выжившее: живой RPC — C10. CID — C8. Спрайты — T10.

## 6. Незакрытое

C7: buyback. C10: rpc parity. Спрайты T10. `build_tile_refusal` — T10.

Next: C7 — `services/buyback`.
