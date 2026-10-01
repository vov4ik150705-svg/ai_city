# Вид города

Канон вида Corporator. Механика экономики — `DESIGN.md`. Визуальный дизайн HUD —
`docs/reports/HUD_DESIGN_SYSTEM.md`; контракт экранов — `docs/SCREENS.md`.

## Часть A. Карта: авторский 3D-остров

Карта Corporator — один авторский 3D-остров Terra плюс `18` исходных зданий
`models/*.glb` (`R-V-109`). Runtime — `art/island_v3/runtime_terra19/island_mass.glb`
и локальные `runtime_terra19/buildings/*.glb`. Жирный
`art/island_v3/island.glb` — отклонённый bake, не runtime. Карта одна на всех
и не генерируется от адреса, `city_id` или `layout_seed` (`R-V-98`).

Снимок `Island` — архив; не runtime и не задание (`R-V-104`).
Живая масса — Terra. Grass-покрытия нет. Вид принят (`R-V-106`, `R-V-109`):
`art/island_v3/maps/terra-look.json` (world-poses, не `anchor_*`) и свет
`ENV_LOOK_REV` `27` (`R-V-105`).

Камера — орбита с fit по bounds и safe frame, не изометрический зум и не
универсальная дистанция `island_orbit_distance_default` (`2200` м).
Точка орбиты сдвигается внутри bounds массы и к дальнему зуму возвращается
в центр кадра; высота точки не меняется.
Полоса зума вокруг принятой студийной камеры — `look_orbit_distance_max_mul`
радиусов (`L340`), не абсолют `island_orbit_distance_min` / `max`. Посадка
на Terra — студийная композиция владельца, не pack grid (`R-V-100`).
Building runtime root локален и включает собственные signs/windows. Viewer
и client используют один loader/material/light path. Runtime
MSAA включён (owner GO); откат настроек кадра —
`art/island_v3/maps/rollback-look11-pre-msaa.json`.

Квот района, обязательного жилья и заполнителя квартала нет (`R-V-100`).
Юнитов нет (`R-V-101`). Моря вокруг острова нет: край — обрыв в пустоту,
береговой пены нет. Водопады на острове разрешены (`R-V-108`) и остаются
в бюджете кадра: вода движется стилизованным потоком по `city_time`
(`water_steps_per_tick`), не ocean shader и не дельте кадра. Небо — градиентный SkyDome плюс отдельный слой стилизованных
low-poly облаков вокруг и под островом; они не часть `island.glb` и не
каталожные штампы на палубе. Декор — trees, lamps, short rails, benches, planters,
небольшие roof props после intake и стилизованные водопады (`R-V-103`,
`R-V-107`, `R-V-108`).

Главный art-review — bright day; signs днём видимы, dusk/night усиливают
emissive (`R-V-105`). Принятый client/preview не гасит GLB-emissive через
packed `day lights=0`. Картинку принимает владелец по runtime-captures, а не по
наличию узлов или формульному draw-call count (`R-V-106`).

Принятый кадр — `maps/terra-look.json` (`R-V-109`).
Паспорт посадки — `docs/reports/ISLAND_STUDIO.md`. Живой план —
`docs/reports/PLAN_LAUNCH.md`. LOOK-ТЗ — архив, не задание.

---

## 1. Экономический мост

**Сетка пака — экономический слой, не карта** (`R-V-99`). Поля `generated.placement` не входят во вход экономического тика: `tick_inputs` пуст. Единственный мост — счётчики с меткой `economic_bridge`: `derived.park_slots`, `derived.plaza_slots`, `filler_occupied_total` (`L182`). **R-T10-1**: Happiness от парков через счётчик из состояния районов, не через план.

Экономическая сетка пака и архив кадра (легенда тайлов, ромбы, `tileOrigin`, pixelize, LUT и snap) — `docs/archive/WORLD_PACK_GRID.md`, не ТЗ острова.

BRIEF T10 покрыт архивом: `§2` `L171` `L170` `derived.block_side` `L169`; `§3` `L186`; `§6` `L174` `derived.park_slots` `L189` `L190`; `§7` `L179`; `§8` `L185`; `§9` `L180`.
