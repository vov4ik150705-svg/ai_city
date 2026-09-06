def _cell_key(p: tuple[float, float]) -> tuple[int, int]:
    return (round(p[0] * 40.0), round(p[1] * 40.0))


def _u01(kx: int, ky: int, salt: int) -> float:
    n = (kx * 73856093) ^ (ky * 19349663) ^ (salt * 83492791)
    n = (n * 1103515245 + 12345) & 0x7FFFFFFF
    return float(n % 10007) / 10007.0


def _stone_bin(x: float, y: float, salt: int = 19) -> int:
    kx, ky = _cell_key((x, y))
    return int(_u01(kx, ky, salt) * len(_STONE_RGB)) % len(_STONE_RGB)


def _cell_bin(poly: list[tuple[float, float]]) -> int:
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    return _stone_bin(cx, cy, 19)


def bind_stone_materials(ob: bpy.types.Object) -> None:
    while ob.data.materials:
        ob.data.materials.pop(index=0)
    for i, rgb in enumerate(_STONE_RGB):
        ob.data.materials.append(matte_solid(f"Stone{i}", rgb, 0.94))
    ob.data.materials.append(matte_solid("Grout", _GROUT_RGB, 0.97))


def paint_mass(ob: bpy.types.Object) -> None:
    """Keep each Voronoi stone one grey through the volume; grout only in top channels."""
    me = ob.data
    grout_i = _GROUT_MAT
    n_bins = len(_STONE_RGB)
    for poly in me.polygons:
        verts = [me.vertices[i] for i in poly.vertices]
        cx = sum(v.co.x for v in verts) / len(verts)
        cy = sum(v.co.y for v in verts) / len(verts)
        cz = sum(v.co.z for v in verts) / len(verts)
        n = poly.normal
        if n.z > 0.72 and cz > -1.5 and poly.area < 22.0:
            poly.material_index = grout_i
            continue
        k = _stone_bin(cx, cy, 19)
        if abs(n.z) < 0.55:
            band = int(max(0.0, -cz) / 42.0)
            if band > 0:
                k = (k + band) % n_bins
        elif n.z < -0.35:
            k = (k + 1) % n_bins
        poly.material_index = k


def _mark_face(face: bmesh.types.BMFace, mat_i: int) -> None:
    face.material_index = mat_i


def _tri(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    c: bmesh.types.BMVert,
    mat_i: int,
) -> None:
    try:
        face = bm.faces.new((a, b, c))
        _mark_face(face, mat_i)
    except ValueError:
        pass


def _quad(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    c: bmesh.types.BMVert,
    d: bmesh.types.BMVert,
    mat_i: int,
) -> None:
    try:
        _tri(bm, a, b, c, mat_i)
        _tri(bm, a, c, d, mat_i)
    except ValueError:
        try:
            face = bm.faces.new((a, b, c, d))
            _mark_face(face, mat_i)
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
    ts = (0.0, 0.10, 0.24, 0.42, 0.64, 0.82, 1.0)
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

    tops: list[bmesh.types.BMFace] = []
    for poly in usable:
        n = len(poly)
        stone = _cell_bin(poly)
        for li in range(len(ts) - 1):
            # Lower bands shift one bin so a lighter chunk sits on a darker one.
            band = stone if li == 0 else (stone + li) % len(_STONE_RGB)
            for i in range(n):
                a = vert(poly[i], li)
                b = vert(poly[(i + 1) % n], li)
                c = vert(poly[(i + 1) % n], li + 1)
                d = vert(poly[i], li + 1)
                _quad(bm, a, b, c, d, band)
        bots = [vert(p, len(ts) - 1) for p in poly]
        bot_mat = (stone + 2) % len(_STONE_RGB)
        try:
            bot = bm.faces.new(list(reversed(bots)))
            _mark_face(bot, bot_mat)
        except ValueError:
            hub = bm.verts.new(
                (
                    sum(v.co.x for v in bots) / n,
                    sum(v.co.y for v in bots) / n,
                    sum(v.co.z for v in bots) / n,
                )
            )
            for i in range(n):
                _tri(bm, hub, bots[(i + 1) % n], bots[i], bot_mat)
        top_vs = [vert(p, 0) for p in poly]
        try:
            top = bm.faces.new(top_vs)
            _mark_face(top, stone)
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
        f.normal_update()
        c = f.calc_center_median()
        if c.z < -0.2:
            continue
        if f in before:
            continue
        if f.normal.z < 0.72:
            continue
        _mark_face(f, _GROUT_MAT)

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
    log(f"island faces {len(ob.data.polygons)} stones {len(usable)}")
    return ob