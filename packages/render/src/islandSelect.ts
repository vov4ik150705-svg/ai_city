/** Authored-building selection overlay. Clones materials; does not mutate GLB assets.
 * Outline is a thin neon-white silhouette of this GLB, not an amber fill and not a second building mesh. */

import {
  Box3,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Vector3,
  type Material,
} from "three"
import { SELECT_EMISSIVE } from "./islandConfig.js"
import type { IslandObjectProjection } from "./frame.js"
import { authoredObjectId } from "./islandPlant.js"

const TWO = 1 + 1
const EIGHT = TWO * TWO * TWO
const TWELVE = EIGHT + TWO * TWO
const EDGE_DEG = TWO * TWELVE
const RIM_POW = "2.8"
const RIM_GAIN = "1.55"

export type SelectionSlot = {
  readonly mesh: Mesh
  readonly original: Material | Material[]
  readonly clones: readonly Material[]
  readonly outline: LineSegments | undefined
}

export type BuildingSelection = {
  objectId: string
  slots: SelectionSlot[]
}

const _box = new Box3()
const _center = new Vector3()
const _pt = new Vector3()
const _white = new Color(SELECT_EMISSIVE)

function hiddenProjection(): IslandObjectProjection {
  return { x: 0, y: 0, width: 0, height: 0, visible: false }
}

export function emptyBuildingSelection(): BuildingSelection {
  return { objectId: "", slots: [] }
}

export function meshObjectId(obj: Object3D): string {
  const tagged = obj.userData["objectId"]
  if (typeof tagged === "string" && tagged.length > 0) return tagged
  const packRaw = obj.userData["packId"]
  const slugRaw = obj.userData["slug"]
  const packId = typeof packRaw === "string" ? packRaw : ""
  const slug = typeof slugRaw === "string" ? slugRaw : ""
  return authoredObjectId(packId, slug)
}

export function buildingMatchesId(obj: Object3D, objectId: string): boolean {
  if (objectId.length === 0) return false
  if (meshObjectId(obj) === objectId) return true
  const packRaw = obj.userData["packId"]
  const slugRaw = obj.userData["slug"]
  const packId = typeof packRaw === "string" ? packRaw : ""
  const slug = typeof slugRaw === "string" ? slugRaw : ""
  return packId === objectId || slug === objectId
}

export function findBuildingRoot(roots: readonly object[], objectId: string): Object3D | undefined {
  if (objectId.length === 0) return undefined
  let i = 0
  while (i < roots.length) {
    const raw = roots[i]
    i += 1
    if (!(raw instanceof Object3D)) continue
    if (buildingMatchesId(raw, objectId)) return raw
    let found: Object3D | undefined
    raw.traverse((obj) => {
      if (found !== undefined) return
      if (buildingMatchesId(obj, objectId)) found = raw
    })
    if (found !== undefined) return found
  }
  return undefined
}

function paintSelect(clone: MeshStandardMaterial): void {
  clone.customProgramCacheKey = () => "hud-select-rim"
  clone.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      [
        "vec3 hudN = normalize(vNormal);",
        `float hudRim = pow(1.0 - abs(dot(normalize(vViewPosition), hudN)), ${RIM_POW});`,
        `gl_FragColor.rgb += vec3(1.0) * hudRim * ${RIM_GAIN};`,
        "#include <dithering_fragment>",
      ].join("\n"),
    )
  }
  clone.needsUpdate = true
}

function outlineOf(mesh: Mesh): LineSegments | undefined {
  const geom = mesh.geometry
  if (geom === undefined) return undefined
  const edges = new EdgesGeometry(geom, EDGE_DEG)
  const mat = new LineBasicMaterial({
    color: _white,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
  const line = new LineSegments(edges, mat)
  line.raycast = () => undefined
  mesh.add(line)
  return line
}

function dropOutline(mesh: Mesh, outline: LineSegments | undefined): void {
  if (outline === undefined) return
  mesh.remove(outline)
  outline.geometry.dispose()
  outline.material.dispose()
}

export function clearBuildingSelection(state: BuildingSelection): void {
  let i = 0
  while (i < state.slots.length) {
    const slot = state.slots[i]
    i += 1
    if (slot === undefined) continue
    slot.mesh.material = slot.original
    dropOutline(slot.mesh, slot.outline)
    let c = 0
    while (c < slot.clones.length) {
      const mat = slot.clones[c]
      c += 1
      if (mat === undefined) continue
      mat.dispose()
    }
  }
  state.objectId = ""
  state.slots = []
}

export function applyBuildingSelection(state: BuildingSelection, root: Object3D, objectId: string): void {
  clearBuildingSelection(state)
  if (objectId.length === 0) return
  const slots: SelectionSlot[] = []
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    const raw = obj.material
    const list = Array.isArray(raw) ? raw : [raw]
    const next: Material[] = []
    const clones: Material[] = []
    let m = 0
    while (m < list.length) {
      const mat = list[m]
      m += 1
      if (mat === undefined) continue
      if (!(mat instanceof MeshStandardMaterial)) {
        next.push(mat)
        continue
      }
      const clone = mat.clone()
      paintSelect(clone)
      clones.push(clone)
      next.push(clone)
    }
    const first = next[0]
    if (first === undefined) return
    if (clones.length > 0) obj.material = next.length === 1 ? first : next
    slots.push({ mesh: obj, original: raw, clones, outline: outlineOf(obj) })
  })
  state.objectId = objectId
  state.slots = slots
}

export function projectBuilding(
  root: Object3D,
  camera: PerspectiveCamera,
  width: number,
  height: number,
): IslandObjectProjection {
  if (width <= 0 || height <= 0) return hiddenProjection()
  camera.updateMatrixWorld()
  root.updateMatrixWorld(true)
  _box.setFromObject(root)
  if (_box.isEmpty()) return hiddenProjection()
  _box.getCenter(_center)
  _center.project(camera)
  const x = ((_center.x + 1) / TWO) * width
  const y = ((1 - _center.y) / TWO) * height
  const one = 1
  const visible =
    _center.x >= -one &&
    _center.x <= one &&
    _center.y >= -one &&
    _center.y <= one &&
    _center.z >= -one &&
    _center.z <= one
  let minSx = x
  let maxSx = x
  let minSy = y
  let maxSy = y
  const xs = [_box.min.x, _box.max.x]
  const ys = [_box.min.y, _box.max.y]
  const zs = [_box.min.z, _box.max.z]
  for (const wx of xs) {
    for (const wy of ys) {
      for (const wz of zs) {
        _pt.set(wx, wy, wz).project(camera)
        const sx = ((_pt.x + 1) / TWO) * width
        const sy = ((1 - _pt.y) / TWO) * height
        if (sx < minSx) minSx = sx
        if (sx > maxSx) maxSx = sx
        if (sy < minSy) minSy = sy
        if (sy > maxSy) maxSy = sy
      }
    }
  }
  const boxW = maxSx - minSx
  const boxH = maxSy - minSy
  const onScreen = maxSx > 0 && minSx < width && maxSy > 0 && minSy < height
  return {
    x,
    y,
    width: boxW > 0 ? boxW : 0,
    height: boxH > 0 ? boxH : 0,
    visible: visible || onScreen,
  }
}
