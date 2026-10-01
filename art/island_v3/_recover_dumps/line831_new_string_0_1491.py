    rings: list[list[bmesh.types.BMVert]] = []
    z_foot0 = _lerp(z_hi, z_lo, 0.24)
    foot0 = _block_loop(cx, cy, r0 * 0.93, z_foot0, n_blocks, 40, 0.12, 0.0, 16.0)
    vf0 = loop_verts(foot0)
    rings.append(vf0)
    cuts = _span_cuts(n_rim, n_blocks, 11)
    for i in range(n_blocks):
        span = _rim_span(rim, cuts[i], cuts[i + 1])
        chain = [vert(p, 0) for p in span]
        mat_i = int(_u01(i, 11, 19) * len(_STONE_RGB)) % len(_STONE_RGB)
        ia = 2 * i
        ib = 2 * i + 1
        if ib >= len(vf0):
            break
        _loft_chain(bm, chain, vf0[ia], vf0[ib], mat_i, vert_xyz)
        end_i = cuts[i + 1] % n_rim
        seam = vert(rim[end_i], 0)
        join = (mat_i + 1 + (i % 2)) % len(_STONE_RGB)
        ic = (ib + 1) % len(vf0)
        _tri(bm, seam, vf0[ic], vf0[ib], join)

    for ti, (rmul, t0, t1, jut, salt, zsp) in enumerate(specs):
        ang_off = (0.37 * math.tau / n_blocks) * ((ti + 1) % 3)
        z0 = _lerp(z_hi, z_lo, t0)
        z1 = _lerp(z_hi, z_lo, t1)
        r = r0 * rmul
        crown = _block_loop(cx, cy, r, z0, n_blocks, 20 + salt, jut, ang_off, zsp)
        foot = _block_loop(cx, cy, r * 0.96, z1, n_blocks, 40 + salt, jut * 0.9, ang_off, zsp * 0.7)
        vc = loop_verts(crown)
        vf = loop_verts(foot)
        rings.append(vc)
        rings.append(vf)
        _loop_walls(bm, vc, vf, n_blocks, 20 + salt)

    for ri in range(0, len(rings) - 1, 2):
        _bridge_loops(bm, rings[ri], rings[ri + 1], 70 + ri)