    idxs = _outline_indices(n_rim, n_loop, corners)
    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    up_full = [vert(p, 0) for p in rim]
    vf0_full = [vert_xyz(p[0], p[1], z_foot0) for p in rim]
    # Top-ring sides: plaza outline, stone bins of the belts — not tile/grout colors.
    _band_walls(bm, up_full, vf0_full, n_blocks, 20)
    _fill_loop_lip(bm, vf0_full, idxs, 21)
    vf0 = [vf0_full[i] for i in idxs]

    prev = vf0
    prev_z = z_foot0
    for _ti, (scale, t1, jut, salt) in enumerate(belts):