"""Extract full hull new_string from jsonl line 804 and any z_foot0 continuations."""

from __future__ import annotations

import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recover_dumps")

want_lines = {804, 885, 895, 940, 1212, 1328, 1329}
with JSONL.open(encoding="utf-8") as f:
    for line_i, line in enumerate(f):
        if line_i not in want_lines and "z_foot0" not in line and "_outline_loop" not in line:
            continue
        rec = json.loads(line)
        msg = rec.get("message") or rec
        content = msg.get("content") if isinstance(msg, dict) else None
        if not isinstance(content, list):
            continue
        n = 0
        for bi, block in enumerate(content):
            if not isinstance(block, dict):
                continue
            inp = block.get("input") or {}
            if not isinstance(inp, dict):
                continue
            for key in ("new_string", "old_string", "contents"):
                blob = inp.get(key) or ""
                if not blob:
                    continue
                if line_i in want_lines or "z_foot0" in blob or "_outline_loop(" in blob:
                    p = OUT / f"line{line_i}_{key}_{bi}_{len(blob)}.py"
                    p.write_text(blob, encoding="utf-8")
                    n += 1
                    flags = []
                    for m in ("z_lo", "belts", "outline_loop", "bind_stone", "plaza tiles", "return ob", "n_blocks"):
                        if m.replace(" ", "") in blob.replace(" ", "") or m in blob:
                            flags.append(m)
                    print(p.name, flags)
        if line_i in want_lines:
            print("done line", line_i, "blocks", n)
