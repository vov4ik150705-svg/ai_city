def paint_mass(ob: bpy.types.Object) -> None:
    """Hull only. Plaza grout channels stacked a second coplanar layer and flickered."""
    me = ob.data
    for poly in me.polygons:
        if poly.center.z > -1.0:
            continue
        if poly.material_index == _GROUT_MAT:
            continue
        n = poly.normal
        if n.z > 0.72 and poly.area < 22.0:
            poly.material_index = _GROUT_MAT