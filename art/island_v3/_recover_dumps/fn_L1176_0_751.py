    ring_pts = [rim[i] for i in idxs]
    tiles: list[list[tuple[float, float]]] = []
    for poly in usable:
        tiles.extend(_clip_to_ring(poly, ring_pts, (cx, cy)))
    if tiles:
        usable = tiles
        log(f"plaza on ring {len(tiles)} faces")

    bm = bmesh.new()
    vmap: dict[tuple[object, ...], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = ("p", kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        z = PLAZA_Z if li == 0 else PLAZA_Z - 2.4
        nv = bm.verts.new((p[0], p[1], z))
        vmap[mk] = nv
        return nv

    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)