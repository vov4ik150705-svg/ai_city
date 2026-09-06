"""Decode meshopt on the 16 comparison GLBs so Blender 4.5 can import them."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
RUNTIME = ROOT / "runtime"
DECODED = RUNTIME / "_diet_shots" / "_decoded"
BUILDINGS = ("nvidia_tower", "bank", "city_hall", "clearinghouse")
LEVELS: tuple[tuple[str, Path], ...] = (
    ("src", RUNTIME / "buildings"),
    ("8k", RUNTIME / "_diet_a"),
    ("4k", RUNTIME / "_diet_b"),
    ("2k", RUNTIME / "_diet_c"),
)


def gltf_transform(*args: str) -> None:
    corepack = shutil.which("corepack")
    if corepack is None:
        raise RuntimeError("corepack not on PATH")
    env = dict(os.environ)
    env.setdefault("NODE_OPTIONS", "--use-system-ca")
    cmd = [corepack, "pnpm", "exec", "gltf-transform", *args]
    result = subprocess.run(cmd, cwd=REPO, text=True, capture_output=True, env=env)
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"gltf-transform {' '.join(args)} failed: {err}")


def main() -> None:
    DECODED.mkdir(parents=True, exist_ok=True)
    for level, folder in LEVELS:
        out_dir = DECODED / level
        out_dir.mkdir(parents=True, exist_ok=True)
        for slug in BUILDINGS:
            src = folder / f"{slug}.glb"
            dest = out_dir / f"{slug}.glb"
            if not src.is_file():
                raise SystemExit(f"missing {src}")
            # weld decodes EXT_meshopt_compression; triangle count stays the same
            gltf_transform("weld", str(src), str(dest))
            print(f"decoded {level}/{slug}.glb -> {dest.stat().st_size} B", flush=True)


if __name__ == "__main__":
    main()
