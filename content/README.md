# content/

Контент-пак Corporator. Правила и обоснования — `docs/CONTENT.md`.

```
python content/build.py      собрать пак, сверить матрицу ролей с §5.8, скоуп v1 с §11 и кривую с KOTS
python content/lint.py       прогнать 272 правил линтера
python content/attack.py     сломать контент: каждое правило обязано поймать своё; плюс пробы конструкции
python content/world.py      генератор планировки T10: счётчики, хеш сцены
python content/studio.py     студия владельца: сразу показывает art/preview/scene.png, фикстура authored_layout.json
python art/pipeline/layout.py  art/out/scene.json и layout.sha256 из пака
python content/sim.py        сезон T3: SIM.md и SIM.sha256
python content/builds.py     доминирование T4: BUILDS.md и BUILDS.sha256
```

Порядок всегда такой. Третий шаг ловит то, что первые два не видят: правило, которое переписали и которое перестало срабатывать.

Требуется Python 3.10+ и `jsonschema`.

Гейт шага — `python content/attack.py` без флагов. `--jobs`, `--only`, `--since-rule`, `--construction-only`, `--skip-construction` и `--profile` — только итерация; в отчёт по шагу не входят.

## Что где

| Путь | Что это | Правится руками |
|---|---|---|
| `schema/corporator.schema.json` | нормативная схема всех файлов | да |
| `params/*.json` | параметры: только то, что не выводится; `balance.json` и `research.json` — T2 | да |
| `strings/ru.json` | тексты по кодам отказов и состояний | да |
| `fixtures/design_5_8.json` | дословная копия таблицы §5.8, эталон для генератора | только вместе с каноном |
| `fixtures/design_11_scope.json` | дословная выписка скоупа v1 из §11, эталон для генератора | только вместе с каноном |
| `fixtures/kottara_launch.json` | замеренные факты запуска KOTS: первая покупка и 5/7 supply | только вместе с логом чейна |
| `fixtures/brief_t9_screens.json` | дословная выписка BRIEF §6 T9, эталон инвентаря экранов | только вместе с BRIEF |
| `fixtures/hud_screens.json` | дословная выписка панелей, резов, never-cut | только вместе с `docs/SCREENS.md` |
| `fixtures/brief_t10_world.json` | дословная выписка BRIEF §6 T10, эталон инвентаря вида города | только вместе с BRIEF |
| `fixtures/hud_layout.json` | геометрия legacy-шелла (колонки, топбар, сток-полоса, нижнее меню) для L341 | числа не копировать в пак; живой вид — `hud/design-reference/` и errata `docs/reports/HUD_DESIGN_SYSTEM.md` |
| `fixtures/authored_layout.json` | посадка лотов владельца: пустой список держит генератор | да, студией `studio.py` |
| `fixtures/brief_t11_tick.json` | дословная выписка BRIEF §6 T11, эталон инвентаря тика | только вместе с BRIEF |
| `fixtures/tick_aggregates.json` | векторы keccak256 и свидетели Happiness/Productivity | вместе с `keccak.py` / `aggregates.py` |
| `fixtures/brief_t12_arch.json` | дословная выписка BRIEF §6 T12, эталон инвентаря архитектуры | только вместе с BRIEF |
| `params/tick.json` | layout v1, веса Happiness, live-флаги штрафа | да |
| `params/attest.json` | период merkle-корня и доменные байты | да |
| `params/arch.json` | слои, сервисы, схема, порт, метрики, этапы | да |
| `params/api.json` | path_rules, конверт, samples/tick | да |
| `keccak.py` | Ethereum keccak256 без зависимостей | да |
| `record.py` | layout v1, merkle с префиксами | да |
| `aggregates.py` | Happiness, Productivity, GDP, Population | да |
| `arch.py` | слои, эндпоинты, TWAP ряда, fail-open — не экономический путь | да |
| `docs/TICK.md` | канон тика; широкие таблицы подставляет сборка | каркас руками, GEN — сборка |
| `docs/ARCHITECTURE.md` | канон границ; GEN из arch.json | каркас руками, GEN — сборка |
| `docs/API.md` | канон REST/WS; таблицы GEN | каркас руками, GEN — сборка |
| `docs/ROADMAP.md` | этапы и гейты; GEN из arch.roadmap | каркас руками, GEN — сборка |
| `out/*` | артефакты сборки | **нет, перезапишется** |
| `build.py` | генераторы | да |
| `screens.py` | генератор экранов T9: матрица отказов, свидетели лимита и цены | да |
| `world.py` | генератор планировки T10: остров, лоты, декор, сутки, камера | да |
| `studio.py` | локальная студия владельца: собирает карту игроков, пишет фикстуру | да |
| `lint.py` | гейт сборки | да |
| `attack.py` | атаки на гейт: правило без атаки роняет прогон | да |
| `sim.py` / `tick.py` | драйвер сезона и чистый тик | да |
| `builds.py` | анализ доминирования T4 | да |

## Три правила, которые ломать нельзя

1. **Выводимое не хранится.** Значение, вычислимое из другого значения, лежит в блоке `derived` как формула, а считается генератором. Линтер L09 не даст объявить формулу без реализации, реализовать без объявления или хранить производное параметром.
2. **Число без обоснования не проходит схему.** У параметра обязательны `src` (ссылка на канон) и `why` (зачем именно столько). Это проверяет L01.
3. **Опубликованный пак не мутирует.** Правка даёт новый хеш. Записи смен ссылаются на хеш того пака, по которому их посчитали, иначе реплей §6.3 не сходится.

## Чего здесь нет намеренно

Плавающей точки — все ставки целые в bps, загрузчик отвергает float-литерал при разборе.

Значений, которые ещё не посчитаны — они перечислены в `params/pending.json` с задачей-владельцем и печатаются линтером блоком `PENDING`. Пустое поле честнее выдуманного числа.
