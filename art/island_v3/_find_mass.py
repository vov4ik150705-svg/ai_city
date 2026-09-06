"""Find the last/largest build_mass and helper patches."""

from __future__ import annotations

import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recover_dumps")

needles = (
    "def build_mass",
    "def paint_mass",
    "def _mark_face",
    "def _tri(",
    "def _quad(",
    "_STONE_RGB",
    "n_blocks",
    "z_lo = -248",
    "ring_pts =",
    "def _cell_bin",
    "def _stone_bin",
    "GROUT_MAT",
    "snap_thresh",
    "MIN_CELL",
)


def walk_ops():
    with JSONL.open(encoding="utf-8") as f:
        for line_i, line in enumerate(f):
            if "island_v3" not in line:
                continue
            rec = json.loads(line)
            msg = rec.get("message") or rec
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                inp = block.get("input") or {}
                if not isinstance(inp, dict):
                    continue
                path = str(inp.get("path") or "")
                if "island_v3" not in path.replace("/", "\\"):
                    continue
                name = block.get("name") or ""
                yield line_i, name, path, inp


best: dict[str, tuple[int, int, str, str]] = {}
for line_i, name, path, inp in walk_ops():
    for key in ("new_string", "contents", "old_string"):
        blob = inp.get(key) or ""
        if not blob:
            continue
        for needle in needles:
            if needle in blob and len(blob) >= best.get(needle, (0, 0, "", ""))[1]:
                best[needle] = (line_i, len(blob), key, blob)

for needle, (ln, n, key, blob) in best.items():
    safe = needle.replace(" ", "_").replace("(", "").replace("=", "").replace("-", "m")
    (OUT / f"best_{safe}_{key}_L{ln}.py").write_text(blob, encoding="utf-8")
    print(f"{needle!r:24} line {ln:5} {key:12} len {n:6} path-ish defs {blob.count('def ')}")
