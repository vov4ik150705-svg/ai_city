def _cell_key(p: tuple[float, float]) -> tuple[int, int]:
    return (round(p[0] * 40.0), round(p[1] * 40.0))


def _u01(kx: int, ky: int, salt: int) -> float:
    n = (kx * 73856093) ^ (ky * 19349663) ^ (salt * 83492791)
    n = (n * 1103515245 + 12345) & 0x7FFFFFFF
    return float(n % 10007) / 10007.0


def _taper_scale(t: float) -> float:
    if t < 0.15:
        return 1.0 - 0.05 * (t / 0.15)
    if t < 0.45:
        return 0.95 - 0.28 * ((t - 0.15) / 0.30)
    if t < 0.78:
        return 0.67 - 0.36 * ((t - 0.45) / 0.33)
    return 0.31 - 0.16 * ((t - 0.78) / 0.22)


_TIPS = (
    (0.38, 0.22),
    (-0.30, 0.34),
    (0.28, -0.36),
    (-0.34, -0.24),
)


def _loft_xy(
    x: float,
    y: float,
    cx: float,
    cy: float,
    t: float,
    kx: int,
    ky: int,
) -> tuple[float, float, float]:
    h = _u01(kx, ky, 3)
    h2 = _u01(kx, ky, 7)
    dx, dy = x - cx, y - cy
    ang = 0.10 * t * (h2 - 0.5)
    ca, sa = math.cos(ang), math.sin(ang)
    rx = dx * ca - dy * sa
    ry = dx * sa + dy * ca
    s = _taper_scale(t) * (1.0 + (h - 0.5) * 0.12 * t)
    px = cx + rx * s
    py = cy + ry * s
    best_d = 1.0
    if t > 0.58:
        pull = (t - 0.58) / 0.42
        nx = dx / HALF
        ny = dy / HALF
        best = _TIPS[0]
        best_d = 9.0
        for tip in _TIPS:
            d = (nx - tip[0]) * (nx - tip[0]) + (ny - tip[1]) * (ny - tip[1])
            if d < best_d:
                best_d = d
                best = tip
        tx = cx + best[0] * HALF * 0.18
        ty = cy + best[1] * HALF * 0.18
        k = 0.45 * pull
        px = px * (1.0 - k) + tx * k
        py = py * (1.0 - k) + ty * k
    z_tip = -410.0 - 95.0 * h
    if t > 0.58:
        z_tip -= 55.0 * max(0.0, 1.0 - math.sqrt(best_d) * 1.8)
    z = -0.85 + t * (z_tip + 0.85)
    return (px, py, z)


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


def build_cliff(cells: list[list[tuple[float, float]]]) -> bpy.types.Object:
    """Same Voronoi tiles as the plaza, extruded and tapered into one mass."""
    usable = [poly for poly in cells if len(poly) >= 3]
    if not usable:
        return mesh_from_bm(bmesh.new(), "Cliff")
    npts = 0
    sx = 0.0
    sy = 0.0
    for poly in usable:
        for p in poly:
            sx += p[0]
            sy += p[1]
            npts += 1
    cx, cy = sx / float(npts), sy / float(npts)
    ts = (0.0, 0.32, 0.64, 1.0)
    bm = bmesh.new()
    vmap: dict[tuple[int, int, int], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = (kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        t = ts[li]
        x, y, z = _loft_xy(p[0], p[1], cx, cy, t, kx, ky)
        nv = bm.verts.new((x, y, z))
        vmap[mk] = nv
        return nv

    for poly in usable:
        n = len(poly)
        for li in range(len(ts) - 1):
            for i in range(n):
                a = vert(poly[i], li)
                b = vert(poly[(i + 1) % n], li)
                c = vert(poly[(i + 1) % n], li + 1)
                d = vert(poly[i], li + 1)
                _quad(bm, a, b, c, d)
        bots = [vert(p, len(ts) - 1) for p in poly]
        try:
            bm.faces.new(list(reversed(bots)))
        except ValueError:
            hub = bm.verts.new(
                (
                    sum(v.co.x for v in bots) / n,
                    sum(v.co.y for v in bots) / n,
                    sum(v.co.z for v in bots) / n,
                )
            )
            for i in range(n):
                try:
                    bm.faces.new((hub, bots[(i + 1) % n], bots[i]))
                except ValueError:
                    pass
    _orient_cliff_bm(bm)
    ob = mesh_from_bm(bm, "Cliff")
    _cleanup_mesh(ob, consistent=False, weld=0.03)
    bm2 = bmesh.new()
    bm2.from_mesh(ob.data)
    _orient_cliff_bm(bm2)
    bm2.to_mesh(ob.data)
    bm2.free()
    ob.data.update()
    _xy_span(ob, "cliff")
    log(f"cliff faces {len(ob.data.polygons)} extruded tiles")
    return ob

