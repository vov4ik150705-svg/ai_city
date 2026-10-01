    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    up0 = [vert(p, 0) for p in ring_pts]
    vf0 = loop_verts(
        _outline_loop(rim, cx, cy, 1.0, z_foot0, n_loop, 40, 0.10, 0.0, corners)
    )
    _loop_walls(bm, up0, vf0, n_blocks, 20)