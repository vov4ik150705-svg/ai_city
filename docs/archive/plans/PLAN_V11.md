# PLAN_V11 — фаза v1.1 G0–G7

ТЗ фазы доигровки до v1.1. Денежная фаза `M0–M7` закрыта: пак **53**, хеш `411900ef713eb94d6172fc12f6f418761a085d18badbc8f6cba7b979417f7b87`, `rules_version` **0.19.0**, lint **304/0**, круг **1445** bps, вход **200** < выход **910**, `launch.deployed` пуст.

Этот документ — канон фазы v1.1. Механика — `DESIGN.md` (скоуп — §11), интерфейс — `HUD.md`, прогрессия — `docs/PROGRESSION.md`, компаньон — `docs/COMPANION.md`, баланс — `docs/BALANCE.md`, симуляция — `docs/SIMULATION.md`, экраны — `docs/SCREENS.md`. Числа — пак и `content/out/GENERATED.md`, `content/out/BUILDS.md`, никогда не копия отсюда.

Решения нумеруются `D-G-*`, расхождения `R-G-*`, новые правила линтера `L306`–`L313`, атаки на план `A-G-*`. Нумерация `D-M-*`, `R-M-*`, `R-L-*`, `R-C-*`, `R-T*-*` не переименовывается и не продолжается.

Фаза выхода `P0–P8` (`docs/reports/PLAN_RELEASE.md`) **отложена по решению владельца**: сначала доигрывается v1.1, потом релиз. Их связь — `D-G-2`.

---

## §0. Предусловие фазы

До первой правки проверить командой, а не памятью:

```
python content/build.py            # pack 53, hash 411900ef…7b87, круг 1445, rules 0.19.0
python content/lint.py             # 304 / 0
python content/builds.py           # 6321 осмысленно различных билдов, непокрытых 0
```

и прочитать `content/params/launch.json` поле `deployed`.

- Все пять полей `deployed` пустые → фаза стартует с `G0`, и это **правильное** состояние: v1.1 меняет `rules_version` и векторы, а делать это на живом чейне — републикация пака, на который уже записаны смены (`A-G-2`). Ставить `launchToken` до конца v1.1 запрещено.
- Хоть одно поле заполнено или в чейне есть наш `TokenLaunched` → **остановиться и спросить владельца**. Ставка снята, пак на живом чейне, и подъём `rules_version` с `prize_live_min_rules_minor` — уже не правка, а миграция экономики под живыми деньгами. Это другая задача.

Второе предусловие: `M7_final.md` лежит на диске и его гейт зелёный. Третье: понять, что в списке v1.1 из `DESIGN.md §11` **уже закрыто** и переделывать нельзя (см. §2).

---

## §1. Что фаза делает и чего не делает

**Делает.** Открывает вторую петлю игры, ту, что вырезали из v1 «пока первая не крутится». Конкретно, по списку `DESIGN.md §11` «режем в v1.1»: три играбельных района AMZN, MSFT, COIN; их узлы прогрессии и семь merge; пять оставшихся зданий синергий; два архетипа Scientist и Manager; дерево research шире трёх узлов; ненулевые величины компаньона, Manager focus, кран NFT. Всё это уже объявлено в данных честным нулём или флагом `false` — фаза снимает нули и пересчитывает калибровку, которую эти нули держали замороженной.

**Не делает.** Ничего из запрещённого списка `BRIEF §3` и `corporator-canon §11`. Не двигает форму денег Rev-A: сбор 2%, сплит `1.0 / 0.8 / 0.2`, десятку трат в фарм, пять контрактов, vault как предохранитель. Не двигает ставку `creator_tax_bps = 200`. Не трогает бюджет трения `[1400, 1600]`, инвариант кассы, вход дешевле выхода. Не заводит второй пул `$CORP`, шесть пар `CORP/сток`, игровой NVDA. Не расширяет палитру и не трогает `art/raw`.

**Уже закрыто раньше — не переделывать (см. §2).** Сезоны и выплата призов (`season_prizes_live=1`). Клейм приза по каждому активу (`leaderboard_claim_live=1`). Дерево прогрессии всех шести районов **уже сгенерировано** (36 узлов, 9 merge): фаза снимает гейт `playable_v1`, а не пишет узлы заново. Форма записи каноничен с первого дня — включение merkle миграции не требует.

**Не в этой фазе, хоть и в списке §11.** Живой сабмит merkle-корня (`chain_v1_1`) — это аттестация и транспорт, не геймплей; его дом — фаза выхода рядом с репетицией транспорта (`PLAN_RELEASE` P5), а не здесь. Ночной штраф на выход (`tick.json night_penalty`) — отдельный рычаг, в списке v1.1 не назван; решение владельца в `G7`, не мандат фазы.

---

## §2. Разведка: состояние на входе фазы

Установлено чтением данных, а не памятью. Каждая строка — вход этапа.

| находка | где | следствие |
|---|---|---|
| Три района под гейтом `playable_v1=false`: `logistics`/AMZN, `automation`/MSFT, `finance`/COIN | `content/params/districts.json` | `G1` снимает флаг; три остаются `true` уже: `compute`, `energy`, `consumer` |
| Дерево прогрессии считается для **шести** районов: `builds_raw` 160 608 177, а `builds_raw_v1` **7695** — подмножество по `playable_v1` | `docs/PROGRESSION.md` §7, `builds.py` | `G1` не пишет узлы, а расширяет `v1`-подмножество до полного; 18 узлов и 7 merge оживают правилом, не списком |
| `merge_active_cap` = 3 (полный граф), `v1_merge_active_cap` = 1 (обе пары висят на consumer) | `docs/PROGRESSION.md` §6, `L66` | С шестью играбельными кап паросочетаний становится реальным 3 |
| Дивиденд Automation `1+2+3=6` ч поверх базы 12 → потолок оффлайна **18** — сегодня недостижим, район закрыт | `DESIGN.md` §238, `PROGRESSION` §2, `L58` | `G1`: MSFT играбелен → оффлайн реально тянется 12→18 → двигаются полосы возврата T2 и окно A |
| `fund_share_bps` — собственность Finance, дивиденд+узлы, потолок 3500, сегодня недостижим | `districts.json` finance, `PROGRESSION` T5.4 | `G1`: COIN играбелен → доля фонда реально набирается → пропорциональное деление фонда меняется |
| Пять зданий синергий объявлены, но заперты правилом «оба района играбельны»: `drone_depot`, `data_center`, `fleet_yard`, `retail_complex`, `clearing_house` | `buildings.json`, `districts.json synergies`, `L66` | `G4`: с шестью играбельными все шесть синергий (вкл. живой `robotics_lab`) открываются правилом |
| Архетипы Scientist и Manager объявлены, объективы `train`/`research`/`focus` стоят `v1:false`, величины честный ноль | `agents.json roles/objectives`, `R-T5-5` | `G2`: снять `v1:false`→`true`, дать величины ключам `xp_rate_bps`, `compute_cost_bps`; роли `work_research`/`work_admin` уже есть |
| Дерево research — три узла (Grid, Tools, Handbook); §11 обещает шире | `content/params/research.json`, `DESIGN.md` §11 | `G3`: расширить дерево, объектив `research` открывает узлы за compute |
| Компаньон: `companion_rows_live=0`, `companion_revenue_live=0`, оба заперты `L143`; единственная строка `idle_reduction_bps` величиной 0 | `companion.json`, `COMPANION.md` §8 | `G5`/`G6`: снять нули — но это режет `residual_idle_bps` и открывает заново окно A (`L143`, `R-T8-1`) |
| `set_manager_focus` объявлена и **запрещена** компаньону с причиной `v1_1` | `COMPANION.md` §2 | `G5`: перенести из запрещённого словаря в разрешённый, оба словаря — разбиение |
| Краны NFT нулевые: `prize_nft_share_bps=0`, `fragment_nft_share_bps=0` | `COMPANION.md` §10, `R-T8-5` | `G6`: направить выручку NFT — обещание доходности; владельческое решение, по умолчанию ноль |
| Сезоны и призы **живые**: `season_prizes_live=1`, `leaderboard_claim_live=1`, клейм по каждому активу | `seasons.json`, `screens.json`, `M`-фаза | Не переделывать; из списка §11 «сезоны и призовой фонд» уже закрыт |
| Окно фрагментов играбельных районов — живое в v1 | `DESIGN.md` §2.9, §11 | С новыми районами окна фрагментов AMZN/MSFT/COIN оживают тем же правилом |

Вывод разведки: v1.1 — это **не написание нового кода механики**, а снятие заранее заложенных нулей и флагов с обязательным пересчётом калибровки, которую эти нули держали. Ровно так денежная фаза сняла `season_prizes_live` пересчётом. Риск не в объёме кода, а в том, что четыре рычага (оффлайн 12→18, доля фонда, величина компаньона, выход Scientist) двигают одни и те же полосы возврата T2 и окно A.

---

## §3. Решения `D-G-1` … `D-G-12`

### `D-G-1`. Фаза называется G, этапов восемь, фазовое правило одно

Ключи roadmap: `v11_form`, `districts_live`, `archetypes_live`, `research_tree`, `synergy_buildings`, `companion_live`, `companion_revenue`, `rebalance_close`. Ровно восемь. Десятого не выдумывать, имена фаз M и P не переиспользовать.

`.cursor/rules/code-phase.mdc` **переписывается** под фазу G. Второй `.mdc` про этапы не заводится (`R-L-16`), файл сохраняет историческое имя. `PLAN_RELEASE.md` остаётся на диске нетронутым как отложенный план.

### `D-G-2`. v1.1 предшествует подписи `launchToken`; фаза выхода ждёт пак v1.1

Порядок между фазами: сначала весь `G0–G7`, потом `P7 mainnet_launch`. Ранние инфраструктурные этапы выхода (`P0`–`P6`: идентичность, CI, аудит контрактов, образ, репетиция, наблюдение) **разрешено** вести параллельно v1.1 — они пак-контент почти не трогают. Но `P7` подписывает пак, а v1.1 этот пак ещё меняет: `rules_version`, векторы, балансная таблица. Подписать до конца v1.1 значит заморозить ставку на паке, который ещё дважды пересоберётся. Часы player-ready после токена — `D-P-14` в `PLAN_RELEASE`: ≤20 минут, пак вечером; это правка отложенного плана, не старт фазы P.

Причина: `creator_tax_bps` неизменяем после подписи, а `prize_live_min_rules_minor` привязан к `rules_version`. Републикация пака на живом чейне под записанными сменами форкает байты (`A-G-2`).

### `D-G-3`. `rules_version` поднимается один раз, в `G0`, до `0.20.0`

`meta.json rules_version` `0.19.0` → `0.20.0` в `G0`, дальше не дёргается всю фазу. Векторы фазы **изменятся** — это ожидаемо, в отличие от фазы выхода: v1.1 меняет арифметику тика (величины архетипов, компаньона, дивиденды районов). `python content/vectors.py` после `G0` даёт новый sha256, и это свидетель, а не дефект.

Причина: один подъём минора на всю фазу, как `D-M-10`. Считаешь, что нужен второй, — это `R-G-*` к владельцу, не тихий инкремент. `prize_live_min_rules_minor` синхронно поднимать нельзя без пересчёта выплат — призы уже живые, и сдвиг минора требует того же рекаунта, что делала C11 (спросить владельца, если рука тянется).

### `D-G-4`. Открытие района — снятие флага `playable_v1`, а не новый контент

`G1` меняет `districts.json` `playable_v1` `false`→`true` для `logistics`, `automation`, `finance`. Всё остальное — узлы прогрессии, дивиденды, merge, окна фрагментов, синергии — оживает **производно** от этого флага существующими генераторами и правилами (`L66`, `L69`, `L58`, `L59`, `L60`). Ручного списка новых узлов не заводить: он тут же становится вторым источником (`L68`).

Причина: дерево шести районов уже сгенерировано и проверено на доминирование (6321 билд, непокрытых 0). Дописывать узлы руками — форкнуть уже зелёный анализ.

### `D-G-5`. Четыре рычага двигают полосы — считать их порознь, свести один раз

Оффлайн 12→18 (`G1`, дивиденд Automation), доля фонда (`G1`, Finance), выход Scientist через train/XP (`G2`), величина компаньона на `idle_reduction_bps` (`G5`) — каждый двигает полосы возврата T2 и окно A. На каждом band-двигающем этапе исполнитель гоняет `python content/sim.py` **на шаге** и сводит окно A в озвученный владельцем конверт; финальная холистическая сводка — `G7`.

Правило конверта: как `R-M-4` в денежной фазе. Если пересчитанное окно A вышло за замороженную границу — расхождение выносится владельцу **с числом**, а не подгоняется под окно. Внутри границы — этап закрывается.

Причина: полосы возврата T2 — это обещание игроку, что депозит окупается за горизонт сезона. Сдвиг любого из четырёх рычагов без пересчёта делает окно A недействительным молча.

### `D-G-6`. Порядок этапов минимизирует двойной пересчёт

`G1` первым из содержательных: районы каскадируют больше всего и несут два из четырёх рычагов сразу (оффлайн, доля фонда) — их пересчёт делается вместе. `G2` архетипы после районов: Manager выбирает контур across районов, Scientist сидит в `work_research` беконе compute (играбелен). `G3` дерево research после архетипов: объектив `research` открывает узлы, роль Scientist должна уже жить. `G4` синергии после районов: правило «оба играбельны» требует `G1`; от архетипов не зависит. `G5` компаньон после `G2`: Manager focus требует живого Manager. `G6` выручка NFT после компаньона. `G7` последним: холистический пересчёт всех рычагов вместе, полный прогон, публикация пака.

Порядок нарушать нельзя. `G1` раньше `G4`, потому что синергия без играбельных районов — запертое правилом здание. `G2` раньше `G5`, потому что `set_manager_focus` бессмысленна без роли Manager.

### `D-G-7`. Архетипы получают величины, а не новый код

`G2` меняет `agents.json` объективы `train`, `research`, `focus` с `v1:false` на `v1:true` и даёт ненулевые величины ключам `xp_rate_bps` и `compute_cost_bps` строками в `modifiers.json`, не новым кодом (`R-T5-5`, `L85`). Scientist тратит compute на обучение или на открытие узлов; Manager focus — выбор контура, `keys=[]`. Второй расходуемый ресурс (compute) уже существует — Scientist его потребитель, как обещано `DESIGN.md` §1 «расходуемых ровно два».

Причина: канон уже держит строки этих объективов честным нулём именно чтобы v1.1 сняла ноль строкой, а не веткой. Ключи `xp_rate_bps`/`compute_cost_bps` объявлены и стоят в потолках T5.4.

### `D-G-8`. Компаньон оживает через флаг с пересчётом окна A, не через новый ключ

`G5` снимает `companion_rows_live` `0`→`1` и даёт `companion_idle_relief_bps` ненулевую величину — но только вместе со свидетелем пересчёта окна A (`sim.py`). Величина режет `residual_idle_bps`, поднимает `uptime_optimizer_bps` и открывает окно A заново (`COMPANION.md` §8, `R-T8-1`, `L143`). `set_manager_focus` переносится из запрещённого словаря в разрешённый; оба словаря остаются разбиением, пересечение пусто (`COMPANION.md` §2). Строка компаньона на `output_bps` по-прежнему запрещена и попадает в форточку T5.6 (`R-T8-4`, `L77`).

Причина: `L143` заперт нулём именно чтобы поднятие проходило через пересчёт, а не тихо. Компаньону запрещена строка на `offline_cap_hours` даже нулём — это собственность Automation (`COMPANION.md` §9); фаза этого не ослабляет.

### `D-G-9`. Кран NFT по умолчанию ноль; направить выручку — решение владельца

`G6` не направляет выручку NFT в пул фрагментов или призов без явной ратификации владельца. По умолчанию `prize_nft_share_bps` и `fragment_nft_share_bps` остаются нулём: сначала выручка NFT закрывает счёт за инференс, направить её в пул — обещание доходности, которое протокол не удержит (`COMPANION.md` §10, `R-T8-5`). Этап закрывается либо заведёнными долями с пересчётом, либо зафиксированным нулём с причиной — стоять на ожидании владельца этапу нельзя.

Причина: сплит `protocol_fragments_bps`/`protocol_prizes_bps` не двигается, и второй источник доли в пул — ровно тот запрещённый «жир из NFT», от которого канон отталкивается.

### `D-G-10`. Синергии оживают правилом, автономный слот второй петли — следствие

`G4` не пишет пять зданий заново — они объявлены. Этап проверяет, что правило «синергия играбельна ⟺ оба района играбельны» открыло все шесть, что матрица аффинити (`buildings.derived.affinity_matrix`) совпадает с каноном `DESIGN.md` §5.8, что автономные слоты и выходы синергий на месте. `robotics_lab` уже живёт в v1 — его не трогать.

Причина: `L66` и фикстура `design_5_8.json` уже держат матрицу; этап доказывает раскрытие, а не переписывает данные.

### `D-G-11`. Балансная таблица и симуляция пересчитываются, доминирование доказывается заново

`G7` пересобирает `docs/BALANCE.md` и прогоняет `content/builds.py` на полном множестве играбельных: доминирующих стратегий 0, мёртвых узлов 0, обязательных 0 — как сегодня, но теперь на шести районах в игре, а не на трёх. `sim.py` печатает окно A и полосы возврата свежими; круг трения по-прежнему `[1400, 1600]`, вход дешевле выхода, касса держится.

Причина: `L63`/`L64`/`L65` (доминирование), `L45`–`L55` (симулятор) уже guard'ят это; на v1.1 множество сценариев расширяется, и анализ обязан пройти на нём.

### `D-G-12`. Сквозной закон детерминизма и «одно число в одном месте» не ослабляется

Тик остаётся чистой функцией. Величины архетипов и компаньона — строки в паке, не литералы в движке. Ни одно число не появляется дважды: потолки из якорей (T5.4), окно A из `sim.py`, дивиденды из генератора. Барьер демо не двигается: демо без компаньона (`demo_companion=0`), без приза, без фарма; `demo_transfer_edges` пуст; `L112`, `L292`, `DEMO_NO_COMPANION` не трогаются.

---

## §4. Этапы `G0` … `G7`

У каждого этапа десять полей. Критерий готовности выполняется буквально, командой. `G(N+1)` не начинается, пока гейт `G(N)` не зелёный и `G<N>_final.md` не написан.

Band-двигающие этапы (`G1`, `G2`, `G5`, `G7`) гоняют `python content/sim.py` **на шаге**. Прочие — нет. Этапы, правящие `content/lint.py` (снятие замка флага), гоняют полную регрессию `python content/attack.py --jobs 8` при своём закрытии — этого требует сам канон дисциплины, потому что правился `lint.py`. На остальных этапах гейт узкий: `--only`.

---

### `G0` — `v11_form`. Форма фазы: ключи, минор, инвентарь рычагов

**Цель.** Пак знает восемь этапов фазы; `rules_version` = `0.20.0`; перечень живых флагов и полос под пересчёт зафиксирован.

**Строка ROADMAP.**
`v11_form` · goal: `Pack carries the eight v1.1 stages; rules_version 0.20.0; the levers to recount are listed` · gate_cmd: `python content/build.py && python content/lint.py && python content/attack.py --only L262,L268,L306` · ts_gate_cmd: `pnpm --filter @corporator/contentpack run gate` · tests: `L262`, `L268`, `L306` · construction_tests: `v11_stage_keys_exist`, `rules_minor_is_twenty`, `live_flags_inventoried` · invariants: `layout_v1_bytes` · src: `D-G-1, D-G-3, PLAN_V11 G0` · why: `A stage without a roadmap row makes every new it() red on L268`.

**Входы.** `docs/ROADMAP.md`, `content/params/arch.json` (`roadmap`, `roadmap_order`), `content/params/meta.json` (`rules_version`), `docs/CONTENT.md` §5/§6, `M7_final.md`.

**Выходы.** Восемь строк в `arch.roadmap` и восемь имён в `roadmap_order`; абзац порядка `docs/ROADMAP.md` дополнен фазой G одним предложением; `rules_version` `0.20.0`; правило `L306`; три пробы; `pack_version` +1 с причиной; `docs/reports/G0_*.md`.

**Команда гейта.** Строка `gate_cmd`. Плюс `ReadLints`. `vectors.py` здесь ещё не двигается — минор поднят, но арифметика тика та же до `G1`; свидетель неизменности векторов на `G0` — часть свидетельства, что подъём минора сам по себе байты не тронул.

**Инвариантные тесты.** `L262` — каждый инвариант D13 в этапе. `L268` — двусторонняя связь проб. `L306` — восемь ключей фазы есть, минор ровно 20, инвентарь рычагов непуст.

**Критерий готовности.** `build.py` печатает новый `pack_version` и `rules 0.20.0`; `lint.py` даёт `305/0`; красный прогон `L306` на подготовленном входе (убрать ключ этапа; поставить минор 19; опустошить инвентарь).

**Объём.** Малый: два параметрических поля, правило, три пробы, документ.

**Зависит от.** §0 предусловие.

**Риски.** Поднять `prize_live_min_rules_minor` заодно — молча остановить выплату призов. Завести девятый ключ. Назвать ключ именем фазы M/P.

---

### `G1` — `districts_live`. AMZN, MSFT, COIN играбельны; каскад узлов, merge, дивидендов; первый пересчёт полос

**Цель.** Шесть районов играбельны; 18 узлов и 7 merge оживают правилом; оффлайн тянется до 18, доля фонда набирается; окно A пересчитано и в конверте.

**Строка ROADMAP.**
`districts_live` · goal: `Three districts flip playable; nodes, merges and dividends live by rule; bands recounted` · gate_cmd: `python content/build.py && python content/lint.py && python content/vectors.py && python content/sim.py && python content/builds.py && python content/attack.py --only L58,L59,L60,L66,L69,L307` · ts_gate_cmd: `pnpm -w run gate` · tests: `L58`, `L59`, `L60`, `L66`, `L69`, `L307` · construction_tests: `six_districts_playable`, `offline_cap_reaches_eighteen`, `fund_share_reaches_cap`, `merge_active_cap_is_three`, `window_a_in_envelope` · invariants: `L13_L14`, `I1_I3`, `payroll_proportional` · src: `D-G-4, D-G-5, PLAN_V11 G1` · why: `The tree of six districts is already generated; the flag gates which are live, and two of four levers move here`.

**Входы.** `content/params/districts.json` (`playable_v1`), `progression.json`, `balance.json`, `time.json` (оффлайн база 12), `sim.py`, `builds.py`, `docs/PROGRESSION.md`, `docs/BALANCE.md`, `DESIGN.md` §4.2/§11.

**Выходы.** Три флага `playable_v1` `true`; регенерированные секции GENERATED «T4: узлы прогрессии», «T4: merge», BUILDS.md на полном множестве; пересчитанное окно A и полосы возврата в выводе `sim.py`; правило `L307`; пять проб; `DESIGN.md` §11 правлен пословно (три района из «режем» переходят в «входит»); `PROGRESSION.md` §7 (`builds_raw_v1` → полный) и `BALANCE.md` полосы — пословно; `pack_version` +1.

**Команда гейта.** Строка `gate_cmd`. `sim.py` обязателен (`D-G-5`): в выводе целыми — окно A и полосы возврата, окно внутри конверта. `builds.py`: доминирующих 0, мёртвых 0, обязательных 0, непокрытых 0.

**Инвариантные тесты.** `L58` оффлайн 12+6=18; `L59` merge не на канонической синергии; `L60` `merge_active_cap`=3 из паросочетания; `L66` v1-подмножество = полное; `L69` свидетели билдов; `L307` — шесть играбельных, оба дивиденда достижимы, окно A в конверте.

**Критерий готовности.** Все команды зелёные; окно A в озвученном владельцем конверте (иначе `R-G-*` с числом); круг по-прежнему `1445` ∈ `[1400,1600]`, вход 200 < выход 910; касса держится; пять проб показали красный прогон.

**Объём.** Крупный по пересчёту, малый по правке данных: три флага плюс регенерация плюс сведение полос.

**Зависит от.** `G0`.

**Риски.** Дописать узлы руками (`L68`). Сдвинуть окно A подгонкой параметра вместо признания расхождения. Забыть, что оффлайн 18 и доля фонда двигают полосы — засчитать этап без `sim.py`. Merge на канонической синергии (`L59`).

---

### `G2` — `archetypes_live`. Scientist и Manager с величинами; XP и research-за-compute; второй пересчёт

**Цель.** Пять ролей вместо трёх; `train`/`research`/`focus` играбельны с честными величинами; Scientist — потребитель compute; полосы пересчитаны.

**Строка ROADMAP.**
`archetypes_live` · goal: `Scientist and Manager go live with real magnitudes; compute gets its second consumer` · gate_cmd: `python content/build.py && python content/lint.py && python content/vectors.py && python content/sim.py && python content/attack.py --only L70,L72,L73,L85,L86,L308` · ts_gate_cmd: `pnpm -w run gate` · tests: `L70`, `L72`, `L73`, `L85`, `L86`, `L308` · construction_tests: `five_roles_live`, `scientist_spends_compute`, `manager_focus_picks_contour`, `train_grants_xp`, `window_a_in_envelope_after_archetypes` · invariants: `L13_L14`, `tick_pure` · src: `D-G-7, D-G-5, PLAN_V11 G2` · why: `The canon already holds these objectives at an honest zero so v1.1 lifts the zero with a row, not a branch`.

**Входы.** `content/params/agents.json` (`roles`, `objectives`), `modifiers.json` (строки, потолки, якоря), `modifier_keys.json` (`xp_rate_bps`, `compute_cost_bps`, `scope`, `stage`), `sim.py`, `DESIGN.md` §5.6/§5.9/§5.13, `PROGRESSION.md` T5.

**Выходы.** `train`/`research`/`focus` `v1:true`; ненулевые строки величин в `modifiers.json` (в потолках T5.4, якорь compute = кривая energy); GENERATED «T5: строки модификаторов» перегенерирован; пересчитанные полосы в `sim.py`; правило `L308`; пять проб; `DESIGN.md` §5.11/§11 и `PROGRESSION.md` T5.1 правлены пословно (Scientist/Manager из нуля в живые); `pack_version` +1.

**Команда гейта.** Строка `gate_cmd`. `sim.py` обязателен (band-двигающий: XP-обучение поднимает эффективный выход когорты).

**Инвариантные тесты.** `L70` верх потолка семьи; `L72` T5 не переопределяет набор ключей T0; `L73` нет ключа со `stage=objective`; `L85` объектив с `keys=[]` не пишет строк, с ключами — пишет; `L86` битность числителя ≤ 192; `L308` — пять ролей живы, величины ненулевые и в потолке, окно A в конверте.

**Критерий готовности.** Команды зелёные; compute имеет второго потребителя (Scientist) без слияния с energy (`T5.1` ортогональность); окно A в конверте; круг и касса держатся; пробы красны на подготовленном входе.

**Объём.** Средний: флаги, строки величин, сведение полос.

**Зависит от.** `G1`.

**Риски.** Слить `compute_cost_bps` с `energy_cost_bps` — спрятать `IDLE(нет compute)` (`T5.1`). Дать величину выше потолка семьи (`L70`). Забыть форточку T5.6, если Scientist трогает `output_bps` косвенно (`L77`). Не пересчитать полосы.

---

### `G3` — `research_tree`. Дерево research шире трёх узлов; объектив research открывает узлы

**Цель.** Research-дерево расширено правилом; `research` тратит compute на открытие узлов; цены выведены, ручного списка нет.

**Строка ROADMAP.**
`research_tree` · goal: `Research widens past three nodes; the research objective opens nodes for compute` · gate_cmd: `python content/build.py && python content/lint.py && python content/vectors.py && python content/attack.py --only L61,L62,L68,L71,L309` · ts_gate_cmd: `pnpm --filter @corporator/engine run gate` · tests: `L61`, `L62`, `L68`, `L71`, `L309` · construction_tests: `research_wider_than_three`, `research_cost_derived`, `research_objective_opens_node` · invariants: `tick_pure` · src: `D-G-6, PLAN_V11 G3` · why: `Three nodes were the v1 floor; v1.1 widens the tree the same way progression is generated, not by hand`.

**Входы.** `content/params/research.json`, `progression.json`, `agents.json` (`research` objective), `balance.json` (`research_cost_per_effect_bps`), `DESIGN.md` §11, `PROGRESSION.md` §4.

**Выходы.** Расширенное дерево research (узлы grammar'ом, не перечислением); цена узла — `fused_effect_cost` тем же генератором, что тир (`PROGRESSION` §4), без нового числа; связь `research` objective → открытие узла за compute; правило `L309`; три пробы; `DESIGN.md` §11 и `PROGRESSION.md` правлены; `pack_version` +1.

**Команда гейта.** Строка `gate_cmd`. Band не двигает напрямую (research — вход, не выход когорты) — `sim.py` не в шаге; если исполнитель обнаружил, что расширение сдвигает полосы, это `R-G-*` и `sim.py` добавляется.

**Инвариантные тесты.** `L61` пол цены узла соблюдён; `L62` гейты тира; `L68`/`L71` ни одно число дважды; `L309` — дерево шире трёх, цены выведены, объектив открывает узел.

**Критерий готовности.** Команды зелёные; узлов больше трёх; ни одной цены-литерала; `research` реально открывает узел за compute; пробы красны.

**Объём.** Средний: грамматика узлов, генератор цены, три пробы.

**Зависит от.** `G2` (роль Scientist и объектив research живы).

**Риски.** Перечислить узлы руками вместо грамматики (`L68`). Задать цену числом мимо `fused_effect_cost`. Сделать research-узел бесплатным обходом нормировки (`L77`, `paid=1` research в форточку не входит).

---

### `G4` — `synergy_buildings`. Пять оставшихся зданий синергий раскрыты правилом

**Цель.** Все шесть синергий открываются правилом «оба района играбельны»; матрица аффинити и выходы совпадают с каноном.

**Строка ROADMAP.**
`synergy_buildings` · goal: `The five remaining synergy buildings open by rule; affinity matrix matches the canon` · gate_cmd: `python content/build.py && python content/lint.py && python content/attack.py --only L05,L07,L08,L66,L310` · ts_gate_cmd: `pnpm --filter @corporator/engine run gate` · tests: `L05`, `L07`, `L08`, `L66`, `L310` · construction_tests: `six_synergies_open`, `affinity_matrix_matches_canon`, `autonomous_slot_present` · invariants: `demo_isolated` · src: `D-G-10, PLAN_V11 G4` · why: `Robotics Lab was v1 by rule, not by taste; the other five open the same way once their districts are playable`.

**Входы.** `content/params/buildings.json` (`synergy`), `districts.json` (`synergies`), `content/fixtures/design_5_8.json`, `DESIGN.md` §4.4/§5.8/§7.3, `docs/SCREENS.md`.

**Выходы.** Свидетель раскрытия шести синергий в GENERATED; сверка `affinity_matrix` с фикстурой; правило `L310`; три пробы; `DESIGN.md` §11 (пять зданий из «режем» в «входит») правлен; `HUD.md`/`SCREENS.md` правятся, только если поверхность синергий поехала; `pack_version` +1.

**Команда гейта.** Строка `gate_cmd`. Band не двигает — `sim.py` не в шаге.

**Инвариантные тесты.** `L05` аффинити с каноном; `L07` продюсеры/выходы; `L08` беконы; `L66` v1-подмножество (теперь полное); `L310` — шесть синергий открыты, матрица совпала, автономный слот на месте.

**Критерий готовности.** Команды зелёные; `robotics_lab` не тронут; все шесть открыты правилом без ручного списка; пробы красны на подмене поля матрицы (`L05`).

**Объём.** Малый: почти всё производно; этап доказывает раскрытие.

**Зависит от.** `G1`.

**Риски.** Открыть синергию списком, а не правилом. Тронуть `robotics_lab`. Разъезд матрицы с фикстурой `design_5_8.json`.

---

### `G5` — `companion_live`. Ненулевой компаньон, Manager focus; третий пересчёт окна A

**Цель.** `companion_rows_live=1` с величиной `idle_reduction`; `set_manager_focus` разрешена; окно A пересчитано под сниженный `residual_idle`.

**Строка ROADMAP.**
`companion_live` · goal: `Companion idle relief goes non-zero with a window-A recount; set_manager_focus becomes allowed` · gate_cmd: `python content/build.py && python content/lint.py && python content/vectors.py && python content/sim.py && python content/attack.py --only L77,L140,L143,L311` · ts_gate_cmd: `pnpm -w run gate` · tests: `L77`, `L140`, `L143`, `L311` · construction_tests: `companion_relief_non_zero`, `manager_focus_allowed`, `residual_idle_floor_held`, `window_a_in_envelope_after_companion` · invariants: `payroll_proportional`, `demo_isolated` · src: `D-G-8, D-G-5, PLAN_V11 G5` · why: `L143 locks the flag at zero precisely so lifting it goes through a recount, not silently`.

**Входы.** `content/params/companion.json` (`companion_rows_live`, rows, commands), `modifiers.json` (`idle_reduction_bps`, `residual_idle_bps`), `sim.py`, `COMPANION.md` §2/§8/§9, `DESIGN.md` §5.14.

**Выходы.** `companion_rows_live=1`; `companion_idle_relief_bps` ненулевая, в потолке `10000 − residual_idle_bps`; `set_manager_focus` перенесена в разрешённый словарь (разбиение сохранено); правило `L311`; изменённый замок в `content/lint.py` (`L143`: ноль → «единица только со свидетелем рекаунта»); четыре пробы; `COMPANION.md` §1/§8/§10 правлен пословно; `pack_version` +1.

**Команда гейта.** Строка `gate_cmd`. `sim.py` обязателен. Правился `lint.py` (`L143`) → полный `python content/attack.py --jobs 8` **при закрытии этапа** (канон дисциплины: правка `lint.py`), не на каждом под-шаге.

**Инвариантные тесты.** `L77` строка компаньона на `output_bps` падает в форточку (запрещена); `L140` свидетель аптайма читает величину через `mul_remainder`, не флаг; `L143` поднятие только со свидетелем окна A; `L311` — величина ненулевая и в потолке, focus разрешён, пол `residual_idle` держится, окно A в конверте.

**Критерий готовности.** Команды зелёные; окно A пересчитано и в конверте; `residual_idle_bps` не пробит; компаньон не тронул `offline_cap_hours` (`COMPANION.md` §9); демо без компаньона (`DEMO_NO_COMPANION`); полный прогон при закрытии зелёный; пробы красны.

**Объём.** Средний по данным, высокий по пересчёту: это самый тонкий из четырёх рычагов.

**Зависит от.** `G2` (Manager жив).

**Риски.** Поднять флаг без свидетеля (`L143`). Величина режет `residual_idle` ниже пола — окно A недействительно. Строка компаньона на `output_bps` мимо форточки (`R-T8-4`). Строка на `offline_cap_hours` даже нулём (`COMPANION.md` §9).

---

### `G6` — `companion_revenue`. Выручка NFT: счёт за инференс, краны по умолчанию ноль

**Цель.** Выручка NFT учтена; краны в пул не открыты без ратификации владельца; по умолчанию ноль зафиксирован с причиной.

**Строка ROADMAP.**
`companion_revenue` · goal: `NFT revenue covers inference first; crane shares stay zero unless the owner ratifies` · gate_cmd: `python content/build.py && python content/lint.py && python content/attack.py --only L143,L280,L312` · ts_gate_cmd: `pnpm --filter @corporator/api run gate` · tests: `L143`, `L280`, `L312` · construction_tests: `nft_crane_zero_by_default`, `revenue_not_in_pool_without_ratification`, `inference_account_present` · invariants: `I11` · src: `D-G-9, PLAN_V11 G6` · why: `Directing NFT revenue into a pool is a yield promise the protocol will not hold`.

**Входы.** `content/params/companion.json` (`companion_revenue_live`, `prize_nft_share_bps`, `fragment_nft_share_bps`), `docs/PRIZES.md` §3, `COMPANION.md` §10, `R-T8-5`.

**Выходы.** Учёт счёта за инференс (выручка сначала на счёт); краны нулём с явной причиной или, при ратификации владельца, ненулевые доли с пересчётом; сплит `protocol_fragments_bps`/`protocol_prizes_bps` не тронут; правило `L312`; три пробы; `COMPANION.md` §10 правлен, если поверхность поехала; `pack_version` +1.

**Команда гейта.** Строка `gate_cmd`. Band не двигает при нулевых кранах — `sim.py` не в шаге; при ратификации ненулевых долей владельцем `sim.py` добавляется и `R-G-*` фиксирует решение.

**Инвариантные тесты.** `L143` замок компаньона; `L280` пол эффективной ставки фонда (доля фонда не худеет); `L312` — краны нулём без ратификации, выручка не в пуле, счёт инференса есть.

**Критерий готовности.** Команды зелёные; либо доли нулём с причиной, либо ратифицированы с пересчётом; фонд в bps оборота не похудел (`L280`); этап не стоит на ожидании владельца (закрывается фиксацией нуля); пробы красны.

**Объём.** Малый по коду, требует явного решения владельца.

**Зависит от.** `G5`.

**Риски.** Направить выручку в пул тихо (`R-T8-5`, `L312`). Ослабить пол фонда (`L280`). Оставить этап открытым в ожидании владельца вместо фиксации нуля.

---

### `G7` — `rebalance_close`. Холистический пересчёт, доминирование, публикация пака

**Цель.** Все четыре рычага сведены вместе; доминирование доказано на полном множестве; окно A ратифицировано; пак опубликован.

**Строка ROADMAP.**
`rebalance_close` · goal: `All levers settle together; dominance re-proven on the full set; window A ratified; pack published` · gate_cmd: `python content/build.py && python content/lint.py && python content/vectors.py && python content/codegen.py --check && python content/sim.py && python content/builds.py && python content/attack.py --jobs 8` · ts_gate_cmd: `pnpm -w run gate` · tests: `L13`, `L14`, `L45`, `L47`, `L63`, `L64`, `L65`, `L313` · construction_tests: `friction_budget_held`, `no_dominant_no_dead_no_mandatory`, `window_a_ratified` · invariants: `L13_L14`, `I1_I3`, `I5`, `I7`, `I11`, `payroll_proportional` · src: `D-G-11, PLAN_V11 G7` · why: `Four levers moved the same bands; the phase closes only when they settle together, not one at a time`.

**Входы.** Все выходы `G1`–`G6`; `docs/BALANCE.md`, `docs/SIMULATION.md`, `sim.py`, `builds.py`; конверт окна A от владельца.

**Выходы.** Пересобранные `BALANCE.md` и полосы возврата; `builds.py` на полном множестве (доминирующих 0, мёртвых 0, обязательных 0, непокрытых 0); ратифицированное окно A; правило `L313`; три пробы; свежая печать круга и breakeven; опубликованный пак (`pack_version` +1, полный прогон и `sim.py` — это публикация); `docs/reports/G7_final.md`.

**Команда гейта.** Строка `gate_cmd` — это закрытие фазы, полный `attack.py --jobs 8` и `sim.py` здесь обязательны.

**Инвариантные тесты.** `L13`/`L14` бюджет трения и вход<выход; `L45`/`L47` симулятор и окно A из пака; `L63`/`L64`/`L65` доминирование; `L313` — окно A в ратифицированном конверте, круг в полосе, касса на шести районах.

**Критерий готовности.** Круг `∈ [1400,1600]`, вход строго < выход; касса `I1/I3` держится с шестью районами; окно A ратифицировано владельцем; доминирующих/мёртвых/обязательных 0; полный прогон и `sim.py` зелёные и приложены числами.

**Объём.** Крупный по пересчёту, малый по новому коду.

**Зависит от.** `G1`–`G6`, все зелёные.

**Риски.** Свести рычаги по отдельности и не проверить вместе — окно A разъедется на стыке. Подогнать полосу вместо ратификации. Забыть, что публикация — единственное законное место полного прогона внутри фазы.

---

## §5. Новые правила линтера `L306` … `L313`

Нумерация продолжается от `L305`. Каждое правило регистрируется строкой в `docs/CONTENT.md` §6 в том же заходе, что и код.

| id | этап | что ловит | вход, на котором обязано упасть |
|---|---|---|---|
| `L306` | G0 | нет ключа этапа фазы; `rules_version` минор ≠ 20; пустой инвентарь рычагов | поставить `rules_version` `0.19.0` |
| `L307` | G1 | играбельных районов ≠ 6; оффлайн не достигает 18 или доля фонда не достигает потолка; `merge_active_cap` ≠ 3; окно A вне конверта | оставить `logistics.playable_v1 = false` |
| `L308` | G2 | `train`/`research`/`focus` остались `v1:false`; величина архетипа нулевая или выше потолка семьи; compute слит с energy | оставить `train.v1 = false` |
| `L309` | G3 | дерево research не шире трёх узлов; цена узла — литерал мимо `fused_effect_cost`; объектив `research` не открывает узел | добавить четвёртый узел с ценой-числом |
| `L310` | G4 | открыто не шесть синергий; матрица аффинити разошлась с `design_5_8.json`; синергия открыта списком, а не правилом | открыть `drone_depot` ручным флагом |
| `L311` | G5 | `companion_rows_live=1` без свидетеля рекаунта; величина режет `residual_idle` ниже пола; `set_manager_focus` не в разрешённом словаре | поднять флаг без свидетеля окна A |
| `L312` | G6 | краны NFT ненулевые без ратификации; выручка направлена в пул; пол фонда `L280` ослаблен | поставить `prize_nft_share_bps = 400` без ратификации |
| `L313` | G7 | окно A вне ратифицированного конверта; круг вне `[1400,1600]`; вход ≥ выход на шести районах | сдвинуть полосу за границу конверта |

Правило без показанного красного прогона на подготовленном входе правилом не считается и этап не закрывает. `L143` (замок компаньона) и `L66` (v1-подмножество) в этой фазе **изменяются** — их правка триггерит полный прогон при закрытии соответствующего этапа.

---

## §6. Конструкционные пробы по этапам

Имя пробы дословно равно имени `it()`. Связь двусторонняя (`L268`): пробу и строку заводить одной правкой.

| этап | пробы |
|---|---|
| `G0` | `v11_stage_keys_exist`, `rules_minor_is_twenty`, `live_flags_inventoried` |
| `G1` | `six_districts_playable`, `offline_cap_reaches_eighteen`, `fund_share_reaches_cap`, `merge_active_cap_is_three`, `window_a_in_envelope` |
| `G2` | `five_roles_live`, `scientist_spends_compute`, `manager_focus_picks_contour`, `train_grants_xp`, `window_a_in_envelope_after_archetypes` |
| `G3` | `research_wider_than_three`, `research_cost_derived`, `research_objective_opens_node` |
| `G4` | `six_synergies_open`, `affinity_matrix_matches_canon`, `autonomous_slot_present` |
| `G5` | `companion_relief_non_zero`, `manager_focus_allowed`, `residual_idle_floor_held`, `window_a_in_envelope_after_companion` |
| `G6` | `nft_crane_zero_by_default`, `revenue_not_in_pool_without_ratification`, `inference_account_present` |
| `G7` | `friction_budget_held`, `no_dominant_no_dead_no_mandatory`, `window_a_ratified` |

---

## §7. Карта правок пака

| файл | ключ | было | станет | этап |
|---|---|---|---|---|
| `arch.json` | `roadmap`, `roadmap_order` | ключи M/P | +8 ключей G | G0 |
| `meta.json` | `rules_version` | 0.19.0 | **0.20.0** | G0 |
| `districts.json` | `logistics/automation/finance.playable_v1` | false | **true** | G1 |
| `modifiers.json` | строки `xp_rate_bps`, `compute_cost_bps` | ноль | ненулевые в потолке | G2 |
| `agents.json` | `train`/`research`/`focus.v1` | false | **true** | G2 |
| `research.json` | узлы дерева | 3 | шире, грамматикой | G3 |
| `companion.json` | `companion_rows_live` | 0 | **1** (со свидетелем) | G5 |
| `companion.json` | `companion_idle_relief_bps` | 0 | ненулевая | G5 |
| `companion.json` | `set_manager_focus` | запрещена | разрешена | G5 |
| `companion.json` | `companion_revenue_live`, `*_nft_share_bps` | 0 | ноль или ратифицировано | G6 |
| `balance.json` / GENERATED | полосы возврата, окно A | v1 три района | пересчитано на шести | G1, G2, G5, G7 |

Производные, обязанные остаться производными: окно A, полосы возврата, потолки ключей, дивиденды, `merge_active_cap`, цены узлов, `builds_raw_v1`. Хранить любую — дефект класса `L281`/`L68`.

Живой флаг `season_prizes_live=1` и `leaderboard_claim_live=1` **не трогать** — они уже сняты денежной фазой.

---

## §8. Атаки на план

| id | атака | что находится | чем закрыто |
|---|---|---|---|
| `A-G-1` | Снять `playable_v1` без пересчёта полос | оффлайн 18 и доля фонда двигают возврат молча | `D-G-5`, `sim.py` на `G1`, `L307` |
| `A-G-2` | Поднять `rules_version` на живом чейне | републикация пака под записанными сменами форкает байты | `D-G-2`, v1.1 до подписи |
| `A-G-3` | Дописать 18 узлов и 7 merge руками | второй источник, форк зелёного анализа | `D-G-4`, `L68` |
| `A-G-4` | Поднять `companion_rows_live` без свидетеля | величина режет `residual_idle`, окно A недействительно тихо | `L143`, `L311`, `D-G-8` |
| `A-G-5` | Дать компаньону строку на `output_bps` «бонус NFT» | +700 мимо нормировки | `L77`, форточка T5.6, `R-T8-4` |
| `A-G-6` | Дать компаньону строку на `offline_cap_hours` нулём | вторжение в собственность Automation | `COMPANION.md` §9, ключ не в params компаньона |
| `A-G-7` | Направить выручку NFT в пул призов | обещание доходности, сплит поехал | `R-T8-5`, `L312`, `D-G-9` |
| `A-G-8` | Слить `compute_cost_bps` с `energy_cost_bps` | `IDLE(нет compute)` спрятан за energy | `T5.1`, `L308` |
| `A-G-9` | Дать величину архетипа выше потолка семьи | контент заменяет уровень здания | `L70`, потолок T5.4 |
| `A-G-10` | Сделать research-узел бесплатным на `output_bps` | обход нормировки платного контента | `L77`, `paid=1` research вне форточки |
| `A-G-11` | Подогнать окно A под границу вместо ратификации | полоса возврата врёт игроку | `D-G-5`, `R-M-4`-класс, `L313` |
| `A-G-12` | Открыть синергию списком, тронуть `robotics_lab` | ручное исключение вместо правила | `L66`, `L05`, `D-G-10` |
| `A-G-13` | Свести четыре рычага порознь, не вместе | окно A разъедется на стыке | `G7` холистический, `L47` |
| `A-G-14` | Открыть `merge` на канонической синергии | merge и synergy пересеклись | `L59`, `L60` |
| `A-G-15` | Демо-город получает компаньона или новый приз | барьер демо ослаблен | `L112`, `L292`, `DEMO_NO_COMPANION`, `D-G-12` |
| `A-G-16` | Гонять `attack.py --jobs 8` на каждом под-шаге | час на шаг, дисциплина рушится | узкий гейт `--only`; полный — только правка `lint.py` и закрытие фазы |
| `A-G-17` | Забыть, что призы уже живые, и «включить» их снова | двойной рекаунт, разъезд `season_prizes_live` | §2, не трогать живой флаг |

Принятое и не закрываемое кодом, о чём молчать нельзя: неопределённость окна A до пересчёта (ратификация владельца); `R-T8-2` (цена инференса интервалом), `R-T5-12` (стек пуст на калибровочной когорте — полосы могли не двигаться, проверить на живом стеке).

---

## §9. PENDING → владелец / этап

| item | владелец | адрес |
|---|---|---|
| конверт окна A после v1.1 | **owner** | нужен к `G1`; ратификация на `G7` (`R-M-4`-класс) |
| краны NFT: доли в пул или ноль | **owner** | `G6`; по умолчанию ноль (`D-G-9`) |
| ночной штраф на выход `night_penalty` | **owner** | не мандат фазы; если включать — отдельный рекаунт, `G7` |
| `companion_llm_price_snapshot` | **owner** | `R-L-19`/`R-T8-2`; интервал держится, если провайдер не выбран |
| порядок относительно фазы выхода | **owner** | `D-G-2`: v1.1 до `P7`; `P0`–`P6` можно параллельно |
| `exit_uncovered_at_band_floor` | **owner** | пересчитать на полосах после `G7`, значение старое |
| `bank_withdraw_rate_ceiling_only` | T3 | не фаза G, `L13`/`L14` не трогать |
| живой сабмит merkle (`chain_v1_1`) | фаза выхода | не геймплей; дом — `PLAN_RELEASE` P5, не дублировать здесь |

---

## §10. Воспроизведение состояния входа

```
python content/build.py
python content/lint.py
python content/vectors.py
python content/builds.py
```

Полный `python content/attack.py --jobs 8` и `python content/sim.py` — закрытие фазы, публикация пака, и этап, правивший `lint.py` (`R-C-4`, канон дисциплины). На band-двигающем этапе `sim.py` — часть шага (`G1`, `G2`, `G5`, `G7`), на прочих нет. Хеш пака — из поля `hash`, вперёд не копируется.

**Next Step исполнения: `G0` — восемь строк roadmap, `rules_version` `0.20.0`, правило `L306`, три пробы, `pack_version` +1.**
