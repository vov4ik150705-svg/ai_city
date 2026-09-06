# V3-1 recon

`launch.deployed` все пять полей пусты (команда, не память). Ставка не снята. P7 не начат.

Прочитано: `PLAN_VISUAL_V3.md` §4 V3-1 / D-V3-3 / D-V3-5 / D-V3-9 / R-V-81…83, `V3-0_final.md`, `lint.py` L348/L370, `pending.json` три ключа V3-1, `packages/render` (Pixi, без `three`), `apps/client/src/hud/SceneHost.tsx`.

## Находки

- L370 держит `visual3_frame_live=0` и пустой CT у `visual3_engine`…`visual3_close`. Непустой CT этапа и флаг 1 красные. Это ловушка V3-0 (`R-V-81`).
- L348 включает `visual3_frame_live=0` в `VISUAL_FROZEN_FLAGS`. Поднять кадр нельзя, не сломав L348.
- `visual3_engine.gate_cmd` = `--only L370` (`R-V-82`). A-V3-13/14 молчат.
- Three.js нет в `arch.toolchain` и в `packages/render/package.json`. Pixi 8.20.1 — архив V12.
- В паке нет tilt/distance орбиты; `derived.zoom_levels` — iso-зум V12 (`R-V-83`).
- Клиент монтирует `@corporator/render/pixi`. `RENDER_NO_GPU` жив в `gpu.ts` / SceneHost.
- `pack_version` на диске 121 (паспорт V3-0 писал 120). `rules_version` 0.22.0.

## Риски этапа

- Сузить L370/L348 до заполнения CT и флага, иначе гейт красный на собственных пробах.
- A-V3-4 (`frame=1` без движка) не должен замолчать: перенос с L348/L370 на L371.
- `--jobs 8` не попадает в `gate_cmd` V3-1…V3-6 (L372).
- Литералы орбиты не в `packages/render/src` (L340); iso-зум не подставлять (L373).
- Pixi не fallback при `visual3_frame_live=1` (A-V3-12). Нет GPU — `RENDER_NO_GPU`, не ромбы.
