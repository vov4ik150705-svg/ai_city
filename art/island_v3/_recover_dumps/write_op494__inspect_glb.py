"""Print native world bounds of a GLB. Usage: blender --background --python _inspect_glb.py -- path.glb"""
from __future__ import annotations

import sys

import bpy
from mathutils import Vector


def bounds(ob: bpy.types.Object) -> tuple[Vector, Vector]:
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    path = argv[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    print(f"mesh count {len(meshes)}")
    for o in meshes:
        lo, hi = bounds(o)
        print(
            f"obj {o.name} verts {len(o.data.vertices)} "
            f"bounds {lo.x:.3f},{lo.y:.3f},{lo.z:.3f} .. {hi.x:.3f},{hi.y:.3f},{hi.z:.3f} "
            f"size {hi.x - lo.x:.3f} x {hi.y - lo.y:.3f} x {hi.z - lo.z:.3f}"
        )


if __name__ == "__main__":
    main()
