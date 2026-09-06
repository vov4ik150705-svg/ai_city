"""Print world bounds of a GLB. Usage: blender --background --python _inspect_glb.py -- path.glb"""
from __future__ import annotations

import sys

import bpy
from mathutils import Vector


def main() -> None:
    path = sys.argv[sys.argv.index("--") + 1]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.view_layer.update()
    xs: list[float] = []
    ys: list[float] = []
    zs: list[float] = []
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            print(f"obj {ob.name} type={ob.type} loc={tuple(ob.location)}")
            continue
        print(f"mesh {ob.name} verts={len(ob.data.vertices)} loc={tuple(ob.location)} scale={tuple(ob.scale)}")
        for v in ob.data.vertices:
            p = ob.matrix_world @ v.co
            xs.append(p.x)
            ys.append(p.y)
            zs.append(p.z)
    if not xs:
        print("empty")
        return
    print(
        f"bounds x {min(xs):.3f}..{max(xs):.3f} y {min(ys):.3f}..{max(ys):.3f} z {min(zs):.3f}..{max(zs):.3f}"
    )
    print(
        f"size {max(xs)-min(xs):.3f} x {max(ys)-min(ys):.3f} x {max(zs)-min(zs):.3f} "
        f"center {((min(xs)+max(xs))*0.5):.3f} {((min(ys)+max(ys))*0.5):.3f} {((min(zs)+max(zs))*0.5):.3f}"
    )


if __name__ == "__main__":
    main()
