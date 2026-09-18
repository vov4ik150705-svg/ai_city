"""Paint island ground: plaza checker, ring paths, soil, rock.

Saves island.blend. Vertex colors only; one material IslandVertex.
Does not run the planter or touch models/.
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
PLAZA_Z = 0.06 - DROP
PAVE_Z = PLAZA_Z + 0.4
TOP_Z = -1.0
PATH_RING = 220.0
PATH_SPOKE = 170.0
BUILDING_PAD = 320.0
TILE = PLAZA / 10.0
PAVE_SEGMENTS = 10


def log(msg: str) -> None:
    print(msg, flush=True)


def extra_args() -> list[str]:
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1 :]
    return []


def srgb_to_linear(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_rgba(code: str) -> tuple[float, float, float, float]:
    raw = code.lstrip("#")
    rgb = [int(raw[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return (
        srgb_to_linear(rgb[0]),
        srgb_to_linear(rgb[1]),
        srgb_to_linear(rgb[2]),
        1.0,
    )


TILE_LIGHT = hex_rgba("a3aec2")
TILE_DARK = hex_rgba("707b92")
SOIL = hex_rgba("2e3a16")
ROCK_CONCRETE = hex_rgba("3a3f4d")
ROCK_BROWN = hex_rgba("5c4426")


def plant_names() -> set[str]:
    return {row[0] for row in PLANTS}


def dist_outside_square(x: float, y: float, half: float) -> float:
    dx = abs(x) - half
    dy = abs(y) - half
    if dx <= 0.0 and dy <= 0.0:
        return 0.0
    if dx <= 0.0:
        return dy
    if dy <= 0.0:
        return dx
    return math.hypot(dx, dy)


def inside_square(x: float, y: float, half: float, margin: float = 0.0) -> bool:
    return abs(x) <= half + margin and abs(y) <= half + margin


def ensure_color_attribute(mesh: bpy.types.Mesh) -> None:
    existing = mesh.color_attributes.get("Color")
    if existing is not None:
        mesh.color_attributes.remove(existing)
    mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    idx = mesh.color_attributes.find("Color")
    if idx < 0:
        raise RuntimeError("Color attribute missing after create")
    mesh.color_attributes.active_color_index = idx


def paint_loops(ob: bpy.types.Object, color_at: object) -> dict[str, int]:
    mesh = ob.data
    ensure_color_attribute(mesh)
    attr = mesh.color_attributes.get("Color")
    if attr is None:
        raise RuntimeError(f"{ob.name} missing Color attribute")
    mw = ob.matrix_world
    counts: dict[str, int] = {}
    for poly in mesh.polygons:
        center = mw @ poly.center
        rgba, key = color_at(center, poly)
        counts[key] = counts.get(key, 0) + 1
        color = (rgba[0], rgba[1], rgba[2], rgba[3])
        for loop_index in poly.loop_indices:
            attr.data[loop_index].color = color
        poly.use_smooth = False
    mesh.update()
    first = tuple(round(v, 4) for v in attr.data[0].color)
    log(f"{ob.name} Color[0]={first} loops={len(attr.data)}")
    if first[1] > 0.9 and first[0] < 0.1 and first[2] < 0.1:
        raise RuntimeError(f"{ob.name} Color looks like a normal {first}, not albedo")
    return counts


def ensure_vertex_material() -> bpy.types.Material:
    mat = bpy.data.materials.get("IslandVertex")
    if mat is None:
        mat = bpy.data.materials.new("IslandVertex")
    mat.use_nodes = True
    tree = mat.node_tree
    if tree is None:
        raise RuntimeError("IslandVertex has no node tree")
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (360, 0)
    bsdf = tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (80, 0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.85
    try:
        color_node = tree.nodes.new("ShaderNodeVertexColor")
    except RuntimeError:
        color_node = tree.nodes.new("ShaderNodeAttribute")
        color_node.attribute_name = "Color"
    else:
        if hasattr(color_node, "layer_name"):
            color_node.layer_name = "Color"
    color_node.location = (-220, 0)
    color_out = color_node.outputs.get("Color")
    if color_out is None:
        color_out = color_node.outputs[0]
    tree.links.new(color_out, bsdf.inputs["Base Color"])
    tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def assign_only(ob: bpy.types.Object, mat: bpy.types.Material) -> None:
    mesh = ob.data
    while mesh.materials:
        mesh.materials.pop(index=0)
    mesh.materials.append(mat)


def remove_object(name: str) -> None:
    ob = bpy.data.objects.get(name)
    if ob is None:
        return
    mesh = ob.data if ob.type == "MESH" else None
    bpy.data.objects.remove(ob, do_unlink=True)
    if mesh is not None and mesh.users == 0:
        bpy.data.meshes.remove(mesh)


def ring_plants() -> list[Vector]:
    names = plant_names()
    out: list[Vector] = []
    for ob in bpy.data.objects:
        if ob.name not in names:
            continue
        pos = ob.matrix_world.translation
        if inside_square(pos.x, pos.y, HALF):
            continue
        out.append(Vector((pos.x, pos.y, 0.0)))
    return out


def on_spoke(c: Vector, plants: list[Vector]) -> bool:
    radius = math.hypot(c.x, c.y)
    half_w = PATH_SPOKE * 0.5
    for plant in plants:
        br = math.hypot(plant.x, plant.y)
        if br < 1.0:
            continue
        if radius < HALF - 20.0 or radius > br + 90.0:
            continue
        perp = abs(c.x * plant.y - c.y * plant.x) / br
        along = (c.x * plant.x + c.y * plant.y) / br
        if along > HALF - 40.0 and perp <= half_w:
            return True
        if math.hypot(c.x - plant.x, c.y - plant.y) <= BUILDING_PAD:
            return True
    return False


def is_plaza_wall(c: Vector) -> bool:
    if c.z < -DROP - 8.0 or c.z > 8.0:
        return False
    on_x = abs(abs(c.x) - HALF) < 12.0 and abs(c.y) <= HALF + 12.0
    on_y = abs(abs(c.y) - HALF) < 12.0 and abs(c.x) <= HALF + 12.0
    return on_x or on_y


def island_color(c: Vector, _face: bmesh.types.BMFace, plants: list[Vector]) -> tuple[tuple[float, float, float, float], str]:
    if is_plaza_wall(c):
        return ROCK_CONCRETE, "wall"
    if inside_square(c.x, c.y, HALF - 0.5) and c.z < -100.0:
        return TILE_DARK, "plaza_floor"
    if c.z < TOP_Z:
        if c.z > -400.0:
            return ROCK_CONCRETE, "cliff_upper"
        return ROCK_BROWN, "cliff"
    dist = dist_outside_square(c.x, c.y, HALF)
    if 0.0 < dist <= PATH_RING:
        return TILE_DARK, "path_ring"
    if on_spoke(c, plants):
        return TILE_DARK, "path_spoke"
    return SOIL, "soil"


def paving_color(c: Vector, _face: bmesh.types.BMFace) -> tuple[tuple[float, float, float, float], str]:
    ix = int(math.floor((c.x + HALF) / TILE))
    iy = int(math.floor((c.y + HALF) / TILE))
    if (ix + iy) % 2 == 0:
        return TILE_LIGHT, "tile_light"
    return TILE_DARK, "tile_dark"


def make_paving() -> bpy.types.Object:
    remove_object("PlazaPaving")
    mesh = bpy.data.meshes.new("PlazaPaving")
    bm = bmesh.new()
    bmesh.ops.create_grid(
        bm, x_segments=PAVE_SEGMENTS, y_segments=PAVE_SEGMENTS, size=HALF
    )
    bm.to_mesh(mesh)
    bm.free()
    for vert in mesh.vertices:
        vert.co.z = PAVE_Z
    ob = bpy.data.objects.new("PlazaPaving", mesh)
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    scene.collection.objects.link(ob)
    ob.location = Vector((0.0, 0.0, 0.0))
    ob.rotation_euler = (0.0, 0.0, 0.0)
    ob.scale = (1.0, 1.0, 1.0)
    return ob


def parent_keep(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def measure(island: bpy.types.Object, paving: bpy.types.Object) -> None:
    mw = paving.matrix_world
    pts = [mw @ v.co for v in paving.data.vertices]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    span_x = max(xs) - min(xs)
    span_y = max(ys) - min(ys)
    log(
        f"paving AABB xy {min(xs):.1f}..{max(xs):.1f} / {min(ys):.1f}..{max(ys):.1f} "
        f"z {min(zs):.3f}..{max(zs):.3f} faces {len(paving.data.polygons)}"
    )
    if abs(span_x - PLAZA) > 20.0 or abs(span_y - PLAZA) > 20.0:
        raise RuntimeError(f"paving span {span_x:.1f}x{span_y:.1f}, expected {PLAZA:.0f}")
    if abs(min(zs) - PAVE_Z) > 1.0:
        raise RuntimeError(f"paving z {min(zs):.3f}, expected {PAVE_Z:.3f}")
    mats = {slot.name for slot in island.data.materials if slot is not None}
    mats |= {slot.name for slot in paving.data.materials if slot is not None}
    log(f"earth materials {sorted(mats)}")
    if mats != {"IslandVertex"}:
        raise RuntimeError(f"earth materials {mats}, expected IslandVertex only")


def main() -> None:
    args = extra_args()
    if not os.path.isfile(BLEND):
        raise RuntimeError(f"missing {BLEND}")
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    island = bpy.data.objects.get("Island")
    if island is None or island.type != "MESH":
        raise RuntimeError("Island mesh missing")
    mat = ensure_vertex_material()
    plants = ring_plants()
    log(f"ring plants {len(plants)}")
    island_counts = paint_loops(
        island, lambda c, f: island_color(c, f, plants)
    )
    assign_only(island, mat)
    paving = make_paving()
    paving_counts = paint_loops(paving, paving_color)
    assign_only(paving, mat)
    parent_keep(paving, island)
    log("island faces " + ", ".join(f"{k}={v}" for k, v in sorted(island_counts.items())))
    log("paving faces " + ", ".join(f"{k}={v}" for k, v in sorted(paving_counts.items())))
    soil = island_counts.get("soil", 0)
    paths = island_counts.get("path_ring", 0) + island_counts.get("path_spoke", 0)
    if soil < 80:
        raise RuntimeError(f"soil faces {soil}: ring painted as one grey disk")
    if paths < 40:
        raise RuntimeError(f"path faces {paths}: spokes/ring missing")
    if paving_counts.get("tile_light", 0) < 40 or paving_counts.get("tile_dark", 0) < 40:
        raise RuntimeError(f"checker broken: {paving_counts}")
    measure(island, paving)
    if "--dry-run" in args:
        log("dry-run, not saving")
        return
    bpy.ops.wm.save_mainfile()
    log(f"saved {BLEND}")


if __name__ == "__main__":
    main()
