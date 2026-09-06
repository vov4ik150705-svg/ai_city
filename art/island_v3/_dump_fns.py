"""Dump _nearest_on_ring and _cap_down from the island transcript."""

from __future__ import annotations

import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recover_dumps")

with JSONL.open(encoding="utf-8") as f:
    for line_i, line in enumerate(f):
        if line_i not in (948, 1269, 1176, 896, 902):
            continue
        rec = json.loads(line)
        msg = rec.get("message") or rec
        content = msg.get("content") if isinstance(msg, dict) else None
        if not isinstance(content, list):
            continue
        for bi, block in enumerate(content):
            if not isinstance(block, dict):
                continue
            inp = block.get("input") or {}
            blob = inp.get("new_string") or ""
            if not blob:
                continue
            p = OUT / f"fn_L{line_i}_{bi}_{len(blob)}.py"
            p.write_text(blob, encoding="utf-8")
            print(p.name, "nearest" if "_nearest_on_ring" in blob else "", "cap" if "_cap_down" in blob else "", "walls" if "_loop_walls" in blob else "")
