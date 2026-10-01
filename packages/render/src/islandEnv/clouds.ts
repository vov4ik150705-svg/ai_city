/** Instanced low-poly cloud families. Authored poses, not RNG. */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { Box3, Material } from "three"
import {
  SKY_CLOUD_FILES,
  type CloudPose,
  type SkyEnvironmentConfig,
  type WorldCloudHint,
} from "./config.js"
import { THREE, TWO } from "../literals.js"

const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _mat = new Matrix4()
const _up = new Vector3(0, 1, 0)

function skipRaycast(): void {
  return
}

function fallbackGeo(): BufferGeometry {
  const a = new IcosahedronGeometry(0.7, 0)
  const b = new IcosahedronGeometry(0.55, 0)
  b.translate(0.45, 0.05, 0.1)
  const c = new IcosahedronGeometry(0.5, 0)
  c.translate(-0.4, -0.02, 0.15)
  const merged = mergeGeometries([a, b, c], false)
  a.dispose()
  b.dispose()
  c.dispose()
  if (merged === null) return new IcosahedronGeometry(1, 0)
  return merged
}

function compactWorldGeo(src: BufferGeometry, world: Mesh): BufferGeometry {
  const g = src.clone()
  g.applyMatrix4(world.matrixWorld)
  const out = new BufferGeometry()
  const pos = g.getAttribute("position")
  if (pos === undefined) {
    g.dispose()
    return fallbackGeo()
  }
  out.setAttribute("position", pos.clone())
  const nrm = g.getAttribute("normal")
  if (nrm !== undefined) out.setAttribute("normal", nrm.clone())
  else out.computeVertexNormals()
  const col = g.getAttribute("color")
  if (col !== undefined) out.setAttribute("color", col.clone())
  const idx = g.getIndex()
  if (idx !== null) out.setIndex(idx.clone())
  g.dispose()
  flattenVertexColor(out)
  return out
}

function flattenVertexColor(geo: BufferGeometry): void {
  const col = geo.getAttribute("color")
  if (col === undefined || col.itemSize === THREE) return
  const rgb = new Float32Array(col.count * THREE)
  for (let i = 0; i < col.count; i++) {
    rgb[i * THREE] = col.getX(i)
    rgb[i * THREE + 1] = col.getY(i)
    rgb[i * THREE + TWO] = col.getZ(i)
  }
  geo.setAttribute("color", new BufferAttribute(rgb, THREE))
}

/** GLB clouds bake gray-blue facet shade. Lift toward white; keep a hint of form. */
const CLOUD_VERTEX_LIFT = 0.86

function bleachCloudColor(geo: BufferGeometry): void {
  const col = geo.getAttribute("color")
  if (col === undefined) return
  const rgb = new Float32Array(col.count * THREE)
  const keep = 1 - CLOUD_VERTEX_LIFT
  for (let i = 0; i < col.count; i++) {
    rgb[i * THREE] = CLOUD_VERTEX_LIFT + col.getX(i) * keep
    rgb[i * THREE + 1] = CLOUD_VERTEX_LIFT + col.getY(i) * keep
    rgb[i * THREE + TWO] = CLOUD_VERTEX_LIFT + col.getZ(i) * keep
  }
  geo.setAttribute("color", new BufferAttribute(rgb, THREE))
}

function meshGeo(root: Group): BufferGeometry {
  const pieces: BufferGeometry[] = []
  root.updateMatrixWorld(true)
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    if (node.geometry.getAttribute("position") === undefined) return
    pieces.push(compactWorldGeo(node.geometry, node))
  })
  if (pieces.length === 0) return fallbackGeo()
  const merged = mergeGeometries(pieces, false)
  for (const g of pieces) g.dispose()
  if (merged === null) return fallbackGeo()
  merged.computeVertexNormals()
  merged.center()
  merged.computeBoundingBox()
  const box = merged.boundingBox
  if (box !== null) {
    const sx = Math.max(box.max.x - box.min.x, 0.001)
    const sy = Math.max(box.max.y - box.min.y, 0.001)
    const sz = Math.max(box.max.z - box.min.z, 0.001)
    const m = 1 / Math.max(sx, sy, sz)
    merged.scale(m, m, m)
  }
  if (merged.getAttribute("color") !== undefined) flattenVertexColor(merged)
  if (merged.getAttribute("color") === undefined) {
    const pos = merged.getAttribute("position")
    if (pos !== undefined) {
      const fill = new Float32Array(pos.count * THREE)
      fill.fill(1)
      merged.setAttribute("color", new BufferAttribute(fill, THREE))
    }
  }
  bleachCloudColor(merged)
  return merged
}

function cloudMat(): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({
    color: new Color(0xffffff),
    vertexColors: true,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
    fog: true,
    toneMapped: false,
  })
  return mat
}

function disposeCloudSource(root: Group): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    node.geometry.dispose()
    const raw = node.material
    const mats = Array.isArray(raw) ? raw : [raw]
    for (const mat of mats) {
      if ("map" in mat && mat.map !== null && mat.map !== undefined && "dispose" in mat.map) {
        mat.map.dispose()
      }
      mat.dispose()
    }
  })
}

const FALL_OFFSETS: readonly {
  readonly dx: number
  readonly dz: number
  readonly dy: number
  readonly s: number
  readonly yaw: number
  readonly family: number
}[] = [
  { dx: 0.0, dz: 0.0, dy: -0.01, s: 0.22, yaw: 0.4, family: 0 },
  { dx: 0.05, dz: 0.04, dy: 0.02, s: 0.16, yaw: 1.8, family: 1 },
]

function fallsFromHints(hints: readonly WorldCloudHint[], box: Box3, span: number): CloudPose[] {
  if (span <= 0) return []
  const cx = 0.5 * (box.min.x + box.max.x)
  const cz = 0.5 * (box.min.z + box.max.z)
  const out: CloudPose[] = []
  for (const hint of hints) {
    const nx = (hint.x - cx) / span
    const nz = (hint.z - cz) / span
    const ny = (hint.y - box.min.y) / span
    for (const off of FALL_OFFSETS) {
      out.push({
        layer: "falls",
        family: off.family,
        x: nx + off.dx,
        y: ny + off.dy,
        z: nz + off.dz,
        s: off.s,
        yaw: off.yaw,
      })
    }
  }
  return out
}

function pickPoses(cfg: SkyEnvironmentConfig, extra: readonly CloudPose[]): CloudPose[] {
  const density = Math.min(1, Math.max(0, cfg.cloudDensity))
  const byLayer: Record<CloudPose["layer"], CloudPose[]> = { distant: [], below: [], falls: [] }
  for (const pose of cfg.poses) byLayer[pose.layer].push(pose)
  for (const pose of extra) byLayer[pose.layer].push(pose)
  const out: CloudPose[] = []
  for (const layer of ["distant", "below", "falls"] as const) {
    const rows = byLayer[layer]
    const n = Math.max(0, Math.round(rows.length * density))
    for (let i = 0; i < n; i++) {
      const row = rows[i]
      if (row !== undefined) out.push(row)
    }
  }
  return out
}

function ensureVertexColors(geo: BufferGeometry): void {
  if (geo.getAttribute("color") !== undefined) return
  const pos = geo.getAttribute("position")
  if (pos === undefined) return
  const fill = new Float32Array(pos.count * THREE)
  fill.fill(1)
  geo.setAttribute("color", new BufferAttribute(fill, THREE))
}

export async function buildCloudLayer(
  loadGlb: (url: string) => Promise<Group>,
  box: Box3,
  span: number,
  cfg: SkyEnvironmentConfig,
  falls: readonly WorldCloudHint[] = [],
): Promise<Group> {
  const root = new Group()
  root.name = "sky_clouds"
  const geos: BufferGeometry[] = []
  for (let i = 0; i < SKY_CLOUD_FILES.length; i++) {
    const file = SKY_CLOUD_FILES[i]
    if (file === undefined) {
      geos.push(fallbackGeo())
      continue
    }
    try {
      const glb = await loadGlb("/decoration/" + encodeURIComponent(file))
      try {
        geos.push(meshGeo(glb))
      } finally {
        disposeCloudSource(glb)
      }
    } catch {
      geos.push(fallbackGeo())
    }
    await new Promise<void>((resolve) => {
      globalThis.requestAnimationFrame(() => resolve())
    })
  }
  const poses = pickPoses(cfg, fallsFromHints(falls, box, span))
  const cx = 0.5 * (box.min.x + box.max.x)
  const cz = 0.5 * (box.min.z + box.max.z)
  const mat = cloudMat()
  for (let f = 0; f < geos.length; f++) {
    const geo = geos[f]
    if (geo === undefined) continue
    ensureVertexColors(geo)
    const rows = poses.filter((p) => p.family === f)
    if (rows.length === 0) {
      geo.dispose()
      continue
    }
    const mesh = new InstancedMesh(geo, mat, rows.length)
    mesh.name = "clouds_" + String(f)
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.raycast = skipRaycast
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i]
      if (p === undefined) continue
      const y0 = p.layer === "distant" ? box.max.y : box.min.y
      _pos.set(cx + p.x * span, y0 + p.y * span, cz + p.z * span)
      _quat.setFromAxisAngle(_up, p.yaw)
      const s = p.s * span * cfg.cloudScale
      const sy = p.layer === "below" ? s * 0.42 : p.layer === "falls" ? s * 0.4 : s * 0.5
      _scale.set(s, sy, s)
      _mat.compose(_pos, _quat, _scale)
      mesh.setMatrixAt(i, _mat)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.frustumCulled = true
    root.add(mesh)
  }
  return root
}

export function disposeClouds(root: Group): void {
  const seen = new Set<Material>()
  root.traverse((node) => {
    if (!(node instanceof InstancedMesh)) return
    node.geometry.dispose()
    const mat = node.material
    if (Array.isArray(mat)) return
    if (seen.has(mat)) return
    seen.add(mat)
    mat.dispose()
  })
}
