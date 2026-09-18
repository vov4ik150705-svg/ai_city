"""Plant I4 sky, clouds, neon strips, window quads, lamp emission.

Saves island.blend. Does not wipe I3 decor, does not run the planter,
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

from light_lib import (  # noqa: E402
    AMBER,
    SIGN_BRANDS,
    SIGN_STRENGTH,
    WINDOW_STRENGTH,
    ensure_emit_material,
    lamp_emission,
    make_cloud_prototypes,
    make_sign_box,
    make_sky_dome,
)
from paint_ground import assign_only, extra_args, log, plant_names  # noqa: E402
from plant_decor import (  # noqa: E402
    attack_shift_d,
    ensure_parent,
    forbid_units,
    linked_place,
    u01,
)

BLEND = os.path.join(ROOT, "island.blend")
BACKUP = os.path.join(ROOT, "island_pre_light.blend")
CLOUD_PARENT = "inst_cloud"
ISLAND_HALF = 3600.0
BELOW_MARGIN = 3800.0
BELOW_Z = (-1800.0, -800.0)
I4_PREFIXES = ("d_cloud_", "d_win_", "sign_")
I4_NAMES = {"SkyDome"}


def wipe_light() -> None:
    doomed = [
        ob
        for ob in list(bpy.data.objects)
        if ob.name in I4_NAMES or ob.name.startswith(I4_PREFIXES)
    ]
    mesh_names = {ob.data.name for ob in doomed if ob.type == "MESH" and ob.data is not None}
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
    log(f"wiped {len(doomed)} I4 objects, {removed} unused meshes")


def outside_hull(x: float, y: float) -> bool:
    return abs(x) > BELOW_MARGIN or abs(y) > BELOW_MARGIN


def cloud_legal(loc: Vector, below: bool) -> None:
    if below:
        if loc.z > BELOW_Z[1] or loc.z < BELOW_Z[0]:
            raise RuntimeError(f"below-cloud z={loc.z:.1f} outside {BELOW_Z}")
        if not outside_hull(loc.x, loc.y):
            raise RuntimeError(f"below-cloud inside hull {loc.x:.0f},{loc.y:.0f}")
        return
    if loc.z < 180.0:
        raise RuntimeError(f"upper-cloud z={loc.z:.1f} too low")
    if math.hypot(loc.x, loc.y) < ISLAND_HALF + 800.0:
        raise RuntimeError(f"upper-cloud over island {loc.x:.0f},{loc.y:.0f}")


def attack_inside_rock() -> None:
    try:
        cloud_legal(Vector((0.0, 0.0, -1200.0)), True)
    except RuntimeError:
        log("attack inside-rock cloud: rejected")
        return
    raise RuntimeError("inside-rock cloud was accepted")


def attack_over_island() -> None:
    try:
        cloud_legal(Vector((0.0, 0.0, 400.0)), False)
    except RuntimeError:
        log("attack over-island cloud: rejected")
        return
    raise RuntimeError("over-island cloud was accepted")


def cloud_spots() -> dict[str, list[tuple[str, Vector, float, float]]]:
    keys = ("cloud_kit_a", "cloud_kit_b", "cloud_chunk_a", "cloud_chunk_b")
    buckets: dict[str, list[tuple[str, Vector, float, float]]] = {k: [] for k in keys}
    n = 0

    def add(x: float, y: float, z: float, below: bool) -> None:
        nonlocal n
        loc = Vector((x, y, z))
        cloud_legal(loc, below)
        yaw = (u01(x, y, z) - 0.5) * 1.2
        scale = 0.85 + u01(x, y, 9.0) * 0.45
        key = keys[n % 4]
        buckets[key].append((f"d_cloud_{n:02d}", loc, yaw, scale))
        n += 1

    below = (
        (4480.0, 720.0, -940.0),
        (-4220.0, -1680.0, -1280.0),
        (1360.0, 4560.0, -1660.0),
        (-4680.0, 1120.0, -1120.0),
        (5120.0, -2040.0, -1480.0),
        (-900.0, -4920.0, -1760.0),
    )
    for x, y, z in below:
        add(x, y, z, True)
    for i in range(12):
        ang = i * (math.tau / 12.0) + 0.28
        radius = 4600.0 + (i % 4) * 380.0
        add(math.cos(ang) * radius, math.sin(ang) * radius, 280.0 + (i % 5) * 110.0, False)
    for key, spots in buckets.items():
        if len(spots) < 2:
            raise RuntimeError(f"{key} only {len(spots)} copies; GPU instancing needs >=2")
    log(f"clouds {n} below={len(below)}")
    return buckets


def world_bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    child.matrix_world = mw


def inward_xy(ob: bpy.types.Object) -> Vector:
    loc = ob.matrix_world.translation
    vec = Vector((-loc.x, -loc.y, 0.0))
    if vec.length < 200.0:
        return Vector((0.0, 1.0, 0.0))
    return vec.normalized()


def plant_signs() -> None:
    names = plant_names()
    for plant, brand, rgba in SIGN_BRANDS:
        if plant not in names:
            raise RuntimeError(f"sign brand {plant} not in PLANTS")
        host = bpy.data.objects.get(plant)
        if host is None or host.type != "MESH":
            raise RuntimeError(f"missing host {plant}")
        lo, hi = world_bounds(host)
        inward = inward_xy(host)
        cx = 0.5 * (lo.x + hi.x)
        cy = 0.5 * (lo.y + hi.y)
        span = max(hi.x - lo.x, hi.y - lo.y)
        height = hi.z - lo.z
        pos = Vector(
            (
                cx + inward.x * (span * 0.28),
                cy + inward.y * (span * 0.28),
                lo.z + height * 0.58,
            )
        )
        sign = make_sign_box(f"sign_{brand}", f"Sign_{brand}", Vector((90.0, 6.0, 24.0)))
        assign_only(sign, ensure_emit_material(f"Sign_{brand}", rgba, SIGN_STRENGTH))
        yaw = math.atan2(inward.x, inward.y)
        sign.location = pos
        sign.rotation_euler = (0.0, 0.0, yaw)
        parent_keep_world(sign, host)
        win_mat = ensure_emit_material("WindowEmit", AMBER, WINDOW_STRENGTH)
        for i, frac in enumerate((0.28, 0.40, 0.72)):
            win = make_sign_box(f"d_win_{brand}{i}", f"Win_{brand}{i}", Vector((22.0, 4.0, 36.0)))
            assign_only(win, win_mat)
            wpos = Vector(
                (
                    cx + inward.x * (span * 0.30),
                    cy + inward.y * (span * 0.30),
                    lo.z + height * frac,
                )
            )
            win.location = wpos
            win.rotation_euler = (0.0, 0.0, yaw)
            parent_keep_world(win, host)
        log(f"sign_{brand} on {plant} z={pos.z:.1f}")


def measure_light(prototypes: dict[str, bpy.types.Object]) -> None:
    parent = bpy.data.objects.get(CLOUD_PARENT)
    if parent is None:
        raise RuntimeError("missing inst_cloud")
    kids = [ob for ob in bpy.data.objects if ob.parent == parent]
    if len(kids) < 12:
        raise RuntimeError(f"inst_cloud children={len(kids)}")
    below = 0
    for kid in kids:
        if kid.children:
            raise RuntimeError(f"{kid.name} has children")
        loc = kid.matrix_world.translation
        if loc.z <= BELOW_Z[1]:
            cloud_legal(loc, True)
            below += 1
    if below < 2:
        raise RuntimeError(f"only {below} clouds below the island")
    dome = bpy.data.objects.get("SkyDome")
    if dome is None:
        raise RuntimeError("SkyDome missing")
    if min(dome.scale.x, dome.scale.y, dome.scale.z) < 10000.0:
        raise RuntimeError(f"SkyDome scale {tuple(dome.scale)}")
    signs = [ob.name for ob in bpy.data.objects if ob.name.startswith("sign_")]
    if len(signs) != 4:
        raise RuntimeError(f"signs {signs}")
    windows = [ob for ob in bpy.data.objects if ob.name.startswith("d_win_")]
    if len(windows) < 8:
        raise RuntimeError(f"windows {len(windows)}")
    unique = {ob.data.as_pointer() for ob in kids}
    if len(unique) != 4:
        raise RuntimeError(f"cloud unique meshes {len(unique)}, expected 4")
    for proto in prototypes.values():
        log(f"proto {proto.data.name} tris={sum(len(p.vertices) - 2 for p in proto.data.polygons)}")
    log(f"inst_cloud children={len(kids)} below={below}")


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
    island = bpy.data.objects.get("Island")
    if island is None or island.type != "MESH":
        raise RuntimeError("Island mesh missing")
    names = plant_names()
    missing = sorted(names - {ob.name for ob in bpy.data.objects})
    if missing:
        raise RuntimeError(f"blend missing plants: {missing}")
    wipe_light()
    ensure_parent(CLOUD_PARENT)
    ensure_parent("inst_sign")
    attack_inside_rock()
    attack_over_island()
    prototypes = make_cloud_prototypes()
    spots = cloud_spots()
    parent = bpy.data.objects[CLOUD_PARENT]
    for key, placed in spots.items():
        linked_place(prototypes[key], parent, placed)
    make_sky_dome()
    plant_signs()
    lamp_emission()
    attack_shift_d(prototypes["cloud_kit_a"])
    forbid_units()
    bpy.context.view_layer.update()
    measure_light(prototypes)
    if "--dry-run" in args:
        log("dry-run, not saving")
        return
    bpy.ops.wm.save_mainfile()
    log(f"saved {BLEND}")


if __name__ == "__main__":
    main()
