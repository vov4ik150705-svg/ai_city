"""Dump mosaic plaza patches and nearby Writes from the island transcript."""

from __future__ import annotations

import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recover_dumps")
OUT.mkdir(exist_ok=True)


def is_island_builder(path: str) -> bool:
    n = path.replace("/", "\\")
    return "island_v3" in n and "snapshots" not in n


ops: list[tuple[int, str, str, dict]] = []
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
            name = block.get("name") or ""
            inp = block.get("input") or {}
            if not isinstance(inp, dict):
                continue
            path = str(inp.get("path") or "")
            if not is_island_builder(path):
                continue
            if name in ("Write", "write") and "contents" in inp:
                ops.append((line_i, name, path, inp))
            elif name in ("StrReplace",) and "old_string" in inp:
                ops.append((line_i, name, path, inp))

print("ops", len(ops))
writes = [(i, ln, path, inp) for i, (ln, name, path, inp) in enumerate(ops) if name in ("Write", "write")]
print("writes", len(writes))
for i, ln, path, inp in writes:
    c = inp["contents"]
    print(
        f"  op {i} line {ln} path={Path(path).name} len={len(c)} "
        f"mass={'def build_mass' in c} tiles={'plaza tiles' in c} "
        f"under={'PLAZA_Z - 2.4' in c} grid={'plaza grid' in c}"
    )
    (OUT / f"write_op{i}_{Path(path).name}").write_text(c, encoding="utf-8")

# plaza grid swap
for i, (ln, name, path, inp) in enumerate(ops):
    blob = (inp.get("new_string") or "") + (inp.get("contents") or "")
    if "plaza grid faces" in blob or "Polar deck at plaza Z" in blob:
        old = inp.get("old_string") or ""
        new = inp.get("new_string") or ""
        (OUT / "op_grid_old.py").write_text(old, encoding="utf-8")
        (OUT / "op_grid_new.py").write_text(new, encoding="utf-8")
        print("GRID op", i, "line", ln, "old", len(old), "new", len(new))
        print("  old has tiles", "plaza tiles" in old, "under", "PLAZA_Z - 2.4" in old)
        print("  old head", old[:120].replace("\n", " | "))

# last new_string that has plaza tiles AND polar underlay rings
best = None
for i, (ln, name, path, inp) in enumerate(ops):
    new = inp.get("new_string") or inp.get("contents") or ""
    if "plaza tiles" in new and "vert((cx, cy), 2)" in new:
        best = (i, ln, len(new), new)
print("best mosaic new", None if best is None else (best[0], best[1], best[2]))
if best:
    (OUT / "best_mosaic_new.py").write_text(best[3], encoding="utf-8")

# last old_string with those
best_old = None
for i, (ln, name, path, inp) in enumerate(ops):
    old = inp.get("old_string") or ""
    if "plaza tiles" in old and "vert((cx, cy), 2)" in old:
        best_old = (i, ln, len(old), old)
print("best mosaic old", None if best_old is None else (best_old[0], best_old[1], best_old[2]))
if best_old:
    (OUT / "best_mosaic_old.py").write_text(best_old[3], encoding="utf-8")
