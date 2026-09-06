"""Ground tile probes: the ocean has to tile without seams and without repeats.

Both properties are invisible in a single tile and obvious across a map, which is why they
are checked here rather than by eye.

    python art/pipeline/tiles_probe.py

Exit code 1 with a named line per failed probe. Stdlib plus numpy, no PIL.
"""

from __future__ import annotations

import sys

import numpy as np

import tiles

# A dash placed on the block corner must survive whole; clipping it there is what makes a
# visible seam every WATER_PERIOD tiles.
CORNER = (0, 0)
SEAM_SLACK = 1.5


def water_block_wraps() -> str | None:
    """A dash on the block corner keeps its area, and the blob field closes on itself."""
    n = tiles.WATER_PERIOD * tiles.TEX
    hl = tiles.RIPPLE_LEN
    corner = tiles.dash_mask(n, [(*CORNER, hl)], tiles.RIPPLE_THICK).sum()
    middle = tiles.dash_mask(n, [(n // 2, n // 2, hl)], tiles.RIPPLE_THICK).sum()
    if corner != middle:
        return f"corner dash covers {corner} px, same dash in the middle covers {middle}"

    blob = tiles.wrapped_blobs(n, tiles.WATER_SEED, tiles.WATER_PERIOD * 2)
    seam = np.abs(blob[:, 0] - blob[:, -1]).max()
    inner = np.abs(np.diff(blob, axis=1)).max()
    if seam > inner * SEAM_SLACK:
        return f"blob seam step {seam:.4f} exceeds the interior step {inner:.4f}"
    return None


def water_tiles_differ_by_coord() -> str | None:
    """Neighbouring phases are different cuts of one field, not one tile stamped twice."""
    a = tiles.tex_water(0, 0)
    b = tiles.tex_water(1, 0)
    if a.shape != b.shape:
        return f"phase shapes differ: {a.shape} vs {b.shape}"
    if np.array_equal(a, b):
        return "phase (0,0) and (1,0) are byte-identical: the block is one repeated tile"
    return None


def water_crest_share_is_low() -> str | None:
    """The bright colours stay a garnish. At 37% they read as chain-link mesh."""
    block = tiles.water_block(False)
    bright = sum(
        int(np.all(block == tiles.rgb(c), axis=-1).sum())
        for c in ("1b3a6b", "2a5a9e")
    )
    share = bright / (block.shape[0] * block.shape[1])
    if share > tiles.CREST_SHARE_MAX:
        return f"bright share {share:.4f} over the {tiles.CREST_SHARE_MAX} ceiling"
    return None


PROBES = (
    ("water_block_wraps", water_block_wraps),
    ("water_tiles_differ_by_coord", water_tiles_differ_by_coord),
    ("water_crest_share_is_low", water_crest_share_is_low),
)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    failed = 0
    for name, probe in PROBES:
        why = probe()
        if why is None:
            print(f"  ok   {name}")
        else:
            print(f"  FAIL {name}: {why}")
            failed += 1
    print(f"probes {len(PROBES)} / failed {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
