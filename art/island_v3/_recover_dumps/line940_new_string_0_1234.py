    n_blocks = 16
    n_loop = n_blocks * 2
    corners = _square_corners(rim, cx, cy)
    idxs = _outline_indices(len(rim), n_loop, corners)
    ring_pts = [rim[i] for i in idxs]
    tiles: list[list[tuple[float, float]]] = []
    for poly in usable:
        tiles.extend(_clip_to_ring(poly, _ensure_ccw(list(ring_pts))))
    if tiles:
        usable = tiles

    bm = bmesh.new()
    vmap: dict[tuple[int, int, int], bmesh.types.BMVert] = {}

    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:
        kx, ky = _cell_key(p)
        mk = (kx, ky, li)
        found = vmap.get(mk)
        if found is not None:
            return found
        nv = bm.verts.new((p[0], p[1], PLAZA_Z))
        vmap[mk] = nv
        return nv

    rim_keys = {_cell_key(p) for p in ring_pts}

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