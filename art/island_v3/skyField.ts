/** Distant graphic sky like the mockup. Not a photo, not volume meshes.
 *  Studio runtime moved to ./environment/. This file is unused. */

import {
  BackSide,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  SphereGeometry,
} from "three"
import type { PerspectiveCamera } from "three"

function skipRaycast(): void {
  return
}

function unit(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function paintCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number): void {
  const blobs = 6
  for (let k = 0; k < blobs; k++) {
    const u = unit(seed, k + 1)
    const v = unit(seed, k + 11)
    const ang = (k / blobs) * Math.PI * 2 + u * 0.4
    const rr = r * (0.38 + v * 0.5)
    const x = cx + Math.cos(ang) * r * (0.42 + u * 0.2)
    const y = cy + Math.sin(ang) * r * (0.22 + v * 0.12)
    ctx.beginPath()
    const sides = 6
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + v
      const px = x + Math.cos(a) * rr
      const py = y + Math.sin(a) * rr * 0.62
      if (s === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = k % 2 === 0 ? "#ffffff" : "#e7f1fa"
    ctx.fill()
  }
}

function paintSky(): CanvasTexture {
  const w = 2048
  const h = 1024
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (ctx === null) throw new Error("sky canvas")
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, "#2b9ee6")
  sky.addColorStop(0.42, "#4eb4f0")
  sky.addColorStop(0.7, "#8fd0f8")
  sky.addColorStop(1, "#d7eefc")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  const haze = ctx.createLinearGradient(0, h * 0.55, 0, h)
  haze.addColorStop(0, "rgba(255,255,255,0)")
  haze.addColorStop(1, "rgba(255,255,255,0.5)")
  ctx.fillStyle = haze
  ctx.fillRect(0, h * 0.55, w, h * 0.45)
  const stamps = 22
  for (let i = 0; i < stamps; i++) {
    const lon = unit(i, 2)
    const yFrac = i < 8 ? 0.1 + unit(i, 3) * 0.22 : 0.62 + unit(i, 4) * 0.28
    const x = lon * w
    const y = yFrac * h
    const r = (80 + unit(i, 5) * 140) * (i < 8 ? 0.75 : 1.2)
    paintCloud(ctx, x, y, r, i * 17)
    if (x < r) paintCloud(ctx, x + w, y, r, i * 17)
    if (x > w - r) paintCloud(ctx, x - w, y, r, i * 17)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function makeDome(map: CanvasTexture): Mesh {
  const geo = new SphereGeometry(900, 48, 28)
  const mat = new MeshBasicMaterial({
    map,
    side: BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
  const mesh = new Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -20
  mesh.userData.skyDome = true
  mesh.raycast = skipRaycast
  return mesh
}

export function buildSkyField(): Group {
  const root = new Group()
  root.name = "sky_field"
  root.add(makeDome(paintSky()))
  return root
}

export function tickSkyField(root: Group | null, camera: PerspectiveCamera): void {
  if (root === null || root.visible === false) return
  root.position.copy(camera.position)
}

export function disposeSkyField(root: Group): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    if (node.userData.skyDome !== true) return
    node.geometry.dispose()
    const mat = node.material
    if (mat instanceof MeshBasicMaterial) {
      mat.map?.dispose()
      mat.dispose()
    }
  })
}
