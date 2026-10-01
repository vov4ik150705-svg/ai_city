    bm = bmesh.new()
    vmap: dict[tuple[object, ...], bmesh.types.BMVert] = {}
    n_ring = len(ring_pts)
    pts2d = [Vector((p[0], p[1])) for p in ring_pts]
    seen_k = {_cell_key(p) for p in ring_pts}
    for poly in usable:
        npoly = len(poly)
        sx0 = sum(p[0] for p in poly) / float(npoly)
        sy0 = sum(p[1] for p in poly) / float(npoly)
        extra = list(poly) + [(sx0, sy0)]
        for p in extra:
            k = _cell_key(p)
            if k in seen_k:
                continue
            if not _pip(p, ring_pts):
                continue
            qx, qy = _nearest_on_ring(p, ring_pts)
            if math.hypot(p[0] - qx, p[1] - qy) < 1.6:
                continue
            seen_k.add(k)
            pts2d.append(Vector((p[0], p[1])))
    ring_edges = [(i, (i + 1) % n_ring) for i in range(n_ring)]
    cdt = delaunay_2d_cdt(pts2d, ring_edges, [list(range(n_ring))], 1, 0.02, False)
    out_coords, out_faces = cdt[0], cdt[2]
    bm_verts: list[bmesh.types.BMVert] = [
        bm.verts.new((co.x, co.y, PLAZA_Z)) for co in out_coords
    ]
    n_tiles = 0
    for face in out_faces:
        if len(face) < 3:
            continue
        vs = [bm_verts[i] for i in face if i < len(bm_verts)]
        if len(vs) < 3:
            continue
        try:
            top = bm.faces.new(vs)
        except ValueError:
            continue
        c = top.calc_center_median()
        bin_i = _stone_bin(c.x, c.y)
        for poly in usable:
            if _pip((c.x, c.y), poly):
                bin_i = _cell_bin(poly)
                break
        _mark_face(top, bin_i)
        top.normal_update()
        if top.normal.z < 0.0:
            top.normal_flip()
        n_tiles += 1
    up0: list[bmesh.types.BMVert] = []
    for p in ring_pts:
        best = bm_verts[0]
        best_d = 1.0e18
        for v in bm_verts:
            d = (v.co.x - p[0]) * (v.co.x - p[0]) + (v.co.y - p[1]) * (v.co.y - p[1])
            if d < best_d:
                best_d = d
                best = v
        best.co.x = p[0]
        best.co.y = p[1]
        best.co.z = PLAZA_Z
        up0.append(best)
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        if f.calc_center_median().z > -0.2 and f.normal.z < 0.0:
            f.normal_flip()
    log(f"plaza cdt {n_tiles} verts {len(bm_verts)} faces {sum(1 for f in bm.faces if f.is_valid)}")

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
    _loop_walls(bm, up0, vf0, n_blocks, 20)