    vf0 = [vert_xyz(p[0], p[1], z_foot0) for p in ring_pts]
    _loop_walls_split(bm, up0, vf0, 20, vert_xyz)
    _cap_down(bm, vf0, 1)