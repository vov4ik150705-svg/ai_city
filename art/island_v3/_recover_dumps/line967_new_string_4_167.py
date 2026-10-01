    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    vf0 = [vert_xyz(p[0], p[1], z_foot0) for p in ring_pts]
    _loop_walls(bm, up0, vf0, n_blocks, 20)
    _cap_down(bm, vf0, 1)