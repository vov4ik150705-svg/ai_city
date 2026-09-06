    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)
    built = 0
    for poly in usable:
        vs = poly_verts(poly)
        if len(vs) < 3:
            continue
        stone = _cell_bin(poly)
        try:
            face = bm.faces.new(vs)
            _mark_face(face, stone)
            built += 1
        except ValueError:
            hx = sum(v.co.x for v in vs) / float(len(vs))
            hy = sum(v.co.y for v in vs) / float(len(vs))
            h = vert((hx, hy), 0)
            before = len(bm.faces)
            for i, tv in enumerate(vs):
                _tri(bm, h, tv, vs[(i + 1) % len(vs)], stone)
            built += 1 if len(bm.faces) > before else 0
    log(f"plaza tiles {built}")
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
                pass
        if n_holes:
            log(f"plaza filled {n_holes} inner holes")
    if sum(1 for f in bm.faces if f.is_valid) < 8:
        log("plaza empty, fan the ring")
        hub = vert((cx, cy), 0)
        for i in range(n_ring):
            _tri(
                bm,
                hub,
                up0[i],
                up0[(i + 1) % n_ring],
                _stone_bin(up0[i].co.x, up0[i].co.y),
            )
    for f in bm.faces: