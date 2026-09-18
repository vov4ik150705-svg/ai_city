# T6 TZ — фарм сток-токенов (фрагменты)

Исполнять целиком. Не сокращать. Не выводить в чат полные тексты файлов, таблицы, формулы с выкладкой и отчёты длиннее 15 строк. Всё писать на диск. В чат — только паспорт: пути, lint rules/errors, attack count, pack SHA256, next step.

Канон механик — `DESIGN.md`. Канон интерфейса — `HUD.md`. Форма данных — `docs/CONTENT.md`. ТЗ задачи — `docs/BRIEF.md` §6 T6. Hand-off T5 — сообщение архитектора и `docs/reports/T5_recon.md`.

Прочитать целиком до первой правки: `DESIGN.md`, `HUD.md`, `docs/BRIEF.md` (T6 + инварианты §3), `docs/LAUNCH.md` §10 и §13, `docs/BALANCE.md` §14, `docs/PROGRESSION.md` (прокси `fragments_season`, R-T4-4), `docs/CONTENT.md` §2/§10 и таблица L01–L89, `docs/SIMULATION.md` абзац про T6, `content/params/pending.json`, `content/params/economy.json` (spend_*), `content/tick.py` `_apply_spend` (строки ~621–658), `content/builds.py` `fragments_season`, `content/params/modifiers.json` ключ `fragment_rate_bps`, `content/lint.py` RULES и L68/L72/L77, `content/attack.py` ATTACKS/CONSTRUCTION/coverage.

---

## 0. Что это за задача

Игрок должен чувствовать, что фармит в городе настоящую NVDA, и протокол не должен обещать доходность, которую не может покрыть. Фрагменты — внутренние фишки требования на уже купленный сток, не ERC-20 и не «игровой NVDA». Пул — настоящие ERC-20, купленные на рынке. Протокол не маркет-мейкер по шести бумагам, шести пулов `CORP/сток` нет.


---

## 1. Инварианты, которые ломать нельзя

- Касса: `Capital игроков + Capital фонда ≤ vault_CORP × 2000`. Фрагменты не минтят Capital. Покупка стока не минтит Capital. Изъятый `spend_protocol` CORP уже вычтен из vault в `_apply_spend`; T6 только направляет его.
- Фонд зарплат: дневной бюджет /14, пропорция, пробка 30 дней, слив резерва ≤5%/неделю. **Не забирать** creator tax и `reserve_cork` в пул фрагментов.
- Трение 14.47%, вход дешевле выхода. Фрагменты не vault/bank/DEX-ставки.
- Тик детерминирован: начисление фрагментов — чистая функция записанных входов. Покупка стока и hop — **снаружи** тика. Размер пула на окне — **записанный вход** settlement, не спот. LLM нет. Random только сид (здесь не нужен).
- Стройка не платит: ни $CORP, ни Capital, ни фрагментов за факт постройки. IDLE не платит фрагментов.
- Запрещённый список: нет «игрового NVDA», нет PnL бумаги на баланс игрока, нет шести пулов CORP/сток, нет минта Capital сверх фонда, нет обещания что все в плюсе.
- 13 ключей модификаторов. Четырнадцатый — решение владельца, в T6 не заводить. Новая бесплатная строка на `output_bps` **запрещена** (форточка L77: запас 500 bps; +700 ломает 13300). T6 не трогает `output_bps` у unpaid-строк. Узел `scale` в оконный зонд L77 не класть как черту.
- Выводимое не хранится. Одно число в одном месте. `fragment_claim_window_city_days` **не хранить**: равен `payroll_daily_divisor`.
- Доллар — производная снимка, с датой. Спот нашего пула CORP/ETH в путь минта и в settlement не входит.

---

## 2. Архитектурные решения (по одной рекомендации)

### 2.1 Что такое фрагмент

Внутренняя фишка требования, как Capital: не ERC-20, не перевод между игроками, не продаётся на DEX. Шесть леджеров, по одному на район/тикер. Начисляется только за **валидный оплаченный тик** (здание + агент + ресурсы + не IDLE) в здании с ровно одним районом (`tier=beacon`, `district` задан). Базовые здания, синергии (`requires` ≥ 2, в т.ч. `robotics_lab`), заполнитель — **ноль** фрагментов. Причина: иначе синергия плодит второй сток без своей paper-ветки, а база без стейка фармит NVDA.

База начисления = **gross output тика до `payroll_ratio`**. `fragment_rate_bps` (стадия `post`, режим `mul`) сплавляется тем же fused-mulDiv, что T5. Efficiency района уже сидит в output — **не умножать второй раз**.

Почему до payroll, не после: фрагменты — требование к другому пулу (настоящие стоки), не к фонду зарплат. Тонкий фонд не должен убивать оба контура. Это не второй минт Capital.

AAPL / `flagship_store`: валидный тик маяка consumer даёт фрагменты AAPL. Population-конверсия — всё ещё output, twin уже в потолке T5.

### 2.2 Окно клейма

`fragment_claim_window_city_days := payroll_daily_divisor` (=14). Не второй параметр. Тот же горизонт сглаживания, что у фонда: пик запуска не вываливает весь запас стоков в первые сутки. Реальное время = 14 × `city_day_real_hours` = 350 ч ≈ 14.58 суток; это вывод, не параметр.

Граница окна: `window_index = (city_day − 1) // 14`. Settlement в **06:00** первого часа нового окна (`efficiency_recalc_hour`) — один именованный суточный якорь, не полночь и не закрытие банка. Код состояния `FRAGMENT_WINDOW_SETTLED`.

После settlement леджер окна **обнуляется** (как дневные запросы payroll не переносятся). Пустой пул → выплата 0, код `FRAGMENT_POOL_EMPTY`, фрагменты всё равно сгорают. Не копить требование бесконечно против пустого пула (кит иначе дампит первое наполнение).

`Σ fragments = 0` → деления нет, пул не трогать, код `FRAGMENT_NO_CLAIMS`.

### 2.3 Источники пула (развилки BRIEF: комиссии / дом / NFT)

T1 (`LAUNCH.md` §10) предлагал `spend_protocol_bps` **и** излишек пробки фонда. T3 R-T3-20: сбор до фонда подлинеен, leftover ETH ≈ 0. Рекомендации T6, не список:

| Кран | Решение | Почему |
|---|---|---|
| Creator tax (ETH) | **0** в фрагменты | Кормит фонд через выкуп. Забрать — голодать payroll. Параметр `fragment_creator_tax_share_bps = 0`. |
| `reserve_cork` | **0** | Пробка — канал восстановления фонда, не приз. Расхождение с T1 §10 назвать **R-T6-1**. `fragment_cork_share_bps = 0`. |
| `spend_protocol` (10% трат, CORP уже изъят из vault) | **да** | Единственная доля дома, которую канон §2.4 разрешает забирать. |

Сплит изъятого protocol-CORP (сумма 10000, L-правило):

- `protocol_fragments_bps = 6000` — непрерывное окно, каждый город каждый цикл.
- `protocol_prizes_bps = 4000` — держится для T7, T6 не тратит.

Почему не 5000/5000: сезоны реже и топ-N; фрагменты — постоянный drain. Почему не 10000/0: T7 тогда остаётся без крана и снова тянется к налогу фонда.

Конвейер покупки **снаружи тика**, тот же транш что выкуп (`buyback` 0.33% глубины, L22), не новый лимит. Порядок на границе окна:

1. Тик замораживает леджеры (чистая функция).
2. Снаружи: `budget_corp = proto_corp_window × protocol_fragments_bps / 10000`; продать CORP→ETH (1% налога **возвращается в фонд** — это не кран фрагментов, это побочный сбор DEX); hop; купить сток; записать `pool_in[ticker]` во вход.
3. Settlement-тик: чистая пропорция от записанного пула.

Аллокация бюджета по тикерам — **по спросу фрагментов**, не 1/6: `budget_t = eth_net × frag_t / Σ frag`. Нулевой леджер → не покупать этот сток (нет мёртвого инвентаря COIN, пока Finance в v1.1).

### 2.4 Лишняя нога ETH→USDG→сток

Замер `LAUNCH.md` §13: 1 bp на 100$ и 1000$, 3 bp на 10 000$ (v3 USDG/WETH fee 100). **Не копировать таблицу в params** (L09/L68). Один параметр:

`fragment_hop_haircut_bps = 3`, src = `docs/LAUNCH.md` §13 строка 10 000$, why = консервативный пол, чтобы инвариант держался на крупном транше.

COIN: глубочайшая quote-нога WETH, не USDG. Параметр `weth_quote_ticker = "COIN"` (одно имя, не список из шести). Маршрут `quote_asset(ticker) = WETH if ticker==COIN else USDG`. **Haircut тот же 3 bps**: COIN пропускает ногу USDG, но его WETH-пул ~54 k$ — отдельная модель проскальзывания не выдумывается. Транш T12. Остаточный риск назвать **R-T6-2**.

Покупка только на существующих пулах Uniswap (USDG или WETH). Не CORP/сток.

### 2.5 Settlement и инвариант

```
payout_i = floor( fragments_i × pool / Σfragments )     # Σ>0
если claiming_cities ≥ 2:
    cap = floor( pool × fragment_city_cap_bps / 10000 )
    payout_i = min(payout_i, cap)                        # код FRAGMENT_CITY_CAPPED
assert Σ payout_i ≤ pool
dust = pool − Σ payout_i                                 # остаётся в пуле
fragments_i := 0
```

Никто не получает ноль, пока пул не пуст и у города есть фрагменты (floor может дать 0 при пыли — как банк; пыль остаётся, не раздаётся вторым проходом). Второй проход redistrib запрещён: это вторая петля и скрытый обход капа.

Инвариант **`стоков к выплате ≤ стоков в пуле`** по каждому тикеру отдельно. Минта стоков нет. Тест на конкретной тройке (см. §6).

### 2.6 Потолок одному городу

`fragment_city_cap_bps = 5000`.

- N=1: кап **не применяется**, город забирает всю пропорцию (минус floor-пыль). Иначе первый игрок отдаёт половину протоколу за то, что он один.
- N≥2: один город ≤ половины пула окна. Два равных (50/50) кап не задевает. Трое равных (33%) не задевает. Кит 90% против 10%: кит 50%, минноу 10%, 40% пыль в пуле на следующее окно. Пыль **не** перекладывать минноу.

Почему не 2500: при трёх равных фермерах одного тикера 2500 режет всех. Почему не 10000: BRIEF требует потолок. Почему не 1000 как `stake_bonus_max`: стейк — efficiency, здесь инвентарь приза; 10% резал бы даже 6 равных.

### 2.7 Демо и v1

Демо-город: фрагменты начисляются в изолированной книге, клейм настоящего ERC-20 — отказ `DEMO_NO_CLAIM`. Прогресс не переносится (BRIEF §2).

v1 играбельные районы NVDA/TSLA/AAPL: три живых леджера. AMZN/MSFT/COIN: леджеры есть в данных, начисление 0, пока `playable_v1=false` (здания закрыты тем же правилом скоупа, не ручной список).

**Фрагментные окна входят в v1.** Сезоны и призовой фонд топ-N — v1.1 (T7). Это **R-T6-3**: `DESIGN.md` §11/§12 склеивал «сезоны и призовой фонд». Разрезать: окно фрагментов ≠ сезон Influence. §12 «не в первой версии» остаётся про сезоны; дописать одно предложение про фрагменты в v1 для играбельных районов.

### 2.8 `fragments_season` (снять прокси)

Сейчас `builds.py` суммирует величины узлов `paper` (и в `spot` — только район-прожектор). Это прокси R-T4-4.

Заменить на **вес требования** (accrued claim), не на ожидаемые штуки стока:

```
fragments_season = produced × fragment_stack_bps / BPS
```

скоуп как сейчас: в `spot` только сток района-прожектора; иначе сумма по взятым paper с efficiency района. `fragment_stack_bps` — сплав `fragment_rate_bps` билда (узлы paper + дивиденды, если есть), не сырая величина узла.

Почему не `accrued × pool / Σ`: тонкий пул схлопывает paper в мёртвый узел (все упираются в кап) и L64/L63 едут. Пул — ограничение settlement, не цель доминирования билдов. Paper должен выигрывать `fragments_season`, когда цель — бумага.

После замены: `python content/builds.py` — justified > 0, dominating 0, dead 0, mandatory 0, uncovered 0. Если разъехалось — чинить скоринг/свидетелей, **не** возвращать прокси. Контрольные 18/2/1/7695 (L66) не менять без причины; меняется только цель `fragments_season`.

Снять `pending.fragment_season_proxy` и `pending.fragment_pool_sources`. `prize_curve` / `influence_weights` остаются T7. Добавить pending `fragment_tick_wiring` owner T11 и `fragment_claim_screens` owner T9, если коды заведены, а экрана нет.

### 2.9 DecisionRecord и tick.py

Поле `fragments` в записи **не добавлять в этом шаге** (layout каноничен с первого дня; T3 симы сломаются; T11 владеет байт-точностью). В `DESIGN.md` §2.9 назвать, что дельта фрагментов войдёт в запись на T11, как T5-стадии. `tick.py` / `sim.py` **не применяют** settlement против живого DEX. Чистая функция settlement живёт в `content/build.py` (или `content/fragments.py`, если иначе `build.py` раздувается — предпочтительно отдельный модуль, импорт из build/lint/attack, без нового числа в двух местах).

---

## 3. Формулы (целочисленные, floor, mul→div)

```
BPS = 10000
window_days = payroll_daily_divisor                          # derived
window_index(day) = (day - 1) // window_days
accrual(tick) = 0 если не (status оплачен ∧ beacon ∧ один district ∧ район playable)
accrual(tick) = fused_mul(gross_output, fragment_rate_bps) иначе

eth_net = eth_from_sold_corp × (BPS - fragment_hop_haircut_bps) / BPS
budget_t = eth_net × frag_t / sum_frag                       # sum_frag>0

payout_i = frag_i × pool / sum_frag
cap_i = pool × fragment_city_cap_bps / BPS                   # только если N_claiming ≥ 2
payout_i' = min(payout_i, cap_i)
Σ payout ≤ pool                                              # инвариант, иначе гейт
```

Свидетель инварианта (обязателен в GENERATED.md и construction):

- три города, фрагменты 1,1,1, пул 10 → 3+3+3=9 ≤ 10, пыль 1.
- два города 5000/5000, пул 100, cap 5000 bps → 50+50, кап молчит.
- два города 9000/1000, пул 100, cap 5000 → 50+10=60 ≤ 100, код капа на ките.
- один город 10000, пул 100 → 100, кап не применялся.
- sum_frag=0, пул 50 → выплата 0, пул 50.
- ceil вместо floor на 1,1,1×10 → 4+4+4=12 > 10 — **должно** ронять L90.

Битность: тот же fused, что T5; нового ключа нет. L86 не ослаблять.

---

## 4. Авторские параметры (только эти числа хранятся)

Файл `content/params/fragments.json`. Каждое поле: `v`, `u`, `src`, `why`.

| id | v | единица | src / why |
|---|---:|---|---|
| `protocol_fragments_bps` | 6000 | bps | §2.3 TZ: доля protocol-CORP на сток-пул |
| `protocol_prizes_bps` | 4000 | bps | остаток T7; сумма с fragments = 10000 |
| `fragment_creator_tax_share_bps` | 0 | bps | не голодать фонд; T3 R-T3-20 |
| `fragment_cork_share_bps` | 0 | bps | пробка ≠ приз; R-T6-1 |
| `fragment_nft_share_bps` | 0 | bps | T8; кран существует нулём |
| `fragment_hop_haircut_bps` | 3 | bps | LAUNCH §13, 10 000$ |
| `fragment_city_cap_bps` | 5000 | bps | N≥2, половина пула |
| `weth_quote_ticker` | (строка COIN) | ticker | LAUNCH §13 исключение глубины |

Если схема `param_map` не принимает строку — `weth_quote_ticker` соседним объектом с `v` как id, либо `params` + `routes`. Не хранить 6 маршрутов руками: генератор строит `quote_asset` из одного тикера и `districts[].ticker`.

Derived (считаются, не хранятся): `fragment_claim_window_city_days`, `fragment_claim_window_real_hours`, `protocol_split_total_bps`, `quote_asset` по тикеру, `fragment_city_cap_applies(N)`, таблицы settlement-свидетелей, бюджет окна из T1-сценариев × haircut (доллар со снимком ETH/USD 2026-08-27).

`exceptions.json` не тратить на COIN: это параметр маршрута, не нарушение правила сущности.

Bump: `pack_version` 11→12, `rules_version` 0.8.0→0.9.0 (новые формулы генератора — major compat).

---

## 5. Файлы

Создать:

- `docs/PRIZES.md` — канон-документ T6: фрагменты полностью; § «сезоны» = заглушка «владелец T7, краны `protocol_prizes_bps` уже зарезервированы». Стиль канона: русский, английские id, плотные таблицы, ссылки вместо дублей. Широкие таблицы — только ссылка на `content/out/GENERATED.md` секции «T6: …».
- `docs/reports/T6_recon.md` — исследование: решения, пересчёт, расхождения R-T6-*, атаки, гейты, SHA256 двух сборок.
- `content/params/fragments.json`
- чистая функция settlement+accrual probe в `content/build.py` и/или `content/fragments.py`

Пословные правки (не переписывать разделы целиком):

- `DESIGN.md`: новый **§2.9 Фрагменты и пул стоков** (рядом с payroll, не в §4 как «ещё одна погода»). §2.8 — «ни фрагментов». §2.3 строка трат — 10% протоколу, из них 60/40 фрагменты/призы. §2.4 казна: покупка стока hop, не шесть пулов. §4.8 / §5.13 — указатель, что `fragment_rate_bps` уже в потолке, пул здесь. §6.1 — не менять layout; одно предложение «дельта фрагментов — T11». §11 — окна фрагментов играбельных районов в v1; сезоны по-прежнему v1.1. §12 абзац сезонов — одно предложение, что 14-дневное окно ≠ сезон.
- `HUD.md` — минимум: не рисовать PnL бумаги; клейм и запас до капа — T9. Можно одну фразу в сток-баре, что фрагменты не цена. Экраны не инвентаризировать (T9).
- `docs/CONTENT.md` — тип `fragment_param` / `fragment_ledger` в реестре §2; §10 T6 закрыт; таблица L90–L103; счётчик правил; pending.
- `docs/BALANCE.md` §14 — строка T6 закрыта, T7 знает про `protocol_prizes_bps`.
- `docs/LAUNCH.md` §10 — доли, которые T6 забрал; cork не забран (ссылка R-T6-1).
- `docs/PROGRESSION.md` — снять «прокси T6»; `fragments_season` = вес требования; pending R-T4-4 закрыт.
- `docs/SIMULATION.md` — одно предложение: settlement не в `tick.py` (T11), как строки T5.
- `content/schema/corporator.schema.json` — `$defs/fragments_file`, в `PARAM_FILES`.
- `content/pack.py` — `fragments.json`.
- `content/build.py` — генерация derived, секции GENERATED «T6: …», вызов settlement probe.
- `content/lint.py` — L90–L103 (номера стабильны, не дырявить).
- `content/attack.py` — мутации + construction; coverage не оставляет UNATTACKED.
- `content/builds.py` — новый `fragments_season`.
- `content/params/codes.json` + `content/strings/ru.json` — коды ниже. L11/L12.
- `content/params/pending.json` — снять два T6; добавить T9/T11 как выше; T7 не трогать кроме того, что кран 4000 уже есть.
- `content/out/*` — только генератором.

Не трогать: T1 ставки круга, T2 кривые, T3 сиды сценариев, T5 якоря/форточку/13 ключей, `exceptions.json` (остаётся пустым, если не доказано иначе), `tick.py` порядок шагов, `sim.py` ряды.

Коды (category `state` или `refusal` по смыслу):

| code | category | slots |
|---|---|---|
| `FRAGMENT_POOL_EMPTY` | state | `ticker` |
| `FRAGMENT_NO_CLAIMS` | state | `ticker` |
| `FRAGMENT_CITY_CAPPED` | state | `ticker`, `cap` |
| `FRAGMENT_WINDOW_SETTLED` | state | `window` |
| `DEMO_NO_CLAIM` | refusal | [] |
| `FRAGMENT_HOP_STALE` | state | `ticker` |

`FRAGMENT_HOP_STALE`: конвейер снаружи не смог купить (нет пула / stale). Settlement видит pool=0, не вызывает DEX. Текст честный, не молчаливый ноль.

---

## 6. Правила линтера L90–L103

Каждое правило: в `CONTENT.md` строка «какое нарушение ловит», в `lint.py` функция, в `attack.py` мутация, на которой оно **падает**, плюс хотя бы одна construction-граница, где оно **молчит правильно**. Правило без срабатывания — декорация (урок T5 L77 / R-T5-14).

| id | Ловит | Атака | Construction (должно пройти) |
|---|---|---|---|
| **L90** | `Σ payout > pool` по любому тикеру; ceil/round вместо floor | подменить режим на ceil на свидетеле 1,1,1×10 | floor 3+3+3=9≤10 |
| **L91** | начисление не только на валидный beacon-тик: стройка, IDLE, база, синергия, неиграбельный район | выдать accrual>0 на `workshop` или `robotics_lab` или IDLE | маяк playable + paid >0 |
| **L92** | окно хранится литералом или ≠ `payroll_daily_divisor` | записать `fragment_claim_window_city_days=7` в params | derived 14 |
| **L93** | `protocol_fragments_bps + protocol_prizes_bps ≠ 10000` | fragments 6001 | 6000+4000 |
| **L94** | `fragment_creator_tax_share_bps ≠ 0` | =100 | 0 |
| **L95** | `fragment_hop_haircut_bps < 3` (слабее замера 10k$) | =0 или 2 | 3 |
| **L96** | кап применяется при N=1, или два равных режутся, или `fragment_city_cap_bps` вне (0,10000) | cap=2500 режет 50/50; либо N=1 с капом | N=1 без капа; 50/50 при 5000 живы |
| **L97** | ключей модификаторов ≠ 13, или T6 добавил unpaid `output_bps` | 14-й ключ или `specialist_home2` +700 output | L72/L77 живы; T6 rows не output unpaid |
| **L99** | демо-флаг позволяет клейм реального стока (`demo_claim_real=1` или аналог) | включить | demo isolated |
| **L100** | `fragments_season` снова сумма величин `paper` без `produced`/стека (прокси) | вернуть старый счётчик в generated probe | paper-билд лучший на цели fragments в хотя бы одном сценарии (L64 не мёртв) |
| **L101** | появился пул/пара `CORP/{ticker}` или второй пул $CORP | завести `pools.corp_nvda` | quote_asset только USDG/WETH |
| **L102** | `sum_frag=0` делит / падает; или пыль раздаётся вторым проходом | wipe pool при нулевых клеймах | pool 50 остаётся |
| **L103** | `fragment_cork_share_bps ≠ 0` или cork в формуле бюджета | cork=500 | 0; budget только protocol×6000 |

L77 обязан по-прежнему ловить `a_l77_new_free_row_700`. Не ломать coverage L01–L89. Новое правило, которое никогда не стреляет — провал шага.

Дополнительно: L09/L68 — окно и hop-таблица замера не дублируются. L11/L12 — новые коды. L04 — сплит 6000+4000. L21 — v1 скоуп леджеров из `playable_v1`, не ручной список трёх тикеров.

Если при реализации окажется, что L97 дублирует L72 — оставить L97 на **unpaid output row добавленный T6-контентом** (дыра приёмки R-T5-14), а 14-й ключ пусть ловит L72; тогда атака L97 = новая trait-строка +500…+700 на `output_bps` с `paid=0`. +500 может пройти форточку (13282) — это construction T5, не отменять. L97 тогда ловит **любой новый unpaid output из файла fragments/content T6**, либо отдельный запрет: `fragments.json` не содержит modifier rows. Проще: T6 не добавляет modifier rows вообще — L97 = «в fragments.json нет keys/rows модификаторов» + атака засунуть `output_bps` row туда.

---

## 7. GENERATED.md секции «T6: …»

Пометить сгенерированными, параметры-источники, команда `python content/build.py`.

1. Источники пула: четыре крана и доли (0/0/6000/0 + приз 4000).
2. Маршруты шести тикеров (5×USDG, COIN×WETH) из одного параметра.
3. Свидетели settlement (четыре строки §3).
4. Бюджет окна в Capital и в $ (снимок ETH/USD 2500.87, дата 2026-08-27) для T1 low/mid/hype **только** от `spend_protocol` пути, не от линейного налога LAUNCH §3. Если на low выходит пыль < 1$ на город на окно — назвать **R-T6-4**: фарм — требование на тонкую долю дома, пока нет оборота трат; **не** доливать из налога фонда и не обещать APY.
5. `fragments_season` до/после (прокси снят; paper жив).

Пересчитывать числа, не копировать из прозы TZ. Расхождение с TZ назвать, не подгонять молча.

---

## 8. Адверсариальное ревю (обязательный проход)

Кроме таблицы §6, сознательно искать обходы:

- Кит копит 13 дней, в последний час перекладывает стейк/узлы — settlement по замороженному леджеру окна, не по споту узлов. (Описание в PRIZES.md; код тика T11.)
- Кит открывает 6 городов (сивил) — это T7 антисивил. T6 кап **на город**, не на кошелёк. Назвать **R-T6-5** владельцу T7: прямой стимул плодить города появляется, когда пул реальный; T6 его не закрывает.
- Пустой Uniswap по AMZN в v1 — неиграбелен, не покупаем по спросу.
- Отказ hop: pool_in=0, код `FRAGMENT_HOP_STALE`, экономика тика жива.
- Подмена пула вверх в recorded input — верификатор T11; T6 фиксирует, что settlement не читает спот.
- `protocol_prizes_bps` потратить в T6 — запрет L93/документа.
- Новая бесплатная `output_bps` «для фрагментного чувства» — запрет L77/L97.
- Фрагменты после payroll_ratio=0 всё ещё капают — это **задумано**; атака «должно быть 0» не принимается. Construction: payroll_ratio=0, valid tick → accrual>0.
- Двойной efficiency — атака умножить ещё раз, L91 или отдельный construction.

Касса на числах шага: изъятие protocol-CORP уже в `_apply_spend`; settlement не минтит Capital; сумма выплат стока ≤ пул.

---

## 9. Критерии приёмки

- `python content/build.py` дважды: байты пака и SHA256 совпали.
- `python content/lint.py`: ERRORS none; правил ≥ 103 (89+14, если номера L90–L103 без дыр). PENDING без `fragment_season_proxy` и `fragment_pool_sources`.
- `python content/attack.py`: every rule caught, UNATTACKED empty, construction held, exit 0. Каждое новое правило поймало свою поломку (в т.ч. ceil>pool, окно-литерал, cork>0, tax>0, hop<3, CORP/NVDA пул, прокси fragments_season, N=1 кап, 1,1,1 ceil).
- `python content/builds.py`: dominating 0, dead 0, mandatory 0, uncovered 0; paper не мёртв; justified сообщить числом.
- ReadLints на правленные py/json.
- Импорт `content.fragments` / `build.settle_fragments` (как названо) и прогон свидетелей.
- JSON валиден схемой (L01).
- `DESIGN.md` §2.9 существует; §2.8 содержит фрагменты; расхождения R-T6-* отдельными пунктами в PRIZES.md и T6_recon.md.
- Ни одного обещания APY / «все в плюсе» / игрового NVDA.
- Исключений 0 или именованная строка с why; бюджет 6 не жечь на COIN.

---

## 10. Формат чата исполнителя (≤15 строк)

```
=== ARCHITECTURAL SYNTHESIS ===
Ключевые формулы и числа: [...]
Найденные риски / расхождения: [R-T6-*]
Итог: [status]

=== HAND-OFF / TELEMETRY ===
Измененные/созданные файлы: [...]
Gate Metric: rules N / errors / attacks M / pack bytes / SHA256 / builds justified
Next Step: T7
```

Полный отчёт — только `docs/reports/T6_recon.md`.
