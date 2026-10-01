# Первый пост Corporator в X — шесть версий

Каждая версия рассказывает об игре целиком: остров, здания, агенты, тик, Capital и `$CORP`, Payroll, Банк, стоки и индустрии, призы, Influence, время, чего игра не делает, статус запуска. Версии различаются подачей:

1. **Прогулка по игре** — от острова до вывода денег, с короткими подзаголовками.
2. **Письмо основателя** — те же механики, но через решения: почему игра устроена именно так.
3. **Вопросы и ответы** — самые естественные вопросы читателя, короткие ответы.
4. **Один день на острове** — городские сутки по часам; каждая механика появляется в тот час, когда она срабатывает.
5. **Жизнь одного `$CORP`** — путь одного токена через пул, vault, город, Payroll, биржу, призы и Банк.
6. **Четыре и четырнадцать** — всего четыре здания делают деньги, остальные четырнадцать делают их лучше; игра как машина зависимостей.

Версии 4–6 полнее первых трёх: в них есть уровни и трейты агентов, задачи, связки зданий, исследования, население и уровень города, тиры, узлы, слияния, кулдаун анстейка, эффективность районов, квалификация призов, ваучер, демо-город и проверяемость записей.

Все факты взяты из `docs/public/*.md`, сверка в конце файла. Ссылок и «Play now» нет: внешние адреса сайта пока пустые, контракт не задеплоен.

---

## Версия 1. Прогулка по игре

**Corporator: the city is already built**

Picture an island where everything is finished and nothing works.

Eighteen buildings stand on it: workshops, power nodes, research labs, stores, a bank, an exchange, a finance tower. Every player gets this same hand-built island, down to the last building. The only thing that differs from city to city is how it's run.

That's Corporator, a 3D city-management game you play in the browser, on Robinhood Chain.

**You don't build. You run.**

Buildings here aren't built, they're opened. You open one, then put an agent inside. Agents come in five roles: engineers, logisticians, traders, scientists and managers, and each role belongs in certain buildings. An engineer in a workshop makes Capital. Put the same engineer in the bank and it does nothing at all.

That's where the game starts. The workshop draws Energy. Energy comes from a power node, and only an engineer can make it. Power costs more at night. Offices keep office hours. Research labs turn Energy into Compute, and the bigger machines need both.

Once every city hour the game runs a tick. Every agent either works and asks to be paid, or writes down why it couldn't: no Energy, wrong role, outside working hours. When something stalls, the city tells you exactly where.

**Where the money comes from**

There are two currencies. $CORP is the token: it sits in your wallet and trades in a single pool against ETH. Capital is what you spend inside the city. It isn't a token, and you can't send it to anyone.

You deposit $CORP into a vault and get Capital back. You spend Capital on buildings, hires and upgrades. 40% of every spend is burned, and 60% goes into Payroll, the one fund that pays working agents in every city. Payroll also gets a cut of every $CORP trade on the market.

Payroll is shared, and it can run low. When all cities together ask for more than it can pay this hour, everyone gets the same fraction. In a quiet hour, the same work can earn several times what it earns in a crowded one.

When you want out, you go to the Bank. It turns Capital back into $CORP and sends it to your wallet, with a 10% markup on the way. The Bank keeps hours, closes on Sundays and has a daily limit shared by every player. Getting in is always cheaper than getting out.

**The stocks**

On Robinhood Chain, shares like NVDA and TSLA exist as tokens. In Corporator, six of them open six industries: NVDA opens Compute, TSLA Energy, AMZN Logistics, AAPL Consumer, MSFT Automation and COIN Finance. Stake the token and the district opens. Stake more and it climbs tiers. Every tier asks you to pick one of two paths, and the pick is final. Some pairs of industries share a synergy building of their own.

What a stock does on the market never turns into pay. A 20% rise in NVDA adds 20% to nothing you own. The stock opens the door. It doesn't multiply what's behind it.

**The prizes**

Two prize pools are filled from trading, not from what players spend. Farm settles every 7 city days and pays for steady work in each industry's main building. Monthly settles every 30 city days and pays the top ten cities by Influence. Both pay in Stock Tokens, and you claim them to your wallet.

Influence is the score, and size doesn't win it. It measures what your city earns against what it has spent. A city that spent 100 million and earned 5 million today scores the same as one that spent a billion and earned 50 million.

**The clock**

An hour in the city lasts 62 minutes and 30 seconds, so a city day is 25 real hours and slowly drifts against your own. When you log off, the city keeps working for 12 hours, up to 18 as it grows. After that it waits for you.

**What it doesn't do**

There's no AI behind the agents. They follow fixed rules, and the same inputs always give the same result. The game doesn't pay you for opening a building, doesn't pass stock gains on to you and doesn't promise that every city ends up ahead.

Corporator hasn't launched. There's no official token contract yet, and any address you're shown before we post one here isn't ours.

The island is ready. Every light on it is still off.

---

## Версия 2. Письмо основателя

**A city nobody gets to build**

This is the first thing we're publishing about Corporator, so it should say plainly what the game is, and why it's shaped the way it is.

Corporator is a city-management game on Robinhood Chain. You play it in the browser, in 3D, on an island we made by hand. Every player gets the same island. There's no map generator, no lucky start, no better plot of land.

On that island, all eighteen buildings are already standing. That was the first decision, and most of the others follow from it. If nobody can build, the game has to be about something else. So it's about running things.

You open a building and seat an agent in it. Agents have roles, levels and traits, and a role only works in the buildings it belongs to. A workshop needs an engineer and Energy. Energy needs a power node, which needs an engineer of its own. Stores need traders. Labs turn Energy into Compute. A good city is less a collection of buildings than a set of dependencies that hold up.

Every city hour, the game checks all of it. Each agent either works and files a request to be paid, or records the reason it couldn't. We cared a lot about that second half. A game that quietly shows you a smaller number teaches you nothing. Corporator shows you the reason instead.

Then there's money. We wanted an economy that holds together without anyone printing to keep it going. So there's one rule underneath everything: no Capital, the currency you spend in the city, can exist unless $CORP sits in the vault behind it.

You deposit $CORP and get Capital. When you spend Capital, 40% of it is burned and 60% flows into Payroll, the single fund that pays working agents in every city. Payroll is also fed by a share of every $CORP trade. It's shared, and it's finite. When everyone asks for more than it can pay in an hour, everyone gets the same fraction. Nobody gets zero while the fund has Capital. And when it's empty, nothing is minted to fill the gap.

Leaving goes through the Bank. It turns Capital back into $CORP and sends it to your wallet, with a 10% markup. It keeps hours, closes on city Sundays and shares one daily limit between all players. We'd rather say the cost up front: a full round trip, buying $CORP, depositing, withdrawing and selling, costs 14.45% in fees before gas and price moves.

Robinhood Chain gave us something no other city game has: real shares as tokens. Six of them open the city's six industries. NVDA opens Compute, TSLA Energy, AMZN Logistics, AAPL Consumer, MSFT Automation, COIN Finance. You stake the token to open a district, and stake more to climb its tiers. Each tier makes you choose between two paths, permanently. The share's market price never becomes your pay. In the game, a stock is a key to a district and nothing more.

What you earn on top of Payroll comes as Stock Tokens, bought with trading fees rather than taken from players. Every 7 city days, the Farm pays for steady work in each industry's main building. Every 30 city days, the top ten cities by Influence share the Monthly prize. Influence rewards a city that runs well for what it has spent, so a small, sharp city can outrank a large, sloppy one.

The agents don't run on AI. That was a choice too. They follow fixed rules, anything that looks random comes from a seeded hash, and the same inputs always give the same day. Every result is written as a record you can replay, and that record never contains your wallet address.

The city also keeps its own time. An hour lasts 62 minutes and 30 seconds, so a day is 25 real hours. When you step away, the city keeps working for 12 hours, up to 18 as it grows, then waits.

Corporator doesn't promise that everyone comes out ahead. Payroll is finite, tokens can lose value, and the Bank limits when you can leave. We'd rather you read that here than discover it later.

It hasn't launched yet. There's no official contract address, and anything you're shown before we post one here isn't ours.

Eighteen buildings, five kinds of workers, one shared payroll and a clock that doesn't match yours. That's the city.

---

## Версия 3. Вопросы и ответы

**Corporator, in ten questions**

**What is it?**
A 3D city-management game on Robinhood Chain. You play in the browser, on one hand-built island. Every player gets the same island, with the same eighteen buildings already standing on it.

**If everything's built, what do I do?**
You run it. Buildings are opened, not built. You open one, hire an agent and give it a seat. There are five roles: engineers, logisticians, traders, scientists and managers. Each works only in certain buildings. An engineer makes Capital in a workshop and nothing at all in a bank.

**What makes it hard?**
Everything depends on something else. Workshops need Energy, and only engineers make it. Power costs more at night. Offices close in the evening. Labs turn Energy into Compute, and the bigger machines need both. Once every city hour, each agent either works and asks to be paid, or writes down exactly why it couldn't.

**How do I earn?**
Working agents are paid in Capital, the in-game currency, from a fund called Payroll. Payroll is one pot for every city. When everyone asks for more than it can pay in an hour, everyone gets the same share, so the same work pays more in a quiet hour than in a busy one. Capital isn't a token: you spend it in your city, or take it out through the Bank.

**Where does Payroll's money come from?**
From players and from trading. When anyone spends Capital, 40% is burned and 60% goes into Payroll. A share of every $CORP trade on the market goes in too. Nothing is printed to top it up. Every unit of Capital is backed by $CORP sitting in a vault.

**How do I get in and out?**
In: deposit $CORP, the game's token, into the vault and get Capital back, minus a 2% fee. Out: the Bank turns Capital back into $CORP and sends it to your wallet, with a 10% markup. The Bank is open 08:00 to 20:00 city time, closed on Sundays, and has a daily limit that all players share. Getting in is always cheaper than getting out.

**Why are there stocks in a city game?**
Because on Robinhood Chain, shares like NVDA exist as tokens. Six of them open the city's six industries: NVDA Compute, TSLA Energy, AMZN Logistics, AAPL Consumer, MSFT Automation, COIN Finance. Stake one and its district opens; stake more and it climbs tiers, each with a permanent choice between two paths. The stock's price never becomes your pay. If NVDA rises 20%, nothing you own rises with it.

**What can I win?**
Stock Tokens, from two pools filled by trading fees. The Farm pays every 7 city days for steady work in each industry's main building. The Monthly prize goes to the top ten cities by Influence every 30 city days. Influence measures what your city earns against what it has spent, so a small city that runs well can beat a big one that doesn't.

**Are the agents AI?**
No. They follow fixed rules. Anything that looks random comes from a seeded hash, so the same inputs always give the same result, and every result is recorded so it can be checked later.

**Can I play now?**
Not yet. Corporator hasn't launched, and there's no official token contract. Any address you see before we post one here isn't ours.

One more thing worth knowing up front: the game doesn't promise that every city ends up ahead. Payroll can run low, tokens can lose value, and the Bank decides when you can leave. The rules are there so nobody has to find that out the hard way.

---

## Сверка фактов (версии 1–3)

| Утверждение | Источник |
|---|---|
| 3D, браузер, Robinhood Chain, один авторский остров на всех, 18 зданий | `index.md`, `city.md` Directory |
| Здания открываются; открытие не оплачивается | `index.md`, `economy.md` «What the economy doesn't do» |
| Пять ролей; инженер в банке не работает | `agents.md` Roles, `IDLE_WRONG_ROLE` |
| Энергию делает только инженер; ночью +20%; офисные часы | `agents.md`, `city.md` |
| Лаборатории превращают Energy в Compute | `city.md` Energy and Compute |
| Тик раз в городской час: работа и запрос или причина | `index.md`, `agents.md` |
| `$CORP` — токен, один пул CORP/ETH; Capital — не токен, не передаётся | `index.md` Three units |
| Вход 2%; трата 40% сжигается, 60% в Payroll | `economy.md` Spending Capital, Depositing |
| Payroll получает 1% оборота торгов | `economy.md` How value moves |
| Одна доля на всех; никто не получает ноль, пока в фонде есть Capital; пустой фонд не допечатывается | `economy.md` Payroll, Fund limits |
| В тихий час та же работа платит в разы больше | `economy.md`, пример «six times more» |
| Банк: наценка 10%, 08:00–20:00, воскресенье закрыто, общий дневной лимит; вход дешевле выхода | `economy.md` The Bank |
| Круг 14.45% без газа и движения цены | `economy.md` The round trip |
| Шесть стоков → шесть индустрий; ставка открывает район; тиры, выбор из двух необратим; синергии | `industries.md` |
| NVDA +20% не прибавляет ничего | `industries.md` District efficiency |
| Farm раз в 7 городских дней за работу в главных зданиях индустрий; Monthly раз в 30 — топ-10 по Influence; оба в Stock Tokens из торговых сборов; забираешь в кошелёк сам | `seasons.md` |
| Influence = заработок против трат; пример 100M/5M = 1B/50M | `seasons.md` Influence |
| Нет AI; сидированный хэш; записи воспроизводимы; адреса в записи нет | `agents.md`, `protocol.md` Determinism |
| Час 62 мин 30 с, день 25 часов; офлайн 12 → 18, потом ожидание | `city.md` |
| Нет обещания, что все в плюсе; токены могут дешеветь; Банк ограничивает выход | `index.md` последний абзац |
| Не запущено, официального адреса нет | `index.md` Release status |

Одна оговорка на будущее. В справочнике помечено как неподтверждённое, получит ли Trader на задаче Desk скидку к наценке банка. Поэтому во всех версиях наценка названа просто «10%». Если скидку включат, фразу про наценку стоит уточнить.

---

## Версия 4. Один день на острове

**Концепт:** игра рассказана через одни городские сутки. Каждая механика появляется в тот час, когда она срабатывает: в полночь закрываются книги, в шесть утра делятся призы, в восемь открывается Банк, в десять вечера дорожает энергия. Читатель проживает день города и к вечеру знает всю игру.

---

**Twenty-five hours on the island**

Corporator is a 3D city-management game on Robinhood Chain, played in the browser. The simplest way to explain it is to walk through one day in a city.

A day here has 24 city hours, and each one lasts 62 minutes and 30 seconds. So a full city day takes 25 of your hours. Keep that in mind. It matters later.

**Before the day starts**

Every player gets the same hand-built island. Eighteen buildings already stand on it: workshops, power nodes, research labs, stores, a bank, an exchange, a finance tower, a city hall. You never build anything. You open buildings, and nothing you do changes how the island looks. What's yours is everything behind the models: which buildings are open, at what level, who works in them and what that work earns.

To open anything you need Capital, the money of the city. You get it by depositing $CORP, the game's token, into a vault. The vault keeps a 2% entry fee, and in return you get Capital. By the game's convention, a million Capital is about a dollar's worth of $CORP at the current rate. Capital isn't a token. You can't send it to anyone, and it only comes into existence when $CORP goes into the vault.

Then you hire. Agents come in five roles: engineers, logisticians, traders, scientists and managers. Every hire costs more than the one before. A random hire is usually an engineer, or you can choose the role for the same price. Each agent rolls one or two traits. A Night Owl shrugs off the night shift. A Specialist is brilliant in its own building and worse anywhere else.

Now the clock starts.

**00:00. The books close.**

At midnight the city counts yesterday. It adds up how much Capital your city was paid, and adds that day's score to your Influence. Then Payroll sets tomorrow's budget.

Payroll is the heart of the economy: one fund that pays working agents in every city at once. It's filled two ways. Whenever anyone spends Capital, 40% is burned and 60% goes into Payroll. And a slice of every $CORP trade on the market is bought back and minted into it. Each midnight the fund sets a daily budget, the larger of a fourteenth of its balance or its average inflow over the last three days, and splits it across 24 hours.

**The night shift**

Workshops, power nodes and labs work around the clock. Every city hour the game runs a tick, and every seated agent goes through the same checks. Is the building open? Is this the right role for it? Is it within working hours? Is there Energy? Is there Compute?

An agent that passes asks Payroll to be paid. An agent that fails writes down why: no Energy, wrong role, out of hours. The game never shows you a silent zero. It shows you the reason.

Energy and Compute are the only two things that get used up. Only engineers make Energy, and between 22:00 and 06:00 it costs 20% more. Labs turn Energy into Compute. The bigger machines need both.

Payroll then pays everyone from that hour's pool. When the whole island asks for more than the pool holds, everyone gets the same fraction. In a quiet hour the pool can pay more than was asked: up to eight times in the first week after launch, and up to three times after that, as far as the budget and the fund allow. Nobody gets zero while the fund holds Capital. When it's empty, agents still work and still record it, but nothing is printed to pay them.

Every paid hour also teaches. Agents gain experience and climb from level 1 to level 5, and a level 5 agent produces 60% more than a beginner.

**06:00. Prices and prizes.**

At six the city looks at the stock market.

On Robinhood Chain, shares like NVDA and TSLA exist as tokens, and Corporator has six industries tied to six of them: NVDA for Compute, TSLA for Energy, AMZN for Logistics, AAPL for Consumer, MSFT for Automation and COIN for Finance. You open an industry by staking its token from your wallet. The minimum was set at roughly $100 of each stock on one price snapshot, then frozen in tokens, so it doesn't move with the price.

An open industry gives you its flagship building and a bonus that grows with each tier. Tiers need more stake, a higher city level and Capital, and each one makes you choose between two paths for good. Six pairs of industries share a synergy building. The other nine pairs can merge instead.

At six every morning each industry's efficiency is refreshed. It compares the stock's last day with its last month and moves between 85% and 115%. That number feeds your score. It never feeds your pay. If NVDA rises 20%, nothing you own rises 20%.

Six o'clock is also when prizes settle. There are two pools, both filled from trading, not from what players spend, and both paid in Stock Tokens. The Farm settles every 7 city days: work in an industry's flagship building earns fragments, and fragments become a share of that stock's pool. The Monthly prize settles every 30 city days and goes to the ten best cities by Influence.

Influence doesn't reward size. It measures what your city earns against what it has spent, multiplied by how many of its hours worked and how many of its industries produced. A city that spent 100 million and earned 5 million today scores exactly as well as one that spent a billion and earned 50 million.

**08:00. The Bank opens.**

Offices start work at eight: City Hall, the finance tower, the Cloud Campus. So do the Bank and the Exchange.

The Bank is the only way out. It turns Capital back into $CORP with a 10% markup and issues a voucher. You have one city hour to present it from your wallet, and the $CORP goes straight there. All players share one daily withdrawal limit, and your slice of it depends on your finance tower. Getting in is always cheaper than getting out: a full round trip, from buying $CORP to selling it again, costs 14.45% in fees.

The Exchange lets you buy Stock Tokens with $CORP once your city reaches level 2. The tokens go straight to your wallet.

**09:00. The shops open.**

The two stores earn from the people who live in your city. Population is every seated agent times fifty, plus housing. Population sets your city level, and city level decides how many agents you can hire and how many buildings you can open. It never drops.

**Midday**

This is when the real thinking happens. Only four buildings make Capital. The other fourteen make those four better: a manager in City Hall adds 10% to every producer, an energy plant adds 30% to the workshop. Some of these links cancel each other out, so you choose. Scientists can research five city-wide upgrades. Managers can focus the city on one kind of work.

**20:00, 21:00, 22:00**

The Bank and the offices close at eight. The shops close at nine. At ten, Energy gets expensive again. On city Sundays the Bank doesn't open at all.

**When you leave**

Your city keeps working for 12 hours after you log off, up to 18 as it grows. Then it waits. Those later hours aren't saved for later. They're simply gone.

**Tomorrow comes an hour later**

Because a city day is 25 real hours, the city's clock slides an hour against yours every day. The Bank that opened over breakfast this week will open late at night a few weeks from now. The city doesn't fit around your schedule. You learn its schedule.

**What holds every hour**

The agents have no AI behind them. They follow fixed rules, and anything that looks random comes from a seeded hash, so the same inputs always produce the same day. Every result is written as a record, and each city day's records are sealed with a proof that anyone can check. Your wallet address is never part of them.

There's a demo city for anyone who wants to learn without a wallet. Nothing real moves there, and nothing carries over.

Corporator doesn't promise that every city comes out ahead. Payroll is finite, tokens can lose value, and the Bank keeps its hours.

It hasn't launched yet. There's no official contract address, and any address you're shown before we post one here isn't ours.

It's a few minutes to midnight on the island. The books are about to close.

---

## Версия 5. Жизнь одного `$CORP`

**Концепт:** один токен проходит через всю игру, и на каждой остановке объясняется механика: пул, vault, город, агенты, Payroll, биржа и стоки, призы, Банк. Экономика и геймплей связаны одной нитью, поэтому читатель видит, зачем нужна каждая часть.

---

**The life of one $CORP**

The clearest way to explain Corporator is to follow one coin through it.

Corporator is a 3D city-management game on Robinhood Chain. You play it in the browser, on an island that's already built. Its currency starts outside the game, as a token called $CORP. Here's where one of them goes.

**Stop one: the market**

$CORP trades in a single pool against ETH. There's one pool, and no second pool against stocks or stablecoins.

Every trade in that pool carries a 3% fee. 1% belongs to the pool itself. The other 2% is split four ways: 1% of the trade flows into the game's payroll, 0.6% and 0.2% buy Stock Tokens for two prize pools, and 0.2% goes to the studio.

So before our coin has even entered a city, trading has already put money into the game. Keep that in mind: it comes back at the end.

**Stop two: the vault**

Someone decides to play and deposits our coin into the vault. The vault keeps 2% as a fee and mints Capital, the money of the city.

The rate follows the $CORP price, but slowly. It falls at once when the price falls, and rises no more than 2% a day when it climbs. It can never go above 2,000 Capital for one $CORP. That ceiling carries the one rule the whole economy stands on: no Capital can exist unless $CORP sits in the vault behind it. There's no printing to fill a gap. If the rule would ever break, the game stops the clock rather than break it.

Capital isn't a token. It can't be sent to anyone. It lives in the city.

**Stop three: the city**

The island is the same for every player: hand-built, with eighteen buildings already standing. Nobody builds. You open buildings, and our coin, now Capital, is what opens them.

Every spend splits the same way. 40% is burned. 60% goes into Payroll. That's true for opening a workshop, upgrading it, hiring an agent, researching or unlocking a tier.

Opening a building pays you nothing. A building earns only through the agents working inside it.

**Stop four: the work**

Agents come in five roles: engineers, logisticians, traders, scientists and managers. Each role belongs in certain buildings. An engineer in a workshop makes Capital. The same engineer in the bank does nothing.

Every city hour, which lasts 62 minutes and 30 seconds, the game runs a tick. Each agent either works and files a request to be paid, or records exactly why it couldn't: no Energy, wrong role, outside working hours. Energy and Compute are the only resources that get used up. Only engineers make Energy, and it costs 20% more at night.

How big a request is depends on everything around it. The building's level. The agent's level, up to 60% more at level 5. Its traits and its task. Research. And links: only four buildings make Capital, and the other fourteen can raise their output by 10 to 30% each, as long as the right agent is seated inside.

**Stop five: Payroll**

Our coin, burned in part and fed in part into Payroll, now comes back as pay.

Payroll is one fund for every city on the island. Each midnight it sets a daily budget and splits it across 24 hours. Every hour, all requests from all cities are paid from that hour's pool. When the island asks for more than the pool holds, everyone gets the same fraction. When it asks for less, the pool can pay more than was asked, up to eight times in the first week after launch and up to three times after, as far as the fund allows. Nobody gets zero while the fund has Capital. When it's empty, nothing is minted to refill it.

The fund also has a lid. It never holds more than 30 days of spending. The rest waits in a reserve and trickles back slowly.

**A side road: the stocks**

Some players take their $CORP somewhere else first: the Exchange. It buys Stock Tokens, tokenised shares on Robinhood Chain, and sends them straight to the player's wallet.

Six of those stocks open the city's six industries: NVDA for Compute, TSLA for Energy, AMZN for Logistics, AAPL for Consumer, MSFT for Automation and COIN for Finance. Stake one from your wallet and its district opens, with its flagship building and a bonus. The minimum stake was set at roughly $100 of each stock and then frozen in tokens.

From there, industries climb three tiers. Each tier needs more stake, a higher city level and Capital, and offers two paths. You pick one, for good. Six pairs of industries share a synergy building. Nine other pairs can merge.

Unstaking is always yours to do, with no approval needed. The tokens wait 30 city days and then return to your wallet. The industry freezes after a day's grace if what's left falls below the minimum.

The stock's price never turns into pay. If NVDA rises 20%, nothing in your city rises 20%.

**Stop six: the prizes**

Remember the 0.6% and 0.2% from the first stop? They come back here, as Stock Tokens.

The Farm pays every 7 city days. Work in an industry's flagship building earns fragments, and fragments become a share of that stock's pool. No single city can take more than half of a pool when others worked for it too.

The Monthly prize pays every 30 city days to the ten best cities by Influence. Influence measures what a city earns against what it has spent, so a small city that runs well can outscore a big one that doesn't. To qualify, a city needs six positive days in the period and a live stake. One wallet, one place.

Prizes are never sent automatically. You claim them to your wallet.

**Stop seven: the Bank**

Eventually, some Capital wants to become $CORP again. The Bank does that, with a 10% markup. It issues a voucher, and you present it from your wallet within one city hour.

The Bank keeps office hours, 08:00 to 20:00 city time, and closes on city Sundays. All players share one daily limit, and your slice of it grows with your finance tower. Your deposit doesn't cap what you can take out. The hours, the limits and the vault do.

If our coin made the full trip, bought, deposited, withdrawn and sold, it lost 14.45% to fees on the way, before gas and price moves. Getting in is always cheaper than getting out.

**What the coin never does**

It never becomes Capital without going into the vault. It never pays anyone for opening a building. It never carries a stock's gains into a city. And it comes with no promise that every city ends up ahead.

The agents who handled it have no AI behind them. They follow fixed rules, and the same inputs always give the same result. Every city day's records are sealed with a proof anyone can check, without a wallet address in them.

Corporator hasn't launched. $CORP isn't deployed yet, and any contract address you see before we post one here isn't ours.

When it is, this is the road every coin will take.

---

## Версия 6. Четыре и четырнадцать

**Концепт:** из 18 зданий Capital делают только четыре. Остальные четырнадцать кормят их, усиливают или открывают им путь. Игра подаётся как машина зависимостей, и каждая механика объясняется ответом на вопрос «что она кормит».

---

**Four buildings make money. Fourteen make them better.**

There are eighteen buildings on the Corporator island. Only four of them make money.

That one fact explains most of the game.

Corporator is a 3D city-management game on Robinhood Chain, played in the browser. Every player gets the same hand-built island with the same eighteen buildings already standing. You never build. You open buildings, put agents in them and keep them fed. The four that make Capital are the Workshop, the Robotics Lab and two stores. The other fourteen exist to fuel them, boost them or open the way to them.

**The four**

The Workshop is where every city starts. An engineer inside makes Capital every hour, as long as there's Energy.

The Robotics Lab starts at four times the Workshop's output, and it's the only producer that keeps working with nobody inside, at 60%. But it burns Energy and Compute both, and it belongs to two industries at once, Compute and Energy. If either one freezes, the lab stops.

The Flagship Store and the Retail Complex earn from your population. The more people live and work in your city, the more they bring in, as long as a trader is behind the counter.

**What feeds them**

Two things get used up: Energy and Compute. Nothing else.

Energy comes from power nodes and the energy plant, and only engineers make it. It costs 20% more between ten at night and six in the morning. Compute comes from two labs that turn Energy into it. Logisticians don't make either, but they lower how much Energy your production draws.

If something is missing, the city tells you. Once every city hour, which lasts 62 minutes and 30 seconds, the game runs a tick. Each agent either works and asks to be paid, or records exactly why it couldn't: no Energy, no Compute, wrong role, out of hours.

**What boosts them**

This is where the fourteen earn their keep. A manager in City Hall lifts every producer by 10%. An energy plant with an engineer adds 30% to the workshop. A finance tower with a trader adds 30% to the stores. Some boosts cancel each other out, so you choose which ones to run. On top of that come research, which a scientist works through one topic at a time, and a manager's focus on one kind of work. Stacked all the way, the rules allow roughly twelve and a half times a building's base output, and no more.

**Who runs them**

Agents come in five roles: engineers, logisticians, traders, scientists and managers. Each works fully in its own buildings, at 60% in a few neighbouring ones, and not at all anywhere else. Each rolls one or two traits: a Night Owl barely notices the night rate, a Frugal one uses less and makes less, a Specialist shines at home and struggles elsewhere. Each has a task you can switch, like overclocking a workshop for 10% more output at a steep Energy cost. Agents learn from every paid hour and climb to level 5, where they produce 60% more.

Every hire costs more than the last, and the number of agents you can have depends on your city level.

**How big the machine can get**

Population is every working agent times fifty, plus housing from the stores. Population sets your city level, from 1 to 7, and city level sets how many agents and buildings you can run. It never drops.

**The keys**

Some buildings are locked behind the stock market.

On Robinhood Chain, shares like NVDA and TSLA exist as tokens. Six of them open the city's six industries: NVDA for Compute, TSLA for Energy, AMZN for Logistics, AAPL for Consumer, MSFT for Automation and COIN for Finance. Stake a token from your wallet and its district opens, with a flagship building and a bonus. The minimum was set at roughly $100 of each stock and then frozen in tokens.

Industries climb three tiers. Each tier asks for more stake, a higher city level and Capital, and each one makes you choose between two paths for good. Six pairs of industries share a synergy building, and the Robotics Lab is one of them. Nine other pairs can merge and double their first bonus.

A stock here is a key, not a source of pay. If NVDA rises 20%, nothing you own rises 20%. Unstaking is always yours to do, and the tokens return to your wallet after 30 city days.

**The fuel for all of it: money**

The city runs on Capital. You get it by depositing $CORP, the game's token, into a vault, minus a 2% fee. Capital can't be sent to anyone, and none of it exists unless $CORP sits in the vault behind it.

Every time Capital is spent, 40% burns and 60% flows into Payroll: one fund that pays every working agent in every city. A slice of every $CORP trade flows in too. When the island asks for more than an hour's pool holds, everyone gets the same fraction. When it asks for less, Payroll can pay more than was asked, up to eight times in the first week after launch and three times after. When the fund is empty, nothing is printed to fill it.

To take money out, you go to the Bank. It turns Capital back into $CORP with a 10% markup and sends it to your wallet through a voucher. It keeps hours, closes on Sundays and shares one daily limit between all players. Your finance tower decides your slice. A full round trip costs 14.45% in fees. Getting in is always cheaper than getting out.

**The scoreboard**

The Rating is a public list of every wallet city, ordered by Influence. Influence doesn't reward size. It measures what your city earns against what it has spent, times how many of its hours actually worked and how many of its industries produced. If any one of those hits zero, the whole day scores zero.

Two prize pools pay in Stock Tokens, both filled from trading. The Farm pays every 7 city days for work in each industry's flagship building. The Monthly prize pays every 30 city days to the ten best cities that qualify with six positive days and a live stake. You claim both to your wallet yourself.

**The clock**

A city day lasts 25 real hours, so it drifts an hour against yours every day. When you log off, your city keeps working for 12 hours, up to 18 as it grows. Then it stops. The missed hours aren't saved.

**What isn't in the machine**

There's no AI. The agents follow fixed rules, and the same inputs always produce the same day. Every result is recorded and each city day is sealed with a proof anyone can check. No wallet address goes into it.

There's no payment for opening a building. No stock gains passed to players. No promise that every city ends up ahead.

Corporator hasn't launched. There's no official contract address yet, and any address you're shown before we post one here isn't ours.

Eighteen buildings. Four of them make money. The rest of the game is figuring out the other fourteen.

---

## Сверка фактов (версии 4–6)

Всё из таблицы для версий 1–3 плюс:

| Утверждение | Источник |
|---|---|
| Ничто не меняет вид острова; твоё — экономика за моделями | `city.md` вступление |
| Миллион Capital ≈ доллар `$CORP` по текущему курсу, это соглашение, а не обещание | `economy.md` The mint rate |
| Курс: падает сразу, растёт не быстрее +2% в сутки, потолок 2 000; при нарушении правила тик останавливается | `economy.md` The mint rate, The backing rule |
| Найм дорожает с каждым агентом; случайный чаще инженер; выбор роли за ту же цену | `agents.md` Hiring |
| Трейты Night Owl, Frugal, Specialist, Steady | `agents.md` Traits |
| Overclock: +10% выпуска, +45% энергии | `agents.md` Tasks |
| XP за оплаченный тик; уровень 5 = ×1.60 | `agents.md` Levels |
| Бюджет дня: max(фонд / 14, средний приток за 3 дня), делится на 24 | `economy.md` The daily budget |
| Буст ×8 первые 7 городских дней после запуска, потом ×3 | `economy.md` Each tick's pool |
| Фонд не больше 30 дней трат, излишек в резерв | `economy.md` Fund limits |
| Пул: 3% = 1% кривой + 2% налог (1% Payroll, 0.6% Farm, 0.2% Monthly, 0.2% студия); один пул CORP/ETH | `economy.md` The `$CORP` token |
| Capital делают только 4 здания; 14 дают связки +10…+30%; часть связок взаимоисключающие | `city.md`, `agents.md` Building links |
| Robotics Lab работает пустым на 60%, требует Energy и Compute, синергия Compute + Energy | `agents.md`, `city.md` |
| Потолок модификаторов ≈ ×12.5 | `industries.md` How modifiers combine |
| Население = агенты × 50 + жильё; уровни 1–7; слоты; уровень не падает; биржа с уровня 2 | `city.md` Population and City Level |
| Минимальная ставка ≈ $100 на снимке цены, заморожена в токенах | `industries.md` The six districts |
| Тиры: больше ставки, уровня города и Capital; 6 синергий, 9 слияний; слияние дублирует бонус тира 1 | `industries.md` |
| Анстейк без одобрения; токены через 30 городских дней; заморозка после суток грации | `industries.md` Staking |
| Эффективность 85–115% в 06:00, влияет на Influence, не на выплату | `industries.md` District efficiency |
| Биржа: Stock Tokens за `$CORP` прямо в кошелёк | `economy.md` The Exchange |
| Ваучер: предъявить из кошелька за один городской час | `economy.md` Vouchers |
| Депозит не ограничивает вывод | `economy.md` Hours and limits |
| Магазины 09:00–21:00; офисы и Банк 08:00–20:00 | `city.md` City time |
| Farm: не больше половины пула на город при двух и более | `seasons.md` Fragments and the Farm |
| Квалификация: 6 положительных дней и живая ставка; одно место на кошелёк | `seasons.md` Ranking and prize rank |
| Rating публичный, упорядочен по Influence; ноль любого фактора обнуляет день | `seasons.md`, сайт `rating.ts` |
| Записи дня запечатываются проверяемым доказательством (Merkle-корень и IPFS) | `protocol.md` Determinism and verification |
| Демо-город без кошелька, прогресс не переносится | `index.md` What you need |

Две оговорки для версий 4–6:

- Синергийные здания везде описаны как «общие для пары индустрий», а не «открываются, когда открыты обе». В справочнике (`city.md`) помечено `[NEEDS CONFIRMATION]`, нужны ли для открытия оба района. Точно известно только, что здание останавливается, если любой из двух районов заморожен. Если правило подтвердят, можно писать сильнее.
- Farm-клеймы в предзапусковой версии уже работают, Monthly-клеймы откроются только с продакшн-контрактами. Посты говорят «you claim them yourself» без даты, так что это верно в любом случае.
