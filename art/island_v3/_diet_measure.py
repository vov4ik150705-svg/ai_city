"""Count triangles and bytes for runtime / diet GLBs. Stdlib only."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path


def read_glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise RuntimeError(f"{path} is not GLB")
    json_len, json_type = struct.unpack_from("<I4s", data, 12)
    if json_type != b"JSON":
        raise RuntimeError(f"{path} missing JSON chunk")
    parsed = json.loads(data[20 : 20 + json_len].rstrip(b"\x00 "))
    if not isinstance(parsed, dict):
        raise RuntimeError(f"{path} JSON root is not an object")
    return parsed


def triangle_count(path: Path) -> int:
    doc = read_glb_json(path)
    accessors = list(doc.get("accessors") or [])
    total = 0
    for mesh in doc.get("meshes") or []:
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            mode = int(prim.get("mode", 4))
            indices = prim.get("indices")
            attrs = prim.get("attributes")
            count = 0
            if isinstance(indices, int) and 0 <= indices < len(accessors):
                acc = accessors[indices]
                if isinstance(acc, dict):
                    count = int(acc.get("count") or 0)
            elif isinstance(attrs, dict):
                pos = attrs.get("POSITION")
                if isinstance(pos, int) and 0 <= pos < len(accessors):
                    acc = accessors[pos]
                    if isinstance(acc, dict):
                        count = int(acc.get("count") or 0)
            if mode == 4:
                total += count // 3
            elif mode in (5, 6):
                total += max(count - 2, 0)
            else:
                raise RuntimeError(f"{path.name}: unsupported primitive mode {mode}")
    return total


def measure_dir(folder: Path) -> list[tuple[str, int, int]]:
    rows: list[tuple[str, int, int]] = []
    for path in sorted(folder.glob("*.glb")):
        rows.append((path.stem, triangle_count(path), path.stat().st_size))
    return rows


def main() -> None:
    folder = Path(sys.argv[1])
    rows = measure_dir(folder)
    tris = 0
    size = 0
    print(f"{'slug':<22} {'tris':>10} {'bytes':>10}")
    for slug, t, b in rows:
        tris += t
        size += b
        print(f"{slug:<22} {t:10d} {b:10d}")
    print(f"{'TOTAL':<22} {tris:10d} {size:10d}")


if __name__ == "__main__":
    main()
