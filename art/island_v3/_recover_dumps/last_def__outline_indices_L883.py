def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _square_corners(rim: list[tuple[float, float]], cx: float, cy: float) -> list[int]:
    """Four corners of the plaza outline — not a circle."""
    if not rim:
        return []
    xs = [p[0] for p in rim]
    ys = [p[1] for p in rim]
    targets = (
        (max(xs), max(ys)),
        (min(xs), max(ys)),
        (min(xs), min(ys)),
        (max(xs), min(ys)),
    )
    out: list[int] = []
    for tx, ty in targets:
        best = 0
        best_d = 1.0e18
        for i, p in enumerate(rim):
            d = (p[0] - tx) * (p[0] - tx) + (p[1] - ty) * (p[1] - ty)
            if d < best_d:
                best_d = d
                best = i
        if best not in out:
            out.append(best)
    return out


def _outline_indices(n_rim: int, n: int, corners: list[int]) -> list[int]:
    idxs = [int(round(k * n_rim / float(n))) % n_rim for k in range(n)]
    for c in corners:
        best = 0
        best_d = n_rim
        for k, idx in enumerate(idxs):
            d = min((idx - c) % n_rim, (c - idx) % n_rim)
            if d < best_d:
                best_d = d
                best = k
        idxs[best] = c
    seen: set[int] = set()
    out: list[int] = []
    for idx in idxs:
        while idx in seen:
            idx = (idx + 1) % n_rim
        seen.add(idx)
        out.append(idx)
    return out


def _outline_loop(
    rim: list[tuple[float, float]],
    cx: float,
    cy: float,
    scale: float,
    z: float,
    n: int,
    salt: int,
    jut: float,
    z_spread: float,
    corners: list[int],
) -> list[tuple[float, float, float]]:
    """Scaled copy of the plaza outline (square with corners). Not a polar circle."""
    idxs = _outline_indices(len(rim), n, corners)
    pts: list[tuple[float, float, float]] = []
    for i, idx in enumerate(idxs):
        p = rim[idx]
        dx, dy = p[0] - cx, p[1] - cy
        h = _u01(i, salt, 5)
        sc = scale * (1.0 + jut * (h - 0.22))
        z_i = z + (h - 0.5) * z_spread
        pts.append((cx + dx * sc, cy + dy * sc, z_i))
    return pts


def _loop_walls(