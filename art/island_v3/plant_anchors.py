"""I6: plant 26 Empty anchors in island.blend. Does not run the planter."""

from __future__ import annotations

import math
import os
import re
import shutil
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from compose_island import CLIFF, RING_Z, STAIR_KEEP, aabb_center, world_bounds  # noqa: E402
from paint_ground import HALF, PLAZA_Z, extra_args, log, plant_names  # noqa: E402

BLEND = os.path.join(ROOT, "island.blend")
BACKUP = os.path.join(ROOT, "island_pre_anchors.blend")
SLUG_RE = re.compile(r"^[a-z0-9_]+$")
ANCHOR_COUNT = 26
PLOT_KEEP = 80.0
PLOT_SPAN = 400.0


def plant_slug(name: str) -> str:
    out: list[str] = []
    for i, ch in enumerate(name):
        if ch.isupper() and i > 0:
            out.append("_")
        out.append(ch.lower())
    return "".join(out)

# Free lots: 5 on the plaza courtyard, 3 on ring diagonals (NW is Clearinghouse).
PLOT_XY: tuple[tuple[str, float, float, float], ...] = (
    ("plot_01", 1000.0, 1000.0, PLAZA_Z),
    ("plot_02", 1000.0, -1000.0, PLAZA_Z),
    ("plot_03", -1000.0, -1000.0, PLAZA_Z),
    ("plot_04", -1000.0, 1000.0, PLAZA_Z),
    ("plot_05", 0.0, -1000.0, PLAZA_Z),
    ("plot_06", 2300.0, 2300.0, RING_Z),
    ("plot_07", 2300.0, -2300.0, RING_Z),
    ("plot_08", -2300.0, -2300.0, RING_Z),
)


def validate_slug(slug: str) -> None:
    if not SLUG_RE.fullmatch(slug):
        raise RuntimeError(f"bad anchor slug {slug!r}")
    if slug.startswith("anchor_"):
        raise RuntimeError(f"slug must not include prefix: {slug}")


def occupied_name(plant: str) -> str:
    slug = plant_slug(plant)
    validate_slug(slug)
    return f"anchor_{slug}"


def on_stair_mouth(x: float, y: float) -> bool:
    ring = HALF + 80.0
    if abs(x) < STAIR_KEEP and abs(abs(y) - ring) < 40.0:
        return True
    if abs(y) < STAIR_KEEP and abs(abs(x) - ring) < 40.0:
        return True
    return False


def chebyshev(x: float, y: float) -> float:
    return max(abs(x), abs(y))


def yaw_inward(x: float, y: float) -> float:
    if x == 0.0 and y == 0.0:
        return 0.0
    return math.atan2(x, y)


def box_hits_xy(lo: Vector, hi: Vector, x: float, y: float, keep: float) -> bool:
    return lo.x - keep <= x <= hi.x + keep and lo.y - keep <= y <= hi.y + keep


def ensure_empty(name: str) -> bpy.types.Object:
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, None)
        scene.collection.objects.link(ob)
    elif ob.type != "EMPTY":
        raise RuntimeError(f"{name} exists as {ob.type}, not EMPTY")
    ob.empty_display_type = "PLAIN_AXES"
    ob.empty_display_size = 120.0
    ob.parent = None
    ob.scale = (1.0, 1.0, 1.0)
    ob.rotation_mode = "XYZ"
    return ob


def place_empty(name: str, xy: tuple[float, float], floor_z: float, yaw: float) -> None:
    validate_slug(name[len("anchor_") :])
    if chebyshev(xy[0], xy[1]) > CLIFF:
        raise RuntimeError(f"{name} xy {xy} past cliff {CLIFF}")
    ob = ensure_empty(name)
    ob.rotation_euler = (0.0, 0.0, yaw)
    ob.location = (xy[0], xy[1], floor_z)
    log(f"{name} xy=({xy[0]:.0f},{xy[1]:.0f}) z={floor_z:.2f} yaw={math.degrees(yaw):.1f}")


def clear_stale_anchors(keep: set[str]) -> None:
    stale: list[bpy.types.Object] = []
    for ob in bpy.data.objects:
        if ob.name.startswith("anchor_") and ob.name not in keep:
            stale.append(ob)
    for ob in stale:
        bpy.data.objects.remove(ob, do_unlink=True)
        log(f"removed stale {ob.name}")


def plant_occupied(names: set[str]) -> dict[str, tuple[Vector, Vector]]:
    boxes: dict[str, tuple[Vector, Vector]] = {}
    for plant in sorted(names):
        ob = bpy.data.objects.get(plant)
        if ob is None or ob.type != "MESH":
            raise RuntimeError(f"missing plant mesh {plant}")
        lo, hi = world_bounds(ob)
        boxes[plant] = (lo, hi)
        c = aabb_center(lo, hi)
        yaw = yaw_inward(c.x, c.y)
        place_empty(occupied_name(plant), (c.x, c.y), lo.z, yaw)
    return boxes


def plant_plots(boxes: dict[str, tuple[Vector, Vector]]) -> None:
    if len(PLOT_XY) != 8:
        raise RuntimeError(f"PLOT_XY {len(PLOT_XY)} != 8")
    for slug, x, y, floor_z in PLOT_XY:
        validate_slug(slug)
        if on_stair_mouth(x, y):
            raise RuntimeError(f"anchor_{slug} sits on a stair")
        for plant, (lo, hi) in boxes.items():
            if box_hits_xy(lo, hi, x, y, PLOT_KEEP):
                raise RuntimeError(f"anchor_{slug} overlaps {plant}")
            dx = min(hi.x, x + PLOT_SPAN * 0.5) - max(lo.x, x - PLOT_SPAN * 0.5)
            dy = min(hi.y, y + PLOT_SPAN * 0.5) - max(lo.y, y - PLOT_SPAN * 0.5)
            if dx > 0.0 and dy > 0.0:
                raise RuntimeError(f"anchor_{slug} footprint overlaps {plant}")
        place_empty(f"anchor_{slug}", (x, y), floor_z, yaw_inward(x, y))


def expected_names(plants: set[str]) -> set[str]:
    names = {occupied_name(p) for p in plants}
    names.update(f"anchor_{slug}" for slug, _x, _y, _z in PLOT_XY)
    if len(names) != ANCHOR_COUNT:
        raise RuntimeError(f"expected {ANCHOR_COUNT} names, got {len(names)}")
    return names


def attack() -> None:
    try:
        validate_slug("City-Hall")
    except RuntimeError:
        log("attack bad slug: rejected")
    else:
        raise RuntimeError("uppercase/hyphen slug was accepted")
    try:
        place_empty("anchor_plot_bad", (4000.0, 0.0), RING_Z, 0.0)
    except RuntimeError:
        log("attack cliff plot: rejected")
    else:
        raise RuntimeError("cliff plot was accepted")
    try:
        if on_stair_mouth(0.0, HALF + 80.0):
            raise RuntimeError("anchor_plot_stair sits on a stair")
    except RuntimeError:
        log("attack stair plot: rejected")
    else:
        raise RuntimeError("stair plot was accepted")


def backup_blend() -> None:
    if not os.path.isfile(BACKUP):
        shutil.copy2(BLEND, BACKUP)
        log(f"wrote backup {BACKUP}")
    else:
        log(f"backup exists {BACKUP}")


def main() -> None:
    args = extra_args()
    if not os.path.isfile(BLEND):
        raise RuntimeError(f"missing {BLEND}")
    backup_blend()
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    names = plant_names()
    missing = sorted(names - {ob.name for ob in bpy.data.objects})
    if missing:
        raise RuntimeError(f"blend missing plants: {missing}")
    attack()
    want = expected_names(names)
    boxes = plant_occupied(names)
    plant_plots(boxes)
    clear_stale_anchors(want)
    got = {ob.name for ob in bpy.data.objects if ob.name.startswith("anchor_")}
    if got != want:
        raise RuntimeError(f"anchor set mismatch extra={got - want} missing={want - got}")
    if "--dry-run" in args:
        log("dry-run, not saving")
        return
    bpy.ops.wm.save_mainfile()
    log(f"saved {BLEND} anchors={len(got)}")


if __name__ == "__main__":
    main()
    sys.exit(0)
