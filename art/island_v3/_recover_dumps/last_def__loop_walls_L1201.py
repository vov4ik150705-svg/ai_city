        _quad(bm, upper[b1], upper[b0], lower[b0], lower[b1], join)


def _mids_on_seg(
    bm: bmesh.types.BMesh,
    a: bmesh.types.BMVert,
    b: bmesh.types.BMVert,
    z_lo: float,
    z_hi: float,
) -> list[bmesh.types.BMVert]:
    """Plaza verts sitting on a hull ring edge — T-junctions without these."""
    ax, ay = a.co.x, a.co.y
    dx = b.co.x - ax
    dy = b.co.y - ay
    l2 = dx * dx + dy * dy
    if l2 < 1e-8:
        return []
    found: list[tuple[float, bmesh.types.BMVert]] = []
    for v in bm.verts:
        if not v.is_valid or v is a or v is b:
            continue
        if v.co.z < z_lo or v.co.z > z_hi:
            continue
        t = ((v.co.x - ax) * dx + (v.co.y - ay) * dy) / l2
        if t <= 0.02 or t >= 0.98:
            continue
        qx = ax + t * dx
        qy = ay + t * dy
        if math.hypot(v.co.x - qx, v.co.y - qy) > 0.7:
            continue
        v.co.x = qx
        v.co.y = qy
        found.append((t, v))
    found.sort(key=lambda item: item[0])
    out: list[bmesh.types.BMVert] = []
    last_t = -1.0
    for t, v in found:
        if t - last_t < 0.015:
            continue
        out.append(v)
        last_t = t
    return out


def _loop_walls_split(
    bm: bmesh.types.BMesh,
    upper: list[bmesh.types.BMVert],
    lower: list[bmesh.types.BMVert],
    salt: int,
    vert_xyz,
) -> None:
    n = min(len(upper), len(lower))
    if n < 4:
        return
    for i in range(n):
        a = upper[i]
        b = upper[(i + 1) % n]
        la = lower[i]
        lb = lower[(i + 1) % n]
        mat_i = int(_u01(i, salt, 19) * len(_STONE_RGB)) % len(_STONE_RGB)
        mids = _mids_on_seg(bm, a, b, PLAZA_Z - 0.2, PLAZA_Z + 0.2)
        chain = [a] + mids + [b]
        ax, ay = a.co.x, a.co.y
        dx = b.co.x - ax
        dy = b.co.y - ay
        l2 = dx * dx + dy * dy
        ts = [0.0]
        for v in mids:
            ts.append(((v.co.x - ax) * dx + (v.co.y - ay) * dy) / l2 if l2 > 1e-12 else 0.0)
        ts.append(1.0)
        los: list[bmesh.types.BMVert] = []
        for t in ts:
            x = la.co.x + t * (lb.co.x - la.co.x)
            y = la.co.y + t * (lb.co.y - la.co.y)
            z = la.co.z + t * (lb.co.z - la.co.z)
            los.append(vert_xyz(x, y, z))
        for j in range(len(chain) - 1):
            _quad(bm, chain[j], chain[j + 1], los[j + 1], los[j], mat_i)