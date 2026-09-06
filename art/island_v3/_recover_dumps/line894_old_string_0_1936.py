    n_rim = len(rim)
    z_hi = PLAZA_Z
    z_lo = -248.0
    n_blocks = 16
    n_loop = n_blocks * 2
    corners = _square_corners(rim, cx, cy)
    specs = (
        (0.86, 0.22, 0.44, 0.16, 1),
        (0.72, 0.44, 0.66, 0.18, 2),
        (0.58, 0.66, 0.84, 0.14, 3),
        (0.46, 0.84, 1.00, 0.12, 4),
    )

    def vert_xyz(x: float, y: float, z: float) -> bmesh.types.BMVert:
        mk = (round(x * 8.0), round(y * 8.0), round(z * 2.0))
        found = vmap.get(mk)
        if found is not None:
            return found
        nv = bm.verts.new((x, y, z))
        vmap[mk] = nv
        return nv

    def loop_verts(pts: list[tuple[float, float, float]]) -> list[bmesh.types.BMVert]:
        return [vert_xyz(p[0], p[1], p[2]) for p in pts]

    rings: list[list[bmesh.types.BMVert]] = []
    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    vf0: list[bmesh.types.BMVert] = []
    for i, p in enumerate(rim):
        z = z_foot0 + (_u01(i, 40, 5) - 0.5) * 8.0
        vf0.append(vert_xyz(p[0], p[1], z))
    for i in range(n_rim):
        p0 = rim[i]
        p1 = rim[(i + 1) % n_rim]
        band = edge_stone.get(edge_key(p0, p1), _stone_bin(p0[0], p0[1]))
        _quad(bm, vert(p0, 0), vert(p1, 0), vf0[(i + 1) % n_rim], vf0[i], band)
    rings.append(vf0)

    for ti, (scale, t0, t1, jut, salt) in enumerate(specs):
        z0 = _lerp(z_hi, z_lo, t0)
        z1 = _lerp(z_hi, z_lo, t1)
        crown = _outline_loop(rim, cx, cy, scale, z0, n_loop, 20 + salt, jut, 12.0, corners)
        foot = _outline_loop(rim, cx, cy, scale * 0.97, z1, n_loop, 40 + salt, jut * 0.85, 8.0, corners)
        vc = loop_verts(crown)
        vf = loop_verts(foot)
        rings.append(vc)
        rings.append(vf)
        _loop_walls(bm, vc, vf, n_blocks, 20 + salt)

    _bridge_ordered(bm, rings[0], rings[1], 70, cx, cy)
    for ri in range(2, len(rings) - 1, 2):
        _bridge_loops(bm, rings[ri], rings[ri + 1], 70 + ri)

    bots = rings[-1]