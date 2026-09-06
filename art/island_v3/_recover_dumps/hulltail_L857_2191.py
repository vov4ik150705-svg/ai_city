    n_rim = len(rim)
    coarse = _simplify_closed(rim, 40.0)
    if len(coarse) > 20:
        coarse = _simplify_closed(rim, 56.0)
    if len(coarse) < 12:
        step = max(1, n_rim // 16)
        coarse = list(rim[::step])
    log(f"hull coarse {len(coarse)} from rim {n_rim}")

    for i in range(n_rim):
        p0 = rim[i]
        p1 = rim[(i + 1) % n_rim]
        q0 = coarse[_nearest_loop(p0, coarse, cx, cy)]
        q1 = coarse[_nearest_loop(p1, coarse, cx, cy)]
        a = vert(p0, 0)
        b = vert(p1, 0)
        band = edge_stone.get(edge_key(p0, p1), _stone_bin(p0[0], p0[1]))
        if q0 == q1:
            _tri(bm, a, b, vert(q0, 1), band)
        else:
            _quad(bm, a, b, vert(q1, 1), vert(q0, 1), band)

    n_c = len(coarse)
    for li in range(1, len(ts) - 1):
        for i in range(n_c):
            p0 = coarse[i]
            p1 = coarse[(i + 1) % n_c]
            a = vert(p0, li)
            b = vert(p1, li)
            c = vert(p1, li + 1)
            d = vert(p0, li + 1)
            mx = 0.5 * (p0[0] + p1[0])
            my = 0.5 * (p0[1] + p1[1])
            band = _sector_bin(mx, my, li, cx, cy)
            _quad(bm, a, b, c, d, band)

    bots = [vert(p, len(ts) - 1) for p in coarse]
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

    _extrude_shards(bm)
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
    log(f"island faces {len(ob.data.polygons)} stones {len(usable)} rim {n_rim} hull {n_c}")
    return ob