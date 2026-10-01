    idxs = _outline_indices(n_rim, n_loop, corners)
    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    up_full = [vert(p, 0) for p in rim]
    vf0_full: list[bmesh.types.BMVert] = []
    for i, p in enumerate(rim):
        dx, dy = p[0] - cx, p[1] - cy
        h = _u01(i, 40, 5)
        sc = 1.0 + 0.10 * (h - 0.22)
        vf0_full.append(vert_xyz(cx + dx * sc, cy + dy * sc, z_foot0))
    # Top-ring sides: plaza outline, same stone bins as the belts — not tile colors.
    _band_walls(bm, up_full, vf0_full, n_blocks, 20)
    _fill_loop_lip(bm, vf0_full, idxs, 21)
    vf0 = [vf0_full[i] for i in idxs]

    # First belt continues the top foot — no inset shelf (that read as a slit).
    first_scale, first_t1, first_jut, first_salt = belts[0]
    z1_first = _lerp(z_hi, z_lo, first_t1)
    foot0 = loop_verts(
        _outline_loop(
            rim, cx, cy, first_scale, z1_first, n_loop, 40 + first_salt, first_jut * 0.85, 8.0, corners
        )
    )
    _loop_walls(bm, vf0, foot0, n_blocks, 20 + first_salt)