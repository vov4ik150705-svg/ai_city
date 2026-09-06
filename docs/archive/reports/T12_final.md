# T12 — итоговый отчёт шага

Архитектура как данные. Канон границ — `docs/ARCHITECTURE.md`. Контракт — `docs/API.md`. Этапы — `docs/ROADMAP.md`. Живые функции — `content/arch.py`. Тик не тронут.

Пак **24**, `rules_version` **0.16.0**, хеш **`001c9ae7235308673f58cc2489cad4527306646f39deb80193c2537892d47173`**, 462884 канонических байт.

---

## 1. Что закрыто

- Монорепо как таблица слоёв D1: engine 0 без зависимостей; `services/*` не зависят друг от друга; клиент `preview_only=1`.
- Биекция `POST /command/X` ≡ различные `commit:*` в `screens.actions`. Заглушки `missions_start`, `leaderboard_claim`: `FEATURE_NOT_IN_V1`, `spend=none`.
- 17 `state_sources` → 5 каналов `HUD.md` §8. Канала часов нет.
- Сэмплер: период 50 с делит 3750, ≤ 60; ряд `price_day`; `twap_from_samples` одно определение; молчание не двигает метку.
- Выкуп: ссылки на `launch.json`; порядок депозит → минт (I1/I3); ниже `min_batch` — ноль отправок.
- Транспорт: шесть кодов, HTTP, без прозы, не в `requires` и не в `DecisionRecord.reason`.
- Схема: байты+хеш; `city_time` правда; снапшот = сутки; барьер демо.
- Порт: mock+rpc; ключи разделены; TTL ваучера derived.
- Метрики D13, readiness = `pack_hash` + миграции, roadmap с гейтами.
- HUD 40/48; камера 504×520 → 504×432; `R-T10-2` закрыт.
- L226–L266, 41 атака, 29 конструкционных проб T12.
- Расхождения R-T12-1…9 названы в `ARCHITECTURE.md`. Пословные правки `DESIGN.md` §10 и `HUD.md` §2/§8 **внесены**.

---

## 2. Гейт с консоли

| метрика | значение |
|---|---|
| `python content/build.py` | 0 проблем канона; `pack_version` 24; `rules_version` 0.16.0 |
| хеш пака | `001c9ae7235308673f58cc2489cad4527306646f39deb80193c2537892d47173` |
| канонические байты | 462884 |
| `python content/lint.py` | **266 правил, 0 ошибок**, 0 предупреждений, PENDING 26 (без `owner=T12`) |
| `python content/attack.py --jobs 8` | **487 проб**, **266 покрыто**, **143 конструкции**, elapsed 438.6s |
| UNATTACKED | **0** |
| SURVIVED | **0** |
| CRASHES | **0** |
| CONSTRUCTION FAILED | **0** |

`docs/CONTENT.md` §6: 266 строк `| **L…** |` = `len(RULES)` = 266.

`python content/sim.py` — инертность:

| величина | канон | факт |
|---|---:|---:|
| `A_t2` калибровка | 14011 | 14011 |
| `F_reserve/F_deposit` | 3978 bps | 3978 |
| возврат min / opt | 2837 / 8213 | 2837 / 8213 |
| `N_min` low/mid/hype | 229 / 705 / 1057 | 229 / 705 / 1057 |
| `N_bank` low/mid/hype | 137 / 183 / 483 | 137 / 183 / 483 |

---

## 3. L226–L266 → поимка

См. `docs/reports/T12_rules.md`. Префикс `LNNN  ` совпадает с `--since-rule L226`.

---

## 4. Конструкционные пробы T12 (все `None`)

`layer_graph_sorts`, `layer_cycle_detected`, `endpoint_bijection`, `refusal_matrix_matches_t9`, `stub_endpoint_no_spend`, `channels_partition_state_sources`, `clock_has_no_channel`, `sampler_twap_recompute`, `sampler_twap_sensitive`, `sampler_silence_keeps_age`, `sampler_period_divides_tick`, `buyback_tranche_at_three_depths`, `mint_after_deposit_only`, `buyback_below_min_batch_waits`, `attestor_down_pay_continues`, `pack_hash_mismatch_halts`, `intent_replay_once`, `stale_expected_city_time`, `rate_limit_derived`, `record_fields_have_homes`, `replay_from_storage`, `snapshot_tail_equals_full_replay`, `demo_barrier_holds`, `port_two_implementations`, `voucher_single_use`, `readiness_requires_pack`, `invariants_all_metered`, `hud_safe_rect_positive`, `services_do_not_block_tick`.

Главные две: `replay_from_storage` (схема держит `DESIGN.md` §6.3) и `sampler_twap_sensitive` (цена проверяема: ряд минус один сэмпл меняет число).

---

## 5. Расхождения R-T12-*

| id | суть | статус |
|---|---|---|
| R-T12-1 | `DESIGN.md` §10 «На сервере» не знал сэмплера и выкупа | внесено |
| R-T12-2 | `HUD.md` §2 без высот; §8 каденция «раз в минуту» | внесено |
| R-T12-3 | ряд сэмплов в публикацию, не только число заголовка | расширение, layout v1 цел |
| R-T12-4 | `SCREENS.md` строка 3 → адрес `docs/API.md` | внесено |
| R-T12-5 | категория `transport` | в паке; не reason / не requires |
| R-T12-6 | камера 520 → 432; zoom_min 1/8 → 1/8 | закрыт `R-T10-2` |
| R-T12-7 | снимок цены LLM → `owner` | pending |
| R-T12-8 | `ROADMAP.md` без владельца в BRIEF | назначен T12 |
| R-T12-9 | `R-T11-10` / `R-T11-12` получают адрес сервиса | v1.1 / вне тика |

---

## 6. Адверсариальное ревю (`verification-loop` §3)

Атаки на собственную конструкцию после зелёного линтера:

| вход | ожидание | факт | вывод |
|---|---|---|---|
| `rules_version=0.15.0` при `layout_version=1` | L266 мог требовать bump | **молчит** | L266 ловит major и layout≠1, не факт публикации 0.16.0. Сигнал публикации — `pack_version`. Рекомендация: не хардкодить 0.16.0 |
| `sampler_samples_per_tick=125` (период 30 с) | L239 мог требовать ровно 50 с | **молчит** | период делит 3750 и ≤ 60: быстрее минуты разрешено (heartbeat 15). Не экономика |
| пустая таблица `services` | L246 мог требовать pack_gate | **молчал**, **закрыто** здесь: нет `pack_gate` → L246 | гейт больше не декорация |
| снять все `commit:*` | L232 пусто=пусто | **молчал**, **закрыто** здесь: нет эффектов → L232 | мёртвый город не биекция |
| `protocol → contentpack` тот же слой | обход «только вниз» | **L227** | исключение только `contentpack → protocol` |
| L241 без флага `silence_bump_time` | живой `sampler_silence_state` | зелёный | хост, который двигает метку, в паке не выразить; правило проверяет функцию архитектуры |
| один сэмпл в окне TWAP | чувствительность | `n=1800`; `[2]*(n-1)+[0]` vs без последнего — число меняется | проба `sampler_twap_sensitive` |
| ноль команд / максимум лимита | лимит = `2 × slots_cap` | `slots_cap+1` в памяти → лимит +2; в params числа нет | `rate_limit_derived` |
| оракул / RPC / IPFS / LLM врут | тик не блокируется | аттестатор `raise` снаружи; `PACK_HASH` — единственный closed; LLM `fail_mode=open` | `attestor_down_pay_continues`, `pack_hash_mismatch_halts` |
| подмена экономического числа так, чтобы гейт молчал | A_t2 | смена `arch.json`/`api.json` не входит в `tick.py` | инертность 14011 устояла |
| перевод демо→кошелёк | оба леджера | L255 + проба | барьер держится |

Молчавшие до правки: пустые `services` и пустые `commit:*`. Закрыты в L246 / L232. Остальные молчания названы и приняты.

Граница `L227` same-layer: новый пакет слоя 1 с deps не на `protocol` падает. Пакет вне таблицы слоёв в данных не существует — второго инвентаря нет (рекомендация: не заводить второй список).

---

## 7. Что не в скоупе T12

Строки TypeScript и каталог `packages/*`. Solidity. Живой RPC. Снимок цены LLM (`owner`). Спрайты T10. Шесть `S_min` (RPC 403).
