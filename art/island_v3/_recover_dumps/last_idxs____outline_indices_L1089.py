    corners = _square_corners(rim, cx, cy)
    hull = _convex_hull(rim)
    if len(hull) < 8:
        idxs = _outline_indices(len(rim), n_loop, corners)
        hull = _convex_hull([rim[i] for i in idxs])
    ring_pts = _ensure_ccw(_resample_closed(hull, n_loop))
    tiles: list[list[tuple[float, float]]] = []
    for poly in usable:
        tiles.extend(_clip_to_ring(poly, ring_pts, (cx, cy)))
    if tiles:
        usable = tiles
        log(f"plaza on ring {len(tiles)} faces")

    bm = bmesh.new()
    vmap: dict[tuple[int, int, int], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        del li
        kx, ky = _cell_key(p)
        mk = (kx, ky, 0)
        found = vmap.get(mk)
        if found is not None:
            return found
        nv = bm.verts.new((p[0], p[1], PLAZA_Z))
        vmap[mk] = nv
        return nv

    def ensure_edge(a: bmesh.types.BMVert, b: bmesh.types.BMVert) -> None:
        if a is b:
            return
        try:
            bm.edges.new((a, b))
        except ValueError:
            pass

    def poly_verts(poly: list[tuple[float, float]]) -> list[bmesh.types.BMVert]:
        raw = [vert(p, 0) for p in _ensure_ccw(_dedupe_poly(poly))]
        out: list[bmesh.types.BMVert] = []
        for v in raw:
            if not out or out[-1] is not v:
                out.append(v)
        if len(out) >= 2 and out[0] is out[-1]:
            out.pop()
        return out

    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)
    for i in range(n_ring):
        ensure_edge(up0[i], up0[(i + 1) % n_ring])
    for poly in usable:
        vs = poly_verts(poly)
        if len(vs) < 3:
            continue
        for i, tv in enumerate(vs):
            ensure_edge(tv, vs[(i + 1) % len(vs)])

    bm.edges.ensure_lookup_table()
    net = list(bm.edges)
    try:
        bmesh.ops.edgenet_prepare(bm, edges=net)
    except Exception:
        pass
    bm.edges.ensure_lookup_table()
    try:
        bmesh.ops.triangle_fill(
            bm, use_beauty=True, use_dissolve=False, edges=list(bm.edges)
        )
    except Exception as ex:
        log(f"triangle_fill failed {ex}")
    if len(bm.faces) < n_ring:
        log(f"plaza fill thin {len(bm.faces)}, fan the ring")
        hub = vert((cx, cy), 0)
        for i in range(n_ring):
            _tri(bm, hub, up0[i], up0[(i + 1) % n_ring], 0)
    for f in bm.faces:
        if not f.is_valid:
            continue
        c = f.calc_center_median()
        if c.z < -0.2:
            continue
        mat_i = _stone_bin(c.x, c.y)
        for poly in usable:
            if _pip((c.x, c.y), poly):
                mat_i = _cell_bin(poly)
                break
        _mark_face(f, mat_i)
        f.normal_update()
        if f.normal.z < 0.0:
            f.normal_flip()
    log(f"plaza faces {sum(1 for f in bm.faces if f.is_valid)}")