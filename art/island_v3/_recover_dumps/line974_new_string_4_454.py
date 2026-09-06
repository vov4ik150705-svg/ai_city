    z_foot0 = _lerp(z_hi, z_lo, 0.22)
    vf0 = [vert_xyz(p[0], p[1], z_foot0) for p in ring_pts]
    _loop_walls(bm, up0, vf0, n_blocks, 20)
    # Opaque deck under the mosaic so gaps never show sky.
    hub = vert_xyz(cx, cy, 0.0)
    deck = [vert_xyz(p[0], p[1], 0.0) for p in ring_pts]
    for i, dv in enumerate(deck):
        mat_i = _stone_bin(dv.co.x, dv.co.y)
        _tri(bm, hub, dv, deck[(i + 1) % len(deck)], mat_i)
    _cap_down(bm, vf0, 1)