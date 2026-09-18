"""Close I4 / I6 / landform triangle gates on runtime island_mass.glb.

Does not touch island.blend, models/*.glb, contracts, or pack/out.
Uses diet_runtime.py helpers and the pinned gltf-transform CLI.
"""

from __future__ import annotations

import copy
import os
import shutil
import sys
import tempfile
from pathlib import Path

from diet_runtime import (  # noqa: E402
    BUILDINGS,
    MASS,
    RUNTIME,
    gltf_transform,
    log,
    read_glb,
    triangle_count,
    write_glb,
)

CLIFF = 3100.0
LANDFORM = "look04_landform"
ISLAND = "Island"
CLOUD_MESHES = ("CloudKitA", "CloudKitB", "CloudChunkA", "CloudChunkB")
# Near-white family tints so gltf-transform dedup cannot merge the four
# I4 cloud unlit materials back into IslandUnlit. Kit = cooler, chunk = warmer.
CLOUD_EMIT: tuple[tuple[str, str, list[float], float], ...] = (
    ("CloudUnlit_kit_a", "cloud_kit_a", [1.00, 1.00, 1.00], 1.00),
    ("CloudUnlit_kit_b", "cloud_kit_b", [0.94, 0.97, 1.00], 0.98),
    ("CloudUnlit_chunk_a", "cloud_chunk_a", [1.00, 0.98, 0.94], 0.96),
    ("CloudUnlit_chunk_b", "cloud_chunk_b", [0.96, 1.00, 0.98], 0.94),
)
SKY_MESH = "SkyDomeMesh"
UNLIT = "IslandUnlit"
ISLAND_TRIS_MAX = 250_000
ISLAND_KEEP = 4188  # authored Island mesh; do not simplify


def mesh_index(doc: dict, name: str) -> int:
    for i, mesh in enumerate(doc.get("meshes") or []):
        if isinstance(mesh, dict) and mesh.get("name") == name:
            return i
    raise RuntimeError(f"missing mesh {name}")


def mesh_tris_named(path: Path, name: str) -> int:
    doc, _ = read_glb(path)
    accessors = list(doc.get("accessors") or [])
    idx = mesh_index(doc, name)
    mesh = doc["meshes"][idx]
    total = 0
    for prim in mesh.get("primitives") or []:
        if not isinstance(prim, dict):
            continue
        mode = int(prim.get("mode", 4))
        indices = prim.get("indices")
        count = 0
        if isinstance(indices, int) and 0 <= indices < len(accessors):
            acc = accessors[indices]
            if isinstance(acc, dict):
                count = int(acc.get("count") or 0)
        if mode == 4:
            total += count // 3
        elif mode in (5, 6):
            total += max(count - 2, 0)
        else:
            raise RuntimeError(f"{name}: mode {mode}")
    return total


def building_tris() -> int:
    return sum(triangle_count(p) for p in sorted(BUILDINGS.glob("*.glb")))


def clone_unlit(src: dict, name: str, family: str, emit: list[float], rough: float) -> dict:
    mat = copy.deepcopy(src)
    mat["name"] = name
    mat["emissiveFactor"] = list(emit)
    pbr = mat.get("pbrMetallicRoughness")
    if not isinstance(pbr, dict):
        pbr = {}
        mat["pbrMetallicRoughness"] = pbr
    pbr["metallicFactor"] = 0
    pbr["roughnessFactor"] = rough
    extras = mat.get("extras") if isinstance(mat.get("extras"), dict) else {}
    extras["i4_cloud_family"] = family
    mat["extras"] = extras
    return mat


def apply_i4_cloud_unlit(path: Path) -> int:
    """Four I4 cloud families get their own unlit emissive materials.

    LOOK-06 forbids building sign/window children on mass. I4 still requires
    four emissive mass materials. Clouds already use IslandUnlit emission
    (light_lib.ensure_unlit_vertex_material). Splitting that authored unlit
    path per GPU cloud family does not add dummy unused materials.
    """
    doc, blob = read_glb(path)
    mats = list(doc.get("materials") or [])
    unlit_i = None
    unlit = None
    for i, mat in enumerate(mats):
        if isinstance(mat, dict) and mat.get("name") == UNLIT:
            unlit_i = i
            unlit = mat
            break
    if unlit is None or unlit_i is None:
        raise RuntimeError("IslandUnlit missing")
    if not isinstance(unlit.get("emissiveFactor"), list) or not any(
        float(v) > 0.0 for v in unlit["emissiveFactor"][:3]
    ):
        unlit["emissiveFactor"] = [1.0, 1.0, 1.0]
    existing = {m.get("name"): i for i, m in enumerate(mats) if isinstance(m, dict)}
    assigned: list[int] = []
    for name, family, emit, rough in CLOUD_EMIT:
        if name in existing:
            idx = existing[name]
            mat = mats[idx]
            if isinstance(mat, dict):
                mat["emissiveFactor"] = list(emit)
                pbr = mat.get("pbrMetallicRoughness")
                if not isinstance(pbr, dict):
                    pbr = {}
                    mat["pbrMetallicRoughness"] = pbr
                pbr["metallicFactor"] = 0
                pbr["roughnessFactor"] = rough
                extras = mat.get("extras") if isinstance(mat.get("extras"), dict) else {}
                extras["i4_cloud_family"] = family
                mat["extras"] = extras
            assigned.append(idx)
            continue
        mats.append(clone_unlit(unlit, name, family, emit, rough))
        assigned.append(len(mats) - 1)
    doc["materials"] = mats
    for mesh_name, mi in zip(CLOUD_MESHES, assigned, strict=True):
        mesh = doc["meshes"][mesh_index(doc, mesh_name)]
        for prim in mesh.get("primitives") or []:
            if isinstance(prim, dict):
                prim["material"] = mi
    sky = doc["meshes"][mesh_index(doc, SKY_MESH)]
    for prim in sky.get("primitives") or []:
        if isinstance(prim, dict):
            prim["material"] = unlit_i
    write_glb(path, doc, blob)
    emissive = 0
    for mat in mats:
        if not isinstance(mat, dict):
            continue
        em = mat.get("emissiveFactor")
        if isinstance(em, list) and any(float(v) > 0.0 for v in em[:3]):
            emissive += 1
        extras = mat.get("extensions") if isinstance(mat.get("extensions"), dict) else {}
        if extras and "KHR_materials_emissive_strength" in extras:
            emissive += 1
    log(f"I4 cloud unlit materials emissive_count={emissive}")
    return emissive


def apply_i6_cliff_clamp(path: Path) -> list[dict[str, object]]:
    """Pull LOOK-04 world anchors inside I6 Chebyshev cliff 3100.

    LOOK-04 authors in island-local XY (useful 7200 square, yaw 45 deg). After
    glTF Y-up export, near-edge plants exceed the older I5 world cliff. Local
    building roots stay identity. Names and count are unchanged.
    """
    doc, blob = read_glb(path)
    moved: list[dict[str, object]] = []
    for node in doc.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        name = node.get("name")
        if not isinstance(name, str) or not name.startswith("anchor_"):
            continue
        raw = node.get("translation")
        if isinstance(raw, list) and len(raw) >= 3:
            tx, ty, tz = float(raw[0]), float(raw[1]), float(raw[2])
        else:
            tx, ty, tz = 0.0, 0.0, 0.0
        cheb = max(abs(tx), abs(tz))
        if cheb <= CLIFF:
            continue
        scale = CLIFF / cheb
        nx, nz = tx * scale, tz * scale
        node["translation"] = [nx, ty, nz]
        moved.append(
            {
                "name": name,
                "before": [tx, ty, tz],
                "after": [nx, ty, nz],
                "cheb_before": cheb,
                "delta_xz": ((tx - nx) ** 2 + (tz - nz) ** 2) ** 0.5,
            }
        )
        log(
            f"I6 {name} xz ({tx:.3f},{tz:.3f}) -> ({nx:.3f},{nz:.3f}) "
            f"delta={((tx - nx) ** 2 + (tz - nz) ** 2) ** 0.5:.1f}m y={ty:.3f}"
        )
    write_glb(path, doc, blob)
    if not moved:
        log("I6 no anchors past cliff")
    return moved


def extract_named_mesh(src: Path, dest: Path, mesh_name: str) -> None:
    doc, blob = read_glb(src)
    idx = mesh_index(doc, mesh_name)
    node_i = None
    for i, node in enumerate(doc.get("nodes") or []):
        if isinstance(node, dict) and node.get("mesh") == idx:
            node_i = i
            break
    if node_i is None:
        raise RuntimeError(f"no node uses mesh {mesh_name}")
    doc["scenes"] = [{"name": mesh_name, "nodes": [node_i]}]
    doc["scene"] = 0
    write_glb(dest, doc, blob)
    pruned = dest.with_name(dest.stem + "_pruned.glb")
    gltf_transform("prune", str(dest), str(pruned))
    shutil.copy2(pruned, dest)
    pruned.unlink(missing_ok=True)


def remap_accessor(acc: dict, view_map: dict[int, int]) -> dict:
    out = copy.deepcopy(acc)
    view = out.get("bufferView")
    if isinstance(view, int) and view in view_map:
        out["bufferView"] = view_map[view]
    sparse = out.get("sparse")
    if isinstance(sparse, dict):
        for key in ("indices", "values"):
            block = sparse.get(key)
            if isinstance(block, dict) and isinstance(block.get("bufferView"), int):
                block["bufferView"] = view_map[block["bufferView"]]
    return out


def append_bin(dest_bin: bytes, src_view: dict, src_bin: bytes) -> tuple[bytes, dict]:
    packed = bytearray(dest_bin)
    while len(packed) % 4:
        packed.append(0)
    off = int(src_view.get("byteOffset") or 0)
    ln = int(src_view.get("byteLength") or 0)
    new_view = copy.deepcopy(src_view)
    new_view["byteOffset"] = len(packed)
    new_view["buffer"] = 0
    packed.extend(src_bin[off : off + ln])
    return bytes(packed), new_view


def replace_named_mesh(mass_path: Path, piece_path: Path, mesh_name: str) -> None:
    mass_doc, mass_bin = read_glb(mass_path)
    piece_doc, piece_bin = read_glb(piece_path)
    dest_i = mesh_index(mass_doc, mesh_name)
    src_i = 0
    src_meshes = [m for m in (piece_doc.get("meshes") or []) if isinstance(m, dict)]
    if not src_meshes:
        raise RuntimeError(f"{piece_path.name} has no mesh")
    for i, mesh in enumerate(src_meshes):
        if mesh.get("name") == mesh_name:
            src_i = i
            break
    src_mesh = src_meshes[src_i]
    mass_mats = list(mass_doc.get("materials") or [])
    mat_by_name = {
        str(m.get("name")): i for i, m in enumerate(mass_mats) if isinstance(m, dict)
    }
    piece_mats = list(piece_doc.get("materials") or [])
    views = list(mass_doc.get("bufferViews") or [])
    accessors = list(mass_doc.get("accessors") or [])
    view_map: dict[int, int] = {}
    for i, view in enumerate(piece_doc.get("bufferViews") or []):
        if not isinstance(view, dict):
            continue
        mass_bin, new_view = append_bin(mass_bin, view, piece_bin)
        view_map[i] = len(views)
        views.append(new_view)
    acc_map: dict[int, int] = {}
    for i, acc in enumerate(piece_doc.get("accessors") or []):
        if not isinstance(acc, dict):
            continue
        acc_map[i] = len(accessors)
        accessors.append(remap_accessor(acc, view_map))
    new_prims = []
    for prim in src_mesh.get("primitives") or []:
        if not isinstance(prim, dict):
            continue
        np = copy.deepcopy(prim)
        attrs = np.get("attributes")
        if isinstance(attrs, dict):
            np["attributes"] = {
                k: acc_map[v] if isinstance(v, int) and v in acc_map else v
                for k, v in attrs.items()
            }
        if isinstance(np.get("indices"), int) and np["indices"] in acc_map:
            np["indices"] = acc_map[np["indices"]]
        targets = np.get("targets")
        if isinstance(targets, list):
            mapped_t = []
            for tgt in targets:
                if not isinstance(tgt, dict):
                    mapped_t.append(tgt)
                    continue
                mapped_t.append(
                    {
                        k: acc_map[v] if isinstance(v, int) and v in acc_map else v
                        for k, v in tgt.items()
                    }
                )
            np["targets"] = mapped_t
        mi = np.get("material")
        if isinstance(mi, int) and 0 <= mi < len(piece_mats) and isinstance(piece_mats[mi], dict):
            src_name = str(piece_mats[mi].get("name") or "")
            if src_name not in mat_by_name:
                raise RuntimeError(f"landform material {src_name} missing on mass")
            np["material"] = mat_by_name[src_name]
        new_prims.append(np)
    if not new_prims:
        raise RuntimeError("simplified landform has no primitives")
    dest_mesh = mass_doc["meshes"][dest_i]
    dest_mesh["primitives"] = new_prims
    if "name" not in dest_mesh:
        dest_mesh["name"] = mesh_name
    mass_doc["bufferViews"] = views
    mass_doc["accessors"] = accessors
    buffers = mass_doc.get("buffers")
    if isinstance(buffers, list) and buffers and isinstance(buffers[0], dict):
        buffers[0]["byteLength"] = len(mass_bin)
    else:
        mass_doc["buffers"] = [{"byteLength": len(mass_bin)}]
    write_glb(mass_path, mass_doc, mass_bin)


def simplify_landform(mass_path: Path, target_tris: int) -> tuple[int, int]:
    before = mesh_tris_named(mass_path, LANDFORM)
    island_before = mesh_tris_named(mass_path, ISLAND)
    if island_before != ISLAND_KEEP:
        log(f"WARN Island tris {island_before} != {ISLAND_KEEP}")
    if before <= target_tris:
        log(f"landform {before} already <= target {target_tris}")
        return before, before
    ratio = min(1.0, target_tris / max(before, 1))
    with tempfile.TemporaryDirectory(prefix="landform_", dir=str(RUNTIME)) as tmp:
        work = Path(tmp)
        raw = work / "mass_copy.glb"
        shutil.copy2(mass_path, raw)
        decoded = work / "mass_raw.glb"
        gltf_transform("copy", str(raw), str(decoded))
        piece = work / "landform.glb"
        extract_named_mesh(decoded, piece, LANDFORM)
        welded = work / "landform_weld.glb"
        gltf_transform("weld", str(piece), str(welded))
        weld_tris = triangle_count(welded)
        log(f"landform weld {before} source-count -> {weld_tris} isolated")
        use_ratio = min(1.0, target_tris / max(weld_tris, 1))
        simplified = work / "landform_s.glb"
        gltf_transform(
            "simplify",
            str(welded),
            str(simplified),
            "--ratio",
            f"{use_ratio:.6f}",
            "--error",
            "1",
            "--lock-border",
            "true",
        )
        got = triangle_count(simplified)
        log(f"landform simplify {weld_tris} -> {got} target {target_tris} ratio {use_ratio:.6f} lock-border")
        if got > target_tris:
            simplified2 = work / "landform_s2.glb"
            use_ratio2 = min(1.0, target_tris / max(got, 1))
            gltf_transform(
                "simplify",
                str(simplified),
                str(simplified2),
                "--ratio",
                f"{use_ratio2:.6f}",
                "--error",
                "1",
                "--lock-border",
                "false",
            )
            got2 = triangle_count(simplified2)
            log(f"landform simplify pass2 {got} -> {got2} lock-border false")
            simplified = simplified2
            got = got2
        replace_named_mesh(decoded, simplified, LANDFORM)
        island_after = mesh_tris_named(decoded, ISLAND)
        if island_after != island_before:
            raise RuntimeError(f"Island tris changed {island_before} -> {island_after}")
        pruned = work / "mass_pruned.glb"
        gltf_transform("prune", str(decoded), str(pruned), "--keep-leaves", "true")
        tmp = mass_path.with_name(mass_path.name + ".closing")
        shutil.copy2(pruned, tmp)
        os.replace(tmp, mass_path)
        after = mesh_tris_named(mass_path, LANDFORM)
        log(f"landform replaced in mass {before} -> {after}")
        return before, after


def landform_target() -> int:
    b = building_tris()
    mass = triangle_count(MASS)
    land = mesh_tris_named(MASS, LANDFORM)
    other = mass - land
    # Headroom for accessor rounding after meshopt.
    leftover = ISLAND_TRIS_MAX - b - other
    target = min(land, max(8_000, leftover - 1500))
    log(f"budget buildings={b} mass_other={other} landform={land} leftover={leftover} target={target}")
    if leftover < 8_000:
        raise RuntimeError(f"no room for landform: leftover {leftover}")
    return target


def main() -> None:
    if not MASS.is_file():
        raise SystemExit(f"missing {MASS}")
    i4_only = "--i4-only" in sys.argv
    if not i4_only:
        target = landform_target()
        simplify_landform(MASS, target)
        apply_i6_cliff_clamp(MASS)
    apply_i4_cloud_unlit(MASS)
    log(f"mass tris {triangle_count(MASS)} buildings {building_tris()} total {triangle_count(MASS) + building_tris()}")


if __name__ == "__main__":
    main()
