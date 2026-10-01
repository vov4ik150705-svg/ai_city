"""V3-2/V3-3 hero GLB catalog. Keys equal buildings.json ids. Unique toy massing per id.

Meshy remesh targets (30k/5k, 2K) live in render.params. This writer ships distinct
placeholder GLB so the catalog and lot plant can close without Meshy binaries (R-V-86).
Windows and signs are separate primitives with emissiveFactor (R-V-87); albedo COLOR_0
is local colour, not a lighting term painted into the mesh.
"""

from __future__ import annotations

import hashlib
import json
import os
import struct
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HERO_DIR = REPO / "content" / "out" / "heroes"

# material id: compute_brick is legal only on ai_research_center (assets/_STYLE_V3.txt).
MATERIALS = {
    "city_hall": "granite",
    "workshop": "enamel",
    "agent_hub": "civic_glass",
    "power_node": "steel",
    "bank": "stone_gold",
    "exchange": "tile",
    "ai_research_center": "compute_brick",
    "energy_plant": "crimson",
    "logistics_hub": "ochre",
    "flagship_store": "pale_glass",
    "cloud_campus": "cool_metal",
    "finance_tower": "deep_stone",
    "robotics_lab": "lab_steel",
    "drone_depot": "amber_hangar",
    "data_center": "concrete",
    "fleet_yard": "industrial_yard",
    "retail_complex": "retail_glass",
    "clearing_house": "civic_enamel",
}

# RGB 0-255. Research body is dark brick; eye is a separate green box in MASSING.
COLORS = {
    "granite": (92, 96, 104),
    "enamel": (196, 188, 172),
    "civic_glass": (120, 168, 196),
    "steel": (140, 148, 156),
    "stone_gold": (72, 64, 52),
    "tile": (168, 152, 136),
    "compute_brick": (28, 32, 36),
    "crimson": (140, 44, 48),
    "ochre": (168, 112, 48),
    "pale_glass": (200, 212, 216),
    "cool_metal": (156, 168, 180),
    "deep_stone": (48, 44, 52),
    "lab_steel": (112, 124, 132),
    "amber_hangar": (180, 124, 52),
    "concrete": (128, 128, 124),
    "industrial_yard": (96, 88, 76),
    "retail_glass": (188, 200, 196),
    "civic_enamel": (84, 92, 108),
    "eye_green": (0, 220, 96),
    "gold_slit": (212, 168, 64),
    "window_neon": (40, 200, 255),
    "sign_amber": (255, 120, 20),
}

# Each box: x, z, y, w, d, h in millitiles (0-1000 xz of the lot, y up). Unique silhouette.
# Low LOD = these hulls. High LOD adds face trims in _detail_boxes.
MASSING: dict[str, list[tuple[int, int, int, int, int, int]]] = {
    "city_hall": [
        (50, 200, 0, 900, 600, 280),
        (350, 280, 280, 300, 440, 520),
        (80, 240, 280, 180, 200, 160),
        (740, 240, 280, 180, 200, 160),
    ],
    "workshop": [
        (40, 80, 0, 920, 840, 220),
        (40, 80, 220, 300, 840, 80),
        (360, 80, 220, 300, 840, 140),
        (680, 80, 220, 280, 840, 80),
    ],
    "agent_hub": [
        (250, 250, 0, 500, 500, 360),
        (200, 350, 0, 160, 300, 240),
        (640, 350, 0, 160, 300, 240),
        (350, 200, 0, 300, 160, 240),
        (350, 640, 0, 300, 160, 240),
        (320, 320, 360, 360, 360, 80),
    ],
    "power_node": [
        (420, 420, 0, 160, 160, 720),
        (200, 460, 480, 600, 80, 40),
        (460, 200, 560, 80, 600, 40),
        (380, 380, 0, 240, 240, 80),
    ],
    "bank": [
        (80, 80, 0, 840, 840, 160),
        (160, 160, 160, 680, 680, 160),
        (240, 240, 320, 520, 520, 160),
        (320, 320, 480, 360, 360, 200),
    ],
    "exchange": [
        (120, 120, 0, 760, 760, 400),
        (200, 200, 400, 600, 600, 80),
        (300, 300, 480, 400, 400, 80),
        (400, 400, 560, 200, 200, 80),
    ],
    "ai_research_center": [
        (40, 200, 0, 920, 600, 360),
        (40, 200, 360, 920, 600, 40),
        (380, 180, 120, 240, 80, 160),
    ],
    "energy_plant": [
        (80, 80, 0, 360, 360, 560),
        (560, 80, 0, 360, 360, 480),
        (80, 560, 0, 840, 360, 160),
        (200, 200, 560, 120, 120, 80),
        (680, 200, 480, 120, 120, 80),
    ],
    "logistics_hub": [
        (20, 40, 0, 960, 400, 200),
        (20, 480, 0, 960, 480, 280),
        (40, 40, 200, 120, 400, 80),
        (840, 40, 200, 120, 400, 80),
        (200, 40, 0, 80, 400, 40),
        (400, 40, 0, 80, 400, 40),
        (600, 40, 0, 80, 400, 40),
    ],
    "flagship_store": [
        (80, 120, 0, 840, 760, 240),
        (40, 80, 240, 920, 400, 200),
        (200, 160, 80, 600, 40, 120),
    ],
    "cloud_campus": [
        (40, 40, 0, 360, 920, 320),
        (600, 40, 0, 360, 920, 280),
        (40, 40, 0, 920, 160, 80),
        (40, 800, 0, 920, 160, 80),
    ],
    "finance_tower": [
        (280, 200, 0, 440, 600, 880),
        (260, 180, 0, 40, 640, 880),
        (200, 200, 0, 80, 600, 80),
        (720, 200, 0, 80, 600, 80),
    ],
    "robotics_lab": [
        (40, 40, 0, 400, 920, 300),
        (40, 40, 0, 920, 280, 300),
        (440, 40, 300, 200, 200, 120),
    ],
    "drone_depot": [
        (40, 80, 0, 160, 840, 360),
        (800, 80, 0, 160, 840, 360),
        (40, 80, 360, 920, 840, 80),
        (200, 80, 0, 600, 200, 40),
    ],
    "data_center": [
        (40, 200, 0, 920, 600, 180),
        (80, 240, 180, 840, 520, 80),
        (40, 200, 0, 80, 600, 180),
        (880, 200, 0, 80, 600, 180),
    ],
    "fleet_yard": [
        (40, 40, 0, 280, 920, 200),
        (680, 40, 0, 280, 400, 240),
        (360, 40, 0, 280, 200, 80),
        (40, 760, 0, 920, 200, 40),
    ],
    "retail_complex": [
        (40, 40, 0, 920, 920, 220),
        (280, 280, 40, 440, 440, 280),
        (40, 40, 220, 200, 920, 80),
        (760, 40, 220, 200, 920, 80),
    ],
    "clearing_house": [
        (80, 80, 0, 840, 840, 360),
        (40, 40, 360, 920, 920, 40),
        (200, 200, 0, 600, 80, 280),
        (200, 720, 0, 600, 80, 280),
    ],
}


def _rgb(name: str) -> tuple[float, float, float]:
    r, g, b = COLORS[name]
    return (r / 255.0, g / 255.0, b / 255.0)


WINDOW_EMISSIVE = _rgb("window_neon")
SIGN_EMISSIVE = _rgb("sign_amber")


def _box_tris(
    x: float, z: float, y: float, w: float, d: float, h: float, rgb: tuple[float, float, float]
) -> tuple[list[float], list[float], list[int]]:
    x1, z1, y1 = x + w, z + d, y + h
    corners = (
        (x, y, z),
        (x1, y, z),
        (x1, y, z1),
        (x, y, z1),
        (x, y1, z),
        (x1, y1, z),
        (x1, y1, z1),
        (x, y1, z1),
    )
    faces = (
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (3, 2, 6, 7),
        (0, 3, 7, 4),
        (1, 5, 6, 2),
    )
    pos: list[float] = []
    col: list[float] = []
    idx: list[int] = []
    base = 0
    for a, b, c, d_i in faces:
        for vi in (a, b, c, d_i):
            px, py, pz = corners[vi]
            pos.extend((px, py, pz))
            col.extend(rgb)
        idx.extend((base, base + 1, base + 2, base, base + 2, base + 3))
        base += 4
    return pos, col, idx


def _detail_boxes(
    hull: list[tuple[int, int, int, int, int, int]],
) -> list[tuple[int, int, int, int, int, int]]:
    extra: list[tuple[int, int, int, int, int, int]] = []
    for x, z, y, w, d, h in hull:
        if w >= 200 and h >= 80:
            extra.append((x + 40, z - 8, y + 40, w - 80, 16, 24))
        if d >= 200 and h >= 80:
            extra.append((x - 8, z + 40, y + 40, 16, d - 80, 24))
        if h >= 160:
            extra.append((x + w // 4, z + d // 4, y + h, w // 2, d // 2, 24))
    return extra


def _window_boxes(
    hull: list[tuple[int, int, int, int, int, int]],
) -> list[tuple[int, int, int, int, int, int]]:
    x, z, y, w, d, h = hull[0]
    face_z = z + d - 12
    if face_z < z:
        face_z = z
    slit_w = 48 if w >= 200 else max(24, w // 4)
    slit_h = 40 if h >= 120 else max(24, h // 3)
    ox = x + 80 if w >= 200 else x + w // 6
    oy = y + (h // 3 if h >= 80 else 0)
    boxes: list[tuple[int, int, int, int, int, int]] = [(ox, face_z, oy, slit_w, 16, slit_h)]
    if w >= 400:
        boxes.append((x + w - 80 - slit_w, face_z, oy, slit_w, 16, slit_h))
        if h >= 240:
            boxes.append((ox + 80, face_z, oy + slit_h + 24, slit_w, 16, slit_h))
    return boxes


def _sign_boxes(
    hull: list[tuple[int, int, int, int, int, int]],
) -> list[tuple[int, int, int, int, int, int]]:
    x, z, y, w, d, h = hull[0]
    sw = w // 2 if w >= 80 else w
    sx = x + (w - sw) // 2
    sy = y + h - 36 if h >= 80 else y + h // 2
    sz = z - 12
    return [(sx, sz, sy, sw, 16, 28)]


def _pack_boxes(
    boxes: list[tuple[int, int, int, int, int, int]],
    rgb: tuple[float, float, float],
    accent: dict[tuple[int, int], tuple[float, float, float]] | None = None,
) -> tuple[list[float], list[float], list[int], int]:
    pos: list[float] = []
    col: list[float] = []
    idx: list[int] = []
    base = 0
    for x, z, y, w, d, h in boxes:
        use = rgb
        if accent is not None:
            hit = accent.get((x, z))
            if hit is not None:
                use = hit
        p, c, i = _box_tris(
            x / 1000.0, z / 1000.0, y / 1000.0, w / 1000.0, d / 1000.0, h / 1000.0, use
        )
        pos.extend(p)
        col.extend(c)
        idx.extend(v + base for v in i)
        base += len(p) // 3
    quads = len(idx) // 6
    return pos, col, idx, quads


def _mesh_parts(
    bid: str, high: bool
) -> list[tuple[str, list[float], list[float] | None, list[int], int]]:
    hull = MASSING[bid]
    body_boxes = list(hull)
    if high:
        body_boxes.extend(_detail_boxes(hull))
    rgb = _rgb(MATERIALS[bid])
    accent: dict[tuple[int, int], tuple[float, float, float]] = {}
    if bid == "ai_research_center":
        accent[(380, 180)] = _rgb("eye_green")
    if bid == "finance_tower":
        for bx, bz, _y, bw, _d, _h in body_boxes:
            if bw == 40:
                accent[(bx, bz)] = _rgb("gold_slit")
    body = _pack_boxes(body_boxes, rgb, accent)
    win = _pack_boxes(_window_boxes(hull), WINDOW_EMISSIVE)
    sign = _pack_boxes(_sign_boxes(hull), SIGN_EMISSIVE)
    return [
        ("body", body[0], body[1], body[2], body[3]),
        ("window", win[0], None, win[2], win[3]),
        ("sign", sign[0], None, sign[2], sign[3]),
    ]


def _align4(n: int) -> int:
    return (n + 3) & ~3


def _gltf_material(kind: str) -> dict[str, object]:
    if kind == "window":
        rgb = [WINDOW_EMISSIVE[0], WINDOW_EMISSIVE[1], WINDOW_EMISSIVE[2]]
        return {
            "name": "window",
            "pbrMetallicRoughness": {
                "baseColorFactor": rgb + [1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 1.0,
            },
            "emissiveFactor": rgb,
            "extras": {"kind": "window"},
        }
    if kind == "sign":
        rgb = [SIGN_EMISSIVE[0], SIGN_EMISSIVE[1], SIGN_EMISSIVE[2]]
        return {
            "name": "sign",
            "pbrMetallicRoughness": {
                "baseColorFactor": rgb + [1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 1.0,
            },
            "emissiveFactor": rgb,
            "extras": {"kind": "sign"},
        }
    return {
        "name": "body",
        "pbrMetallicRoughness": {"metallicFactor": 0.0, "roughnessFactor": 1.0},
        "emissiveFactor": [0.0, 0.0, 0.0],
        "extras": {"kind": "body"},
    }


def write_glb(
    path: Path,
    parts: list[tuple[str, list[float], list[float] | None, list[int]]],
) -> bytes:
    views: list[dict[str, int]] = []
    accessors: list[dict[str, object]] = []
    meshes: list[dict[str, object]] = []
    materials: list[dict[str, object]] = []
    nodes: list[dict[str, object]] = [{"name": "hero", "children": []}]
    chunks: list[tuple[int, bytes]] = []
    cursor = 0
    child = 1
    for name, pos, col, idx in parts:
        if not pos or not idx:
            continue
        pos_b = struct.pack("<" + "f" * len(pos), *pos)
        idx_b = struct.pack("<" + "H" * len(idx), *idx)
        col_b = struct.pack("<" + "f" * len(col), *col) if col else b""
        pos_off = _align4(cursor)
        chunks.append((pos_off, pos_b))
        cursor = pos_off + len(pos_b)
        views.append({"buffer": 0, "byteOffset": pos_off, "byteLength": len(pos_b), "target": 34962})
        pos_view = len(views) - 1
        col_view = -1
        if col:
            col_off = _align4(cursor)
            chunks.append((col_off, col_b))
            cursor = col_off + len(col_b)
            views.append(
                {"buffer": 0, "byteOffset": col_off, "byteLength": len(col_b), "target": 34962}
            )
            col_view = len(views) - 1
        idx_off = _align4(cursor)
        chunks.append((idx_off, idx_b))
        cursor = idx_off + len(idx_b)
        views.append({"buffer": 0, "byteOffset": idx_off, "byteLength": len(idx_b), "target": 34963})
        idx_view = len(views) - 1
        nvert = len(pos) // 3
        xs = pos[0::3]
        ys = pos[1::3]
        zs = pos[2::3]
        accessors.append(
            {
                "bufferView": pos_view,
                "componentType": 5126,
                "count": nvert,
                "type": "VEC3",
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
            }
        )
        pos_acc = len(accessors) - 1
        attrs: dict[str, int] = {"POSITION": pos_acc}
        if col_view >= 0:
            accessors.append(
                {"bufferView": col_view, "componentType": 5126, "count": nvert, "type": "VEC3"}
            )
            attrs["COLOR_0"] = len(accessors) - 1
        accessors.append(
            {"bufferView": idx_view, "componentType": 5123, "count": len(idx), "type": "SCALAR"}
        )
        idx_acc = len(accessors) - 1
        materials.append(_gltf_material(name))
        meshes.append(
            {
                "name": name,
                "primitives": [
                    {
                        "attributes": attrs,
                        "indices": idx_acc,
                        "material": len(materials) - 1,
                        "mode": 4,
                    }
                ],
            }
        )
        nodes.append({"name": name, "mesh": len(meshes) - 1})
        children = nodes[0].get("children")
        if isinstance(children, list):
            children.append(child)
        child += 1
    bin_len = _align4(cursor)
    blob = bytearray(bin_len)
    for off, data in chunks:
        blob[off : off + len(data)] = data
    doc = {
        "asset": {"version": "2.0", "generator": "corporator-heroes"},
        "buffers": [{"byteLength": bin_len}],
        "bufferViews": views,
        "accessors": accessors,
        "materials": materials,
        "meshes": meshes,
        "nodes": nodes,
        "scenes": [{"nodes": [0]}],
        "scene": 0,
    }
    json_b = json.dumps(doc, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    json_b += b" " * (_align4(len(json_b)) - len(json_b))
    json_len = len(json_b)
    total = 12 + 8 + json_len + 8 + bin_len
    out = bytearray()
    out += b"glTF"
    out += struct.pack("<I", 2)
    out += struct.pack("<I", total)
    out += struct.pack("<I", json_len)
    out += b"JSON"
    out += json_b
    out += struct.pack("<I", bin_len)
    out += b"BIN\x00"
    out += blob
    blob = bytes(out)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        if path.is_file() and path.read_bytes() == blob:
            return blob
    except OSError:
        pass
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_bytes(blob)
    last: PermissionError | None = None
    for attempt in range(12):
        try:
            os.replace(tmp, path)
            return blob
        except PermissionError as exc:
            last = exc
            time.sleep(0.05 * (attempt + 1))
    if last is not None:
        raise last
    return blob


def building_ids(data: dict) -> list[str]:
    blds = ((data.get("buildings") or {}).get("buildings") or {})
    return sorted(str(k) for k in blds.keys())


def ensure_heroes(data: dict) -> dict[str, dict[str, object]]:
    overlay = data.get("_hero_catalog")
    if isinstance(overlay, dict):
        return {str(k): dict(v) if isinstance(v, dict) else {} for k, v in overlay.items()}
    ids = building_ids(data)
    catalog: dict[str, dict[str, object]] = {}
    for bid in ids:
        if bid not in MASSING or bid not in MATERIALS:
            continue
        high_parts = _mesh_parts(bid, True)
        low_parts = _mesh_parts(bid, False)
        lod_high = f"{bid}_lod0.glb"
        lod_low = f"{bid}_lod1.glb"
        # Pack hash must not depend on a sibling worker tearing this path.
        high_bytes = write_glb(
            HERO_DIR / lod_high,
            [(n, p, c, i) for n, p, c, i, _q in high_parts],
        )
        low_bytes = write_glb(
            HERO_DIR / lod_low,
            [(n, p, c, i) for n, p, c, i, _q in low_parts],
        )
        qh = sum(q for _n, _p, _c, _i, q in high_parts)
        ql = sum(q for _n, _p, _c, _i, q in low_parts)
        catalog[bid] = {
            "lod_high": lod_high,
            "lod_low": lod_low,
            "quads_high": qh,
            "quads_low": ql,
            "material": MATERIALS[bid],
            "sha_high": hashlib.sha256(high_bytes).hexdigest(),
            "sha_low": hashlib.sha256(low_bytes).hexdigest(),
        }
    return catalog


def hero_sha256(catalog: dict[str, dict[str, object]]) -> str:
    parts = []
    for bid in sorted(catalog):
        row = catalog[bid]
        parts.append(f"{bid}:{row.get('sha_high')}:{row.get('sha_low')}")
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
