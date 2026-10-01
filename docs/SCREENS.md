# Экраны и клики

Канон интерфейсных экранов Corporator. Визуальный дизайн — `docs/reports/HUD_DESIGN_SYSTEM.md`; механика — `DESIGN.md`. Широкие таблицы — `content/out/GENERATED.md` секции «T9: …», команда `python content/build.py`. Чистая функция — `content/screens.py`. Геометрия тайла — экономический слой, `docs/archive/WORLD_PACK_GRID.md`. Догон тика — **T11**. Контракт REST/WS — **T12**, канон `docs/API.md`.

Ни одного экранного числа в этом файле: величины живут в паке и в GENERATED.

---

## 1. Пять законов экрана

**A. Отказ выводится, а не пишется.** У элемента список капабилити-токенов `requires`, не рукописный список кодов. Токен — строка реестра `capabilities`. Матрица «экран × элемент × коды» — производная, GENERATED «T9: элементы и отказы». Держит `L148`.

**B. На кнопке один блокирующий код, остальные — в тултипе.** Порядок тотальный: `(tier, token)`. Блокирующий — первый упавший `blocking`. Минимальный blocking-тир на элементе уникален, иначе сообщение неопределённо. Держит `L150` и параметр `refusal_show_count`.

**C. Порядок гейтов — от постоянного к сиюминутному.** Identity, затем scope, unlock, slot, funds, window, limit, external. Внутри identity порядок по неустранимости: демо, затем кошелёк, затем чужая сеть. «Не хватает Capital» на закрытом районе — дефект доверия. Тиры и токены — GENERATED «T9: капабилити и порядок гейтов». Держит `L151` и `L166`.

**D. Число на экране либо выводится из пака с совпадающим семейством единиц, либо приходит живым состоянием от названного владельца, либо считается клиентом из часов и формата. Фикция запрещена.** `pack_derived` несёт `derived_from`; `live_state` несёт `state_source`; `client_local` не несёт ни того, ни другого. Дневной лимит банка — `min` лестницы и доли глубины пула, свидетель `bank_daily_limit_live`. Держит `L147`, `L167`, `L168`.

**E. Клиент не считает экономику.** `source` из `{server, client_clock, client_format}`. Экономические `kind` — только `server`. Держит `L158`.

Кнопка считает `requires` по снимку: первое непройденное blocking из пака даёт код отказа. Нет поля — `UI_UNAVAILABLE`, не «нельзя». Warning не глушит кнопку. Демо с `demo_blocked` не выводит и не забирает призы.

Кириллица интерфейса живёт только в `content/strings/ru.json`. В `screens.json` кириллица допустима лишь в `why`. Держит `L146`.

---

## 2. Инвентаризация

Пятнадцать экранов `kind=screen` и одиннадцать панелей `kind=panel` — GENERATED «T9: инвентаризация экранов». Эталон BRIEF — `content/fixtures/brief_t9_screens.json` (тринадцать пунктов). Эталон HUD — `content/fixtures/hud_screens.json`. Сверка — `L144`.

Почему пятнадцать против тринадцати пунктов BRIEF: `exchange` выделен из пункта «DISTRICTS и Exchange», чтобы витрина показывала итог в Capital, а не маршрут; `district_card` добавлен как носитель дерева узлов тира и клейма фрагментов. Это расширение инвентаря, не расхождение с каноном механик.

У каждого экрана есть `loading_kind` и пустота (`empty_kind` или `empty_code`). Молчаливого нуля нет. `L145`.

---

## 3. Экраны

По каждому: назначение, панели, клики, отказы **кодами**, пустота и загрузка. Тексты — `strings/ru.json`. Полная матрица — GENERATED «T9: элементы и отказы».

**`build`.** Каталог и посадка: игрок выбирает здание и **свободную авторскую точку привязки** на острове (`R-V-100`); в тайл сетки не сажать. Строка каталога показывает L1 из `generated.balance.level_cost`. Код пока архивный — долг в `docs/archive/plans/PLAN_ISLAND.md` §5: луч в тайл и лот-плитка (`docs/archive/reports/TZ_HUD.md` §8.2, `R-V-55`, `R-V-53`, `L378`) описывают сегодняшний кадр, не задание. Отказы: `CITY_LEVEL_TOO_LOW`, `BUILD_TILE_ILLEGAL`, `NO_FREE_BUILD_SLOT`, `NOT_ENOUGH_CAPITAL`. Клик по уже стоящему закрытому сток-зданию → стейк района. HUD не дырявый (`L379`). Пустота `no_entities_yet`, загрузка `skeleton`.

**`agents`.** Найм и карточки. `agents_hire` → `commit:hire`; ряд открывает `agent_card`. Стоимость следующего слота — `generated.balance.hire_cost`. Отказы: `NO_FREE_AGENT_SLOT`, `NOT_ENOUGH_CAPITAL`. Пустота `no_entities_yet`.

**`districts`.** Шесть строк; без стейка гейт `DISTRICT_LOCKED`. Открытие — `open_district` по `stake_settled` ≥ `S_min`, `corp_held` не списывается; закрытый район без порога показывает сумму и `district_stake_more` (`source: "wallet"`), при `stake_ok` — `districts_open`. Карточка района — дерево и клейм. Отказы: `WALLET_NOT_CONNECTED`, `STAKE_BELOW_THRESHOLD`, `DISTRICT_LOCKED`. MSFT/AMZN/COIN live с `district_open` (`L160`).

**`exchange`.** Покупка стока. Поле итога в Capital, не маршрут (`L157`). HUD не открывает Review/Confirm, пока hop не оценён: отказ `EXCHANGE_HOP_UNAVAILABLE` до мастера. API не исполняет hop, пока котировка не живая. На живом порте токены приходят в кошелёк; сумма на экране — `stock_out` из лога. Нет `Transfer` на кошелёк — `EXCHANGE_DELIVERY_UNVERIFIED`. Отказы: `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CORP`, `BANK_CLOSED`, `BANK_SUNDAY`, `CITY_LEVEL_TOO_LOW`, `EXCHANGE_HOP_UNAVAILABLE`, `EXCHANGE_DELIVERY_UNVERIFIED`. Код на кнопке совпадает с `prepareBuyStock`. Загрузка `stale_freeze`.

**`bank`.** Депозит и вывод. На живом порте депозит — `prepare` (`approve`+`deposit`) и `confirm`; мок отвечает сразу `phase: "applied"`. `bank_withdraw` шлёт `amount` Capital. На моке API идёт `authorize` → `present` и кладёт $CORP в `corp_held`. На живом порте игрок вывод не подписывает: Capital списывается, ваучер проходит `signing` → `open`, а $CORP приходит в кошелёк только с `present_voucher`. Карточка — из снимка, не из памяти вкладки. Пока ваучер `signing` или срок прошёл и сверка ещё не вернула Capital, Present заблокирован. Живой лимит и курс минта — §4. Отказы депозита: `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CORP`. Отказы вывода: `DEMO_NO_WITHDRAW`, `WALLET_NOT_CONNECTED`, `NOT_ENOUGH_CAPITAL`, `BANK_CLOSED`, `BANK_SUNDAY`, `BANK_DAILY_LIMIT_REACHED`, `VAULT_EXIT_UNCOVERED`, `VOUCHER_PENDING`, `VOUCHER_EXPIRE_LIMIT`, `SERVICE_DEGRADED`. Порядок identity: демо, затем кошелёк, затем сеть. Загрузка `stale_freeze`.

**`research`.** Узлы из осей `research.json`, не из `screens.json` (`L161`). Синтетика `research_unlock_*`. Отказы: `CITY_LEVEL_TOO_LOW`, `NOT_ENOUGH_CAPITAL`.

**`missions`.** Заглушка. Все элементы — `FEATURE_NOT_IN_V1`, `spend=none` (`L155`). Пустота `no_events_yet`.

**`leaderboard`.** Живая таблица всех не-демо кошельков с непустым `wallet`. Сортировка витрины — Influence, затем GDP суток, затем `city_id`. Один слот на кошелёк: слияние как у движка (больший Influence, при равенстве меньший `city_id`); checksum `0x`-адреса — один слот; пробелы по краям срезаются; пустой `wallet` не подменяется `city_id` (на выплате ключ `c:<city_id>`, лицо пустое). Призовой `rank` видит каждый город того же кошелька. Checksum, пробелы внутри hex и неразрывный пробел — один слот. Город `account_kind=demo` не занимает призовой слот, даже если флаг `demo` сброшен. Призовой ранг HUD сливает только qualified города кошелька, иначе живой лидер Influence без qualify украл бы слот. Клейм приза и Zipf не тронуты: коды `PRIZE_*`, клейм несёт `wallet`. Пустота экрана `no_entities_yet`, когда кошельков нет; не квалификация. Квалификация остаётся на вкладке клейма (`UI_EMPTY_NOT_QUALIFIED`).

**`building_card`.** Постройка живёт здесь: непостроенное функциональное здание показывает `building_build`, построенное — `building_upgrade`, выключенное — `building_activate`; `deactivate` только после подтверждения. Уровень и клип `MODIFIER_CAP_CLAMPED`. `building_upgrade` шлёт `building_id`; API списывает `generated.balance.level_cost` следующего уровня, HUD показывает это же число. City Hall не апгрейдится (уровень = уровень города). Потолок — `TIER_NOT_UNLOCKED`. `deactivate` ставит `deactivated` на строке функции: слот застройки не освобождается, GLB не снимается, Capital за здание не возвращается; стройки и таймера меша нет.

**`agent_card`.** История и причина простоя. `set_objective` — warning `IDLE_OUT_OF_HOURS`. `agent_assign` сажает агента в функцию города; занятый слот вытесняет прежнего сразу.

**`district_card`.** Дерево тира и клейм фрагментов. Стейк и снятие живут на карточке: поле суммы, `district_stake_more` и `district_unstake`; снятие ниже порога замораживает район, повторный `unstake` в `grace` заблокирован. `district_unstake` на живом порте — подпись `requestUnstake`; токены ждут в контракте `unstake_cooldown_s`, заморозка района по-прежнему `unstake_grace_city_hours`. Подтверждение до подписи называет `unstake_cooldown_city_days` и, если бакет уже идёт, перезапуск таймера. `district_claim_unstaked` до `ready_at_s` блокируется `UNSTAKE_COOLING`, после срока подписывает `claimUnstaked`. `district_claim_fragment` шлёт `claim_fragment` без `district_id`. На моке owed идёт в `tokens_held`. На живом порте это подпись `claimPrize` в кошелёк; пока нарезка не в казне — `FRAGMENT_SLICE_PENDING`. `district_unlock_tier` шлёт `district_id` и открывает следующий тир, когда цена следующего тира больше нуля; HUD показывает `generated.progression.tier_cost`. `district_pick_node` шлёт `node_id` и `district_id`; предупреждение `UI_NO_RESPEC` до клика, exclusive без респека. `district_merge` шлёт `merge_id` и `district_id`; предупреждение `UI_NO_RESPEC` до клика, паросочетание без респека; HUD показывает `generated.progression.merge_cost`. Отказы: `WALLET_NOT_CONNECTED`, `TIER_NOT_UNLOCKED`, `STAKE_MULT_SHORT`, `NODE_SIDE_LOCKED`, `MERGE_MATCHING_BLOCKED`, `DEMO_NO_CLAIM`, `FRAGMENT_POOL_EMPTY`, `FRAGMENT_NO_CLAIMS`, `FRAGMENT_SLICE_PENDING`, `UNSTAKE_COOLING`, `UNSTAKE_NOTHING_PENDING`. Пустота `nothing_to_claim`.

**`offline_return`.** §5.

**`wallet_connect`.** §7.

**`settings`.** §8.

Панели HUD (`topbar`, `overview`, `active_events`, `districts_panel`, `city_card`, `agents_panel`, `log_panel`, `district_overview`, `scene`, `stock_bar`, `bottom_menu`) всегда на сцене. Живые карточки HUD — сетки header / hero / facts / body / block, не абзац на заливке панели. Economy рядом с фактическим `payroll_ratio` показывает стартовое окно, пока `payroll_boost_days_left` > 0; после окна чип исчезает, не становится `×3 forever`. Нет живых полей — `—`. `log_panel` показывает бейдж аттестации с сервера: Verified только при корне и CID, иначе logged или degraded. Нет WebGL — поверхность `scene` показывает `RENDER_NO_GPU` и статичный кадр. Живой HUD открывает шесть пунктов (Overview, Agents, Exchange, Bank, Industries, Journal) с зданий, не нижней полосой; pack `bottom_menu` по-прежнему перечисляет экраны, включая заглушку missions, которая не входит в primary nav. Каталог районов пака живёт внутри Industries; Settings в паке live, маршрут HUD его не резолвит. Companion вырезан из пака: нет экрана, нет кодов, нет фильтра журнала и нет входа из настроек.

---

## 4. Экраны после перехода на ETH

**`bank`.** Дневной лимит — свидетель `bank_daily_limit_live` (лестница банка и доля глубины пула). Если связала глубина — `BANK_LIMIT_FROM_DEPTH` рядом с причиной. Если исчерпан — `BANK_DAILY_LIMIT_REACHED`. Строка курса — `state.mint_rate` из снимка. Нет поля — строка не подписывает якорь как текущий курс; потолок якоря остаётся отдельной строкой. Коды `MINT_RATE_CAPPED` и `STALE_PRICE`. Спот пула `CORP/ETH` на полях банка запрещён (`L156`). На выводе identity идёт до кассы: демо, кошелёк, сеть.

**`exchange`.** Витрина показывает интервал итога в Capital (`exchange_quote_capital_bps`): vault, иммутабельный `creatorTaxBps`, лишняя нога как интервал. Поля `kind=route` нет. Неоценённая нога — `EXCHANGE_HOP_UNAVAILABLE`, маршрут не подставляется (`L157`). Review/Confirm не открывается, пока hop не оценён.

---

## 5. Возвращение после оффлайна

Экран показывает часы догона этого города, если снимок их публикует. Пока сервер поле не пишет, на экране нет чисел каталога и нет суммы: одна строка, что сервер уже догнал город. Кнопка только закрывает экран.

Чего нет: ни одного `commit:*`; нет покупки часов догона. Окно оффлайна — собственность ветки MSFT (`DESIGN.md` §4.2 и §11). Продажа часов на этом экране обошла бы ветку. Держит `L154`. Кнопка — `navigate` дальше.

---

## 6. Онбординг демо-города

Снят владельцем (причина пака в `docs/CONTENT.md`): экрана `onboarding_demo`, его шести `flow_onboard_*` и автозапуска на демо-входе нет. Демо-город открывается сразу в HUD; барьер демо не ослаблен (`L153` держит любой будущий экран с `demo_flow`). Замена — быстрый гайд по HUD, концепция в `docs/reports/QUICK_GUIDE_CONCEPT.md`, в паке его пока нет.

---

## 7. Кошелёк

Четыре состояния на `LoginRoot` (живой вход) и топбаре; pack-экран `wallet_connect` не второй логин:

- не подключён — `WALLET_NOT_CONNECTED`;
- чужая сеть — `WALLET_WRONG_CHAIN` (не тот же текст, что «не подключён»);
- подключается — `spinner_inline`, без смены числа;
- подключён — балансы `$CORP` и шести Stock Tokens из снимка; нет чтения — `—`, не ноль. Ноль только если сервер прочитал ноль.

`$CORP` в топбаре серый без кошелька; клик ведёт в банк. На кнопках, которые двигают ценность, кошелёк стоит после демо-гарда и раньше чужой сети: демо-игрока не отправляют подключать кошелёк.

---

## 8. Настройки

Строки `settings_rows`: язык, звук, точные числа вместо SI, анимация тика — `v1=live`, `client_only`. Отключить кошелёк — `wallet`. Сбросить демо — без траты. HUD не открывает Settings как destination.

---

## 9. Прогрессия, фрагменты и призы

Закрытие четырёх pending `owner=T9`.

- **Прогрессия.** Дерево узлов тира — `district_card`, коды `TIER_NOT_UNLOCKED`, `STAKE_MULT_SHORT`, `NODE_SIDE_LOCKED`, `MERGE_MATCHING_BLOCKED`. Не `RESEARCH`.
- **Фрагменты.** Клейм живой на `district_card` (`fragment_claim_live`) после settlement окна `fragment_window_city_days`. Коды `FRAGMENT_*` на этой карточке.
- **Призы.** Клейм `live` (`leaderboard_claim_live`). Коды `PRIZE_*` на `leaderboard` всё равно показаны. Состав корзины и срок периода — из пака. Пустой пул и непокрытый клейм — следствия, не вывод владельца. Плашка протокола на карточке города отдельно от Treasury.
Новый pending закрыт: `BUILD_TILE_ILLEGAL` остаётся в реестре отказов; посадка снята.

---

## Расхождения `R-T9-*`

| ID | Суть | Рекомендация |
|---|---|---|
| `R-T9-1` | Legacy visual wording once called `RESEARCH` a stub; скоуп `DESIGN.md` §11 включает три узла Grid / Tools / Handbook | Канон скоупа — §11. Visual wording — `docs/reports/HUD_DESIGN_SYSTEM.md`: `RESEARCH` живой на трёх узлах, заглушка — `MISSIONS` |
| `R-T9-2` | Приёмка: `wallet` был снят с `bank_withdraw` (и с открытия района / клеймов), потому что вся identity сидела в одном тире, а `L150` запрещает два blocking в минимуме. Реальный игрок без кошелька видел сиюминутный код вместо `WALLET_NOT_CONNECTED` — дыра реестра, не канон | Подтиры identity: демо, кошелёк, чужая сеть. Гейт `wallet` возвращён на движение ценности. `L165`/`L166` держат это |
| `R-T9-3` | Правка `DESIGN.md` не обязательна для механик; экраны — слой HUD | Одна фраза-ссылка в §7.2 и §11, разделы не переписываются |
| `R-T9-4` | `L147` в первой редакции проверяло резолв, а не смысл; поля ссылались на посторонние ключи | Закрыто: `value_kind` плюс семейства единиц плюс `L167`/`L168`. Фикция как `derived_from` запрещена |

Пятнадцать экранов против тринадцати пунктов BRIEF — расширение §2, не `R-T9-*`.

---

## Что передано дальше

- **T10** — грамматика планировки закрыта; отказ тайла — `BUILD_TILE_ILLEGAL`.
- **T11** — проводка тика и догон оффлайна; экран возвращения только показывает уже посчитанный потолок. Реестр `state_sources` — список того, что проводка тика обязана отдавать.
- **T12** — контракт REST/WS под эти экраны и коды ошибок.
