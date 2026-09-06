"""Owner isometric studio: assemble the shared island players see.

    python content/studio.py
    python content/studio.py --port 8765 --no-browser

The canvas is the generator island: ground PNG plus a live sprite layer.
A studio-only v2 toggle serves keyed `*_v2.png` bodies; the pack and ground stay pixelize.
Click a sprite and drag in any direction. SE handle resizes. Alt-drag or [ ]
sets lift. R mirrors. Q/E cycles walker/vehicle facing. Catalog is the asset
registry. Floor brush paints land and water, including dock and waterfall.
Road and crosswalk stamp road_span_tiles diamonds: one diamond is one
lane, the median sits on the seam. The water_margin ring is not painted. replace_placements / replace_props empty means empty, not
the generator. Writes content/fixtures/authored_layout.json. Empty arrays
without those flags keep the generator. Not a player builder, not a pack listen port.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from jsonschema import Draft202012Validator
from PIL import Image

try:
    from pack import BPS, REPO, ROOT, fixture, schema, sections
except ImportError:
    from content.pack import BPS, REPO, ROOT, fixture, schema, sections

import world

PIPE = REPO / "art" / "pipeline"
if str(PIPE) not in sys.path:
    sys.path.insert(0, str(PIPE))
import scene as scene_mod  # noqa: E402

HERE = Path(__file__).resolve().parent
HTML_PATH = HERE / "studio.html"
FIXTURE_PATH = ROOT / "fixtures" / "authored_layout.json"
PREVIEW_DIR = REPO / "art" / "preview"
PREVIEW_PNG = PREVIEW_DIR / "scene.png"
PREVIEW_ISO = PREVIEW_DIR / "scene.iso.json"
HOST = "127.0.0.1"
_STAGED: dict | None = None
_PNG: bytes = b""
_GROUND: bytes = b""
_ISO: dict = {}
_PNG_KEY = ""
_GROUND_KEY = ""
_LOCK = threading.Lock()
_GEN = threading.Lock()
GROUND_PNG = PREVIEW_DIR / "studio_ground.png"
V2_DIR = PREVIEW_DIR / "v2"
_ASSET_FILES: dict[str, Path] | None = None
_V2_LOCK = threading.Lock()

GROUND = (
    { "ch": ".", "label": "трава", "fill": "#2e3a16" },
    { "ch": "r", "label": "дорога", "fill": "#3a3f4d" },
    { "ch": "s", "label": "тротуар", "fill": "#9a9a92" },
    { "ch": "c", "label": "переход", "fill": "#6a6a74" },
    { "ch": "b", "label": "песок", "fill": "#c8a86a" },
    { "ch": "k", "label": "парковка", "fill": "#3a3f4d" },
    { "ch": "p", "label": "площадь", "fill": "#b4a078" },
    { "ch": "m", "label": "кладка", "fill": "#3a3f4d" },
    { "ch": "~", "label": "стереть", "fill": "#12203f" },
)

def _load_data() -> dict:
    return sections()


def _seed(data: dict) -> int:
    return int((((data.get("placement") or {}).get("params") or {}).get("demo_seed") or {}).get("v") or 1)


def _disk_overlay() -> dict:
    try:
        blob = fixture("authored_layout")
    except Exception:
        blob = {}
    if not isinstance(blob, dict):
        blob = {}
    blob.setdefault("note", "Owner island overlay.")
    blob.setdefault("src", "docs/WORLD.md §5")
    blob.setdefault("placements", [])
    blob.setdefault("tiles", [])
    blob.setdefault("props", [])
    return blob


def _blank_replace(disk: dict, key: str, flag: str) -> bool:
    return int(disk.get(flag) or 0) == 1 and not (disk.get(key) or [])


def _stale_resurrection(staged: dict, disk: dict) -> bool:
    """Old studio tab stages a generator dump without replace_* flags."""
    if _blank_replace(disk, "placements", "replace_placements"):
        if staged.get("placements") and not int(staged.get("replace_placements") or 0):
            return True
    if _blank_replace(disk, "props", "replace_props"):
        if staged.get("props") and not int(staged.get("replace_props") or 0):
            return True
    return False


def _active_overlay() -> dict:
    disk = _disk_overlay()
    if isinstance(_STAGED, dict) and not _stale_resurrection(_STAGED, disk):
        return _STAGED
    return disk


def _data_with(overlay: dict | None) -> dict:
    data = _load_data()
    if overlay:
        data["_authored_layout"] = overlay
    return data


def _overlay_identity(overlay: dict) -> bool:
    return not (
        overlay.get("placements")
        or overlay.get("tiles")
        or overlay.get("props")
        or int(overlay.get("replace_placements") or 0)
        or int(overlay.get("replace_props") or 0)
    )


def _overlay_key(overlay: dict) -> str:
    return hashlib.sha256(
        json.dumps(overlay, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _world_of(overlay: dict | None) -> tuple[dict, dict]:
    data = _data_with(overlay)
    return data, world.build_world(data, {}, _seed(data))


def _load_disk_iso() -> dict:
    if not PREVIEW_ISO.is_file():
        return {}
    try:
        blob = json.loads(PREVIEW_ISO.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if isinstance(blob, dict) and int(blob.get("width") or 0) > 0:
        return blob
    return {}


def catalog_of(data: dict) -> list[dict]:
    rows: list[dict] = []
    blds = (data.get("buildings") or {}).get("buildings") or {}
    syn = (data.get("districts") or {}).get("synergies") or {}
    for bid, spec in sorted(blds.items()):
        kind = world.infer_place_kind(data, bid)
        district = spec.get("district")
        if kind == "synergy":
            district = world.home_district(list((syn.get(bid) or {}).get("requires") or []))
        rows.append({"id": bid, "kind": kind, "district": district, "tier": spec.get("tier")})
    fillers = world.filler_kinds_for_lots(data)
    have = {r["id"] for r in rows}
    for fid, spec in sorted(fillers.items()):
        if fid in have:
            continue
        rows.append({"id": fid, "kind": "filler", "district": spec.get("district"), "tier": "filler"})
        have.add(fid)
    for sid in world.RESIDENTIAL_SKINS:
        if sid in have:
            continue
        rows.append({"id": sid, "kind": "filler", "district": "consumer", "tier": "filler"})
        have.add(sid)
    for sid in sprite_catalog().get("building") or []:
        if sid in have:
            continue
        rows.append({"id": sid, "kind": world.infer_place_kind(data, sid), "district": None, "tier": "filler"})
        have.add(sid)
    return rows


def prop_catalog() -> list[str]:
    groups = sprite_catalog()
    out: list[str] = []
    seen: set[str] = set()
    for key in ("decor", "vehicle", "unit", "tile", "fx"):
        for sid in groups.get(key) or []:
            if sid not in seen:
                seen.add(sid)
                out.append(sid)
    return out


def sprite_catalog() -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {
        "building": [],
        "decor": [],
        "vehicle": [],
        "unit": [],
        "tile": [],
        "fx": [],
        "all": [],
    }
    seen: set[str] = set()
    for row in world.load_assets():
        sid = str(row.get("id") or "")
        kind = str(row.get("kind") or "")
        if not sid or sid in seen:
            continue
        seen.add(sid)
        groups["all"].append(sid)
        if kind == "building":
            groups["building"].append(sid)
        elif kind == "tile":
            groups["tile"].append(sid)
        elif kind == "glyph" or sid.startswith(("overlay_", "badge_")):
            groups["fx"].append(sid)
        elif sid.startswith("vehicle"):
            groups["vehicle"].append(sid)
        elif sid.startswith(("walker_", "robot_", "drone")):
            groups["unit"].append(sid)
        else:
            groups["decor"].append(sid)
    return groups


def generated_props_of(g: dict) -> list[dict]:
    placed_origin = {(int(p["x"]), int(p["y"])) for p in g.get("reference_layout") or []}
    mini = {(int(r["x"]), int(r["y"])) for r in g.get("mini_islands") or []}
    rows: list[dict] = []
    seen: set[tuple] = set()
    for obj in (g.get("scene") or {}).get("objects") or []:
        sid = str(obj.get("id") or "")
        tile = obj.get("tile") or [0, 0]
        tx, ty = int(tile[0]), int(tile[1])
        if (tx, ty) in mini or (tx, ty) in placed_origin:
            continue
        key = (sid, tx, ty)
        if key in seen:
            continue
        seen.add(key)
        rows.append({"id": sid, "x": tx, "y": ty, **world.geom_of(obj)})
    return rows


def district_budget(data: dict, g: dict) -> dict[str, dict]:
    lots = list(g.get("lots") or [])
    placed = list(g.get("reference_layout") or [])
    used_non = {int(row["lot_index"]) for row in placed if row.get("kind") != "filler" and "lot_index" in row}
    got_zone: dict[str, int] = {}
    for row in placed:
        if row.get("kind") != "filler":
            continue
        z = str(row.get("zone") or "")
        got_zone[z] = got_zone.get(z, 0) + 1
    tiers = g.get("reference_tiers") or {}
    out: dict[str, dict] = {}
    for did in (data.get("districts") or {}).get("districts") or {}:
        free_n = sum(1 for i, lot in enumerate(lots) if lot.get("zone") == did and i not in used_non)
        want = free_n * world.fill_share_bps(data, int(tiers.get(did) or 0)) // BPS
        out[did] = {"tier": int(tiers.get(did) or 0), "free": free_n, "want": want, "got": got_zone.get(did, 0)}
    return out


def layout_warnings(data: dict, g: dict) -> list[str]:
    notes: list[str] = []
    syn = (data.get("districts") or {}).get("synergies") or {}
    districts = (data.get("districts") or {}).get("districts") or {}
    placed = list(g.get("reference_layout") or [])
    for row in placed:
        kind, bid, zone = row.get("kind"), row.get("id"), row.get("zone")
        if kind == "base" and zone != "core":
            notes.append(f"L177 base {bid} placed in {zone}, not core")
        if kind == "beacon":
            want = None
            for did, d in districts.items():
                if d.get("beacon") == bid:
                    want = did
            if want and zone != want:
                notes.append(f"L177 beacon {bid} in {zone}, expected {want}")
        if kind == "synergy":
            home = world.home_district(list((syn.get(bid) or {}).get("requires") or []))
            if home and zone != home:
                notes.append(f"L177 synergy {bid} in {zone}, home is {home}")
    have = {(row.get("kind"), row.get("id")) for row in placed}
    for bid, b in ((data.get("buildings") or {}).get("buildings") or {}).items():
        if b.get("tier") == "base" and ("base", bid) not in have:
            notes.append(f"L177 base {bid} missing from reference_layout")
    for did, d in districts.items():
        beacon = d.get("beacon")
        if beacon and ("beacon", beacon) not in have:
            notes.append(f"L177 beacon {beacon} missing from reference_layout")
    for sid in syn:
        if ("synergy", sid) not in have:
            notes.append(f"L177 synergy {sid} missing from reference_layout")
    kinds = ((data.get("buildings") or {}).get("filler") or {}).get("kinds") or {}
    used = {row.get("lot_index") for row in placed if row.get("kind") != "filler"}
    for row in placed:
        if row.get("kind") != "filler":
            continue
        fid = row.get("id")
        spec = kinds.get(fid) or {}
        home = spec.get("district")
        zone = row.get("zone")
        if home and home not in (None, "any") and zone != home:
            notes.append(f"L192 filler {fid} with district {home} placed in {zone}")
        if row.get("lot_index") in used:
            notes.append(f"L192 filler {fid} reused a occupied lot")
    for did, row in district_budget(data, g).items():
        if int(row["got"]) != int(row["want"]):
            notes.append(f"L193 filler count in {did} is {row['got']}, fill share wants {row['want']}")
    params = (data.get("placement") or {}).get("params") or {}
    target = int((params.get("decor_target_share_bps") or {}).get("v") or 0)
    tol = int((params.get("decor_share_tolerance_bps") or {}).get("v") or 0)
    got = int(g.get("decor_realized_share_bps") or 0)
    if target and (got < target - tol or got > target + tol):
        notes.append(f"L174 decor realized {got} bps outside {target} ± {tol}")
    overlay = data.get("_authored_layout") if isinstance(data.get("_authored_layout"), dict) else {}
    lot_tiles: set[tuple[int, int]] = set()
    for lot in g.get("lots") or []:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                lot_tiles.add((xx, yy))
    grid = list(((g.get("scene") or {}).get("map")) or [])
    h = len(grid)
    w = len(grid[0]) if grid else 0
    for y, line in enumerate(grid):
        for x, ch in enumerate(line):
            if ch != "b":
                continue
            shore = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= ny < h and 0 <= nx < w and grid[ny][nx] == "~":
                    shore = True
                    break
            if not shore:
                notes.append(f"L369 b at {x},{y} is inland, not shore")
    period = int(((data.get("placement") or {}).get("params") or {}).get("road_period_tiles", {}).get("v") or 0)
    ox, oy = int(g.get("road_origin_x") or 0), int(g.get("road_origin_y") or 0)
    for row in overlay.get("props") or []:
        if not isinstance(row, dict):
            continue
        sid = str(row.get("id") or "")
        try:
            x, y = int(row["x"]), int(row["y"])
        except (TypeError, ValueError, KeyError):
            continue
        if sid.startswith("lantern") and period and not ((x - ox) % period == 0 and (y - oy) % period == 0):
            notes.append(f"L189 lantern at {x},{y} is not a road intersection")
        if sid.startswith(("vehicle", "drone", "walker_", "robot_")):
            if (x, y) in lot_tiles:
                notes.append(f"L190 {sid} occupies a lot at {x},{y}")
            if sid.startswith(("walker_", "robot_")):
                ch = ""
                if 0 <= y < len(grid):
                    line = grid[y]
                    if isinstance(line, str) and 0 <= x < len(line):
                        ch = line[x]
                if ch != "s":
                    notes.append(f"L190 {sid} sits on legend {ch!r}, not sidewalk")
    return notes


def _lots_of(g: dict) -> list[dict]:
    lots = []
    for i, lot in enumerate(g.get("lots") or []):
        lots.append(
            {
                "lot_index": i,
                "x": lot["x"],
                "y": lot["y"],
                "w": lot["w"],
                "h": lot["h"],
                "zone": lot.get("zone") or "",
                "side": lot.get("side") or "",
                "block_id": lot.get("block_id"),
            }
        )
    return lots


def _placed_of(g: dict) -> list[dict]:
    rows = []
    for row in g.get("reference_layout") or []:
        rows.append(
            {
                "id": row.get("id"),
                "kind": row.get("kind"),
                "lot_index": int(row["lot_index"]),
                "zone": row.get("zone"),
                "x": row.get("x"),
                "y": row.get("y"),
                "w": row.get("w"),
                "h": row.get("h"),
                **world.geom_of(row),
            }
        )
    return rows


def _png_bytes(rgb_source) -> bytes:
    buf = io.BytesIO()
    if isinstance(rgb_source, (bytes, bytearray)):
        Image.open(io.BytesIO(rgb_source)).convert("RGB").save(buf, format="PNG")
    else:
        rgb_source.convert("RGB").save(buf, format="PNG")
    return buf.getvalue()


def render_overlay(overlay: dict) -> tuple[bytes, dict, dict]:
    data, g = _world_of(overlay)
    canvas, iso = scene_mod.render_world(data, g)
    png = b""
    if canvas is not None:
        png = _png_bytes(canvas)
    return png, iso, g


def _iso_for(overlay: dict, data: dict, g: dict) -> dict:
    global _ISO, _PNG_KEY
    key = _overlay_key(overlay)
    if key == _PNG_KEY and _ISO:
        return _ISO
    if _overlay_identity(overlay):
        disk = _load_disk_iso()
        if disk:
            return disk
    iso = scene_mod.iso_meta_from_world(data, g)
    return iso


def _tag_hits(hits: list, g: dict) -> list[dict]:
    placed_at: dict[tuple[str, int, int], dict] = {}
    for row in g.get("reference_layout") or []:
        placed_at[(str(row.get("id") or ""), int(row["x"]), int(row["y"]))] = row
    out: list[dict] = []
    for raw in hits:
        if not isinstance(raw, dict):
            continue
        h = dict(raw)
        key = (str(h.get("id") or ""), int(h.get("tx") or 0), int(h.get("ty") or 0))
        row = placed_at.get(key)
        if row:
            h["role"] = "building"
            h["lot_index"] = int(row["lot_index"])
            h["bkind"] = row.get("kind")
        else:
            h["role"] = "prop"
        out.append(h)
    return out


def ensure_preview(overlay: dict | None = None) -> tuple[bytes, dict]:
    global _PNG, _ISO, _PNG_KEY
    blob = overlay if overlay is not None else _active_overlay()
    key = _overlay_key(blob)
    with _LOCK:
        if key == _PNG_KEY and _PNG:
            return _PNG, _ISO
    if _overlay_identity(blob) and PREVIEW_PNG.is_file():
        disk_png = PREVIEW_PNG.read_bytes()
        iso_hit = _load_disk_iso()
        with _LOCK:
            _PNG, _ISO, _PNG_KEY = disk_png, iso_hit or dict(_ISO), key
        return disk_png, iso_hit or {}
    png, iso, _g = render_overlay(blob)
    with _LOCK:
        if _overlay_key(_active_overlay()) == key:
            _PNG, _ISO, _PNG_KEY = png, iso, key
    return png, iso


def ensure_ground(overlay: dict | None = None) -> tuple[bytes, dict]:
    global _GROUND, _GROUND_KEY, _ISO
    blob = overlay if overlay is not None else _active_overlay()
    key = _overlay_key(blob)
    with _LOCK:
        if key == _GROUND_KEY and _GROUND:
            return _GROUND, _ISO
    with _GEN:
        with _LOCK:
            if key == _GROUND_KEY and _GROUND:
                return _GROUND, _ISO
        data, g = _world_of(blob)
        iso = scene_mod.iso_meta_from_world(data, g)
        want = (int(iso.get("width") or 0), int(iso.get("height") or 0))
        if _overlay_identity(blob) and GROUND_PNG.is_file():
            raw = GROUND_PNG.read_bytes()
            try:
                got = Image.open(io.BytesIO(raw)).size
            except OSError:
                got = (0, 0)
            if got == want and raw:
                with _LOCK:
                    if _overlay_key(_active_overlay()) == key:
                        _GROUND, _GROUND_KEY, _ISO = raw, key, iso
                return raw, iso
        canvas = scene_mod.paint_ground_canvas(data, g, iso)
        raw = _png_bytes(canvas) if canvas is not None else b""
        if raw and _overlay_identity(blob):
            PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
            GROUND_PNG.write_bytes(raw)
        with _LOCK:
            if _overlay_key(_active_overlay()) == key:
                _GROUND, _GROUND_KEY, _ISO = raw, key, iso
        return raw, iso


def invalidate_preview() -> None:
    global _PNG_KEY, _GROUND_KEY
    with _LOCK:
        _PNG_KEY = ""
        _GROUND_KEY = ""


def _asset_files() -> dict[str, Path]:
    global _ASSET_FILES
    if _ASSET_FILES is not None:
        return _ASSET_FILES
    out: dict[str, Path] = {}
    for row in world.load_assets():
        sid = str(row.get("id") or "")
        rel = str(row.get("file") or "")
        if not sid or not rel:
            continue
        path = REPO / rel
        if path.is_file():
            out[sid] = path
    _ASSET_FILES = out
    return out


def _game_sprite_path(sid: str) -> Path | None:
    for path in (
        PREVIEW_DIR / f"{sid}@4x.png",
        REPO / "art" / "out" / f"{sid}.png",
        REPO / "art" / "out" / "tiles" / f"{sid}.png",
    ):
        if path.is_file():
            return path
    return None


def _build_v2_preview(sid: str, src: Path) -> bytes:
    import numpy as np

    import atlas as atlas_mod

    im = Image.open(src).convert("RGB")
    game = _game_sprite_path(sid)
    if game is not None:
        gw, gh = Image.open(game).size
        if gw > 0 and gh > 0:
            tw, th = gw * 2, gh * 2
            long = max(tw, th)
            if long > 512:
                k = 512 / long
                tw = max(1, int(tw * k))
                th = max(1, int(th * k))
            im = im.resize((tw, th), Image.Resampling.LANCZOS)
    rgba = atlas_mod.key_to_rgba(np.asarray(im))
    out = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    raw = buf.getvalue()
    V2_DIR.mkdir(parents=True, exist_ok=True)
    (V2_DIR / f"{sid}.png").write_bytes(raw)
    return raw


def sprite_bytes(sid: str, v2: bool) -> bytes | None:
    if v2:
        cached = V2_DIR / f"{sid}.png"
        if cached.is_file():
            return cached.read_bytes()
        src = _asset_files().get(sid)
        if src is not None:
            with _V2_LOCK:
                if cached.is_file():
                    return cached.read_bytes()
                return _build_v2_preview(sid, src)
    path = _game_sprite_path(sid)
    if path is None:
        return None
    return path.read_bytes()


def studio_state() -> dict:
    overlay = _active_overlay()
    data, g = _world_of(overlay)
    iso = _iso_for(overlay, data, g)
    if not iso.get("hits"):
        iso = dict(iso)
        iso["hits"] = scene_mod.iso_meta_from_world(data, g).get("hits") or []
    hits = _tag_hits(list(iso.get("hits") or []), g)
    iso_pub = {k: v for k, v in iso.items() if k != "hits"}
    disk = _disk_overlay()
    empty = _overlay_identity(disk)
    png_len = len(_PNG)
    if not png_len and _overlay_identity(overlay) and PREVIEW_PNG.is_file():
        png_len = PREVIEW_PNG.stat().st_size
    scene = g.get("scene") or {}
    return {
        "grid_size": g.get("grid_size"),
        "layout_hash": g.get("layout_hash"),
        "overlay_empty": empty,
        "note": overlay.get("note"),
        "src": overlay.get("src"),
        "bps": BPS,
        "iso": iso_pub,
        "preview_bytes": png_len,
        "hits": hits,
        "map": list(scene.get("map") or []),
        "lots": _lots_of(g),
        "placed": _placed_of(g),
        "overlay_placements": list(overlay.get("placements") or []),
        "tiles": list(overlay.get("tiles") or []),
        "props": list(overlay.get("props") or []),
        "replace_placements": int(overlay.get("replace_placements") or 0),
        "replace_props": int(overlay.get("replace_props") or 0),
        "generated_props": generated_props_of(g)
        if not (int(overlay.get("replace_props") or 0) or (overlay.get("props") or []))
        else list(overlay.get("props") or []),
        "catalog": catalog_of(data),
        "prop_catalog": prop_catalog(),
        "catalog_groups": sprite_catalog(),
        "ground": [dict(row) for row in GROUND],
        "structural": list(world.TILE_STRUCTURAL),
        "water_margin": int((((data.get("placement") or {}).get("params") or {}).get("water_margin_tiles") or {}).get("v") or 0),
        "cliff_depth": int((((data.get("render") or {}).get("params") or {}).get("cliff_depth_px") or {}).get("v") or 0),
        "road_span": int((((data.get("render") or {}).get("params") or {}).get("road_span_tiles") or {}).get("v") or 0),
        "budget": district_budget(data, g),
        "warnings": layout_warnings(data, g),
        "decor_bps": g.get("decor_realized_share_bps"),
    }


def _validate_fixture(blob: dict) -> list[str]:
    doc = schema()
    sub = {"$schema": doc["$schema"], "$defs": doc["$defs"], "$ref": "#/$defs/fixture_authored_layout_file"}
    errs = []
    for err in sorted(Draft202012Validator(sub).iter_errors(blob), key=str):
        where = "/".join(str(p) for p in err.absolute_path) or "<root>"
        errs.append(f"{where}: {err.message}")
    return errs


def _geom_fields(row: dict) -> dict:
    return world.geom_of(row)


def _clean_placements(rows: list) -> list[dict]:
    out: list[dict] = []
    seen: set[int] = set()
    for row in rows:
        if not isinstance(row, dict) or row.get("id") is None or row.get("lot_index") is None:
            continue
        idx = int(row["lot_index"])
        if idx in seen:
            continue
        seen.add(idx)
        item = {"id": str(row["id"]), "lot_index": idx}
        kind = row.get("kind")
        if kind in ("base", "beacon", "synergy", "filler"):
            item["kind"] = kind
        item.update(_geom_fields(row))
        out.append(item)
    return out


def _clean_tiles(rows: list) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[int, int]] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        ch = str(row.get("ch") or "")
        if ch not in world.TILE_PATCH_OK:
            continue
        try:
            x, y = int(row["x"]), int(row["y"])
        except (TypeError, ValueError, KeyError):
            continue
        if (x, y) in seen:
            continue
        seen.add((x, y))
        out.append({"x": x, "y": y, "ch": ch})
    return out


def _clean_props(rows: list) -> list[dict]:
    out: list[dict] = []
    for row in rows:
        if not isinstance(row, dict) or row.get("id") is None:
            continue
        sid = str(row["id"])
        try:
            x, y = int(row["x"]), int(row["y"])
        except (TypeError, ValueError, KeyError):
            continue
        out.append({"id": sid, "x": x, "y": y, **_geom_fields(row)})
    return out


def make_overlay(
    placements: list,
    tiles: list,
    props: list,
    revert: bool,
    replace_placements: int = 0,
    replace_props: int = 0,
) -> dict:
    current = _disk_overlay()
    blob = {
        "note": current.get("note") or "Owner island overlay.",
        "src": current.get("src") or "docs/WORLD.md §5",
        "placements": [] if revert else _clean_placements(placements),
        "tiles": [] if revert else _clean_tiles(tiles),
        "props": [] if revert else _clean_props(props),
    }
    if not revert:
        if int(replace_placements or 0):
            blob["replace_placements"] = 1
        elif _blank_replace(current, "placements", "replace_placements"):
            blob["placements"] = []
            blob["replace_placements"] = 1
        if int(replace_props or 0):
            blob["replace_props"] = 1
        elif _blank_replace(current, "props", "replace_props"):
            blob["props"] = []
            blob["replace_props"] = 1
    return blob


def stage_overlay(blob: dict, *, rebuild: bool = True) -> dict:
    global _STAGED
    errs = _validate_fixture(blob)
    if errs:
        return {"ok": False, "errors": errs}
    with _LOCK:
        _STAGED = blob
    if not rebuild:
        return {"ok": True, "errors": []}
    world.clear_world_memo()
    invalidate_preview()
    data, g = _world_of(blob)
    iso = _iso_for(blob, data, g)
    if not iso.get("hits"):
        iso = dict(iso)
        iso["hits"] = scene_mod.iso_meta_from_world(data, g).get("hits") or []
    hits = _tag_hits(list(iso.get("hits") or []), g)
    iso_pub = {k: v for k, v in iso.items() if k != "hits"}
    return {
        "ok": True,
        "errors": [],
        "iso": iso_pub,
        "hits": hits,
        "preview_bytes": 0,
        "layout_hash": g.get("layout_hash"),
        "warnings": layout_warnings(data, g),
        "budget": district_budget(data, g),
        "decor_bps": g.get("decor_realized_share_bps"),
        "placed": _placed_of(g),
        "map": list((g.get("scene") or {}).get("map") or []),
    }


def write_overlay(blob: dict) -> dict:
    global _STAGED
    errs = _validate_fixture(blob)
    if errs:
        return {"ok": False, "errors": errs}
    FIXTURE_PATH.write_text(json.dumps(blob, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    world.clear_world_memo()
    with _LOCK:
        _STAGED = None
    invalidate_preview()
    state = studio_state()
    return {"ok": True, "errors": [], "warnings": state["warnings"], "state": state}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
        self.wfile.flush()

    def _json(self, code: int, payload: dict) -> None:
        self._send(code, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        body = json.loads(raw.decode("utf-8"))
        if not isinstance(body, dict):
            raise ValueError("body must be an object")
        return body

    def do_GET(self) -> None:  # noqa: N802
        try:
            self._do_GET()
        except Exception:
            traceback.print_exc()
            try:
                self._send(500, b"studio failed", "text/plain; charset=utf-8")
            except Exception:
                pass

    def _do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._send(200, HTML_PATH.read_bytes(), "text/html; charset=utf-8")
            return
        if path == "/api/state":
            self._json(200, studio_state())
            return
        if path == "/preview.png":
            png, _iso = ensure_preview()
            if not png:
                self._send(404, b"no preview", "text/plain; charset=utf-8")
                return
            self._send(200, png, "image/png")
            return
        if path == "/preview/ground.png":
            png, _iso = ensure_ground()
            if not png:
                self._send(404, b"no ground", "text/plain; charset=utf-8")
                return
            self._send(200, png, "image/png")
            return
        if path.startswith("/api/sprite/"):
            sid = unquote(path.rsplit("/", 1)[-1])
            if not sid or "/" in sid or "\\" in sid or ".." in sid:
                self._send(404, b"no sprite", "text/plain; charset=utf-8")
                return
            qs = parse_qs(urlparse(self.path).query)
            flag = (qs.get("v2") or ["0"])[0]
            raw = sprite_bytes(sid, flag in ("1", "true"))
            if not raw:
                self._send(404, b"no sprite", "text/plain; charset=utf-8")
                return
            self._send(200, raw, "image/png")
            return
        self._send(404, b"not found", "text/plain; charset=utf-8")

    def do_POST(self) -> None:  # noqa: N802
        try:
            self._do_POST()
        except Exception:
            traceback.print_exc()
            try:
                self._json(500, {"ok": False, "errors": ["studio failed"]})
            except Exception:
                pass

    def _do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            body = self._read_json()
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            self._json(400, {"ok": False, "errors": [str(exc)]})
            return
        revert = bool(body.get("revert"))
        blob = make_overlay(
            body.get("placements") or [],
            body.get("tiles") or [],
            body.get("props") or [],
            revert,
            int(body.get("replace_placements") or 0),
            int(body.get("replace_props") or 0),
        )
        if path == "/api/stage":
            rebuild = bool(body.get("preview") or body.get("rebuild"))
            result = stage_overlay(blob, rebuild=rebuild)
            if result.get("ok") and not body.get("preview"):
                result["preview_bytes"] = 0
            self._json(200 if result["ok"] else 400, result)
            return
        if path == "/api/save":
            result = write_overlay(blob)
            self._json(200 if result["ok"] else 400, result)
            return
        self._send(404, b"not found", "text/plain; charset=utf-8")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Owner isometric studio for the shared island.")
    ap.add_argument("--port", type=int, default=8765, help="loopback port (not a pack listen key)")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    if args.port <= 0:
        print("port must be positive", file=sys.stderr)
        return 2
    httpd = ThreadingHTTPServer((HOST, args.port), Handler)
    httpd.daemon_threads = True
    url = f"http://{HOST}:{args.port}/"
    print(f"studio     : {url}", flush=True)
    print("live sprites on ground; first open builds art/preview/studio_ground.png", flush=True)
    print("after Save: python content/build.py && python art/pipeline/scene.py", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
