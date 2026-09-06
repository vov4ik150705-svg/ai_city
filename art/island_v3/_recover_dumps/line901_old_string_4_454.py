    idxs = _outline_indices(n_rim, n_loop, corners)
    up0 = [vert(rim[i], 0) for i in idxs]
    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    vf0 = loop_verts(
        _outline_loop(rim, cx, cy, 1.0, z_foot0, n_loop, 40, 0.08, 0.0, corners)
    )
    # Sides of the top ring use the same block materials as the belts below.
    _loop_walls(bm, up0, vf0, n_blocks, 20)

    prev = vf0
    prev_z = z_foot0
    for ti, (scale, t1, jut, salt) in enumerate(belts):