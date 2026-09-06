    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = (kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        z = PLAZA_Z if li == 0 else PLAZA_Z - 2.4 * ISLAND_SCALE
        nv = bm.verts.new((p[0], p[1], z))
        vmap[mk] = nv
        return nv

    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)
    rings: list[list[bmesh.types.BMVert]] = [[vert(p, 2) for p in ring_pts]]
    for step in range(8, 0, -1):
        t = step / 9.0
        layer = [
            vert((cx + (p[0] - cx) * t, cy + (p[1] - cy) * t), 2) for p in ring_pts
        ]
        rings.append(layer)
    hub = vert((cx, cy), 2)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(n_ring):
            _quad(bm, ra[i], ra[(i + 1) % n_ring], rb[(i + 1) % n_ring], rb[i], 0)
    inner = rings[-1]
    for i in range(n_ring):
        _tri(bm, hub, inner[i], inner[(i + 1) % n_ring], 0)
    for f in bm.faces:
        if not f.is_valid:
            continue
        c = f.calc_center_median()
        bin_i = _stone_bin(c.x, c.y)
        for poly in usable:
            if _pip((c.x, c.y), poly):
                bin_i = _cell_bin(poly)
                break
        _mark_face(f, bin_i)
        f.normal_update()
        if f.normal.z < 0.0:
            f.normal_flip()

    def poly_verts(poly: list[tuple[float, float]]) -> list[bmesh.types.BMVert]:
        raw = [vert(p, 0) for p in _ensure_ccw(_dedupe_poly(poly))]
        out: list[bmesh.types.BMVert] = []
        for v in raw:
            if not out or out[-1] is not v:
                out.append(v)
        if len(out) >= 2 and out[0] is out[-1]:
            out.pop()
        return out

    n_tiles = 0
    for poly in usable:
        vs = poly_verts(poly)
        if len(vs) < 3:
            continue
        stone = _cell_bin(poly)
        try:
            top = bm.faces.new(vs)
            _mark_face(top, stone)
            n_tiles += 1
        except ValueError:
            hx = sum(v.co.x for v in vs) / float(len(vs))
            hy = sum(v.co.y for v in vs) / float(len(vs))
            h = vert((hx, hy), 0)
            before = len(bm.faces)
            for i, tv in enumerate(vs):
                _tri(bm, h, tv, vs[(i + 1) % len(vs)], stone)
            if len(bm.faces) > before:
                n_tiles += 1
    plaza_vs = [
        v for v in bm.verts if v.is_valid and abs(v.co.z - PLAZA_Z) < 0.2
    ]
    if plaza_vs:
        bmesh.ops.remove_doubles(bm, verts=plaza_vs, dist=2.8 * ISLAND_SCALE)
    tile_fs = [
        f
        for f in bm.faces
        if f.is_valid and f.calc_center_median().z > PLAZA_Z - 0.5
    ]
    if tile_fs:
        bmesh.ops.triangulate(bm, faces=tile_fs)
    bm.edges.ensure_lookup_table()
    seen_e: set[int] = set()
    hole_loops: list[list[bmesh.types.BMVert]] = []
    for e0 in bm.edges:
        if not e0.is_boundary or id(e0) in seen_e:
            continue
        vs_loop: list[bmesh.types.BMVert] = []
        cur = e0
        v = e0.verts[0]
        for _ in range(4096):
            seen_e.add(id(cur))
            vs_loop.append(v)
            v = cur.other_vert(v)
            nxt = None
            for e2 in v.link_edges:
                if e2 is not cur and e2.is_boundary:
                    nxt = e2
                    break
            if nxt is None or nxt is e0:
                break
            cur = nxt
        if len(vs_loop) >= 3:
            hole_loops.append(vs_loop)
    n_holes = 0
    if len(hole_loops) > 1:
        hole_loops.sort(key=len, reverse=True)
        for vs_loop in hole_loops[1:]:
            try:
                gf = bm.faces.new(vs_loop)
                cx0 = sum(v.co.x for v in vs_loop) / float(len(vs_loop))
                cy0 = sum(v.co.y for v in vs_loop) / float(len(vs_loop))
                _mark_face(gf, _stone_bin(cx0, cy0))
                n_holes += 1
            except ValueError:
                pass
    if sum(1 for f in bm.faces if f.is_valid) < 8:
        hub = vert((cx, cy), 0)
        for i in range(n_ring):
            _tri(
                bm,
                hub,
                up0[i],
                up0[(i + 1) % n_ring],
                _stone_bin(up0[i].co.x, up0[i].co.y),
            )
    up0 = [vert(p, 0) for p in ring_pts]
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        if f.calc_center_median().z > -0.2 and f.normal.z < 0.0:
            f.normal_flip()
    log(f"plaza tiles {n_tiles} holes {n_holes} faces {sum(1 for f in bm.faces if f.is_valid)}")