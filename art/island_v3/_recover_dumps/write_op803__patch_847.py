from pathlib import Path
import ast

src = Path(r"C:\Users\sk640\ai_city\art\island_v3\build_island.py")
text = src.read_text(encoding="utf-8")

old_clip = '''def _clip_to_ring(
    cell: list[tuple[float, float]],
    ring: list[tuple[float, float]],
    origin: tuple[float, float],
) -> list[list[tuple[float, float]]]:
    """Cut a Voronoi cell to the top-ring outline. Interior cells stay whole."""
    del origin
    if len(cell) < 3 or len(ring) < 3:
        return []
    clip = _ensure_ccw(list(ring))
    if all(_pip(p, clip) for p in cell):
        return [cell]
    part = _dedupe_poly(_sutherland(cell, clip))
    if len(part) >= 3 and abs(_signed_area(part)) > 1.0:
        return [part]
    return []
'''

new_clip = '''def _snap_to_ring(
    p: tuple[float, float],
    ring: list[tuple[float, float]],
    thresh: float = 2.4,
) -> tuple[float, float]:
    best_v = p
    best_d = thresh
    for q in ring:
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if d < best_d:
            best_d = d
            best_v = q
    if best_d < 0.9:
        return best_v
    best_p = p
    best_e = thresh
    n = len(ring)
    for i in range(n):
        a, b = ring[i], ring[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length2 = dx * dx + dy * dy
        if length2 < 1e-12:
            continue
        t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2
        t = max(0.0, min(1.0, t))
        q = (a[0] + t * dx, a[1] + t * dy)
        d = math.hypot(p[0] - q[0], p[1] - q[1])
        if d < best_e:
            best_e = d
            best_p = q
    if best_e >= thresh:
        return p
    for q in ring:
        if math.hypot(best_p[0] - q[0], best_p[1] - q[1]) < 0.9:
            return q
    return best_p


def _clip_to_ring(
    cell: list[tuple[float, float]],
    ring: list[tuple[float, float]],
    origin: tuple[float, float],
) -> list[list[tuple[float, float]]]:
    """Cut a Voronoi cell to the top-ring outline. Interior cells stay whole."""
    del origin
    if len(cell) < 3 or len(ring) < 3:
        return []
    clip = _ensure_ccw(list(ring))
    if all(_pip(p, clip) for p in cell):
        return [[_snap_to_ring(p, clip) for p in cell]]
    part = _dedupe_poly(_sutherland(cell, clip))
    if len(part) >= 3 and abs(_signed_area(part)) > 1.0:
        return [[_snap_to_ring(p, clip) for p in part]]
    return []
'''

if old_clip not in text:
    raise SystemExit("clip block missing")
text = text.replace(old_clip, new_clip, 1)

old_paint = '''def paint_mass(ob: bpy.types.Object) -> None:
    """Grout channels only. Stone bins stay as assigned per Voronoi cell."""
    me = ob.data
    for poly in me.polygons:
        if poly.material_index == _GROUT_MAT:
            continue
        n = poly.normal
        if n.z > 0.72 and poly.center.z > -1.5 and poly.area < 22.0:
            poly.material_index = _GROUT_MAT
'''

new_paint = '''def paint_mass(ob: bpy.types.Object) -> None:
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
'''

if old_paint not in text:
    raise SystemExit("paint_mass missing")
text = text.replace(old_paint, new_paint, 1)

start = text.index("    def vert(p: tuple[float, float], li: int) -> bmesh.types.BMVert:")
end = text.index('    log(f"plaza faces {sum(1 for f in bm.faces if f.is_valid)}")')
end = text.index("\n", end) + 1

plaza = Path(r"C:\Users\sk640\ai_city\art\island_v3\_plaza_847.py").read_text(
    encoding="utf-8"
)
if not plaza.endswith("\n"):
    plaza += "\n"
text = text[:start] + plaza + text[end:]

old_exp = """def export_glb(col: bpy.types.Collection) -> None:
    bpy.ops.object.select_all(action=\"DESELECT\")
"""
new_exp = """def export_glb(col: bpy.types.Collection) -> None:
    for ob in col.objects:
        if ob.type != \"MESH\":
            continue
        for mat in ob.data.materials:
            if mat is not None:
                mat.use_backface_culling = False
                mat.blend_method = \"OPAQUE\"
    bpy.ops.object.select_all(action=\"DESELECT\")
"""
if old_exp not in text:
    raise SystemExit("export_glb missing")
text = text.replace(old_exp, new_exp, 1)

src.write_text(text, encoding="utf-8")
ast.parse(text)
print("patched ok")
