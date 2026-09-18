"""Low-poly vertex-color decor meshes for I3.

Built in Blender. Linked duplicates live in plant_decor.py.
Does not import Kenney; Kenney zip URLs 404'd (2026-09-07).
"""

from __future__ import annotations

import bmesh
import bpy
from mathutils import Matrix, Vector

from paint_ground import (
    ROCK_BROWN,
    ROCK_CONCRETE,
    TILE_DARK,
    TILE_LIGHT,
    assign_only,
    ensure_color_attribute,
    ensure_vertex_material,
    hex_rgba,
    log,
)

LEAF_A = hex_rgba("4d6320")
LEAF_B = hex_rgba("2e3a16")
LEAF_C = hex_rgba("79992c")
BULB = hex_rgba("ffc857")
TRUNK = ROCK_BROWN
POST = ROCK_CONCRETE
RAIL = TILE_DARK
STEP = TILE_LIGHT
RISER = TILE_DARK
CLOUD_WHITE = hex_rgba("ffffff")

TREE_CAP = 480
LAMP_CAP = 220
FENCE_CAP = 80
POST_CAP = 32
STAIR_CAP = 160
BENCH_CAP = 140
CLOUD_CAP = 96

RUN = 48.0
RISE = 30.0
STAIR_WIDTH = 64.0
STAIR_STEPS = 6


def tri_count(mesh: bpy.types.Mesh) -> int:
    return sum(len(poly.vertices) - 2 for poly in mesh.polygons)


def add_box(
    bm: bmesh.types.BMesh,
    xmin: float,
    xmax: float,
    ymin: float,
    ymax: float,
    zmin: float,
    zmax: float,
) -> None:
    v000 = bm.verts.new((xmin, ymin, zmin))
    v100 = bm.verts.new((xmax, ymin, zmin))
    v110 = bm.verts.new((xmax, ymax, zmin))
    v010 = bm.verts.new((xmin, ymax, zmin))
    v001 = bm.verts.new((xmin, ymin, zmax))
    v101 = bm.verts.new((xmax, ymin, zmax))
    v111 = bm.verts.new((xmax, ymax, zmax))
    v011 = bm.verts.new((xmin, ymax, zmax))
    bm.faces.new((v000, v100, v110, v010))
    bm.faces.new((v001, v011, v111, v101))
    bm.faces.new((v000, v001, v101, v100))
    bm.faces.new((v100, v101, v111, v110))
    bm.faces.new((v110, v111, v011, v010))
    bm.faces.new((v010, v011, v001, v000))


def mesh_from_bm(name: str, bm: bmesh.types.BMesh) -> bpy.types.Mesh:
    bm.faces.ensure_lookup_table()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def origin_center(mesh: bpy.types.Mesh) -> None:
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    cx = (min(xs) + max(xs)) * 0.5
    cy = (min(ys) + max(ys)) * 0.5
    cz = (min(zs) + max(zs)) * 0.5
    for vert in mesh.vertices:
        vert.co.x -= cx
        vert.co.y -= cy
        vert.co.z -= cz
    mesh.update()


def origin_bottom(mesh: bpy.types.Mesh, center_xy: bool) -> None:
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    zmin = min(zs)
    cx = (min(xs) + max(xs)) * 0.5 if center_xy else 0.0
    cy = (min(ys) + max(ys)) * 0.5 if center_xy else 0.0
    for vert in mesh.vertices:
        vert.co.x -= cx
        vert.co.y -= cy
        vert.co.z -= zmin
    mesh.update()


def paint_local(ob: bpy.types.Object, color_at: object) -> dict[str, int]:
    mesh = ob.data
    ensure_color_attribute(mesh)
    attr = mesh.color_attributes.get("Color")
    if attr is None:
        raise RuntimeError(f"{ob.name} missing Color attribute")
    counts: dict[str, int] = {}
    for poly in mesh.polygons:
        rgba, key = color_at(poly.center, poly)
        counts[key] = counts.get(key, 0) + 1
        color = (rgba[0], rgba[1], rgba[2], rgba[3])
        for loop_index in poly.loop_indices:
            attr.data[loop_index].color = color
        poly.use_smooth = False
    mesh.update()
    first = tuple(round(v, 4) for v in attr.data[0].color)
    log(f"{ob.name} Color[0]={first} loops={len(attr.data)} tris={tri_count(mesh)}")
    if first[1] > 0.9 and first[0] < 0.1 and first[2] < 0.1:
        raise RuntimeError(f"{ob.name} Color looks like a normal {first}, not albedo")
    return counts


def finish_object(name: str, mesh: bpy.types.Mesh, cap: int, center_xy: bool) -> bpy.types.Object:
    origin_bottom(mesh, center_xy)
    tris = tri_count(mesh)
    if tris > cap:
        raise RuntimeError(f"{name} {tris} tris > cap {cap}")
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    ob.location = Vector((0.0, 0.0, 0.0))
    ob.rotation_euler = (0.0, 0.0, 0.0)
    ob.scale = (1.0, 1.0, 1.0)
    assign_only(ob, ensure_vertex_material())
    return ob


def make_tree_round() -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=8,
        radius1=7.0,
        radius2=5.0,
        depth=48.0,
        matrix=Matrix.Translation((0.0, 0.0, 24.0)),
    )
    bmesh.ops.create_icosphere(
        bm,
        subdivisions=1,
        radius=42.0,
        matrix=Matrix.Translation((0.0, 0.0, 92.0)),
    )
    ob = finish_object("d_tree_round", mesh_from_bm("TreeRound", bm), TREE_CAP, True)

    def color_at(center: Vector, _poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        if center.z < 50.0:
            return TRUNK, "trunk"
        return LEAF_A, "leaf"

    paint_local(ob, color_at)
    return ob


def make_tree_pine() -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=8,
        radius1=6.0,
        radius2=4.2,
        depth=40.0,
        matrix=Matrix.Translation((0.0, 0.0, 20.0)),
    )
    layers = ((38.0, 42.0, 44.0), (28.0, 78.0, 40.0), (18.0, 112.0, 36.0))
    for radius, z, depth in layers:
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=True,
            segments=8,
            radius1=radius,
            radius2=3.0,
            depth=depth,
            matrix=Matrix.Translation((0.0, 0.0, z + depth * 0.5)),
        )
    ob = finish_object("d_tree_pine", mesh_from_bm("TreePine", bm), TREE_CAP, True)

    def color_at(center: Vector, _poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        if center.z < 42.0:
            return TRUNK, "trunk"
        return LEAF_B, "leaf"

    paint_local(ob, color_at)
    return ob


def make_tree_wide() -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=8,
        radius1=8.0,
        radius2=6.0,
        depth=36.0,
        matrix=Matrix.Translation((0.0, 0.0, 18.0)),
    )
    bmesh.ops.create_icosphere(
        bm,
        subdivisions=1,
        radius=48.0,
        matrix=Matrix.Translation((0.0, 0.0, 78.0)),
    )
    for vert in bm.verts:
        if vert.co.z < 50.0:
            continue
        vert.co.x *= 1.35
        vert.co.y *= 1.35
        vert.co.z = 78.0 + (vert.co.z - 78.0) * 0.52
    ob = finish_object("d_tree_wide", mesh_from_bm("TreeWide", bm), TREE_CAP, True)

    def color_at(center: Vector, _poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        if center.z < 40.0:
            return TRUNK, "trunk"
        return LEAF_C, "leaf"

    paint_local(ob, color_at)
    return ob


def make_lamp_tall() -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=6,
        radius1=2.4,
        radius2=1.7,
        depth=70.0,
        matrix=Matrix.Translation((0.0, 0.0, 35.0)),
    )
    add_box(bm, -1.3, 1.3, 0.0, 18.0, 64.0, 68.0)
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=8,
        v_segments=6,
        radius=5.0,
        matrix=Matrix.Translation((0.0, 20.0, 66.0)),
    )
    ob = finish_object("d_lamp_tall", mesh_from_bm("LampTall", bm), LAMP_CAP, True)

    def color_at(center: Vector, _poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        if center.y > 14.0 and center.z > 58.0:
            return BULB, "bulb"
        return POST, "post"

    paint_local(ob, color_at)
    return ob


def make_lamp_short() -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=True,
        segments=6,
        radius1=3.2,
        radius2=2.4,
        depth=36.0,
        matrix=Matrix.Translation((0.0, 0.0, 18.0)),
    )
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=8,
        v_segments=6,
        radius=6.0,
        matrix=Matrix.Translation((0.0, 0.0, 40.0)),
    )
    ob = finish_object("d_lamp_short", mesh_from_bm("LampShort", bm), LAMP_CAP, True)

    def color_at(center: Vector, _poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        if center.z > 34.0:
            return BULB, "bulb"
        return POST, "post"

    paint_local(ob, color_at)
    return ob


def make_fence_straight() -> bpy.types.Object:
    bm = bmesh.new()
    add_box(bm, -40.0, 40.0, -0.55, 0.55, 4.5, 11.5)
    add_box(bm, -40.8, -39.2, -0.7, 0.7, 0.0, 13.0)
    add_box(bm, 39.2, 40.8, -0.7, 0.7, 0.0, 13.0)
    ob = finish_object("d_fence_straight", mesh_from_bm("FenceStraight", bm), FENCE_CAP, True)
    paint_local(ob, lambda _c, _p: (RAIL, "rail"))
    return ob


def make_fence_corner() -> bpy.types.Object:
    bm = bmesh.new()
    add_box(bm, 0.0, 40.0, -0.55, 0.55, 4.5, 11.5)
    add_box(bm, -0.55, 0.55, 0.0, 40.0, 4.5, 11.5)
    add_box(bm, -0.8, 0.8, -0.8, 0.8, 0.0, 13.0)
    ob = finish_object("d_fence_corner", mesh_from_bm("FenceCorner", bm), FENCE_CAP, False)
    paint_local(ob, lambda _c, _p: (RAIL, "rail"))
    return ob


def make_fence_post() -> bpy.types.Object:
    bm = bmesh.new()
    add_box(bm, -0.9, 0.9, -0.9, 0.9, 0.0, 14.0)
    ob = finish_object("d_fence_post", mesh_from_bm("FencePost", bm), POST_CAP, True)
    paint_local(ob, lambda _c, _p: (POST, "post"))
    return ob


def make_stair_flight() -> bpy.types.Object:
    bm = bmesh.new()
    step_run = RUN / STAIR_STEPS
    step_rise = RISE / STAIR_STEPS
    half = STAIR_WIDTH * 0.5
    for i in range(STAIR_STEPS):
        y0 = i * step_run
        y1 = y0 + step_run
        z0 = i * step_rise
        z1 = z0 + step_rise
        add_box(bm, -half, half, y0, y1, z0, z1)
    ob = finish_object("d_stair_flight", mesh_from_bm("StairFlight", bm), STAIR_CAP, False)

    def color_at(_center: Vector, poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        if poly.normal.z > 0.65:
            return STEP, "tread"
        return RISER, "riser"

    paint_local(ob, color_at)
    return ob


def make_stair_landing() -> bpy.types.Object:
    bm = bmesh.new()
    half = STAIR_WIDTH * 0.5
    add_box(bm, -half, half, 0.0, 22.0, 0.0, 3.0)
    ob = finish_object("d_stair_landing", mesh_from_bm("StairLanding", bm), STAIR_CAP, False)
    paint_local(ob, lambda _c, _p: (STEP, "landing"))
    return ob


def make_hardscape_prototypes() -> dict[str, bpy.types.Object]:
    return {
        "fence_straight": make_fence_straight(),
        "fence_corner": make_fence_corner(),
        "fence_post": make_fence_post(),
        "stair_flight": make_stair_flight(),
        "stair_landing": make_stair_landing(),
    }
