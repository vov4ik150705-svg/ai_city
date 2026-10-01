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
    outside = [
        f
        for f in bm.faces
        if f.is_valid
        and not _pip((f.calc_center_median().x, f.calc_center_median().y), ring_pts)
    ]
    if outside:
        bmesh.ops.delete(bm, geom=outside, context="FACES")
        log(f"plaza dropped {len(outside)} outside faces")
    if sum(1 for f in bm.faces if f.is_valid) < n_ring:
        hub = vert((cx, cy), 0)
        for i in range(n_ring):
            _tri(bm, hub, up0[i], up0[(i + 1) % n_ring], 0)
    bm.edges.index_update()
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
    if len(hole_loops) > 1:
        hole_loops.sort(key=len, reverse=True)
        n_holes = 0
        for vs_loop in hole_loops[1:]:
            try:
                bm.faces.new(vs_loop)
                n_holes += 1
            except ValueError:
                hx = sum(v.co.x for v in vs_loop) / float(len(vs_loop))
                hy = sum(v.co.y for v in vs_loop) / float(len(vs_loop))
                h = vert((hx, hy), 0)
                for i, tv in enumerate(vs_loop):
                    _tri(bm, h, tv, vs_loop[(i + 1) % len(vs_loop)], 0)
                n_holes += 1
        log(f"plaza filled {n_holes} inner holes")
    for f in bm.faces: