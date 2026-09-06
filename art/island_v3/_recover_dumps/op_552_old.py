def _quad(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    c: bmesh.types.BMVert,
    d: bmesh.types.BMVert,
) -> None:
    try:
        bm.faces.new((a, b, c, d))
    except ValueError:
        try:
            bm.faces.new((a, b, c))
            bm.faces.new((a, c, d))
        except ValueError:
            pass


def build_cliff(border: list[tuple[float, float]]) -> bpy.types.Object:
    """Thick torn slab: vertical drop, then chips. No needle tip."""
    if len(border) < 8:
        return mesh_from_bm(bmesh.new(), "Cliff")
    outline = _simplify_closed(border, 32.0)
    n = len(outline)
    log(f"cliff outline {n} from border {len(border)}")
    cx = sum(p[0] for p in outline) / n
    cy = sum(p[1] for p in outline) / n
    ts = (0.0, 0.24, 0.52, 1.0)
    bm = bmesh.new()
    rings: list[list[bmesh.types.BMVert]] = []
    for t in ts:
        ring: list[bmesh.types.BMVert] = []
        for i, (x, y) in enumerate(outline):
            px, py, pz = _block_point(x, y, cx, cy, t, i, n)
            ring.append(bm.verts.new((px, py, pz)))
        rings.append(ring)
    for li in range(len(rings) - 1):
        a, b = rings[li], rings[li + 1]
        for i in range(n):
            _quad(bm, a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])
    bots = rings[-1]
    try:
        bm.faces.new(list(reversed(bots)))
    except ValueError:
        hub = bm.verts.new(
            (
                sum(v.co.x for v in bots) / n,
                sum(v.co.y for v in bots) / n,
                sum(v.co.z for v in bots) / n + 18.0,
            )
        )
        for i in range(n):
            try:
                bm.faces.new((hub, bots[(i + 1) % n], bots[i]))
            except ValueError:
                pass
    _orient_cliff_bm(bm)
    ob = mesh_from_bm(bm, "Cliff")
    _cleanup_mesh(ob, consistent=False, weld=0.04)
    bm2 = bmesh.new()
    bm2.from_mesh(ob.data)
    _orient_cliff_bm(bm2)
    bm2.to_mesh(ob.data)
    bm2.free()
    ob.data.update()
    _xy_span(ob, "cliff")
    log(f"cliff faces {len(ob.data.polygons)} torn block")
    return ob