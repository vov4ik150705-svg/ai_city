import {
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Material,
  type BufferGeometry,
  type Object3D,
} from "three"

export type IslandMaterialClass =
  | "sky"
  | "cloud"
  | "sign"
  | "window"
  | "lamp"
  | "buildingSurface"
  | "hardscape"
  | "decor"
  | "unknown"

function matNameOf(mat: Material | undefined): string {
  if (mat === undefined) return ""
  const named = mat as { readonly name?: string }
  return typeof named.name === "string" ? named.name : ""
}

export function classifyIslandMaterial(objectName: string, materialName: string): IslandMaterialClass {
  const blob = `${objectName} ${materialName}`.toLowerCase()
  if (blob.includes("skydome") || blob.includes("sky_dome")) return "sky"
  if (materialName === "IslandUnlit" && blob.includes("sky")) return "sky"
  if (blob.includes("inst_cloud") || blob.includes("cloud")) return "cloud"
  if (blob.includes("emissive:sign") || objectName.startsWith("sign_") || blob.includes("sign_")) return "sign"
  if (blob.includes("emissive:window") || objectName.startsWith("window_") || blob.includes("d_win")) {
    return "window"
  }
  if (blob.includes("emissive:lamp") || blob.includes("lantern") || blob.includes("lamp")) return "lamp"
  if (blob.includes("surface:building")) return "buildingSurface"
  if (blob.includes("hardscape") || blob.includes("plaza") || blob.includes("deck")) return "hardscape"
  if (blob.includes("tree") || blob.includes("rail") || blob.includes("bench")) return "decor"
  return "unknown"
}

function restoreNormals(geometry: BufferGeometry): void {
  if (geometry.getAttribute("normal") == null) geometry.computeVertexNormals()
}

function enableVertexColors(mat: Material, geometry: BufferGeometry): void {
  if (geometry.getAttribute("color") == null) return
  const withVerts = mat as Material & { vertexColors?: boolean }
  if ("vertexColors" in withVerts) withVerts.vertexColors = true
  // glTF albedo is baseColorFactor * COLOR_0. Do not stomp color to white:
  // Terra rock_rock authors dark stone in baseColor and light variation in COLOR_0.
  mat.needsUpdate = true
}

function toUnlit(mat: Material, geometry: BufferGeometry, sky: boolean): MeshBasicMaterial {
  const basic = new MeshBasicMaterial({
    vertexColors: geometry.getAttribute("color") != null,
    side: sky ? DoubleSide : FrontSide,
    depthWrite: sky ? false : true,
  })
  const named = mat as { readonly name?: string }
  if (typeof named.name === "string") basic.name = named.name
  if (geometry.getAttribute("color") == null && "color" in mat) {
    const src = mat as { readonly color?: { getHex(): number } }
    if (src.color !== undefined) basic.color.setHex(src.color.getHex())
  }
  return basic
}

export function isSkyOrCloudClass(cls: IslandMaterialClass): boolean {
  return cls === "sky" || cls === "cloud"
}

export function applyIslandMaterials(
  root: Object3D,
  glow: MeshStandardMaterial[],
): { readonly restoredNormals: number; readonly unlit: number } {
  let restoredNormals = 0
  let unlit = 0
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    const geometry = obj.geometry as BufferGeometry | undefined
    if (geometry === undefined) return
    const before = geometry.getAttribute("normal")
    restoreNormals(geometry)
    if (before == null && geometry.getAttribute("normal") != null) restoredNormals += 1
    const raw = obj.material
    const list: Material[] = []
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item instanceof Material) list.push(item)
      }
    } else if (raw instanceof Material) {
      list.push(raw)
    }
    const next: Material[] = []
    let sky = false
    for (const mat of list) {
      const cls = classifyIslandMaterial(obj.name, matNameOf(mat))
      if (cls === "sky") sky = true
      enableVertexColors(mat, geometry)
      if (isSkyOrCloudClass(cls)) {
        next.push(toUnlit(mat, geometry, cls === "sky"))
        unlit += 1
        continue
      }
      if (mat instanceof MeshStandardMaterial && mat.emissive.getHex() !== 0) {
        if (cls === "sign" || cls === "window" || cls === "lamp" || cls === "unknown") glow.push(mat)
      }
      next.push(mat)
    }
    if (sky) {
      obj.frustumCulled = false
      const ten = (1 + 1) * (1 + 1 + 1 + 1) + (1 + 1)
      obj.renderOrder = 0 - ten * ten * ten
    }
    const first = next[0]
    if (next.length === 1 && first !== undefined) obj.material = first
    else if (next.length > 1) obj.material = next
  })
  return { restoredNormals, unlit }
}

export function cityMassBoxFilter(obj: Object3D): boolean {
  if (!(obj instanceof Mesh)) return false
  const raw = obj.material
  const list = Array.isArray(raw) ? raw : [raw]
  for (const mat of list) {
    const cls = classifyIslandMaterial(obj.name, matNameOf(mat as Material | undefined))
    if (isSkyOrCloudClass(cls)) return false
  }
  return true
}
