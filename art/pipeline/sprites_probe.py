"""L5b sprite probes: pending closed, every drawn sprite stays inside the palette.

    python art/pipeline/sprites_probe.py

Exit code 1 with a named line per failed probe.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

import pixelize

ART = Path(__file__).resolve().parents[1]
PENDING = ART / "pipeline" / "assets_pending.json"
ASSETS = ART / "pipeline" / "assets.json"
CLOSED_IDS = (
    "workshop",
    "agent_hub",
    "power_node",
    "bank",
    "drone_depot",
    "data_center",
    "fleet_yard",
    "retail_complex",
    "clearing_house",
    "residential_block",
    "office_block",
    "silo_warehouse",
    "substation",
    "server_annex",
    "park",
    "plaza",
    "district_billboard",
    "vehicle",
    "drone",
)


def pending_assets_closed() -> str | None:
    blob = json.loads(PENDING.read_text(encoding="utf-8"))
    rows = list(blob.get("assets") or [])
    todo = [row["id"] for row in rows if row.get("status") == "todo"]
    if todo:
        return f"assets_pending still has todo {todo[:6]}"
    return None


def closed_ids_are_drawn() -> str | None:
    cfg = json.loads(ASSETS.read_text(encoding="utf-8"))
    drawn = {a["id"] for a in cfg["assets"]}
    missing = [sid for sid in CLOSED_IDS if sid not in drawn]
    if missing:
        return f"drawn assets missing {missing[:6]}"
    for sid in CLOSED_IDS:
        raw = ART / "raw" / f"raw_{sid}.png"
        if not raw.exists():
            return f"raw file missing for {sid}"
    return None


def sprite_pixels_in_palette() -> str | None:
    palette, _ramps = pixelize.load_palette(pixelize.PALETTE_FILE)
    allowed = {tuple(int(c) for c in row) for row in palette}
    manifest = json.loads((ART / "out" / "sprites.json").read_text(encoding="utf-8"))
    for sid, meta in manifest["sprites"].items():
        path = ART / "out" / meta["file"]
        img = Image.open(path).convert("RGBA")
        arr = np.asarray(img)
        opaque = arr[..., 3] > 0
        if not opaque.any():
            return f"{sid} has no opaque pixels"
        used = {tuple(int(c) for c in row) for row in arr[opaque][..., :3].reshape(-1, 3)}
        extra = used - allowed
        if extra:
            sample = next(iter(extra))
            return f"{sid} uses off-palette colour {sample}"
    return None


PROBES = (
    ("pending_assets_closed", pending_assets_closed),
    ("closed_ids_are_drawn", closed_ids_are_drawn),
    ("sprite_pixels_in_palette", sprite_pixels_in_palette),
)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    failed = 0
    for name, probe in PROBES:
        why = probe()
        if why is None:
            print(f"  ok   {name}")
        else:
            print(f"  FAIL {name}: {why}")
            failed += 1
    print(f"probes {len(PROBES)} / failed {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
