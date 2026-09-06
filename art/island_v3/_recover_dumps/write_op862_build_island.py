"""Plant every GLB from repo models/ onto the live 7200 m island mesh.

Does not regenerate the hull. Opens island.blend, strips old buildings, plants,
yaws 45 deg to match the island, then exports.
"""

from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(ROOT))
MODELS = os.path.join(REPO, "models")
OUT_BLEND = os.path.join(ROOT, "island.blend")
OUT_GLB = os.path.join(ROOT, "island.glb")
OUT_PREVIEW = os.path.join(ROOT, "preview_orbit.png")
OUT_UNDER = os.path.join(ROOT, "preview_under.png")
PLAZA_Z = 0.06
ISLAND_SCALE = 10.0
BUILDING_SCALE = 4.0
HALL_HEIGHT = 280.0 * BUILDING_SCALE
MSFT_HEIGHT = 230.0 * BUILDING_SCALE
DISTRICT_SPAN = 140.0 * BUILDING_SCALE
YARD_SPAN = 170.0 * BUILDING_SCALE
ARCH_SPAN = 160.0 * BUILDING_SCALE
BANK_SPAN = 130.0 * BUILDING_SCALE

# (name, filename, unscaled_x, unscaled_y, height|None, span|None)
PLANTS: tuple[tuple[str, str, float, float, float | None, float | None], ...] = (
    ("CityHall", "city_hall_0904163823_texture.glb", 0.0, 8.0, HALL_HEIGHT, None),
    ("Tesla", "tesla_building_red_qu_0904132734_texture.glb", -200.0, 190.0, None, DISTRICT_SPAN),
    ("Apple", "Apple_Store_Building__0904122206_texture.glb", 190.0, 190.0, None, DISTRICT_SPAN),
    ("Coinbase", "Coinbase_Archway_Quad_0904174803_texture.glb", -250.0, 10.0, None, ARCH_SPAN),
    ("Microsoft", "microsoft_building_qu_0904171619_texture.glb", 250.0, 10.0, MSFT_HEIGHT, None),
    ("Bank", "bank_building_qu_0904155916_texture.glb", -190.0, -190.0, None, BANK_SPAN),
    ("Amazon", "amazon_building_0904183325_texture.glb", 190.0, -190.0, None, DISTRICT_SPAN),
    ("FleetYard", "fleet_yard_Q_0904132541_texture.glb", 10.0, -250.0, None, YARD_SPAN),
    ("NvidiaDepot", "NVIDIA_Amazon_Depot_Q_0904222124_texture.glb", 0.0, 245.0, None, DISTRICT_SPAN),
    ("Workshop", "workshop_building_qua_0906031738_texture.glb", 245.0, -120.0, None, BANK_SPAN),
    ("PowerNode", "Power_Node_Device_Qua_0905063753_texture.glb", -300.0, -90.0, None, BANK_SPAN),
    ("AmazonWarehouse", "Amazon_warehouse_Buil_0905061632_texture.glb", 280.0, -280.0, None, DISTRICT_SPAN),
    ("AgentHub", "Agent_Hub_0906001529_texture.glb", 90.0, -90.0, None, BANK_SPAN),
    ("Clearinghouse", "clearinghouse_0906002912_texture.glb", -280.0, -260.0, None, DISTRICT_SPAN),
    (
        "DataCenter",
        "data_center_Buil_0905182303_texture (1).glb",
        90.0,
        280.0,
        None,
        DISTRICT_SPAN,
    ),
    ("Exchange", "Exchange_Building_Nav_0905175315_texture.glb", -310.0, 180.0, None, DISTRICT_SPAN),
    ("NvidiaTower", "nvidia_tower_0906011341_texture.glb", 140.0, 250.0, MSFT_HEIGHT, None),
    ("RoboticLab", "robotic_lab_0905215549_texture.glb", 280.0, 90.0, None, DISTRICT_SPAN),
)


def log(msg: str) -> None:
    print(msg, flush=True)


def _ixy(x: float, y: float) -> tuple[float, float]:
    return (x * ISLAND_SCALE, y * ISLAND_SCALE)


def _world_bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def import_glb(path: str, name: str) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"no mesh in {path}")
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    assert ob is not None
    ob.name = name
    for o in new:
        if o != ob and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    log(f"imported {name} verts {len(ob.data.vertices)}")
    return ob


def place_on_plaza(
    ob: bpy.types.Object,
    xy: tuple[float, float],
    yaw: float,
    *,
    target_height: float | None = None,
    target_span: float | None = None,
) -> None:
    lo, hi = _world_bounds(ob)
    height = hi.z - lo.z
    span = max(hi.x - lo.x, hi.y - lo.y)
    if target_height is not None:
        s = target_height / max(height, 1e-6)
    elif target_span is not None:
        s = target_span / max(span, 1e-6)
    else:
        s = 1.0
    ob.scale = (s, s, s)
    ob.rotation_euler.z = yaw
    bpy.context.view_layer.update()
    lo, hi = _world_bounds(ob)
    cx = 0.5 * (lo.x + hi.x)
    cy = 0.5 * (lo.y + hi.y)
    ob.location.x += xy[0] - cx
    ob.location.y += xy[1] - cy
    ob.location.z += PLAZA_Z - lo.z
    bpy.context.view_layer.update()
    lo, hi = _world_bounds(ob)
    log(
        f"{ob.name} xy {lo.x:.1f}..{hi.x:.1f} / {lo.y:.1f}..{hi.y:.1f} "
        f"z {lo.z:.1f}..{hi.z:.1f}"
    )


def yaw_objects(obs: list[bpy.types.Object], angle: float) -> None:
    c, s = math.cos(angle), math.sin(angle)
    for ob in obs:
        x, y, z = ob.location
        ob.location = (x * c - y * s, x * s + y * c, z)
        ob.rotation_euler.z += angle


def export_meshes(obs: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for ob in obs:
        if ob.type != "MESH":
            continue
        for mat in ob.data.materials:
            if mat is not None:
                mat.use_backface_culling = False
                mat.blend_method = "OPAQUE"
        ob.hide_set(False)
        ob.hide_viewport = False
        ob.select_set(True)
    kwargs = dict(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
    )
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="MATERIAL", export_attributes=True, **kwargs)
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    log(f"wrote {OUT_GLB}")


def plant(
    name: str,
    file: str,
    x: float,
    y: float,
    height: float | None,
    span: float | None,
) -> bpy.types.Object:
    path = os.path.join(MODELS, file)
    if not os.path.isfile(path):
        raise RuntimeError(f"missing {path}")
    ob = import_glb(path, name)
    yaw = 0.0 if (x == 0.0 and y == 0.0) else math.atan2(x, y)
    place_on_plaza(ob, _ixy(x, y), yaw, target_height=height, target_span=span)
    return ob


def main() -> None:
    if not os.path.isfile(OUT_BLEND):
        raise RuntimeError(f"missing {OUT_BLEND}")
    on_disk = {n for n in os.listdir(MODELS) if n.lower().endswith(".glb")}
    planned = {row[1] for row in PLANTS}
    if on_disk != planned:
        raise RuntimeError(f"models mismatch extra={on_disk - planned} missing={planned - on_disk}")
    bpy.ops.wm.open_mainfile(filepath=OUT_BLEND)
    island = bpy.data.objects.get("Island")
    if island is None:
        raise RuntimeError("no Island object in blend")
    for ob in list(bpy.data.objects):
        if ob.type == "MESH" and ob.name != "Island":
            bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.orphans_purge(do_recursive=True)
    buildings = [plant(*row) for row in PLANTS]
    yaw_objects(buildings, math.radians(45.0))
    orbit = bpy.data.objects.get("CamOrbit")
    under = bpy.data.objects.get("CamUnder")
    if orbit is None or under is None:
        raise RuntimeError("missing CamOrbit/CamUnder")
    sc = bpy.context.scene
    sc.camera = orbit
    sc.render.filepath = OUT_PREVIEW
    bpy.ops.render.render(write_still=True)
    sc.camera = under
    sc.render.filepath = OUT_UNDER
    bpy.ops.render.render(write_still=True)
    export_meshes([island, *buildings])
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    log(f"planted {len(buildings)} buildings")


if __name__ == "__main__":
    main()
