"""Bake LOOK-02 local floor/origin on runtime building GLBs.

Decodes meshopt quantization, writes FLOAT positions in metres with
identity node TRS, snaps union floor to Y=0, then recompresses with
meshopt FILTER so accessor min/max stay metres. Does not touch
island.blend, models/, mass, or runtime_terra19.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
BUILDINGS = ROOT / "runtime" / "buildings"
HELPER = ROOT / "meshopt_keep_float.mjs"
BUILDING_BUDGET = 350 * 1024

sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "reviews" / "LOOK-02"))
from diet_runtime import triangle_count  # noqa: E402
from gate_look02 import building_root, is_identity, node_world_bounds, read_glb  # noqa: E402


def log(msg: str) -> None:
    print(msg, flush=True)


def run_helper(src: Path, dest: Path) -> None:
    if not HELPER.is_file():
        raise RuntimeError(f"missing {HELPER}")
    node = shutil.which("node")
    if node is None:
        raise RuntimeError("node not on PATH")
    cmd = [node, str(HELPER), str(src), str(dest)]
    log("node " + HELPER.name + " " + src.name)
    result = subprocess.run(cmd, cwd=str(REPO), text=True, capture_output=True)
    if result.stdout:
        sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stderr.write(result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"{HELPER.name} failed on {src.name} ({result.returncode})")


def gate_metrics(path: Path) -> dict[str, object]:
    doc = read_glb(path)
    slug = path.stem
    root = building_root(doc, slug)
    ok, why = is_identity(root)
    bounds = node_world_bounds(doc)
    if bounds is None:
        raise RuntimeError(f"{path.name}: no mesh bounds")
    lo, hi = bounds
    return {
        "name": path.name,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "tris": triangle_count(path),
        "root_identity": ok,
        "root_why": why,
        "floor_y": lo[1],
        "height": hi[1] - lo[1],
        "center_x": 0.5 * (lo[0] + hi[0]),
        "center_z": 0.5 * (lo[2] + hi[2]),
        "min": lo,
        "max": hi,
    }


def bake_one(path: Path) -> tuple[dict[str, object], dict[str, object]]:
    before = gate_metrics(path)
    with tempfile.TemporaryDirectory(prefix="origin_", dir=str(path.parent)) as tmp:
        dest = Path(tmp) / path.name
        run_helper(path, dest)
        after = gate_metrics(dest)
        if int(after["tris"]) != int(before["tris"]):
            raise RuntimeError(f"{path.name}: tris {before['tris']} -> {after['tris']}")
        if after["bytes"] > BUILDING_BUDGET:
            raise RuntimeError(f"{path.name}: {after['bytes']} exceeds {BUILDING_BUDGET}")
        tmp_out = path.with_name(path.name + ".origintmp")
        shutil.copy2(dest, tmp_out)
        os.replace(tmp_out, path)
    return before, after


def main() -> None:
    files = sorted(BUILDINGS.glob("*.glb"))
    if len(files) != 18:
        raise SystemExit(f"expected 18 building glbs, found {len(files)}")
    rows: list[dict[str, object]] = []
    for path in files:
        before, after = bake_one(path)
        log(
            f"{path.stem}: floor {before['floor_y']:.3f}->{after['floor_y']:.3f} "
            f"h {float(before['height']):.1f}->{float(after['height']):.1f} "
            f"bytes {before['bytes']}->{after['bytes']}"
        )
        rows.append({"before": before, "after": after})
    log(f"baked {len(rows)} buildings")


if __name__ == "__main__":
    main()
