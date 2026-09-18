"""Cut a 2800 m world-aligned plaza into Island and drop it 180 m.

Saves island.blend. Does not touch the 2026-09-06 mass snapshot, models/,
or packages/render. Does not run the planter.
"""

from __future__ import annotations

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from build_island import PLANTS  # noqa: E402

BLEND = os.path.join(ROOT, "island.blend")
PLAZA = 2800.0
HALF = PLAZA / 2.0
DROP = 180.0
TOP_Z = -1.0
INSIDE_MARGIN = 0.75
BISECT_DIST = 0.05


def log(msg: str) -> None:
    print(msg, flush=True)


def extra_args() -> list[str]:
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1 :]
    return []


def plant_names() -> set[str]:
    return {row[0] for row in PLANTS}


def world_plane_to_local(
    ob: bpy.types.Object, co: Vector, no: Vector
) -> tuple[Vector, Vector]:
    im = ob.matrix_world.inverted()
    co_l = im @ co
    no_l = im.to_3x3() @ no
    no_l.normalize()
    return co_l, no_l


def top_geom(bm: bmesh.types.BMesh) -> list[object]:
    verts = [v for v in bm.verts if v.co.z >= TOP_Z]
    vset = set(verts)
    edges = [e for e in bm.edges if e.verts[0] in vset and e.verts[1] in vset]
    faces = [f for f in bm.faces if all(v in vset for v in f.verts)]
    return verts + edges + faces


def cut_plaza(island: bpy.types.Object) -> int:
    mesh = island.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    planes = (
        (Vector((HALF, 0.0, 0.0)), Vector((1.0, 0.0, 0.0))),
        (Vector((-HALF, 0.0, 0.0)), Vector((-1.0, 0.0, 0.0))),
        (Vector((0.0, HALF, 0.0)), Vector((0.0, 1.0, 0.0))),
        (Vector((0.0, -HALF, 0.0)), Vector((0.0, -1.0, 0.0))),
    )
    for co, no in planes:
        bm.verts.ensure_lookup_table()
        bm.edges.ensure_lookup_table()
        bm.faces.ensure_lookup_table()
        co_l, no_l = world_plane_to_local(island, co, no)
        bmesh.ops.bisect_plane(
            bm,
            geom=top_geom(bm),
            dist=BISECT_DIST,
            plane_co=co_l,
            plane_no=no_l,
            clear_inner=False,
            clear_outer=False,
        )

    mw = island.matrix_world
    bm.faces.ensure_lookup_table()
    interior: list[bmesh.types.BMFace] = []
    for face in bm.faces:
        if any(vert.co.z < TOP_Z for vert in face.verts):
            continue
        center = mw @ face.calc_center_median()
        if abs(center.x) < HALF - INSIDE_MARGIN and abs(center.y) < HALF - INSIDE_MARGIN:
            interior.append(face)
    if not interior:
        bm.free()
        raise RuntimeError("plaza interior is empty after bisect")

    extruded = bmesh.ops.extrude_face_region(bm, geom=interior)
    ext_verts = [g for g in extruded["geom"] if isinstance(g, bmesh.types.BMVert)]
    if not ext_verts:
        bm.free()
        raise RuntimeError("plaza extrude produced no verts")
    bmesh.ops.translate(bm, vec=Vector((0.0, 0.0, -DROP)), verts=ext_verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    faces_after = len(bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return faces_after


def drop_plaza_plants() -> list[str]:
    dropped: list[str] = []
    names = plant_names()
    for ob in bpy.data.objects:
        if ob.name not in names:
            continue
        pos = ob.matrix_world.translation.copy()
        if abs(pos.x) > HALF or abs(pos.y) > HALF:
            continue
        pos.z -= DROP
        ob.matrix_world.translation = pos
        dropped.append(ob.name)
    if "CityHall" not in dropped:
        raise RuntimeError("CityHall origin is not inside the plaza square")
    return dropped


def measure(island: bpy.types.Object) -> None:
    mw = island.matrix_world
    mesh = island.data
    world = [mw @ vert.co for vert in mesh.vertices]
    xs = [p.x for p in world]
    ys = [p.y for p in world]
    zs = [p.z for p in world]
    log(
        f"AABB x {min(xs):.1f}..{max(xs):.1f} y {min(ys):.1f}..{max(ys):.1f} "
        f"z {min(zs):.1f}..{max(zs):.1f} faces {len(mesh.polygons)}"
    )
    floor = [p for p in world if -DROP - 2.0 <= p.z <= -DROP + 2.0]
    ring = [p for p in world if p.z >= TOP_Z]
    if not floor:
        raise RuntimeError("no verts at dropped plaza z")
    fx = [p.x for p in floor]
    fy = [p.y for p in floor]
    fz = [p.z for p in floor]
    log(
        f"plaza floor n={len(floor)} z {min(fz):.3f}..{max(fz):.3f} "
        f"xy {min(fx):.1f}..{max(fx):.1f} / {min(fy):.1f}..{max(fy):.1f}"
    )
    span_x = max(fx) - min(fx)
    span_y = max(fy) - min(fy)
    if span_x > PLAZA + 80.0 or span_y > PLAZA + 80.0:
        raise RuntimeError(
            f"plaza floor span {span_x:.1f}x{span_y:.1f} m, expected ~{PLAZA:.0f}"
        )
    if ring:
        rz = [p.z for p in ring]
        log(f"ring top n={len(ring)} z {min(rz):.3f}..{max(rz):.3f}")
    side = [
        p
        for p in floor
        if abs(abs(p.x) - HALF) < 8.0 and abs(p.y) > 200.0
    ]
    log(f"axis-aligned side samples (x~±1400, |y|>200): {len(side)}")
    vertical = 0
    sloped = 0
    for edge in mesh.edges:
        a = mw @ mesh.vertices[edge.vertices[0]].co
        b = mw @ mesh.vertices[edge.vertices[1]].co
        dz = abs(a.z - b.z)
        if dz < 170.0:
            continue
        near = (
            abs(a.x) <= HALF + 20.0
            and abs(a.y) <= HALF + 20.0
            and abs(b.x) <= HALF + 20.0
            and abs(b.y) <= HALF + 20.0
        )
        if not near:
            continue
        dxy = math.hypot(a.x - b.x, a.y - b.y)
        if dxy < 1.0:
            vertical += 1
        else:
            sloped += 1
    log(f"plaza wall edges dz>=170 vertical={vertical} sloped={sloped}")
    if vertical < 100 or sloped > 10:
        raise RuntimeError("plaza walls are sloped, not vertical")
    hall = bpy.data.objects.get("CityHall")
    if hall is not None:
        log(
            f"CityHall world {tuple(round(v, 3) for v in hall.matrix_world.translation)} "
            f"dim.z {hall.dimensions.z:.1f}"
        )


def main() -> None:
    args = extra_args()
    probe_only = "--probe" in args
    if not os.path.isfile(BLEND):
        raise RuntimeError(f"missing {BLEND}")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    island = bpy.data.objects.get("Island")
    if island is None or island.type != "MESH":
        raise RuntimeError("Island mesh missing")
    if probe_only:
        measure(island)
        return
    before = len(island.data.polygons)
    faces_after = cut_plaza(island)
    dropped = drop_plaza_plants()
    log(f"faces {before} -> {faces_after}")
    log("dropped plants: " + ", ".join(dropped))
    measure(island)
    bpy.ops.wm.save_mainfile()
    log(f"saved {BLEND}")


if __name__ == "__main__":
    main()
