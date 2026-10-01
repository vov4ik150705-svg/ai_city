# Corporator — быстрый гайд по HUD

Черновик концепции для мокапов, 2026-09-30. Не ТЗ кода и не канон механики.
Эталон вида: мокап «01 — Quick Start». Белая панель поверх размытого HUD, синие акценты, заголовок от руки, рисунок пером, листание стрелками снизу.
Факты взяты из `docs/public/*.md`, числа — из пака. Если здесь и там разошлось, прав пак.

---

## 0. Идея

Это не учебник по экономике, а **книжка про первый час в городе**. Игрок листает её и видит маршрут: куда пойти, что нажать и зачем. Закрывает гайд и сразу знает, с чего начать.

Каждая страница отвечает на три вопроса, и на каждый отвечает свой слой:

| Вопрос | Чем отвечаем | Где на странице |
|---|---|---|
| **Где?** | рисунок: здание, панель или кнопка HUD | большая часть страницы |
| **Что нажать?** | «тропинка шагов» — 2–3 кружка с номерами и маленькими зарисовками кнопок | под рисунком |
| **Зачем?** | одна-две живые фразы | под заголовком |

Правило: если игрок не прочитал ни слова и только смотрел картинки, он всё равно должен понять маршрут **Bank → Workshop и Power Node → Agents → смена**.

---

## 1. Голос

**Как говорим.** Как друг, который уже играл и показывает город за пять минут: спокойно, по делу, с лёгкой теплотой. Короткие фразы. Сначала действие, потом смысл.

**Заголовки — как главы в детской книжке.** Простая фраза, которую можно сказать вслух. Не слоган, не лозунг из двух антонимов, не рекламная пара «X. Y.».

| Так | Не так |
|---|---|
| First stop: the Bank | $CORP IN. $CORP OUT. |
| Buildings need people | RIGHT PERSON, RIGHT SEAT. |
| Now wait for the hour | EVERY HOUR IS A SHIFT. |
| That's the whole start | YOU'RE READY TO DOMINATE |

**Слова.** Названия из игры не переводим и не упрощаем: Bank, Workshop, Power Node, Engineer, Capital, `$CORP`, Manage, Deposit, Hire — игрок увидит ровно их. Всё вокруг — обычные слова. Не «тик», а «час». Не «фонд зарплат с коэффициентом», а «город платит». Не «аффинити», а «своё место».

**Нельзя.** Обещать доход (earn, profit, yield, «заработай»), восклицательные знаки, эмодзи, «Let's dive in», «unlock», «journey», «seamless», «level up your…», цифры выплат, графики вверх, дождь монет.

**Русский.** Та же интонация, на «вы» (как в `content/strings/ru.json`). Не калька с английского: «Сначала — в банк», а не «Первая остановка: Банк».

**Регистр заголовков.** Предлагаю обычный регистр (First stop: the Bank), а не капс. Рукописный капс кричит, обычный регистр читается как подпись в книжке. Если остаётся маркерный капс с мокапа — те же слова, просто капсом.

---

## 2. Вид

### 2.1 Панель (одинаковая на всех страницах)

```
┌──────────────────────────────────────────────────────────────┐
│ [◇] CORPORATOR                              Skip guide    ✕  │
│                                                              │
│ 02 — THE BANK                                                │
│ First stop: the Bank                    ← заголовок от руки  │
│ Одна-две фразы «зачем».                                      │
│                                                              │
│              РИСУНОК: где это на острове / в HUD             │
│                  + синие пометки от руки                     │
│                                                              │
│   ①  [4] ───  ②  Deposit ───  ③  Review → Confirm            │
│              ↑ тропинка шагов: что нажать                    │
│ ──────────────────────────────────────────────────────────── │
│ [←]              ● ● ○ ○ ○ ○ ○ ○                  [→] Next   │
│                       2 / 8                                  │
└──────────────────────────────────────────────────────────────┘
```

- Под панелью — **живой** HUD игрока, размытый, без цифр с мокапа.
- `←` / `→` листают, `Esc` закрывает гайд (Skip guide), точки кликабельны.
- На последней странице вместо Next — кнопка «Start playing».

### 2.2 Тропинка шагов

Главная новая деталь по сравнению с мокапом. На страницах 2–6 под рисунком идёт короткая дорожка из 2–3 шагов:

- кружок с номером, нарисованный пером;
- рядом **зарисовка настоящего элемента HUD**: клавиша `4` как маленький keycap, кнопка «Deposit» как прямоугольник от руки с подписью, здание-пиктограмма;
- между шагами тонкая волнистая линия, как тропинка на карте.

Подписи элементов берутся из тех же строк, что и в HUD (`UI_DEPOSIT`, `UI_MANAGE`, `UI_HIRE`…). Переименуют кнопку — гайд не соврёт.

### 2.3 Рисунок

- **Перо:** тонкая тёмно-синяя линия `#0B1236`, чуть живая, аккуратная, как в хендбуке (`docs/public/docs-design/`).
- **Цвет:** синий `#0A5CF8` и голубые тинты. Жёлтый — только свет в окнах и искра электричества. Много белого.
- **Здания** — по силуэтам из `apps/client/assets/hud/buildings/*.png`:
  - Bank — фронтон, колонны, круглая дверь-сейф;
  - Workshop — корпус с двумя трубами;
  - Power Node — высокий ребристый изолятор и табличка с молнией.
- **Люди** — пять ролей по `apps/client/assets/hud/roles/*.png`, перерисованные пером:
  - Engineer — каска, гаечный ключ, борода;
  - Logistician — кепка с кубиком, синяя форма;
  - Trader — очки, костюм, планшет с графиком;
  - Scientist — пучок, очки, халат;
  - Manager — гарнитура, жилет.
- **Сквозной герой — Engineer в каске.** Его нанимают на стр. 4, он идёт на работу на стр. 5 и отрабатывает смену на стр. 6. Он не говорит и не машет, он просто работает.
- **Кусочки HUD** рисуются тем же пером, упрощённо: панель — прямоугольник от руки, кнопка — прямоугольник с подписью, палец-указатель на нужном месте. Не скриншот и не пиксель-в-пиксель.
- **Текст в картинку не запекается.** Рисунок — растр или SVG, пометки поверх — живой текст Caveat. Так работают EN/RU и числа из пака.

### 2.4 Шрифты

- Заголовок, eyebrow, пометки на рисунке — **Caveat** (уже утверждён для хендбука, `apps/www/src/docs/handbook/fonts.css`).
- Фраза «зачем» — Roboto 500, 16–17 px.
- Маркерный капс с мокапа — второе рукописное семейство, это решение владельца (§5).

### 2.5 Лимиты

| Элемент | Лимит |
|---|---|
| Заголовок | 2–5 слов |
| Фраза «зачем» | ≤ 30 слов, 1–2 предложения |
| Шаги тропинки | 2–3, по 1–3 слова |
| Пометки на рисунке | ≤ 3, по ≤ 6 слов (кроме карты HUD на стр. 7) |

---

## 3. Страницы

Восемь страниц. Порядок повторяет первый час игрока (`docs/public/index.md`, «Your first session»):

| # | Заголовок | Место | Что игрок делает |
|---|---|---|---|
| 1 | This island is yours | весь остров | смотрит маршрут |
| 2 | First stop: the Bank | Bank, клавиша `4` | вносит `$CORP`, получает Capital |
| 3 | The Workshop comes first | Workshop и Power Node на острове | открывает два здания |
| 4 | Buildings need people | Agents, клавиша `2` | нанимает двух Engineer |
| 5 | Give everyone a seat | карточка агента | сажает их в здания |
| 6 | Now wait for the hour | часы наверху, Journal `6` | видит первую смену |
| 7 | Keep an eye on these | весь HUD | узнаёт, что где на экране |
| 8 | That's the whole start | три дороги | узнаёт, куда дальше |

Числа в тексте стоят как `{плейсхолдер}`, рядом — нынешнее значение. Таблица источников — §4.

---

### Страница 1 — This island is yours

**Eyebrow:** 01 — WELCOME / 01 — ДОБРО ПОЖАЛОВАТЬ

**Заголовок**
- EN: This island is yours
- RU: Этот остров — ваш

**Зачем**
- EN: All the buildings are already here. You open them, hire people and keep the work going. Here's how your first hour goes.
- RU: Все здания уже на месте. Вы их открываете, нанимаете людей и следите, чтобы работа шла. Вот как пройдёт ваш первый час.

**Рисунок.** Остров с мокапа, та же композиция 3/4 сверху, облака снизу. Меняются только пометки: вместо трёх лозунгов по острову идёт **пунктирный маршрут, как на карте сокровищ**, с номерами у остановок:

1. у Bank — «start here» / «начните здесь»;
2. у Workshop и Power Node — «switch them on» / «включите их»;
3. у маленькой фигурки Engineer на площади — «hire people» / «наймите людей»;
4. у крошечных часов над островом — «wait for the hour» / «дождитесь часа».

Пунктир заканчивается у Workshop, окна которого светятся. Так первая страница становится оглавлением всей книжки.

**Правки к мокапу:** здания на острове — силуэты с Terra (Workshop с двумя трубами, Bank с колоннами), без выдуманных башен. Счётчик `1 / 8`.

**Если владелец оставляет исходный заголовок мокапа** «Your city. Your decisions.» — пометки-маршрут всё равно лучше трёх лозунгов: они показывают, куда идти.

---

### Страница 2 — First stop: the Bank

**Eyebrow:** 02 — THE BANK / 02 — БАНК

**Заголовок**
- EN: First stop: the Bank
- RU: Сначала — в банк

**Зачем**
- EN: Everything in the city is paid for in Capital, and this is where you get it. Bring in $CORP from your wallet — the Bank turns it into Capital.
- RU: Всё в городе оплачивается Capital, и получают его здесь. Внесите $CORP из кошелька — банк превратит его в Capital.

**Рисунок.** Банк крупно, слегка слева: фронтон, колонны, круглая дверь-сейф приоткрыта. К двери по ступенькам поднимается рука с одной монеткой `$CORP` (рисованный кружок с логотипом). Из боковой двери выезжает аккуратная стопка фишек с подписью «Capital». Над входом маленькая вывеска-часы.

Справа от банка — **зарисовка вкладки Deposit**, как её видит игрок: вкладка «Deposit» подчёркнута, поле суммы, синяя кнопка. Палец-указатель на кнопке.

**Пометки**
1. у стопки фишек — «Capital stays in your city» / «Capital живёт в вашем городе»;
2. у кнопки — «you'll see the {vault_fee_pct}% fee before you confirm» / «сбор {vault_fee_pct}% покажут до подтверждения»;
3. внизу, у соседнего здания Exchange, нарисованного бледно, со стрелкой — «the Exchange is for stock tokens. Later.» / «Exchange — для сток-токенов. Это потом.»

Третья пометка снимает самую частую путаницу «банк или биржа».

**Тропинка шагов**
① keycap `4` или пиктограмма банка — «open the Bank» / «откройте банк»
② вкладка «Deposit» + поле — «enter an amount» / «введите сумму»
③ «Review» → «Confirm» — «sign in your wallet» / «подпишите в кошельке»

**Сноска**
- EN: Nothing leaves your wallet until you confirm. No $CORP yet? It's bought with ETH, outside the game.
- RU: Пока вы не подтвердите, из кошелька ничего не уйдёт. Нет $CORP? Его покупают за ETH, вне игры.

**Демо-вариант.** Поверх вкладки Deposit наискось полоска малярного скотча с надписью от руки:
- EN: Demo city: no real money here. [что вместо — §5, вопрос 3]
- RU: Демо-город: настоящих денег здесь нет. [что вместо — §5, вопрос 3]

---

### Страница 3 — The Workshop comes first

**Eyebrow:** 03 — FIRST BUILDINGS / 03 — ПЕРВЫЕ ЗДАНИЯ

**Заголовок**
- EN: The Workshop comes first
- RU: Первым — Workshop

**Зачем**
- EN: The Workshop is where your Capital gets made. It needs electricity, so open the Power Node next to it too.
- RU: В Workshop делается ваш Capital. Ему нужно электричество, поэтому рядом откройте и Power Node.

**Рисунок — две сценки.**

- **Слева «спит».** Workshop с тёмными окнами, из труб не идёт дым. Палец нажимает на здание. Рядом всплывает маленькая зарисовка **popover** (карточка здания): название, кнопка «Manage». От неё стрелка ко второй кнопке — кнопке открытия.
- **Справа «проснулся».** Power Node с ребристым изолятором, от него рисованный кабель с искрой ведёт к Workshop. Окна Workshop светятся жёлтым, из трубы вьётся тонкий дымок.

**Пометки**
1. у кабеля — «the Workshop runs on this» / «Workshop работает от этого»;
2. у popover — «the price is on the card» / «цена — на карточке»;
3. у часиков над Workshop — «opens in about an hour» / «откроется примерно за час».

**Тропинка шагов**
① пиктограмма Workshop с пальцем — «click it on the island» / «нажмите на острове»
② «Manage» — «open its card» / «откройте карточку»
③ кнопка открытия (`UI_BUILD`) — «then do the same for the Power Node» / «и так же для Power Node»

Сейчас эта кнопка в HUD подписана `build`, и это спорит со сноской ниже и с каноном: игрок не строит, а открывает. См. §5, вопрос 6.

**Сноска**
- EN: You never build anything here. Every building is already standing — you just switch it on.
- RU: Строить ничего не нужно. Все здания уже стоят — вы их просто включаете.

---

### Страница 4 — Buildings need people

**Eyebrow:** 04 — PEOPLE / 04 — ЛЮДИ

**Заголовок**
- EN: Buildings need people
- RU: Зданиям нужны люди

**Зачем**
- EN: An open building does nothing on its own. Hire two Engineers — they're the ones who run the Workshop and the Power Node.
- RU: Открытое здание само ничего не делает. Наймите двух Engineer — именно они работают в Workshop и Power Node.

**Рисунок.** Пять фигур по пояс стоят свободной шеренгой, как на фото команды. Engineer в каске сделал шаг вперёд, держит ключ на плече, он нарисован плотнее. Остальные четверо — тоньше и бледнее, над ними одна общая пометка.

Справа — **зарисовка кабинета Agents**: список, синяя кнопка «Hire», под ней выпадающий выбор роли, в котором Engineer обведён от руки.

**Пометки**
1. над бледной четвёркой — «the rest of the team — you'll meet them later» / «остальная команда — познакомитесь позже»;
2. у выбора роли — «pick the role, same price» / «роль можно выбрать, цена та же»;
3. у кнопки Hire — «each new hire costs a bit more» / «каждый следующий чуть дороже».

**Тропинка шагов**
① keycap `2` — «open Agents» / «откройте Agents»
② «Hire» — «choose Engineer» / «выберите Engineer»
③ ×2 — «hire a second one» / «наймите второго»

**Сноска**
- EN: No AI inside. Your people follow the city's rules, the same way every time.
- RU: Внутри нет ИИ. Ваши люди работают по правилам города, всегда одинаково.

---

### Страница 5 — Give everyone a seat

**Eyebrow:** 05 — TO WORK / 05 — ЗА РАБОТУ

**Заголовок**
- EN: Give everyone a seat
- RU: Каждому — своё место

**Зачем**
- EN: Tell each Engineer where to work: one to the Workshop, one to the Power Node. They start on the next hour.
- RU: Скажите каждому Engineer, где работать: одного — в Workshop, второго — в Power Node. Со следующего часа они на смене.

**Рисунок.** Слева — **зарисовка карточки агента**: портрет Engineer, имя, раскрытый список мест, в нём «Workshop» с галочкой. От карточки длинная тонкая стрелка уходит на остров: там наш Engineer входит в дверь Workshop. Второй Engineer в то же время идёт к Power Node по своей тропинке.

Внизу справа крошечная сценка «не туда»: Trader стоит в дверях Workshop, растерянно разводит руками, рядом серый стикер.

**Пометки**
1. у стикера — «wrong person, wrong place — the card will say so» / «не тот человек не на своём месте — карточка подскажет»;
2. у стрелки — «you can move people any time» / «переставлять можно когда угодно».

**Тропинка шагов**
① портрет в списке Agents — «open the card» / «откройте карточку»
② список мест — «pick a building» / «выберите здание»

---

### Страница 6 — Now wait for the hour

**Eyebrow:** 06 — THE FIRST SHIFT / 06 — ПЕРВАЯ СМЕНА

**Заголовок**
- EN: Now wait for the hour
- RU: Теперь — дождитесь часа

**Зачем**
- EN: Once every city hour, your people work a shift and the city pays them in Capital. The clock at the top shows city time — an hour there is about an hour here.
- RU: Раз в городской час ваши люди отрабатывают смену, и город платит им Capital. Часы наверху показывают время города — час там примерно равен нашему.

**Рисунок — слева направо, как три кадра комикса без рамок.**

1. **Часы из топбара** крупно: день, время, стрелка сдвинулась на час.
2. Engineer у станка в Workshop, окна горят. Над крышей маленькая стопка фишек.
3. **Зарисовка Recent Activity / Journal**: две строки от руки.
   - «Workshop · paid» с зелёной точкой;
   - «Power Node · working» с зелёной точкой.
   Ниже — третья строка, приклеенная как стикер, серая: «Workshop · no energy».

**Пометки**
1. у стикера — «if something stops, it always says why» / «если что-то встало, всегда написано почему»;
2. у стопки фишек — «pay comes from one fund all cities share — some hours more, some less» / «платит общий фонд всех городов — в какой-то час больше, в какой-то меньше».

**Тропинка шагов**
① часы — «watch the clock» / «следите за часами»
② keycap `6` — «open the Journal» / «откройте Journal»

**Сноска**
- EN: Leave the game and your city keeps working for up to {offline_hours} hours.
- RU: Уйдёте из игры — город проработает без вас до {offline_hours} часов.

---

### Страница 7 — Keep an eye on these

**Eyebrow:** 07 — THE SCREEN / 07 — ЭКРАН

**Заголовок**
- EN: Keep an eye on these
- RU: Поглядывайте сюда

**Зачем**
- EN: The island always stays in the middle. Around it, the city tells you how it's doing.
- RU: Остров всегда в центре. А вокруг город рассказывает, как у него дела.

**Рисунок — карта экрана.** Весь HUD (раскладка кадра `00`), нарисованный пером и упрощённый. Остров маленький в центре, панели — прямоугольники от руки со штрихами вместо текста. Синие пометки со стрелками, по одной на зону:

| Зона | Пометка EN | Пометка RU |
|---|---|---|
| Economy → Capital | your money in the city | ваши деньги в городе |
| Economy → Payroll | what the city paid last hour | сколько город заплатил за час |
| Economy → Energy | is there enough power? | хватает ли электричества |
| Топбар → часы | city time | время города |
| Топбар → чип банка | is the Bank open? | открыт ли банк |
| Топбар → `$CORP` | your wallet — tap it | ваш кошелёк — нажмите |
| Топбар → плашка сезона | season and ranking | сезон и рейтинг |
| City Status | how big and healthy your city is | насколько город большой и здоровый |
| Active Functions | your buildings at work | ваши здания в работе |
| Recent Activity | the latest news | последние новости |

Вдоль нижнего края страницы — ряд из шести нарисованных keycap с одним словом под каждым: `1` Overview · `2` Agents · `3` Exchange · `4` Bank · `5` Industries · `6` Journal.

Это единственная страница, где пометок больше трёх: это карта. Каждая пометка — не больше пяти слов.

---

### Страница 8 — That's the whole start

**Eyebrow:** 08 — WHAT'S NEXT / 08 — ЧТО ДАЛЬШЕ

**Заголовок**
- EN: That's the whole start
- RU: Вот и весь старт

**Зачем**
- EN: Your city is working. When you want more, here are three roads.
- RU: Город работает. Когда захочется большего — вот три дороги.

**Рисунок.** От острова внизу страницы расходятся три тропинки, в конце каждой маленькая сценка.

| Дорога | Сценка | Текст EN | Текст RU | Клавиши |
|---|---|---|---|---|
| **Grow** / **Расти** | монетка-токен NVDA ложится в фундамент, над ним вырастает силуэт AI Research Center | Buy a stock token in the Exchange, stake it, and a new district opens. | Купите сток-токен в Exchange, застейкайте — и откроется новый район. | `3` → `5` |
| **Compete** / **Соревноваться** | плашка сезона, под ней столбик рейтинга, одна строка подсвечена «you», не первая | Run your city well to climb the season ranking. The best share prizes. | Управляйте городом лучше — и поднимайтесь в рейтинге сезона. Лучшие делят призы. | плашка сезона |
| **Cash out** / **Вывести** | Bank с табличкой часов и стопка фишек, превращающаяся в монетку `$CORP` | Want your $CORP back? The Bank pays out {bank_open}–{bank_close} city time, closed on Sundays. | Хотите вернуть $CORP? Банк выдаёт с {bank_open} до {bank_close} по времени города, в воскресенье закрыт. | `4` |

**Сноска**
- EN: If a button won't press, it tells you why.
- RU: Если кнопка не нажимается — на ней написано почему.

**Низ панели:** вместо Next — синяя кнопка «Start playing» / «Играть». Слева от точек — ссылка «Open the handbook →» / «Открыть справочник →».

**Демо-вариант.** Дорога «Cash out» и сценка сезона с полоской скотча: «Connect a wallet to play for real» / «Подключите кошелёк, чтобы играть по-настоящему». Вторая кнопка — «Connect wallet» (`UI_CONNECT_WALLET`).

---

## 4. Числа и откуда

В гайде нет литералов: всё подставляется из пака.

| Плейсхолдер | Сейчас | Источник | Стр. |
|---|---|---|---|
| `vault_fee_pct` | 2 | `economy.vault_fee_bps` 200 | 2 |
| `offline_hours` | 12 | `time.offline_cap_city_hours_base` | 6 |
| `bank_open` / `bank_close` | 08:00 / 20:00 | `time.bank_open_hour`, `bank_close_hour` | 8 |
| «час там ≈ час здесь» | 62½ мин | `time.city_day_real_hours` 25 | 6 |
| «opens in about an hour» | 1 час | таймер уровня 1 у Workshop и Power Node | 3 |

Подписи кнопок (Deposit, Review, Confirm, Manage, Hire, Journal, кнопка открытия здания…) — из `content/strings/en.json` и `ru.json`, теми же ключами, что в HUD.

---

## 5. Вопросы владельцу

1. **Шрифт заголовка:** Caveat в обычном регистре (рекомендую) или маркерный капс с мокапа.
2. **Стр. 1:** новый заголовок «This island is yours» с маршрутом или исходный «Your city. Your decisions.» с маршрутом.
3. **Демо-город.** С каким Capital он стартует, в публичных доках не написано. От этого зависит скотч на стр. 2: «вот вам стартовый Capital, пробуйте» или «денег нет, просто посмотрите».
4. **Когда показывать.** Предлагаю при первом входе в город (кошелёк и демо отдельно) и один раз. Повторный вход — ссылка «Quick guide» во flyout кошелька или клавиша `?`. Settings и нижнего меню нет.
5. **Иллюстрации:** художник по этому документу или генерация по промптам §6 с ручной доводкой.
6. **Подпись кнопки открытия здания.** Сейчас `UI_BUILD` = «build» / RU из `ru.json`. По канону здания уже стоят и игрок их открывает (`docs/public/city.md`). Предлагаю переименовать строку в «Open» / «Открыть» — это правка строки в паке, отдельным шагом. Иначе гайд говорит «строить не нужно», а кнопка говорит «build».

---

## 6. Промпты для рисунков

**Общий стиль (добавляется к каждому):**

> Clean hand-drawn storybook illustration for a city-building game guide. Fine dark navy ink line (#0B1236) with a slight natural wobble, flat fills in cobalt blue (#0A5CF8) and pale sky-blue tints, warm yellow only for lit windows and electric sparks. Pure white background, generous white space, no gradients, no glow, no shadows, no text or letters. Grown-up and careful, like a picture book drawn by a good illustrator — not a children's doodle, not a sketch filter. Buildings in three-quarter isometric view.

**Стр. 1.** A floating island city seen from above at three-quarter angle, clouds beneath. A dotted treasure-map route winds across it, stopping at a classical bank with columns, a compact factory with two chimneys, a power station with a tall ribbed insulator tower, and a small plaza with a single worker in a hard hat; the route ends at the factory, whose windows glow yellow.

**Стр. 2.** A classical bank building with a pediment, columns and a round vault door slightly open. A hand carries one round coin up the steps to the door; from a side door a neat stack of round chips slides out. A small clock sign above the entrance. On the right, a simple hand-drawn sketch of an app panel with a tab, an input field and a button, a pointing finger on the button. In the far background, a faint second building (an exchange).

**Стр. 3.** Two scenes side by side. Left: a compact factory with two chimneys, dark windows, no smoke, a pointing finger touching it and a small hand-drawn pop-up card beside it with two blank buttons. Right: a power station with a tall ribbed insulator tower connected by a scribbled cable with an electric spark to the same factory, now with glowing yellow windows and a thin curl of smoke.

**Стр. 4.** Five people standing loosely like a casual team photo, waist-up. In front, bolder: an engineer with an orange hard hat, beard and a wrench on his shoulder. Behind him, drawn lighter: a woman logistician in a blue uniform and cap, a trader in glasses and a suit with a tablet, a woman scientist with a hair bun, glasses and a lab coat, a manager with a headset and vest. On the right, a hand-drawn sketch of an app list with a button and a dropdown, one item circled.

**Стр. 5.** Left: a hand-drawn sketch of a character card with a portrait of the engineer and an open list, one line ticked. A long thin arrow leads onto a small island where the engineer walks into the two-chimney factory, while a second engineer walks along another path to the power station. Small corner scene: a man in a suit and glasses standing confused in the factory doorway, shrugging.

**Стр. 6.** Three frames without borders, left to right: a large round clock whose hand has moved one hour; the engineer at work inside the lit factory with a small stack of chips above the roof; a hand-drawn list with two lines marked by green dots and a third line on a grey sticky note stuck below.

**Стр. 7.** A simplified hand-drawn map of a game screen: a small floating island in the centre, loose hand-drawn rectangles around it — a tall panel on the left, a tall panel on the right, a thin bar across the top with small chips and a clock, two small panels at the bottom — filled with short scribble lines instead of text. Along the bottom edge, a row of six hand-drawn keyboard keys.

**Стр. 8.** Three winding paths leading away from a small island. At the end of the first, a round token being placed into a foundation with a futuristic research building rising above it. At the end of the second, a small plaque above a short handwritten list with one row highlighted pale blue. At the end of the third, the classical bank with a clock sign and a stack of chips turning into a single coin.

---

## 7. Следующий шаг

После ответов на §5 предлагаю мокапы стр. 2 (Bank) и стр. 6 (первая смена). На них держится вся книжка: одна показывает «что нажать», другая — «что получилось».
