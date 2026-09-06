"""Promote unique sliced sprites into assets/. Does not touch art/raw."""
from __future__ import annotations

import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
CLEAR = ROOT / "_sliced" / "clear"
BLOCKS = ROOT / "_sliced" / "blocks"
MAGENTA = np.array([255, 0, 255], dtype=np.uint8)


def find(folder: Path, prefix: str, i: int) -> Path:
    matches = sorted(folder.glob(f"{prefix}_{i:03d}_*.png"))
    if not matches:
        raise FileNotFoundError(f"{prefix}_{i:03d}")
    return matches[0]


def copy_named(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def split_cc(src: Path, min_area: int = 60) -> list[Image.Image]:
    rgb = np.array(Image.open(src).convert("RGB"))
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mag = (r > 240) & (g < 30) & (b > 240)
    mask = ~mag
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    out: list[Image.Image] = []
    ys, xs = np.where(mask)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]:
            continue
        q: deque[tuple[int, int]] = deque([(y0, x0)])
        seen[y0, x0] = True
        pixels: list[tuple[int, int]] = []
        minx = maxx = x0
        miny = maxy = y0
        while q:
            y, x = q.popleft()
            pixels.append((y, x))
            if x < minx:
                minx = x
            if x > maxx:
                maxx = x
            if y < miny:
                miny = y
            if y > maxy:
                maxy = y
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pixels) < min_area:
            continue
        tile = np.full((maxy - miny + 1, maxx - minx + 1, 3), MAGENTA, dtype=np.uint8)
        for y, x in pixels:
            tile[y - miny, x - minx] = rgb[y, x]
        out.append(Image.fromarray(tile, "RGB"))
    out.sort(key=lambda im: (-im.size[1], -im.size[0]))
    return out


def save_splits(src: Path, dests: list[Path], min_area: int = 60) -> int:
    parts = split_cc(src, min_area=min_area)
    n = 0
    for im, dest in zip(parts, dests):
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest)
        print(f"split {src.name} -> {dest.relative_to(ROOT)} {im.size}")
        n += 1
    extra = parts[len(dests) :]
    inbox = ROOT / "inbox"
    inbox.mkdir(exist_ok=True)
    for k, im in enumerate(extra, 1):
        p = inbox / f"{src.stem}_extra_{k:02d}.png"
        im.save(p)
        print(f"split extra {p.name} {im.size}")
        n += 1
    return n


# clear id -> dest (unique vs current named tree; not buildings)
CLEAR_NAMED: dict[int, str] = {
    # agents
    34: "agents/walker_hardhat.png",
    41: "agents/walker_civilian.png",
    42: "agents/walker_worker.png",
    43: "agents/walker_hazmat.png",
    44: "agents/walker_suit.png",
    46: "agents/walker_civilian_02.png",
    50: "agents/walker_exosuit.png",
    54: "agents/walker_guard.png",
    56: "agents/walker_cap.png",
    57: "agents/walker_office.png",
    59: "agents/walker_civilian_03.png",
    60: "agents/walker_jumpsuit.png",
    32: "agents/robot_small.png",
    35: "agents/robot_quad.png",
    45: "agents/robot_gold.png",
    53: "agents/robot_mecha.png",
    81: "agents/robot_industrial.png",
    82: "agents/robot_industrial_02.png",
    # drones
    33: "vehicles/drone_yellow.png",
    48: "vehicles/drone_white.png",
    49: "vehicles/drone_stealth.png",
    64: "vehicles/drone_cargo.png",
    67: "vehicles/drone_cargo_02.png",
    # vehicles
    38: "vehicles/vehicle_shuttle.png",
    47: "vehicles/vehicle_pickup.png",
    51: "vehicles/vehicle_ambulance.png",
    52: "vehicles/vehicle_van_03.png",
    55: "vehicles/vehicle_police.png",
    62: "vehicles/vehicle_loader.png",
    63: "vehicles/vehicle_suv.png",
    65: "vehicles/vehicle_car_red.png",
    70: "vehicles/vehicle_bus.png",
    71: "vehicles/vehicle_rover.png",
    72: "vehicles/vehicle_school_bus.png",
    76: "vehicles/vehicle_forklift.png",
    84: "vehicles/vehicle_car_blue.png",
    # foliage
    90: "foliage/tree_pine.png",
    91: "foliage/tree_green_03.png",
    94: "foliage/tree_autumn.png",
    97: "foliage/tree_green_04.png",
    # street props
    79: "decor/traffic_cone.png",
    92: "decor/vending.png",
    93: "decor/district_billboard.png",
    95: "decor/lantern_ornate.png",
    100: "decor/lantern_brass.png",
    102: "decor/lantern_03.png",
    103: "decor/planter.png",
    104: "decor/bench.png",
    106: "decor/trash_can.png",
    107: "decor/traffic_light.png",
    112: "decor/parking_sign.png",
    114: "decor/kiosk.png",
    117: "decor/phone_booth.png",
    129: "decor/sign_caution.png",
    130: "decor/phone_booth_02.png",
    135: "decor/barrier.png",
    140: "decor/solar_panel_02.png",
    148: "decor/phone_booth_red.png",
    150: "decor/bench_02.png",
    # fx
    88: "fx/glow_spark.png",
    96: "fx/glow_crystal.png",
    101: "fx/glow_crystal_02.png",
    105: "fx/glow_basin.png",
    125: "fx/glow_flare.png",
    127: "fx/smoke.png",
    128: "fx/smoke_02.png",
    144: "fx/glow_tile.png",
    # port / water
    167: "port/dock.png",
    174: "port/boat_yacht.png",
    186: "port/dock_02.png",
    191: "port/boat_row.png",
    213: "port/boat_tug.png",
    214: "port/boat_tug_02.png",
    215: "port/buoy.png",
    234: "port/buoy_02.png",
    237: "port/boat_small.png",
    # terrain reference (voxel cubes, not 64x32 diamonds)
    165: "terrain/island_block.png",
    166: "terrain/island_block_02.png",
    168: "terrain/road_plaza.png",
    171: "terrain/water_tile.png",
    177: "terrain/road_straight.png",
    193: "terrain/road_turn.png",
    196: "terrain/road_cross.png",
    199: "terrain/water_tile_02.png",
    203: "terrain/road_end.png",
    216: "terrain/island_block_03.png",
    # hud icons
    172: "hud/icon_compute.png",
    173: "hud/icon_gem.png",
    175: "hud/icon_coin.png",
    176: "hud/icon_energy.png",
    187: "hud/icon_calendar.png",
    190: "hud/icon_sun.png",
    202: "hud/icon_close.png",
    206: "hud/icon_trophy.png",
    207: "hud/icon_confirm.png",
    209: "hud/icon_tech.png",
    223: "hud/icon_trophy_02.png",
    228: "hud/icon_shield.png",
}

BLOCKS_NAMED: dict[int, str] = {
    55: "decor/lantern_victorian.png",
    68: "decor/lantern_victorian_02.png",
    114: "agents/robot_tracked.png",
    161: "port/boat_work.png",
}

SKIP_CLEAR = {
    1,  # title
    2, 5, 6, 7, 8, 12, 14,  # buildings already in buildings/ (high-res)
    13, 23,  # Google
    3, 4, 9, 10, 11, 15, 16, 17, 18, 19, 20,  # fragments
    21, 22, 24, 25, 26, 27,  # glued Lv labels
    28, 29, 30, 31, 85, 86, 87, 160, 161, 162,  # section headers
}


def main() -> None:
    copied = 0
    missing: list[str] = []
    for i, dest in CLEAR_NAMED.items():
        try:
            src = find(CLEAR, "clear", i)
        except FileNotFoundError:
            missing.append(f"clear_{i:03d} -> {dest}")
            continue
        copy_named(src, ROOT / dest)
        print(f"{src.name} -> {dest}")
        copied += 1

    for i, dest in BLOCKS_NAMED.items():
        try:
            src = find(BLOCKS, "blocks", i)
        except FileNotFoundError:
            missing.append(f"blocks_{i:03d} -> {dest}")
            continue
        copy_named(src, ROOT / dest)
        print(f"{src.name} -> {dest}")
        copied += 1

    # known merges
    save_splits(
        find(CLEAR, "clear", 164),
        [ROOT / "port/lighthouse.png", ROOT / "port/boat_cabin.png"],
        min_area=80,
    )
    save_splits(
        find(CLEAR, "clear", 89),
        [ROOT / "fx/glow_pad.png", ROOT / "fx/glow_beam.png", ROOT / "fx/glow_flame.png"],
        min_area=50,
    )
    save_splits(
        find(BLOCKS, "blocks", 202),
        [
            ROOT / "decor/bus_stop.png",
            ROOT / "decor/kiosk_02.png",
            ROOT / "decor/banner.png",
            ROOT / "decor/district_billboard_02.png",
        ],
        min_area=70,
    )
    save_splits(
        find(BLOCKS, "blocks", 199),
        [ROOT / "decor/bench_03.png", ROOT / "decor/utility_box.png"],
        min_area=80,
    )

    google = find(CLEAR, "clear", 13)
    copy_named(google, ROOT / "_discard/google_data_center_sheet.png")

    inbox = ROOT / "inbox"
    inbox.mkdir(exist_ok=True)
    extra = 0
    for p in sorted(CLEAR.glob("clear_*.png")):
        num = int(p.name.split("_")[1])
        if num in CLEAR_NAMED or num in SKIP_CLEAR or num in {89, 164}:
            continue
        im = Image.open(p)
        if im.size[1] <= 18 or im.size[0] * im.size[1] < 400:
            continue
        dest = inbox / p.name.replace("clear_", "sheet_")
        shutil.copy2(p, dest)
        extra += 1

    print(f"named {copied}, inbox extras {extra}")
    if missing:
        print("MISSING:")
        for m in missing:
            print(" ", m)


if __name__ == "__main__":
    main()
