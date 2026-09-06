def _block_loop(
    cx: float,
    cy: float,
    r: float,
    z: float,
    n: int,
    salt: int,
    jut: float,
    ang_off: float,
    z_spread: float = 18.0,
) -> list[tuple[float, float, float]]:
    """One ring of block corners. Two verts per stone, fused neighbours."""
    pts: list[tuple[float, float, float]] = []
    for i in range(n):
        h = _u01(i, salt, 5)
        g = _u01(i, salt, 9)
        r_i = r * (1.0 + jut * (h - 0.22))
        span = 0.78 + 0.16 * g
        a_mid = ang_off + (i + 0.5) / n * math.tau
        half = 0.5 * span * (math.tau / n)
        z_i = z + (h - 0.5) * z_spread
        for s in (-1.0, 1.0):
            a = a_mid + s * half
            pts.append((cx + r_i * math.cos(a), cy + r_i * math.sin(a), z_i))
    return pts