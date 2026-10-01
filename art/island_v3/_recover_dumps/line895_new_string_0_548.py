    prev = vf0
    prev_z = z_foot0
    for ti, (scale, t1, jut, salt) in enumerate(belts):
        z1 = _lerp(z_hi, z_lo, t1)
        crown = _outline_loop(rim, cx, cy, scale, prev_z, n_loop, 20 + salt, jut, 0.0, corners)
        vc = loop_verts(crown)
        _bridge_loops(bm, prev, vc, 70 + salt)
        foot = _outline_loop(
            rim, cx, cy, scale * 0.97, z1, n_loop, 40 + salt, jut * 0.85, 8.0, corners
        )
        vf = loop_verts(foot)
        _loop_walls(bm, vc, vf, n_blocks, 20 + salt)
        prev = vf
        prev_z = z1