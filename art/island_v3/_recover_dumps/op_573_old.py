def _cell_key(p: tuple[float, float]) -> tuple[int, int]:
    return (round(p[0] * 40.0), round(p[1] * 40.0))


def _u01(kx: int, ky: int, salt: int) -> float:
    n = (kx * 73856093) ^ (ky * 19349663) ^ (salt * 83492791)
    n = (n * 1103515245 + 12345) & 0x7FFFFFFF
    return float(n % 10007) / 10007.0


def _shade_rgba(shade: float) -> tuple[float, float, float, float]:
    return (shade * 0.97, shade, shade * 1.04, 1.0)


def _shade_at(x: float, y: float) -> float:
    kx, ky = _cell_key((x, y))
    bins = (0.028, 0.040, 0.052, 0.066, 0.086)
    return bins[int(_u01(kx, ky, 19) * len(bins)) % len(bins)]


def paint_mass(ob: bpy.types.Object) -> None:
    """Same Voronoi greys on top, sides and bottom — one stone, not a sticker."""
    me = ob.data
    existing = me.color_attributes.get("Col")
    if existing is not None:
        me.color_attributes.remove(existing)
    col = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="CORNER")
    me.color_attributes.active_color = col
    grout = _shade_rgba(0.031)
    for poly in me.polygons:
        c = poly.center
        n = poly.normal
        area = poly.area
        if c.z > -0.2 and abs(n.z) > 0.65 and area < 180.0:
            rgba = grout
            elif abs(n.z) < 0.62:
            kx, ky = _cell_key((c.x, c.y))
            kz = int(round(c.z / 55.0))
            bins = (0.048, 0.082, 0.12, 0.17, 0.24)
            shade = bins[int(_u01(kx, ky, 19 + kz * 13) * len(bins)) % len(bins)]
            rgba = _shade_rgba(shade)
        else:
            rgba = _shade_rgba(_shade_at(c.x, c.y))
        for li in poly.loop_indices:
            col.data[li].color = rgba


def _color_face(
    face: bmesh.types.BMFace,
    layer: object,
    rgba: tuple[float, float, float, float],
) -> None:
    for lp in face.loops:
        lp[layer] = rgba


def _quad(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    c: bmesh.types.BMVert,
    d: bmesh.types.BMVert,
    layer: object | None = None,
    rgba: tuple[float, float, float, float] | None = None,
) -> None:
    try:
        face = bm.faces.new((a, b, c, d))
        if layer is not None and rgba is not None:
            _color_face(face, layer, rgba)
    except ValueError:
        try:
            f1 = bm.faces.new((a, b, c))
            f2 = bm.faces.new((a, c, d))
            if layer is not None and rgba is not None:
                _color_face(f1, layer, rgba)
                _color_face(f2, layer, rgba)
        except ValueError:
            pass


def build_mass(cells: list[list[tuple[float, float]]]) -> bpy.types.Object:
    """One object: each Voronoi tile is a stone through the torn slab."""
    usable = [poly for poly in cells if len(poly) >= 3]
    if not usable:
        return mesh_from_bm(bmesh.new(), "Island")
    npts = 0
    sx = 0.0
    sy = 0.0
    for poly in usable:
        for p in poly:
            sx += p[0]
            sy += p[1]
            npts += 1
    cx, cy = sx / float(npts), sy / float(npts)
    ts = (0.0, 0.22, 0.50, 1.0)
    bm = bmesh.new()
    col_layer = bm.loops.layers.float_color.new("Col")
    grout = _shade_rgba(0.031)
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

    tops: list[bmesh.types.BMFace] = []
    for poly in usable:
        n = len(poly)
        cxp = sum(p[0] for p in poly) / n
        cyp = sum(p[1] for p in poly) / n
        rgba = _shade_rgba(_shade_at(cxp, cyp))
        for li in range(len(ts) - 1):
            for i in range(n):
                a = vert(poly[i], li)
                b = vert(poly[(i + 1) % n], li)
                c = vert(poly[(i + 1) % n], li + 1)
                d = vert(poly[i], li + 1)
                _quad(bm, a, b, c, d, col_layer, rgba)
        bots = [vert(p, len(ts) - 1) for p in poly]
        try:
            bot = bm.faces.new(list(reversed(bots)))
            _color_face(bot, col_layer, rgba)
        except ValueError:
            hub = bm.verts.new(
                (
                    sum(v.co.x for v in bots) / n,
                    sum(v.co.y for v in bots) / n,
                    sum(v.co.z for v in bots) / n,
                )
            )
            for i in range(n):
                try:
                    f = bm.faces.new((hub, bots[(i + 1) % n], bots[i]))
                    _color_face(f, col_layer, rgba)
                except ValueError:
                    pass
        top_vs = [vert(p, 0) for p in poly]
        try:
            top = bm.faces.new(top_vs)
            _color_face(top, col_layer, rgba)
            tops.append(top)
        except ValueError:
            pass

    inset_faces = []
    for f in tops:
        if not f.is_valid:
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
        c = f.calc_center_median()
        if c.z < -0.2:
            continue
        if f in before:
            continue
        _color_face(f, col_layer, grout)

    _orient_cliff_bm(bm)
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        c = f.calc_center_median()
        if c.z > -0.2 and f.normal.z < 0.0:
            f.normal_flip()
    ob = mesh_from_bm(bm, "Island")
    paint_mass(ob)
    active(ob)
    bpy.ops.object.shade_flat()
    _xy_span(ob, "island")
    log(f"island faces {len(ob.data.polygons)} stones {len(usable)}")
    return ob