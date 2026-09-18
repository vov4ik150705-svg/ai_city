/** Plant the frozen Terra look: grounded prototypes at world poses, mass scaled like the studio. */

import {
  Box3,
  DoubleSide,
  Group,
  Mesh,
  Object3D,
  Raycaster,
  Vector3,
} from "three"
import type { Material, MeshStandardMaterial } from "three"
import { applyIslandMaterials } from "./islandMaterials.js"
import type { OccupiedPlant } from "./islandPlant.js"
import { tagBuilding } from "./islandPlant.js"
import type { IslandLook, IslandLookObject } from "./islandLook.js"
import { applyWaterFlow, setWaterfallWorldBand } from "./islandEnv/waterFlow.js"

const _box = new Box3()
const _ray = new Raycaster()
const _origin = new Vector3()
const _down = new Vector3(0, -1, 0)
const _anchor = new Vector3()
const _local = new Vector3()
const _after = new Vector3()

export type LookBytes = (kind: "building" | "decor", ref: string) => Promise<ArrayBuffer>
export type ParseGlb = (buf: ArrayBuffer) => Promise<Group>

function isWfAttachmentName(name: string): boolean {
  const n = name.toLowerCase().replace(/\s+/g, "_")
  return n === "attachments" || n.startsWith("waterfall_attachment_")
}

export function hideWfAttachmentVisuals(root: Object3D): void {
  root.traverse((node) => {
    if (isWfAttachmentName(node.name)) node.visible = false
  })
}

function worldBox(root: Object3D): Box3 {
  _box.setFromObject(root)
  return _box
}

export function groundedPrototype(src: Object3D): Group {
  const root = new Group()
  const inner = src.clone(true)
  root.add(inner)
  const box = worldBox(root)
  if (box.isEmpty()) return root
  inner.position.x += 0 - 0.5 * (box.min.x + box.max.x)
  inner.position.y += 0 - box.min.y
  inner.position.z += 0 - 0.5 * (box.min.z + box.max.z)
  return root
}

function prepareDecor(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    const mats: Material[] = Array.isArray(node.material) ? node.material : [node.material]
    for (const mat of mats) {
      mat.side = DoubleSide
      if (mat.transparent) mat.depthWrite = false
    }
  })
}

export function fitTerraMass(
  island: Object3D,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
): { readonly deckY: number; readonly span: number } {
  island.scale.set(1, 1, 1)
  island.position.set(0, 0, 0)
  island.updateMatrixWorld(true)
  const raw = worldBox(island).clone()
  const nativeSpan = Math.max(raw.max.x - raw.min.x, raw.max.z - raw.min.z, 8)
  const deckX = 0.5 * (raw.min.x + raw.max.x)
  const deckZ = 0.5 * (raw.min.z + raw.max.z)
  let deckY0 = raw.max.y
  _origin.set(deckX, raw.max.y + Math.max(raw.max.y - raw.min.y, nativeSpan, 8), deckZ)
  _ray.set(_origin, _down)
  _ray.near = 0
  _ray.far = nativeSpan * 4
  const hits = _ray.intersectObject(island, true)
  const hit = hits[0]
  if (hit !== undefined) deckY0 = hit.point.y
  _anchor.set(deckX, deckY0, deckZ)
  island.worldToLocal(_local.copy(_anchor))
  island.scale.set(scaleX, scaleY, scaleZ)
  island.updateMatrixWorld(true)
  island.localToWorld(_after.copy(_local))
  island.position.add(_anchor.sub(_after))
  island.updateMatrixWorld(true)
  const afterBox = worldBox(island)
  const span = Math.max(afterBox.max.x - afterBox.min.x, afterBox.max.z - afterBox.min.z, 8)
  setWaterfallWorldBand(
    afterBox.min.y,
    afterBox.min.y - Math.max(afterBox.max.y - afterBox.min.y, span * 0.4),
  )
  return { deckY: deckY0, span }
}

function packIdOf(ref: string): string {
  if (ref === "neon_residence" || ref === "amazon_warehouse") return ""
  return ref
}

function isWaterfallRef(ref: string): boolean {
  const n = ref.toLowerCase()
  return n.startsWith("wf-") || n.includes("waterfall")
}

export async function plantIslandLook(
  look: IslandLook,
  parseGlb: ParseGlb,
  propBytes: LookBytes,
  glow: MeshStandardMaterial[],
  pickMeshes: object[],
  loadError: { current: string },
  joinError: (prev: string, next: string) => string,
): Promise<{ readonly hosts: Object3D[]; readonly placed: Group }> {
  const placed = new Group()
  placed.name = "look_placed"
  const proto = new Map<string, Group>()
  const hosts: Object3D[] = []
  let i = 0
  while (i < look.objects.length) {
    const row = look.objects[i]
    i += 1
    if (row === undefined) continue
    const key = row.kind + ":" + row.ref
    let src = proto.get(key)
    if (src === undefined) {
      let buf: ArrayBuffer
      try {
        buf = await propBytes(row.kind, row.ref)
      } catch (err) {
        loadError.current = joinError(loadError.current, row.ref + ": " + String(err))
        continue
      }
      if (buf.byteLength === 0) {
        loadError.current = joinError(loadError.current, row.ref + ": empty glb")
        continue
      }
      let glb: Group
      try {
        glb = await parseGlb(buf)
      } catch (err) {
        loadError.current = joinError(loadError.current, row.ref + ": " + String(err))
        continue
      }
      hideWfAttachmentVisuals(glb)
      if (row.kind === "decor") prepareDecor(glb)
      applyIslandMaterials(glb, glow)
      if (isWaterfallRef(row.ref)) applyWaterFlow(glb)
      src = groundedPrototype(glb)
      proto.set(key, src)
    }
    const node = src.clone(true)
    node.userData.mapId = row.id
    node.userData.kind = row.kind
    node.userData.ref = row.ref
    node.position.set(row.x, row.y, row.z)
    node.rotation.y = row.yaw
    node.scale.set(row.scale, row.scale, row.scale)
    if (row.kind === "building") {
      const plant: OccupiedPlant = { anchor: "", slug: row.ref, packId: packIdOf(row.ref) }
      tagBuilding(node, plant)
      pickMeshes.push(node)
    }
    placed.add(node)
    hosts.push(node)
  }
  return { hosts, placed }
}

export function lookWaterfallHints(objects: readonly IslandLookObject[]): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  for (const row of objects) {
    if (row.kind !== "decor") continue
    if (!isWaterfallRef(row.ref)) continue
    out.push({ x: row.x, y: row.y, z: row.z })
  }
  return out
}
