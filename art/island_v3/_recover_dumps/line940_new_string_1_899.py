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
        mk = (round(x * 8.0), round(y * 8.0), round(z * 2.0))
        found = vmap.get(mk)
        if found is not None:
            return found
        nv = bm.verts.new((x, y, z))
        vmap[mk] = nv
        return nv

    def loop_verts(pts: list[tuple[float, float, float]]) -> list[bmesh.types.BMVert]:
        return [vert_xyz(p[0], p[1], p[2]) for p in pts]

    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    up0 = [vert(p, 0) for p in ring_pts]
    vf0 = loop_verts(
        _outline_loop(rim, cx, cy, 1.0, z_foot0, n_loop, 40, 0.10, 0.0, corners)
    )
    _loop_walls(bm, up0, vf0, n_blocks, 20)
    _cap_down(bm, vf0, 1)