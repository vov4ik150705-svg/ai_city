"""Post-export I4 checks on runtime mass + viewer. No Blender."""

from __future__ import annotations

import copy
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MASS = ROOT / "runtime" / "island_mass.glb"
VIEW = ROOT / "view.html"
MASS_BUDGET = int(1.5 * 1024 * 1024)


def log(msg: str) -> None:
    print(msg, flush=True)


def read_glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise RuntimeError(f"{path} is not GLB")
    json_len, json_type = struct.unpack_from("<I4s", data, 12)
    if json_type != b"JSON":
        raise RuntimeError(f"{path} missing JSON chunk")
    parsed = json.loads(data[20 : 20 + json_len].rstrip(b"\x00 "))
    if not isinstance(parsed, dict):
        raise RuntimeError("GLB JSON root is not an object")
    return parsed


def node_name(node: dict) -> str:
    raw = node.get("name")
    return raw if isinstance(raw, str) else ""


def check(doc: dict, html: str, size: int) -> None:
    if size > MASS_BUDGET:
        raise SystemExit(f"island_mass.glb {size} exceeds 1.5 MiB")
    names = [node_name(n) for n in doc.get("nodes") or [] if isinstance(n, dict)]
    if not any("SkyDome" in name for name in names):
        raise SystemExit(f"SkyDome missing from nodes: {names[:12]}")
    inst = [
        n
        for n in doc.get("nodes") or []
        if isinstance(n, dict) and node_name(n).startswith("inst_cloud")
    ]
    gpu_nodes = [
        n
        for n in inst
        if isinstance((n.get("extensions") or {}), dict)
        and "EXT_mesh_gpu_instancing" in (n.get("extensions") or {})
    ]
    if len(gpu_nodes) < 4:
        raise SystemExit(f"inst_cloud GPU nodes {len(gpu_nodes)} < 4")
    images = doc.get("images") or []
    if images:
        raise SystemExit(f"mass has {len(images)} images; I4 forbids emission maps")
    sky_color = False
    for mesh in doc.get("meshes") or []:
        if not isinstance(mesh, dict):
            continue
        if mesh.get("name") != "SkyDomeMesh":
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            attrs = prim.get("attributes")
            if isinstance(attrs, dict) and "COLOR_0" in attrs:
                sky_color = True
    if not sky_color:
        raise SystemExit("SkyDomeMesh missing COLOR_0")
    emissive = 0
    for mat in doc.get("materials") or []:
        if not isinstance(mat, dict):
            continue
        extras = mat.get("extensions") if isinstance(mat.get("extensions"), dict) else {}
        em = mat.get("emissiveFactor")
        if isinstance(em, list) and any(float(v) > 0.0 for v in em[:3]):
            emissive += 1
        if extras and "KHR_materials_emissive_strength" in extras:
            emissive += 1
    if emissive < 4:
        raise SystemExit(f"emissive materials {emissive} < 4")
    if "#9ec8e0" in html:
        raise SystemExit("view.html still has #9ec8e0")
    if "new Date" in html or "city_time" in html:
        raise SystemExit("view.html mentions Date or city_time")
    log(f"nodes SkyDome+inst_cloud; gpu_clouds={len(gpu_nodes)} emissive={emissive}; viewer clean")


def expect_fail(label: str, doc: dict, html: str, size: int) -> None:
    try:
        check(doc, html, size)
    except SystemExit as exc:
        log(f"attack {label}: caught ({exc})")
        return
    raise RuntimeError(f"gate missed {label}")


def attack(doc: dict, html: str, size: int) -> None:
    expect_fail("#9ec8e0 fill", doc, html.replace("#6fb4f0", "#9ec8e0", 1), size)
    sky_cut = copy.deepcopy(doc)
    for mesh in sky_cut.get("meshes") or []:
        if not isinstance(mesh, dict) or mesh.get("name") != "SkyDomeMesh":
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            attrs = prim.get("attributes")
            if isinstance(attrs, dict):
                attrs.pop("COLOR_0", None)
    expect_fail("strip SkyDome COLOR_0", sky_cut, html, size)
    imaged = copy.deepcopy(doc)
    imaged["images"] = [{"uri": "fake_emissive.png"}]
    expect_fail("emission map", imaged, html, size)
    expect_fail("new Date", doc, html + "\nnew Date()", size)
    expect_fail("city_time", doc, html + "\ncity_time", size)
    few_cloud = copy.deepcopy(doc)
    for node in few_cloud.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        ext = node.get("extensions")
        if isinstance(ext, dict):
            ext.pop("EXT_mesh_gpu_instancing", None)
    expect_fail("no GPU clouds", few_cloud, html, size)


def main() -> None:
    if not MASS.is_file():
        raise SystemExit(f"missing {MASS}")
    size = MASS.stat().st_size
    log(f"mass {size} budget {MASS_BUDGET}")
    doc = read_glb_json(MASS)
    html = VIEW.read_text(encoding="utf-8")
    check(doc, html, size)
    attack(doc, html, size)


if __name__ == "__main__":
    main()
    sys.exit(0)
