"""Post-export I6 checks. No Blender. Does not run the planter."""

from __future__ import annotations

import copy
import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MASS = ROOT / "runtime" / "island_mass.glb"
BUILDINGS = ROOT / "runtime" / "buildings"
VIEW = ROOT / "view.html"
EXPORT = ROOT / "export_runtime.py"
PLANTER = ROOT / "build_island.py"
ANCHORS_JSON = ROOT / "anchors.json"
SLUG_RE = re.compile(r"^anchor_[a-z0-9_]+$")
ANCHOR_COUNT = 26
MIN_ANCHORS = 23
PLAZA_HALF = 1400.0
CLIFF = 3100.0
XZ_TOL = 80.0

OCCUPIED: tuple[str, ...] = (
    "anchor_agent_hub",
    "anchor_amazon",
    "anchor_amazon_warehouse",
    "anchor_apple",
    "anchor_bank",
    "anchor_city_hall",
    "anchor_clearinghouse",
    "anchor_coinbase",
    "anchor_data_center",
    "anchor_exchange",
    "anchor_fleet_yard",
    "anchor_microsoft",
    "anchor_nvidia_depot",
    "anchor_nvidia_tower",
    "anchor_power_node",
    "anchor_robotic_lab",
    "anchor_tesla",
    "anchor_workshop",
)
PLOTS: tuple[str, ...] = tuple(f"anchor_plot_{i:02d}" for i in range(1, 9))
EXPECTED = frozenset(OCCUPIED) | frozenset(PLOTS)


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


def anchor_nodes(doc: dict) -> list[dict]:
    out: list[dict] = []
    for node in doc.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        name = node_name(node)
        if name.startswith("anchor_"):
            out.append(node)
    return out


def check_names(doc: dict) -> list[str]:
    names = [node_name(n) for n in anchor_nodes(doc)]
    if len(names) != len(set(names)):
        raise SystemExit(f"duplicate anchors: {names}")
    bad = [n for n in names if not SLUG_RE.fullmatch(n)]
    if bad:
        raise SystemExit(f"anchor slug not [a-z0-9_]: {bad[:4]}")
    got = set(names)
    if len(got) < MIN_ANCHORS:
        raise SystemExit(f"anchors {len(got)} < {MIN_ANCHORS}")
    if got != EXPECTED:
        raise SystemExit(f"anchor set extra={sorted(got - EXPECTED)[:6]} missing={sorted(EXPECTED - got)[:6]}")
    return sorted(names)


def check_pose(doc: dict) -> None:
    for node in anchor_nodes(doc):
        name = node_name(node)
        tx, ty, tz = node_translation(node)
        # glTF Y-up: horizontal is x,z ; height is y.
        if max(abs(tx), abs(tz)) > CLIFF:
            raise SystemExit(f"{name} xz ({tx:.0f},{tz:.0f}) past cliff")
        if "mesh" in node:
            raise SystemExit(f"{name} has a mesh; Empty must be a node only")


def is_identity_translation(node: dict) -> bool:
    tx, ty, tz = node_translation(node)
    return max(abs(tx), abs(ty), abs(tz)) <= 0.5


def check_occupied_match() -> None:
    mass = read_glb_json(MASS)
    by_name = {node_name(n): n for n in anchor_nodes(mass)}
    for slug_node in OCCUPIED:
        slug = slug_node[len("anchor_") :]
        path = BUILDINGS / f"{slug}.glb"
        if not path.is_file():
            raise SystemExit(f"missing building glb {path.name}")
        doc = read_glb_json(path)
        root = None
        for node in doc.get("nodes") or []:
            if isinstance(node, dict) and node_name(node) == f"building_{slug}":
                root = node
                break
        if root is None:
            root = first_mesh_node(doc)
        if root is None:
            raise SystemExit(f"{path.name} has no root node")
        if not is_identity_translation(root):
            tx, ty, tz = node_translation(root)
            raise SystemExit(f"{path.name} root still has world translation {(tx, ty, tz)}")
        if slug_node not in by_name:
            raise SystemExit(f"missing {slug_node}")


def check_sources() -> None:
    export_txt = EXPORT.read_text(encoding="utf-8")
    if 'startswith("anchor_")' not in export_txt:
        raise SystemExit("export_runtime no longer selects anchor_*")
    planter = PLANTER.read_text(encoding="utf-8")
    if "forbidden after I5" not in planter:
        raise SystemExit("build_island.main is not gated after I5")
    if re.search(r"if ob\.type == [\"']EMPTY[\"']", planter):
        raise SystemExit("planter delete cycle mentions EMPTY")
    if ANCHORS_JSON.is_file():
        raise SystemExit("anchors.json exists; GLB tree is the source")
    html = VIEW.read_text(encoding="utf-8")
    if "new Date" in html or "city_time" in html:
        raise SystemExit("view.html mentions Date or city_time")


def expect_fail(label: str, fn: object) -> None:
    if not callable(fn):
        raise RuntimeError(f"attack {label} is not callable")
    try:
        fn()
    except SystemExit as exc:
        log(f"attack {label}: caught ({exc})")
        return
    raise RuntimeError(f"gate missed {label}")


def attack(doc: dict) -> None:
    empty = copy.deepcopy(doc)
    for node in empty.get("nodes") or []:
        if isinstance(node, dict) and node_name(node).startswith("anchor_"):
            node["name"] = "skip_" + node_name(node)
    expect_fail("export dropped empties", lambda: check_names(empty))

    short = copy.deepcopy(doc)
    renamed = 0
    for node in short.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        name = node_name(node)
        if name.startswith("anchor_plot_"):
            node["name"] = "skip_" + name
            renamed += 1
            if renamed >= 4:
                break
    expect_fail("fewer than 23", lambda: check_names(short))

    upper = copy.deepcopy(doc)
    for node in upper.get("nodes") or []:
        if isinstance(node, dict) and node_name(node) == "anchor_city_hall":
            node["name"] = "anchor_CityHall"
            break
    expect_fail("uppercase slug", lambda: check_names(upper))

    cliff = copy.deepcopy(doc)
    for node in cliff.get("nodes") or []:
        if isinstance(node, dict) and node_name(node) == "anchor_plot_06":
            node["translation"] = [4000.0, 0.0, 0.0]
            break
    expect_fail("plot on cliff", lambda: check_pose(cliff))

    meshed = copy.deepcopy(doc)
    for node in meshed.get("nodes") or []:
        if isinstance(node, dict) and node_name(node) == "anchor_bank":
            node["mesh"] = 0
            break
    expect_fail("anchor with mesh", lambda: check_pose(meshed))

    scaled = copy.deepcopy(doc)
    for node in scaled.get("nodes") or []:
        if isinstance(node, dict) and node_name(node) == "anchor_city_hall":
            node["scale"] = [5.0, 5.0, 5.0]
            break
    check_names(scaled)
    check_pose(scaled)
    log("attack hall empty scale 5: names+pose still pass")


def main() -> None:
    check_sources()
    if not MASS.is_file():
        raise SystemExit(f"missing {MASS}")
    size = MASS.stat().st_size
    log(f"mass {size}")
    doc = read_glb_json(MASS)
    names = check_names(doc)
    check_pose(doc)
    check_occupied_match()
    log("anchors " + ",".join(names))
    log(f"count {len(names)} occupied=18 plots=8")
    attack(doc)


if __name__ == "__main__":
    main()
    sys.exit(0)
