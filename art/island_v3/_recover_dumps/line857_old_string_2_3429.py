    n_rim = len(rim)
    r0 = 0.0
    for p in rim:
        r0 += math.hypot(p[0] - cx, p[1] - cy)
    r0 /= float(n_rim)
    z_hi = PLAZA_Z
    z_lo = -248.0
    n_blocks = 14
    # Lower belts only. The top belt is lofted from the actual plaza rim
    # so the mosaic is the top of the volume, not a disk sitting on a rock.
    specs = (
        (0.96, 0.28, 0.50, 0.20, 1, 34.0),
        (0.78, 0.46, 0.70, 0.26, 2, 30.0),
        (0.60, 0.66, 0.86, 0.18, 3, 26.0),
        (0.44, 0.82, 1.00, 0.16, 4, 22.0),
    )

    def vert_xyz(x: float, y: float, z: float) -> bmesh.types.BMVert:
        mk = (round(x * 8.0), round(y * 8.0), round(z * 2.0))
        found = vmap.get(mk)
        if found is not None:
            return found
        nv = bm.verts.new((x, y, z))
        vmap[mk] = nv
        return nv

    def loop_verts(pts: list[tuple[float, float, float]]) -> list[bmesh.types.BMVert]:
        return [vert_xyz(p[0], p[1], p[2]) for p in pts]

    rings: list[list[bmesh.types.BMVert]] = []
    z_foot0 = _lerp(z_hi, z_lo, 0.32)
    foot0 = _block_loop(cx, cy, r0 * 1.0, z_foot0, n_blocks, 40, 0.10, 0.0, 14.0)
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

    bots = rings[-1]
    n_c = len(bots)
    bot_mat = 1
    try:
        bot = bm.faces.new(list(reversed(bots)))
        _mark_face(bot, bot_mat)
    except ValueError:
        hub = bm.verts.new(
            (
                sum(v.co.x for v in bots) / n_c,
                sum(v.co.y for v in bots) / n_c,
                sum(v.co.z for v in bots) / n_c,
            )
        )
        for i in range(n_c):
            _tri(bm, hub, bots[(i + 1) % n_c], bots[i], bot_mat)

    _orient_cliff_bm(bm)
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        c = f.calc_center_median()
        if c.z > -0.2 and f.normal.z < 0.0:
            f.normal_flip()
    ob = mesh_from_bm(bm, "Island")
    bind_stone_materials(ob)
    paint_mass(ob)
    active(ob)
    bpy.ops.object.shade_flat()
    _xy_span(ob, "island")
    log(f"island faces {len(ob.data.polygons)} stones {len(usable)} rim {n_rim} blocks {n_blocks}")
    return ob