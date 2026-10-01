    bm = bmesh.new()
    vmap: dict[tuple[int, int, int], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = (kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        z = PLAZA_Z if li == 0 else PLAZA_Z - 2.4
        nv = bm.verts.new((p[0], p[1], z))
        vmap[mk] = nv
        return nv

    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)
    inner0 = [vert(p, 0) for p in inner_pts]
    for i in range(n_ring):
        _quad(
            bm,
            up0[i],
            up0[(i + 1) % n_ring],
            inner0[(i + 1) % n_ring],
            inner0[i],
            _stone_bin(
                0.5 * (up0[i].co.x + inner0[i].co.x),
                0.5 * (up0[i].co.y + inner0[i].co.y),
            ),
        )
    polar_outer = [
        (cx + (p[0] - cx) * 0.90, cy + (p[1] - cy) * 0.90) for p in ring_pts
    ]
    rings: list[list[bmesh.types.BMVert]] = [[vert(p, 2) for p in polar_outer]]
    for step in range(7, 0, -1):
        t = (step / 8.0) * 0.90
        layer = [
            vert((cx + (p[0] - cx) * t, cy + (p[1] - cy) * t), 2) for p in ring_pts
        ]
        rings.append(layer)
    hub = vert((cx, cy), 2)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(n_ring):
            _quad(bm, ra[i], ra[(i + 1) % n_ring], rb[(i + 1) % n_ring], rb[i], 0)
    inner_p = rings[-1]
    for i in range(n_ring):
        _tri(bm, hub, inner_p[i], inner_p[(i + 1) % n_ring], 0)
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