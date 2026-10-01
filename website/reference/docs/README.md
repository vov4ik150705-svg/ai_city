# Website page concepts

Сюда пишем концепты страниц и блоков так, как их описывает владелец.
Что пишет владелец — эталон. То же правка вносится в копирайт `C:\Users\sk640\Downloads\CORPORATOR_WEBSITE_COPY_2.md`.
Мокапы и старый копирайт сами по себе сюда не переносятся.

Нумерацию блоков на сайте не писать нигде. Надписей вида «03 — Industries», «02 — Buildings» и любых таких меток на страницах нет.

Шапка и футер на `/`, `/rating` и `/leaderboard` одни. Шапка — с мокапа Hero. Арт футера — `website/arts/futer.png`. С кадров Rating и Leaderboard шапку и футер не брать.

## Hero

Кадры: `hero/hero-desktop.png`, `hero/hero-mobile.png`.

Шапка. Эталон шапки — только мокап Hero. С остальных мокапов шапку не брать: там она нарисована для картинки, не как образец сборки.

Арт острова. В Hero ставить `website/arts/hero.png`, не собирать остров заново из мокапа.

Robinhood. На месте плейсхолдера «[Robinhood Chain logo]» — настоящее лого Robinhood Chain и рядом подпись «Robinhood chain».

Меню шапки, как на мокапе Hero: Game · Leaderboard · Rating · Docs. Leaderboard → `/leaderboard`, Rating → `/rating`, Docs → документация, Game → блок «Что это за игра» (`/#game`). Industries, Buildings, Agents и Economy в меню нет. Эти блоки на лендинге остаются. FAQ с лендинга снят. Тизера Rating и Leaderboard на странице Game нет.

## Game

Кадр: `game/game-desktop.png`.

Арты четырёх шагов:
- 01 Get Capital — `website/assets/logo_cloud_png.png`
- 02 Switch on and staff — `website/assets/workshop_cloud_png.png`
- 03 Supply the work — `website/assets/workshop_solo_cloud.png`
- 04 Get paid, then decide — `website/assets/bank_cloud_png.png`

Нижние панели Overview, Agents, Bank, Industries — кадры HUD из игры. Кадров пока нет, ставить заглушки.

Подпись «The HUD in the current build» не писать.

## Industries

Кадр: `industries/industries-desktop.png`. Шапка на этом кадре не эталон. Метку «03 — Industries» не переносить: нумерации блоков на сайте нет.

Шесть кнопок индустрий. Клик меняет всю секцию. Страница открывается на Compute.

Цвета выбранной индустрии:
- Compute — зелёный
- Energy — красный
- Logistics — оранжевый
- Consumer — фиолетовый
- Automation — бирюзовый
- Finance — синий

На кнопке и в карточке синергии: оригинальное лого из `website/stock-logos` и название индустрии. Тикер в одном кадре с лого не писать.

Лого:
- Compute — `website/stock-logos/nvidia_logo.png`
- Energy — `website/stock-logos/tesla_logo.jpg`
- Logistics — `website/stock-logos/amazon_logo.jpg`
- Consumer — `website/stock-logos/apple_logo.jpg`
- Automation — `website/stock-logos/microsoft_logo.jpg`
- Finance — `website/stock-logos/coinbase_logo.jpg`

Что меняется по клику:
- Главный арт: фон `website/design-refernces/industries/assets/sky2.png`, поверх него островок с одним зданием-маяком выбранной индустрии.
- Нажатая кнопка горит цветом своей индустрии.
- Весь жирный чёрный текст блока красится в цвет выбранной кнопки.
- «Works with» — индустрии-пары выбранной ветки, тоже лого и название, без тикера.
- «Example Synergies» — здания-синергии этой ветки. Картинка здания из `website/buildings-avatars`. На карточке лого и названия индустрий пары, как на мокапе Compute.

Островки:
- Compute — `industries/assets/AI-RESEARCH-CENTER.png`
- Energy — `industries/assets/ENERGY-PLANT.png`
- Logistics — `industries/assets/LOGISTICS-HUB.png`
- Consumer — `industries/assets/FLAGSHIP-STORE.png`
- Automation — `industries/assets/CLOUD-CAMPUS.png`
- Finance — `industries/assets/FINANCE-TOWER.png`

Состояние Compute, как на мокапе. Works with: Energy, Logistics, Automation. Example Synergies: Robotics Lab (`buildings-avatars/Robotics Lab.png`, Compute + Energy), Drone Depot (`buildings-avatars/Drone Depot.png`, Compute + Logistics), Data Center (`buildings-avatars/Data Center.png`, Compute + Automation).

Синергии сверены с игрой: `content/params/districts.json`, поле `synergies`. Маяки — поле `beacon` того же файла. Других синергий в игре нет. «Works with» — вторая индустрия каждой синергии, куда входит выбранная.

Остальные состояния:
- Energy. Works with: Compute, Logistics. Синергии: Robotics Lab (Compute + Energy), Fleet Yard (`buildings-avatars/Fleet Yard.png`, Energy + Logistics).
- Logistics. Works with: Compute, Energy, Consumer. Синергии: Drone Depot (Compute + Logistics), Fleet Yard (Energy + Logistics), Retail Complex (`buildings-avatars/Retail Complex.png`, Consumer + Logistics).
- Consumer. Works with: Logistics. Синергия: Retail Complex (Consumer + Logistics).
- Automation. Works with: Compute, Finance. Синергии: Data Center (Compute + Automation), Clearing House (`buildings-avatars/clearing house.png`, Automation + Finance).
- Finance. Works with: Automation. Синергия: Clearing House (Automation + Finance).

## Buildings

Кадр: `buildings/buildings_desktop.png`. Шапка на этом кадре не эталон. Метку «02 — Buildings» не переносить.

Тёмный блок, весь текст белый. Ссылки «View all buildings» нет: здесь уже все здания. Счётчик «1/16» с мокапа не брать. В игре 18 зданий (`content/params/buildings.json`).

По центру — превью выбранного здания из `website/buildings-avatars`. Справа панель переключения, миниатюры из той же папки.

Кнопка View 3D открывает окно-студию: модель можно крутить и рассматривать. Модели — файлы `.glb` из `models/`. Папки `island1`, `island 2`–`island 6` и `_experimental` не брать.

Имена файлов не везде совпадают. Пары:

| Здание | Превью | Модель |
|---|---|---|
| City Hall | `City Hall.png` | `City Hall.glb` |
| Workshop | `Workshop.png` | `Workshop.glb` |
| Agent Hub | `Agent Hub.png` | `Agent Hub.glb` |
| Power Node | `Power Node.png` | `Power Node.glb` |
| Bank | `Bank.png` | `Bank.glb` |
| Exchange | `Exchange.png` | `Exchange.glb` |
| AI Research Center | `AI Research Center.png` | `AI Research Center.glb` |
| Energy Plant | `Energy Plant.png` | `Energy Plant.glb` |
| Logistics Hub | `Logistics Hub.png` | `Logistics Hub.glb` |
| Flagship Store | `Flagship Store.png` | `Flagship Store.glb` |
| Cloud Campus | `Cloud Campus.png` | `Cloud Campus.glb` |
| Finance Tower | `Finance Tower.png` | `Finance Tower.glb` |
| Robotics Lab | `Robotics Lab.png` | `Robotics Lab.glb` |
| Drone Depot | `Drone Depot.png` | `Drone Depot.glb` |
| Data Center | `Data Center.png` | `Data Center.glb` |
| Fleet Yard | `Fleet Yard.png` | `Fleet Yard.glb` |
| Retail Complex | `Retail Complex.png` | `Retail_complex.glb` |
| Clearing House | `clearing house.png` | `Clearing House.glb` |

`Neon Residence.png` и `neon-residence.glb` в эти 18 не входят. В переключатель не ставить.

## Agents

Кадр: `agents/agents-desktop.png`. Шапка на этом кадре не эталон. Метку «06 — Agents» не переносить.

Тёмный блок. Снизу панель переключения пяти ролей. Страница открывается на Engineer. Клик меняет центр, правую панель, цвет жирного белого текста и цвет линий на панели (у Engineer на мокапе они жёлтые).

Цвета:
- Engineer — оранжевый
- Logistician — синий
- Trader — фиолетовый
- Scientist — бирюзовый
- Manager — белый

По центру картинка выбранной роли, не 3D-модель. Файлы из `website/units`:
- Engineer — `Engineer.png`
- Logistician — `Logistician.png`
- Trader — `trader.png`
- Scientist — `scientist.png`
- Manager — `manager.png`

Правая панель — данные этой роли из копирайта: родные и соседние места, полосы Home 100% / Neighbor 60% / чужое место не работает, уровень, две черты. Линии полос и отметки уровня красятся в цвет роли.

Уровень на витрине — число от 1 до 5, и заполнено столько же делений из пяти. На мокапе ошибка: написано 04, а закрашено три. Так не собирать.

Черты на витрине — одна из четырёх пар, которые игра реально выдаёт. Все четыре пары должны быть видны среди пяти ролей, поэтому одна пара повторяется. Это фиксированный набор для страницы, не новый бросок при каждой загрузке:

| Роль | Уровень | Черты |
|---|---:|---|
| Engineer | 4 | Specialist + Steady |
| Logistician | 2 | Frugal + Night Owl |
| Trader | 5 | Night Owl + Specialist |
| Scientist | 1 | Steady + Frugal |
| Manager | 3 | Frugal + Night Owl |

Повтор пары: Frugal + Night Owl у Logistician и Manager.

Ссылка **Meet the agents** ведёт в раздел агентов в Docs. Точного URL в проекте нет.

Под переключателем ролей мелкий текст не писать. Фразы «Home seats use the full specialty…» на странице нет.

## Economy

Кадры: `economy/economy_enter_desktop.png`, `economy_work_desktop.png`, `economy_exit_desktop.png`, `economy_prizes_desktop.png`. Шапка на этих кадрах не эталон. Метку «07 — Economy» не переносить.

Отдельного концепта нет. Это арт сверху и панель с вкладками Enter, Work, Exit, Prizes. Тексты вкладок — из копирайта, не с мокапа. Картинки — по слотам мокапа.

Главный арт, папка `website/design-refernces/economy/art`:
- Целиком: `economy-art.png`.
- Либо сборка: фон `economy-sky-art.png`, поверх вырез острова. `economy-art-png-2.png` — остров без парящих островков. `economy-art-2-png.png` — тот же остров и несколько парящих островков.

Значки и картинки панели — из `website/design-refernces/economy/assets`. На мокапах часть слотов была плоскими значками. Для них уже сгенерированы такие же картинки. Плоские значки не рисовать заново.

Enter:
- Поток: `CORP.png`, `vault.png`, `capital.png`, `city_actions.png`.
- Колонка активов: `CORP.png`, `capital.png`, `stock-tokens.png`, `payroll.png`, `INFLUENSE.png`, `fragments.png`.
- В шаг City Actions ставить `city_actions.png`. `city_actions_2.png` не использовать.

Work:
- Поток: `work.png`, `Payment-Request.png`, `payroll.png`, `capital.png`.
- Правила: `fund_14_per_day.png`, `24ticks.png`, `proportional_share.png`, `empty_fund.png`.
- Отдельной картинки для «40% burned» в папке нет.

Exit:
- Поток: `capital.png`, `bank.png`, `voucher_exit_flow.png`, `CORP.png`.
- Правила: `base_markup.png`, `global_daily_limit.png`, `voucher_exit_rules.png`.
- `voucher_exit_flow.png` — ваучер на постаменте, для шага потока. `voucher_exit_rules.png` — только бланк, для колонки правил.

Prizes:
- Поток: `DEX.png`, `pools.png`, `cualify.png`, `claim.png`.
- Карточки: `prizes_monthly.png`, `stock-tokens.png`, `farm.png`.
- Правила: `30_day_prize_period.png`, `7_day_farm.png`, `6_positive_days.png`, `live_stake.png`, `TOP10.png`, `claim_yourself.png`.

Имена файлов с опечатками не переименовывать: `INFLUENSE.png`, `cualify.png`.

## Footer

Кадр: `futer/futer_desktop.png`.

Арт футера: `website/arts/futer.png`.

## Leaderboard

Кадры: `leadearboard/leadearboard-open-desktop.png`, `leadearboard/leadearboard-closed-desktop.png`. Шапка на этих кадрах не эталон. Метку «08 — Leaderboard» не переносить.

Отдельного концепта нет.

Над таблицей нет слова EXAMPLE.

В строках таблицы нет логотипов компаний. На их месте картинка острова. Файл не назван.

Подпись «Weights, not payouts» остаётся. Лого под ней — настоящие, из `website/stock-logos`: `nvidia_logo.png`, `tesla_logo.jpg`, `amazon_logo.jpg`, `apple_logo.jpg`, `microsoft_logo.jpg`, `coinbase_logo.jpg`.

Два состояния. Открытое — таблица весов видна. Закрытое показывается первые 6 дней запуска: лидерборда ещё нет. Таблица заблюрена, на ней таймер «Leaderboard opens in». Панель «Weights, not payouts» при закрытом лидерборде не блюрить: на закрытом мокапе она скрыта блюром, это ошибка кадра.

## Rating

Кадры: `rating/rating-open-desktop.png`, `rating/rating-closed-desktop.png`. Шапка и футер на этих кадрах не эталон. Метку «Rating» с номером не переносить.

Отдельного концепта нет. Два состояния.

Закрытое, пока нет кошельков: таблица пустая, текст «No wallet cities yet.». Блок «How Influence is counted» и всё ниже таблицы видны, их не блюрить.

Открытое: живая таблица. Колонки #, Wallet, Influence, Day GDP. Поиск «Find a wallet». Строка игрока — You. Слово EXAMPLE и вымышленные адреса с открытого мокапа не переносить.
