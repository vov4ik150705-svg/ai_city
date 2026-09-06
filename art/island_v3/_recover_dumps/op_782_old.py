    bm = bmesh.new()
    vmap: dict[tuple[object, ...], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = ("p", kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        z = PLAZA_Z if li == 0 else PLAZA_Z - 2.4
        nv = bm.verts.new((p[0], p[1], z))
        vmap[mk] = nv
        return nv

    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)

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
    keep_rim = set(up0)
    for v in list(bm.verts):
        if not v.is_valid or v in keep_rim:
            continue
        if abs(v.co.z - PLAZA_Z) > 0.2:
            continue
        p = (v.co.x, v.co.y)
        if _pip(p, ring_pts):
            continue
        qx, qy = _nearest_on_ring(p, ring_pts)
        v.co.x = qx
        v.co.y = qy
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
    rim_set = set(up0)
    hole_loops.sort(key=len, reverse=True)
    for vs_loop in hole_loops[1:]:
        if len(vs_loop) < 3:
            continue
        if any(v in rim_set for v in vs_loop):
            continue
        cx0 = sum(v.co.x for v in vs_loop) / float(len(vs_loop))
        cy0 = sum(v.co.y for v in vs_loop) / float(len(vs_loop))
        if not _pip((cx0, cy0), ring_pts):
            continue
        zs = [v.co.z for v in vs_loop]
        if max(zs) - min(zs) > 0.4:
            continue
        try:
            gf = bm.faces.new(vs_loop)
            _mark_face(gf, _stone_bin(cx0, cy0))
            n_holes += 1
        except ValueError:
            pass
    tile_fs = [
        f
        for f in bm.faces
        if f.is_valid and f.calc_center_median().z > PLAZA_Z - 0.5
    ]
    if tile_fs:
        bmesh.ops.triangulate(bm, faces=tile_fs)
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

    n_rim = len(rim)
    z_hi = PLAZA_Z
    z_lo = -248.0
    belts = (
        (0.99, 0.42, 0.12, 1),
        (0.80, 0.64, 0.18, 2),
        (0.64, 0.84, 0.14, 3),
        (0.48, 1.00, 0.12, 4),
    )

    def vert_xyz(x: float, y: float, z: float) -> bmesh.types.BMVert:
        mk = ("h", round(x * 8.0), round(y * 8.0), round(z * 2.0))
        found = vmap.get(mk)
        if found is not None:
            return found
        nv = bm.verts.new((x, y, z))
        vmap[mk] = nv
        return nv

    def loop_verts(pts: list[tuple[float, float, float]]) -> list[bmesh.types.BMVert]:
        return [vert_xyz(p[0], p[1], p[2]) for p in pts]

    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    vf0 = [vert_xyz(p[0], p[1], z_foot0) for p in ring_pts]
    _loop_walls_split(bm, up0, vf0, 20, vert_xyz)