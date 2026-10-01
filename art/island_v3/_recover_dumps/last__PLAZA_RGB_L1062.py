    up0 = [vert(p, 0) for p in ring_pts]
    n_ring = len(up0)
    rings: list[list[bmesh.types.BMVert]] = [up0]
    for step in (3, 2, 1):
        t = step / 4.0
        layer = [
            vert((cx + (p[0] - cx) * t, cy + (p[1] - cy) * t), 0) for p in ring_pts
        ]
        rings.append(layer)
    hub = vert((cx, cy), 0)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(n_ring):
            ax, ay = ra[i].co.x, ra[i].co.y
            mat_i = _PLAZA_MAT0 + (_stone_bin(ax, ay) % len(_PLAZA_RGB))
            for poly in usable:
                if _pip((ax, ay), poly):
                    mat_i = _plaza_bin(poly)
                    break
            _quad(
                bm,
                ra[i],
                ra[(i + 1) % n_ring],
                rb[(i + 1) % n_ring],
                rb[i],
                mat_i,
            )
    inner = rings[-1]
    for i in range(n_ring):
        ax, ay = inner[i].co.x, inner[i].co.y
        mat_i = _PLAZA_MAT0 + (_stone_bin(ax, ay) % len(_PLAZA_RGB))
        for poly in usable:
            if _pip((ax, ay), poly):
                mat_i = _plaza_bin(poly)
                break
        _tri(bm, hub, inner[i], inner[(i + 1) % n_ring], mat_i)
    for f in bm.faces:
        if not f.is_valid:
            continue
        f.normal_update()
        if f.calc_center_median().z > -0.2 and f.normal.z < 0.0:
            f.normal_flip()
    log(f"plaza faces {sum(1 for f in bm.faces if f.is_valid)}")