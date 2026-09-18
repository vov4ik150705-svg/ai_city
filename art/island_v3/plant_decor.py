"""Plant I3 decor as linked duplicates under inst_* empties.

Saves island.blend. Does not run the planter, does not touch models/,
does not write the 2026-09-06 canon snapshot.
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
from decor_lib import RUN, RISE, make_hardscape_prototypes  # noqa: E402
from kit_lib import LAMP_HEIGHT, make_kit_prototypes  # noqa: E402
from paint_ground import (  # noqa: E402
    BUILDING_PAD,
    DROP,
    HALF,
    PATH_RING,
    PLAZA_Z,
    extra_args,
    inside_square,
    log,
    plant_names,
    ring_plants,
)

BLEND = os.path.join(ROOT, "island.blend")
BACKUP = os.path.join(ROOT, "island_pre_decor.blend")
DECOR_PREFIX = "d_"
INST_PARENTS = (
    "inst_tree",
    "inst_lamp",
    "inst_fence",
    "inst_stair",
    "inst_bench",
    "inst_sign",
    "inst_cloud",
)
LIVE_INST = INST_PARENTS[:5]
KIT_BACKUP = os.path.join(ROOT, "island_pre_kits.blend")
STAIR_SIDES = (
    ("n", Vector((0.0, HALF - 12.0, PLAZA_Z)), 0.0),
    ("s", Vector((0.0, -(HALF - 12.0), PLAZA_Z)), math.pi),
    ("e", Vector((HALF - 12.0, 0.0, PLAZA_Z)), -math.pi / 2.0),
    ("w", Vector((-(HALF - 12.0), 0.0, PLAZA_Z)), math.pi / 2.0),
)
MODULES = 6
RING_Z = 0.06
FENCE_OUT = 22.0
TREE_OUT = 260.0
STAIR_GAP = 110.0


def rot_z(vec: Vector, yaw: float) -> Vector:
    cos_a = math.cos(yaw)
    sin_a = math.sin(yaw)
    return Vector((vec.x * cos_a - vec.y * sin_a, vec.x * sin_a + vec.y * cos_a, vec.z))


def u01(*parts: float) -> float:
    h = 2166136261
    for part in parts:
        h ^= int(abs(part) * 1000.0) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    return (h % 10000) / 10000.0


I3_PREFIXES = (
    "d_tree_",
    "d_lamp_",
    "d_fence_",
    "d_stair_",
    "d_bench_",
)


def wipe_decor() -> None:
    doomed = [
        ob
        for ob in list(bpy.data.objects)
        if ob.name.startswith(I3_PREFIXES)
    ]
    mesh_names = {
        ob.data.name
        for ob in doomed
        if ob.type == "MESH" and ob.data is not None
    }
    for ob in doomed:
        bpy.data.objects.remove(ob, do_unlink=True)
    removed = 0
    for name in mesh_names:
        mesh = bpy.data.meshes.get(name)
        if mesh is None:
            continue
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
            removed += 1
    log(f"wiped {len(doomed)} decor objects, {removed} unused meshes")


def ensure_parent(name: str) -> bpy.types.Object:
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, None)
        ob.empty_display_type = "PLAIN_AXES"
        scene.collection.objects.link(ob)
        log(f"created {name}")
    ob.location = Vector((0.0, 0.0, 0.0))
    ob.rotation_euler = (0.0, 0.0, 0.0)
    ob.scale = (1.0, 1.0, 1.0)
    ob.parent = None
    return ob


def linked_place(
    proto: bpy.types.Object,
    parent: bpy.types.Object,
    spots: list[tuple[str, Vector, float, float]],
) -> None:
    if not spots:
        raise RuntimeError(f"{proto.name} has no spots")
    name, loc, yaw, scale = spots[0]
    proto.name = name
    proto.location = loc
    proto.rotation_euler = (0.0, 0.0, yaw)
    proto.scale = (scale, scale, scale)
    proto.parent = parent
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    for name, loc, yaw, scale in spots[1:]:
        dup = proto.copy()
        dup.data = proto.data
        dup.name = name
        scene.collection.objects.link(dup)
        dup.parent = parent
        dup.location = loc
        dup.rotation_euler = (0.0, 0.0, yaw)
        dup.scale = (scale, scale, scale)
    users = proto.data.users
    log(f"{proto.data.name} users={users} copies={len(spots)}")
    if users < 2 and len(spots) > 1:
        raise RuntimeError(f"{proto.data.name} users={users}: copies are not linked")
    if users != len(spots):
        raise RuntimeError(f"{proto.data.name} users={users} != spots {len(spots)}")


def stair_corridor(x: float, y: float) -> bool:
    on_n = abs(y) >= HALF - 40.0 and abs(x) < STAIR_GAP
    on_e = abs(x) >= HALF - 40.0 and abs(y) < STAIR_GAP
    return on_n or on_e


def tree_spots(plants: list[Vector]) -> dict[str, list[tuple[str, Vector, float, float]]]:
    round_s: list[tuple[str, Vector, float, float]] = []
    pine_s: list[tuple[str, Vector, float, float]] = []
    wide_s: list[tuple[str, Vector, float, float]] = []
    buckets = (round_s, pine_s, wide_s)
    n = 0

    def add(x: float, y: float, z: float) -> None:
        nonlocal n
        if stair_corridor(x, y) and z > -20.0:
            return
        for plant in plants:
            if math.hypot(x - plant.x, y - plant.y) < BUILDING_PAD + 80.0:
                return
        yaw = (u01(x, y, 3.0) - 0.5) * 0.6
        scale = 0.92 + u01(x, y, 7.0) * 0.18
        name = f"d_tree_{n:03d}"
        buckets[n % 3].append((name, Vector((x, y, z)), yaw, scale))
        n += 1

    for side in range(4):
        for k in range(-6, 7):
            if abs(k) <= 1:
                continue
            t = k * 175.0
            if side == 0:
                add(t, HALF + TREE_OUT, RING_Z)
            elif side == 1:
                add(t, -(HALF + TREE_OUT), RING_Z)
            elif side == 2:
                add(HALF + TREE_OUT, t, RING_Z)
            else:
                add(-(HALF + TREE_OUT), t, RING_Z)
    for plant in plants:
        radius = math.hypot(plant.x, plant.y)
        if radius < 1.0:
            continue
        ux, uy = plant.x / radius, plant.y / radius
        px, py = -uy, ux
        add(plant.x - ux * 420.0 + px * 140.0, plant.y - uy * 420.0 + py * 140.0, RING_Z)
        add(plant.x - ux * 420.0 - px * 160.0, plant.y - uy * 420.0 - py * 160.0, RING_Z)
    for x, y in ((1100.0, 1100.0), (-1100.0, 1100.0), (-1100.0, -1100.0), (200.0, -1150.0)):
        add(x, y, PLAZA_Z)
    for x in (-700.0, 700.0):
        add(x, HALF - 90.0, PLAZA_Z)
    if min(len(round_s), len(pine_s), len(wide_s)) < 8:
        raise RuntimeError(
            f"tree variants too thin: round={len(round_s)} pine={len(pine_s)} wide={len(wide_s)}"
        )
    return {"tree_round": round_s, "tree_pine": pine_s, "tree_wide": wide_s}


def lamp_spots(plants: list[Vector]) -> list[tuple[str, Vector, float, float]]:
    spots: list[tuple[str, Vector, float, float]] = []
    n = 0
    collar = HALF + PATH_RING * 0.45
    short = 40.0 / LAMP_HEIGHT

    def add(x: float, y: float, z: float, yaw: float, scale: float) -> None:
        nonlocal n
        if stair_corridor(x, y) and z > -20.0:
            return
        spots.append((f"d_lamp_{n:03d}", Vector((x, y, z)), yaw, scale))
        n += 1

    for x in (-1000.0, -620.0, 620.0, 1000.0):
        add(x, collar, RING_Z, 0.0, 1.0)
        add(x, -collar, RING_Z, math.pi, 1.0)
    for y in (-1000.0, -620.0, 620.0, 1000.0):
        add(collar, y, RING_Z, -math.pi / 2.0, 1.0)
        add(-collar, y, RING_Z, math.pi / 2.0, 1.0)
    for plant in plants:
        ax, ay = abs(plant.x), abs(plant.y)
        if ax < 1.0 and ay < 1.0:
            continue
        t = HALF / max(ax, ay)
        ex, ey = plant.x * t, plant.y * t
        mx, my = ex + (plant.x - ex) * 0.4, ey + (plant.y - ey) * 0.4
        yaw = math.atan2(ey - plant.y, ex - plant.x) + math.pi / 2.0
        add(mx, my, RING_Z, yaw, short)
    gap = STAIR_GAP + 28.0
    for x, y, yaw in (
        (gap, HALF + 36.0, 0.0),
        (-gap, HALF + 36.0, 0.0),
        (gap, -(HALF + 36.0), math.pi),
        (-gap, -(HALF + 36.0), math.pi),
        (HALF + 36.0, gap, -math.pi / 2.0),
        (HALF + 36.0, -gap, -math.pi / 2.0),
        (-(HALF + 36.0), gap, math.pi / 2.0),
        (-(HALF + 36.0), -gap, math.pi / 2.0),
    ):
        add(x, y, RING_Z, yaw, short)
    for x, y in ((900.0, 900.0), (-900.0, 900.0), (-900.0, -900.0), (350.0, -900.0)):
        add(x, y, PLAZA_Z, 0.0, short)
    if len(spots) < 16:
        raise RuntimeError(f"lamps too thin: {len(spots)}")
    return spots


def bench_spots() -> list[tuple[str, Vector, float, float]]:
    spots: list[tuple[str, Vector, float, float]] = []
    inset = HALF - 240.0
    n = 0

    def add(x: float, y: float, z: float, yaw: float) -> None:
        nonlocal n
        if stair_corridor(x, y):
            return
        spots.append((f"d_bench_{n:02d}", Vector((x, y, z)), yaw, 1.0))
        n += 1

    for x in (-620.0, 620.0):
        add(x, inset, PLAZA_Z, 0.0)
        add(x, -inset, PLAZA_Z, 0.0)
        add(inset, x, PLAZA_Z, math.pi / 2.0)
        add(-inset, x, PLAZA_Z, math.pi / 2.0)
    collar = HALF + PATH_RING * 0.35
    for x, y, yaw in (
        (-820.0, collar, 0.0),
        (820.0, collar, 0.0),
        (-820.0, -collar, 0.0),
        (820.0, -collar, 0.0),
    ):
        add(x, y, RING_Z, yaw)
    if len(spots) < 8:
        raise RuntimeError(f"benches too thin: {len(spots)}")
    return spots


def fence_spots() -> dict[str, list[tuple[str, Vector, float, float]]]:
    straight: list[tuple[str, Vector, float, float]] = []
    corner: list[tuple[str, Vector, float, float]] = []
    posts: list[tuple[str, Vector, float, float]] = []
    clusters = (-920.0, -840.0, -760.0, 760.0, 840.0, 920.0)
    n = 0
    rim = HALF + FENCE_OUT
    for x in clusters:
        straight.append((f"d_fence_s{n:02d}", Vector((x, rim, RING_Z)), 0.0, 1.0))
        n += 1
        straight.append((f"d_fence_s{n:02d}", Vector((x, -rim, RING_Z)), 0.0, 1.0))
        n += 1
        straight.append((f"d_fence_s{n:02d}", Vector((rim, x, RING_Z)), math.pi / 2.0, 1.0))
        n += 1
        straight.append((f"d_fence_s{n:02d}", Vector((-rim, x, RING_Z)), math.pi / 2.0, 1.0))
        n += 1
    corner.append(("d_fence_c0", Vector((rim, rim, RING_Z)), math.pi, 1.0))
    corner.append(("d_fence_c1", Vector((rim, -rim, RING_Z)), math.pi / 2.0, 1.0))
    corner.append(("d_fence_c2", Vector((-rim, -rim, RING_Z)), 0.0, 1.0))
    corner.append(("d_fence_c3", Vector((-rim, rim, RING_Z)), -math.pi / 2.0, 1.0))
    mouths = (
        Vector((STAIR_GAP + 8.0, rim, RING_Z)),
        Vector((-(STAIR_GAP + 8.0), rim, RING_Z)),
        Vector((STAIR_GAP + 8.0, -rim, RING_Z)),
        Vector((-(STAIR_GAP + 8.0), -rim, RING_Z)),
        Vector((rim, STAIR_GAP + 8.0, RING_Z)),
        Vector((rim, -(STAIR_GAP + 8.0), RING_Z)),
        Vector((-rim, STAIR_GAP + 8.0, RING_Z)),
        Vector((-rim, -(STAIR_GAP + 8.0), RING_Z)),
    )
    for i, loc in enumerate(mouths):
        posts.append((f"d_fence_p{i:02d}", loc, 0.0, 1.0))
    for _name, loc, _yaw, _scale in straight + corner + posts:
        if loc.z < -5.0:
            raise RuntimeError(f"fence at z={loc.z:.1f}: must sit on the upper rim")
        if inside_square(loc.x, loc.y, HALF - 4.0):
            raise RuntimeError(f"fence inside plaza {loc.x:.0f},{loc.y:.0f}")
    return {
        "fence_straight": straight,
        "fence_corner": corner,
        "fence_post": posts,
    }


def stair_spots() -> dict[str, list[tuple[str, Vector, float, float]]]:
    flights: list[tuple[str, Vector, float, float]] = []
    landings: list[tuple[str, Vector, float, float]] = []
    if len(STAIR_SIDES) != 4:
        raise RuntimeError(f"stairs need 4 sides, got {len(STAIR_SIDES)}")
    for side, base, yaw in STAIR_SIDES:
        for i in range(MODULES):
            loc = base + rot_z(Vector((0.0, i * RUN, i * RISE)), yaw)
            flights.append((f"d_stair_{side}{i}", loc, yaw, 1.0))
        top = base + rot_z(Vector((0.0, MODULES * RUN, MODULES * RISE)), yaw)
        landings.append((f"d_stair_{side}t", top, yaw, 1.0))
        if abs((top.z) - RING_Z) > 2.0:
            raise RuntimeError(f"stair {side} top z={top.z:.3f}, expected {RING_Z:.3f}")
    if MODULES * RISE != DROP:
        raise RuntimeError(f"stair rise {MODULES * RISE} != DROP {DROP}")
    return {"stair_flight": flights, "stair_landing": landings}


def attack_shift_d(proto: bpy.types.Object) -> None:
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    fake = proto.copy()
    fake.data = proto.data.copy()
    fake.name = "d_attack_unique"
    scene.collection.objects.link(fake)
    users = fake.data.users
    mesh = fake.data
    bpy.data.objects.remove(fake, do_unlink=True)
    bpy.data.meshes.remove(mesh)
    if users != 1:
        raise RuntimeError(f"Shift+D probe expected users=1, got {users}")
    log("attack Shift+D: unique mesh users=1 (GPU instancing would miss it)")


def forbid_units() -> None:
    banned = ("walker", "drone", "pedestrian", "crowd", "vehicle", "car")
    hits: list[str] = []
    plants = plant_names()
    for ob in bpy.data.objects:
        if ob.name in plants:
            continue
        low = ob.name.lower()
        token = low.split(".", 1)[0]
        if token in banned or token.startswith(("walker_", "drone_", "pedestrian_")):
            hits.append(ob.name)
    if hits:
        raise RuntimeError(f"unit-like objects in scene: {hits}")


def measure(prototypes: dict[str, bpy.types.Object]) -> None:
    parents = {name: bpy.data.objects.get(name) for name in LIVE_INST}
    missing = [name for name, ob in parents.items() if ob is None]
    if missing:
        raise RuntimeError(f"missing inst parents: {missing}")
    for name, parent in parents.items():
        kids = [ob for ob in bpy.data.objects if ob.parent == parent]
        log(f"{name} children={len(kids)}")
        if len(kids) < 4:
            raise RuntimeError(f"{name} has {len(kids)} children")
        for kid in kids:
            if kid.parent != parent:
                raise RuntimeError(f"{kid.name} parent is not {name}")
            if kid.children:
                raise RuntimeError(f"{kid.name} has children; GPU instancing forbids grandchildren")
    trees = [ob for ob in bpy.data.objects if ob.name.startswith("d_tree_")]
    if len(trees) < 24:
        raise RuntimeError(f"only {len(trees)} trees")
    benches = [ob for ob in bpy.data.objects if ob.name.startswith("d_bench_")]
    if len(benches) < 8:
        raise RuntimeError(f"only {len(benches)} benches")
    zs_fence = [
        ob.matrix_world.translation.z
        for ob in bpy.data.objects
        if ob.name.startswith("d_fence_")
    ]
    if not zs_fence or min(zs_fence) < -5.0:
        raise RuntimeError(f"fence z {zs_fence[:4]} not on upper rim")
    unique = {ob.data.as_pointer() for ob in trees}
    if len(unique) != 3:
        raise RuntimeError(f"tree unique meshes {len(unique)}, expected 3")
    for proto in prototypes.values():
        log(f"proto {proto.data.name} tris={sum(len(p.vertices)-2 for p in proto.data.polygons)}")


def backup_blend() -> None:
    if not os.path.isfile(BACKUP):
        shutil.copy2(BLEND, BACKUP)
        log(f"wrote backup {BACKUP}")
    else:
        log(f"backup exists {BACKUP}")
    if not os.path.isfile(KIT_BACKUP):
        shutil.copy2(BLEND, KIT_BACKUP)
        log(f"wrote kit backup {KIT_BACKUP}")
    else:
        log(f"kit backup exists {KIT_BACKUP}")


def main() -> None:
    args = extra_args()
    if not os.path.isfile(BLEND):
        raise RuntimeError(f"missing {BLEND}")
    backup_blend()
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    island = bpy.data.objects.get("Island")
    if island is None or island.type != "MESH":
        raise RuntimeError("Island mesh missing")
    names = plant_names()
    missing = sorted(names - {ob.name for ob in bpy.data.objects})
    if missing:
        raise RuntimeError(f"blend missing plants: {missing}")
    wipe_decor()
    for name in INST_PARENTS:
        ensure_parent(name)
    plants = ring_plants()
    log(f"ring plants {len(plants)}")
    prototypes = make_hardscape_prototypes()
    prototypes.update(make_kit_prototypes())
    trees = tree_spots(plants)
    lamps = lamp_spots(plants)
    fences = fence_spots()
    stairs = stair_spots()
    benches = bench_spots()
    linked_place(prototypes["tree_round"], bpy.data.objects["inst_tree"], trees["tree_round"])
    linked_place(prototypes["tree_pine"], bpy.data.objects["inst_tree"], trees["tree_pine"])
    linked_place(prototypes["tree_wide"], bpy.data.objects["inst_tree"], trees["tree_wide"])
    linked_place(prototypes["lamp"], bpy.data.objects["inst_lamp"], lamps)
    linked_place(prototypes["fence_straight"], bpy.data.objects["inst_fence"], fences["fence_straight"])
    linked_place(prototypes["fence_corner"], bpy.data.objects["inst_fence"], fences["fence_corner"])
    linked_place(prototypes["fence_post"], bpy.data.objects["inst_fence"], fences["fence_post"])
    linked_place(prototypes["stair_flight"], bpy.data.objects["inst_stair"], stairs["stair_flight"])
    linked_place(prototypes["stair_landing"], bpy.data.objects["inst_stair"], stairs["stair_landing"])
    linked_place(prototypes["bench"], bpy.data.objects["inst_bench"], benches)
    attack_shift_d(prototypes["tree_round"])
    forbid_units()
    bpy.context.view_layer.update()
    measure(prototypes)
    from light_lib import lamp_emission  # noqa: E402

    lamp_emission()
    if "--dry-run" in args:
        log("dry-run, not saving")
        return
    bpy.ops.wm.save_mainfile()
    log(f"saved {BLEND}")


if __name__ == "__main__":
    main()
