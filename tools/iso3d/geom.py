"""Shared primitives for the isometric Blender factory. Data API only — bpy.ops
mesh add fails after the first render in background mode."""
from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Euler, Vector


def _link(ob: bpy.types.Object) -> bpy.types.Object:
    col = bpy.context.scene.collection
    if ob.name not in col.objects:
        col.objects.link(ob)
    return ob


def mat(
    name: str,
    color: tuple[float, float, float],
    *,
    rough: float = 0.55,
    emit: float = 0.0,
    metal: float = 0.0,
    wear: float = 0.0,
) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    assert nt is not None
    bsdf = nt.nodes.get("Principled BSDF")
    assert bsdf is not None
    links = nt.links
    bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.18
    if emit > 0.0:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit
    if wear <= 0.0:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        return m
    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 14.0
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.55
    links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (
        max(0.0, color[0] * 0.55),
        max(0.0, color[1] * 0.48),
        max(0.0, color[2] * 0.42),
        1.0,
    )
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (*color, 1.0)
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    r_noise = nt.nodes.new("ShaderNodeMath")
    r_noise.operation = "MULTIPLY_ADD"
    r_noise.inputs[1].default_value = 0.25
    r_noise.inputs[2].default_value = rough
    links.new(noise.outputs["Fac"], r_noise.inputs[0])
    links.new(r_noise.outputs["Value"], bsdf.inputs["Roughness"])
    return m


def _assign(ob: bpy.types.Object, material: bpy.types.Material, bevel: float) -> bpy.types.Object:
    ob.data.materials.append(material)
    if bevel > 0:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    return ob


def box(
    name: str,
    cx: float,
    cy: float,
    cz: float,
    sx: float,
    sy: float,
    sz: float,
    material: bpy.types.Material,
    *,
    bevel: float = 0.04,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((sx, sy, sz)), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    ob.location = (cx, cy, cz)
    return _assign(_link(ob), material, bevel)


def cyl(
    name: str,
    cx: float,
    cy: float,
    cz: float,
    r: float,
    depth: float,
    material: bpy.types.Material,
    *,
    axis: str = "Z",
    verts: int = 16,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=verts,
        radius1=r,
        radius2=r,
        depth=depth,
    )
    if axis == "X":
        bmesh.ops.rotate(
            bm,
            verts=bm.verts,
            cent=Vector((0.0, 0.0, 0.0)),
            matrix=Euler((0.0, math.pi / 2, 0.0)).to_matrix(),
        )
    elif axis == "Y":
        bmesh.ops.rotate(
            bm,
            verts=bm.verts,
            cent=Vector((0.0, 0.0, 0.0)),
            matrix=Euler((math.pi / 2, 0.0, 0.0)).to_matrix(),
        )
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    ob.location = (cx, cy, cz)
    return _assign(_link(ob), material, 0.0)


def hip_roof(
    name: str,
    cx: float,
    cy: float,
    z_bottom: float,
    width: float,
    depth: float,
    height: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    radius = math.sqrt((width * 0.5) ** 2 + (depth * 0.5) ** 2)
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=4,
        radius1=radius,
        radius2=max(0.04, radius * 0.04),
        depth=height,
    )
    bmesh.ops.rotate(
        bm,
        verts=bm.verts,
        cent=Vector((0.0, 0.0, 0.0)),
        matrix=Euler((0.0, 0.0, math.pi / 4)).to_matrix(),
    )
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    ob.location = (cx, cy, z_bottom + height * 0.5)
    return _assign(_link(ob), material, 0.0)


def torus_c(
    name: str,
    cx: float,
    cy: float,
    cz: float,
    major: float,
    minor: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Blocky C: three boxes. Boolean torus needs ops context we don't have."""
    box(f"{name}_top", cx, cy, cz + major * 0.72, major * 1.35, minor * 1.6, minor * 1.7, material, bevel=0.02)
    box(f"{name}_bot", cx, cy, cz - major * 0.72, major * 1.35, minor * 1.6, minor * 1.7, material, bevel=0.02)
    box(f"{name}_back", cx - major * 0.55, cy, cz, minor * 1.7, minor * 1.6, major * 1.55, material, bevel=0.02)
    dummy = bpy.data.objects.new(name, None)
    dummy.location = (cx, cy, cz)
    return _link(dummy)


def windows_y(
    prefix: str,
    xs: list[float],
    y: float,
    zs: list[float],
    sx: float,
    sy: float,
    sz: float,
    material: bpy.types.Material,
) -> None:
    n = 0
    for x in xs:
        for z in zs:
            box(f"{prefix}_{n}", x, y, z, sx, sy, sz, material, bevel=0.0)
            n += 1


def windows_x(
    prefix: str,
    x: float,
    ys: list[float],
    zs: list[float],
    sx: float,
    sy: float,
    sz: float,
    material: bpy.types.Material,
) -> None:
    n = 0
    for y in ys:
        for z in zs:
            box(f"{prefix}_{n}", x, y, z, sx, sy, sz, material, bevel=0.0)
            n += 1
