# Заметки по тексту сайта `apps/www`

Дата: 2026-09-28. Охват: все строки из `apps/www/src/data/*.ts`, инлайн-строки в `blocks/economy/Panel.tsx`, `blocks/Agents.tsx`, `components/Footer.tsx`, `components/PlayChooser.tsx`, `index.html`. Справочник `docs/public/*.md` проверен поиском по типовому нейрослопу: чисто, правок не требует.

Язык сайта английский, поэтому предложения — на английском. Пояснения — по-русски.

Как читать: **Сейчас** — текущая строка, **Лучше** — замена. Пометка **[факт]** — строка не просто корявая, а расходится с правилами игры или справочником. **[проверить]** — нужен точный эффект из пака, я его не выдумывал.

---

## 0. Что не так в целом

Семь повторяющихся паттернов. Если чинить не построчно, а по ним, 80% текста выправится само.

1. **Абстрактные существительные вместо действия.** `capabilities` (6 раз), `functions`, `operation`, `infrastructure`, `anchor`, `improvements`, `burden`, `specified`. Человек не «добавляет capabilities», он «открывает здание, и оно делает X». Правило: если после слова нельзя спросить «а конкретно что?» и получить ответ в той же фразе — слово вон.
2. **Рефрен «It is not X».** «It is not a token», «not payout percentages», «It is not a universal finance bonus», «It is not a resource you consume», «A rank is not a payment», «It does not pay anyone», «Not in $CORP, not in Capital»… больше десяти раз. Отрицание работает, когда оно одно и важное. Оставить два места: Capital не токен, Rating не платит. Остальное переписать утвердительно.
3. **Рубленые пары и тройки.** «Run the machine. Make it work.», «Six industries. Six Stock Tokens.», «Combine industries. Unlock higher value.» Это самый узнаваемый почерк генератора: две короткие фразы с одинаковым ритмом и ноль смысла во второй.
4. **Внутренний жаргон.** `protocol day`, `06:00 protocol boundary`, `eligible` (4 раза), `beacon`, `S_min`, `Tier-1 bonus`, `ordinary-function slot`, `live pool depth`, `routing and quote capability`. Игрок этих слов не знает, а в справочнике половины из них тоже нет.
5. **Фразы без действующего лица.** «Capital enters Bank authorization.», «Deterministic rules resolve the result.», «Settlement records what you are owed». Кто что делает — непонятно.
6. **Разнобой терминов.** Здание то `switch on`, то `activate`, то `open` (канон — **open**). Индустрия то `industry`, то `branch`, то `district`. `Neighbor` в строках и `Neighboring` в подписи. Кнопки в Title Case (`Play Now`, `Read the Docs`), заголовки в sentence case.
7. **Повторы между блоками.** Hero и Game дословно повторяют «browser 3D city-management game on Robinhood Chain». `Play Now` стоит в шапке, hero, футере, мобильной плашке и дважды в одной карточке (заголовок и кнопка).

**Рекомендация по регистру:** sentence case везде, включая кнопки: `Play now`, `Read the docs`. Имена собственные игры остаются с большой буквы: Capital, Payroll, Vault, Bank, Influence.

**Чего избегать в новых заголовках:** unlock, elevate, master, journey, seamless, power up, next level; обещаний дохода («earn», «profit», «get rich»). Последнее — не вкус, а канон: сайт не обещает, что игрок будет в плюсе.

---

## 1. Hero — `data/hero.ts`

**Заголовок сейчас:** `Run the machine. Make it work.`

Проблема: паттерн 3. «Машина» ни к чему не привязана, в игре нет машины, есть остров. Вторая фраза повторяет первую.

**5 вариантов:**

1. `The city is built. Now make it run.` — сразу снимает главный вопрос «а строить?»; ритм спокойный, без рубки.
2. `Every building is ready. None of them are running.` — интрига: читатель ждёт «и что мне делать?», и подзаголовок отвечает.
3. `Somebody has to run this island.` — разговорно, с лёгкой иронией, приглашает стать этим «кем-то».
4. `An island full of empty seats` — образ из механики (места для агентов), без глагола-приказа.
5. `Keep the lights on. Keep the island working.` — если хочется оставить двойной ритм, пусть обе половины несут смысл (Energy и работа).

**Мой выбор:** 2 или 1. Вариант 2 цепляет сильнее, вариант 1 понятнее с первого взгляда.

**Подзаголовок**

- Сейчас: `A browser 3D city-management game on Robinhood Chain where you switch on the functions of an existing island and keep the work supplied.`
- Лучше: `A 3D city game in your browser, on Robinhood Chain. The island is already built. You open its buildings, hire agents and keep Energy and Compute flowing.`
- Почему: «switch on the functions of an existing island» — канцелярит; «keep the work supplied» — непонятно чем. Три коротких предложения читаются быстрее одного длинного.

**Кнопки и подпись**

| Сейчас | Лучше | Почему |
|---|---|---|
| `Play Now` | `Play now` | регистр |
| `How it works` | `How it works` | текст хороший, но **кнопка не работает**: в `Hero.tsx` `onClick` вызывает `preventDefault()` и больше ничего. Это баг поведения, не текста. |
| `Robinhood chain` | `Built on Robinhood Chain` | имя сети с маленькой буквы — ошибка; голое название рядом с логотипом ничего не говорит |

---

## 2. Game — `data/game.ts`

**Заголовок сейчас:** `A city to operate not to build`

Проблема: нет запятой перед `not`; `operate` — слово из вакансии оператора станка.

**5 вариантов:**

1. `Nothing to build. Plenty to run.` — та же мысль, но с ритмом и без канцелярита.
2. `You don't build this city. You run it.` — прямой контраст; один раз на странице он уместен.
3. `From a quiet island to a working one` — показывает путь, который описывают четыре шага ниже.
4. `How a quiet island starts earning its keep` — чуть теплее; «earning its keep» — «окупать себя», не обещание прибыли игроку.
5. `Four steps to your first paid shift` — конкретно, подводит к шагам 01–04.

**Мой выбор:** 1 — короче и точнее всех.

**Абзацы**

- Сейчас: `Corporator is a browser 3D city-management game on Robinhood Chain. You take charge of an island that already has workshops, power infrastructure, research facilities, and financial buildings. You switch on their functions and keep the operation supplied.`
- Лучше: `You take over an island that's already built: workshops, power plants, research labs, a bank. Nothing runs until you open a building, put an agent inside and keep the Energy coming.`
- Почему: первое предложение дословно повторяет hero, его убрать. «power infrastructure», «research facilities», «operation» — паттерн 1.

- Сейчас: `The island does not grow when you spend Capital. Your progress changes what the city can do.`
- Лучше: `Spending Capital won't add a single tower to the skyline. It makes the buildings you already have better at their jobs.`
- Почему: «progress changes what the city can do» — пустая формула. Новая версия конкретна и с картинкой.

**Шаги**

| # | Сейчас (заголовок) | Лучше | Сейчас (текст) | Лучше |
|---|---|---|---|---|
| 01 | `Get Capital.` | `Bring in $CORP` | `Deposit $CORP into the Vault. You receive Capital at the current mint rate, after a 2% entry fee.` | `Deposit $CORP into the Vault and get Capital at the current mint rate, minus a 2% entry fee.` |
| 02 | `Switch on and staff.` | `Open a building` | `Activate a function in an existing building. Assign a compatible agent.` | `Pick a building on the island, open it and seat an agent whose role fits.` |
| 03 | `Supply the work.` | `Keep it supplied` | `Every tick the city checks access, schedule, resources, and assignment. Missing Energy stops a Workshop.` | `Every tick the city checks four things: access, opening hours, resources and who's seated. A Workshop without Energy simply stops.` |
| 04 | `Get paid, then decide.` | `Get paid, then choose` | `Eligible work creates a payment request. Payroll pays what its finite fund allows. Reinvest, or request an exit through the Bank.` | `Work that ran asks Payroll for Capital. Payroll pays what its fund can afford. Put it back into the city, or cash out through the Bank.` |

Точки в конце заголовков шагов убрать: это заголовки, не предложения.

**Подсказки**

- `Payroll: a finite fund. It can pay more than requested while the boost and the fund allow it, less than requested, or nothing.` → `Payroll: a limited fund. Depending on the boost and what's left, it can pay more than you asked for, less, or nothing.`
- `Capital: an internal unit, not a token.` и `Tick: one city hour, 62 min 30 s of real time.` — хорошие, оставить.

---

## 3. Agents — `data/agents.ts`, инлайн в `blocks/Agents.tsx`

**Заголовок сейчас:** `The right agent in the right seat`

Не плохо, но это клише из HR-статей.

**5 вариантов:**

1. `Five roles. Choose where they sit.` — конкретика (пять ролей) и действие игрока.
2. `Hire well. Seat them better.` — лёгкая игра слов, про суть механики совместимости.
3. `Agents do the work. You pick the seat.` — чёткое разделение ролей игрока и агента.
4. `No AI magic. Just good hiring.` — опирается на сильный факт блока (нет языковой модели) и отстраивает от «AI-агентов» конкурентов.
5. `Every seat has a favorite role` — любопытство; ниже карточки объясняют, какая роль где «дома».

**Мой выбор:** 4 — единственный заголовок на сайте, который говорит то, чего не скажет никто другой.

**Абзацы**

- `Agents are workers. You choose where each one works and what task it does. Deterministic rules resolve the result.` → `Agents are your staff. You decide where each one sits and what it works on. The outcome follows fixed rules, the same way every time.`
- `There is no language model anywhere in the product. Agents run on a deterministic policy engine, traits, and seeded variation. They do not spend your funds on their own.` → `There's no language model behind them, anywhere. An agent acts on its role, level and traits, plus a bit of seeded randomness that replays exactly. Agents never spend your money on their own.`
- `Each agent has a role, a level, traits, a workplace, and a task.` → удалить или заменить на `Every card below shows the same five things: role, level, traits, workplace and task.` Сейчас это просто список без смысла.

**Подписи**

| Сейчас | Лучше |
|---|---|
| `These values feed into performance. They are not payout percentages.` | `How well the agent works here. Not how much you get paid.` |
| `Home` / `Neighbor` / `Incompatible` · `Cannot work` | `Best fit` / `Can cover` / `Wrong fit` · `Can't work here` |
| `Home seat` / `Neighboring` (в `Agents.tsx`) | `Best fit` / `Can cover` — одинаково со строками выше |
| `Logistics and idle reduction` | `Logistics, less downtime` |
| `Research and computing` | `Research and Compute` |
| `Meet the agents` | оставить |

---

## 4. Buildings — `data/buildings.ts`

**Заголовок сейчас:** `18 buildings, each with a job`

Нормально, но плоско.

**5 вариантов:**

1. `Already built. Waiting to open.` — главный факт блока (здания стоят, их открывают) сразу в заголовке.
2. `Eighteen doors to open` — образ, который совпадает с каноном «здания открываются».
3. `What's on the island` — простой, почти путеводитель; хорош, если блок читают как справочник.
4. `The island, building by building` — то же, но с ощущением прогулки.
5. `Know what a building does before you open it` — полезный совет вместо лозунга.

**Мой выбор:** 1 или 2.

**Лид**

- Сейчас: `Every building is already on the island. You switch on its function, staff it, and upgrade it through three levels. Levels change what a function can do. They do not add structures.`
- Лучше: `Every building is already standing. You open it, seat an agent and take it up through three levels. A new level makes the building better at its job. It never adds a new tower.`

**Подсказки и замки**

| Сейчас | Лучше |
|---|---|
| `Autonomous: works without an agent` | `Autonomous: works at 60% with nobody seated` |
| `Prebuilt: active from the start` | `Prebuilt: open from day one` |
| `Home role: the agent role that works here at full strength` | `Best fit: the role that works here at 100%` |
| `Needs both industries` | `Needs both industries open` |

**Здания**

| Здание | Поле | Сейчас | Лучше |
|---|---|---|---|
| City Hall | role | `The civic and administrative anchor of the city.` | `The heart of the city. It grows with your City Level.` |
| City Hall | tip | `Nothing to manage here. It takes no ordinary-function slot.` | `Nothing to run here, and it doesn't use up one of your building slots.` |
| Workshop | role | `The base Capital-production workplace.` | `Your first Capital maker.` |
| Workshop | tip | `Check Energy and the task before upgrading. Another Workshop won't fix a power shortage. It gives you more production waiting for power.` | `Before you upgrade, check Energy and the task. Another Workshop won't fix a power shortage. It just adds one more machine waiting for power.` |
| Agent Hub | role | `Infrastructure for your workforce.` | `Room to hire more agents.` |
| Agent Hub | levels | `Three levels raise its workforce support.` | `Each level adds hiring capacity.` |
| Agent Hub | tip | `Extra hiring capacity only helps when there are assignments worth filling.` | `More hiring room only helps if you have seats worth filling.` |
| Power Node | tip | `Reach for it when Energy is what holds your work back.` | `Open it when Energy is what's holding you back.` |
| Bank | role | `The exit from Capital.` | `Where Capital turns back into $CORP.` |
| Bank | levels | одна фраза на 35 слов | `Your Bank Level matches your Finance Tower and sets your slice of the daily withdrawal limit: 25%, 43.75%, 57.82%. A fourth step exists but isn't reachable yet.` |
| Bank | tip | `A bigger personal share still sits under the global limit and the backing.` | `A bigger slice still can't go past the shared daily limit or the Vault's backing.` |
| Exchange | role | `The Stock Token purchase service.` | `Where you buy Stock Tokens.` |
| Exchange | levels | `Three levels raise its routing and quote capability.` | **[проверить]** что конкретно дают уровни Exchange; без этого строка пустая |
| Exchange | tip | `Check the asset, the route, and the stake amount before you buy.` | `Before you buy, check the token, the route and how much you need to stake.` |
| AI Research Center | tip | `Worth it when Compute is scarce and Energy is available. Compute comes from an Engineer or an autonomous seat. A Scientist here trains and researches, but does not make the building output Compute.` | `Worth opening when Compute is short and Energy isn't. Seat an Engineer to get Compute out of it. A Scientist here trains and researches instead.` |
| Energy Plant | tip | `It supports heavier production and computing work.` | `The bigger supply you'll need once production and Compute get heavy.` |
| Logistics Hub | tip | `Check whether idle time, not missing resources, is your constraint.` | `Open it when buildings sit idle, not when they're short of resources.` |
| Flagship Store | role | `Housing and population-linked Capital activity.` | `Housing, and Capital from the people who live there.` |
| Flagship Store | tip | `Housing and Population-to-Capital use different modifiers. A conversion bonus does not add housing.` | `Housing and the Capital you get from residents are boosted separately. A bonus to one doesn't add to the other.` |
| Cloud Campus | role | `Workforce capacity and offline capabilities.` | `More staff capacity and longer offline time.` |
| Cloud Campus | levels | `Three levels strengthen its capacity effects.` | `Each level adds to both.` |
| Cloud Campus | tip | `Check which effects come from the function and which need tier progression.` | `Some effects come with the building, others only with Automation tiers.` |
| Finance Tower | role | `Banking capability.` | `Sets your Bank Level.` |
| Finance Tower | levels | `Three levels raise its banking capability. Your Bank Level follows this building.` | `Each level raises your Bank Level, and with it your slice of daily withdrawals.` |
| Finance Tower | tip | `A higher personal limit does not create more global liquidity.` | `A bigger personal limit doesn't make the shared limit any bigger.` |
| Robotics Lab | role | `Autonomous Capital production.` | `Makes Capital even with nobody seated.` |
| Robotics Lab | tip | `It uses no ordinary-function slot, but it still needs both resources.` | `It doesn't use a building slot, but it still needs Energy and Compute.` |
| Drone Depot | role | `Strong idle reduction.` | `Cuts idle time hard.` |
| Drone Depot | tip | `Compare it with the idle reduction you already have.` | `Compare it with the idle cuts you already have.` |
| Fleet Yard | role | `Logistics support and lower Energy burden on specified costs.` | `Less idle time, and cheaper Energy on some costs.` **[проверить]**, что «logistics support» — это именно снижение простоя |
| Fleet Yard | tip | `Its modifiers cut specific costs, not every Energy expense.` | `It cuts some Energy costs, not all of them.` |
| Clearing House | role | `Fund-share and banking improvements.` | **[проверить]** точный эффект из пака, потом одна конкретная фраза |
| Clearing House | tip | `Read the exact effect. It is not a universal finance bonus.` | удалить: сайт не показывает «exact effect», читателю негде его прочитать |

Остальные строки (Power Node role, Energy Plant role, Data Center, Retail Complex, уровни с цифрами жилья) — в порядке, оставить.

---

## 5. Industries — `data/industries.ts`

**Заголовок сейчас:** `Six industries. / Six Stock Tokens.`

Проблема: паттерн 3, и вторая строка ничего не объясняет — как связаны индустрии и токены?

**5 вариантов:**

1. `Stake a stock, open a district` — вся механика в пяти словах.
2. `Six districts, each behind a stock` — образ «за дверью»: чтобы войти, нужен токен.
3. `Your Stock Tokens open the city` — про игрока и его токены, а не про систему.
4. `NVDA runs Compute. COIN runs the money.` — самый живой: реальные тикеры вместо абстракций. Минус: по канону тикеры сменные, заголовок придётся менять вместе с ними.
5. `Pick your industries` — просто и честно; хорош, если блок должен читаться как выбор стратегии.

**Мой выбор:** 1.

**Лид**

- Сейчас: `External Stock Tokens open six industry branches. Each branch adds its own capabilities.`
- Лучше: `Each of the six industries opens with a stake in its Stock Token: NVDA for Compute, TSLA for Energy, and so on. Every industry gives the city something the others can't.`
- И везде убрать `branch`: на сайте «industry», в HUD «Industries». Третье слово для той же сущности только путает.

**Карта синергий**

Заголовок сейчас: `Combine industries. / Unlock higher value.` — `Unlock higher value` не значит ничего.

**5 вариантов:**

1. `Some industries work better in pairs` — утверждение, которое карта ниже тут же доказывает.
2. `Open two, get a third` — две индустрии, и появляется синергийное здание; коротко и с загадкой.
3. `Better together: six synergy buildings` — прямо говорит, что будет на карте.
4. `Pair them up` — разговорный призыв.
5. `Which industries get along` — очеловечивает индустрии, лёгкая ирония.

**Мой выбор:** 2 или 1.

- Кикер `Synergy map` — оставить.
- `Industries work together. Choose an industry to see which branches it connects with and what synergies become available.` → `Some industries pair up. Open both, and a synergy building becomes available. Pick an industry to see its partners.`
- `Example synergies` → `Synergy buildings` (это не примеры, это полный список).

**Карточки индустрий**

| Индустрия | Сейчас | Лучше |
|---|---|---|
| Energy | `The supply beneath everything else. Energy Plant adds Energy.` | `Everything else runs on it. The Energy Plant adds supply.` |
| Logistics | `Cuts idle time. It is not a resource you consume.` | `Cuts idle time. Unlike Energy, it never gets used up.` |
| Consumer | `Housing and population-linked retail activity.` | `Housing, and shops that earn from the people living there.` |
| Finance | `Banking and fund-related capabilities.` | `The money side: your Bank Level and how much you can withdraw.` |

Compute и Automation — оставить.

**Подсказка по узлам**

- `… Breadth −10% activation cost …` → `… Breadth −10% opening and upgrade prices …` **[факт]**: в справочнике (`industries.md`, `city.md`) Breadth снижает цену открытия и апгрейда, а «activation» — не термин игры.

**Вкладки внизу блока**

| Где | Сейчас | Лучше |
|---|---|---|
| Industries · заголовок | `Industry system` | `How industries work` |
| Industries · текст | `Six branches, one shared city. Each industry adds its own capabilities to the existing island.` | `One island, six industries. Each one gives the city something new.` |
| 6 branches · заголовок | `6 branches` | `6 industries` |
| 6 branches · текст | `… Six industry branches define different capabilities.` | `Compute · Energy · Logistics · Consumer · Automation · Finance. Each does one job for the city.` |
| 6 Stock Tokens | `One token per industry. Hold and stake Stock Tokens to open industry branches.` | `One token per industry. Stake it from your wallet to open that industry.` |
| Synergies | `Combine industries to unlock new capabilities. Certain industry pairs unlock synergy buildings.` | `Six pairs of industries each open a synergy building.` |
| Access | `… The minimum is a fixed quantity. A price drop alone does not raise it.` | `… The minimum is counted in tokens, not dollars, so a price drop doesn't raise it.` |
| Choices | `Each industry has three tiers with two exclusive choices. Pick one side and you lose the other. Six industries make 36 nodes. Respec is not available.` | `Each industry has three tiers, and each tier asks you to pick one of two nodes. The other side closes for good. There's no respec.` |
| Unstake | `You can unstake yourself. No administrator approval is needed. If your stake falls below the requirement, the industry gets a 24-city-hour grace period before it freezes.` | `You unstake yourself, no approval needed. The tokens come back to your wallet after a 30-city-day cooldown. If what stays staked drops below the minimum, the industry gets 24 city hours of grace, then freezes.` **[факт]**: сейчас на сайте нет 30-дневного кулдауна, а в справочнике он есть |

---

## 6. Economy — `data/economy.ts`, инлайн в `blocks/economy/Panel.tsx`

**Заголовок сейчас:** `$CORP in, Capital inside, $CORP out`

Смысл верный, но читается как схема, не как заголовок.

**5 вариантов:**

1. `Follow the money` — классика, всем понятно, что дальше будет путь денег.
2. `Every $CORP, accounted for` — намекает на главное свойство экономики: Capital всегда обеспечен.
3. `How $CORP becomes Capital, and back again` — самый понятный для новичка.
4. `In with $CORP, out with $CORP` — сохраняет идею текущего заголовка, но звучит как фраза.
5. `Where the money goes` — простой, почти бытовой; снимает страх «а куда уходят мои токены».

**Мой выбор:** 2 для характера, 3 для ясности.

**Лид**

- Сейчас: `$CORP is the external token. / Capital is the internal unit that pays for city actions. / It is not a token.`
- Лучше: `$CORP is the token in your wallet. Inside the city you spend Capital. Capital isn't a token: it never leaves the game, and it's only created when $CORP goes into the Vault.`

**Заголовки колонок (инлайн в `Panel.tsx`)**

| Сейчас | Лучше |
|---|---|
| `Capital flow` | `How you get in` |
| `Economic assets` | `What's what` |
| `Fees` | оставить |
| `Work flow` | `How work gets paid` |
| `Exit flow` | `How you cash out` |
| `Prize flow` | `Where prizes come from` |
| `Learn more about capital` | `More on deposits` (и `capital` с маленькой — ошибка, это имя собственное) |
| `Learn more about work` | `More on Payroll` |
| `Learn more about exit` | `More on withdrawals` |
| `Learn more about prizes` | `More on prizes` |
| `Read the economy guide` | `How the economy works` |

**Кто есть кто**

| Сейчас | Лучше |
|---|---|
| `External token and Vault backing.` | `The token. It sits in your wallet or backs Capital in the Vault.` |
| `Internal spending and payment unit.` | `What you spend and earn inside the city.` |
| `Industry access and reward assets.` | `Stake them to open industries. Prizes pay in them too.` |
| `Finite Capital fund that pays eligible work.` | `A limited fund that pays for work done.` |
| `Score. It cannot be spent.` | `Your score. You can't spend it.` |
| `Internal accounting for the Farm pool.` | `Your tally for the Farm pool. Not a token.` |

**Сборы**

| Сейчас | Лучше |
|---|---|
| `of which: fund` | `→ Payroll fund` |
| `of which: Monthly stock pool` | `→ Monthly prizes` |
| `of which: Farm stock pool` | `→ Farm prizes` |
| `of which: Studio` | `→ Studio` |
| `Curve fee (pools)` | `Pool fee` |
| `Combined headline DEX fee` | `Total per DEX trade` |
| `Bank markup 10%` + `down to 6.5% with Trader effects` | `Bank markup 10%`, пометку убрать. **[факт]**: справочник (`economy.md`, `agents.md`, `reference.md`) говорит, что Desk у Trader пока не снижает наценку. Сайт обещает то, чего нет. |

**Подписи к шагам схем**

| Схема | Сейчас | Лучше |
|---|---|---|
| Enter | `External token` / `Deposit $CORP` / `Internal unit` / (пусто) | `In your wallet` / `You deposit, pay 2%` / `Minted for your deposit` / `Open, upgrade, hire` |
| Work | `Activate functions, assign agents.` | `Open buildings, seat agents.` |
| Work | `Work creates payment requests.` | `Each working seat asks to be paid.` |
| Work | `Pays from a finite fund.` | `Pays what the fund allows.` |
| Work | `Funds reach your balance.` | `Lands on your city balance.` |
| Exit | `Capital enters Bank authorization.` | `You ask the Bank to cash out.` |
| Exit | `The Bank authorizes the exit.` | `It checks hours, limits and backing.` |
| Exit | `Signed authorization, valid for 62 min 30 s.` | `A signed pass, good for 62 min 30 s.` |
| Exit | `$CORP is released to your wallet.` | `You present it; $CORP lands in your wallet.` |
| Prizes | `Prize funding source.` | `0.8% of every trade` |
| Prizes | `Monthly + Farm.` | `Monthly and Farm` |
| Prizes | `Six positive days and live stake.` | `Six positive days and a live stake` |
| Prizes | `Eligible wallet claims rewards.` | `You claim to your wallet` |

Подсказка `Voucher: a signed authorization to release $CORP, valid for 62 min 30 s.` → `Voucher: a signed pass you present to the Vault to collect your $CORP. Good for 62 min 30 s.`

**Payroll — `workBody`**

Сейчас это стена из восьми предложений одним абзацем. Лучше разбить на три:

> `40% of what you spend in the city is burned. The other 60% goes to Payroll.`
>
> `Payroll pays for work from a fund that can run dry. Every city day at midnight it sets a budget: the fund divided by 14, or the average inflow of the last three city days, whichever is bigger. The budget is split across 24 ticks.`
>
> `For the first 7 city days Payroll can pay up to 8× what work asks for, then up to 3×, as far as the tick budget and the fund allow. When requests outgrow the pool, everyone is cut by the same share. When the fund is empty, even valid work earns nothing.`

**Bank**

| Сейчас | Лучше |
|---|---|
| `Role: The exit from Capital.` | `Role: Turns Capital back into $CORP.` |
| `Bank Level: Follows the Finance Tower level.` | `Bank Level: Matches your best working Finance Tower.` |
| `The ladder has a fourth step, but the current version does not reach it.` | `A fourth step exists but isn't reachable yet.` |
| `Your Bank Level sets your share of the daily global withdrawal limit.` | `The higher your Bank Level, the bigger your slice of the daily limit all cities share.` |

**Призы**

- Monthly (`prizesBody`): `Two Stock Token pools are funded from DEX turnover, not from Capital spending. Monthly gets 0.2%, Farm gets 0.6%. Monthly places and claims are explained on the Leaderboard page.` → `Paid in Stock Tokens to the top ten cities of each 30-day period. Funded by 0.2% of DEX trading, not by what players spend in the city. How places are paid is on the Leaderboard page.` Сейчас текст под заголовком Monthly говорит про оба пула, и Farm дублируется с соседней колонкой.
- Farm (`farmBody`): `Farm pays for active work. Only paid, non-idle ticks in industry beacon buildings earn fragments. …` → `Farm rewards steady work in each industry's main building. Every paid tick without idle time earns fragments. A window lasts 7 city days. At the end, your fragments turn into a share of the pool, and you claim it to your wallet. When two or more cities share a pool, no single city takes more than half.`

**Блоки правил**

| Где | Сейчас | Лучше |
|---|---|---|
| заголовок | `Payment rules` | `How Payroll pays` |
| заголовок | `Exit rules` | `Before you cash out` |
| заголовок | `Prize rules` | `How to qualify for a prize` |
| Payroll | `0 paid when the fund is empty` / `An empty fund pays zero for valid work.` | `Empty fund, no pay` / `Even valid work earns nothing.` |
| Payroll · сноска | `Payroll is finite. Valid work can be paid less, or not at all.` | `Payroll can run low. Good work can be paid less, or not at all.` |
| Exit | `08:00–20:00 city time; closed on city Sunday.` | `Open 08:00–20:00 city time. Closed on city Sundays.` |
| Exit | `Base markup` / `10%; Trader effects can lower it to 6.5%.` | `Markup` / `10% on every withdrawal.` **[факт]**, то же расхождение, что в таблице сборов |
| Exit | `5% of live pool depth in ETH.` | `All cities together can take out up to 5% of the pool's ETH depth a day.` |
| Exit · сноска | `Capital is not a token. Bank exits have hours, limits, and coverage conditions.` | `Withdrawals have opening hours and a daily limit, and the Vault must cover them.` |
| Prizes | `A playable industry stake must be live when the period settles.` | `You need a live stake in at least one industry when the period closes.` |
| Prizes | `The eligible wallet claims the prize from the prize treasury.` | `Nothing arrives by itself. You claim the prize to your wallet.` |

Константу `bankMarkupFloor` в `economy.ts` после правки можно убрать: она больше нигде не нужна.

---

## 7. Футер и окно «Play» — `data/shell.ts`, `components/Footer.tsx`, `components/PlayChooser.tsx`

**Заголовок футера сейчас:** `Start with one working operation`

Проблема: «operation» — паттерн 1; звучит как бизнес-план.

**5 вариантов:**

1. `Start small. Get one building running.` — тот же совет, человеческими словами.
2. `Try it before you stake anything` — снимает главный страх: можно начать без денег.
3. `One building, one agent, one paid tick` — конкретный первый результат, к которому легко прийти.
4. `The island is waiting` — эмоциональная точка в конце страницы, без давления.
5. `Your first shift starts in the demo` — ведёт прямо к кнопке демо.

**Мой выбор:** 2 или 1.

| Сейчас | Лучше |
|---|---|
| `Aim for one useful operation, not several unsupported ones. Demo gives you an isolated city to learn on.` | `Get one building fully running before you open the next. The demo is a practice city, and nothing real is at stake.` |
| `Read the Docs` | `Read the docs` |
| `Contract TBA` | `Contract: not live yet` |
| `The contract address will appear here once it is deployed. Copy it only from this site or from our official X account.` | `The contract address shows up here at launch. Copy it only from this site or our official X account.` |
| модалка `Play Now` | `How do you want to play?` |
| `Demo is an isolated city. No real assets move, and demo progress does not transfer to a wallet city.` | `The demo is a practice city. Nothing real moves, and demo progress doesn't carry over to a wallet city.` |
| `Play demo` / `Play with wallet` | `Try the demo` / `Connect wallet` |

Дисклеймер — оставить как есть: он точный, а у юридического текста другие правила.

---

## 8. Страница Leaderboard — `data/leaderboard.ts`

**Заголовок сейчас:** `The prize Leaderboard`

Проблема: смешанный регистр, и слово «Leaderboard» уже в хлебных крошках.

**5 вариантов:**

1. `Top ten, paid in stocks` — сразу ответ на «что тут дают».
2. `Who gets paid this period` — вопрос, который реально задаёт игрок.
3. `Ten places. Six stocks.` — если нужна короткая пара, то эта хотя бы несёт факты.
4. `Monthly prizes` — просто и совпадает с термином игры.
5. `The table that pays` — противопоставление с Rating, который не платит.

**Мой выбор:** 1 или 5.

**Интро**

- `The Leaderboard is the prize list. It is stricter than the Rating: only qualified cities count, and each wallet gets one slot. Places go by Influence.` → `This is the list that pays. It's stricter than the Rating: only qualified cities make it, one per wallet, ranked by Influence.`

**Подзаголовки секций** (по 3 варианта, первый — рекомендация)

| Сейчас | Варианты |
|---|---|
| `Who qualifies` | `Getting on the board` · `Who makes the cut` · `What it takes` |
| `One slot per wallet` | `One wallet, one place` · `Many cities, one slot` · оставить |
| `What is paid` | `What you win` · `The prize` · `What's in the pool` |
| `Where the pool comes from` | `Who pays for it` · `Where the tokens come from` · оставить |
| `Claiming` | `Collecting your prize` · `How to get it` · оставить |
| `What resets` | `What starts over` · `Every 30 days` · оставить |

**Строки**

| Сейчас | Лучше |
|---|---|
| `Positive day: a protocol day with GDP above zero.` | `Positive day: a city day with GDP above zero.` **[факт]**: в справочнике «protocol day» нет, день GDP закрывается в 00:00 по городскому времени |
| `… Six of thirty is 20% of the period.` | удалить, это арифметика ради арифметики |
| `So two cities can swap places on the Rating and keep the same prize places.` | `That's why two cities can swap places on the Rating without changing their prize places.` |
| `… Not in $CORP, not in Capital.` | `… Only Stock Tokens, never $CORP or Capital.` |
| `A rank is not a payment. You claim your prize yourself: the eligible wallet pulls it from the prize treasury. Demo cities cannot claim real prizes.` | `Winning a place doesn't send you anything. You claim the prize yourself, from the prize treasury to your wallet. Demo cities can't claim real prizes.` |
| `Settlement runs at the 06:00 protocol boundary every 30 days. Then Influence and your count of positive days go back to zero.` | `Every 30 city days, at 06:00 city time, the period settles. Influence and positive days start again from zero.` **[факт]**, тот же жаргон; встречается дважды |
| `GDP as your city's economy` | `your city's economy` |

**Панели**

| Сейчас | Лучше |
|---|---|
| `01 — Qualify` / `Six positive days to qualify.` | `01 — Qualify` / `Six positive days and a stake` (сейчас «qualify» два раза подряд) |
| `02 — 30 days` / `30-day prize period` | `02 — 30 days` / `Every 30 city days` |
| `03 — Get paid` / `The top 10 places split each asset.` | `03 — Get paid` / `The top ten split every token` |
| `Same weight for NVDA, TSLA, AMZN, AAPL, MSFT, and COIN. Not one token per place. The eligible wallet claims the prize in Stock Tokens. Empty places get nothing.` | `Each of the six tokens is split the same way. Place 1 doesn't get NVDA while place 2 gets TSLA: every place gets a slice of each. Empty places get nothing.` |

**Карточки внизу**

- `Play Now` / `Start with a demo city. No wallet needed.` / кнопка `Play Now` → заголовок `Try the demo`, текст оставить, кнопка `Play now`. Сейчас заголовок и кнопка — одно и то же.
- То же на странице Rating.

---

## 9. Страница Rating — `data/rating.ts`, `data/clocks.ts`

**Заголовок сейчас:** `The Rating`

Проблема: это название, не заголовок; ничего не обещает.

**5 вариантов:**

1. `Every city, ranked` — ровно то, что на странице, в трёх словах.
2. `Where every city stands` — чуть теплее, с намёком на «а где я».
3. `Who's ahead` — разговорно, коротко, цепляет соревновательность.
4. `The scoreboard` — сразу ясно, что это счёт, а не выплата.
5. `Standings` — сухо и по-спортивному; хорошо, если хочется строгости.

**Мой выбор:** 1.

**Интро**

- `The Rating is the public list of wallet cities, ordered by Influence. It shows who is ahead. It does not pay anyone. Prizes are on the Leaderboard.` → `Every wallet city, ranked by Influence. It's a scoreboard, not a payout. Prizes live on the Leaderboard.`

**Подзаголовки секций**

| Сейчас | Варианты |
|---|---|
| `How Influence is counted` | `Where Influence comes from` · `How the score works` · оставить |
| `Zero test` | `One zero ruins the day` · `The zero rule` · `Why one factor matters` |
| `How to climb faster` | `How to climb` · `Moving up` · `Four ways up` |

**Строки**

| Сейчас | Лучше |
|---|---|
| `Day GDP: Capital actually paid to this city during the current protocol day.` | `Day GDP: Capital actually paid to this city today, by city time.` **[факт]** protocol day |
| `Every protocol day your city gets one number. It is the product of four factors. Each one is neutral at 10,000. Influence is the sum of those daily numbers over the current 30-day period.` | `Each city day your city scores one number: four factors multiplied together, each neutral at 10,000. Add up those daily scores over the 30-day period and you get Influence.` |
| `A demo session can watch the table.` | `You can watch the table from a demo.` |
| `Turn one factor to zero. The day scores zero.` | `Drop any factor to zero, and the whole day scores zero.` |

Факторы и советы написаны хорошо — оставить.

**Часы (`clocks.ts`)**

| Сейчас | Лучше |
|---|---|
| `7 city days (175 hours). Fragments for the Farm pool.` | `7 city days (175 hours). How long you earn Farm fragments.` |
| остальное | оставить |

---

## 10. Не текст, но нашлось по дороге

1. **Кнопка `How it works` в hero ничего не делает:** `onClick` вызывает только `preventDefault()`, прокрутки к `#game` нет.
2. **У главной нет meta description и `og:description`.** В `index.html` только `og:title` и `<title>Corporator</title>`, а `pageMeta` в `shell.ts` покрывает лишь `/rating` и `/leaderboard`. Для превью в X и поиске это пустая карточка. Предложение: `A 3D city game on Robinhood Chain. The island is already built: open its buildings, hire agents and keep the work running.`
3. **Monthly-призы.** В справочнике сказано, что выдача Monthly закрыта до деплоя продакшн-контрактов. На сайте строки про «you claim» написаны как будто уже работает. Leaderboard пока под замком, так что вреда нет, но при открытии страницы этот момент надо сверить.

---

## Сводка фактических расхождений

| # | Где | Что |
|---|---|---|
| 1 | `economy.ts`, сборы и правила выхода | Trader снижает наценку до 6.5%, а справочник говорит, что пока нет |
| 2 | `industries.ts`, вкладка Unstake | нет 30-дневного кулдауна |
| 3 | `industries.ts`, подсказка узлов | Breadth — «activation cost» вместо «opening and upgrade prices» |
| 4 | `leaderboard.ts`, `rating.ts` | «protocol day» и «06:00 protocol boundary» вместо городского дня и 06:00 по городскому времени |
| 5 | `buildings.ts` | Exchange (уровни), Clearing House, Fleet Yard — нужен точный эффект из пака |
| 6 | `game.ts` | нет запятой в заголовке |
| 7 | `hero.ts` | «Robinhood chain» с маленькой буквы |
