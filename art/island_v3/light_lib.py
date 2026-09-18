"""I4 sky, emission, and chunky cloud meshes.

Kit clouds come from Tree Assets (Ben Desai) via kit_lib.
Does not wipe I3 decor. Does not run the planter.
"""

from __future__ import annotations

import bmesh
import bpy
from mathutils import Vector

from decor_lib import (
    CLOUD_CAP,
    CLOUD_WHITE,
    add_box,
    finish_object,
    mesh_from_bm,
    paint_local,
    tri_count,
)
from kit_lib import make_cloud_kit_prototypes
from paint_ground import (
    assign_only,
    ensure_color_attribute,
    hex_rgba,
    log,
)

SKY_LOW = hex_rgba("6fb4f0")
SKY_HIGH = hex_rgba("aadcff")
AMBER = hex_rgba("ffc857")
NVIDIA = hex_rgba("2fa348")
TESLA = hex_rgba("c9333c")
AMAZON = hex_rgba("e8a52c")
SIGN_STRENGTH = 28.0
WINDOW_STRENGTH = 16.0
LAMP_STRENGTH = 22.0
DOME_SCALE = 30000.0

SIGN_BRANDS: tuple[tuple[str, str, tuple[float, float, float, float]], ...] = (
    ("CityHall", "hall", AMBER),
    ("NvidiaTower", "nvidia", NVIDIA),
    ("Tesla", "tesla", TESLA),
    ("Amazon", "amazon", AMAZON),
)


def socket_in(node: bpy.types.Node, *names: str) -> bpy.types.NodeSocket:
    for name in names:
        sock = node.inputs.get(name)
        if sock is not None:
            return sock
    raise RuntimeError(f"{node.bl_idname} missing sockets {names}")


def ensure_unlit_vertex_material() -> bpy.types.Material:
    mat = bpy.data.materials.get("IslandUnlit")
    if mat is None:
        mat = bpy.data.materials.new("IslandUnlit")
    mat.use_nodes = True
    tree = mat.node_tree
    if tree is None:
        raise RuntimeError("IslandUnlit has no node tree")
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (520, 0)
    bsdf = tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (160, 0)
    socket_in(bsdf, "Metallic").default_value = 0.0
    socket_in(bsdf, "Roughness").default_value = 1.0
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
    tree.links.new(color_out, socket_in(bsdf, "Base Color"))
    em_color = socket_in(bsdf, "Emission Color", "Emission")
    tree.links.new(color_out, em_color)
    strength_in = bsdf.inputs.get("Emission Strength")
    if strength_in is not None:
        strength_in.default_value = 1.0
    tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    mat.use_backface_culling = False
    return mat


def ensure_emit_material(
    name: str,
    rgba: tuple[float, float, float, float],
    strength: float,
) -> bpy.types.Material:
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    if tree is None:
        raise RuntimeError(f"{name} has no node tree")
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (400, 0)
    bsdf = tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (80, 0)
    socket_in(bsdf, "Base Color").default_value = (0.0, 0.0, 0.0, 1.0)
    socket_in(bsdf, "Metallic").default_value = 0.0
    socket_in(bsdf, "Roughness").default_value = 0.45
    em_color = socket_in(bsdf, "Emission Color", "Emission")
    em_color.default_value = rgba
    strength_in = bsdf.inputs.get("Emission Strength")
    if strength_in is not None:
        strength_in.default_value = strength
    tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    mat.use_backface_culling = False
    return mat


def make_sky_dome() -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    bm.faces.ensure_lookup_table()
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    mesh = mesh_from_bm("SkyDomeMesh", bm)
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    ob = bpy.data.objects.new("SkyDome", mesh)
    scene.collection.objects.link(ob)
    ob.location = Vector((0.0, 0.0, 0.0))
    ob.rotation_euler = (0.0, 0.0, 0.0)
    ob.scale = (DOME_SCALE, DOME_SCALE, DOME_SCALE)
    ob.parent = None

    def color_at(center: Vector, _poly: bpy.types.MeshPolygon) -> tuple[tuple[float, float, float, float], str]:
        t = max(0.0, min(1.0, (center.z + 1.0) * 0.5))
        rgba = (
            SKY_LOW[0] + (SKY_HIGH[0] - SKY_LOW[0]) * t,
            SKY_LOW[1] + (SKY_HIGH[1] - SKY_LOW[1]) * t,
            SKY_LOW[2] + (SKY_HIGH[2] - SKY_LOW[2]) * t,
            1.0,
        )
        return rgba, "sky"

    paint_local(ob, color_at)
    assign_only(ob, ensure_unlit_vertex_material())
    log(f"SkyDome tris={tri_count(ob.data)} scale={DOME_SCALE}")
    return ob


def _chunk_cloud(name: str, mesh_name: str, boxes: list[tuple[float, float, float, float, float, float]]) -> bpy.types.Object:
    bm = bmesh.new()
    for xmin, xmax, ymin, ymax, zmin, zmax in boxes:
        add_box(bm, xmin, xmax, ymin, ymax, zmin, zmax)
    ob = finish_object(name, mesh_from_bm(mesh_name, bm), CLOUD_CAP, True)
    paint_local(ob, lambda _c, _p: (CLOUD_WHITE, "cloud"))
    assign_only(ob, ensure_unlit_vertex_material())
    return ob


def make_chunk_clouds() -> dict[str, bpy.types.Object]:
    long_boxes = [
        (-48.0, 48.0, -16.0, 16.0, 0.0, 22.0),
        (-20.0, 64.0, -12.0, 14.0, 8.0, 30.0),
        (-70.0, -8.0, -14.0, 10.0, 4.0, 24.0),
        (-8.0, 28.0, -22.0, 4.0, 10.0, 26.0),
        (8.0, 40.0, 4.0, 20.0, 6.0, 20.0),
        (-36.0, 4.0, 6.0, 18.0, 12.0, 28.0),
        (-12.0, 18.0, -8.0, 8.0, 18.0, 34.0),
        (24.0, 52.0, -6.0, 10.0, 2.0, 16.0),
    ]
    puff_boxes = [
        (-28.0, 28.0, -24.0, 24.0, 0.0, 26.0),
        (-12.0, 36.0, -10.0, 20.0, 10.0, 36.0),
        (-40.0, 4.0, -16.0, 12.0, 6.0, 28.0),
        (-8.0, 16.0, -32.0, -4.0, 8.0, 24.0),
        (6.0, 30.0, 8.0, 28.0, 4.0, 22.0),
        (-22.0, 10.0, 10.0, 26.0, 14.0, 32.0),
        (-6.0, 14.0, -6.0, 10.0, 22.0, 40.0),
        (16.0, 34.0, -18.0, 2.0, 2.0, 18.0),
    ]
    return {
        "cloud_chunk_a": _chunk_cloud("d_cloud_chunk_a", "CloudChunkA", long_boxes),
        "cloud_chunk_b": _chunk_cloud("d_cloud_chunk_b", "CloudChunkB", puff_boxes),
    }


def make_cloud_prototypes() -> dict[str, bpy.types.Object]:
    out = make_cloud_kit_prototypes()
    for ob in out.values():
        assign_only(ob, ensure_unlit_vertex_material())
    out.update(make_chunk_clouds())
    if len(out) != 4:
        raise RuntimeError(f"need 4 cloud variants, got {list(out)}")
    return out


def make_sign_box(name: str, mesh_name: str, size: Vector) -> bpy.types.Object:
    bm = bmesh.new()
    hx, hy, hz = size.x * 0.5, size.y * 0.5, size.z * 0.5
    add_box(bm, -hx, hx, -hy, hy, -hz, hz)
    mesh = mesh_from_bm(mesh_name, bm)
    scene = bpy.context.scene
    if scene is None:
        raise RuntimeError("no scene")
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    return ob


def lamp_emission() -> None:
    lamps = [ob for ob in bpy.data.objects if ob.name.startswith("d_lamp_") and ob.type == "MESH"]
    if not lamps:
        raise RuntimeError("no lamp instances for emission")
    mesh = lamps[0].data
    emit = ensure_emit_material("LampEmit", AMBER, LAMP_STRENGTH)
    if emit.name not in mesh.materials:
        mesh.materials.append(emit)
    emit_index = list(mesh.materials).index(emit)
    attr = mesh.color_attributes.get("Color")
    if attr is None:
        raise RuntimeError("LampKit missing Color")
    lit = 0
    for poly in mesh.polygons:
        luma = 0.0
        for loop_index in poly.loop_indices:
            col = attr.data[loop_index].color
            luma += (col[0] + col[1] + col[2]) / 3.0
        luma /= max(1, len(poly.loop_indices))
        if luma >= 0.42:
            poly.material_index = emit_index
            lit += 1
    mesh.update()
    if lit < 1:
        raise RuntimeError("lamp emission assigned to 0 faces")
    log(f"LampEmit faces={lit}/{len(mesh.polygons)}")
