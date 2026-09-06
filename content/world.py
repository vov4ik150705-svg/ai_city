"""T10 city layout generator.

Pure functions, integers only. No float, no random, no wall clock, no network, no PIL.
Layout is presentation: counters are a pack constant, coordinates are a function of seed.
"""

from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path

try:
    from pack import BPS, PARAM_DIR, REPO, ROOT, canonical, fixture, load_json, sections
except ImportError:
    from content.pack import BPS, PARAM_DIR, REPO, ROOT, canonical, fixture, load_json, sections

CITY_HOURS = 24
SIDES = ("n", "e", "s", "w")
COUNTER_KEYS = (
    "lots_per_zone",
    "lots_by_kind",
    "park_slots",
    "plaza_slots",
    "lantern_count",
    "tree_count",
    "vehicle_count",
    "drone_count",
    "road_tiles",
    "land_tiles",
    "water_tiles",
    "filler_occupied_total",
    "mini_island_count",
    "blocks_on_land",
    "lots_total",
)
PRNG_STREAMS = (
    "shore",
    "zone_rotation",
    "filler",
    "tree",
    "lantern_phase",
    "vehicle",
    "drone",
    "mini_island",
    "walker",
    "street",
    "robot",
)
SCENE_LEGEND = {
    "~": "water",
    ".": "grass",
    "r": "road",
    "s": "sidewalk",
    "c": "crosswalk",
    "p": "plaza_tile",
    "m": "masonry",
    "k": "parking",
    "b": "beach",
    "d": "dock",
    "w": "waterfall",
}
TREE_KINDS = (
    "tree_pink",
    "tree_green",
    "tree_dark",
    "tree_bare",
    "tree_autumn",
    "tree_pine",
    "tree_green_02",
    "tree_green_03",
    "tree_green_04",
    "tree_pink_02",
)
INDUSTRIAL_ZONES = frozenset({"compute", "energy", "logistics"})
RESIDENTIAL_FILLER = frozenset({"residential_block", "residential_block_02", "residential_block_03"})
STREET_IDS = (
    "kiosk",
    "kiosk_ad",
    "kiosk_tall",
    "bench",
    "bench_02",
    "planter",
    "hedge",
    "trash_can",
    "phone_booth",
    "phone_booth_02",
    "phone_booth_red",
    "sign_post",
    "sign_caution",
    "traffic_cone",
    "utility_box",
    "barrier",
    "parking_sign",
    "banner",
    "bus_stop",
    "flower",
    "flower_02",
)
BOAT_IDS = (
    "boat_small",
    "boat_cabin",
    "boat_tug",
    "boat_tug_02",
    "boat_work",
    "boat_yacht",
    "ship_cargo",
    "buoy",
    "buoy_02",
)
RESIDENTIAL_SKINS = (
    "residential_block",
    "residential_block_02",
    "residential_block_03",
)
PLOT_LOW = (
    "planter",
    "bush",
    "bush_02",
    "flower",
    "flower_02",
)


def pp(data: dict, name: str) -> int:
    row = ((data.get("placement") or {}).get("params") or {}).get(name) or {}
    return int(row.get("v") or 0)


def road_span_of(data: dict) -> int:
    """Diamonds per carriageway. One diamond is one lane (R-V-66)."""
    v = _pv(data.get("render") or {}, "road_span_tiles")
    return v if v > 0 else 1


def on_road_grid(x: int, y: int, x0: int, y0: int, period: int, span: int) -> bool:
    if period <= 0 or span <= 0:
        return False
    return (x - x0) % period < span or (y - y0) % period < span


def _pv(section: dict, name: str) -> int:
    row = (section.get("params") or {}).get(name) or {}
    return int(row.get("v") or 0)


def world_prng(city_id: str, stream: str, index: int) -> int:
    """Domain-separated sha256[:8] over '{city_id}:layout:{stream}:{index}'."""
    msg = f"{city_id}:layout:{stream}:{index}".encode("utf-8")
    return int.from_bytes(hashlib.sha256(msg).digest()[:8], "big")


def draw_below(city_id: str, stream: str, index: int, n: int) -> int:
    """Uniform in [0, n) by bit-mask rejection. No remainder on a non-power-of-two."""
    if n <= 1:
        return 0
    k = n.bit_length()
    mask = (1 << k) - 1
    i = index
    while True:
        x = world_prng(city_id, stream, i) & mask
        i += 1
        if x < n:
            return x


def ceil_div(a: int, b: int) -> int:
    if b <= 0:
        return 0
    return (a + b - 1) // b


def load_assets() -> list[dict]:
    path = REPO / "art" / "pipeline" / "assets.json"
    if not path.exists():
        return []
    return list((load_json(path).get("assets") or []))


def load_assets_pending() -> list[dict]:
    path = REPO / "art" / "pipeline" / "assets_pending.json"
    if not path.exists():
        return []
    blob = load_json(path)
    if isinstance(blob, list):
        return list(blob)
    return list(blob.get("assets") or [])


def known_asset_ids() -> set[str]:
    return {str(a["id"]) for a in load_assets() if a.get("id")}


def listed_ids(names: tuple[str, ...]) -> list[str]:
    known = known_asset_ids()
    return [n for n in names if n in known]


def prefix_ids(
    prefix: str, *, exclude_suffix: tuple[str, ...] = (), exclude_contains: tuple[str, ...] = ()
) -> list[str]:
    out = []
    for sid in sorted(known_asset_ids()):
        if not sid.startswith(prefix):
            continue
        if any(sid.endswith(sfx) for sfx in exclude_suffix):
            continue
        if any(tok in sid for tok in exclude_contains):
            continue
        out.append(sid)
    return out


def pop_pool(city_id: str, stream: str, cursor: int, pool: list) -> tuple[object, int]:
    pick = draw_below(city_id, stream, cursor, len(pool))
    return pool.pop(pick), cursor + 1


def tile_w_px() -> int:
    path = REPO / "art" / "pipeline" / "assets.json"
    if path.exists():
        return int(load_json(path).get("tile_w") or 64)
    return 64


def all_footprints(data: dict) -> dict[str, tuple[int, int]]:
    out: dict[str, tuple[int, int]] = {}
    for row in load_assets() + load_assets_pending():
        fp = row.get("footprint") or [1, 1]
        out[str(row["id"])] = (int(fp[0]), int(fp[1]))
    for bid, b in ((data.get("buildings") or {}).get("buildings") or {}).items():
        sprite = b.get("sprite")
        if sprite and sprite in out:
            out[bid] = out[sprite]
        elif bid not in out:
            out[bid] = (2, 2)
    for fid, f in ((data.get("buildings") or {}).get("filler") or {}).get("kinds", {}).items():
        sprite = f.get("sprite")
        if sprite and sprite in out:
            out[fid] = out[sprite]
        elif fid not in out:
            out[fid] = (2, 2)
    return out


def building_footprints(data: dict) -> dict[str, tuple[int, int]]:
    fps = all_footprints(data)
    out = {}
    for bid in (data.get("buildings") or {}).get("buildings") or {}:
        out[bid] = fps.get(bid, (2, 2))
    return out


def lot_ring_depth_of(data: dict) -> int:
    depth = pp(data, "lot_min_side_tiles") or 1
    for w, h in building_footprints(data).values():
        side = w if w < h else h
        if side > depth:
            depth = side
    return depth


def longest_footprint_w(data: dict) -> int:
    longest = pp(data, "lot_min_side_tiles") or 1
    for w, h in building_footprints(data).values():
        if w > longest:
            longest = w
        if h > longest:
            longest = h
    return longest


def min_road_period(data: dict) -> int:
    depth = lot_ring_depth_of(data)
    longest = longest_footprint_w(data)
    gap = pp(data, "building_gap_tiles")
    small = pp(data, "lot_min_side_tiles") or 1
    span = road_span_of(data)
    side_for_two = longest + gap + small
    side_for_yard = 2 * depth + 1
    side = side_for_two if side_for_two > side_for_yard else side_for_yard
    if side < longest:
        side = longest
    return side + span


def pack_widths(side_len: int, gap: int, sizes: list[int]) -> list[int]:
    sizes_desc = sorted({s for s in sizes if s > 0}, reverse=True)
    if not sizes_desc:
        return []
    out: list[int] = []
    pos = 0
    first = True
    while True:
        need = 0 if first else gap
        remaining = side_len - pos
        placed = 0
        for sz in sizes_desc:
            if remaining >= need + sz:
                pos += need
                out.append(sz)
                pos += sz
                first = False
                placed = 1
                break
        if not placed:
            break
    return out


def _pack_dims_for_zone(data: dict, zone: str | None, along_ns: bool) -> list[int]:
    """Core packs only base footprints. A 4-wide district beacon must not leave 1-tile remnant lots in City Hall's block (R-V-79)."""
    depth = lot_ring_depth_of(data)
    sizes = [pp(data, "lot_min_side_tiles") or 1]
    blds = (data.get("buildings") or {}).get("buildings") or {}
    for bid, (w, h) in building_footprints(data).items():
        spec = blds.get(bid) or {}
        if zone == "core" and spec.get("tier") != "base":
            continue
        if along_ns:
            if h <= depth:
                sizes.append(w)
        elif w <= depth:
            sizes.append(h)
    return sizes


def ns_lot_widths(data: dict, block_side: int, zone: str | None = None) -> list[int]:
    gap = pp(data, "building_gap_tiles")
    return pack_widths(block_side, gap, _pack_dims_for_zone(data, zone, True))


def ew_lot_heights(data: dict, along: int, zone: str | None = None) -> list[int]:
    gap = pp(data, "building_gap_tiles")
    return pack_widths(along, gap, _pack_dims_for_zone(data, zone, False))


def lots_per_block_of(data: dict) -> int:
    p = pp(data, "road_period_tiles")
    side = p - road_span_of(data)
    depth = lot_ring_depth_of(data)
    along = side - 2 * depth
    return len(ns_lot_widths(data, side)) * 2 + len(ew_lot_heights(data, along)) * 2


def home_district(requires: list[str]) -> str:
    return sorted(requires)[0] if requires else ""


def filler_kinds_for_lots(data: dict) -> dict[str, dict]:
    kinds = ((data.get("buildings") or {}).get("filler") or {}).get("kinds") or {}
    skip = {"street_light", "tree", "vehicle", "drone", "park", "plaza", "district_billboard"}
    return {k: v for k, v in kinds.items() if k not in skip}


def lots_needed_of(data: dict) -> int:
    base = [
        bid
        for bid, b in ((data.get("buildings") or {}).get("buildings") or {}).items()
        if b.get("tier") == "base"
    ]
    core = len(base)
    per_kind = pp(data, "filler_slots_per_kind")
    syn = (data.get("districts") or {}).get("synergies") or {}
    districts = list(((data.get("districts") or {}).get("districts") or {}))
    fillers = filler_kinds_for_lots(data)
    total = core
    for did in districts:
        total += 1
        total += 1
        for sid, s in syn.items():
            if home_district(list(s.get("requires") or [])) == did:
                total += 1
        for _fid, f in fillers.items():
            if f.get("district") == did:
                total += per_kind
    return total


def diamond_block_count(ring: int) -> int:
    """Full L1 diamond of radius ring, including interior rings."""
    if ring <= 0:
        return 1
    return 1 + 2 * ring * (ring + 1)


def blocks_required_of(data: dict) -> int:
    lpb = lots_per_block_of(data)
    need = ceil_div(lots_needed_of(data), lpb) if lpb else 0
    ring = pp(data, "zone_anchor_ring_step")
    diamond = diamond_block_count(ring)
    raw = need if need > diamond else diamond
    return raw + pp(data, "blocks_reserve")


def l1_ring(radius: int) -> list[tuple[int, int]]:
    if radius <= 0:
        return [(0, 0)]
    pts: list[tuple[int, int]] = []
    for x, y in zip(range(radius, 0, -1), range(0, radius)):
        pts.append((x, y))
    for x, y in zip(range(0, -radius, -1), range(radius, 0, -1)):
        pts.append((x, y))
    for x, y in zip(range(-radius, 0), range(0, -radius, -1)):
        pts.append((x, y))
    for x, y in zip(range(0, radius), range(-radius, 0)):
        pts.append((x, y))
    return pts


def land_mask(cx: int, cy: int, r: int, size: int) -> list[list[int]]:
    g = [[0] * size for _ in range(size)]
    rr = r * r
    for y in range(size):
        dy = y - cy
        for x in range(size):
            dx = x - cx
            if dx * dx + dy * dy <= rr:
                g[y][x] = 1
    return g


def road_mask(
    size: int, x0: int, y0: int, period: int, land: list[list[int]], span: int = 1
) -> list[list[int]]:
    g = [[0] * size for _ in range(size)]
    if period <= 0:
        return g
    for y in range(size):
        for x in range(size):
            if not land[y][x]:
                continue
            if on_road_grid(x, y, x0, y0, period, span):
                g[y][x] = 1
    return g


def block_ids_on_land(
    size: int, x0: int, y0: int, period: int, land: list[list[int]], cx: int, cy: int, span: int = 1
) -> list[dict]:
    """Blocks whose interior and bounding roads are land and in-bounds."""
    if period <= 0:
        return []
    kx0 = -((x0) // period) - 2
    kx1 = (size - x0) // period + 2
    ky0 = -((y0) // period) - 2
    ky1 = (size - y0) // period + 2
    found = []
    for ky in range(ky0, ky1 + 1):
        for kx in range(kx0, kx1 + 1):
            west = x0 + kx * period
            north = y0 + ky * period
            east = west + period
            south = north + period
            if west < 0 or north < 0 or east >= size or south >= size:
                continue
            ok = 1
            for y in range(north, south + 1):
                for x in range(west, east + 1):
                    if not land[y][x]:
                        ok = 0
                        break
                if not ok:
                    break
            if not ok:
                continue
            found.append(
                {
                    "kx": kx,
                    "ky": ky,
                    "west": west,
                    "north": north,
                    "east": east,
                    "south": south,
                    "x0": west + span,
                    "y0": north + span,
                    "cx": west + period // 2,
                    "cy": north + period // 2,
                }
            )
    found.sort(key=lambda b: ((b["cx"] - cx) ** 2 + (b["cy"] - cy) ** 2, b["kx"], b["ky"]))
    return found


def island_radius_tiles_of(data: dict) -> int:
    p = pp(data, "road_period_tiles")
    margin = pp(data, "water_margin_tiles")
    need = blocks_required_of(data)
    for r in range(p, p * 12):
        size = 2 * r + 1 + 2 * margin
        cx = r + margin
        cy = r + margin
        x0 = cx - p // 2
        y0 = cy - p // 2
        land = land_mask(cx, cy, r, size)
        blocks = block_ids_on_land(size, x0, y0, p, land, cx, cy, road_span_of(data))
        if len(blocks) >= need:
            return r
    return p * 12


def lots_of_block(data: dict, block: dict, block_id: int) -> list[dict]:
    p = pp(data, "road_period_tiles")
    side = p - road_span_of(data)
    depth = lot_ring_depth_of(data)
    gap = pp(data, "building_gap_tiles")
    bx, by = block["x0"], block["y0"]
    zone = str(block.get("zone") or "") or None
    ns = ns_lot_widths(data, side, zone)
    along = side - 2 * depth
    ew = ew_lot_heights(data, along, zone)
    fps = building_footprints(data)
    lots: list[dict] = []
    idx = 0

    def accepts_for(w: int, h: int, side_name: str) -> list[str]:
        acc = []
        for bid, (fw, fh) in sorted(fps.items()):
            if side_name in ("n", "s"):
                if fw <= w and fh <= h:
                    acc.append(bid)
            else:
                if fw <= w and fh <= h and fw <= depth:
                    acc.append(bid)
        return acc

    def road_tile_for(side_name: str, x: int, y: int, w: int, h: int) -> list[int]:
        if side_name == "n":
            return [x + w // 2, y - 1]
        if side_name == "s":
            return [x + w // 2, y + h]
        if side_name == "w":
            return [x - 1, y + h // 2]
        return [x + w, y + h // 2]

    def add(side_name: str, x: int, y: int, w: int, h: int) -> None:
        nonlocal idx
        lots.append(
            {
                "block_id": block_id,
                "index": idx,
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "side": side_name,
                "road_tile": road_tile_for(side_name, x, y, w, h),
                "zone": "",
                "accepts": accepts_for(w, h, side_name),
            }
        )
        idx += 1

    pos = 0
    for i, w in enumerate(ns):
        add("n", bx + pos, by, w, depth)
        pos += w + (gap if i + 1 < len(ns) else 0)
    pos = 0
    for i, h in enumerate(ew):
        add("e", bx + side - depth, by + depth + pos, depth, h)
        pos += h + (gap if i + 1 < len(ew) else 0)
    pos = 0
    for i, w in enumerate(ns):
        add("s", bx + pos, by + side - depth, w, depth)
        pos += w + (gap if i + 1 < len(ns) else 0)
    pos = 0
    for i, h in enumerate(ew):
        add("w", bx, by + depth + pos, depth, h)
        pos += h + (gap if i + 1 < len(ew) else 0)
    return lots


def zone_assignment(
    data: dict, blocks: list[dict], city_id: str
) -> tuple[dict[int, str], dict[str, int], int]:
    from functools import cmp_to_key

    districts = sorted(((data.get("districts") or {}).get("districts") or {}))
    n = len(districts)
    core_id = 0
    for i, b in enumerate(blocks):
        if b["kx"] == 0 and b["ky"] == 0:
            core_id = i
            break
    outer = [i for i in range(len(blocks)) if i != core_id]
    rot = draw_below(city_id, "zone_rotation", 0, n) if n else 0
    zone_of = {core_id: "core"}
    if not outer or not n:
        return zone_of, {did: 0 for did in districts}, rot

    def polar_cmp(i: int, j: int) -> int:
        ax, ay = blocks[i]["kx"], blocks[i]["ky"]
        bx, by = blocks[j]["kx"], blocks[j]["ky"]
        cross = ax * by - ay * bx
        if cross > 0:
            return -1
        if cross < 0:
            return 1
        da = ax * ax + ay * ay
        db = bx * bx + by * by
        if da < db:
            return -1
        if da > db:
            return 1
        if i < j:
            return -1
        if i > j:
            return 1
        return 0

    ordered = sorted(outer, key=cmp_to_key(polar_cmp))
    quota = len(outer) // n
    extra = len(outer) - quota * n
    # Equal named sizes: extras go to canonical district[0], never to a rotated wedge.
    cursor = 0
    for w in range(n):
        did = districts[(w + rot) % n]
        for _ in range(quota):
            zone_of[ordered[cursor]] = did
            cursor += 1
    for k in range(extra):
        zone_of[ordered[cursor]] = districts[0]
        cursor += 1
    counts = {did: 0 for did in ["core"] + districts}
    for z in zone_of.values():
        counts[z] = counts.get(z, 0) + 1
    return zone_of, counts, rot


def fill_share_bps(data: dict, tier: int) -> int:
    if tier <= 0:
        return 0
    step = pp(data, "district_fill_step_bps")
    share = step * tier
    if share > BPS:
        return BPS
    return share


def reference_tiers(data: dict) -> dict[str, int]:
    out = {}
    for did, d in ((data.get("districts") or {}).get("districts") or {}).items():
        out[did] = 1 if d.get("playable_v1") else 0
    return out


def pick_lot(lots: list[dict], zone: str, footprint: tuple[int, int], used: set[int], prefer_block: int | None) -> int | None:
    fw, fh = footprint
    scored = []
    for i, lot in enumerate(lots):
        if i in used:
            continue
        if lot["zone"] != zone:
            continue
        if lot["w"] < fw or lot["h"] < fh:
            continue
        if lot["side"] in ("e", "w") and fw > lot["w"]:
            continue
        key = (
            0 if prefer_block is not None and lot["block_id"] == prefer_block else 1,
            lot["w"] * lot["h"],
            abs(lot["x"] - lot.get("_zx", lot["x"])) + abs(lot["y"] - lot.get("_zy", lot["y"])),
            i,
        )
        scored.append((key, i))
    if not scored:
        return None
    scored.sort()
    return scored[0][1]


def reference_layout(
    data: dict,
    lots: list[dict],
    blocks: list[dict],
    zone_of: dict[int, str],
    city_id: str,
    tiers: dict[str, int],
) -> list[dict]:
    fps = all_footprints(data)
    blds = (data.get("buildings") or {}).get("buildings") or {}
    syn = (data.get("districts") or {}).get("synergies") or {}
    districts = (data.get("districts") or {}).get("districts") or {}
    used: set[int] = set()
    placed: list[dict] = []
    centroids = {}
    for z in set(zone_of.values()):
        xs, ys, n = 0, 0, 0
        for i, blk in enumerate(blocks):
            if zone_of.get(i) == z:
                xs += blk["cx"]
                ys += blk["cy"]
                n += 1
        centroids[z] = (xs // n if n else 0, ys // n if n else 0)
    for lot in lots:
        zx, zy = centroids.get(lot["zone"], (lot["x"], lot["y"]))
        lot["_zx"] = zx
        lot["_zy"] = zy

    def place(kind: str, bid: str, zone: str, prefer: int | None) -> None:
        fp = fps.get(bid, fps.get(kind, (2, 2)))
        idx = pick_lot(lots, zone, fp, used, prefer)
        if idx is None:
            return
        used.add(idx)
        lot = lots[idx]
        placed.append(
            {
                "kind": kind,
                "id": bid,
                "lot_index": idx,
                "block_id": lot["block_id"],
                "zone": zone,
                "x": lot["x"],
                "y": lot["y"],
                "w": fp[0],
                "h": fp[1],
            }
        )

    base_order = ["city_hall", "workshop", "agent_hub", "power_node", "bank", "exchange"]
    for bid in base_order:
        if bid in blds:
            place("base", bid, "core", 0 if blocks and blocks[0]["kx"] == 0 else None)
    anchor_block = {}
    for i, blk in enumerate(blocks):
        z = zone_of.get(i)
        if z and z != "core" and z not in anchor_block:
            anchor_block[z] = i
        elif z and z != "core":
            c0 = centroids[z]
            cur = blocks[anchor_block[z]]
            if abs(blk["cx"] - c0[0]) + abs(blk["cy"] - c0[1]) < abs(cur["cx"] - c0[0]) + abs(cur["cy"] - c0[1]):
                anchor_block[z] = i
    for did, d in sorted(districts.items()):
        beacon = d.get("beacon")
        if beacon:
            place("beacon", beacon, did, anchor_block.get(did))
    for sid, s in sorted(syn.items()):
        home = home_district(list(s.get("requires") or []))
        place("synergy", sid, home, None)

    fillers = filler_kinds_for_lots(data)
    gap = pp(data, "building_gap_tiles")
    beacons = {p["zone"]: p for p in placed if p.get("kind") == "beacon"}
    for did in sorted(districts):
        zx, zy = centroids.get(did, (0, 0))
        free = [
            i
            for i, lot in enumerate(lots)
            if lot["zone"] == did and i not in used
        ]
        spread = -1 if did in INDUSTRIAL_ZONES else 1
        free.sort(
            key=lambda i: (
                1 if lot_touches_foreign_zone(lots[i], lots, gap) else 0,
                spread * (abs(int(lots[i]["x"]) - zx) + abs(int(lots[i]["y"]) - zy)),
                int(lots[i]["y"]),
                int(lots[i]["x"]),
            )
        )
        share = fill_share_bps(data, tiers.get(did, 0))
        n_fill = len(free) * share // BPS
        kinds = [k for k, f in fillers.items() if f.get("district") in (did, "any")]
        beacon = beacons.get(did)
        picked: list[int] = []
        if did == "consumer":
            shop_id = "shop_row" if "shop_row" in fillers else (kinds[0] if kinds else "residential_block")
            shop_c: list[int] = []
            house_c: list[int] = []
            for i in free:
                lot = lots[i]
                wall = beacon is not None and (
                    lots_ortho_touch(lot, beacon, gap) or lot["block_id"] == beacon.get("block_id")
                )
                if wall:
                    shop_c.append(i)
                else:
                    house_c.append(i)
            if beacon is not None:
                house_c.sort(
                    key=lambda i: (
                        -(
                            abs(int(lots[i]["x"]) - int(beacon["x"]))
                            + abs(int(lots[i]["y"]) - int(beacon["y"]))
                        ),
                        int(lots[i]["y"]),
                        int(lots[i]["x"]),
                    )
                )
            n_house = min(len(house_c), max(1, n_fill // 3) if house_c else 0)
            n_shop = n_fill - n_house
            if n_shop > len(shop_c):
                steal = [i for i in house_c if i not in shop_c]
                shop_c.extend(steal[: n_shop - len(shop_c)])
                house_c = [i for i in house_c if i not in shop_c]
                n_house = min(len(house_c), n_fill - min(n_shop, len(shop_c)))
                n_shop = n_fill - n_house
            pairs: list[tuple[int, str]] = [(i, shop_id) for i in shop_c[:n_shop]]
            pairs.extend((i, "residential_block") for i in house_c[:n_house])
            used_i = {p[0] for p in pairs}
            for i in free:
                if len(pairs) >= n_fill:
                    break
                if i in used_i:
                    continue
                pairs.append((i, shop_id if i in shop_c else "residential_block"))
            picked_kinds = pairs[:n_fill]
        else:
            for i in free:
                if len(picked) >= n_fill:
                    break
                if any(lots_ortho_touch(lots[i], lots[j], 0) for j in picked):
                    continue
                if beacon is not None and lots_ortho_touch(lots[i], beacon, 0):
                    continue
                picked.append(i)
            if len(picked) < n_fill:
                for i in free:
                    if i in picked:
                        continue
                    if beacon is not None and lots_ortho_touch(lots[i], beacon, 0):
                        continue
                    picked.append(i)
                    if len(picked) >= n_fill:
                        break
            if len(picked) < n_fill:
                for i in free:
                    if i in picked:
                        continue
                    picked.append(i)
                    if len(picked) >= n_fill:
                        break
            picked_kinds = [
                (i, kinds[n % len(kinds)] if kinds else "office_block")
                for n, i in enumerate(picked[:n_fill])
            ]
        for n, (lot_i, kind) in enumerate(picked_kinds):
            used.add(lot_i)
            if data.get("_attack_foreign_filler") and did != "compute":
                kind = "server_annex"
            lot = lots[lot_i]
            fp = fps.get(kind, (2, 2))
            placed.append(
                {
                    "kind": "filler",
                    "id": kind,
                    "lot_index": lot_i,
                    "block_id": lot["block_id"],
                    "zone": did,
                    "x": lot["x"],
                    "y": lot["y"],
                    "w": fp[0],
                    "h": fp[1],
                    "district": did,
                }
            )
    return placed


GEOM_KEYS = ("ox", "oy", "lift", "w_px", "h_px", "flip")


def geom_of(row: dict | None) -> dict:
    """Pixel instance fields for the owner overlay (R-V-60, R-V-61). Zero/missing omitted."""
    if not isinstance(row, dict):
        return {}
    out: dict = {}
    for key in GEOM_KEYS:
        try:
            val = int(row.get(key) or 0)
        except (TypeError, ValueError):
            continue
        if val:
            out[key] = val
    return out


def scene_object(sid: str, tx: int, ty: int, geom: dict | None = None) -> dict:
    row: dict = {"id": sid, "tile": [tx, ty]}
    if geom:
        row.update(geom)
    return row


def _authored_layout_fp(data: dict) -> str:
    overlay = data.get("_authored_layout")
    if isinstance(overlay, dict):
        return hashlib.sha256(canonical(overlay)).hexdigest()
    path = ROOT / "fixtures" / "authored_layout.json"
    if path.is_file():
        return hashlib.sha256(path.read_bytes()).hexdigest()
    return ""


def load_authored_blob(data: dict) -> dict:
    overlay = data.get("_authored_layout")
    if isinstance(overlay, dict):
        return overlay
    try:
        blob = fixture("authored_layout")
    except Exception:
        return {}
    return blob if isinstance(blob, dict) else {}


def load_authored_placements(data: dict) -> list[dict]:
    rows = load_authored_blob(data).get("placements")
    if not isinstance(rows, list) or not rows:
        return []
    out: list[dict] = []
    for row in rows:
        if isinstance(row, dict) and row.get("id") is not None and row.get("lot_index") is not None:
            out.append(row)
    return out


def load_authored_tiles(data: dict) -> list[dict]:
    rows = load_authored_blob(data).get("tiles")
    if not isinstance(rows, list) or not rows:
        return []
    return [row for row in rows if isinstance(row, dict) and row.get("ch") is not None]


def load_authored_props(data: dict) -> list[dict]:
    rows = load_authored_blob(data).get("props")
    if not isinstance(rows, list) or not rows:
        return []
    out: list[dict] = []
    for row in rows:
        if isinstance(row, dict) and row.get("id") is not None and row.get("x") is not None and row.get("y") is not None:
            out.append(row)
    return out


TILE_PATCH_OK = frozenset(".kpsbrcm~")
TILE_STRUCTURAL = frozenset("wdbp")


def overlay_flag(data: dict, name: str) -> bool:
    return int(load_authored_blob(data).get(name) or 0) == 1


def apply_authored_tiles(data: dict, grid: list[str]) -> list[str]:
    """Patch land legend including roads and water. Dock, waterfall, beach and plaza pads stay derived (R-V-80). Outer water_margin ring is not painted (L186). Lots stay pre-patch (L175)."""
    patches = load_authored_tiles(data)
    if not patches or not grid:
        return grid
    rows = [list(line) for line in grid]
    height = len(rows)
    width = len(rows[0]) if rows else 0
    margin = pp(data, "water_margin_tiles")
    for row in patches:
        try:
            x, y = int(row["x"]), int(row["y"])
        except (TypeError, ValueError, KeyError):
            continue
        ch = str(row.get("ch") or "")
        if ch not in TILE_PATCH_OK or y < 0 or x < 0 or y >= height or x >= width:
            continue
        if x < margin or y < margin or x >= width - margin or y >= height - margin:
            continue
        if rows[y][x] in TILE_STRUCTURAL:
            continue
        rows[y][x] = ch
    return ["".join(line) for line in rows]


def drop_inland_shore_chars(grid: list[str]) -> list[str]:
    """Tiles may fill water next to a kept b/d. Inland sand/dock become grass so L369 holds (R-V-80)."""
    if not grid:
        return grid
    rows = [list(line) for line in grid]
    height = len(rows)
    width = len(rows[0]) if rows else 0
    for y in range(height):
        for x in range(width):
            if rows[y][x] not in "bd":
                continue
            n = rows[y - 1][x] if y > 0 else ""
            s = rows[y + 1][x] if y + 1 < height else ""
            e = rows[y][x + 1] if x + 1 < width else ""
            w = rows[y][x - 1] if x > 0 else ""
            if "~" not in (n, s, e, w) and "" not in (n, s, e, w):
                rows[y][x] = "."
    return ["".join(line) for line in rows]


def drop_overwritten_piers(grid: list[str], extras: list[dict]) -> list[dict]:
    """Generator piers follow map `d`. After a land/water patch the pier sprite must not respawn."""
    if not grid or not extras:
        return extras
    height = len(grid)
    width = len(grid[0]) if grid else 0
    kept: list[dict] = []
    for row in extras:
        if row.get("id") != "pier":
            kept.append(row)
            continue
        tile = row.get("tile") or [0, 0]
        try:
            x, y = int(tile[0]), int(tile[1])
        except (TypeError, ValueError, IndexError):
            continue
        if y < 0 or x < 0 or y >= height or x >= width:
            continue
        if grid[y][x] == "d":
            kept.append(row)
    return kept


def drop_overwritten_street(grid: list[str], street: list[dict]) -> list[dict]:
    """Booths follow sidewalk/plaza. After a land patch they must not sit on grass (L361)."""
    if not grid or not street:
        return street
    height = len(grid)
    width = len(grid[0]) if grid else 0
    kept: list[dict] = []
    for row in street:
        sid = str(row.get("id") or "")
        try:
            x, y = int(row["x"]), int(row["y"])
        except (TypeError, ValueError, KeyError):
            continue
        if y < 0 or x < 0 or y >= height or x >= width:
            continue
        ch = grid[y][x]
        if sid.startswith("phone_booth") and ch not in ("s", "p"):
            continue
        kept.append(row)
    return kept


def _prop_bucket(sid: str) -> str:
    if sid.startswith("lantern"):
        return "lanterns"
    if sid.startswith("vehicle"):
        return "vehicles"
    if sid.startswith("drone"):
        return "drones"
    if sid.startswith(("walker_", "robot_")):
        return "walkers"
    if sid in TREE_KINDS or sid.startswith("tree_"):
        return "trees"
    if sid in STREET_IDS or sid in PLOT_LOW or sid == "hedge":
        return "street"
    return "extras"


def apply_authored_props(
    data: dict, decor: dict, extras: list[dict]
) -> tuple[dict, list[dict], list[dict] | None]:
    """Replace overlay buckets. Empty props with replace_props keeps nothing, not the generator (R-V-64)."""
    rows = load_authored_props(data)
    replace = overlay_flag(data, "replace_props")
    if not rows and not replace:
        return decor, extras, None
    buckets: dict[str, list[dict]] = {
        "lanterns": [],
        "trees": [],
        "street": [],
        "vehicles": [],
        "drones": [],
        "walkers": [],
        "extras": [],
    }
    seen: set[str] = set()
    for row in rows:
        sid = str(row.get("id") or "")
        if not sid:
            continue
        try:
            x, y = int(row["x"]), int(row["y"])
        except (TypeError, ValueError, KeyError):
            continue
        bucket = _prop_bucket(sid)
        seen.add(bucket)
        geom = geom_of(row)
        if bucket == "extras":
            extra = {"id": sid, "tile": [x, y]}
            extra.update(geom)
            buckets["extras"].append(extra)
            continue
        item = {"x": x, "y": y, "id": sid}
        if bucket in ("vehicles", "drones", "walkers"):
            item["background"] = 1
        item.update(geom)
        buckets[bucket].append(item)
    out = dict(decor)
    out["trees"] = buckets["trees"]
    out["street"] = buckets["street"]
    out["tree_count"] = len(buckets["trees"])
    out["street_count"] = len(buckets["street"])
    if replace or "lanterns" in seen:
        out["lanterns"] = buckets["lanterns"]
        out["lantern_count"] = len(buckets["lanterns"])
    if replace or "vehicles" in seen:
        out["vehicles"] = buckets["vehicles"]
        out["vehicle_count"] = len(buckets["vehicles"])
    if replace or "drones" in seen:
        out["drones"] = buckets["drones"]
        out["drone_count"] = len(buckets["drones"])
    walkers_auth = buckets["walkers"] if (replace or "walkers" in seen) else None
    extra_out = buckets["extras"]
    return out, extra_out, walkers_auth


def recount_decor(decor: dict, land0: list[list[int]]) -> dict:
    land_n = sum(sum(row) for row in land0)
    n_street = len(decor.get("street") or [])
    decor_tiles = (
        len(decor.get("lanterns") or [])
        + int(decor.get("tree_count") or 0)
        + int(decor.get("vehicle_count") or 0)
        + int(decor.get("drone_count") or 0)
        + n_street
    )
    out = dict(decor)
    out["street_count"] = n_street
    out["decor_tiles"] = decor_tiles
    out["decor_realized_share_bps"] = decor_tiles * BPS // land_n if land_n else 0
    return out


def infer_place_kind(data: dict, bid: str) -> str:
    blds = (data.get("buildings") or {}).get("buildings") or {}
    if (blds.get(bid) or {}).get("tier") == "base":
        return "base"
    districts = (data.get("districts") or {}).get("districts") or {}
    for d in districts.values():
        if d.get("beacon") == bid:
            return "beacon"
    syn = (data.get("districts") or {}).get("synergies") or {}
    if bid in syn:
        return "synergy"
    return "filler"


def materialize_authored_row(data: dict, lots: list[dict], row: dict, fps: dict) -> dict | None:
    try:
        idx = int(row["lot_index"])
    except (TypeError, ValueError, KeyError):
        return None
    if idx < 0 or idx >= len(lots):
        return None
    lot = lots[idx]
    bid = str(row["id"])
    kind = infer_place_kind(data, bid)
    fp = fps.get(bid, (2, 2))
    item = {
        "kind": kind,
        "id": bid,
        "lot_index": idx,
        "block_id": lot["block_id"],
        "zone": lot["zone"],
        "x": lot["x"],
        "y": lot["y"],
        "w": fp[0],
        "h": fp[1],
    }
    if kind == "filler":
        item["district"] = lot["zone"]
    item.update(geom_of(row))
    return item


def apply_authored_layout(data: dict, lots: list[dict], generated: list[dict]) -> list[dict]:
    """Owner fixture replaces lot picks. Empty list keeps the generator unless replace_placements (R-V-44, R-V-64)."""
    rows = load_authored_placements(data)
    if not rows and not overlay_flag(data, "replace_placements"):
        return generated
    fps = all_footprints(data)
    placed: list[dict] = []
    used: set[int] = set()
    for row in rows:
        item = materialize_authored_row(data, lots, row, fps)
        if item is None:
            continue
        idx = int(item["lot_index"])
        if idx in used:
            continue
        used.add(idx)
        placed.append(item)
    return placed


def day_phases(data: dict) -> dict:
    tm = data.get("time") or {}
    dawn = _pv(tm, "efficiency_recalc_hour")
    day = _pv(tm, "bank_open_hour")
    dusk = _pv(tm, "bank_close_hour")
    night = dusk + (day - dawn)
    phases = (data.get("placement") or {}).get("phases") or {}
    order = [
        ("night", night, dawn),
        ("dawn", dawn, day),
        ("day", day, dusk),
        ("dusk", dusk, night if night > dusk else night + CITY_HOURS),
    ]
    rows = {}
    total = 0
    for name, start, end in [("dawn", dawn, day), ("day", day, dusk), ("dusk", dusk, night), ("night", night, dawn + CITY_HOURS)]:
        dur = (end - start) % CITY_HOURS
        if dur == 0 and name:
            dur = 0
        spec = phases.get(name) or {}
        lights = 0 if name == "day" else 1
        rows[name] = {
            "start_hour": start % CITY_HOURS if name != "night" else night % CITY_HOURS,
            "duration_hours": dur,
            "tint_ramp": spec.get("tint_ramp"),
            "tint_alpha_bps": int(((spec.get("tint_alpha_bps") or {}).get("v") or 0)),
            "sun_azimuth_bps": int(((spec.get("sun_azimuth_bps") or {}).get("v") or 0)),
            "sun_elevation_bps": int(((spec.get("sun_elevation_bps") or {}).get("v") or 0)),
            "sun_intensity_bps": int(((spec.get("sun_intensity_bps") or {}).get("v") or 0)),
            "ambient_bps": int(((spec.get("ambient_bps") or {}).get("v") or 0)),
            "lights": lights,
        }
        total += dur
    rows["dawn"]["start_hour"] = dawn
    rows["day"]["start_hour"] = day
    rows["dusk"]["start_hour"] = dusk
    rows["night"]["start_hour"] = night % CITY_HOURS
    return {
        "dawn_hour": dawn,
        "day_hour": day,
        "dusk_hour": dusk,
        "night_hour": night,
        "phase_hours_sum": total,
        "phases": rows,
        "lanterns_on_phases": ["dawn", "dusk", "night"],
    }


def hud_layout_geom(data: dict) -> dict:
    overlay = data.get("_hud_layout")
    hud = overlay if isinstance(overlay, dict) else fixture("hud_layout")
    tw = tile_w_px()
    th = tw // 2
    col = int(hud.get("column_width_px") or 0)
    top = int(hud.get("topbar_height_px") or 0)
    strip = int(hud.get("stock_strip_height_px") or 0)
    menu = int(hud.get("bottom_menu_height_px") or 0)
    aw = int(hud.get("aspect_w") or 0)
    ah = int(hud.get("aspect_h") or 0)
    vw = aw * tw if aw and tw else 0
    vh = vw * ah // aw if aw else 0
    safe_w = vw - 2 * col
    safe_h = vh - top - strip - menu
    if safe_w < 1:
        safe_w = 1
    if safe_h < 1:
        safe_h = 1
    return {
        "tile_w": tw,
        "tile_h": th,
        "column_width_px": col,
        "topbar_height_px": top,
        "stock_strip_height_px": strip,
        "bottom_menu_height_px": menu,
        "aspect_w": aw,
        "aspect_h": ah,
        "viewport_w_px": vw,
        "viewport_h_px": vh,
        "safe_rect_w_px": safe_w,
        "safe_rect_h_px": safe_h,
    }


def iso_bbox(grid_size: int, tw: int, th: int) -> tuple[int, int]:
    return grid_size * tw, grid_size * th


def zoom_levels(data: dict, grid_size: int) -> dict:
    hud = hud_layout_geom(data)
    zmax = pp(data, "zoom_max_scale")
    iso_w, iso_h = iso_bbox(grid_size, hud["tile_w"], hud["tile_h"])
    safe_w, safe_h = hud["safe_rect_w_px"], hud["safe_rect_h_px"]
    levels = []
    den = 1
    min_num, min_den = 1, 1
    while den <= 256:
        if iso_w <= safe_w * den and iso_h <= safe_h * den:
            min_num, min_den = 1, den
            break
        den *= 2
    num = 1
    while num <= zmax:
        g = gcd(num, 1)
        levels.append({"num": num // g, "den": 1})
        if num == 1:
            d = min_den
            while d > 1:
                levels.append({"num": 1, "den": d})
                d //= 2
        num *= 2
    uniq = []
    seen = set()
    for lv in levels:
        key = (lv["num"], lv["den"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(lv)
    uniq.sort(key=lambda r: (r["num"] * 1024) // r["den"] if r["den"] else 0)
    return {
        "zoom_max_scale": zmax,
        "zoom_min_scale_num": min_num,
        "zoom_min_scale_den": min_den,
        "zoom_levels": uniq,
        "iso_w_px": iso_w,
        "iso_h_px": iso_h,
        **{k: hud[k] for k in ("safe_rect_w_px", "safe_rect_h_px", "viewport_w_px", "viewport_h_px")},
    }


def gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a if a else 1


def camera_bounds(grid_size: int, margin: int) -> dict:
    return {
        "min_x": -margin,
        "min_y": -margin,
        "max_x": grid_size - 1 + margin,
        "max_y": grid_size - 1 + margin,
    }


def level_overlays(data: dict) -> dict:
    lmax = _pv(data.get("balance") or {}, "building_level_max")
    rows = {}
    for lv in range(1, lmax + 1):
        rows[str(lv)] = {
            "pips": lv - 1,
            "window_rows": lv - 1,
            "antenna": 1 if lv == lmax else 0,
            "sprite_id_depends_on_level": 0,
        }
    return {
        "building_level_max": lmax,
        "overlay_elements_at_max": (lmax - 1) * 2 + 1,
        "level_overlays": rows,
    }


def scene_badges(data: dict) -> dict:
    codes = ((data.get("codes") or {}).get("codes") or {})
    surfaces = ((data.get("screens") or {}).get("state_surfaces") or {})
    fields = ((data.get("screens") or {}).get("fields") or {})
    sources = ((data.get("screens") or {}).get("state_sources") or {})
    badges = []
    log_only = []

    def kind_of(cid: str) -> str:
        if cid.startswith("IDLE_NO_") and cid in ("IDLE_NO_ENERGY", "IDLE_NO_COMPUTE"):
            return "shortage"
        if cid == "IDLE_NO_AGENT":
            return "occupancy"
        if cid.startswith("IDLE_"):
            return "idle"
        return "state"

    for cid, row in sorted(codes.items()):
        if not str(cid).startswith("IDLE_"):
            continue
        on_scene = "scene" in (surfaces.get(cid) or [])
        src = ""
        for fid, f in fields.items():
            if cid in (f.get("state_codes") or []) and f.get("state_source"):
                src = f.get("state_source")
                break
        if on_scene:
            badges.append(
                {
                    "code": cid,
                    "kind": kind_of(cid),
                    "state_source": src,
                    "log_only": 0,
                }
            )
        else:
            log_only.append(cid)
            badges.append(
                {
                    "code": cid,
                    "kind": kind_of(cid),
                    "state_source": src,
                    "log_only": 1,
                }
            )
    if data.get("_attack_drop_badge_source"):
        for b in badges:
            if b["code"] == "IDLE_NO_ENERGY":
                b["state_source"] = ""
    return {
        "scene_badges": badges,
        "log_only_idle": log_only,
        "state_sources": sorted(sources),
    }


def apply_shore_jitter(
    land: list[list[int]],
    roads: list[list[int]],
    protected: set[tuple[int, int]],
    cx: int,
    cy: int,
    r: int,
    amp: int,
    city_id: str,
) -> list[list[int]]:
    size = len(land)
    out = [row[:] for row in land]
    if amp <= 0:
        return out
    cursor = 0
    rr_lo = (r - amp) * (r - amp) if r > amp else 0
    rr_hi = (r + amp) * (r + amp)
    for y in range(size):
        for x in range(size):
            if (x, y) in protected:
                continue
            if roads[y][x]:
                continue
            dx, dy = x - cx, y - cy
            d2 = dx * dx + dy * dy
            if d2 < rr_lo or d2 > rr_hi:
                continue
            if draw_below(city_id, "shore", cursor, 2) == 1:
                out[y][x] = 1 - out[y][x]
            cursor += 1
    for x, y in protected:
        if 0 <= y < size and 0 <= x < size:
            out[y][x] = land[y][x]
    for y in range(size):
        for x in range(size):
            if roads[y][x]:
                out[y][x] = 1
    return out


def shore_tiles(land: list[list[int]]) -> set[tuple[int, int]]:
    size = len(land)
    out = set()
    for y in range(size):
        for x in range(size):
            if not land[y][x]:
                continue
            edge = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= size or ny >= size or not land[ny][nx]:
                    edge = 1
                    break
            if edge:
                out.add((x, y))
    return out


def lot_tile_set(lots: list[dict]) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    for lot in lots:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                out.add((xx, yy))
    return out


def sidewalk_tiles(
    land: list[list[int]], roads: list[list[int]], lots_set: set[tuple[int, int]]
) -> set[tuple[int, int]]:
    size = len(land)
    out: set[tuple[int, int]] = set()
    seeds = set(lots_set)
    for y in range(size):
        for x in range(size):
            if roads[y][x] and land[y][x]:
                seeds.add((x, y))
    for x, y in seeds:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= size or ny >= size:
                continue
            if not land[ny][nx] or roads[ny][nx] or (nx, ny) in lots_set:
                continue
            out.add((nx, ny))
    return out


def plaza_tiles_of(
    blocks: list[dict],
    plaza_block_ids: list[int],
    land: list[list[int]],
    roads: list[list[int]],
    lots_set: set[tuple[int, int]],
    depth: int,
    yard: int,
) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    if yard < 1:
        return out
    size = len(land)
    for bi in plaza_block_ids:
        if bi < 0 or bi >= len(blocks):
            continue
        b = blocks[bi]
        x0 = int(b["x0"]) + depth
        y0 = int(b["y0"]) + depth
        for y in range(y0, y0 + yard):
            for x in range(x0, x0 + yard):
                if x < 0 or y < 0 or x >= size or y >= size:
                    continue
                if not land[y][x] or roads[y][x] or (x, y) in lots_set:
                    continue
                out.add((x, y))
    return out


def plaza_pad_of(
    blocks: list[dict],
    plaza_block_ids: list[int],
    land: list[list[int]],
    roads: list[list[int]],
    lots_set: set[tuple[int, int]],
) -> set[tuple[int, int]]:
    """Fountain pad: courtyard centre plus ortho neighbours. Not the whole yard (R-V-59)."""
    out: set[tuple[int, int]] = set()
    size = len(land)
    for bi in plaza_block_ids:
        if bi < 0 or bi >= len(blocks):
            continue
        b = blocks[bi]
        cx, cy = int(b["cx"]), int(b["cy"])
        for x, y in ((cx, cy), (cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if x < 0 or y < 0 or x >= size or y >= size:
                continue
            if not land[y][x] or roads[y][x] or (x, y) in lots_set:
                continue
            out.add((x, y))
    return out


def parking_tiles_of(lots: list[dict], placed: list[dict]) -> set[tuple[int, int]]:
    """One unused lot per zone, not every empty parcel (R-V-42)."""
    used = {int(p["lot_index"]) for p in placed if "lot_index" in p}
    by_zone: dict[str, list[tuple[int, dict]]] = {}
    for i, lot in enumerate(lots):
        if i in used:
            continue
        z = str(lot.get("zone") or "")
        by_zone.setdefault(z, []).append((i, lot))
    out: set[tuple[int, int]] = set()
    for _z, group in by_zone.items():
        group = sorted(group, key=lambda t: (int(t[1]["y"]), int(t[1]["x"])))
        if not group:
            continue
        lot = group[0][1]
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                out.add((xx, yy))
    return out


def lot_all_tiles(lot: dict) -> list[tuple[int, int]]:
    x, y = int(lot["x"]), int(lot["y"])
    w, h = int(lot["w"]), int(lot["h"])
    return [(x + i, y + j) for j in range(h) for i in range(w)]


def lots_ortho_touch(a: dict, b: dict, gap: int) -> bool:
    """True when AABBs share an edge or are separated by at most `gap` tiles on one axis."""
    ax0, ay0 = int(a["x"]), int(a["y"])
    ax1, ay1 = ax0 + int(a["w"]), ay0 + int(a["h"])
    bx0, by0 = int(b["x"]), int(b["y"])
    bx1, by1 = bx0 + int(b["w"]), by0 + int(b["h"])
    y_ov = ay0 < by1 and by0 < ay1
    x_ov = ax0 < bx1 and bx0 < ax1
    if y_ov:
        if ax1 <= bx0 and bx0 - ax1 <= gap:
            return True
        if bx1 <= ax0 and ax0 - bx1 <= gap:
            return True
    if x_ov:
        if ay1 <= by0 and by0 - ay1 <= gap:
            return True
        if by1 <= ay0 and ay0 - by1 <= gap:
            return True
    return False


def lot_touches_foreign_zone(lot: dict, lots: list[dict], gap: int) -> bool:
    z = str(lot.get("zone") or "")
    for other in lots:
        if other is lot:
            continue
        if str(other.get("zone") or "") != z and lots_ortho_touch(lot, other, gap):
            return True
    return False


def nearest_zone(x: int, y: int, blocks: list[dict], zone_of: dict[int, str]) -> str:
    best = ""
    best_d: int | None = None
    for i, b in enumerate(blocks):
        d = abs(int(b["cx"]) - x) + abs(int(b["cy"]) - y)
        if best_d is None or d < best_d:
            best_d = d
            best = zone_of.get(i, "")
    return best


def decor_plan(
    data: dict,
    land: list[list[int]],
    land_unjittered: list[list[int]],
    roads: list[list[int]],
    lots: list[dict],
    blocks: list[dict],
    placed: list[dict],
    x0: int,
    y0: int,
    period: int,
    city_id: str,
    cx: int,
    cy: int,
    r: int,
    amp: int,
    zone_of: dict[int, str] | None = None,
) -> dict:
    size = len(land)
    lot_tiles = set()
    for lot in lots:
        for yy in range(lot["y"], lot["y"] + lot["h"]):
            for xx in range(lot["x"], lot["x"] + lot["w"]):
                lot_tiles.add((xx, yy))
    occupied_blocks = {p["block_id"] for p in placed}
    beacon_blocks = {p["block_id"] for p in placed if p.get("kind") == "beacon"}
    lantern_skins = prefix_ids("lantern") or ["lantern"]
    lanterns = []
    if period > 0:
        ky = y0
        li = 0
        while ky < size:
            kx = x0
            while kx < size:
                if 0 <= kx < size and 0 <= ky < size and land_unjittered[ky][kx] and roads[ky][kx]:
                    ix = (kx - x0) // period
                    iy = (ky - y0) // period
                    if (ix + iy) % 2 == 0:
                        lanterns.append({"x": kx, "y": ky, "id": lantern_skins[li % len(lantern_skins)]})
                        li += 1
                kx += period
            ky += period
    land_n = sum(sum(row) for row in land_unjittered)
    target = land_n * pp(data, "decor_target_share_bps") // BPS
    lots_set = lot_tile_set(lots)
    walks = sidewalk_tiles(land_unjittered, roads, lots_set)
    depth = lot_ring_depth_of(data)
    period_p = pp(data, "road_period_tiles")
    yard = (period_p - road_span_of(data)) - 2 * depth
    plaza_ids = sorted(set(beacon_blocks))
    plaza_pads = plaza_pad_of(blocks, plaza_ids, land_unjittered, roads, lots_set)
    zmap = zone_of or {i: str(b.get("zone") or "") for i, b in enumerate(blocks)}
    park_ids = sorted(occupied_blocks - set(plaza_ids))
    gap_c = pp(data, "tree_corner_gap_tiles")
    grove: list[tuple[int, int]] = []
    for bi in park_ids:
        z = zmap.get(bi, str((blocks[bi] if bi < len(blocks) else {}).get("zone") or ""))
        if z in INDUSTRIAL_ZONES:
            continue
        tiles = plaza_tiles_of(blocks, [bi], land_unjittered, roads, lots_set, depth, yard)
        if not tiles:
            continue
        xs = [t[0] for t in tiles]
        ys = [t[1] for t in tiles]
        min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
        for x, y in sorted(tiles):
            if x - min_x < gap_c or max_x - x < gap_c or y - min_y < gap_c or max_y - y < gap_c:
                continue
            grove.append((x, y))
    lantern_at = {(row["x"], row["y"]) for row in lanterns}

    def dry_cell(cell: tuple[int, int]) -> bool:
        x, y = cell
        return 0 <= y < size and 0 <= x < size and bool(land[y][x]) and not roads[y][x]

    tree_pool = []
    seen_t: set[tuple[int, int]] = set()
    for cell in grove:
        if cell in seen_t or cell in lot_tiles or cell in lantern_at or cell in walks or not dry_cell(cell):
            continue
        seen_t.add(cell)
        tree_pool.append(cell)
    road_tiles = [
        (x, y)
        for y in range(size)
        for x in range(size)
        if roads[y][x] and land_unjittered[y][x]
    ]
    n_veh = len(road_tiles) * pp(data, "vehicles_per_100_road_tiles") // 100
    n_drone = len(blocks) * pp(data, "drones_per_100_blocks") // 100
    tree_cap = land_n * pp(data, "tree_cap_share_bps") // BPS
    overhead = len(lanterns) + n_veh + n_drone
    room = target - overhead
    if room < 0:
        room = 0
    n_trees = tree_cap if tree_cap <= room else room
    trees = []
    pool = tree_pool[:]
    cursor = 0
    kinds = listed_ids(TREE_KINDS) or ["tree_green"]
    n_kinds = len(kinds)
    for i in range(n_trees):
        if not pool:
            break
        cell, cursor = pop_pool(city_id, "tree", cursor, pool)
        x, y = cell
        if i < n_kinds:
            sid = kinds[i]
        else:
            kind_i = draw_below(city_id, "tree", cursor, n_kinds)
            cursor += 1
            sid = kinds[kind_i]
        trees.append({"x": x, "y": y, "id": sid})
    n_trees = len(trees)
    tree_at = {(row["x"], row["y"]) for row in trees}
    n_street = room - n_trees
    if n_street < 0:
        n_street = 0
    vehicle_skins = prefix_ids("vehicle", exclude_contains=("dir",)) or ["vehicle"]
    vehicles = []
    rpool = [c for c in road_tiles if c not in lantern_at]
    cursor = 0
    for i in range(n_veh):
        if not rpool:
            break
        cell, cursor = pop_pool(city_id, "vehicle", cursor, rpool)
        x, y = cell
        sid = vehicle_skins[i] if i < len(vehicle_skins) else vehicle_skins[draw_below(city_id, "vehicle", cursor, len(vehicle_skins))]
        if i >= len(vehicle_skins):
            cursor += 1
        vehicles.append({"x": x, "y": y, "id": sid, "background": 1})
    n_veh = len(vehicles)
    veh_at = {(row["x"], row["y"]) for row in vehicles}
    drone_skins = prefix_ids("drone", exclude_contains=("bob", "depot")) or ["drone"]
    drones = []
    cursor = 0
    drone_used = set(lantern_at) | set(tree_at) | veh_at
    if blocks:
        for i in range(n_drone):
            bi = draw_below(city_id, "drone", cursor, len(blocks))
            cursor += 1
            blk = blocks[bi]
            cx, cy = int(blk["cx"]), int(blk["cy"])
            skip_center = {(cx, cy)}
            yard_tiles = plaza_tiles_of(blocks, [bi], land_unjittered, roads, lots_set, depth, yard)
            pool = [t for t in sorted(yard_tiles) if t not in drone_used and t not in skip_center]
            if not pool:
                pool = [
                    (x, y)
                    for y in range(size)
                    for x in range(size)
                    if land_unjittered[y][x] and not roads[y][x] and (x, y) not in drone_used
                ]
            if not pool:
                pool = [
                    (x, y)
                    for y in range(size)
                    for x in range(size)
                    if not land_unjittered[y][x] and (x, y) not in drone_used
                ]
            if not pool:
                break
            cell, cursor = pop_pool(city_id, "drone", cursor, pool)
            x, y = cell
            drone_used.add(cell)
            sid = drone_skins[i] if i < len(drone_skins) else drone_skins[draw_below(city_id, "drone", cursor, len(drone_skins))]
            if i >= len(drone_skins):
                cursor += 1
            drones.append({"x": x, "y": y, "id": sid, "background": 1, "block_id": bi})
    n_drone = len(drones)
    furniture_skins = listed_ids(
        (
            "bench",
            "bench_02",
            "trash_can",
            "phone_booth",
            "phone_booth_02",
            "phone_booth_red",
            "planter",
            "flower",
            "flower_02",
        )
    ) or ["bench"]
    booth_skins = [s for s in furniture_skins if s.startswith("phone_booth")]
    bench_skins = [s for s in furniture_skins if not s.startswith("phone_booth")]
    step_f = pp(data, "sidewalk_furniture_step_tiles") or 1
    drone_at = {(row["x"], row["y"]) for row in drones}
    blocked = lantern_at | tree_at | veh_at | drone_at
    cadence: list[tuple[int, int]] = []
    for x, y in sorted(walks | plaza_pads):
        if (x, y) in blocked:
            continue
        if not dry_cell((x, y)):
            continue
        z = nearest_zone(x, y, blocks, zmap)
        if z in INDUSTRIAL_ZONES:
            continue
        on_curb = False
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= ny < size and 0 <= nx < size and roads[ny][nx]:
                on_curb = True
                break
        if not on_curb and (x, y) not in plaza_pads:
            continue
        if step_f and (x + y) % step_f != 0:
            continue
        cadence.append((x, y))
    street = []
    for i, (x, y) in enumerate(cadence):
        if len(street) >= n_street:
            break
        if booth_skins and i % (step_f + 1) == 0:
            sid = booth_skins[i % len(booth_skins)]
        elif bench_skins:
            sid = bench_skins[i % len(bench_skins)]
        else:
            sid = furniture_skins[i % len(furniture_skins)]
        street.append({"x": x, "y": y, "id": sid})
    extra_benches = [
        c
        for c in sorted(walks | plaza_pads)
        if c not in blocked and dry_cell(c)
    ]
    ei = 0
    while len(street) < n_street and ei < len(extra_benches):
        x, y = extra_benches[ei]
        ei += 1
        z = nearest_zone(x, y, blocks, zmap)
        if z in INDUSTRIAL_ZONES:
            continue
        if any(s["x"] == x and s["y"] == y for s in street):
            continue
        sid = bench_skins[len(street) % len(bench_skins)] if bench_skins else "bench"
        street.append({"x": x, "y": y, "id": sid})
    n_street = len(street)
    parks = sorted(occupied_blocks)
    plazas = sorted(beacon_blocks)
    decor_tiles = len(lanterns) + n_trees + n_veh + n_drone + n_street
    realized = decor_tiles * BPS // land_n if land_n else 0
    return {
        "lanterns": lanterns,
        "trees": trees,
        "vehicles": vehicles,
        "drones": drones,
        "street": street,
        "park_blocks": parks,
        "plaza_blocks": plazas,
        "plaza_pads": [[x, y] for x, y in sorted(plaza_pads)],
        "lantern_count": len(lanterns),
        "tree_count": n_trees,
        "vehicle_count": n_veh,
        "drone_count": n_drone,
        "street_count": n_street,
        "decor_realized_share_bps": realized,
        "decor_tiles": decor_tiles,
        "free_decor_tiles": len(tree_pool),
    }


def mini_islands_of(
    land: list[list[int]], land0: list[list[int]], shore: set[tuple[int, int]], share_bps: int, city_id: str
) -> tuple[list[dict], int]:
    size = len(land0)
    water0 = [(x, y) for y in range(size) for x in range(size) if not land0[y][x]]
    n = len(water0) * share_bps // BPS
    water = [(x, y) for y in range(size) for x in range(size) if not land[y][x]]
    placed: list[dict] = []
    cursor = 0
    attempts = 0
    while len(placed) < n and attempts < 8192 and water:
        attempts += 1
        pick = draw_below(city_id, "mini_island", cursor, len(water))
        cursor += 1
        x, y = water[pick]
        ok = 1
        for sx, sy in shore:
            dx, dy = x - sx, y - sy
            if dx * dx + dy * dy < 4:
                ok = 0
                break
        if not ok:
            continue
        for m in placed:
            dx, dy = x - m["x"], y - m["y"]
            if dx * dx + dy * dy < 4:
                ok = 0
                break
        if not ok:
            continue
        placed.append({"x": x, "y": y, "id": "mini_island"})
    return placed, n


def build_map(
    land: list[list[int]],
    roads: list[list[int]],
    shore: set[tuple[int, int]],
    blocks: list[dict],
    plaza_blocks: list[int],
    lots: list[dict],
    placed: list[dict],
    zone_of: dict[int, str],
    districts: list[str],
    x0: int,
    y0: int,
    period: int,
    depth: int,
    yard: int,
    land0: list[list[int]],
    occupied: set[tuple[int, int]] | None = None,
    span: int = 1,
) -> tuple[list[str], list[dict]]:
    size = len(land)
    lots_set = lot_tile_set(lots)
    occupied_blocks = {p["block_id"] for p in placed}
    plaza_ids = sorted(plaza_blocks)
    walks = sidewalk_tiles(land0, roads, lots_set)
    plaza_pads = plaza_pad_of(blocks, plaza_ids, land0, roads, lots_set)
    parks = parking_tiles_of(lots, placed)
    shore_live = {
        (x, y) for (x, y) in shore if 0 <= y < size and 0 <= x < size and land[y][x]
    }
    waterfall_at = max(shore_live, key=lambda t: (t[1], t[0])) if shore_live else None
    # Sand cove, not a yellow ring: southern eighth of the rim. Rest of shore is grass on cliff.
    shore_south = sorted(shore_live, key=lambda t: (-t[1], t[0]))
    n_beach = len(shore_south) // period if period > 0 else 1
    beach = set(shore_south[:n_beach] if n_beach else shore_south[:1])
    docks: set[tuple[int, int]] = set()
    for did in districts:
        cand = sorted(
            ((x, y) for x, y in shore if nearest_zone(x, y, blocks, zone_of) == did),
            key=lambda t: (t[1], t[0]),
        )
        for pt in reversed(cand):
            if pt != waterfall_at:
                docks.add(pt)
                break
    extras: list[dict] = []
    used: set[tuple[int, int]] = set(occupied or ())
    for bi in plaza_blocks:
        if bi < 0 or bi >= len(blocks):
            continue
        b = blocks[bi]
        cx, cy = int(b["cx"]), int(b["cy"])
        if (cx, cy) not in used and (cx, cy) in plaza_pads:
            extras.append({"id": "fountain", "tile": [cx, cy]})
            used.add((cx, cy))
        ring = sorted(
            (t for t in plaza_pads if abs(t[0] - cx) + abs(t[1] - cy) == 1 and t not in used),
            key=lambda t: (t[1], t[0]),
        )
        for t in ring:
            extras.append({"id": "bench", "tile": [t[0], t[1]]})
            used.add(t)
    used_lots = {int(p["lot_index"]) for p in placed if "lot_index" in p}
    plot_low = listed_ids(PLOT_LOW)
    pi = 0
    for i, lot in enumerate(lots):
        if i in used_lots:
            continue
        tiles = lot_all_tiles(lot)
        if any(t in parks for t in tiles):
            continue
        ox, oy = int(lot["x"]), int(lot["y"])
        if (ox, oy) in used or (ox, oy) in parks or not plot_low:
            continue
        extras.append({"id": plot_low[pi % len(plot_low)], "tile": [ox, oy]})
        used.add((ox, oy))
        pi += 1
    energy_free = sorted(
        (
            (x, y)
            for y in range(size)
            for x in range(size)
            if land0[y][x]
            and not roads[y][x]
            and (x, y) not in lots_set
            and (x, y) not in walks
            and (x, y) not in plaza_pads
            and (x, y) not in used
            and nearest_zone(x, y, blocks, zone_of) == "energy"
        ),
        key=lambda t: (t[1], t[0]),
    )
    energy_props = listed_ids(("wind_turbine", "solar_array", "solar_panel", "solar_panel_02", "tesla_mark"))
    for i, sid in enumerate(energy_props):
        if i >= len(energy_free):
            break
        extras.append({"id": sid, "tile": [energy_free[i][0], energy_free[i][1]]})
        used.add(energy_free[i])
    logistics_free = sorted(
        (
            (x, y)
            for y in range(size)
            for x in range(size)
            if land0[y][x]
            and not roads[y][x]
            and (x, y) not in lots_set
            and (x, y) not in walks
            and (x, y) not in plaza_pads
            and (x, y) not in used
            and nearest_zone(x, y, blocks, zone_of) == "logistics"
        ),
        key=lambda t: (t[1], t[0]),
    )
    if logistics_free and "cargo_container" in known_asset_ids():
        extras.append({"id": "cargo_container", "tile": [logistics_free[0][0], logistics_free[0][1]]})
        used.add(logistics_free[0])
    if len(logistics_free) > 1 and "crane_build" in known_asset_ids():
        extras.append({"id": "crane_build", "tile": [logistics_free[1][0], logistics_free[1][1]]})
        used.add(logistics_free[1])
    for dx, dy in docks:
        if (dx, dy) in used:
            continue
        extras.append({"id": "pier", "tile": [dx, dy]})
        used.add((dx, dy))
    boat_skins = listed_ids(BOAT_IDS)
    water_adj = []
    for dx, dy in docks:
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = dx + ox, dy + oy
            if 0 <= ny < size and 0 <= nx < size and not land0[ny][nx] and (nx, ny) not in used:
                water_adj.append((nx, ny))
    for i, sid in enumerate(boat_skins):
        if i >= len(water_adj):
            break
        extras.append({"id": sid, "tile": [water_adj[i][0], water_adj[i][1]]})
        used.add(water_adj[i])
    if period > 0 and "traffic_light" in known_asset_ids():
        ky = y0
        while ky < size:
            kx = x0
            while kx < size:
                if 0 <= kx < size and 0 <= ky < size and land0[ky][kx] and roads[ky][kx]:
                    on_x = (kx - x0) % period == 0
                    on_y = (ky - y0) % period == 0
                    if on_x and on_y and (kx, ky) not in used:
                        extras.append({"id": "traffic_light", "tile": [kx, ky]})
                        used.add((kx, ky))
                kx += period
            ky += period
    water_pts = sorted(
        ((x, y) for y in range(size) for x in range(size) if not land0[y][x]),
        key=lambda t: (t[1], t[0]),
    )
    if water_pts:
        n = len(water_pts)
        picks = (0, n // 3, (n * 2) // 3)
        names = ("cloud_small", "cloud_large", "cloud_small")
        seen: set[tuple[int, int]] = set()
        for name, idx in zip(names, picks):
            pt = water_pts[idx]
            if pt in seen:
                continue
            seen.add(pt)
            extras.append({"id": name, "tile": [pt[0], pt[1]]})
    rows = []
    for y in range(size):
        chars = []
        for x in range(size):
            if not land[y][x]:
                chars.append("~")
            elif waterfall_at == (x, y):
                chars.append("w")
            elif (x, y) in docks:
                chars.append("d")
            elif (x, y) in beach:
                chars.append("b")
            elif roads[y][x]:
                on_x = period > 0 and (x - x0) % period < span
                on_y = period > 0 and (y - y0) % period < span
                chars.append("c" if on_x and on_y else "r")
            elif (x, y) in parks:
                chars.append("k")
            elif (x, y) in plaza_pads:
                chars.append("p")
            elif (x, y) in walks:
                chars.append("s")
            elif (x, y) in lots_set:
                chars.append("m")
            else:
                chars.append(".")
        rows.append("".join(chars))
    return rows, extras


def counters_of(
    lots: list[dict],
    blocks: list[dict],
    zone_of: dict,
    land: list[list[int]],
    roads: list[list[int]],
    decor: dict,
    mini: list,
    park_slots: int,
    plaza_slots: int,
    filler_occ: int,
    fps_kinds: dict,
) -> dict:
    lots_per_zone: dict[str, int] = {}
    for lot in lots:
        z = lot["zone"] or "_"
        lots_per_zone[z] = lots_per_zone.get(z, 0) + 1
    lots_by_kind: dict[str, int] = {}
    for name, n in fps_kinds.items():
        lots_by_kind[name] = n
    land_n = sum(sum(row) for row in land)
    water_n = len(land) * len(land[0]) - land_n if land else 0
    road_n = sum(1 for y in range(len(roads)) for x in range(len(roads[0])) if roads[y][x])
    return {
        "lots_per_zone": dict(sorted(lots_per_zone.items())),
        "lots_by_kind": dict(sorted(lots_by_kind.items())),
        "park_slots": park_slots,
        "plaza_slots": plaza_slots,
        "lantern_count": decor["lantern_count"],
        "tree_count": decor["tree_count"],
        "vehicle_count": decor["vehicle_count"],
        "drone_count": decor["drone_count"],
        "road_tiles": road_n,
        "land_tiles": land_n,
        "water_tiles": water_n,
        "filler_occupied_total": filler_occ,
        "mini_island_count": len(mini),
        "blocks_on_land": len(blocks),
        "lots_total": len(lots),
    }


# Memo keyed by sha256 of the slices build_world actually reads (not the whole pack).
# `_lint_*` blobs are per-probe caches attached by lint, not generator inputs.
_WORLD_MEMO: dict[str, dict] = {}
_WORLD_INPUT_FLAGS = (
    "_attack_seed_lots",
    "_attack_shore_eats_block",
    "_attack_park_from_seed",
    "_attack_layout_hash",
    "_attack_drop_badge_source",
    "_attack_foreign_filler",
    "_authored_layout",
)


def _world_data_fingerprint(data: dict) -> str:
    screens = data.get("screens") or {}
    payload = {
        "placement": data.get("placement"),
        "districts": data.get("districts"),
        "buildings": data.get("buildings"),
        "time": data.get("time"),
        "codes": data.get("codes"),
        "screens": {
            "state_surfaces": screens.get("state_surfaces"),
            "fields": screens.get("fields"),
            "state_sources": screens.get("state_sources"),
        },
        "balance_level_max": ((data.get("balance") or {}).get("params") or {}).get("building_level_max"),
        "tier_count": ((data.get("progression") or {}).get("params") or {}).get("tier_count"),
        "hud": data.get("_hud_layout"),
        "authored_fp": _authored_layout_fp(data),
        "flags": {k: data.get(k) for k in _WORLD_INPUT_FLAGS},
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def world_memo_key(data: dict, seed: int | None) -> str:
    fp = _world_data_fingerprint(data)
    return hashlib.sha256(f"{fp}:{seed}".encode("utf-8")).hexdigest()


def clear_world_memo() -> None:
    _WORLD_MEMO.clear()


def build_world(data: dict, generated: dict | None, seed: int | None = None) -> dict:
    memo_key = world_memo_key(data, seed)
    hit = _WORLD_MEMO.get(memo_key)
    if hit is not None:
        return copy.deepcopy(hit)
    city_id = str(seed if seed is not None else pp(data, "demo_seed"))
    p = pp(data, "road_period_tiles")
    depth = lot_ring_depth_of(data)
    span = road_span_of(data)
    side = p - span
    yard = side - 2 * depth
    r = island_radius_tiles_of(data)
    margin = pp(data, "water_margin_tiles")
    size = 2 * r + 1 + 2 * margin
    cx = r + margin
    cy = r + margin
    x0 = cx - p // 2
    y0 = cy - p // 2
    land0 = land_mask(cx, cy, r, size)
    roads = road_mask(size, x0, y0, p, land0, span)
    need = blocks_required_of(data)
    blocks_all = block_ids_on_land(size, x0, y0, p, land0, cx, cy, span)
    ring = pp(data, "zone_anchor_ring_step")
    diamond = [b for b in blocks_all if abs(b["kx"]) + abs(b["ky"]) <= ring]
    if len(diamond) >= need:
        blocks = diamond
    else:
        blocks = blocks_all[:need] if len(blocks_all) > need else blocks_all
    zone_of, zone_counts, rotation = zone_assignment(data, blocks, city_id)
    for i, blk in enumerate(blocks):
        blk["zone"] = zone_of.get(i, "")
    lots: list[dict] = []
    for i, blk in enumerate(blocks):
        for lot in lots_of_block(data, blk, i):
            lot["zone"] = zone_of.get(i, "")
            lots.append(lot)
    if data.get("_attack_seed_lots"):
        extra = (int(city_id) if str(city_id).isdigit() else 0) + 1
        for _ in range(extra):
            lots.append(dict(lots[-1], index=len(lots), zone="core"))
    protected = set()
    for blk in blocks:
        for y in range(blk["north"], blk["south"] + 1):
            for x in range(blk["west"], blk["east"] + 1):
                protected.add((x, y))
    for y in range(size):
        for x in range(size):
            if roads[y][x] or on_road_grid(x, y, x0, y0, p, span):
                protected.add((x, y))
    amp = pp(data, "shore_jitter_tiles")
    if data.get("_attack_shore_eats_block"):
        amp = r
    land = apply_shore_jitter(land0, roads, protected, cx, cy, r, amp, city_id)
    jittered = []
    for y in range(size):
        for x in range(size):
            if land[y][x] != land0[y][x]:
                jittered.append([x, y])
    shore = shore_tiles(land)
    tiers = reference_tiers(data)
    placed = reference_layout(data, lots, blocks, zone_of, city_id, tiers)
    placed = apply_authored_layout(data, lots, placed)
    decor = decor_plan(
        data, land, land0, roads, lots, blocks, placed, x0, y0, p, city_id, cx, cy, r, amp, zone_of
    )
    mini, mini_n = mini_islands_of(land, land0, shore, pp(data, "mini_island_share_bps"), city_id)
    phases = day_phases(data)
    zoom = zoom_levels(data, size)
    cam = camera_bounds(size, pp(data, "camera_edge_margin_tiles"))
    overlays = level_overlays(data)
    badges = scene_badges(data)
    open_d = sum(1 for t in tiers.values() if t > 0)
    park_slots = 1 + open_d
    plaza_slots = open_d
    if data.get("_attack_park_from_seed"):
        park_slots = park_slots + draw_below(city_id, "tree", 0, 5)
    filler_occ = sum(1 for pce in placed if pce.get("kind") == "filler")
    lots_by_kind = {}
    for lot in lots:
        key = f"{lot['w']}x{lot['h']}_{lot['side']}"
        lots_by_kind[key] = lots_by_kind.get(key, 0) + 1
    fill_by_tier = {str(t): fill_share_bps(data, t) for t in range(0, _pv(data.get("progression") or {}, "tier_count") + 1)}
    centroids = {}
    for z in sorted(set(zone_of.values())):
        xs = ys = n = 0
        for i, blk in enumerate(blocks):
            if zone_of.get(i) == z:
                xs += blk["cx"]
                ys += blk["cy"]
                n += 1
        centroids[z] = {"x": xs // n if n else cx, "y": ys // n if n else cy}
    occupied_xy: set[tuple[int, int]] = set()
    for key in ("lanterns", "trees", "street", "vehicles", "drones"):
        for row in decor.get(key) or []:
            occupied_xy.add((int(row["x"]), int(row["y"])))
    grid, extras = build_map(
        land,
        roads,
        shore,
        blocks,
        decor["plaza_blocks"],
        lots,
        placed,
        zone_of,
        list(((data.get("districts") or {}).get("districts") or {})),
        x0,
        y0,
        p,
        depth,
        yard,
        land0,
        occupied_xy,
        span,
    )
    grid = apply_authored_tiles(data, grid)
    grid = drop_inland_shore_chars(grid)
    extras = drop_overwritten_piers(grid, extras)
    decor, extras, authored_walkers = apply_authored_props(data, decor, extras)
    decor["street"] = drop_overwritten_street(grid, list(decor.get("street") or []))
    decor = recount_decor(decor, land0)
    ctr = counters_of(
        lots, blocks, zone_of, land0, roads, decor, mini, park_slots, plaza_slots, filler_occ, lots_by_kind
    )
    ctr["mini_island_count"] = mini_n
    walker_ids = prefix_ids("walker_", exclude_suffix=("_n", "_e", "_s", "_w"))
    robot_ids = prefix_ids("robot_")
    unit_ids = walker_ids + robot_ids
    street = list(decor.get("street") or [])
    taken: set[tuple[int, int]] = set()
    for key in ("lanterns", "trees", "street", "vehicles", "drones"):
        for row in decor.get(key) or []:
            taken.add((int(row["x"]), int(row["y"])))
    for row in extras:
        tile = row.get("tile") or [0, 0]
        taken.add((int(tile[0]), int(tile[1])))
    s_tiles = [
        (x, y)
        for y, line in enumerate(grid)
        for x, ch in enumerate(line)
        if ch == "s" and (x, y) not in taken
    ]
    n_skins = len(unit_ids)
    n_walk = len(s_tiles) * pp(data, "walkers_per_100_sidewalk_tiles") // 100
    if n_walk < n_skins:
        n_walk = n_skins
    if n_walk > len(s_tiles):
        n_walk = len(s_tiles)
    if authored_walkers is not None:
        walkers = authored_walkers
    else:
        walkers = []
        wpool = s_tiles[:]
        cursor = 0
        for i in range(n_walk):
            if not wpool or not n_skins:
                break
            cell, cursor = pop_pool(city_id, "walker", cursor, wpool)
            x, y = cell
            if i < n_skins:
                sid = unit_ids[i]
            else:
                sid = unit_ids[draw_below(city_id, "walker", cursor, n_skins)]
                cursor += 1
            walkers.append({"x": x, "y": y, "id": sid, "background": 1})
    mini_draw = [] if overlay_flag(data, "replace_props") else mini
    objects = []
    known = known_asset_ids()
    for pce in placed:
        sid = pce["id"]
        blds = (data.get("buildings") or {}).get("buildings") or {}
        sprite = (blds.get(sid) or {}).get("sprite") or sid
        if sprite == "residential_block":
            skins = listed_ids(RESIDENTIAL_SKINS) or [sprite]
            sprite = skins[int(pce.get("lot_index") or 0) % len(skins)]
        if sprite in known:
            objects.append(scene_object(sprite, int(pce["x"]), int(pce["y"]), geom_of(pce)))
    for row in (
        decor["lanterns"]
        + decor["trees"]
        + street
        + mini_draw
        + decor["vehicles"]
        + decor["drones"]
        + walkers
    ):
        if row["id"] in known:
            objects.append(scene_object(row["id"], int(row["x"]), int(row["y"]), geom_of(row)))
    for row in extras:
        if row["id"] in known:
            tile = row.get("tile") or [0, 0]
            objects.append(scene_object(row["id"], int(tile[0]), int(tile[1]), geom_of(row)))
    field_roles = {k: "presentation" for k in ("lots", "blocks", "trees", "lanterns", "street", "vehicles", "drones", "walkers", "grid", "plaza_pads")}
    for k in ("park_slots", "plaza_slots", "filler_occupied_total"):
        field_roles[k] = "economic_bridge"
    for k in COUNTER_KEYS:
        field_roles.setdefault(k, "counter")
    artifact = {
        "legend": dict(SCENE_LEGEND),
        "map": grid,
        "objects": objects,
    }
    layout_hash = hashlib.sha256(canonical(artifact)).hexdigest()
    if data.get("_attack_layout_hash"):
        layout_hash = "0" * 64

    park_from_seed = 1 if data.get("_attack_park_from_seed") else 0
    economic_bridges = {
        "park_slots": {"v": park_slots, "from": "district_state", "seed": park_from_seed},
        "plaza_slots": {"v": plaza_slots, "from": "district_state", "seed": 0},
        "filler_occupied_total": {"v": filler_occ, "from": "district_tier_and_free_lots", "seed": 0},
    }

    out = {
        "block_side": side,
        "lot_ring_depth": depth,
        "courtyard_side": yard,
        "island_radius_tiles": r,
        "grid_size": size,
        "lots_per_block": lots_per_block_of(data),
        "lots_needed": lots_needed_of(data),
        "blocks_required": need,
        "blocks_on_land": len(blocks),
        "road_origin_x": x0,
        "road_origin_y": y0,
        "min_road_period": min_road_period(data),
        "zone_anchor_ring": pp(data, "zone_anchor_ring_step"),
        "zone_rotation": rotation,
        "dawn_hour": phases["dawn_hour"],
        "day_hour": phases["day_hour"],
        "dusk_hour": phases["dusk_hour"],
        "night_hour": phases["night_hour"],
        "phase_hours_sum": phases["phase_hours_sum"],
        "phases": phases["phases"],
        "lanterns_on_phases": phases["lanterns_on_phases"],
        "zoom_max_scale": zoom["zoom_max_scale"],
        "zoom_min_scale_num": zoom["zoom_min_scale_num"],
        "zoom_min_scale_den": zoom["zoom_min_scale_den"],
        "zoom_levels": zoom["zoom_levels"],
        "safe_rect_w_px": zoom["safe_rect_w_px"],
        "safe_rect_h_px": zoom["safe_rect_h_px"],
        "iso_w_px": zoom["iso_w_px"],
        "iso_h_px": zoom["iso_h_px"],
        "camera_bounds": cam,
        "zone_centroids": centroids,
        "building_level_max": overlays["building_level_max"],
        "overlay_elements_at_max": overlays["overlay_elements_at_max"],
        "level_overlays": overlays["level_overlays"],
        "scene_badges": badges["scene_badges"],
        "log_only_idle": badges["log_only_idle"],
        "park_slots": park_slots,
        "plaza_slots": plaza_slots,
        "filler_occupied_total": filler_occ,
        "fill_share_by_tier": fill_by_tier,
        "decor_realized_share_bps": decor["decor_realized_share_bps"],
        "lantern_count": decor["lantern_count"],
        "tree_count": decor["tree_count"],
        "vehicle_count": decor["vehicle_count"],
        "drone_count": decor["drone_count"],
        "mini_island_count": mini_n,
        "land_tiles": ctr["land_tiles"],
        "water_tiles": ctr["water_tiles"],
        "road_tiles": ctr["road_tiles"],
        "lots_total": len(lots),
        "lots_per_zone": ctr["lots_per_zone"],
        "lots_by_kind": ctr["lots_by_kind"],
        "counters": ctr,
        "field_roles": field_roles,
        "economic_bridges": economic_bridges,
        "tick_inputs": [],
        "layout_hash": layout_hash,
        "prng_streams": list(PRNG_STREAMS),
        "lots": [{k: v for k, v in lot.items() if not str(k).startswith("_")} for lot in lots],
        "blocks": [
            {
                "id": i,
                "kx": b["kx"],
                "ky": b["ky"],
                "x0": b["x0"],
                "y0": b["y0"],
                "cx": b["cx"],
                "cy": b["cy"],
                "zone": zone_of.get(i, ""),
            }
            for i, b in enumerate(blocks)
        ],
        "plaza_pads": decor.get("plaza_pads") or [],
        "reference_layout": placed,
        "lanterns": decor["lanterns"],
        "trees": decor["trees"],
        "street": street,
        "vehicles": decor["vehicles"],
        "drones": decor["drones"],
        "walkers": walkers,
        "mini_islands": mini,
        "shore": sorted(list(shore)),
        "jittered_tiles": jittered,
        "protected_tiles": len(protected),
        "scene": artifact,
        "zone_block_counts": zone_counts,
        "reference_tiers": tiers,
        "open_district_count": open_d,
    }
    _WORLD_MEMO[memo_key] = out
    return copy.deepcopy(out)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    data = sections()
    g = build_world(data, {}, pp(data, "demo_seed"))
    print(f"grid       : {g['grid_size']}  R={g['island_radius_tiles']}  P={pp(data, 'road_period_tiles')}")
    print(f"blocks     : {g['blocks_on_land']} required {g['blocks_required']} lots/block {g['lots_per_block']}")
    print(f"lots       : {g['lots_total']} needed {g['lots_needed']}")
    print(f"decor bps  : {g['decor_realized_share_bps']} trees {g['tree_count']} lanterns {g['lantern_count']}")
    print(f"hash       : {g['layout_hash']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
