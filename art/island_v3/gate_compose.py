"""Post-export I5 checks. No Blender. Does not run the planter."""

from __future__ import annotations

import copy
import json
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
MASS = ROOT / "runtime" / "island_mass.glb"
BUILDINGS = ROOT / "runtime" / "buildings"
VIEW = ROOT / "view.html"
HALL_TARGET = 1800.0
PLAZA_HALF = 1400.0
CLIFF = 3100.0
BUILDING_BUDGET = 350 * 1024


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


def node_translation(node: dict) -> tuple[float, float, float]:
    raw = node.get("translation")
    if isinstance(raw, list) and len(raw) >= 3:
        return (float(raw[0]), float(raw[1]), float(raw[2]))
    return (0.0, 0.0, 0.0)


def first_mesh_node(doc: dict) -> dict | None:
    for node in doc.get("nodes") or []:
        if isinstance(node, dict) and "mesh" in node:
            return node
    return None


def node_scale_y(node: dict) -> float:
    raw = node.get("scale")
    if isinstance(raw, list) and len(raw) >= 2:
        return abs(float(raw[1]))
    return 1.0


def decoded_component_span(acc: dict, axis: int) -> float | None:
    mn = acc.get("min")
    mx = acc.get("max")
    if not (isinstance(mn, list) and isinstance(mx, list) and len(mn) > axis and len(mx) > axis):
        return None
    span = float(mx[axis]) - float(mn[axis])
    if acc.get("normalized"):
        ctype = int(acc.get("componentType") or 0)
        denom = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}.get(ctype)
        if denom is None:
            raise SystemExit(f"normalized accessor componentType {ctype} has no decode")
        span = span / denom
    return span


def mesh_position_yspan(doc: dict) -> float | None:
    accessors = doc.get("accessors") or []
    meshes = doc.get("meshes") or []
    span: float | None = None
    for mesh in meshes:
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            attrs = prim.get("attributes")
            if not isinstance(attrs, dict) or "POSITION" not in attrs:
                continue
            idx = attrs["POSITION"]
            if not isinstance(idx, int) or idx < 0 or idx >= len(accessors):
                continue
            acc = accessors[idx]
            if not isinstance(acc, dict):
                continue
            got = decoded_component_span(acc, 1)
            if got is None:
                continue
            span = got if span is None else max(span, got)
    return span


def hall_world_height(doc: dict) -> float:
    yspan = mesh_position_yspan(doc)
    if yspan is None:
        raise SystemExit("city_hall.glb missing POSITION min/max")
    node = first_mesh_node(doc)
    scale = node_scale_y(node) if node is not None else 1.0
    return yspan * scale


def check_hall_height(doc: dict) -> float:
    height = hall_world_height(doc)
    if abs(height - HALL_TARGET) > 80.0:
        raise SystemExit(f"city_hall height {height:.1f} not ~{HALL_TARGET}")
    return height


def node_name(node: dict) -> str:
    raw = node.get("name")
    return raw if isinstance(raw, str) else ""


def building_root_node(doc: dict, slug: str) -> dict | None:
    want = f"building_{slug}"
    for node in doc.get("nodes") or []:
        if isinstance(node, dict) and node_name(node) == want:
            return node
    scenes = doc.get("scenes") or []
    nodes = [n for n in (doc.get("nodes") or []) if isinstance(n, dict)]
    if scenes and isinstance(scenes[0], dict):
        roots = scenes[0].get("nodes") or []
        if roots and isinstance(roots[0], int) and 0 <= roots[0] < len(nodes):
            return nodes[roots[0]]
    return first_mesh_node(doc)


def check_building_local(name: str, doc: dict) -> None:
    slug = name[: -len(".glb")] if name.endswith(".glb") else name
    node = building_root_node(doc, slug)
    if node is None:
        raise SystemExit(f"{name} has no root node")
    tx, ty, tz = node_translation(node)
    if max(abs(tx), abs(ty), abs(tz)) > 0.5:
        raise SystemExit(f"{name} root translation ({tx:.1f},{ty:.1f},{tz:.1f}) is not identity")
    raw = node.get("rotation")
    if isinstance(raw, list) and len(raw) >= 4:
        qx, qy, qz, qw = (float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))
        ident = abs(qx) <= 1e-3 and abs(qy) <= 1e-3 and abs(qz) <= 1e-3 and abs(abs(qw) - 1.0) <= 1e-3
        if not ident:
            raise SystemExit(f"{name} root rotation {(qx, qy, qz, qw)} is not identity")


def git_models_clean() -> None:
    result = subprocess.run(
        ["git", "status", "--porcelain", "--", "models"],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"git status models failed: {result.stderr}")
    dirty = [ln for ln in result.stdout.splitlines() if ln.strip()]
    if dirty:
        raise SystemExit(f"models/ dirty after I5: {dirty[:6]}")


def planter_forbidden() -> None:
    text = (ROOT / "build_island.py").read_text(encoding="utf-8")
    if "forbidden after I5" not in text:
        raise SystemExit("build_island.main is not gated after I5")


def expect_fail(label: str, fn: object) -> None:
    if not callable(fn):
        raise RuntimeError(f"attack {label} is not callable")
    try:
        fn()
    except SystemExit as exc:
        log(f"attack {label}: caught ({exc})")
        return
    raise RuntimeError(f"gate missed {label}")


def attack(hall_doc: dict, html: str) -> None:
    moved = copy.deepcopy(hall_doc)
    root = building_root_node(moved, "city_hall")
    if root is None:
        raise RuntimeError("city_hall root missing for attack")
    root["translation"] = [4000.0, 720.0, 0.0]
    expect_fail("hall world translation", lambda: check_building_local("city_hall.glb", moved))

    yawed = copy.deepcopy(hall_doc)
    yaw_root = building_root_node(yawed, "city_hall")
    if yaw_root is None:
        raise RuntimeError("city_hall root missing for yaw attack")
    yaw_root["rotation"] = [0.0, 0.70710678, 0.0, 0.70710678]
    expect_fail("hall baked yaw", lambda: check_building_local("city_hall.glb", yawed))

    expect_fail("new Date", lambda: check_html(html + "\nnew Date()"))
    expect_fail("city_time", lambda: check_html(html + "\ncity_time"))


def check_html(html: str) -> None:
    if "new Date" in html or "city_time" in html:
        raise SystemExit("view.html mentions Date or city_time")


def check_files() -> dict:
    git_models_clean()
    planter_forbidden()
    if not MASS.is_file():
        raise SystemExit(f"missing {MASS}")
    files = sorted(BUILDINGS.glob("*.glb"))
    if len(files) != 18:
        raise SystemExit(f"expected 18 building glbs, found {len(files)}")
    hall = BUILDINGS / "city_hall.glb"
    if not hall.is_file():
        raise SystemExit("missing city_hall.glb")
    hall_doc = read_glb_json(hall)
    height = check_hall_height(hall_doc)
    log(f"city_hall world-y height {height:.1f}")
    over: list[str] = []
    ring = 0
    for path in files:
        size = path.stat().st_size
        if size > BUILDING_BUDGET:
            over.append(f"{path.name}={size}")
        doc = hall_doc if path.name == "city_hall.glb" else read_glb_json(path)
        check_building_local(path.name, doc)
        if path.name != "city_hall.glb":
            ring += 1
    if ring != 17:
        raise SystemExit(f"ring buildings {ring} != 17")
    html = VIEW.read_text(encoding="utf-8")
    check_html(html)
    if over:
        log("building budget (LOOK-10): " + ", ".join(over))
    log(f"models clean; hall~{HALL_TARGET}; local roots=18")
    return hall_doc


def main() -> None:
    hall_doc = check_files()
    html = VIEW.read_text(encoding="utf-8")
    attack(hall_doc, html)


if __name__ == "__main__":
    main()
    sys.exit(0)
