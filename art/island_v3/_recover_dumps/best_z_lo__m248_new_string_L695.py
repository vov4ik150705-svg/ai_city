def _perp_dist(
    p: tuple[float, float],
    a: tuple[float, float],
    b: tuple[float, float],
) -> float:
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return math.hypot(px - ax, py - ay)
    return abs((px - ax) * dy - (py - ay) * dx) / length


def _rdp(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(pts) < 3:
        return list(pts)
    a, b = pts[0], pts[-1]
    imax = 0
    dmax = 0.0
    for i in range(1, len(pts) - 1):
        d = _perp_dist(pts[i], a, b)
        if d > dmax:
            imax = i
            dmax = d
    if dmax > eps:
        left = _rdp(pts[: imax + 1], eps)
        right = _rdp(pts[imax:], eps)
        return left[:-1] + right
    return [a, b]


def _simplify_closed(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(pts) < 8:
        return list(pts)
    loop = list(pts) + [pts[0]]
    simp = _rdp(loop, eps)
    if len(simp) >= 2 and simp[0] == simp[-1]:
        simp = simp[:-1]
    if len(simp) < 10:
        step = max(1, len(pts) // 14)
        return list(pts[::step])
    return simp


_BOT_RAD = (0.82, 0.64, 0.78, 0.58, 0.86, 0.66, 0.74)
# Side chips: n·p <= offset keeps the torn-block interior.
_CHIP_PLANES = (
    (0.88, 0.12, 0.46, 310.0),
    (-0.80, 0.42, 0.42, 295.0),
    (0.18, -0.92, 0.35, 305.0),
    (-0.48, -0.78, 0.40, 285.0),
    (0.62, 0.68, 0.38, 300.0),
    (-0.22, 0.90, 0.33, 318.0),
    (0.15, 0.08, 1.00, -198.0),
    (-0.12, -0.18, 1.00, -218.0),
    (0.20, -0.06, 1.00, -188.0),
)


def _apply_chips(x: float, y: float, z: float, t: float) -> tuple[float, float, float]:
    if t < 0.30:
        return (x, y, z)
    px, py, pz = x, y, z
    for nx, ny, nz, off in _CHIP_PLANES:
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        nnx, nny, nnz = nx / length, ny / length, nz / length
        # Cuts bite harder toward the torn bottom.
        use = off
        if nnz > 0.7:
            use = off + (1.0 - t) * 40.0
        else:
            use = off + (1.0 - t) * 55.0
        d = nnx * px + nny * py + nnz * pz
        if d > use:
            extra = d - use
            px -= nnx * extra
            py -= nny * extra
            pz -= nnz * extra
    return (px, py, pz)


def _block_point(
    x: float,
    y: float,
    cx: float,
    cy: float,
    t: float,
    i: int,
    n: int,
) -> tuple[float, float, float]:
    dx, dy = x - cx, y - cy
    ang = math.atan2(dy, dx)
    u = ((ang + math.pi) / math.tau) * len(_BOT_RAD)
    sec = int(u) % len(_BOT_RAD)
    r_end = _BOT_RAD[sec]
    h = _u01(i, n, 11)
    if t < 0.26:
        mul = 0.995
    elif t < 0.48:
        # Sudden shoulder — cube side, then a break.
        mul = 0.96 - 0.08 * ((t - 0.26) / 0.22)
    else:
        u2 = (t - 0.48) / 0.52
        mul = 0.88 * (1.0 - u2) + r_end * u2
        mul *= 1.0 + (h - 0.5) * 0.10
    px = cx + dx * mul
    py = cy + dy * mul
    z_hi = -0.9
    z_lo = -248.0 - 62.0 * h
    z = z_hi + t * (z_lo - z_hi)
    return _apply_chips(px, py, z, t)


def _u01(kx: int, ky: int, salt: int) -> float:
    n = (kx * 73856093) ^ (ky * 19349663) ^ (salt * 83492791)
    n = (n * 1103515245 + 12345) & 0x7FFFFFFF
    return float(n % 10007) / 10007.0


def _quad(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    c: bmesh.types.BMVert,
    d: bmesh.types.BMVert,
) -> None:
    try:
        bm.faces.new((a, b, c, d))
    except ValueError:
        try:
            bm.faces.new((a, b, c))
            bm.faces.new((a, c, d))
        except ValueError:
            pass


def build_cliff(border: list[tuple[float, float]]) -> bpy.types.Object:
    """Thick torn slab: vertical drop, then chips. No needle tip."""
    if len(border) < 8:
        return mesh_from_bm(bmesh.new(), "Cliff")
    outline = _simplify_closed(border, 32.0)
    n = len(outline)
    log(f"cliff outline {n} from border {len(border)}")
    cx = sum(p[0] for p in outline) / n
    cy = sum(p[1] for p in outline) / n
    ts = (0.0, 0.24, 0.52, 1.0)
    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []
    for t in ts:
        ring: list[bmesh.types.BMVert] = []
        for i, (x, y) in enumerate(outline):
            px, py, pz = _block_point(x, y, cx, cy, t, i, n)
            ring.append(bm.verts.new((px, py, pz)))
        rings.append(ring)
    for li in range(len(rings) - 1):
        a, b = rings[li], rings[li + 1]
        for i in range(n):
            _quad(bm, a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])
    bots = rings[-1]
    try:
        bm.faces.new(list(reversed(bots)))
    except ValueError:
        hub = bm.verts.new(
            (
                sum(v.co.x for v in bots) / n,
                sum(v.co.y for v in bots) / n,
                sum(v.co.z for v in bots) / n + 18.0,
            )
        )
        for i in range(n):
            try:
                bm.faces.new((hub, bots[(i + 1) % n], bots[i]))
            except ValueError:
                pass
    _orient_cliff_bm(bm)
    ob = mesh_from_bm(bm, "Cliff")
    _cleanup_mesh(ob, consistent=False, weld=0.04)
    bm2 = bmesh.new()
    bm2.from_mesh(ob.data)
    _orient_cliff_bm(bm2)
    bm2.to_mesh(ob.data)
    bm2.free()
    ob.data.update()
    _xy_span(ob, "cliff")
    log(f"cliff faces {len(ob.data.polygons)} torn block")
    return ob