    n_rim = len(rim)
    z_hi = PLAZA_Z
    z_lo = -248.0
    n_blocks = 16
    n_loop = n_blocks * 2
    corners = _square_corners(rim, cx, cy)
    belts = (
        (0.90, 0.44, 0.16, 1),
        (0.74, 0.66, 0.18, 2),
        (0.60, 0.84, 0.14, 3),
        (0.46, 1.00, 0.12, 4),
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

    idxs = _outline_indices(n_rim, n_loop, corners)
    up0 = [vert(rim[i], 0) for i in idxs]
    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    vf0 = loop_verts(
        _outline_loop(rim, cx, cy, 1.0, z_foot0, n_loop, 40, 0.08, 0.0, corners)
    )
    # Sides of the top ring use the same block materials as the belts below.
    _loop_walls(bm, up0, vf0, n_blocks, 20)

    prev = vf0
    for ti, (scale, t1, jut, salt) in enumerate(belts):
        z1 = _lerp(z_hi, z_lo, t1)
        crown = _outline_loop(rim, cx, cy, scale, prev[0].co.z, n_loop, 20 + salt, jut, 0.0, corners)
        vc = loop_verts(crown)
        _bridge_loops(bm, prev, vc, 70 + salt)
        foot = _outline_loop(
            rim, cx, cy, scale * 0.97, z1, n_loop, 40 + salt, jut * 0.85, 8.0, corners
        )
        vf = loop_verts(foot)
        _loop_walls(bm, vc, vf, n_blocks, 20 + salt)
        prev = vf

    bots = prev