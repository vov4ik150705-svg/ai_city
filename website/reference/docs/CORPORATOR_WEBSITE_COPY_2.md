# CORPORATOR: Website Copy (Step 3)

Язык сайта: EN. Пометки для команды: RU.
Все цифры взяты из документации (PUBLIC_DOC и MASTER_HANDOFF). Цен нигде нет: ни на зданиях, ни у тиров, merge и исследований.
Сверено с документацией: rules 0.24.0, pack 187.
Структура: лендинг (0 Шапка, 1 Hero, 2 Что это за игра, 3 Индустрии, 4 Здания, 5 Агенты, 7 Экономика и токен, 9 Финал и футер) и две отдельные страницы: Rating и Leaderboard. Тизера Rating и Leaderboard на лендинге нет. Блока FAQ нет. Номера блоков ниже — только оглавление этого файла. На сайте нумерацию не писать нигде: ни «03 — Industries», ни любые такие метки.

## Карта сайта

| URL | Что это | Где текст |
|---|---|---|
| `/` | Лендинг | Шапка, Hero, Что это за игра, Индустрии, Здания, Агенты, Экономика, Финал и футер |
| `/rating` | Публичная таблица и как считается Influence | Страница A (после блока 9) |
| `/leaderboard` | Призы: квалификация, выплаты, клейм, сброс | Страница B (после блока 9) |

Шапка и футер одинаковые на всех трёх страницах и берутся со страницы Game: шапка с мокапа Hero, арт футера `website/arts/futer.png`. С кадров Rating и Leaderboard шапку и футер не брать. Меню: Game · Leaderboard · Rating · Docs. Leaderboard и Rating — отдельные страницы, текущая подсвечивается. Docs ведёт на документацию. Game на подстраницах ведёт на `/#game`.

---

## Блок 0. Шапка

**Цель:** быстрый переход к любому разделу, Play Now всегда на виду.

**Заголовки:** не нужны.

**Микротекст:**
- Меню: Game · Leaderboard · Rating · Docs. Leaderboard открывает `/leaderboard`, Rating открывает `/rating`, Docs ведёт на документацию, Game прокручивает к блоку «Что это за игра». Эталон вида шапки — мокап Hero. С других мокапов шапку не брать.
- Кнопка: **Play Now**. По клику выбор: **Play demo** и **Play with wallet**.
- Подсказка у выбора: «Demo is an isolated city. No real assets move, and demo progress does not transfer to a wallet city.»
- Чип: **$CORP · Contract TBA**. Тултип: «The contract address will appear here once it is deployed. Copy it only from this site or from our official X account.»

**UI:** sticky-шапка, на мобильном кнопка Play Now закреплена внизу.

**Данные:** логотип, адрес контракта (когда будет).

---

## Блок 1. Hero

**Цель:** за 5 секунд сказать, что это за игра, и дать войти.

**Заголовки:**
1. Run the machine. Make it work.
2. The island is built. The operation is yours.
3. Find the next problem worth solving.

**Подзаголовок:**

> A browser 3D city-management game on Robinhood Chain where you switch on the functions of an existing island and keep the work supplied.

**Микротекст:**
- Кнопки: **Play Now** и **How it works** (якорь к core loop).
- Под кнопками: «Demo needs no wallet. No return is guaranteed. Read the risks.» (ссылка на дисклеймер).
- Полоса фактов: «18 buildings on one shared island» · «5 agent roles» · «6 industries, 6 Stock Tokens» · «Prizes are paid in Stock Tokens» (ведёт на `/leaderboard`).

**UI:** остров на весь экран. Арт острова: `website/arts/hero.png`. Факты чипами под кнопками. На месте плейсхолдера «[Robinhood Chain logo]» — настоящее лого Robinhood Chain и рядом подпись «Robinhood chain».

**Данные:** `website/arts/hero.png`, логотип Robinhood Chain.

---

## Блок 2. Что это за игра

**Цель:** объяснить, что здесь не строят, и показать цикл.

**Заголовки:**
1. A city to operate, not to build
2. Everything is already here. You decide what runs.
3. The layout is finished. The work is not.

**Текст:**

> Corporator is a browser 3D city-management game on Robinhood Chain. You take charge of an island that already has workshops, power infrastructure, research facilities, and financial buildings. You switch on their functions and keep the operation supplied.
>
> The island does not grow when you spend Capital. Your progress changes what the city can do.

**Core loop, 4 шага:**
1. **Get Capital.** Deposit $CORP into the Vault. You receive Capital at the current mint rate, after a 2% entry fee.
2. **Switch on and staff.** Activate a function in an existing building. Assign a compatible agent.
3. **Supply the work.** Every tick the city checks access, schedule, resources, and assignment. Missing Energy stops a Workshop.
4. **Get paid, then decide.** Eligible work creates a payment request. Payroll pays what its finite fund allows. Reinvest, or request an exit through the Bank.

**Две колонки:**

*You do*

> Activate functions in existing buildings. Hire agents and choose their tasks. Open industries by staking Stock Tokens. Choose upgrades, research, and merges. There is no respec.

*You don't*

> Place buildings or change terrain. Rely on an AI. There is no language model in the product, and deterministic rules resolve production and payment. Your workforce and balances are personal. The map is shared.

**Микротекст:**
- Тултипы: «Capital: an internal unit, not a token.» / «Tick: one city hour, 62 min 30 s of real time.» / «Payroll: a finite fund. It can pay more than requested while the boost and the fund allow it, less than requested, or nothing.»
- Подписи «The HUD in the current build» нет.

**UI:** горизонтальный степпер на 4 шага (вертикальный на мобильном), две колонки. Арты шагов: 01 `website/assets/logo_cloud_png.png`, 02 `website/assets/workshop_cloud_png.png`, 03 `website/assets/workshop_solo_cloud.png`, 04 `website/assets/bank_cloud_png.png`. Нижние панели Overview, Agents, Bank, Industries — кадры HUD из игры. Кадров пока нет, на их месте заглушки.

**Данные:** четыре арта шагов выше. Кадры HUD — когда будут.

---

## Блок 3. Индустрии

**Цель:** показать 6 веток и то, как пары открывают синергии.

**Заголовки:**
1. Six industries, six Stock Tokens
2. Each industry opens a branch of the city
3. Pick your industries. Pairs open more.

**Текст:**

> External Stock Tokens open six industry branches. Each branch adds its own capabilities. Certain pairs of industries unlock synergy buildings.
>
> Market conditions move industry efficiency between 85% and 115%. They do not replace staffing, resources, schedules, or Payroll funding.

**Карточки:**
- **Compute · NVDA.** Computing and research. AI Research Center turns Energy into Compute. *Pairs with Energy, Logistics, Automation.*
- **Energy · TSLA.** The supply beneath everything else. Energy Plant adds Energy. *Pairs with Compute, Logistics.*
- **Logistics · AMZN.** Cuts idle time. It is not a resource you consume. *Pairs with Compute, Energy, Consumer.*
- **Consumer · AAPL.** Housing and population-linked retail activity. *Pairs with Logistics.*
- **Automation · MSFT.** Workforce capacity and offline time, up to 18 city hours. *Pairs with Compute, Finance.*
- **Finance · COIN.** Banking and fund-related capabilities. *Pairs with Automation.*

**Плашки под карточками:**

*Access*

> Each industry has a minimum stake, S_min, in its Stock Token. Tier 1 needs 1× S_min, tier 2 needs 2×, tier 3 needs 3×. City Level requirements apply too. The minimum is a fixed quantity. A price drop alone does not raise it.

*Choices*

> Each industry has three tiers with two exclusive choices. Pick one side and you lose the other. Six industries make 36 nodes. Respec is not available.

*Merge*

> Pair two industries that do not share a synergy building. Both need tier 2 or higher. Each side gets its full automatic Tier-1 bonus. An industry joins one merge at a time. Three merges is the maximum.

*Unstake*

> You can unstake yourself. No administrator approval is needed. If your stake falls below the requirement, the industry gets a 24-city-hour grace period before it freezes.

**Микротекст:**
- Кнопка: **See what it opens**.
- Тултипы: «Stock Token: an external token you hold in your wallet and stake to open the industry.» / «Tier nodes: Scale +5% output, Thrift −5% resource cost, Depth +10% upgrade speed, Breadth −10% activation cost, Capital +15% output, Paper +15% fragment rate.»
- Подпись: «A ticker identifies the token. It does not describe all of its rights. Check each issuer's terms.»

**UI:** шесть кликабельных кнопок индустрий. Страница открывается на Compute. Клик меняет островок, «Works with», «Example Synergies» и цвет всего жирного чёрного текста блока. Нажатая кнопка горит своим цветом: Compute зелёный, Energy красный, Logistics оранжевый, Consumer фиолетовый, Automation бирюзовый, Finance синий. В кадре с лого тикер не писать: только оригинальное лого и название индустрии. Лого из `website/stock-logos`. Фон главного арта — `website/design-refernces/industries/assets/sky2.png`, островок с маяком поверх него из той же папки. Картинки зданий синергий из `website/buildings-avatars`. Пары синергий — из `content/params/districts.json` (`synergies`), не из мокапа.

Состояния:
- Compute. Островок `AI-RESEARCH-CENTER.png`. Works with: Energy, Logistics, Automation. Синергии: Robotics Lab, Drone Depot, Data Center.
- Energy. Островок `ENERGY-PLANT.png`. Works with: Compute, Logistics. Синергии: Robotics Lab, Fleet Yard.
- Logistics. Островок `LOGISTICS-HUB.png`. Works with: Compute, Energy, Consumer. Синергии: Drone Depot, Fleet Yard, Retail Complex.
- Consumer. Островок `FLAGSHIP-STORE.png`. Works with: Logistics. Синергия: Retail Complex.
- Automation. Островок `CLOUD-CAMPUS.png`. Works with: Compute, Finance. Синергии: Data Center, Clearing House.
- Finance. Островок `FINANCE-TOWER.png`. Works with: Automation. Синергия: Clearing House.

Вкладки «Industries · Tiers · Merges» остаются.

**Данные:** лого из `website/stock-logos` (nvidia, tesla, amazon, apple, microsoft, coinbase), островки из `website/design-refernces/industries/assets`, аватары синергий из `website/buildings-avatars`. Тикеры в кнопке и на карточке синергии не показывать.

---

## Блок 4. Здания

**Цель:** показать все 18 функций без цен, с понятным «зачем».

**Заголовки:**
1. 18 buildings, each with a job
2. The buildings are built. The functions are yours to switch on.
3. Same island, 18 functions to run

**Вводный текст:**

> Every building is already on the island. You switch on its function, staff it, and upgrade it through three levels. Levels change what a function can do. They do not add structures.

**Микротекст:**
- Вкладки: All 18 · Base · Industry · Synergy. Кнопка: **View 3D**.
- Расписание: Always (00:00–24:00) · Office (08:00–20:00, закрыто в городское воскресенье) · Market (08:00–20:00, закрыто в воскресенье) · Retail (09:00–21:00, открыто в воскресенье).
- Чипы: «Autonomous: works without an agent» / «Prebuilt: active from the start» / «Home role: the agent role that works here at full strength».
- Заблокировано: «Needs City Level 2» (Exchange) · «Needs both industries» (синергии).

**Карточки.** У каждой сверху чипы (слой, home-роль, часы). Формат: Role / Levels / Tip.

### Base

**City Hall** · Office · autonomous, prebuilt

> Role: The civic and administrative anchor of the city.
> Levels: Follows your City Level. It is not upgraded on its own.
> Tip: Nothing to manage here. It takes no ordinary-function slot.

**Workshop** · Engineer · Always · needs Energy

> Role: The base Capital-production workplace.
> Levels: Levels 1 to 3 raise output, and the Energy it draws.
> Tip: Check Energy and the task before upgrading. Another Workshop won't fix a power shortage. It gives you more production waiting for power.

**Agent Hub** · Office · autonomous

> Role: Infrastructure for your workforce.
> Levels: Three levels raise its workforce support.
> Tip: Extra hiring capacity only helps when there are assignments worth filling.

**Power Node** · Engineer · Always

> Role: Base Energy supply.
> Levels: Levels 1 to 3 raise Energy supply.
> Tip: Reach for it when Energy is what holds your work back.

**Bank** · Trader · Market

> Role: The exit from Capital.
> Levels: Your Bank Level follows the Finance Tower level and sets your share of the daily global withdrawal limit: 25%, 43.75%, 57.82%. The ladder has a fourth step, but the current version does not reach it.
> Tip: A bigger personal share still sits under the global limit and the backing.

**Exchange** · Trader · Market · City Level 2

> Role: The Stock Token purchase service.
> Levels: Three levels raise its routing and quote capability.
> Tip: Check the asset, the route, and the stake amount before you buy.

### Industry

**AI Research Center** · Compute · Scientist · Always

> Role: Turns Energy into Compute.
> Levels: Higher levels draw more Energy and scale its Compute work.
> Tip: Worth it when Compute is scarce and Energy is available. Compute comes from an Engineer or an autonomous seat. A Scientist here trains and researches, but does not make the building output Compute.

**Energy Plant** · Energy · Engineer · Always

> Role: Adds Energy supply.
> Levels: Levels 1 to 3 raise Energy supply.
> Tip: It supports heavier production and computing work.

**Logistics Hub** · Logistics · Logistician · Always

> Role: Cuts idle time.
> Levels: Three levels strengthen idle reduction.
> Tip: Check whether idle time, not missing resources, is your constraint.

**Flagship Store** · Consumer · Trader · Retail

> Role: Housing and population-linked Capital activity.
> Levels: Housing capacity at levels 1/2/3: 400 / 900 / 2,025.
> Tip: Housing and Population-to-Capital use different modifiers. A conversion bonus does not add housing.

**Cloud Campus** · Automation · Manager · Office

> Role: Workforce capacity and offline capabilities.
> Levels: Three levels strengthen its capacity effects.
> Tip: Check which effects come from the function and which need tier progression.

**Finance Tower** · Finance · Trader · Office

> Role: Banking capability.
> Levels: Three levels raise its banking capability. Your Bank Level follows this building.
> Tip: A higher personal limit does not create more global liquidity.

### Synergy

**Robotics Lab** · Compute + Energy · autonomous · Always

> Role: Autonomous Capital production.
> Levels: Levels 1 to 3 raise output, and the Energy and Compute it needs.
> Tip: It uses no ordinary-function slot, but it still needs both resources.

**Drone Depot** · Compute + Logistics · Logistician · Always

> Role: Strong idle reduction.
> Levels: Three levels strengthen idle reduction.
> Tip: Compare it with the idle reduction you already have.

**Data Center** · Compute + Automation · Scientist · Always

> Role: More Compute from Energy.
> Levels: Higher levels draw more Energy.
> Tip: Check your power supply and whether you need the extra Compute. Same rule as the AI Research Center: seat an Engineer to get Compute out of it.

**Fleet Yard** · Energy + Logistics · Logistician · Always

> Role: Logistics support and lower Energy burden on specified costs.
> Levels: Three levels strengthen both effects.
> Tip: Its modifiers cut specific costs, not every Energy expense.

**Retail Complex** · Consumer + Logistics · Trader · Retail

> Role: More housing and population-linked activity.
> Levels: Housing capacity at levels 1/2/3: 600 / 1,350 / 3,037.
> Tip: Its housing adds to your other Consumer housing.

**Clearing House** · Automation + Finance · Manager · Office

> Role: Fund-share and banking improvements.
> Levels: Three levels strengthen these effects.
> Tip: Read the exact effect. It is not a universal finance bonus.

**UI:** тёмный блок, весь текст белый. Нумерацию и ссылку «View all buildings» не писать: в блоке уже все 18 зданий. Счётчик «1/16» с мокапа не брать. По центру превью выбранного здания из `website/buildings-avatars`. Справа панель переключения, миниатюры из той же папки. Кнопка **View 3D** открывает окно-студию: модель можно крутить. Модели — `.glb` из `models/`, не из папок `island*` и не из `_experimental`. Вкладки All 18 · Base · Industry · Synergy остаются.

**Данные:** 18 превью из `website/buildings-avatars` и 18 моделей из `models/`. У Retail Complex модель называется `Retail_complex.glb`, у Clearing House превью — `clearing house.png`. `Neon Residence.png` и `neon-residence.glb` в список 18 не входят. Эффекты по уровням для зданий с общими формулировками — см. пометки в конце файла.

---

## Блок 5. Агенты

**Цель:** объяснить 5 ролей и что значит «подходит на своём месте».

**Заголовки:**
1. The right agent in the right seat
2. Five roles, and each has a home
3. You assign the work. The rules settle the result.

**Текст:**

> Agents are workers. You choose where each one works and what task it does. Deterministic rules resolve the result.
>
> There is no language model anywhere in the product. Agents run on a deterministic policy engine, traits, and seeded variation. They do not spend your funds on their own.
>
> Each agent has a role, a level, traits, a workplace, and a task.

**Карточки ролей:**
- **Engineer.** Production. Home: Workshop, Power Node, Energy Plant. Tasks: *Produce*; *Overclock* (+10% output modifier, +45% Energy-cost modifier). Overclock only helps if the extra Energy is there. Neighboring seats: AI Research Center, Logistics Hub, Robotics Lab, Data Center, Fleet Yard. An Engineer in a Compute building is what makes it output Compute.
- **Logistician.** Logistics and idle reduction. Home: Logistics Hub, Drone Depot, Fleet Yard. Tasks: *Route* (+10 points idle reduction); *Stockpile* (+20 points, −5% output). Neighboring seats: Workshop, Power Node, Energy Plant, Flagship Store, Retail Complex.
- **Trader.** Finance and retail. Home: Bank, Exchange, Finance Tower, Flagship Store, Retail Complex. Tasks: *Desk*; *Quote* (Exchange-oriented). Bank work and retail work do not produce the same effect. Neighboring seat: Clearing House.
- **Scientist.** Research and computing. Home: AI Research Center, Data Center. Tasks: *Train* (+1 XP to another agent, plus a +10% XP-rate modifier, uses Compute); *Research* (extra 45% Compute-cost modifier). The XP goes to the trained agent, not to the Scientist. In the Compute buildings a Scientist trains and researches. Compute output needs an Engineer or an autonomous seat. Neighboring seats: Agent Hub, Cloud Campus.
- **Manager.** Administration. Home: City Hall, Cloud Campus, Clearing House. Task: *Focus*. Neighboring seats: Bank, Finance Tower.

**Fit:**

> A home seat uses the full specialty. A neighboring seat uses 60% of it. In any other seat the agent cannot work.

| Fit | Base affinity |
|---|---:|
| Home | 100% |
| Neighboring | 60% |
| Incompatible | Cannot work |

Подпись: «These values feed into performance. They are not payout percentages.»

**Levels:** 1 to 5, множители 1.00× / 1.15× / 1.30× / 1.45× / 1.60×.

> Each valid paid tick gives 1 XP. Idle and unpaid ticks give nothing. Level 5 needs 2,221 XP in total.

**Traits:** *Night Owl* (relief from nighttime Energy cost) · *Frugal* (−5% output, 20% relief on Energy and Compute costs) · *Specialist* (+15% at home, −15% away) · *Steady* (narrower variation, 97.5–102.5% instead of 95–105%).

> A Specialist loses value in the wrong seat. An agent is dealt one or two traits at hire. They are not rerolled. Choose the agent for the job, not the biggest number.

**Микротекст:** легенда Home / Neighbor / Incompatible. Ссылка **Meet the agents** ведёт в раздел агентов в Docs. Точного URL нет. Тултип: «Agent slots: 8 at City Level 1, up to 20 at level 7.» Подпись: «Autonomous buildings need no agent.» Под переключателем ролей фразу «Home seats use the full specialty…» не писать.

**UI:** тёмный блок. Снизу переключатель пяти ролей, страница открывается на Engineer. Клик меняет картинку по центру, правую панель, цвет жирного белого текста и цвет линий панели. Цвета: Engineer оранжевый, Logistician синий, Trader фиолетовый, Scientist бирюзовый, Manager белый. Картинки из `website/units`: `Engineer.png`, `Logistician.png`, `trader.png`, `scientist.png`, `manager.png`. Это изображения, не 3D. Уровень — число 1–5, закрашено столько же делений. Набор витрины: Engineer 4, Specialist + Steady; Logistician 2, Frugal + Night Owl; Trader 5, Night Owl + Specialist; Scientist 1, Steady + Frugal; Manager 3, Frugal + Night Owl. Мокап с «04» и тремя делениями не повторять.

**Данные:** пять картинок из `website/units`. Правая панель — родные и соседние места этой роли из карточек выше.

---

## Блок 7. Экономика и токен

**Цель:** объяснить, куда идёт `$CORP` и где ограничения, без обещаний дохода.

**Заголовки:**
1. How money moves through the city
2. $CORP in, Capital inside, $CORP out
3. What backs Capital, and what doesn't

**Текст:**

> $CORP is the external token. Capital is the internal unit that pays for city actions. It is not a token.
>
> 100% of the $CORP supply is public from launch. No team allocation, no vesting.
>
> Studio takes 0.2% of DEX turnover through the creator tax. It is in the fee table below.

**Таблица «Кто есть кто»:**

| Item | Purpose |
|---|---|
| $CORP | External token and Vault backing |
| Capital | Internal spending and payment unit |
| Stock Tokens | Industry access and reward assets |
| Payroll | Finite Capital fund that pays eligible work |
| Influence | Score. It cannot be spent |
| Fragments | Internal accounting for the Farm pool |

**Вкладки потока:**

*Enter*

> Deposit $CORP into the Vault. It credits what it actually receives. The entry fee is 2%. Capital cannot exceed Vault backing × 2,000, and the actual rate can be lower. The rate can fall at once and rise by at most 2% per city day.

*Work*

> Standard Capital spending splits 40% burned and 60% to Payroll. Work creates payment requests, and Payroll pays from a finite fund. The daily budget is the larger of the fund divided by 14 and the average inflow of the last 3 city days. It is set at the start of the city day and split across 24 ticks. The tick pool starts from the requests times a boost: 8× during the first 7 city days, then 3×. It is then cut to the tick budget and to whatever is left in the fund. If the pool is smaller than the requests, everyone gets a proportional share. An empty fund pays zero for valid work.

*Exit*

> Capital goes through Bank authorization, and $CORP is released. The Bank is open 08:00–20:00 city time, closed on city Sunday. The base markup is 10%, and Trader effects can lower it to 6.5%. The global daily limit is 5% of live pool depth in ETH. Your share of it depends on Bank Level, which follows the Finance Tower level. A voucher lives 62 min 30 s.

*Prizes*

> Two Stock Token pools are funded from DEX turnover, not from Capital spending. Monthly gets 0.2%, Farm gets 0.6%. Monthly places and claims are explained on the Leaderboard page.

**Farm:**

> Farm pays for active work. Only paid, non-idle ticks in industry beacon buildings earn fragments. Windows last 7 city days. Fragments are internal accounting, not tokens. Settlement records what you are owed, and you claim it. With two or more claimants, one city cannot take more than half of a pool.

**Таблица комиссий:**

| Component | Rate |
|---|---:|
| Vault entry | 2% |
| Creator tax | 2% |
| of which: fund | 1.0% of turnover |
| of which: Monthly stock pool | 0.2% |
| of which: Farm stock pool | 0.6% |
| of which: Studio | 0.2% |
| Curve fee (pons) | 1% |
| Combined headline DEX fee | 3% |
| Bank markup | 10%, down to 6.5% with Trader effects |

Подпись: «These apply to different operations. Do not simply add them together.»
Строка в аккордеоне: «Reference: a full round trip is modeled at 14.45% under generated assumptions. It is not a quote.»

**Что делают контракты:**
- «Vault and PrizeTreasury have no pause function. That removes an admin freeze. It also removes that response in an incident.»
- «You can unstake your Stock Tokens yourself. No administrator approval.»
- «Minter, signer, guardian, attestor, registry-owner, and prize roles keep defined permissions.»
- «Results replay from recorded inputs and the content-pack hash.»
- [Audit: ссылка или убрать строку]

**Риск-бокс:**

> Corporator does not guarantee a return. $CORP and Stock Tokens can lose value. Payroll is finite, so valid work can be paid less, or not at all. Bank exits have hours, limits, and coverage conditions. Contracts can have bugs. Nothing here is financial advice.

**Микротекст:** тултипы «Backing: $CORP held in the Vault against issued Capital.» / «Voucher: a signed authorization to release $CORP, valid for 62 min 30 s.» Кнопка: **Read the economy guide** (Docs).

**UI:** арт сверху и панель вкладок Enter / Work / Exit / Prizes. Нумерацию «07 — Economy» не писать. Главный арт — `website/design-refernces/economy/art/economy-art.png` целиком, либо фон `economy-sky-art.png` и вырез `economy-art-png-2.png` или `economy-art-2-png.png`. Картинки вкладок — из `website/design-refernces/economy/assets`, по слотам мокапа. Плоские значки с мокапа заменены этими картинками. Тексты вкладок — из этого файла, не с кадров. В шаг City Actions ставить `city_actions.png`. `city_actions_2.png` не использовать.

**Данные:** арт и картинки вкладок по путям выше. Адрес контракта, ссылка на аудит (если есть).

---

## Блок 9. Финальный CTA и футер

**Цель:** последний повод нажать Play Now и честный дисклеймер.

**Заголовки:**
1. Start with one working operation
2. The island is waiting for an operator
3. Try the demo. No wallet needed.

**Текст:**

> Aim for one useful operation, not several unsupported ones. Demo gives you an isolated city to learn on.

**Микротекст:**
- Кнопки: **Play Now** · **Read the Docs** · **Follow on X**.
- Дисклеймер в футере: «Corporator does not guarantee a return. $CORP and Stock Tokens can lose value. Payroll is finite, and Bank exits have conditions. Stock Tokens are external assets. Check each issuer's terms. Nothing here is financial advice.»
- Ссылки в футере: Rating · Leaderboard · Docs · X. Чип `$CORP` с адресом.

**UI:** арт `website/arts/futer.png`.

**Данные:** ссылки на X и Docs, адрес контракта.

## Отдельные страницы

Люди попадают на эти страницы по прямой ссылке, поэтому у каждой есть свой заголовок, короткое введение и пустое состояние. Общий компонент, шапка и футер как на лендинге.

### Общий компонент «Three clocks» (на обеих страницах)

> A city day lasts 25 real hours.

- **Farm window:** 7 city days (175 hours). Fragments for the Farm pool.
- **Prize period:** 30 city days (750 hours, about 31 real days). Influence and the Monthly prize.
- **Season:** 90 city days, three prize periods. A calendar label. It pays nothing on its own.

> A new city joins the current period and counts from its creation. Earlier days are not backfilled.

**UI:** горизонтальная шкала из 30 суток с отметками. Когда известна эпоха календаря, добавляем «Day N of 30» и дату ближайшего расчёта. До этого эти две подписи скрыты.

---

## Страница A. `/rating`

**Meta title:** Rating | Corporator
**Meta description:** The public Corporator rating: every wallet city ordered by Influence, and how the daily score is counted.
**Хлебные крошки:** Corporator / Rating

**Цель:** дать публичный список игроков и объяснить, как считается место.

**Заголовки H1:**
1. The Rating
2. Every wallet city, ordered by Influence
3. Influence sets your place

**Введение:**

> The Rating is the public list of wallet cities, ordered by Influence. It shows who is ahead. It does not pay anyone. Prizes are on the Leaderboard.

**Раздел 1. The table (первым на странице)**

> Rows sort by Influence, highest first. Ties go to the city with more GDP today, then to the lower city ID. There is no top-ten cut. Cities not yet qualified for prizes stay visible.
>
> One wallet, one row. Several cities under one wallet share a row, and scores are not added. Demo cities are not listed. A demo session can watch the table.

- Колонки: **#** · **Wallet** · **Influence** · **Day GDP**.
- Пустое состояние: «No wallet cities yet.»
- Тултипы: «Day GDP: Capital actually paid to this city during the current protocol day.» / «A row is a score. It is not a payout.»
- Строка игрока помечается **You**. Поле «Find a wallet» над таблицей.

**Раздел 2. How Influence is counted**

> Every protocol day your city gets one number. It is the product of four factors. Each one is neutral at 10,000. Influence is the sum of those daily numbers over the current 30-day period.
>
> Example: a day worth 9,025, repeated for 30 days, adds up to 270,750.
>
> If any one factor is zero, that day scores zero. Wallet balance and stock PnL do not count. Influence cannot be spent.

Четыре карточки (знак × между ними):
- **GDP against capex.** Capital your city actually paid out that day, compared with what you already put into buildings and agents. *Raises it:* keep work running and shifts paid. *Zeroes the day:* an idle city, spending on upgrades with no output, a day with no GDP.
- **Stability.** The share of valid ticks in the day. *Raises it:* keep the city ticking. *Zeroes the day:* no valid ticks at all.
- **Efficiency.** The average efficiency of your open industries against neutral 10,000. It follows each Stock Token's market price, between 85% and 115%. *Your lever:* which industries you keep open. Weak or closed ones pull it down.
- **Coverage.** Open industries that actually produce, divided by open industries. *Raises it:* open an industry and keep it working. Open it and freeze it, and coverage falls. No open industries counts as neutral, not a penalty.

Тумблеры «Zero test»: «Turn one factor to zero. The day scores zero.»

**Раздел 3. How to climb faster**
- Run useful work, not extra capacity. GDP is measured against what you already invested.
- Check your offline allowance before you log off. The base is 12 city hours, and Automation raises it to at most 18.
- Keep every open industry working. A frozen one drags Coverage down.
- When a result disappoints, read the idle reason before you spend more.

**Раздел 4. Where the period stands:** общий компонент «Three clocks».

**Раздел 5. Дальше (две карточки):**
- **Leaderboard.** «See who qualifies for prizes and how places are paid.» Кнопка **Open the Leaderboard**.
- **Play Now.** «Start with a demo city. No wallet needed.» Кнопка **Play Now**.
- Ссылка: «The full rules are in the Docs.»

**UI:** шапка и футер как на странице Game. Таблица сразу под введением. Два состояния. Закрытое, пока нет кошельков: пустая таблица и текст «No wallet cities yet.». Объяснение Influence под таблицей при этом видно. Открытое: живые строки с API. Слово EXAMPLE и адреса с открытого мокапа в билд не переносить. Поиск «Find a wallet», строка «You». Ниже карточки множителей со знаком × и тумблеры zero test.

**Данные:** API таблицы (кошелёк, Influence, Day GDP, метка «You»), эпоха календаря для «Day N of 30» (когда будет).

---

## Страница B. `/leaderboard`

**Meta title:** Leaderboard | Corporator
**Meta description:** How Corporator cities qualify for Stock Token prizes, how places are paid, and what resets each 30-day period.
**Хлебные крошки:** Corporator / Leaderboard

**Цель:** объяснить, кто получает призы, сколько какое место получает и как это забрать.

**Заголовки H1:**
1. The prize Leaderboard
2. Prizes in Stock Tokens, by place
3. Six positive days to qualify

**Введение:**

> The Leaderboard is the prize list. It is stricter than the Rating: only qualified cities count, and each wallet gets one slot. Places go by Influence.

**Раздел 1. Who qualifies**

> A city needs at least six positive days in the 30-day period. A positive day means GDP above zero. Six of thirty is 20% of the period.
>
> It also needs a live stake in at least one playable industry when the period settles.

Карточка «Your status» (по возможности): «Positive days: X of 6 · Live stake: yes / no».
- Без кошелька: «Connect a wallet to see your status.»
- Демо: «Demo cities are not part of the Leaderboard.»
- В игре вкладка Claims тоже показывает, квалифицирован ли город.

**Раздел 2. One slot per wallet**

> One wallet gets one slot. If it has several cities, the best qualifying one counts. Places go by Influence, then by the lower city ID. GDP does not break ties here.
>
> So two cities can swap places on the Rating and keep the same prize places.

**Раздел 3. What is paid**

> The Monthly pool pays in Stock Tokens: NVDA, TSLA, AMZN, AAPL, MSFT, and COIN. Not in $CORP, not in Capital.
>
> The top ten places split each asset by weight. The weights mix two curves: 80% follows 1 ÷ place, and 20% is an equal share for every place.

| Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Weight | 8,200 | 4,200 | 2,866 | 2,200 | 1,800 | 1,532 | 1,342 | 1,200 | 1,088 | 1,000 |
| Share of a 10,000 pool | 3,224 | 1,651 | 1,127 | 865 | 707 | 602 | 527 | 471 | 427 | 393 |

> Example: a pool of 10,000 units and ten qualified places. The weights sum to 25,428. The 6 units left over stay in the pool. This is an arithmetic example, not a forecast. If fewer than ten cities qualify, only real places split the pool. Empty places get nothing.

**Раздел 4. Where the pool comes from**

> The Monthly pool is funded by 0.2% of DEX turnover, not by Capital spending. Farm is a separate pool, funded by 0.6%. Farm amounts are claimed from the Industries screen, on the district card.

Живые суммы пула показываем только когда они реально есть.

**Раздел 5. Claiming**

> A rank is not a payment. You claim your prize yourself: the eligible wallet pulls it from the prize treasury. Demo cities cannot claim real prizes.

**Раздел 6. What resets**

> Settlement runs at the 06:00 protocol boundary every 30 days. Then Influence and your count of positive days go back to zero.

*Resets:* Influence, positive-day count.
*Stays:* Capital, buildings, agents, stakes, GDP as your city's economy, prizes already earned and waiting for claim.

**Раздел 7. Where the period stands:** общий компонент «Three clocks».

**Раздел 8. Дальше (две карточки):**
- **Rating.** «See the public table and how Influence is counted.» Кнопка **Open the Rating**.
- **Play Now.** «Start with a demo city. No wallet needed.» Кнопка **Play Now**.
- Ссылка: «The full rules are in the Docs.»

**Микротекст:**
- Тултипы: «Positive day: a protocol day with GDP above zero.» / «Qualified: six positive days and a live stake at settlement.»
- Подпись у графика: «Weights, not payouts. Amounts depend on the pool.»

**UI:** одна колонка. Слово EXAMPLE над таблицей не писать. В строках таблицы нет логотипов компаний, на их месте картинка острова. Подпись «Weights, not payouts» видна всегда, лого под ней из `website/stock-logos`. Первые 6 дней запуска лидерборд закрыт: таблица заблюрена, на ней таймер. Панель весов при этом не блюрить. Дальше столбчатый график весов мест и таблица примера. Внизу две колонки «Resets / Stays». На мобильном закреплена кнопка Play Now.

**Данные:** статус квалификации по кошельку (опционально), суммы живого Monthly-пула (когда будут), дата ближайшего расчёта (когда будет эпоха), лого шести стоков из `website/stock-logos`. Картинка острова для строк таблицы — файл не назван.

---

---

## Что проверить перед публикацией

1. **Exchange и призовой клейм.** В §48 документации они помечены как «Partial». Тексты описывают задуманное поведение. Если к моменту публикации хоп или клейм не работают, заменить формулировки на «coming soon».
2. **Эффекты по уровням.** Для зданий, кроме Workshop, Power Node, Energy Plant, обоих Consumer-зданий и Robotics Lab, в документации нет конкретных эффектов на уровнях. Написаны общие формулировки. Пришлите эффекты, и они станут конкретными.
3. **Аудит.** Строка в плашке доверия стоит как заглушка. Есть аудит: ставим ссылку. Нет: убираем.
4. **Round trip 14.45%.** Цифра из публичной документации с оговоркой «не котировка». Если не нужна, убрать строку из аккордеона в блоке 7.
5. **Пример выплат.** Взят из §33 документации (веса 8 200 … 1 000, пул 10 000). В тексте помечен как пример. Если нужна реальная сумма пула, подставить её.
6. **Названия.** Страница называется Rating, в игре первая вкладка экрана называется Ranking. Можно оставить, тогда разница будет заметна игрокам. Чтобы убрать путаницу, добавь на странице тултип: «In the game this tab is called Ranking.»
7. **Ссылки.** Только X и Docs. Terms и Privacy из футера мокапа убраны.
8. **Опционально: доллары.** В обновлённой документации появились «reference deposit $150» (масштаб цен зданий и найма) и «S_min ~ $100 frozen paper». В текст сайта они не добавлены (цены не пишем). Если решишь показывать порог входа в индустрию, формулировка: «At the authored snapshot, the minimum stake was about $100 worth of each token. It is a fixed quantity and does not follow the price.»
9. **Не публиковать: «recoup».** В §23 PUBLIC_DOC теперь есть фраза, что играющий город за 90 суток настроен «окупить вход с плюсом ($300, 200%)», а спящий «может окупить ($150, 100%)». В HANDOFF стоят другие цифры (165% и 83%). Такие цифры читаются как обещание доходности и противоречат дисклеймеру. На сайт не идут. Стоит переписать сам §23.
10. **Payroll.** Буст уже в паке 187: дневной бюджет — большее из «фонд / 14» и среднего притока за 3 суток города; пул тика сначала ×8 в первые 7 суток города, потом ×3, затем режется бюджетом тика и фондом. Вкладка Work это описывает. Пустой фонд по-прежнему платит ноль.
11. **Accepted foreign 25%.** Этот уровень есть в правилах, но ни одно здание его не использует. С сайта убран, вернуть можно, когда появится.
12. **Отдельные страницы.** Rating и Leaderboard приходят по прямым ссылкам, поэтому у каждой свои H1, meta и пустое состояние. Таблице `/rating` нужен свой API-запрос, странице `/leaderboard` нужна дата расчёта, когда появится эпоха календаря.

---

## Изменения после обновления документации

### Структура сайта (2026-09-21)

- Rating и Leaderboard вынесены с лендинга на отдельные страницы `/rating` и `/leaderboard`. Тизер с лендинга снят. Тексты страниц собраны из прежнего блока 6. Добавлены введения, хлебные крошки, meta, карточки «Дальше» и раздел «Where the pool comes from» (0.2% Monthly, 0.6% Farm).

### pack 169 (2026-09-20)

- **Призовые веса.** Не чистый Zipf, а смесь 80% гармонической кривой и 20% равной доли. Веса 8 200 / 4 200 / 2 866 / 2 200 / 1 800 / 1 532 / 1 342 / 1 200 / 1 088 / 1 000, сумма 25 428. Пример на пуле 10 000: 3 224 / 1 651 / 1 127 / 865 / 707 / 602 / 527 / 471 / 427 / 393, остаток 6.
- **Пулы из creator tax.** Monthly 0.2% (было 0.3%), Farm 0.6% (было 0.5%). Fund 1.0% и Studio 0.2% не менялись, итого 2%.
- **Лимит Bank.** Глобальный суточный лимит 5% глубины пула в ETH (было 1%).

### pack 176 (2026-09-21)

- **Окно Farm.** 7 суток / 175 часов (было 14 / 350). Обновлены блок 6 (шкала «три часа», ссылка) и блок 7 (Farm). Периоды теперь 7 / 30 / 90.
- **Affinity.** Уровень «Accepted foreign 25%» в игре не используется. Из таблицы убран, в матрице подсвечиваются только 100% и 60%.
- **Agent Hub.** Не prebuilt (единственное здание при создании города: City Hall). Убрана пометка на карточке.
- **AI Research Center и Data Center.** Compute выдаёт только автономное место или место с Engineer, Scientist здание Compute не делает. Добавлено в советы обеих карточек и в карточки Engineer и Scientist.
- **Bank Level.** Следует уровню Finance Tower, 4-й шаг лестницы (68.36%) в текущей версии недостижим. Практический потолок 57.82%. Обновлены карточки Bank, Finance Tower и вкладка Exit.
- **Нет языковой модели.** Гайд теперь пишет: «no language model anywhere in the product». Усилил формулировки в блоках 2 и 5.
- **Не менялось.** Остальные цифры в тексте (расписания, XP, аффинность 100/60%, комиссии 2% / 1% / 3%, markup 10% и 6.5%, квалификация 6 из 30, периоды 30 / 90, offline 12–18) сверены, расхождений нет.

### Сверка с паком 187 (2026-09-27)

- **Engineer.** В соседние места добавлен Robotics Lab. Здание работает без агента; если Engineer посажен, матрица даёт ему 60%.
- **Остальные роли.** В карточки дописаны соседние места из `design_5_8.json`: Logistician — Workshop, Power Node, Energy Plant, Flagship Store, Retail Complex; Trader — Clearing House; Scientist — Agent Hub, Cloud Campus; Manager — Bank, Finance Tower.
- **Train.** База по-прежнему 1 XP другому агенту. Дописан модификатор +10% к скорости XP. Остаток копится и не обязан давать дробный XP в одном тике.
- **Черты.** Агенту при найме выдают одну или две. Заново их не крутят. Игрок выбирает агента, не чипы.
- **Work.** Вкладка описывает действующий буст: бюджет — большее из фонда/14 и среднего притока за 3 суток города; пул тика ×8 в первые 7 суток города, потом ×3; затем обрезка бюджетом тика и фондом.

### Несостыковки в самой документации (для команды)

- §47 говорит «not pure Zipf», а старые места HANDOFF всё ещё называют кривую Zipf.
- §44 «interface notes» упоминает pack 150, а шапка этого файла — pack 187.
- §23 PUBLIC_DOC (recoup 200% / 100%) и HANDOFF §53 (recoup 165% / 83%) расходятся.
- §46: в таблице HUD для Industries указан «unstake», а ниже сказано, что unstake не команда городской панели.
