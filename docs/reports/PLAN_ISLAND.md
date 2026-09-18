# PLAN_ISLAND — visual rescue до HUD и P7

Живой план авторского 3D-острова Corporator. Точка входа —
`docs/CANON.md`.

## 1. Статус

Живая карта — Terra (`R-V-109`). Вид **принят** 2026-09-14: канон кадра —
`art/island_v3/maps/terra-look.json` плюс `ENV_LOOK_REV` 27, runtime
`runtime_terra19/`. Снимок `Island` 2026-09-06 и LOOK-04 на нём — архив,
не задание.

Цель кадра — `docs/reports/TZ_ISLAND_LOOK.md`. How-to LOOK-09…11 —
`docs/reports/TZ_ISLAND_LOOK_STEPS.md`, на массе Terra, не на `Island`.

Текущий порядок:

> ACCEPT LOOK-11 (2026-09-14) → HUD (отдельный GO) → отдельное решение о P7.
> LOOK-10 diet массы Terra — отдельный GO.

LOOK-01/04/05 на архивном `Island` не исполняются. HUD не начинается в
этом чате. `launchToken` и мейннет запрещены без отдельного решения
владельца.

Исполнение: правило `.cursor/rules/island-look.mdc`; paste Extra High —
`docs/reports/PROMPT_ISLAND.md`. Один LOOK — один чат; `GO` только от
владельца. Bloom по камню и небу из текста LOOK-09 не копировать:
selective bloom — только после явного `GO` на этот рычаг.

## 2. Что сохраняется

- одна авторская карта — Terra (`R-V-109`);
- runtime `art/island_v3/runtime_terra19/`;
- 18 исходных `models/*.glb`;
- тонкий runtime pipeline;
- экономика, фонд, тик, районы и форма денег;
- закрытые ключи `visual3_*` и `island_*`.

LOOK-проходы не являются новыми ключами `content/params/arch.json`.

## 3. Что отклонено

- травяная/оливковая крышка острова;
- вырезание канонического `Island` ради одной центральной террасы;
- равномерное кольцо зданий в центре;
- пустой внешний пояс;
- два разных renderer stack для viewer и client;
- building GLB с world transforms;
- signs/windows в `island_mass.glb`;
- общее обнуление emissive материалов;
- облака из tree fragments и белых штрихов;
- приёмка по наличию узлов и формульным draw calls без GPU-кадра;
- подмена Terra снимком `Island` 2026-09-06.

## 4. Новый порядок

На Terra не исполнять LOOK-01/04/05 (это корпус 2026-09-06). LOOK-09…11
по виду закрыты приёмкой 2026-09-14. Дальше — HUD по `docs/reports/HUD_DESIGN_SYSTEM.md` после
`GO`. LOOK-10 diet (mass Terra > 1.5 МБ) — отдельный `GO`, не подмена
меша старым `Island`.

`SceneHost` и `islandPreview` читают `runtime_terra19/` и сажают
`maps/terra-look.json`. Occupancy `anchor_*` старого `Island` не карта.
`view.html` LOOK-03 остаётся на архивном `runtime/` из-за конструкционных проб.

Один шаг — один чат. Следующий шаг не начинается без owner `GO`.

## 5. Главная зависимость

```
TerraMass
    ↓
SharedRuntimePreview
    ↓
LightingAndPost
    ↓
MeasuredOptimization
    ↓
OwnerAcceptance
```

Оптимизация не начинается до принятого look. Свет не откатывает Terra на
архивный `Island`.

## 6. Стоп-условия

Любое условие останавливает работу:

- принципиальное расхождение с `docs/CANON.md`;
- попытка вернуть runtime на `Island` 2026-09-06;
- попытка добавить траву, море вокруг острова или юнитов;
- попытка заменить `models/*.glb`;
- попытка лечить карту через `generated.placement`;
- `build_island.py` стирает принятую ручную композицию Terra;
- viewer и client показывают разные pose/light/material;
- визуальный этап закрывают без runtime PNG;
- HUD или P7 начаты до LOOK-11.

## 7. Роли

Архитектор:

- аудит;
- решения и документы;
- синхронизация канона;
- read-only review;
- без кода, Blender/GLB, паковых гейтов и коммитов.

Исполнитель Cursor Grok 4.6 Extra High:

- один назначенный LOOK;
- Blender или code changes в границах шага;
- обязательные измерения и captures;
- негативные пробы;
- остановка до owner approval.

Владелец:

- принимает bright-day art direction на Terra;
- даёт `GO` между LOOK;
- единственный даёт `ACCEPT LOOK-11`.

## 8. Декор

Живая библиотека начинается с `decoration/`. Владелец может добавлять туда
кандидатов. Исполнитель не сажает новый файл автоматически: сначала license
ledger и asset intake по `docs/reports/ASSETS_ISLAND.md`.

## 9. Гейты

Этот документ не разрешает архитектору запускать гейты.

Исполнитель следует `.cursor/rules/verification-loop.mdc`:

- Blender-only шаг без `content/params` проверяется runtime-кадрами и
  студийными проверками своей задачи;
- code/pack шаг выполняет узкие гейты затронутой области;
- полный `attack.py --jobs 8` не запускается на каждом LOOK;
- финальное закрытие фазы — отдельная работа после owner acceptance.

## 10. Коммиты

Коммиты только по просьбе владельца. Visual rescue не подписывает
`launchToken` и не деплоит мейннет.
