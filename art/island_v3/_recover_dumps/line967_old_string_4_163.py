    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    _plaza_skirt(bm, z_foot0, vert_xyz)
    vf0 = [vert_xyz(p[0], p[1], z_foot0) for p in ring_pts]
    _cap_down(bm, vf0, 1)