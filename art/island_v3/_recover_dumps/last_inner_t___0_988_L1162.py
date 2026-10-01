    ring_pts = [rim[i] for i in idxs]
    inner_t = 0.988
    inner_pts = [
        (cx + (p[0] - cx) * inner_t, cy + (p[1] - cy) * inner_t) for p in ring_pts
    ]
    tiles: list[list[tuple[float, float]]] = []
    for poly in usable:
        tiles.extend(_clip_to_ring(poly, inner_pts, (cx, cy)))
    if tiles:
        usable = tiles
        log(f"plaza on ring {len(tiles)} faces")