import json
import re
from pathlib import Path

p = Path(
    r"C:\Users\sk640\.cursor\projects\c-Users-sk640-ai-city\agent-transcripts"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d"
    r"\9e2fa4bc-f884-4f25-9530-d33db1b5492d.jsonl"
)


def walk(obj, acc):
    if isinstance(obj, dict):
        name = obj.get("name") or obj.get("toolName")
        inp = obj.get("input") or obj.get("arguments") or {}
        path = ""
        if isinstance(inp, dict):
            path = str(inp.get("path") or inp.get("target_file") or "")
        npath = path.replace("/", "\\")
        if npath.endswith("build_island.py") and "island_v3" in npath:
            acc.append((name, inp))
        for v in obj.values():
            walk(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            walk(v, acc)


ops = []
with p.open(encoding="utf-8") as f:
    for line in f:
        if "build_island.py" not in line:
            continue
        rec = json.loads(line)
        acc = []
        walk(rec, acc)
        ops.extend(acc)

print("ops parsed", len(ops))
text = None
writes = 0
replaces = 0
failed = 0
for name, inp in ops:
    if not isinstance(inp, dict):
        continue
    if "contents" in inp and name in ("Write", "write", None) or (
        "contents" in inp and "old_string" not in inp
    ):
        if "contents" in inp and "old_string" not in inp:
            text = inp["contents"]
            writes += 1
            continue
    if "old_string" in inp and "new_string" in inp:
        old, new = inp["old_string"], inp["new_string"]
        ra = bool(inp.get("replace_all"))
        if text is None:
            failed += 1
            continue
        if ra:
            if old not in text:
                failed += 1
            else:
                text = text.replace(old, new)
                replaces += 1
        else:
            if old not in text:
                failed += 1
            else:
                text = text.replace(old, new, 1)
                replaces += 1

print("writes", writes, "replaces", replaces, "failed", failed, "len", None if text is None else len(text))
if text:
    out = Path(r"C:\Users\sk640\ai_city\art\island_v3\build_island.py")
    out.write_text(text, encoding="utf-8", newline="\n")
    print("saved lines", text.count("\n") + 1)
    m = re.search(r"ISLAND_SCALE = .+", text)
    print(m.group(0) if m else "no scale")
    print("has hall plant", "city_hall_qu" in text)
    print("empty buildings", "buildings: tuple" in text or "buildings = ()" in text)
    print("plaza grid", "plaza grid faces" in text)
