"""Replay build_island.py edits with fuzzy matching, stop before grid plaza."""

from __future__ import annotations

import ast
import json
from pathlib import Path

JSONL = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)
OUT = Path(r"C:\Users\sk640\ai_city\art\island_v3\_recovered_mosaic.py")


def is_builder(path: str) -> bool:
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
        name = block.get("name") or ""
        inp = block.get("input") or {}
        if not isinstance(inp, dict):
            continue
        if not is_builder(str(inp.get("path") or "")):
            continue
        if name in ("Write", "write") and "contents" in inp:
            out.append(("Write", inp))
        elif name == "StrReplace" and "old_string" in inp:
            out.append(("StrReplace", inp))
    return out


def fuzzy_span(text: str, old: str) -> tuple[int, int] | None:
    lines = old.splitlines()
    if len(lines) < 4:
        head = old[: min(80, len(old))]
        if len(head) < 20:
            return None
        i = text.find(head)
        if i < 0:
            return None
        return i, i + len(old) if text[i : i + len(old)] == old else None
    n_head = min(6, len(lines))
    n_tail = min(6, len(lines))
    head = "\n".join(lines[:n_head])
    tail = "\n".join(lines[-n_tail:])
    i = text.find(head)
    if i < 0:
        return None
    j = text.find(tail, i + len(head))
    if j < 0:
        return None
    return i, j + len(tail)


def apply_one(text: str, old: str, new: str, replace_all: bool) -> tuple[str, str]:
    if old in text:
        if replace_all:
            return text.replace(old, new), "exact"
        return text.replace(old, new, 1), "exact"
    span = fuzzy_span(text, old)
    if span is None:
        return text, "fail"
    a, b = span
    return text[:a] + new + text[b:], "fuzzy"


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
        print("stop before grid op", i, "line", _ln)
        break

write_i = [i for i, x in enumerate(all_ops) if x[1] == "Write" and (grid_i is None or i < grid_i)]
start = write_i[-1]
print("start write", start, "line", all_ops[start][0], "stop", grid_i)

text = all_ops[start][2]["contents"]
exact = 0
fuzzy = 0
failed = 0
fail_mass = 0
end = grid_i if grid_i is not None else len(all_ops)
for i in range(start + 1, end):
    _ln, name, inp = all_ops[i]
    if name == "Write":
        print("skip later write", i, "line", _ln)
        continue
    old = inp["old_string"]
    new = inp["new_string"]
    text, how = apply_one(text, old, new, bool(inp.get("replace_all")))
    if how == "exact":
        exact += 1
    elif how == "fuzzy":
        fuzzy += 1
    else:
        failed += 1
        if "def build_mass" in old or "def build_mass" in new:
            fail_mass += 1
            print("FAIL mass-related", i, "line", _ln, "old", len(old), "new", len(new))

print("exact", exact, "fuzzy", fuzzy, "failed", failed, "fail_mass", fail_mass)
print("lines", text.count("\n") + 1)
print("build_mass", "def build_mass" in text)
print("underlay", "PLAZA_Z - 2.4" in text)
print("tiles", "plaza tiles" in text)
print("grid", "plaza grid" in text)
print("ISLAND_SCALE", "ISLAND_SCALE" in text)
try:
    ast.parse(text)
    print("ast ok")
except SyntaxError as ex:
    print("ast FAIL", ex)

OUT.write_text(text, encoding="utf-8", newline="\n")
print("wrote", OUT)
