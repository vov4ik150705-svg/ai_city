        if poly.center.z > -1.0 * ISLAND_SCALE:
            continue
        if poly.material_index == _GROUT_MAT:
            continue
        n = poly.normal
        if n.z > 0.72 and poly.area < 22.0 * ISLAND_SCALE * ISLAND_SCALE: