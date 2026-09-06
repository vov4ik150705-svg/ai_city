"""Dump last hull/build_mass fragments before the grid swap."""

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
    "belts = (",
    "def _square_corners",
    "def _outline_indices",
    "def _block_loop",
    "def _loop_walls",
    "def paint_mass",
    "_STONE_RGB = (",
    "_PLAZA_RGB",
    "def bind_stone_materials",
    "n_blocks = 16",
    "idxs = _outline_indices",
    "def _sector_bin",
    "def _nearest_loop",
    "inner_t = 0.988",
)


def iter_ops():
    with JSONL.open(encoding="utf-8") as f:
        for line_i, line in enumerate(f):
            if "build_island.py" not in line:
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
                if "build_island.py" not in path.replace("/", "\\"):
                    continue
                yield line_i, block.get("name") or "", inp


grid_line = 1436
last: dict[str, tuple[int, str, str]] = {}
for line_i, name, inp in iter_ops():
    if line_i >= grid_line:
        break
    for key in ("new_string", "contents"):
        blob = inp.get(key) or ""
        if not blob:
            continue
        for needle in needles:
            if needle in blob:
                last[needle] = (line_i, key, blob)

for needle, (ln, key, blob) in last.items():
    safe = "".join(ch if ch.isalnum() else "_" for ch in needle)[:40]
    path = OUT / f"last_{safe}_L{ln}.py"
    path.write_text(blob, encoding="utf-8")
    print(f"{needle!r:30} L{ln} {key:12} {len(blob):5} -> {path.name}")
