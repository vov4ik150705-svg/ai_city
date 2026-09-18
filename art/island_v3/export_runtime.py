"""Export thin runtime GLBs from the authoring blend.

LOOK-02 contract: mass from collections 00/10/30/40/50, buildings from
building_<slug> roots with identity root transform. Opens island.blend
read-only. Never calls save_mainfile / save_as_mainfile.
"""

from __future__ import annotations

import os
import sys

import bpy
from mathutils import Matrix

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from build_island import PLANTS  # noqa: E402

BLEND = os.path.join(ROOT, "island.blend")
RUNTIME = os.path.join(ROOT, "runtime")
BUILDINGS_DIR = os.path.join(RUNTIME, "buildings")
MASS_GLB = os.path.join(RUNTIME, "island_mass.glb")

MASS_COLLECTIONS: tuple[str, ...] = (
    "00_CanonMass",
    "10_Hardscape",
    "30_WorldDecor",
    "40_Sky",
    "50_Anchors",
)
SKIP_TYPES = {"CAMERA", "LIGHT"}
SKIP_NAMES = {"CamOrbit", "CamUnder", "Sun", "Fill", "Bounce"}
KEEP_TEX_SOCKETS = {"Base Color", "Emission Color", "Emission", "Alpha"}
TEXTURE_MAX_PX = 1024
FORBIDDEN_MASS_PREFIXES = ("building_", "body_", "sign_", "window_", "look02_")


def log(msg: str) -> None:
    print(msg, flush=True)


def enable_all_layer_collections() -> None:
    def rec(lc: bpy.types.LayerCollection) -> None:
        lc.exclude = False
        lc.hide_viewport = False
        for ch in lc.children:
            rec(ch)

    rec(bpy.context.view_layer.layer_collection)


def plant_slug(name: str) -> str:
    out: list[str] = []
    for i, ch in enumerate(name):
        if ch.isupper() and i > 0:
            out.append("_")
        out.append(ch.lower())
    return "".join(out)


def plant_slugs() -> dict[str, str]:
    return {row[0]: plant_slug(row[0]) for row in PLANTS}


def open_blend_readonly() -> None:
    if not os.path.isfile(BLEND):
        raise RuntimeError(f"missing {BLEND}")
    current = os.path.normcase(os.path.abspath(bpy.data.filepath or ""))
    want = os.path.normcase(os.path.abspath(BLEND))
    if current != want:
        bpy.ops.wm.open_mainfile(filepath=BLEND)
    log(f"opened {BLEND} (read-only, will not save)")


def select_only(obs: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    active = None
    for ob in obs:
        ob.hide_select = False
        for col in ob.users_collection:
            col.hide_select = False
        ob.hide_set(False)
        ob.hide_viewport = False
        ob.hide_render = False
        ob.select_set(True)
        active = ob
    if active is not None:
        bpy.context.view_layer.objects.active = active


def drop_extra_texture_links(ob: bpy.types.Object) -> None:
    if ob.type != "MESH":
        return
    for mat in ob.data.materials:
        if mat is None or mat.node_tree is None:
            continue
        for link in list(mat.node_tree.links):
            to_sock = link.to_socket.name if link.to_socket is not None else ""
            from_node = link.from_node
            if from_node is None or from_node.type != "TEX_IMAGE":
                continue
            if to_sock not in KEEP_TEX_SOCKETS:
                mat.node_tree.links.remove(link)


def scale_object_images(ob: bpy.types.Object, max_px: int) -> None:
    if ob.type != "MESH":
        return
    seen: set[int] = set()
    for mat in ob.data.materials:
        if mat is None or mat.node_tree is None:
            continue
        for node in mat.node_tree.nodes:
            if node.type != "TEX_IMAGE" or node.image is None:
                continue
            img = node.image
            key = img.as_pointer()
            if key in seen:
                continue
            seen.add(key)
            width, height = int(img.size[0]), int(img.size[1])
            if width <= max_px and height <= max_px:
                continue
            scale = max_px / max(width, height)
            img.scale(max(1, int(width * scale)), max(1, int(height * scale)))
            log(f"scaled {img.name} {width}x{height} -> {img.size[0]}x{img.size[1]}")


def thin_building_textures(ob: bpy.types.Object) -> None:
    drop_extra_texture_links(ob)
    scale_object_images(ob, TEXTURE_MAX_PX)


def export_selected(filepath: str) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    tmp = os.path.join(os.path.dirname(filepath), "_" + os.path.basename(filepath)[:-4] + ".exporttmp.glb")
    kwargs: dict[str, object] = {
        "filepath": tmp,
        "export_format": "GLB",
        "use_selection": True,
        "export_cameras": False,
        "export_lights": False,
    }
    optionals: list[tuple[str, object]] = [
        ("export_yup", True),
        ("export_gpu_instances", True),
        ("export_attributes", True),
        ("export_vertex_color", "MATERIAL"),
    ]
    extras = dict(optionals)
    last_error: TypeError | None = None
    try:
        while True:
            try:
                bpy.ops.export_scene.gltf(**kwargs, **extras)
                os.replace(tmp, filepath)
                log(f"wrote {filepath}")
                return
            except TypeError as exc:
                last_error = exc
                if not extras:
                    break
                dropped, _ = extras.popitem()
                log(f"export dropped {dropped}: {exc}")
        raise RuntimeError(f"gltf export failed for {filepath}: {last_error}")
    finally:
        if os.path.isfile(tmp) and os.path.normcase(tmp) != os.path.normcase(filepath):
            try:
                os.remove(tmp)
            except OSError:
                pass


def collection_objects(name: str) -> list[bpy.types.Object]:
    col = bpy.data.collections.get(name)
    if col is None:
        return []
    return list(col.objects)


def mass_objects() -> list[bpy.types.Object]:
    out: list[bpy.types.Object] = []
    seen: set[int] = set()
    for col_name in MASS_COLLECTIONS:
        for ob in collection_objects(col_name):
            key = ob.as_pointer()
            if key in seen:
                continue
            if ob.type in SKIP_TYPES or ob.name in SKIP_NAMES:
                continue
            if ob.name.startswith(FORBIDDEN_MASS_PREFIXES):
                raise RuntimeError(f"mass collection {col_name} contains {ob.name}")
            seen.add(key)
            out.append(ob)
    if not any(ob.name == "Island" for ob in out):
        raise RuntimeError("Island mesh missing from mass export set")
    anchors = [ob for ob in out if ob.name.startswith("anchor_")]
    if len(anchors) != 26:
        raise RuntimeError(f"mass export anchors {len(anchors)} != 26")
    empty_anchors = [ob.name for ob in anchors if ob.type != "EMPTY"]
    if empty_anchors:
        raise RuntimeError(f"anchor is not EMPTY: {empty_anchors[:4]}")
    return out


def walk_tree(root: bpy.types.Object) -> list[bpy.types.Object]:
    out = [root]
    stack = [root]
    while stack:
        ob = stack.pop()
        for ch in ob.children:
            out.append(ch)
            stack.append(ch)
    return out


def evaluated_world_matrix(ob: bpy.types.Object) -> Matrix:
    chain: list[bpy.types.Object] = []
    cur: bpy.types.Object | None = ob
    while cur is not None:
        chain.append(cur)
        cur = cur.parent
    mw = Matrix.Identity(4)
    for node in reversed(chain):
        if node.parent is None:
            mw = node.matrix_basis.copy()
        else:
            mw = mw @ node.matrix_parent_inverse @ node.matrix_basis
    return mw


def apply_matrix_basis(ob: bpy.types.Object, mat: Matrix) -> None:
    loc, rot, scale = mat.decompose()
    ob.location = loc
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = rot
    ob.scale = scale


def export_mass() -> None:
    obs = mass_objects()
    log("mass objects: " + ", ".join(ob.name for ob in obs))
    select_only(obs)
    export_selected(MASS_GLB)


def identity_export(root: bpy.types.Object, filepath: str) -> None:
    tree = walk_tree(root)
    saved: list[dict[str, object]] = []
    for ob in tree:
        saved.append(
            {
                "ob": ob,
                "parent": ob.parent,
                "pinv": ob.matrix_parent_inverse.copy(),
                "loc": ob.location.copy(),
                "rot_mode": ob.rotation_mode,
                "rot_e": tuple(ob.rotation_euler),
                "rot_q": ob.rotation_quaternion.copy(),
                "scale": ob.scale.copy(),
            }
        )
    worlds = {ob: evaluated_world_matrix(ob).copy() for ob in tree}
    root_inv = worlds[root].inverted()
    mesh_xforms: list[tuple[bpy.types.Mesh, Matrix]] = []
    seen: set[int] = set()
    for ob in tree:
        if ob.type != "MESH" or ob.data is None:
            continue
        key = ob.data.as_pointer()
        if key in seen:
            raise RuntimeError(f"shared mesh on {ob.name}")
        seen.add(key)
        local = root_inv @ worlds[ob]
        ob.data.transform(local)
        mesh_xforms.append((ob.data, local))
    parents = {ob: ob.parent for ob in tree}
    for ob in tree:
        ob.parent = None
        ob.matrix_parent_inverse.identity()
    apply_matrix_basis(root, Matrix.Identity(4))
    for ob in tree:
        if ob is root:
            continue
        apply_matrix_basis(ob, Matrix.Identity(4))
        par = parents[ob]
        ob.parent = root if par is not None else None
        ob.matrix_parent_inverse.identity()
    bpy.context.view_layer.update()
    try:
        for ob in tree:
            thin_building_textures(ob)
        select_only(tree)
        export_selected(filepath)
    finally:
        for mesh, local in reversed(mesh_xforms):
            mesh.transform(local.inverted())
        for rec in saved:
            ob = rec["ob"]
            if not isinstance(ob, bpy.types.Object):
                continue
            ob.parent = None
            ob.matrix_parent_inverse.identity()
        for rec in saved:
            ob = rec["ob"]
            if not isinstance(ob, bpy.types.Object):
                continue
            ob.rotation_mode = rec["rot_mode"]
            ob.location = rec["loc"]
            ob.rotation_euler = rec["rot_e"]
            ob.rotation_quaternion = rec["rot_q"]
            ob.scale = rec["scale"]
        for rec in saved:
            ob = rec["ob"]
            if not isinstance(ob, bpy.types.Object):
                continue
            par = rec["parent"]
            ob.parent = par if isinstance(par, bpy.types.Object) else None
            ob.matrix_parent_inverse = rec["pinv"]
        bpy.context.view_layer.update()


def export_buildings() -> None:
    slugs = plant_slugs()
    os.makedirs(BUILDINGS_DIR, exist_ok=True)
    missing: list[str] = []
    for _plant, slug in slugs.items():
        root = bpy.data.objects.get(f"building_{slug}")
        if root is None:
            missing.append(slug)
            continue
        dest = os.path.join(BUILDINGS_DIR, f"{slug}.glb")
        identity_export(root, dest)
    if missing:
        raise RuntimeError(f"missing building roots: {missing}")


def extra_args() -> list[str]:
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1 :]
    return []


def main() -> None:
    args = extra_args()
    mass_only = "--mass-only" in args
    buildings_only = "--buildings-only" in args
    open_blend_readonly()
    enable_all_layer_collections()
    island = bpy.data.objects.get("Island")
    if island is None:
        raise RuntimeError("no Island object in blend")
    slugs = plant_slugs()
    missing = [slug for slug in slugs.values() if bpy.data.objects.get(f"building_{slug}") is None]
    if missing:
        raise RuntimeError(f"blend missing building roots: {missing}")
    if buildings_only:
        export_buildings()
    else:
        export_mass()
        if not mass_only:
            export_buildings()
    log("export_runtime done; blend not saved")


if __name__ == "__main__":
    main()
