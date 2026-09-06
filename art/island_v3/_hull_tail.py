"""Dump the last hull tail that finishes build_mass."""

from __future__ import annotations

import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recover_dumps")

hits = []
with JSONL.open(encoding="utf-8") as f:
    for line_i, line in enumerate(f):
        if line_i >= 1436:
            break
        if "bind_stone_materials" not in line and "island faces" not in line:
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
            blob = inp.get("new_string") or ""
            if "bind_stone_materials" in blob and ("belts" in blob or "z_lo" in blob or "loop_walls" in blob):
                hits.append((line_i, len(blob), blob))
            elif "island faces" in blob and "return ob" in blob and len(blob) > 400:
                hits.append((line_i, len(blob), blob))

print("hits", len(hits))
for ln, n, blob in hits[-8:]:
    path = OUT / f"hulltail_L{ln}_{n}.py"
    path.write_text(blob, encoding="utf-8")
    print(" ", ln, n, "loop_walls", "_loop_walls" in blob, "belts", "belts" in blob, "mosaic", "PLAZA_Z - 2.4" in blob)
