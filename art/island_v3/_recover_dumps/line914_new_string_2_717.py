    idxs = _outline_indices(n_rim, n_loop, corners)
    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    up0 = [vert(rim[i], 0) for i in idxs]
    vf0 = loop_verts(
        _outline_loop(rim, cx, cy, 1.0, z_foot0, n_loop, 40, 0.10, 0.0, corners)
    )
    # Same 16-block stone as the belts. Voronoi stays on the top faces only.
    _loop_walls(bm, up0, vf0, n_blocks, 20)
    _cap_down(bm, vf0, 1)

    first_scale, first_t1, first_jut, first_salt = belts[0]
    z1_first = _lerp(z_hi, z_lo, first_t1)
    foot0 = loop_verts(
        _outline_loop(
            rim, cx, cy, first_scale, z1_first, n_loop, 40 + first_salt, first_jut * 0.85, 8.0, corners
        )
    )
    _loop_walls(bm, vf0, foot0, n_blocks, 20 + first_salt)