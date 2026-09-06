"""Append-only west-facing walker sprites (R-V-39, D-V-12).

Existing walker_*_v2.png are not rewritten. A new {id}_w_v2.png is a horizontal
flip of the skin. Runtime maps west/north to `_w`, east/south to the skin.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parent.parent.parent
AGENTS = REPO / "assets" / "agents"
DIR_SUFFIX = "_w_v2.png"


def skin_paths() -> list[Path]:
    out: list[Path] = []
    for path in sorted(AGENTS.glob("walker*_v2.png")):
        if path.name.endswith(DIR_SUFFIX):
            continue
        if path.stem.endswith("_n_v2") or path.stem.endswith("_e_v2") or path.stem.endswith("_s_v2"):
            continue
        out.append(path)
    return out


def write_flips(*, replace_new: bool) -> list[Path]:
    written: list[Path] = []
    for src in skin_paths():
        # walker_cap_v2.png -> walker_cap_w_v2.png
        stem = src.stem
        if not stem.endswith("_v2"):
            continue
        base = stem[: -3]
        dst = AGENTS / f"{base}_w_v2.png"
        if dst.exists() and not replace_new:
            continue
        rgb = np.array(Image.open(src).convert("RGB"), dtype=np.uint8)
        Image.fromarray(np.fliplr(rgb), "RGB").save(dst)
        written.append(dst)
    return written


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--replace-new", action="store_true")
    args = parser.parse_args()
    written = write_flips(replace_new=bool(args.replace_new))
    print(f"walker_dir : {len(written)} flips")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
