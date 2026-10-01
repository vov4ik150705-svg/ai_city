# Corporator — книжка «How the island works»

Черновик концепции для мокапов, 2026-09-30, редакция 2: ответы владельца учтены. Это не ТЗ кода и не канон механики.

Вид берём из утверждённого quick guide: `hud/quick-guide-reference/README.md`, `00-approved-mockup.png`, `bank-ready/`. Факты — из `docs/public/*.md`, числа — из пака. Если здесь и там разошлось, прав пак.

## Решения владельца (2026-09-30)

| # | Вопрос | Решение |
|---|---|---|
| 1 | Название | на моё усмотрение → раздел **In pictures**, книжка **How the island works** |
| 2 | Где живёт | одна страница `/docs`: сначала открывается книжка, переключатель открывает техническую документацию |
| 3 | Объём | короткое издание, **11 страниц** |
| 4 | Телефон | вертикальная раскладка, арт открывается по тапу (§3.5) |
| 5 | Язык | **только английский**: текст, пометки в арте, сайт |
| 6 | Доля студии | показываем тонкую трубу «studio» (стр. 6) |
| 7 | Образ Payroll | **бак** — водонапорный бак на ножках |
| 8 | Прощание героя | Engineer машет на стр. 11 — **обязательно**, это конец книжки |
| 9 | Мокапы | делает **другой агент** по §9 этого документа |

Короткое издание собрано так, чтобы вместить решение 6. Стр. «Everything is already built» слита с обложкой: спящие и горящие окна показывают ту же мысль. Освободившееся место заняла «What fills the tank», где и видна труба студии. Остальные страницы полной версии отложены (§8).

---

## 0. Идея

Документация Corporator — одна страница с двумя режимами:

- **In pictures** открывается первым. Это книжка с картинками на 11 страниц, читается минуты за три. Она объясняет, **как устроен мир игры**, людям, которые не хотят читать справочник.
- **Handbook** — существующий справочник `docs/public`: точные правила, формулы, коды, контракты. Открывается переключателем.

Quick guide отвечает на вопрос «куда нажать в первый час». Книжка отвечает на вопрос «почему здесь всё устроено именно так».

| | Quick guide | In pictures | Handbook |
|---|---|---|---|
| Где | в игре, при первом входе | сайт, `/docs`, открывается первым | сайт, `/docs`, переключателем |
| Вопрос | куда пойти и что нажать | как это устроено и зачем | сколько точно и по какой формуле |
| Объём | 8 страниц | 11 страниц | 7 глав |

**Главное правило.** Кто только смотрел картинки и не прочитал ни слова, всё равно должен унести шесть мыслей:

1. Остров один на всех, здания уже стоят, их открывают. (стр. 1)
2. Здания работают, только когда в них правильные люди. (стр. 2–3)
3. Всем городам платят из одного общего бака, и он конечен. (стр. 5–6)
4. За каждой фишкой Capital лежит монета `$CORP`; войти дешевле, чем выйти. (стр. 4, 7)
5. Стейк открывает район, токен остаётся вашим, рост акции вам не платит. (стр. 8–9)
6. Призы достаются лучше устроенным городам, а не самым большим. (стр. 10)

---

## 1. Одна страница, два режима

### 1.1 Переключатель

Под шапкой сайта, над контентом, стоит тонкая полоса с переключателем из двух слов. В обоих режимах она на одном и том же месте:

```
 CORPORATOR  Game  Leaderboard  Rating  Docs          ← шапка сайта
 ─────────────────────────────────────────────────────────────
   In pictures   ·   Handbook                          ← переключатель
   ‾‾‾‾‾‾‾‾‾‾‾   активный режим подчёркнут рукописной линией HandRule
```

- `/docs` всегда открывается в режиме **In pictures**, на обложке.
- Страница книжки хранится в якоре: `/docs#the-tank`. Ссылкой на страницу можно поделиться, перезагрузка не сбрасывает место.
- **Handbook** переключает ту же страницу на справочник: слева оглавление глав, в центре текст, справа «On this page», как сейчас. Адрес меняется на `/docs/<chapter>`, переключатель остаётся сверху.
- Обратно — клик по **In pictures**: книжка открывается там, где её оставили.

### 1.2 Мосты

- Внизу каждой страницы книжки, после сноски, стоит ссылка «More in the handbook → Payroll». Она переключает режим сразу на нужный раздел справочника.
- В lead главы Getting Started добавляется одна фраза: «Rather look than read? See the island in pictures →».

### 1.3 Техническая заметка (код не трогаем)

- Сейчас `/docs` — это глава Getting Started (`INDEX_CHAPTER` в `apps/www/src/docs/paths.ts`). Ей нужен свой адрес, например `/docs/getting-started`, а `chapterHref("index")` должен вести туда. Внутренние ссылки `index.md#…` в `docs/public` продолжат работать через `chapterHref`.
- `DocsRoute` на `/docs` рисует книжку, на `/docs/<chapter>` — справочник. Переключатель — общий компонент над обоими.
- `scrollToId` по якорю работает только в режиме справочника. В книжке якорь выбирает страницу.

---

## 2. Голос

**Как рассказываем.** Как хорошая книжка с картинками для взрослых: спокойный рассказчик, короткие фразы, один образ на страницу. Никого не уговариваем и ничего не продаём. Теплота и юмор — в рисунке, а не в тексте.

**Заголовок — как название главы в сказке.** Простая фраза, которую хочется прочитать вслух. Можно с маленьким поворотом, но без лозунгов и пар антонимов.

| Так | Не так |
|---|---|
| One island, many cities | BUILD YOUR EMPIRE |
| Everyone is paid from one tank | SHARED PAYROLL, UNLIMITED POTENTIAL |
| The key stays yours | STAKE TO EARN |
| Not the biggest, the best run | CLIMB THE LEADERBOARD AND WIN BIG |
| Before you go in | START EARNING TODAY |

**Приёмы.**

- Сквозной герой — тот же Engineer в каске, что в quick guide. Он есть на каждой странице, иногда крошечный. В тексте о нём не говорится. На стр. 1–10 он только работает. На стр. 11 он впервые оборачивается к читателю и машет на прощание: книжка заканчивается этим жестом.
- Образы переходят со страницы на страницу. Бак появляется на стр. 5, наполняется на стр. 6. Ключ вставляют на стр. 8, вынимают на стр. 9. Остров обложки возвращается вечером на стр. 11.

**Слова.** Игровые названия не упрощаем: Bank, Workshop, Engineer, Capital, `$CORP`, Payroll, Influence, stake. Всё вокруг — обычные слова: «hour», а не «tick»; «tank», а не «fund with a ratio»; «key» рядом со «stake»; «ticket» рядом с «voucher».

**Нельзя.** Обещать доход (earn, profit, yield), рисовать графики вверх рядом с игроком, дождь монет, казино, кости, рулетку. Никаких сумм в долларах, восклицательных знаков, эмодзи, «Let's dive in», «unlock your potential», «journey», «seamless».

---

## 3. Вид

### 3.1 Панель

Геометрия та же, что у BANK (`bank-ready/HANDOFF.md`): база 1672 × 941, панель 1400 × 860, белая, рамка 2 px `#B7DCFF`, радиус 24 px. Композиция масштабируется целиком под свободную высоту под переключателем. Вокруг панели — светлое небо сайта с редкими рисованными облаками.

```
┌──────────────────────────────────────────────────────────────┐
│ [◇] CORPORATOR                                               │
│                                                              │
│ 05 — MONEY                                                   │
│ Everyone is paid from one tank        ← Caveat 700, 76 px    │
│ Абзац 1–2 предложения,                                       │
│ колонка 350 px.                РИСУНОК (один PNG с пометками) │
│                                                              │
│      Сноска одной строкой · More in the handbook → Payroll   │
│ ──────────────────────────────────────────────────────────── │
│ [←]              ● ● ● ● ● ○ ○ ○ ○ ○ ○                  [→] Next │
│                           5 / 11                             │
└──────────────────────────────────────────────────────────────┘
```

Чем панель отличается от quick guide:

- В шапке панели только знак CORPORATOR. Skip guide и крестика нет: это страница, а не окно поверх игры.
- 11 точек, как 8 в quick guide. Точки кликабельны, `←` / `→` и клавиши Left / Right листают страницы.
- После сноски стоит ссылка в справочник, синим, Roboto 400.
- На последней странице вместо Next две кнопки: синяя «Play the demo» и контурная «Read the handbook». Вторая переключает режим.

### 3.2 Рисунок: два слоя

Порядок работы утверждён для quick guide. Одна страница — один PNG 1672 × 941 с прозрачным фоном. Пометки, стрелки и пунктир нарисованы внутри арта. Поверх накладываются только четыре блока: eyebrow, заголовок, абзац и сноска.

Главное правило рисунка книжки:

> **Что есть в игре — объёмно и в своём цвете. Чем мы объясняем — синим пером.**

- **Слой игры.** Здания, остров, пять ролей, монеты `$CORP`, фишки Capital — low-poly диорама по листам `media/kit/`. Правила `media/MEDIA_GENERATION_RULE.md` соблюдаются: вывески побуквенно (§3), приметы ролей (§6.2), на City Hall звезда, а не часы.
- **Слой объяснения.** Бак, трубы, талон, ключ, весы, часы, пометки — тонкая линия `#0A5CF8` и `#0B1236`, лёгкая штриховка, бледно-голубые тинты. Так в quick guide нарисованы пометки и зарисовки HUD.

Так читатель сразу отличает то, что увидит в игре, от метафоры. Бака Payroll на острове нет, и рисунок этого не скрывает.

### 3.3 Словарь образов

| Понятие | Образ | Слой |
|---|---|---|
| `$CORP` | тёмная металлическая монета с серебристым «C» | игра |
| Capital | стопка графитовых фишек с синей кромкой | игра |
| Сток-токен | монета со светлым ободком, тикер написан пером рядом | игра + перо |
| Городской час | рисованные круглые часы (не на City Hall) | перо |
| Листок на оплату | синий листок со значком фишки | перо |
| Причина простоя | серый стикер | перо |
| Payroll | водонапорный бак на ножках, от него трубы | перо |
| Хранилище vault | сейф в разрезе, монеты на полках | перо |
| Сгорание | язычок пламени | перо |
| Сбор с торговли | шлагбаум, с которого капает | перо |
| Стейк | ключ в замке | перо |
| Кулдаун | отрывной календарь | перо |
| Заморозка района | песочные часы, синий иней на крыше | перо |
| Талон вывода | билетик с песочными часами | перо |
| Influence | весы | перо |
| Приз | маленький пьедестал с монетами токенов | перо |

### 3.4 Шрифты, цвет, лимиты

- Eyebrow, заголовок и пометки в арте — **Caveat**, как в `apps/www/src/docs/handbook/fonts.css`. Заголовок в обычном регистре.
- Абзац и сноска — Roboto, размеры из `bank-ready/HANDOFF.md`.
- Синий `#0A5CF8`, тёмно-синий `#0B1236`. Жёлтый — только свет в окнах и искра. Много белого.

| Элемент | Лимит |
|---|---|
| Заголовок | 2–6 слов |
| Абзац | ≤ 35 слов, 1–2 предложения |
| Сноска | ≤ 20 слов |
| Пометки в арте | ≤ 4, по ≤ 6 слов; исключение — карта районов на стр. 8 |
| Пустые зоны арта | левый верх ≈ 430 × 300 px панели и нижняя полоса над разделителем |

### 3.5 Телефон

При ширине ≤ 900 px страница становится вертикальной:

1. переключатель режимов;
2. eyebrow, заголовок, абзац;
3. арт на всю ширину. По тапу он открывается на весь экран с горизонтальной прокруткой и щипком для увеличения, закрывается крестиком или свайпом вниз;
4. сноска и ссылка в справочник;
5. точки и стрелки, прилипшие к низу экрана. Листать можно и свайпом по тексту.

Отсюда требование к арту: пометки рисуются крупно, от ~34 px высоты строки на холсте 1672, и не больше четырёх. На ширине 375 px они должны угадываться без увеличения, а читаться — после тапа.

---

## 4. Страницы

| # | Eyebrow | Заголовок | Мысль | Якорь |
|---|---|---|---|---|
| 1 | 01 — THE ISLAND | One island, many cities | остров общий, здания спят, города разные | `#island` |
| 2 | 02 — PEOPLE | Everyone has their own place | пять профессий; своё, соседнее, чужое место | `#people` |
| 3 | 03 — PEOPLE | Every hour, a shift | листок на оплату или записка «почему» | `#shift` |
| 4 | 04 — MONEY | Three kinds of money | `$CORP`, Capital с монетой за ним, сток-токены | `#money` |
| 5 | 05 — MONEY | Everyone is paid from one tank | Payroll общий и конечный | `#the-tank` |
| 6 | 06 — MONEY | What fills the tank | траты, сбор с торговли, куда он делится | `#fills` |
| 7 | 07 — MONEY | The way home | банк, часы, талон, вход дешевле выхода | `#way-home` |
| 8 | 08 — DISTRICTS | Six districts, six keys | тикер открывает район | `#keys` |
| 9 | 09 — DISTRICTS | The key stays yours | стейк в контракте, кулдаун, акция не платит | `#your-key` |
| 10 | 10 — SEASONS | Not the biggest, the best run | Influence и призы | `#seasons` |
| 11 | 11 — BEFORE YOU GO | Before you go in | честные границы, демо | `#before` |

Числа в тексте стоят как `{плейсхолдер}`, нынешние значения и источники — в §5.

---

### Страница 1 — One island, many cities

**Eyebrow:** 01 — THE ISLAND

**Заголовок:** One island, many cities

**Абзац:** Everyone plays on the same island, and every building is already standing, asleep until you open it. What's different is the city behind it: who you hire, what you open and how well it runs.

**Рисунок.** В центре остров Terra, крупно, ракурс как в `media/island/island_03_tight.png`, облака и водопады снизу. Окна горят только у Workshop, Power Node и Bank, остальные здания тёмные. Маленький Engineer стоит на площади.

За островом, со сдвигом вправо и вверх, два контура того же острова синим пером, как листы кальки в стопке. На одном жёлтыми пятнышками «горят» Exchange и Finance Tower, на другом — Flagship Store.

**Пометки**
1. у стопки контуров — «the same island for everyone»;
2. у тёмного здания — «dark windows: asleep until you open it»;
3. у пятнышек на кальке — «different lights, different cities».

**Сноска:** You never place or build anything. The map was drawn once, by hand.

**Ссылка:** More in the handbook → Your City (`city.md`).

**Alt:** A floating island city with only a few buildings lit, and two pencil outlines of the same island behind it, lit in different places.

---

### Страница 2 — Everyone has their own place

**Eyebrow:** 02 — PEOPLE

**Заголовок:** Everyone has their own place

**Абзац:** You hire agents, and each has one of five jobs. In their own building an agent works at full strength, in a related one at {neighbour_pct}%. Anywhere else, they just stand there.

**Рисунок.** Три двери в ряд, в каждой один и тот же Engineer:

1. **Workshop.** Engineer у станка, окна горят. Над ним рисованный стакан, полный до края.
2. **AI Research Center.** Engineer работает, стакан налит на {neighbour_pct}%.
3. **Bank.** Engineer стоит в дверях с ключом и разводит руками. Стакан пустой, рядом серый стикер.

Вдоль нижнего края арта — лента из пяти маленьких портретов по пояс: Engineer, Logistician, Trader, Scientist, Manager.

**Пометки**
1. у первого стакана — «home: {home_pct}%»;
2. у второго — «neighbour: {neighbour_pct}%»;
3. у стикера — «not his job, no work»;
4. у ленты портретов — «five jobs, each has its buildings».

**Сноска:** No AI inside. Agents follow the same fixed rules, every time.

**Ссылка:** More in the handbook → Roles (`agents.md#roles`).

**Alt:** The same engineer in three doorways, working at full strength, at part strength and standing idle in a bank; five small portraits below.

---

### Страница 3 — Every hour, a shift

**Eyebrow:** 03 — PEOPLE

**Заголовок:** Every hour, a shift

**Абзац:** Once every city hour the city takes stock. Everyone who worked hands in a pay slip. Everyone who couldn't leaves a note saying why.

**Рисунок.** Сверху висят рисованные часы, стрелка только что сдвинулась на час, вокруг три коротких штриха, как звон. Под часами простой рисованный ящик-приёмник. К нему подходят трое:

- Engineer из Workshop опускает синий листок со значком фишки;
- Engineer из Power Node опускает второй листок;
- Logistician у Fleet Yard с тёмными окнами клеит на ящик серый стикер.

**Пометки**
1. у синего листка — «pay slip: I worked»;
2. у стикера — «no energy — the note says why»;
3. у часов — «a city hour ≈ {tick_minutes} minutes».

**Сноска:** Offline, your city works for up to {offline_hours} hours. After that, hours are skipped, not saved.

**Ссылка:** More in the handbook → How a seat earns (`agents.md#how-a-seat-earns`).

**Alt:** A clock strikes the hour; two engineers drop blue pay slips into a box while a third worker sticks a grey note on it.

---

### Страница 4 — Three kinds of money

**Eyebrow:** 04 — MONEY

**Заголовок:** Three kinds of money

**Абзац:** $CORP lives in your wallet. Capital is the city's own money, and every chip has a $CORP coin behind it in the vault. Stock tokens are shares like NVDA that open districts.

**Рисунок — три экспоната, как в музее.** У каждого синяя табличка-подпись.

1. **Кошелёк** из тёмной кожи, приоткрыт, внутри монета `$CORP`.
2. **Стопка фишек Capital** стоит на маленьком сейфе в разрезе. От каждой фишки вниз к монете на полке сейфа тянется тонкая синяя нитка.
3. **Шесть монет сток-токенов** веером, над каждой пером написан тикер: NVDA, TSLA, AMZN, AAPL, MSFT, COIN.

**Пометки**
1. у кошелька — «yours, tradeable»;
2. у ниток — «a coin behind every chip»;
3. у веера — «open districts, come as prizes».

**Сноска:** Capital isn't a token. You can't sell it or send it to a friend.

**Ссылка:** More in the handbook → The backing rule (`economy.md#the-backing-rule`).

**Alt:** A wallet with a coin, a stack of chips standing on a small safe with a thread from each chip to a coin, and a fan of six stock-token coins.

---

### Страница 5 — Everyone is paid from one tank

**Eyebrow:** 05 — MONEY

**Заголовок:** Everyone is paid from one tank

**Абзац:** Every city's people are paid from one shared fund, Payroll. Each hour it pours out a budget and splits it by what each seat asked for. A quiet hour means more for everyone, a busy one less.

**Рисунок — сердце книжки.** Наверху большой водонапорный бак на ножках, синим пером, на боку от руки написано «Payroll». От него вниз расходятся три трубы к трём маленьким островам: один цветной (ваш), два контуром. Под трубами стоят стаканы.

Внизу две маленькие сценки рядом:

- **quiet hour** — три стакана, все переливаются через край;
- **busy hour** — девять стаканов, все налиты до одной отметки, примерно наполовину.

**Пометки**
1. у бака — «one tank for every city»;
2. у тихой сценки — «quiet hour: more for everyone»;
3. у людной — «busy hour: less, same share»;
4. у крана — «never zero while there's water».

**Сноска:** Early on the tank pours extra: up to ×{boost_launch} for the first {boost_launch_days} city days, then up to ×{boost}. Only while it holds enough.

Сноска длиннее лимита (26 слов). Если не влезет в строку, вторая фраза уходит: «Early on, the tank pours extra — but only while it holds enough.»

**Ссылка:** More in the handbook → Payroll (`economy.md#payroll`).

**Alt:** A water tower labelled Payroll feeds three islands; in a quiet hour three cups overflow, in a busy hour nine cups are equally half full.

---

### Страница 6 — What fills the tank

**Eyebrow:** 06 — MONEY

**Заголовок:** What fills the tank

**Абзац:** Two streams. When anyone spends Capital, part of it burns and the rest flows back into the tank. And every $CORP trade leaves a small toll — half of it ends up here too.

**Рисунок.** В центре тот же бак со стр. 5, поменьше.

- **Слева — траты.** Рука отдаёт стопку из десяти фишек. Четыре уходят в маленький язычок пламени, шесть катятся по трубе в бак.
- **Справа — сделки.** Рисованный пруд-обменник: монеты `$CORP` и ETH кружат друг вокруг друга. Под прудом шлагбаум, с него капает струйка. Она делится на четыре трубы разной толщины:
  - самая толстая — в бак;
  - средняя — в стеклянную банку;
  - тонкая — к маленькому пьедесталу;
  - такая же тонкая — к маленькому домику с подписью от руки «studio».

**Пометки**
1. у пламени — «{burn_pct}% burns»;
2. у трубы в бак — «{spend_fund_pct}% back to the tank»;
3. у шлагбаума — «every trade leaves {creator_tax_pct}%»;
4. у развилки труб — «half to the tank, the rest to prizes and the studio».

**Сноска:** When the tank is over-full, the extra goes to a reserve and drips back slowly.

**Ссылка:** More in the handbook → How value moves (`economy.md#how-value-moves`).

**Alt:** Chips split between a small flame and a pipe into the tank; a toll gate under a trading pond drips into four pipes: the tank, a prize jar, a podium and a small studio house.

---

### Страница 7 — The way home

**Eyebrow:** 07 — MONEY

**Заголовок:** The way home

**Абзац:** Want your $CORP back? The Bank turns Capital into a ticket that's good for one city hour. Take it to your wallet in time, and the coins are yours.

**Рисунок.** Bank по листу, на двери рисованная табличка с часами работы. У окошка стопка фишек превращается в билетик с песочными часами. Рука несёт билетик по пунктиру к кошельку. Перед банком турникет с маленьким счётчиком.

Сбоку крошечная сценка: песочные часы пусты, билетик порван пополам, фишки стопкой возвращаются в город.

**Пометки**
1. у таблички — «open {bank_open}–{bank_close}, closed Sundays»;
2. у турникета — «a daily limit, shared by all»;
3. у билетика — «voucher: one hour to use it»;
4. у сценки — «missed it? Capital comes back».

**Сноска:** Coming in is always cheaper than going out: a full round trip costs about {round_trip_pct}% in fees.

**Ссылка:** More in the handbook → The Bank (`economy.md#the-bank`).

**Alt:** At a bank window chips turn into a ticket with an hourglass, and a hand carries it along a path to a wallet.

---

### Страница 8 — Six districts, six keys

**Eyebrow:** 08 — DISTRICTS

**Заголовок:** Six districts, six keys

**Абзац:** The island has six districts, and each one has a key: a stock token. Stake NVDA, and Compute opens. TSLA opens Energy, and so on.

**Рисунок — карта районов.** Остров сверху, упрощённо. По кругу стоят шесть маяков по листам, у каждого видна своя вывеска:

- AI Research Center — `NVIDIA`;
- Energy Plant — `TESLA`;
- Logistics Hub — `amazon`;
- Flagship Store — знак Apple;
- Cloud Campus — `MICROSOFT`;
- Finance Tower — `COINBASE`.

Перед каждым маяком рисованный замок со вставленным ключом. Головка ключа — монета сток-токена.

**Пометки (карта, исключение из лимита)**
- по кругу: «NVDA → Compute», «TSLA → Energy», «AMZN → Logistics», «AAPL → Consumer», «MSFT → Automation», «COIN → Finance»;
- в центре: «a key opens a beacon and its bonus».

**Сноска:** Opening a district costs no Capital, only the stake. Demo cities can't open districts.

**Ссылка:** More in the handbook → The six districts (`industries.md#the-six-districts`).

**Alt:** Six district buildings in a ring around the island, each with a lock and a key shaped like a stock-token coin.

---

### Страница 9 — The key stays yours

**Eyebrow:** 09 — DISTRICTS

**Заголовок:** The key stays yours

**Абзац:** A staked token doesn't go to the game. It waits in a contract, and you can ask for it back at any time. It comes home after {unstake_days} city days.

**Рисунок — две дорожки с одного места.** Слева рука вынимает ключ из замка у Energy Plant. Дальше дорожка делится:

- **короткая** возвращается к Energy Plant: песочные часы, потом окна гаснут, по крыше бежит синий иней;
- **длинная** идёт через отрывной календарь с толстой пачкой листков к кошельку, куда ложится ключ.

В правом верхнем углу отдельная сценка: на рисованном графике TSLA линия идёт вверх, от неё стрелка к карману Engineer, и эта стрелка перечёркнута.

**Пометки**
1. у замка — «in a contract, not with us»;
2. у короткой дорожки — «a day later the district falls asleep»;
3. у календаря — «{unstake_days} city days, then back in your wallet»;
4. у графика — «the stock going up doesn't pay you».

**Сноска:** You can't cancel an unstake. Asking again while tokens are cooling restarts the clock.

**Ссылка:** More in the handbook → Unstaking and the cooldown (`industries.md#unstaking-and-the-cooldown`).

**Alt:** A key taken from a lock leads two ways: a short path where the district frosts over after a day, and a long one through a calendar to a wallet.

---

### Страница 10 — Not the biggest, the best run

**Eyebrow:** 10 — SEASONS

**Заголовок:** Not the biggest, the best run

**Абзац:** Every day your city scores Influence: how much Payroll it got for every Capital it has spent. The best-run cities, not the biggest, share prizes in stock tokens.

**Рисунок.** Слева большие рисованные весы.

- На левой чаше маленький аккуратный кусочек острова: три здания, все окна горят, рядом стопка «got».
- На правой — большой кусок: много зданий, половина тёмных, рядом гора фишек «spent» и маленькая стопка «got».

Весы склонились к маленькому. Справа невысокий пьедестал из {prize_top_n} ступенек, на каждой стопка монет токенов: на первой самая высокая, на последней маленькая, но есть.

**Пометки**
1. под чашами — «got ÷ spent»;
2. у маленькой чаши — «size alone doesn't win»;
3. у пьедестала — «the top {prize_top_n} share the prize»;
4. у ступенек — «every {period_days} city days».

**Сноска:** Prizes are stock tokens bought with the trading toll, not other players' Capital. You claim them yourself.

**Ссылка:** More in the handbook → Seasons and Rewards (`seasons.md`).

**Alt:** Scales tip toward a small, fully lit piece of island; beside them a ten-step podium with shrinking stacks of tokens.

---

### Страница 11 — Before you go in

**Eyebrow:** 11 — BEFORE YOU GO

**Заголовок:** Before you go in

**Абзац:** Nobody here promises a profit. Prices move both ways, the tank is shared and finite, and the Bank keeps hours. Try the demo city first: no wallet, nothing at stake.

**Рисунок.** Остров со стр. 1, но вечером: тёплое небо, окна горят. У края острова рисованный указатель из двух досок: «Demo» и «Handbook». Engineer закрывает за собой дверь Workshop, оборачивается к читателю и машет свободной рукой, ключ на плече. Это единственный раз за книжку, когда он смотрит на нас. Он крупнее, чем на прошлых страницах, и стоит на переднем плане, чтобы жест читался даже на телефоне. По краям три маленьких синих значка из прошлых страниц:

- график с двумя стрелками, вверх и вниз;
- бак с отметкой уровня;
- табличка банка с часами.

**Пометки**
1. у графика — «prices go both ways»;
2. у бака — «shared and finite»;
3. у указателя — «start here».

**Сноска:** Corporator hasn't launched yet. This book tells the rules as they stand today.

**Низ панели:** вместо Next — «Play the demo» и «Read the handbook».

**Ссылка:** More in the handbook → Risks (`protocol.md#risks`).

**Alt:** The island at dusk with a signpost to Demo and Handbook; the engineer waves goodbye from the Workshop door.

---

## 5. Числа и откуда

Абзацы и сноски берут числа из пака при сборке сайта: `apps/www` уже импортирует `content/params` (`src/data/shell.ts` → `launch.json`). Числа, вписанные в пометки арта, при изменении пака требуют перерисовки картинки. Они отмечены в последнем столбце.

| Плейсхолдер | Сейчас | Источник | Стр. | В арте |
|---|---|---|---|:-:|
| `home_pct` / `neighbour_pct` | 100 / 60 | `economy.affinity_home_bps`, `affinity_neighbour_bps` | 2 | да |
| `tick_minutes` | 62½ | `time.city_day_real_hours` 25 ÷ 24 | 3 | да |
| `offline_hours` | 12 | `time.offline_cap_city_hours_base` | 3 | |
| `boost_launch` / `boost_launch_days` / `boost` | 8 / 7 / 3 | `economy.payroll_boost_launch_bps`, `payroll_boost_launch_city_days`, `payroll_boost_bps` | 5 | |
| `burn_pct` / `spend_fund_pct` | 40 / 60 | `economy.spend_burn_bps` | 6 | да |
| `creator_tax_pct` | 2 | `economy.creator_tax_bps` 200 | 6 | да |
| «половина в бак», толщины четырёх труб | 1.0 / 0.6 / 0.2 / 0.2 % оборота | `generated.economy.fee_split` | 6 | да, словами |
| `bank_open` / `bank_close` | 08:00 / 20:00 | `time.bank_open_hour`, `bank_close_hour` | 7 | да |
| срок талона | 1 городской час | `api.voucher_ttl_s` = `tick_length_real_seconds` | 7 | да, словами |
| `round_trip_pct` | 14.45 | `round_trip_cost_bps` — вывод `python content/build.py` | 7 | |
| `unstake_days` | 30 | `economy.unstake_cooldown_city_days` | 9 | да |
| сутки до заморозки | 24 ч | `economy.unstake_grace_city_hours` | 9 | да, словами |
| `prize_top_n` | 10 | `seasons.prize_top_n` | 10 | да, и ступени |
| `period_days` | 30 | `balance.season_city_days` ÷ `seasons.prize_periods_per_season` | 10 | да |

Столбец «Сейчас» переписан из публичных глав. Перед мокапом значения снимаются командой с `python content/build.py`.

---

## 6. Что книжка намеренно не рассказывает

Всё это — в справочнике, куда ведут ссылки «More in the handbook».

- Формулы: запрос места, бюджет дня, курс минта, Influence, Zipf.
- Energy и Compute по отдельности (в книжке остался только стикер «no energy»), связи зданий, задачи, черты, XP.
- Тиры, узлы, синергии, мерджи, исследования, City Level.
- Квалификация приза, Farm и фрагменты, порядок claim.
- Уровень банка, долю фонда, покрытие vault, то, что депозит не ограничивает вывод.
- Контракты, роли, prepare → sign → confirm, Merkle и IPFS.
- Коды отказов и простоев. В книжке они только словами на стикерах.

**Красные линии рисунка и текста.**

- Нет «построил — получил».
- Нет роста акции рядом с карманом игрока, кроме перечёркнутой стрелки на стр. 9.
- Нет сумм в долларах. Нет казино, костей и рулетки.
- Нет юнитов, машин и прохожих на острове: люди — только пять ролей и только как иллюстрация.
- Нет 19-го экономического здания. Neon Residence стоит на острове как декор, и в тексте о ней ничего не сказано.
- Нет часов на City Hall.
- Логотип `$CORP` генератор сам не рисует: монеты — «dark metal, silver C», как в quick guide.

---

## 7. Промпты для рисунков

**Процесс** — утверждённый для quick guide (`hud/quick-guide-reference/README.md`): сначала окончательный арт, потом сборка панели с этим PNG и живым текстом, потом мокап скриншотом сборки. Для зданий и ролей прикладываются листы `media/kit/buildings/<id>.png` и `media/kit/roles/<id>.png`. Готовый кадр проверяется по §9 `media/MEDIA_GENERATION_RULE.md`. Исключение из H9 уже утверждено для quick guide: синие рукописные пометки входят в арт.

**Общий блок (добавляется к каждому):**

> FORMAT: 1672×941, transparent background. Keep the top-left area (about 430×300 px, starting 40 px from the left) and a thin band along the bottom completely empty for live text.
> STYLE: two layers. GAME LAYER — buildings, the floating island, the five worker roles, $CORP coins and Capital chips: stylized low-poly 3D diorama exactly as on the attached reference sheets, dark graphite masses with each building's own neon accents, warm amber windows, fine lively ink outline and light hatching as in the approved Corporator quick guide. EXPLANATION LAYER — tanks, pipes, tickets, keys, scales, clocks, arrows, dotted paths and all notes: thin hand-drawn ink in cobalt blue (#0A5CF8) and dark navy (#0B1236), light hatching, pale sky-blue tints only. Clouds: pale blue outlines with sparse soft hatching. Notes: large, thin handwritten blue script like Caveat, readable when the image is shown small, simple arrows, no glow, no stickers behind text, no thick rounded lettering. Lots of white.
> DO NOT: no photorealism, no gradients, no neon halos on notes, no extra buildings, no cars or crowds, no text except the listed notes and building signs, no clock on City Hall, never the word CORPORATOR on a building, no dollar amounts, no casino chips, dice or roulette, no rising chart next to a person except where stated.

**Стр. 1.** The floating island from the tight hero angle, centred slightly right, clouds and waterfalls below. Only the Workshop, Power Node and Bank have warm lit windows; every other building is dark. A tiny Engineer on the plaza. Behind the island, offset up-right, two blue pencil outlines of the same island like stacked tracing paper; on one, small yellow dabs mark the Exchange and Finance Tower as lit, on the other the Flagship Store. Notes: "the same island for everyone", "dark windows: asleep until you open it", "different lights, different cities".

**Стр. 2.** Three doorways side by side with the same Engineer: inside the Workshop at a machine, lit, a hand-drawn glass above filled to the brim; inside the AI Research Center working, glass filled to 60%; standing in the Bank doorway holding his wrench, shrugging, empty glass and a small grey sticky note. Along the bottom edge a strip of five small waist-up portraits: Engineer, Logistician, Trader, Scientist, Manager. Notes: "home: 100%", "neighbour: 60%", "not his job, no work", "five jobs, each has its buildings".

**Стр. 3.** A hand-drawn round clock hanging at the top, its hand just moved one hour, three short strike lines around it. Below, a simple hand-drawn collection box. An Engineer from the Workshop drops a blue paper slip with a chip icon; a second Engineer from the Power Node drops another; a Logistician beside a dark-windowed Fleet Yard sticks a grey note on the box. Notes: "pay slip: I worked", "no energy — the note says why", "a city hour ≈ 62½ minutes".

**Стр. 4.** Three objects laid out like museum exhibits, each with a small blue hand-drawn label plate: a dark leather wallet, half open, one dark metal coin with a silver C inside; a stack of graphite Capital chips standing on a small cut-away safe, a thin blue thread running from each chip down to a coin on the safe's shelf; a fan of six plain stock-token coins with pale rims, tickers handwritten above them: NVDA, TSLA, AMZN, AAPL, MSFT, COIN. Notes: "yours, tradeable", "a coin behind every chip", "open districts, come as prizes".

**Стр. 5.** A large hand-drawn water tower on legs at the top, "Payroll" handwritten on its side. Three pipes run down to three small islands, one in full colour, two as blue outlines, with cups under each pipe. Below, two small scenes side by side: "quiet hour" with three cups overflowing; "busy hour" with nine cups all filled to the same line, about half. Notes: "one tank for every city", "quiet hour: more for everyone", "busy hour: less, same share", "never zero while there's water".

**Стр. 6.** The same tower, smaller, in the centre. Left: a hand hands over a stack of ten Capital chips; four fall into a small flame, six roll down a pipe into the tank. Right: a small hand-drawn trading pond where a dark $CORP coin and an ETH coin circle each other; under it a toll barrier drips a thin stream that splits into four pipes: the thickest into the tank, a medium one into a glass jar of stock-token coins, two thin ones to a small podium and to a small house labelled "studio". Notes: "40% burns", "60% back to the tank", "every trade leaves 2%", "half to the tank, the rest to prizes and the studio".

**Стр. 7.** The Bank exactly as on its sheet, a small hand-drawn sign with opening hours on the door. At the window a stack of chips turns into a paper ticket with a small hourglass; a hand carries the ticket along a dotted path to a wallet. A turnstile with a tiny counter in front of the bank. Small side scene: an empty hourglass, a ticket torn in half, a stack of chips walking back into the city. Notes: "open 08:00–20:00, closed Sundays", "a daily limit, shared by all", "voucher: one hour to use it", "missed it? Capital comes back".

**Стр. 8.** The island seen from above, simplified. In a ring around it, the six district beacons exactly as on their sheets with each sign visible in place: AI Research Center "NVIDIA", Energy Plant "TESLA", Logistics Hub "amazon", Flagship Store (Apple mark, no text), Cloud Campus "MICROSOFT", Finance Tower "COINBASE". In front of each a hand-drawn padlock with a key inserted; each key's head is a plain stock-token coin. Notes: "NVDA → Compute", "TSLA → Energy", "AMZN → Logistics", "AAPL → Consumer", "MSFT → Automation", "COIN → Finance", and in the centre "a key opens a beacon and its bonus".

**Стр. 9.** A hand pulls a key from a padlock by the Energy Plant. The path splits: a short branch leads back to the Energy Plant with an hourglass, its windows going dark and blue frost lines on the roof; a long branch runs through a tear-off calendar thick with pages to a wallet where the key drops in. In the top-right corner a small hand-drawn chart with a rising line and an arrow from it toward an Engineer's pocket, the arrow crossed out. Notes: "in a contract, not with us", "a day later the district falls asleep", "30 city days, then back in your wallet", "the stock going up doesn't pay you".

**Стр. 10.** Left: large hand-drawn scales. Left pan: a small tidy piece of island with three buildings, all windows lit, beside a neat stack marked "got". Right pan: a big piece with many buildings, half of them dark, a large pile of chips marked "spent" and a small stack marked "got". The scales tip toward the small one. Right: a low hand-drawn podium of ten steps with a stack of stock-token coins on each, tallest on the first, small but present on the tenth. Notes: "got ÷ spent", "size alone doesn't win", "the top 10 share the prize", "every 30 city days".

**Стр. 11.** The island from page 1 at dusk: warm sky, windows lit. At the island's edge a hand-drawn two-board signpost reading "Demo" and "Handbook". In the foreground, larger than on earlier pages, the Engineer closes the Workshop door behind him, turns toward the viewer and waves goodbye with his free hand, wrench resting on his shoulder, a calm small smile — the only time in the book he looks at the viewer. Three small blue icons around the edges: a chart with two arrows, up and down; the tank with a level mark; the bank's hours sign. Notes: "prices go both ways", "shared and finite", "start here".

---

## 8. Отложено до полной версии

Эти страницы полной версии в короткое издание не вошли. Их можно дорисовать позже и вставить без смены порядка:

- Everything is already built — сейчас это часть стр. 1;
- Five kinds of people — сейчас лента портретов на стр. 2;
- Two things run out — Energy и Compute;
- Buildings help each other — связи зданий;
- A coin behind every chip — сейчас нитки на стр. 4;
- Coming in costs less than going out — сейчас сноска стр. 7;
- Forks in the road — тиры, синергии, исследования, City Level;
- Ten places at the top — квалификация приза;
- Beacons fill the jar — Farm и фрагменты;
- The same rules for everyone — детерминизм, чеки, без ИИ.

---

## 9. Передача агенту мокапов

Открытых вопросов нет. Мокапы делает другой агент. Всё, что ему нужно, — в этом документе и в перечисленных ниже файлах.

### 9.1 Что приложить

- этот документ целиком;
- `hud/quick-guide-reference/README.md` и `00-approved-mockup.png` — эталон стиля;
- `hud/quick-guide-reference/bank-ready/` — образец сборки: `index.html`, `HANDOFF.md`, `mockup.png`, `fonts/`;
- `media/MEDIA_GENERATION_RULE.md` и `media/VISUAL_DESIGN_SYSTEM.md`;
- листы `media/kit/buildings/<id>.png` и `media/kit/roles/<id>.png` для объектов страницы (таблица 9.3);
- `media/island/island_03_tight.png` для стр. 1 и 11.

### 9.2 Порядок и процесс

Порядок: **5 → 9 → 1**, затем 2, 3, 4, 6, 7, 8, 10, 11. Первыми идут бак и ключ: на них держатся две самые трудные мысли. Третьей — обложка, с которой открывается `/docs`.

На каждую страницу — процесс, утверждённый для quick guide:

1. Окончательный арт: один PNG 1672 × 941 с прозрачным фоном, по промпту §7 и концепту страницы §4. Пометки внутри арта — побуквенно из §4.
2. Сборка страницы в браузере по образцу `bank-ready/index.html`: панель, eyebrow, заголовок, абзац, сноска, ссылка в справочник, 11 точек и счётчик. Отличия панели от quick guide перечислены в §3.1: нет Skip guide и крестика, над панелью стоит переключатель «In pictures · Handbook».
3. Мокап — скриншот этой сборки на 1672 × 941. Отдельно полную страницу не генерировать.
4. Проверка телефонной раскладки §3.5 скриншотом на 375 × 812.
5. Комплект страницы складывается в `docs/public/docs-design/book-reference/NN-<якорь>-ready/`: `art.png`, `index.html`, `mockup.png`, `mockup-mobile.png`, `HANDOFF.md` с координатами и SHA-256 арта. Туда же ложится строка в `docs/public/docs-design/book-reference/README.md`.

Подкаталог `docs/public/docs-design/` сайт не читает как главы: `source.ts` берёт только `docs/public/*.md`.

### 9.3 Объекты по страницам

| Стр. | Здания (листы) | Роли (листы) |
|---|---|---|
| 1 | остров целиком; Workshop, Power Node, Bank, Exchange, Finance Tower, Flagship Store | Engineer |
| 2 | Workshop, AI Research Center, Bank | все пять |
| 3 | Workshop, Power Node, Fleet Yard | Engineer, Logistician |
| 4 | — | Engineer (мелко) |
| 5 | остров как маленький цветной силуэт | Engineer (мелко) |
| 6 | — | Engineer (мелко) |
| 7 | Bank | Engineer (мелко) |
| 8 | AI Research Center, Energy Plant, Logistics Hub, Flagship Store, Cloud Campus, Finance Tower | Engineer (мелко) |
| 9 | Energy Plant | Engineer |
| 10 | 3–6 зданий на чашах весов, любые из листов | Engineer (мелко) |
| 11 | остров целиком, Workshop крупно | Engineer крупно, машет |

«Мелко» — герой где-то в сцене как «найди героя», он не главный объект.

### 9.4 Проверка каждого мокапа

- Кадр проходит §9 `media/MEDIA_GENERATION_RULE.md`: вывески побуквенно, приметы ролей, нет часов на City Hall, нет лишних зданий и людей.
- Пометки в арте совпадают с §4 побуквенно. Их не больше, чем указано, кроме карты на стр. 8.
- Левый верх и нижняя полоса арта пусты: заголовок и абзац не пересекаются с рисунком.
- Числа в тексте панели — из пака, снятые `python content/build.py`, а не из таблицы §5.
- Нет ничего из красных линий §6.
- На 375 px пометки угадываются, а после тапа читаются.

Разошлось с этим документом — агент называет расхождение владельцу, а не подгоняет.
