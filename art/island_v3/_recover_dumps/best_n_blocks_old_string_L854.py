def _cell_bin(poly: list[tuple[float, float]]) -> int:
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    return _stone_bin(cx, cy, 19)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _block_loop(
    cx: float,
    cy: float,
    r: float,
    z: float,
    n: int,
    salt: int,
    jut: float,
    ang_off: float,
    z_spread: float,
) -> list[tuple[float, float, float]]:
    """Block corners. Each corner jitters on its own so belts don't read as rings."""
    pts: list[tuple[float, float, float]] = []
    for i in range(n):
        span = 0.70 + 0.24 * _u01(i, salt, 9)
        a_mid = ang_off + (i + 0.5) / n * math.tau
        half = 0.5 * span * (math.tau / n)
        for s, sk in ((-1.0, 1), (1.0, 7)):
            h = _u01(i, salt, sk)
            r_i = r * (1.0 + jut * (h - 0.18))
            a = a_mid + s * half * (0.85 + 0.30 * _u01(i, salt, sk + 3))
            z_i = z + (h - 0.5) * z_spread
            pts.append((cx + r_i * math.cos(a), cy + r_i * math.sin(a), z_i))
    return pts


def _loop_walls(
    bm: bmesh.types.BMesh,
    upper: list[bmesh.types.BMVert],
    lower: list[bmesh.types.BMVert],
    n_blocks: int,
    salt: int,
) -> None:
    n = min(len(upper), len(lower))
    if n < 4 or n % 2 != 0:
        return
    for i in range(n_blocks):
        a0 = 2 * i
        a1 = 2 * i + 1
        if a1 >= n:
            break
        mat_i = int(_u01(i, salt, 19) * len(_STONE_RGB)) % len(_STONE_RGB)
        _quad(bm, upper[a0], upper[a1], lower[a1], lower[a0], mat_i)
        b0 = a1
        b1 = (a1 + 1) % n
        join = (mat_i + 1 + (i % 2)) % len(_STONE_RGB)
        _quad(bm, upper[b0], upper[b1], lower[b1], lower[b0], join)


def _bridge_loops(
    bm: bmesh.types.BMesh,
    upper: list[bmesh.types.BMVert],
    lower: list[bmesh.types.BMVert],
    salt: int,
) -> None:
    """Connect two block rings by angle so staggered tiers stay fused."""
    if len(upper) < 3 or len(lower) < 3:
        return
    uxy = [(v.co.x, v.co.y) for v in upper]
    lxy = [(v.co.x, v.co.y) for v in lower]
    cx = sum(p[0] for p in uxy) / len(uxy)
    cy = sum(p[1] for p in uxy) / len(uxy)
    n = len(upper)
    for i in range(n):
        j0 = _nearest_loop(uxy[i], lxy, cx, cy)
        j1 = _nearest_loop(uxy[(i + 1) % n], lxy, cx, cy)
        mat_i = int(_u01(i, salt, 19) * len(_STONE_RGB)) % len(_STONE_RGB)
        if j0 == j1:
            _tri(bm, upper[i], upper[(i + 1) % n], lower[j0], mat_i)
        else:
            _quad(bm, upper[i], upper[(i + 1) % n], lower[j1], lower[j0], mat_i)


def _span_cuts(n: int, n_blocks: int, salt: int) -> list[int]:
    """Uneven rim spans, at least 3 verts each, covering the whole loop."""
    if n < n_blocks * 3:
        step = max(1, n // max(1, n_blocks))
        cuts = [min(n, i * step) for i in range(n_blocks)]
        cuts.append(n)
        return cuts
    weights = [0.62 + 0.76 * _u01(i, salt, 8) for i in range(n_blocks)]
    tot = sum(weights)
    cuts: list[int] = [0]
    remain = n_blocks - 1
    acc = 0.0
    for w in weights[:-1]:
        acc += n * w / tot
        nxt = int(round(acc))
        floor_i = cuts[-1] + 3
        ceil_i = n - 3 * remain
        if nxt < floor_i:
            nxt = floor_i
        if nxt > ceil_i:
            nxt = max(floor_i, ceil_i)
        cuts.append(nxt)
        remain -= 1
    cuts.append(n)
    return cuts


def _rim_span(rim: list[tuple[float, float]], a0: int, a1: int) -> list[tuple[float, float]]:
    n = len(rim)
    if a1 >= n:
        return rim[a0:] + [rim[0]]
    return rim[a0 : a1 + 1]


def _loft_chain(
    bm: bmesh.types.BMesh,
    chain: list[bmesh.types.BMVert],
    lo_a: bmesh.types.BMVert,
    lo_b: bmesh.types.BMVert,
    mat_i: int,
    vert_xyz,
) -> None:
    """One stone curtain from a rim span onto one block edge."""
    del vert_xyz
    if len(chain) < 2:
        return
    try:
        face = bm.faces.new(list(chain) + [lo_b, lo_a])
        _mark_face(face, mat_i)
        return
    except ValueError:
        _quad(bm, chain[0], chain[-1], lo_b, lo_a, mat_i)


def _nearest_loop(p: tuple[float, float], loop: list[tuple[float, float]], cx: float, cy: float) -> int: