/** Authored-building selection overlay. Clones materials; does not mutate GLB assets. */

import {
  Box3,
  Color,
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
const KEEP = 0.65
const ADD = 0.35
const MIN_GLOW = 0.4

export type SelectionSlot = {
  readonly mesh: Mesh
  readonly original: Material | Material[]
  readonly clones: readonly Material[]
}

export type BuildingSelection = {
  objectId: string
  slots: SelectionSlot[]
}

const _box = new Box3()
const _center = new Vector3()
const _amber = new Color(SELECT_EMISSIVE)

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

function paintSelect(clone: MeshStandardMaterial, base: MeshStandardMaterial): void {
  clone.emissive.setRGB(
    base.emissive.r * KEEP + _amber.r * ADD,
    base.emissive.g * KEEP + _amber.g * ADD,
    base.emissive.b * KEEP + _amber.b * ADD,
  )
  clone.emissiveIntensity = base.emissiveIntensity > MIN_GLOW ? base.emissiveIntensity : MIN_GLOW
}

export function clearBuildingSelection(state: BuildingSelection): void {
  let i = 0
  while (i < state.slots.length) {
    const slot = state.slots[i]
    i += 1
    if (slot === undefined) continue
    slot.mesh.material = slot.original
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
      paintSelect(clone, mat)
      clones.push(clone)
      next.push(clone)
    }
    const first = next[0]
    if (first === undefined || clones.length === 0) return
    slots.push({ mesh: obj, original: raw, clones })
    obj.material = next.length === 1 ? first : next
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
  if (width <= 0 || height <= 0) return { x: 0, y: 0, visible: false }
  camera.updateMatrixWorld()
  root.updateMatrixWorld(true)
  _box.setFromObject(root)
  if (_box.isEmpty()) return { x: 0, y: 0, visible: false }
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
  return { x, y, visible }
}
