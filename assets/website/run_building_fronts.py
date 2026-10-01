"""Launch one Blender process per building still.

In-process factory reset is not enough: EEVEE starts writing empty
transparent frames after the first successful still in the same process.
Does not touch models/*.glb.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BLENDER = Path(r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe")
SCRIPT = ROOT / "render_building_fronts.py"
ALL_SLUGS = (
    "agent_hub",
    "ai_research_center",
    "bank",
    "city_hall",
    "clearing_house",
    "cloud_campus",
    "data_center",
    "drone_depot",
    "energy_plant",
    "exchange",
    "finance_tower",
    "flagship_store",
    "fleet_yard",
    "logistics_hub",
    "neon_residence",
    "power_node",
    "retail_complex",
    "robotics_lab",
    "workshop",
)


def main() -> None:
    if not BLENDER.is_file():
        raise SystemExit(f"missing {BLENDER}")
    extra = [token.strip() for arg in sys.argv[1:] for token in arg.split(",") if token.strip()]
    slugs = extra or list(ALL_SLUGS)
    unknown = [slug for slug in slugs if slug not in ALL_SLUGS]
    if unknown:
        raise SystemExit("unknown slug: " + ", ".join(unknown))
    failed: list[str] = []
    for slug in slugs:
        cmd = [str(BLENDER), "--background", "--python", str(SCRIPT), "--", slug]
        print("render", slug, flush=True)
        result = subprocess.run(cmd, text=True)
        if result.returncode != 0:
            failed.append(slug)
    if failed:
        raise SystemExit("render failed: " + ", ".join(failed))
    print(f"ok {len(slugs)} stills -> {ROOT / 'buildings'}", flush=True)


if __name__ == "__main__":
    main()
