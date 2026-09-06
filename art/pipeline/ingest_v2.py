"""Copy assets/<cat>/*_v2.png onto #FF00FF into art/raw/raw_<id>.png.

Append-only: an existing raw file is never overwritten (R-V-1, D-V-12).
Bodies of assets/<cat>/*_v2.png are not rewritten.

    python art/pipeline/ingest_v2.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art"
CONFIG = ART / "pipeline" / "assets.json"
RAW_DIR = ART / "raw"
MAGENTA = (255, 0, 255, 255)


def composite_rgb(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", im.size, MAGENTA)
    bg.alpha_composite(im)
    return bg.convert("RGB")


def main() -> int:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    wrote = 0
    skipped = 0
    missing = 0
    for asset in cfg.get("assets") or []:
        sid = str(asset.get("id") or "")
        if not sid:
            continue
        dest = RAW_DIR / f"raw_{sid}.png"
        if dest.is_file():
            skipped += 1
            continue
        rel = str(asset.get("file") or "")
        src = ROOT / rel
        if not src.is_file():
            missing += 1
            print(f"missing {sid}: {rel}")
            continue
        composite_rgb(src).save(dest)
        wrote += 1
    print(f"ingest wrote={wrote} skipped={skipped} missing={missing} -> {RAW_DIR}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
