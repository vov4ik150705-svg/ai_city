"""I5: scale Hall, pack 17 buildings on the ring, facades to center.

Moves existing plant objects. Does not import models/, does not run
build_island.main(), does not wipe I3/I4 decor.
"""

from __future__ import annotations

import math
import os
import shutil
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from build_island import PLANTS  # noqa: E402
from paint_ground import HALF, PLAZA_Z, extra_args, log, plant_names  # noqa: E402

BLEND = os.path.join(ROOT, "island.blend")
BACKUP = os.path.join(ROOT, "island_pre_compose.blend")
RING_Z = 0.06
HALL_TARGET = 1800.0
HALL_XY = (0.0, 220.0)
RING_GAP = 80.0
CLIFF = 3100.0
STAIR_KEEP = 220.0
MIN_GAP = 24.0

# (name, side, along) — along is x on n/s, y on e/w. Skip the stair mouth.
RING_LOTS: tuple[tuple[str, str, float], ...] = (
    ("NvidiaDepot", "n", -1140.0),
    ("NvidiaTower", "n", -400.0),
    ("DataCenter", "n", 400.0),
    ("Microsoft", "n", 1140.0),
    ("Apple", "e", 1140.0),
    ("RoboticLab", "e", 420.0),
    ("Workshop", "e", -420.0),
    ("Amazon", "e", -1140.0),
    ("AmazonWarehouse", "s", 1140.0),
    ("FleetYard", "s", 360.0),
    ("AgentHub", "s", -360.0),
    ("Bank", "s", -1140.0),
    ("Tesla", "w", 1140.0),
    ("Exchange", "w", 400.0),
    ("Coinbase", "w", -280.0),
    ("PowerNode", "w", -1140.0),
    ("Clearinghouse", "nw", 0.0),
)


def world_bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def aabb_center(lo: Vector, hi: Vector) -> Vector:
    return Vector((0.5 * (lo.x + hi.x), 0.5 * (lo.y + hi.y), 0.5 * (lo.z + hi.z)))


def angle_delta(a: float, b: float) -> float:
    return abs(math.atan2(math.sin(a - b), math.cos(a - b)))


def scale_uniform(ob: bpy.types.Object, factor: float) -> None:
    if factor <= 0.0:
        raise RuntimeError(f"{ob.name} scale factor {factor}")
    ob.scale = (ob.scale.x * factor, ob.scale.y * factor, ob.scale.z * factor)
    bpy.context.view_layer.update()


def snap_floor(ob: bpy.types.Object, xy: tuple[float, float], yaw: float, floor_z: float) -> None:
    ob.rotation_euler.z = yaw
    bpy.context.view_layer.update()
    lo, hi = world_bounds(ob)
    c = aabb_center(lo, hi)
    ob.location.x += xy[0] - c.x
    ob.location.y += xy[1] - c.y
    ob.location.z += floor_z - lo.z
    bpy.context.view_layer.update()


def side_xy(side: str, along: float, dist: float) -> tuple[float, float]:
    if side == "n":
        return (along, dist)
    if side == "s":
        return (along, -dist)
    if side == "e":
        return (dist, along)
    if side == "w":
        return (-dist, along)
    if side == "nw":
        return (-dist, dist)
    raise RuntimeError(f"bad side {side}")


def lot_xy(name: str, side: str, along: float, span: float) -> tuple[float, float]:
    if abs(along) < STAIR_KEEP and side in {"n", "s", "e", "w"}:
        raise RuntimeError(f"{name} along={along} sits on a stair")
    dist = HALF + RING_GAP + span * 0.5
    if dist > CLIFF - 400.0:
        raise RuntimeError(f"{name} ring dist {dist:.0f} toward cliff")
    return side_xy(side, along, dist)


def place_hall(ob: bpy.types.Object) -> None:
    lo, hi = world_bounds(ob)
    height = hi.z - lo.z
    if height < 100.0:
        raise RuntimeError(f"CityHall height {height}")
    scale_uniform(ob, HALL_TARGET / height)
    lo, hi = world_bounds(ob)
    got = hi.z - lo.z
    if abs(got - HALL_TARGET) > 8.0:
        raise RuntimeError(f"CityHall height {got:.1f} after scale, want {HALL_TARGET}")
    yaw = math.atan2(HALL_XY[0], HALL_XY[1])
    snap_floor(ob, HALL_XY, yaw, PLAZA_Z)
    log(f"CityHall h={got:.1f} xy={HALL_XY}")


def place_ring(ob: bpy.types.Object, side: str, along: float) -> None:
    lo, hi = world_bounds(ob)
    span = max(hi.x - lo.x, hi.y - lo.y)
    xy = lot_xy(ob.name, side, along, span)
    yaw = math.atan2(xy[0], xy[1])
    snap_floor(ob, xy, yaw, RING_Z)


def overlap_area(a: tuple[Vector, Vector], b: tuple[Vector, Vector]) -> float:
    ax0, ax1 = a[0].x, a[1].x
    ay0, ay1 = a[0].y, a[1].y
    bx0, bx1 = b[0].x, b[1].x
    by0, by1 = b[0].y, b[1].y
    dx = min(ax1, bx1) - max(ax0, bx0)
    dy = min(ay1, by1) - max(ay0, by0)
    if dx <= 0.0 or dy <= 0.0:
        return 0.0
    return dx * dy


def measure(names: set[str]) -> dict[str, tuple[Vector, Vector]]:
    boxes: dict[str, tuple[Vector, Vector]] = {}
    hall_h = 0.0
    tallest = ("", 0.0)
    for name in names:
        ob = bpy.data.objects.get(name)
        if ob is None or ob.type != "MESH":
            raise RuntimeError(f"missing plant {name}")
        sx, sy, sz = ob.scale
        if max(abs(sx - sy), abs(sy - sz), abs(sx - sz)) > 0.001:
            raise RuntimeError(f"{name} non-uniform scale {tuple(ob.scale)}")
        lo, hi = world_bounds(ob)
        boxes[name] = (lo, hi)
        height = hi.z - lo.z
        if height > tallest[1]:
            tallest = (name, height)
        c = aabb_center(lo, hi)
        if name == "CityHall":
            hall_h = height
            if abs(height - HALL_TARGET) > 40.0:
                raise RuntimeError(f"CityHall height {height:.1f} not ~{HALL_TARGET}")
            if not (abs(c.x) <= HALF and abs(c.y) <= HALF):
                raise RuntimeError(f"CityHall center {c.x:.0f},{c.y:.0f} off plaza")
            if abs(lo.z - PLAZA_Z) > 4.0:
                raise RuntimeError(f"CityHall floor z={lo.z:.2f}")
            continue
        if abs(c.x) <= HALF and abs(c.y) <= HALF:
            raise RuntimeError(f"{name} still on plaza {c.x:.0f},{c.y:.0f}")
        if abs(lo.z - RING_Z) > 4.0:
            raise RuntimeError(f"{name} floor z={lo.z:.2f}, want {RING_Z}")
        if max(abs(lo.x), abs(hi.x), abs(lo.y), abs(hi.y)) > CLIFF:
            raise RuntimeError(f"{name} AABB hits cliff")
        want = math.atan2(c.x, c.y)
        if angle_delta(ob.rotation_euler.z, want) > 0.35:
            raise RuntimeError(f"{name} facade not inward")
        log(f"{name} c=({c.x:.0f},{c.y:.0f}) h={height:.0f} span={max(hi.x - lo.x, hi.y - lo.y):.0f}")
    if tallest[0] != "CityHall":
        raise RuntimeError(f"tallest is {tallest[0]} h={tallest[1]:.0f}, not CityHall")
    keys = list(boxes)
    for i, a in enumerate(keys):
        for b in keys[i + 1 :]:
            area = overlap_area(boxes[a], boxes[b])
            if area > MIN_GAP * MIN_GAP:
                raise RuntimeError(f"overlap {a}/{b} area={area:.0f}")
    log(f"CityHall h={hall_h:.1f} tallest=yes ring={len(names) - 1}")
    return boxes


def attack_short_hall() -> None:
    if HALL_TARGET < 1600.0:
        raise RuntimeError("HALL_TARGET too low")
    log("attack short-hall constant: rejected")


def attack_cliff_lot() -> None:
    try:
        lot_xy("FakeCliff", "e", 800.0, 4000.0)
    except RuntimeError:
        log("attack cliff lot: rejected")
        return
    raise RuntimeError("cliff lot was accepted")


def attack_stair_mouth() -> None:
    try:
        lot_xy("FakeStair", "n", 0.0, 560.0)
    except RuntimeError:
        log("attack stair-mouth lot: rejected")
        return
    raise RuntimeError("stair-mouth lot was accepted")


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
    lot_names = {row[0] for row in RING_LOTS}
    if lot_names != (names - {"CityHall"}):
        raise RuntimeError(f"RING_LOTS mismatch extra={lot_names - names} missing={names - lot_names - {'CityHall'}}")
    attack_short_hall()
    attack_cliff_lot()
    attack_stair_mouth()
    hall = bpy.data.objects["CityHall"]
    place_hall(hall)
    for name, side, along in RING_LOTS:
        place_ring(bpy.data.objects[name], side, along)
    bpy.context.view_layer.update()
    measure(names)
    if "--dry-run" in args:
        log("dry-run, not saving")
        return
    bpy.ops.wm.save_mainfile()
    log(f"saved {BLEND}")


if __name__ == "__main__":
    main()
    sys.exit(0)
