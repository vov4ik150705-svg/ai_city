"""One-shot ingest: mockup extracts -> assets/ with canon ids.

Reads Downloads/assets 2 (old) and Downloads/assets 3 (new).
Does not touch art/raw (append-only pipeline).
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
OLD = Path(r"C:\Users\sk640\Downloads\assets 2")
NEW = Path(r"C:\Users\sk640\Downloads\assets 3")

MAGENTA = (255, 0, 255)


def to_magenta_rgb(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    canvas = Image.new("RGB", rgba.size, MAGENTA)
    canvas.paste(rgba, mask=rgba.split()[3])
    rgb = np.array(canvas)
    h, w = rgb.shape[:2]
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    near_black = (r < 22) & (g < 22) & (b < 22)
    near_mag = (r > 240) & (g < 30) & (b > 240)
    cand = near_black | near_mag
    seen = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        if cand[0, x]:
            q.append((0, x))
        if cand[h - 1, x]:
            q.append((h - 1, x))
    for y in range(h):
        if cand[y, 0]:
            q.append((y, 0))
        if cand[y, w - 1]:
            q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if seen[y, x] or not cand[y, x]:
            continue
        seen[y, x] = True
        if y > 0 and not seen[y - 1, x] and cand[y - 1, x]:
            q.append((y - 1, x))
        if y + 1 < h and not seen[y + 1, x] and cand[y + 1, x]:
            q.append((y + 1, x))
        if x > 0 and not seen[y, x - 1] and cand[y, x - 1]:
            q.append((y, x - 1))
        if x + 1 < w and not seen[y, x + 1] and cand[y, x + 1]:
            q.append((y, x + 1))
    rgb[seen] = MAGENTA
    return Image.fromarray(rgb, "RGB")


def put(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    out = to_magenta_rgb(Image.open(src))
    out.save(dest, "PNG")


def main() -> None:
    jobs: list[tuple[Path, Path]] = []

    def add(src_dir: Path, name: str, dest: str) -> None:
        jobs.append((src_dir / name, ROOT / dest))

    # --- buildings: old extracts are larger; names on disk were lying ---
    add(OLD, "layer-blue-domed-classical-building.png", "buildings/city_hall.png")
    add(OLD, "layer-red-brick-building (1).png", "buildings/energy_plant.png")
    add(OLD, "layer-red-brick-building (2).png", "buildings/logistics_hub.png")
    add(OLD, "layer-red-brick-building.png", "buildings/robotics_lab.png")
    add(OLD, "layer-green-glowing-tech-building.png", "buildings/exchange.png")
    add(OLD, "layer-green-glowing-tech-building (1).png", "buildings/ai_research_center.png")
    add(OLD, "layer-tesla-logo-building.png", "buildings/finance_tower.png")

    # --- decor ---
    add(OLD, "layer-tesla-logo-building (1).png", "decor/tesla_mark.png")
    add(OLD, "layer-fountain.png", "decor/fountain.png")
    add(OLD, "layer-wind-turbine.png", "decor/wind_turbine.png")
    add(OLD, "layer-solar-panel-array.png", "decor/solar_array.png")
    add(OLD, "layer-satellite-dish.png", "decor/satellite_dish.png")
    add(NEW, "layer-street-lamps.png", "decor/lantern.png")
    add(NEW, "layer-street-lamps (2).png", "decor/lantern_02.png")
    add(NEW, "layer-bushes.png", "decor/bush.png")
    add(NEW, "layer-bushes (1).png", "decor/bush_02.png")
    add(NEW, "layer-flowers.png", "decor/flower.png")
    add(NEW, "layer-flowers (2).png", "decor/flower_02.png")
    add(NEW, "layer-solar-panels.png", "decor/solar_panel.png")

    # --- vehicles ---
    add(OLD, "layer-car.png", "vehicles/vehicle_car.png")
    add(NEW, "layer-cars (16).png", "vehicles/vehicle_car_02.png")
    add(OLD, "layer-delivery-truck.png", "vehicles/vehicle_truck.png")
    add(NEW, "layer-vans.png", "vehicles/vehicle_van.png")
    add(NEW, "layer-vans (4).png", "vehicles/vehicle_van_02.png")
    add(OLD, "layer-drone.png", "vehicles/drone.png")
    add(NEW, "layer-flying-drones.png", "vehicles/drone_02.png")

    # --- foliage ---
    add(OLD, "layer-cherry-blossom-tree.png", "foliage/tree_pink.png")
    add(OLD, "layer-cherry-blossom-tree (2).png", "foliage/tree_pink_02.png")
    add(OLD, "layer-pine-tree (24).png", "foliage/tree_dark.png")
    add(OLD, "layer-deciduous-tree (4).png", "foliage/tree_green.png")
    add(NEW, "layer-trees.png", "foliage/tree_green_02.png")

    # --- agents ---
    add(OLD, "layer-human-character (23).png", "agents/walker_human.png")
    add(OLD, "layer-robot (24).png", "agents/walker_robot.png")
    add(NEW, "layer-robot-agents.png", "agents/walker_robot_02.png")
    add(NEW, "layer-robot-agents (1).png", "agents/walker_robot_03.png")

    # --- HUD labels (not world sprites; Lv. stays here only) ---
    add(NEW, "layer-building-level-labels.png", "hud/label_energy_plant.png")
    add(NEW, "layer-building-level-labels (2).png", "hud/label_ai_research_center.png")
    add(NEW, "layer-building-level-labels (3).png", "hud/label_exchange.png")
    add(NEW, "layer-building-level-labels (4).png", "hud/label_city_hall.png")
    add(NEW, "layer-building-level-labels (5).png", "hud/label_finance_tower.png")
    add(NEW, "layer-building-level-labels (6).png", "hud/label_logistics_hub.png")
    add(NEW, "layer-building-level-labels (7).png", "hud/cat_agents.png")
    add(NEW, "layer-building-level-labels (8).png", "hud/cat_drones.png")
    add(NEW, "layer-building-level-labels (9).png", "hud/cat_island_tiles.png")
    add(NEW, "layer-building-level-labels (10).png", "hud/cat_props.png")
    add(NEW, "layer-building-level-labels (11).png", "hud/cat_trees.png")
    add(NEW, "layer-building-level-labels (12).png", "hud/cat_ground.png")

    # --- discard (wrong brand or not a sprite) ---
    add(OLD, "layer-google-logo-building.png", "_discard/google_token.png")
    add(OLD, "layer-tesla-logo-building (2).png", "_discard/google_token_02.png")
    add(OLD, "layer-nvidia-logo-building.png", "_discard/nvidia_tile_tiny.png")
    add(NEW, "layer-robotics-lab-building.png", "_discard/google_data_center.png")
    add(NEW, "layer-building-level-labels (1).png", "_discard/label_google.png")

    missing = [src for src, _ in jobs if not src.exists()]
    if missing:
        raise SystemExit("missing sources:\n" + "\n".join(str(p) for p in missing))

    for src, dest in jobs:
        put(src, dest)
        print(f"{src.name} -> {dest.relative_to(ROOT)}")

    print(f"wrote {len(jobs)} files under {ROOT}")


if __name__ == "__main__":
    main()
