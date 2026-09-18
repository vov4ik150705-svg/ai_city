"""Import CC-BY kit meshes from decoration/ as IslandVertex prototypes.

Trees: Ben Desai. Lantern: Ian MacGillivray. Bench: nudtanunStudent.
Does not import Walk in the Woods (packed diorama, trees 3020 tris).
"""

from __future__ import annotations

import os

import bpy
from mathutils import Vector

from decor_lib import (
    BENCH_CAP,
    BULB,
    CLOUD_CAP,
    CLOUD_WHITE,
    LAMP_CAP,
    POST,
    TREE_CAP,
    origin_bottom,
    origin_center,
    paint_local,
    tri_count,
)
from paint_ground import ROCK_BROWN, assign_only, ensure_vertex_material, log

ROOT = os.path.dirname(os.path.abspath(__file__))
DECOR = os.path.join(os.path.dirname(os.path.dirname(ROOT)), "decoration")
TREE_GLB = os.path.join(DECOR, "Tree Assets by Ben Desai - eLqmfpqu_Ig.glb")
LAMP_GLB = os.path.join(DECOR, "Lantern_7DH0-bxPgM9.glb")
BENCH_GLB = os.path.join(DECOR, "Bench_Nj4eoumlsn.glb")

TREE_PICKS: tuple[tuple[str, str, str, float], ...] = (
    ("tree_round", "group1114869579", "TreeFull", 160.0),
    ("tree_pine", "group100681590", "TreeMid", 140.0),
    ("tree_wide", "group720331588", "TreeTall", 180.0),
)
LAMP_HEIGHT = 70.0
BENCH_LENGTH = 48.0


def material_rgba(mat: bpy.types.Material | None) -> tuple[float, float, float, float]:
    if mat is None or mat.node_tree is None:
        return POST
    name = mat.name.lower()
    if "wood" in name:
        return ROCK_BROWN
    if "metal" in name or "black" in name:
        return POST
    for node in mat.node_tree.nodes:
        if node.type != "BSDF_PRINCIPLED":
            continue
        sock = node.inputs.get("Base Color")
        if sock is None:
            break
        col = sock.default_value
        return (float(col[0]), float(col[1]), float(col[2]), 1.0)
    return POST


def paint_from_materials(ob: bpy.types.Object, bulb_frac: float | None) -> None:
    mesh = ob.data
    zs = [v.co.z for v in mesh.vertices]
    zmax = max(zs) if zs else 1.0
    bulb_z = zmax * bulb_frac if bulb_frac is not None else None
    slots = list(mesh.materials)

    def color_at(center: Vector, poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        if bulb_z is not None and center.z >= bulb_z:
            return BULB, "bulb"
        idx = poly.material_index
        mat = slots[idx] if 0 <= idx < len(slots) else None
        rgba = material_rgba(mat)
        if mat is not None and mat.blend_method == "BLEND":
            return BULB, "glass"
        return rgba, "mat"

    paint_local(ob, color_at)
    assign_only(ob, ensure_vertex_material())


def bake_object_transform(ob: bpy.types.Object) -> None:
    mesh = ob.data
    rot = ob.matrix_world.to_3x3().to_4x4()
    mesh.transform(rot)
    mesh.update()
    ob.matrix_world.identity()
    ob.location = Vector((0.0, 0.0, 0.0))
    ob.rotation_euler = (0.0, 0.0, 0.0)
    ob.scale = (1.0, 1.0, 1.0)


def scale_height(ob: bpy.types.Object, target: float) -> None:
    zs = [v.co.z for v in ob.data.vertices]
    height = max(zs) - min(zs)
    if height < 1e-4:
        raise RuntimeError(f"{ob.name} has no height")
    factor = target / height
    for vert in ob.data.vertices:
        vert.co *= factor
    ob.data.update()


def scale_span_x(ob: bpy.types.Object, target: float) -> None:
    xs = [v.co.x for v in ob.data.vertices]
    span = max(xs) - min(xs)
    if span < 1e-4:
        raise RuntimeError(f"{ob.name} has no X span")
    factor = target / span
    for vert in ob.data.vertices:
        vert.co *= factor
    ob.data.update()


def decimate_to_cap(ob: bpy.types.Object, cap: int) -> None:
    mesh = ob.data
    current = tri_count(mesh)
    if current <= cap:
        return
    ratio = max(0.08, cap / float(current))
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    mod = ob.modifiers.new("DietTris", "DECIMATE")
    mod.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=mod.name)
    got = tri_count(ob.data)
    log(f"{ob.name} decimate {current} -> {got} cap {cap}")
    if got > cap:
        raise RuntimeError(f"{ob.name} still {got} tris > cap {cap}")


def import_glb(path: str) -> list[bpy.types.Object]:
    if not os.path.isfile(path):
        raise RuntimeError(f"missing kit {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [ob for ob in bpy.data.objects if ob not in before]


def discard(obs: list[bpy.types.Object]) -> None:
    meshes: list[bpy.types.Mesh] = []
    for ob in obs:
        if ob.type == "MESH" and ob.data is not None:
            meshes.append(ob.data)
        bpy.data.objects.remove(ob, do_unlink=True)
    for mesh in meshes:
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def scale_xy_span(ob: bpy.types.Object, target: float) -> None:
    xs = [v.co.x for v in ob.data.vertices]
    ys = [v.co.y for v in ob.data.vertices]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    if span < 1e-4:
        raise RuntimeError(f"{ob.name} has no XY span")
    factor = target / span
    for vert in ob.data.vertices:
        vert.co *= factor
    ob.data.update()


def clone_cloud(
    src: bpy.types.Object,
    object_name: str,
    mesh_name: str,
    cap: int,
    xy_span: float,
) -> bpy.types.Object:
    mesh = src.data.copy()
    mesh.name = mesh_name
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    ob = bpy.data.objects.new(object_name, mesh)
    scene.collection.objects.link(ob)
    ob.matrix_world = src.matrix_world.copy()
    bake_object_transform(ob)
    origin_center(mesh)
    scale_xy_span(ob, xy_span)
    origin_center(mesh)
    paint_from_materials(ob, None)
    paint_local(ob, lambda _c, _p: (CLOUD_WHITE, "cloud"))
    decimate_to_cap(ob, cap)
    got = tri_count(ob.data)
    if got > cap:
        raise RuntimeError(f"{object_name} {got} tris > cap {cap}")
    log(f"kit {object_name} tris={got}")
    return ob


def clone_prepared(
    src: bpy.types.Object,
    object_name: str,
    mesh_name: str,
    cap: int,
    *,
    height: float | None,
    length: float | None,
    bulb_frac: float | None,
) -> bpy.types.Object:
    mesh = src.data.copy()
    mesh.name = mesh_name
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    ob = bpy.data.objects.new(object_name, mesh)
    scene.collection.objects.link(ob)
    ob.matrix_world = src.matrix_world.copy()
    bake_object_transform(ob)
    origin_bottom(mesh, True)
    if height is not None:
        scale_height(ob, height)
    if length is not None:
        scale_span_x(ob, length)
    origin_bottom(mesh, True)
    paint_from_materials(ob, bulb_frac)
    decimate_to_cap(ob, cap)
    got = tri_count(ob.data)
    if got > cap:
        raise RuntimeError(f"{object_name} {got} tris > cap {cap}")
    log(f"kit {object_name} tris={got} h={max(v.co.z for v in ob.data.vertices):.1f}")
    return ob


def pick_mesh(imported: list[bpy.types.Object], prefix: str) -> bpy.types.Object:
    hits = [ob for ob in imported if ob.type == "MESH" and ob.name.startswith(prefix)]
    if not hits:
        names = [ob.name for ob in imported if ob.type == "MESH"]
        raise RuntimeError(f"kit missing {prefix}, have {names[:12]}")
    return hits[0]


def make_kit_prototypes() -> dict[str, bpy.types.Object]:
    out: dict[str, bpy.types.Object] = {}
    imported = import_glb(TREE_GLB)
    try:
        for key, prefix, mesh_name, height in TREE_PICKS:
            src = pick_mesh(imported, prefix)
            out[key] = clone_prepared(
                src, f"d_{key}", mesh_name, TREE_CAP, height=height, length=None, bulb_frac=None
            )
    finally:
        discard(imported)

    imported = import_glb(LAMP_GLB)
    try:
        src = pick_mesh(imported, "Node")
        out["lamp"] = clone_prepared(
            src, "d_lamp_kit", "LampKit", LAMP_CAP, height=LAMP_HEIGHT, length=None, bulb_frac=0.78
        )
    finally:
        discard(imported)

    imported = import_glb(BENCH_GLB)
    try:
        src = pick_mesh(imported, "simpleParkBench")
        out["bench"] = clone_prepared(
            src, "d_bench_kit", "BenchKit", BENCH_CAP, height=None, length=BENCH_LENGTH, bulb_frac=None
        )
    finally:
        discard(imported)
    return out


CLOUD_PICKS: tuple[tuple[str, str, str, float], ...] = (
    ("cloud_kit_a", "group1795976569", "CloudKitA", 720.0),
    ("cloud_kit_b", "group601634601", "CloudKitB", 540.0),
)


def make_cloud_kit_prototypes() -> dict[str, bpy.types.Object]:
    out: dict[str, bpy.types.Object] = {}
    imported = import_glb(TREE_GLB)
    try:
        for key, prefix, mesh_name, span in CLOUD_PICKS:
            src = pick_mesh(imported, prefix)
            out[key] = clone_cloud(src, f"d_{key}", mesh_name, CLOUD_CAP, span)
    finally:
        discard(imported)
    if len(out) != 2:
        raise RuntimeError(f"expected 2 kit clouds, got {list(out)}")
    return out
