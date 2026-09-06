"""Verify generated.placement.scene hash. Does not write art/out (D-V-2).

    python art/pipeline/layout.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ART = Path(__file__).resolve().parent.parent
REPO = ART.parent
PACK = REPO / "content" / "out" / "pack.json"


def write_layout(pack_path: Path | None = None, out_dir: Path | None = None) -> int:
    """Check layout_hash == sha256(scene). Named stderr + exit 1 on mismatch.

    `out_dir` is ignored: art/out is not a runtime source (R-V-22).
    """
    pack_path = pack_path or PACK
    if not pack_path.exists():
        print("layout.py: content/out/pack.json is missing; run python content/build.py", file=sys.stderr)
        return 1
    try:
        pack = json.loads(pack_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"layout.py: pack.json is not JSON: {exc}", file=sys.stderr)
        return 1
    placement = (pack.get("generated") or {}).get("placement") or {}
    scene = placement.get("scene")
    if not isinstance(scene, dict) or "map" not in scene or "objects" not in scene:
        print("layout.py: generated.placement.scene is missing; rebuild the pack", file=sys.stderr)
        return 1
    blob = json.dumps(scene, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    digest = hashlib.sha256(blob).hexdigest()
    stored = str(placement.get("layout_hash") or "")
    if stored and stored != digest:
        print(
            f"layout.py: layout_hash {stored} != sha256(scene) {digest}: rebuild the pack",
            file=sys.stderr,
        )
        return 1
    if not stored:
        print("layout.py: generated.placement.layout_hash is missing", file=sys.stderr)
        return 1
    print(f"scene      {len(scene.get('map') or [])} rows  {len(scene.get('objects') or [])} objects")
    print(f"layout_hash  {digest}")
    return 0


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    return write_layout()


if __name__ == "__main__":
    sys.exit(main())
