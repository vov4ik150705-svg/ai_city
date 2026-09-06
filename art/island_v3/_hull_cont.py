"""Find hull continuation after up0/vf0 walls."""

from __future__ import annotations

import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recover_dumps")

keys = (
    "_loop_walls(bm, up0, vf0",
    "for spec in belts",
    "for r_t, z_t",
    "foot = loop_verts",
    "bind_stone_materials(ob)",
    "_loop_walls_split",
)

last = {k: None for k in keys}
with JSONL.open(encoding="utf-8") as f:
    for line_i, line in enumerate(f):
        if line_i >= 1436:
            break
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
            blob = (inp.get("new_string") or "") if isinstance(inp, dict) else ""
            for k in keys:
                if k in blob:
                    last[k] = (line_i, len(blob), blob)

for k, v in last.items():
    if v is None:
        print("MISS", k)
        continue
    ln, n, blob = v
    safe = "".join(ch if ch.isalnum() else "_" for ch in k)[:36]
    (OUT / f"cont_{safe}_L{ln}.py").write_text(blob, encoding="utf-8")
    print(f"{k!r:40} L{ln} {n}")
