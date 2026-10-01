def build_mass(cells: list[list[tuple[float, float]]]) -> bpy.types.Object:
    """One closed rock: Voronoi plaza on top, chipped hull on the sides."""
    usable = [poly for poly in cells if len(poly) >= 3]
    if not usable:
        return mesh_from_bm(bmesh.new(), "Island")
    rim = boundary_loop(usable)
    if len(rim) < 8:
        rim = make_outline(HALF)
    npts = 0
    sx = 0.0
    sy = 0.0
    for poly in usable:
        for p in poly:
            sx += p[0]
            sy += p[1]
            npts += 1
    cx, cy = sx / float(npts), sy / float(npts)
    # Few rings: a short stone lip, then large torn chunks — not 166 columns.
    ts = (0.0, 0.14, 0.42, 0.70, 1.0)
    bm = bmesh.new()
    vmap: dict[tuple[int, int, int], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = (kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        x, y, z = _block_point(p[0], p[1], cx, cy, ts[li], kx, ky)
        nv = bm.verts.new((x, y, z))
        vmap[mk] = nv
        return nv

    def edge_key(
        a: tuple[float, float], b: tuple[float, float]
    ) -> tuple[tuple[int, int], tuple[int, int]]:
        ka, kb = _cell_key(a), _cell_key(b)
        return (ka, kb) if ka <= kb else (kb, ka)

    edge_n: dict[tuple[tuple[int, int], tuple[int, int]], int] = {}
    edge_stone: dict[tuple[tuple[int, int], tuple[int, int]], int] = {}
    for poly in usable:
        stone = _cell_bin(poly)
        nn = len(poly)
        for i in range(nn):
            ek = edge_key(poly[i], poly[(i + 1) % nn])
            edge_n[ek] = edge_n.get(ek, 0) + 1
            edge_stone[ek] = stone
    rim_keys = {_cell_key(p) for p in rim}

    tops: list[bmesh.types.BMFace] = []
    rim_faces: set[bmesh.types.BMFace] = set()
    for poly in usable:
        stone = _cell_bin(poly)
        top_vs = [vert(p, 0) for p in poly]
        try:
            top = bm.faces.new(top_vs)
            _mark_face(top, stone)
            tops.append(top)
            if any(_cell_key(p) in rim_keys for p in poly):
                rim_faces.add(top)
        except ValueError:
            pass

    inset_faces = []
    for f in tops:
        if not f.is_valid or f in rim_faces:
            continue
        if f.calc_area() < 216.0:
            continue
        vs = list(f.verts)
        nn = len(vs)
        if nn < 3:
            continue
        min_e = min((vs[i].co - vs[(i + 1) % nn].co).length for i in range(nn))
        if min_e > 2.7:
            inset_faces.append(f)
    before = set(tops)
    if inset_faces:
        bmesh.ops.inset_individual(
            bm,
            faces=inset_faces,
            thickness=1.26,
            depth=0.0,
            use_even_offset=True,
        )
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        c = f.calc_center_median()
        if c.z < -0.2 or f in before or f.normal.z < 0.72:
            continue
        _mark_face(f, _GROUT_MAT)

    n_rim = len(rim)
    for li in range(len(ts) - 1):
        for i in range(n_rim):
            p0 = rim[i]
            p1 = rim[(i + 1) % n_rim]
            a = vert(p0, li)
            b = vert(p1, li)
            c = vert(p1, li + 1)
            d = vert(p0, li + 1)
            if li == 0:
                band = edge_stone.get(edge_key(p0, p1), _stone_bin(p0[0], p0[1]))
            else:
                mx = 0.5 * (p0[0] + p1[0])
                my = 0.5 * (p0[1] + p1[1])
                band = _sector_bin(mx, my, li, cx, cy)
            _quad(bm, a, b, c, d, band)

    bots = [vert(p, len(ts) - 1) for p in rim]
    bot_mat = 1
    try:
        bot = bm.faces.new(list(reversed(bots)))
        _mark_face(bot, bot_mat)
    except ValueError:
        hub = bm.verts.new(
            (
                sum(v.co.x for v in bots) / n_rim,
                sum(v.co.y for v in bots) / n_rim,
                sum(v.co.z for v in bots) / n_rim,
            )
        )
        for i in range(n_rim):
            _tri(bm, hub, bots[(i + 1) % n_rim], bots[i], bot_mat)

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
    log(f"island faces {len(ob.data.polygons)} stones {len(usable)} rim {n_rim}")
    return ob