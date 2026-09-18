/** Cheap contact discs under buildings and trees. Not SSAO. Clipped to the deck. */

import {
  Box3,
  CircleGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  Vector3,
} from "three"
import type { Intersection, Object3D } from "three"
import { clipRadiusWithTest, isDeckSample } from "./contactClip.js"

const RAY_LIFT = 40
const RAY_FAR = 48

const _box = new Box3()
const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _mat = new Matrix4()
const _tilt = new Vector3(1, 0, 0)
const _origin = new Vector3()
const _down = new Vector3(0, -1, 0)
const _worldN = new Vector3()
const _ray = new Raycaster()

/** Geometric triangle cosine. Vertex-smoothed cliff rims still look "up" and would leak. */
function hitDeckNormalY(hit: Intersection): number {
  if (hit.face !== undefined) {
    _worldN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
    if (_worldN.dot(_down) > 0) _worldN.multiplyScalar(-1)
    return _worldN.y
  }
  if (hit.normal !== undefined) return hit.normal.y
  return 0
}

function skipRaycast(): void {
  return
}

function isContactHost(node: Object3D): boolean {
  const kind = String(node.userData.kind ?? "")
  const ref = String(node.userData.ref ?? "")
  if (kind === "building") return true
  if (kind !== "decor") return false
  return ref.startsWith("Tree_") || ref.startsWith("tree_")
}

function onDeck(ground: Object3D, x: number, z: number, deckY: number): boolean {
  _origin.set(x, deckY + RAY_LIFT, z)
  _ray.set(_origin, _down)
  _ray.near = 0
  _ray.far = RAY_FAR
  const hits = _ray.intersectObject(ground, true)
  const hit = hits[0]
  if (hit === undefined) return false
  return isDeckSample(hit.point.y, hitDeckNormalY(hit), deckY)
}

/** Shrink a disc so its rim stays on the island top. Off-deck hosts become 0. */
export function clipContactRadius(
  ground: Object3D,
  x: number,
  z: number,
  deckY: number,
  want: number,
): number {
  return clipRadiusWithTest((px, pz) => onDeck(ground, px, pz, deckY), x, z, want)
}

export function buildContactOcclusion(
  hosts: readonly Object3D[],
  deckY: number,
  ground: Object3D | null = null,
): InstancedMesh | null {
  const rows: Object3D[] = []
  for (const node of hosts) {
    if (isContactHost(node)) rows.push(node)
  }
  if (rows.length === 0) return null
  const geo = new CircleGeometry(1, 20)
  const mat = new MeshBasicMaterial({
    color: new Color(0x1c1814),
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    fog: true,
    side: DoubleSide,
    toneMapped: false,
  })
  const mesh = new InstancedMesh(geo, mat, rows.length)
  mesh.name = "contact_ao"
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  mesh.raycast = skipRaycast
  _quat.setFromAxisAngle(_tilt, Math.PI * -0.5)
  let i = 0
  let live = 0
  while (i < rows.length) {
    const node = rows[i]
    i += 1
    if (node === undefined) continue
    _box.setFromObject(node)
    const sx = Math.max(_box.max.x - _box.min.x, 0.4)
    const sz = Math.max(_box.max.z - _box.min.z, 0.4)
    const want = Math.max(sx, sz) * 0.48
    const x = node.position.x
    const z = node.position.z
    const r = ground === null ? want : clipContactRadius(ground, x, z, deckY, want)
    if (r <= 0) continue
    _pos.set(x, deckY + 0.045, z)
    _scale.set(r, r, 1)
    _mat.compose(_pos, _quat, _scale)
    mesh.setMatrixAt(live, _mat)
    live += 1
  }
  if (live === 0) {
    geo.dispose()
    mat.dispose()
    return null
  }
  mesh.count = live
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

export function disposeContactOcclusion(mesh: InstancedMesh): void {
  mesh.geometry.dispose()
  const mat = mesh.material
  if (!Array.isArray(mat)) mat.dispose()
}
