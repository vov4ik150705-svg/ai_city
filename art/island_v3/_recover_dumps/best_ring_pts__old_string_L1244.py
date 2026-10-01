    ring_pts = [rim[i] for i in idxs]
    n_ring = len(ring_pts)
    inner_pts = _inset_ring(ring_pts, cx, cy, 8.0)
    tiles: list[list[tuple[float, float]]] = []
    for poly in usable:
        tiles.extend(_clip_to_ring(poly, inner_pts, (cx, cy)))
    if tiles:
        usable = tiles
        log(f"plaza on ring {len(tiles)} faces")

    bm = bmesh.new()
    vmap: dict[tuple[object, ...], bmesh.types.BMVert] = {}
    up0 = [bm.verts.new((p[0], p[1], PLAZA_Z)) for p in ring_pts]
    inner0 = [bm.verts.new((p[0], p[1], PLAZA_Z)) for p in inner_pts]
    inner_set = set(inner0)
    _gasket_ring(bm, up0, inner0, n_blocks, 20)

    pts2d = [Vector((p[0], p[1])) for p in inner_pts]
    seen_k = {_cell_key(p) for p in inner_pts}
    for poly in usable:
        npoly = len(poly)
        sx0 = sum(p[0] for p in poly) / float(npoly)
        sy0 = sum(p[1] for p in poly) / float(npoly)
        extra = list(poly) + [(sx0, sy0)]
        for p in extra:
            k = _cell_key(p)
            if k in seen_k:
                continue
            if not _pip(p, inner_pts):
                continue
            qx, qy = _nearest_on_ring(p, inner_pts)
            if math.hypot(p[0] - qx, p[1] - qy) < 5.0:
                continue
            seen_k.add(k)
            pts2d.append(Vector((p[0], p[1])))
    inner_edges = [(i, (i + 1) % n_ring) for i in range(n_ring)]
    cdt = delaunay_2d_cdt(pts2d, inner_edges, [list(range(n_ring))], 1, 0.02, False)
    out_coords, out_faces = cdt[0], cdt[2]
    key_verts: dict[tuple[int, int], bmesh.types.BMVert] = {}
    for i, p in enumerate(inner_pts):
        key_verts[_cell_key(p)] = inner0[i]

    def plaza_vert(x: float, y: float) -> bmesh.types.BMVert:
        best_i = 0
        best_d = 1.0e18
        for i, p in enumerate(inner_pts):
            d = (x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1])
            if d < best_d:
                best_d = d
                best_i = i
        if best_d < 4.0:
            return inner0[best_i]
        k = _cell_key((x, y))
        found = key_verts.get(k)
        if found is not None:
            return found
        nv = bm.verts.new((x, y, PLAZA_Z))
        key_verts[k] = nv
        return nv

    n_tiles = 0
    for face in out_faces:
        if len(face) < 3:
            continue
        vs: list[bmesh.types.BMVert] = []
        for idx in face:
            if idx >= len(out_coords):
                vs = []
                break
            co = out_coords[idx]
            vs.append(plaza_vert(co.x, co.y))
        if len(vs) < 3:
            continue
        uniq: list[bmesh.types.BMVert] = []
        for v in vs:
            if not uniq or uniq[-1] is not v:
                uniq.append(v)
        if len(uniq) >= 2 and uniq[0] is uniq[-1]:
            uniq.pop()
        if len(uniq) < 3:
            continue
        cx0 = sum(v.co.x for v in uniq) / float(len(uniq))
        cy0 = sum(v.co.y for v in uniq) / float(len(uniq))
        if not _pip((cx0, cy0), inner_pts):
            continue
        spilled = False
        for v in uniq:
            p = (v.co.x, v.co.y)
            if v in inner_set or _pip(p, inner_pts):
                continue
            qx, qy = _nearest_on_ring(p, inner_pts)
            if math.hypot(p[0] - qx, p[1] - qy) > 0.4:
                spilled = True
                break
        if spilled:
            continue
        try:
            top = bm.faces.new(uniq)
        except ValueError:
            continue
        bin_i = _stone_bin(cx0, cy0)
        for poly in usable:
            if _pip((cx0, cy0), poly):
                bin_i = _cell_bin(poly)
                break
        _mark_face(top, bin_i)
        top.normal_update()
        if top.normal.z < 0.0:
            top.normal_flip()
        n_tiles += 1
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        if f.calc_center_median().z > -0.2 and f.normal.z < 0.0:
            f.normal_flip()
    log(f"plaza cdt {n_tiles} faces {sum(1 for f in bm.faces if f.is_valid)}")