"""Launch one Blender process per comparison still."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BLENDER = Path(r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe")
SCRIPT = ROOT / "_diet_render.py"
BUILDINGS = ("nvidia_tower", "bank", "city_hall", "clearinghouse")
LEVELS = ("src", "8k", "4k", "2k")


def main() -> None:
    if not BLENDER.is_file():
        raise SystemExit(f"missing {BLENDER}")
    failed: list[str] = []
    for slug in BUILDINGS:
        for level in LEVELS:
            cmd = [str(BLENDER), "--background", "--python", str(SCRIPT), "--", slug, level]
            print(" ".join(cmd[3:]), flush=True)
            result = subprocess.run(cmd, text=True, capture_output=True)
            tail = (result.stdout or "")[-400:]
            if result.returncode != 0:
                print(result.stderr[-800:] if result.stderr else tail, flush=True)
                failed.append(f"{slug}_{level}")
                continue
            print(tail, flush=True)
    if failed:
        raise SystemExit("render failed: " + ", ".join(failed))
    print("all 16 stills ok")


if __name__ == "__main__":
    main()
