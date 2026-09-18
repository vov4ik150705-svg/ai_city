import { Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three"

export type AnchorPose = {
  readonly name: string
  readonly position: Vector3
  readonly quaternion: Quaternion
}

export type OccupiedPlant = {
  readonly anchor: string
  readonly slug: string
  readonly packId: string
}

const ANCHOR_PREFIX = "anchor_"

export function collectAnchors(root: Group): { readonly [name: string]: AnchorPose } {
  const out: { [name: string]: AnchorPose } = {}
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const named = obj as Group
    if (!named.name.startsWith(ANCHOR_PREFIX)) return
    const position = new Vector3()
    const quaternion = new Quaternion()
    const scale = new Vector3()
    named.matrixWorld.decompose(position, quaternion, scale)
    out[named.name] = { name: named.name, position, quaternion }
    named.visible = false
  })
  return out
}

export function applyAnchorPose(root: Group, pose: AnchorPose): void {
  root.position.copy(pose.position)
  root.quaternion.copy(pose.quaternion)
  root.scale.set(1, 1, 1)
}

export function authoredObjectId(packId: string, slug: string): string {
  return packId.length > 0 ? packId : slug
}

export function tagBuilding(root: Group, plant: OccupiedPlant): void {
  const objectId = authoredObjectId(plant.packId, plant.slug)
  root.userData["islandKind"] = "building"
  root.userData["slug"] = plant.slug
  root.userData["packId"] = plant.packId
  root.userData["objectId"] = objectId
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    obj.userData["islandKind"] = "building"
    obj.userData["slug"] = plant.slug
    obj.userData["packId"] = plant.packId
    obj.userData["objectId"] = objectId
  })
}

export function collectGlow(root: Group, into: MeshStandardMaterial[]): void {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    const raw = obj.material
    const list = Array.isArray(raw) ? raw : [raw]
    for (const mat of list) {
      if (!(mat instanceof MeshStandardMaterial)) continue
      if (mat.emissive.getHex() === 0) continue
      into.push(mat)
    }
  })
}

export function pickObjectId(
  hits: readonly { readonly object: Mesh }[],
): { readonly objectId: string; readonly kind: string } {
  let i = 0
  while (i < hits.length) {
    const hit = hits[i]
    i += 1
    if (hit === undefined) continue
    if (hit.object.userData["islandKind"] !== "building") continue
    const packRaw = hit.object.userData["packId"]
    const slugRaw = hit.object.userData["slug"]
    const packId = typeof packRaw === "string" ? packRaw : ""
    const slug = typeof slugRaw === "string" ? slugRaw : ""
    const objectId = authoredObjectId(packId, slug)
    if (objectId.length === 0) continue
    return { objectId, kind: "building" }
  }
  return { objectId: "", kind: "" }
}
