"""Recover build_island.py from the island transcript, stopping before the grid plaza."""

from __future__ import annotations

import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recovered_mosaic.py")


def is_island_builder(path: str) -> bool:
    n = path.replace("/", "\\")
    return n.endswith("build_island.py") and "island_v3" in n and "snapshots" not in n


def ops_from_rec(rec: dict) -> list[tuple[str, dict]]:
    msg = rec.get("message") or rec
    content = msg.get("content") if isinstance(msg, dict) else None
    if not isinstance(content, list):
        return []
    out = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") not in ("tool_use", None) and "name" not in block:
            continue
        name = block.get("name") or ""
        inp = block.get("input") or {}
        if not isinstance(inp, dict):
            continue
        path = str(inp.get("path") or "")
        if not is_island_builder(path):
            continue
        if name in ("Write", "write") and "contents" in inp:
            out.append(("Write", inp))
        elif name in ("StrReplace", "strreplace", "StrReplace") and "old_string" in inp:
            out.append(("StrReplace", inp))
    return out


all_ops: list[tuple[int, str, dict]] = []
with JSONL.open(encoding="utf-8") as f:
    for line_i, line in enumerate(f):
        if "build_island.py" not in line:
            continue
        rec = json.loads(line)
        for name, inp in ops_from_rec(rec):
            all_ops.append((line_i, name, inp))

grid_i = None
for i, (_ln, name, inp) in enumerate(all_ops):
    new = inp.get("new_string") or inp.get("contents") or ""
    if "plaza grid faces" in new or "Polar deck at plaza Z" in new:
        grid_i = i
        print("grid op index", i, "line", _ln, name)
        break

write_i = [i for i, (_ln, name, _inp) in enumerate(all_ops) if name == "Write" and (grid_i is None or i < grid_i)]
print("writes before grid", write_i)
print("write contents flags:")
for i in write_i:
    c = all_ops[i][2]["contents"]
    print(
        " ",
        i,
        "len",
        len(c),
        "mass",
        "def build_mass" in c,
        "voronoi",
        "def voronoi" in c or "voronoi_cells" in c,
        "scale",
        "ISLAND_SCALE" in c,
    )
print("search markers in all ops:")
needles = (
    "def build_mass",
    "PLAZA_Z - 2.4",
    "plaza tiles",
    "plaza grid faces",
    "opaque_plaza",
    "voronoi_cells",
    "ISLAND_SCALE",
)
for needle in needles:
    hits = []
    for i, (_ln, name, inp) in enumerate(all_ops):
        blob = (inp.get("new_string") or "") + "\n" + (inp.get("contents") or "") + "\n" + (inp.get("old_string") or "")
        if needle in blob:
            hits.append((i, _ln, name, needle in (inp.get("new_string") or ""), needle in (inp.get("contents") or "")))
    print(f"  {needle!r}: {len(hits)} first={hits[:3]} last={hits[-2:]}")
print("write 196 defs:")
for line in all_ops[196][2]["contents"].splitlines():
    if line.startswith("def ") or "SCALE" in line[:24]:
        print(" ", line[:140])
for start in write_i:
    text = None
    writes = 0
    replaces = 0
    failed = 0
    end = grid_i if grid_i is not None else len(all_ops)
    for i in range(start, end):
        name, inp = all_ops[i][1], all_ops[i][2]
        if name == "Write":
            if i != start:
                break
            text = inp["contents"]
            writes += 1
            continue
        old = inp["old_string"]
        new_s = inp["new_string"]
        ra = bool(inp.get("replace_all"))
        if text is None or old not in text:
            failed += 1
            continue
        text = text.replace(old, new_s) if ra else text.replace(old, new_s, 1)
        replaces += 1
    flag = text and "def build_mass" in text and "PLAZA_Z - 2.4" in text
    print(
        " start",
        start,
        "repl",
        replaces,
        "fail",
        failed,
        "lines",
        None if text is None else text.count("\n") + 1,
        "mass",
        text is not None and "def build_mass" in text,
        "underlay",
        text is not None and "PLAZA_Z - 2.4" in text,
        "tiles",
        text is not None and "plaza tiles" in text,
    )
    if flag:
        OUT.write_text(text, encoding="utf-8", newline="\n")
        print("SAVED good mosaic from start", start)
        break
else:
    print("no perfect mosaic; dump last try")
    if text:
        OUT.write_text(text, encoding="utf-8", newline="\n")

DUMP = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recover_dumps")
DUMP.mkdir(exist_ok=True)
print("failed key ops from start 196:")
text = all_ops[196][2]["contents"]
end = grid_i if grid_i is not None else len(all_ops)
for i in range(197, end):
    name, inp = all_ops[i][1], all_ops[i][2]
    if name == "Write":
        print(" unexpected write", i)
        break
    old = inp["old_string"]
    new_s = inp["new_string"]
    ok = old in text
    if ok:
        text = text.replace(old, new_s, 1) if not inp.get("replace_all") else text.replace(old, new_s)
        continue
    blob = old + new_s
    interesting = any(
        k in blob
        for k in (
            "def build_mass",
            "PLAZA_Z - 2.4",
            "plaza tiles",
            "build_plaza",
            "build_cliff",
            "ISLAND_SCALE",
        )
    )
    if interesting:
        (DUMP / f"fail_{i}.txt").write_text(
            f"LINE {all_ops[i][0]}\nOLD LEN {len(old)}\nNEW LEN {len(new_s)}\n"
            f"OLD HEAD\n{old[:800]}\n---NEW HEAD---\n{new_s[:1600]}\n",
            encoding="utf-8",
        )
        print(" FAIL", i, "line", all_ops[i][0], "old", len(old), "new", len(new_s), "mass", "def build_mass" in new_s)

print("applied text after 196..grid-1: mass", "def build_mass" in text, "lines", text.count("\n") + 1)
(DUMP / "applied_196.txt").write_text(text, encoding="utf-8")
for i in (552, 573, 595, 629, 735, 746, 764, 782, 809):
    inp = all_ops[i][2]
    (DUMP / f"op_{i}_new.py").write_text(inp.get("new_string") or "", encoding="utf-8")
    (DUMP / f"op_{i}_old.py").write_text(inp.get("old_string") or "", encoding="utf-8")
    print(" dumped op", i, "new", len(inp.get("new_string") or ""), "old", len(inp.get("old_string") or ""))
