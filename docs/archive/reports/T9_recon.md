# T9 recon — экраны и клики

Исследовательский отчёт задачи T9. Канон — `DESIGN.md`, `HUD.md`, `docs/SCREENS.md`. Широкие таблицы — `content/out/GENERATED.md` секции «T9: …», команда `python content/build.py`. Чистая функция — `content/screens.py`. Геометрия тайла — **T10**. Догон тика — **T11**. Контракт REST/WS — **T12**.

`pack_version` 18. `rules_version` 0.13.0: minor — у полей появилось обязательное `value_kind`, это меняет форму секции screens, не формулу генератора.

---

## 1. Коды: что было и куда попало


Пять новых (больше не заводилось):

| код | категория | куда на экране |
|---|---|---|
| `BANK_LIMIT_FROM_DEPTH` | state | `bank` |
| `MINT_RATE_CAPPED` | state | `bank` |
| `EXCHANGE_HOP_UNAVAILABLE` | refusal | `exchange_buy` (blocking, tier external) |
| `WALLET_WRONG_CHAIN` | refusal | `wallet_confirm` |

Поверхности «не режем» из `HUD.md` §9 закрыты `state_surfaces`. Все `IDLE_*` — на `log_panel` и `agents_panel`.

---

## 2. Пути `derived_from` (реально существующие ключи)

| величина | путь |
|---|---|
| лестница банка | `generated.balance.bank_daily_limit_wei_by_level` (фоллбек: `balance.params.bank_level_gain_bps` + `launch.params.bank_daily_limit_pool_share_bps`) |
| потолок доли глубины | `meta.params.bank_daily_limit_pool_share_cap_bps.v` |
| глубина пула | `generated.launch.pool_depth_quote_wei` / `launch.params.eth_graduation_threshold.v` |
| живой лимит (свидетель) | `generated.screens.bank_daily_limit_live` |
| курс минта / потолок | `generated.economy.anchor_mint_rate` ← `economy.params.capital_anchor`, TWAP `economy.params.twap_window_city_hours` |
| потолок оффлайна | `generated.time.offline_cap_ticks_base` ← `time.params.offline_cap_city_hours_base` / `tick_length_city_hours` |
| узлы research | `research.nodes` (grid, tools, handbook) — не дублируются в `screens.json` |
| hop / кап фрагментов | `fragments.params.fragment_hop_haircut_bps`, `fragment_city_cap_bps` |
| призовой пул / live | `screens.params.leaderboard_claim_live` (клейм stub); коды на `leaderboard` |
| налог витрины | `economy.params.creator_tax_bps`, `vault_fee_bps` |
| слоты | `agents.params.slots_cap` |

Спота пула `economy.price_feeds.corp_eth` на полях банка нет (`L156`).

---

## 3. Переиспользованные механизмы линтера

- **L01** расширен фикстурами `brief_t9_screens` / `hud_screens` и `$defs.screens_file`.
- **L09** — ключи `screens.derived` в `IMPLEMENTED_DERIVED`; итерация `data.items()` пропускает не-dict (оверлей `_screens_md`).
- **L11/L12** — блок `ui` в `strings/ru.json` не входит в сверку код↔текст (`_ru_texts` читает только `strings`).
- **L45** — список файлов расширен `screens.py` (литерал `HOP_LO_BPS = 1` в whitelist `{0,1,2,3,8,10,16}`).
- **L21 / fixture `design_11_scope`** — `L160` читает те же `districts_playable`.
- Документный скан L164 — новый, не дубль L68 (L68 — params, не markdown).

---

## 4. Конфликты HUD ↔ DESIGN

- **R-T9-1.** `HUD.md` §9 называл `RESEARCH` заглушкой; `DESIGN.md` §11 включает три узла. Канон скоупа — §11. HUD пословно исправлен.
- **R-T9-2.** Приёмка нашла дыру реестра, не расхождение канона: `wallet` сняли с `bank_withdraw`, потому что вся identity сидела в одном тире. Закрыто подтирами identity (демо, кошелёк, сеть) и возвратом `wallet` на движение ценности. `L165`/`L166`.
- **R-T9-4.** `L147` в первой редакции проверяло резолв, а не смысл; поля ссылались на посторонние ключи. Закрыто `value_kind` + семейства единиц + `L167`/`L168`.
- **R-T9-3.** `DESIGN.md` не переписывался: две фразы-ссылки на `docs/SCREENS.md` в §7.2 и §11.

Пятнадцать экранов против тринадцати пунктов BRIEF — расширение (`exchange`, `district_card`), не `R-T9-*`.

---

## 5. Закрытые и новые pending



Не трогались: цена LLM и ёмкость очереди (T12), проводка тика (T11), грамматика тайла (T10).

---

## 6. Журнал атак

Обязательные векторы (все сработали):

| # | вход | правило |
|---|---|---|
| 1 | снят `leaderboard` | L144 |
| 2 | у `agents` нет empty | L145 |
| 3 | кириллица в label | L146 |
| 4 | `derived_from` лимита = `12345` | L147 и L156 |
| 5 | код капабилити вне `codes.json` | L148 |
| 6 | blocking + категория state | L148 |
| 7 | снят `PAYROLL_TRIMMED` | L149 и L159 |
| 8 | мёртвый `GHOST_REFUSAL` | L149 |
| 9 | два blocking в тире 30 | L150 |
| 10 | `capital=25`, `district_open=55` | L151 (сообщение стало бы «не хватает Capital» на закрытом районе) |
| 10b | `wallet_chain=9` | L151 (диапазон identity пересечён, порядок внутри группы нарушен) |
| 11 | `spend=capital` без токена | L152 |
| 12 | withdraw на демо | L153 |
| 13 | `commit:extend_offline` | L154 |
| 14 | spend на `missions` | L155 |
| 15 | снят `MINT_RATE_CAPPED` с банка | L156 |
| 16 | поле банка → спот пула | L156 |
| 17 | `kind=route` на Exchange | L157 |
| 18 | Capital `source=client_format` | L158 |
| 19 | MSFT live без гейта | L160 |
| 20 | четвёртый узел на `research` | L161 |
| 21 | клейм приза live | L162 |
| 24 | число `99` в SCREENS.md (оверлей) | L164 |
| 25 | `wallet` снят с `bank_withdraw` | L165 |
| 26 | `wallet` снят с `districts_open` | L165 |
| 27 | `wallet=10`, `not_demo_withdraw=11` | L166; блокирующий в демо стал `WALLET_NOT_CONNECTED` |
| 28 | `topbar_corp` pack_derived на `creator_tax_bps` | L147 (money vs rate) |
| 29 | `city_rank` pack_derived на `leaderboard_claim_live` | L147 (флаг) |
| 30 | `live_state` с оставленным `derived_from` | L167 |
| 31 | `pack_derived` без `derived_from` | L167 |
| 32 | `state_source` без владельца | L168 |
| 33 | неиспользуемый `state_source` | L168 |

Ограничение: семейство `count` не отличает слот застройки от слота агента. `build_slots` → `agents.params.slots_cap` L147 пропустит. Различение держится ссылкой `src` и ревью, не автоматом.

Приёмка 2: `L147` ловило только резолв. Закрыто `value_kind` + семейства единиц + реестр `state_sources`. Поля: live_state 23, pack_derived 7, client_local 7.

Пробы конструкции:

| проба | итог |
|---|---|
| predicate на несуществующий путь | закрыта: L148 резолвит predicate |
| элемент без `requires` (navigate) | выстояла: законно |
| экран/панель без полей, пустые slots | не заведены как дыра: схема и L145/L12 держат пустоту экрана и slots↔текст; панель без полей схема допускает — названо: клиент T12 не должен слать панель без `fields` |
| демо → кошелёк → перенос прогресса | выстояла: на демо-потоке нет `commit` кроме `noop`, нет `wallet`/`corp`/`spend` |
| банк закрыт → вывод списывает лимит | выстояла: `bank_withdraw` гейтится `bank_open`; эффект — `commit` серверу, экран не списывает |
| оракул мёртв / hop не оценён | выстояла: `STALE_PRICE`, `ORACLE_*` на поверхностях; `hop_priced` на покупке |
| доля глубины пула в лимите | выстояла: wei не хранится в `screens.json`; смена `bank_daily_limit_pool_share_cap_bps` меняет свидетель, L23/L37 ловят экономическую ложь |

L09 при оверлее `_screens_md` (строка) падал `AttributeError` — закрыто: итерация только по dict.

---

## 7. Гейт

- `python content/lint.py` — 168 правил, 0 ошибок, PENDING 33 (T9-строк нет; есть `build_tile_refusal` T10).
- `python content/attack.py` — 326 атак, 0 crashes, «every rule caught its attack; 168 rules covered», construction held (85 probes).
- `python content/build.py` ×2 — SHA256 `9ca0349aed50e8ea236b44018231b99bd183533ebaaab3824492cf904eedab1c`, совпали. pack 295573 байт, `pack_version` 18, `rules_version` 0.13.0.
- `sim.py` ×2 — SIM.sha256 `6d1f988621bc38832272b18a36c4b9e935be5e38acbd541bf8387021d579b8bc`, совпали.
- `builds.py` — BUILDS.sha256 `37042dae9392793a2f9488131ae73a98ad08e5556d04d730019c91e56351c047`. justified 6321, dominating 0, dead 0, uncovered 0.

R-T9-4 закрыт: `L147` проверяет семейство единиц, не голый резолв. Фикция как `derived_from` запрещена.
