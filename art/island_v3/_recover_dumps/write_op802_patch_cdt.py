from pathlib import Path
import ast

src = Path(r"C:\Users\sk640\ai_city\art\island_v3\build_island.py")
text = src.read_text(encoding="utf-8")
start = text.index("    ring_pts = [rim[i] for i in idxs]\n    tiles:")
end_marker = '    log(f"plaza faces {sum(1 for f in bm.faces if f.is_valid)}")'
end = text.index(end_marker)
end = text.index("\n", end) + 1
new = Path(r"C:\Users\sk640\ai_city\art\island_v3\_restore\all_cdt_3_L1248.py").read_text(
    encoding="utf-8"
)
if not new.endswith("\n"):
    new += "\n"
text = text[:start] + new + text[end:]
text = text.replace(
    "        mk = (round(x * 8.0), round(y * 8.0), round(z * 2.0))",
    '        mk = ("h", round(x * 8.0), round(y * 8.0), round(z * 2.0))',
)
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
    raise SystemExit("export_glb pattern missing")
text = text.replace(old_exp, new_exp, 1)
src.write_text(text, encoding="utf-8")
ast.parse(text)
print("ok", text.count("delaunay_2d_cdt"), "cdt calls")
