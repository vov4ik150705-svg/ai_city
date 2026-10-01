def _cell_bin(poly: list[tuple[float, float]]) -> int:
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    return _stone_bin(cx, cy, 19)


def _sector_bin(x: float, y: float, li: int, cx: float, cy: float) -> int:
    ang = math.atan2(y - cy, x - cx)
    sector = int((ang + math.pi) / math.tau * 8.0) % 8
    return (sector * 2 + li) % len(_STONE_RGB)


def _nearest_loop(p: tuple[float, float], loop: list[tuple[float, float]], cx: float, cy: float) -> int: