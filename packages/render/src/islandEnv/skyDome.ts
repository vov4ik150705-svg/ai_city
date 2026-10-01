/** Gradient sky dome. Nadir stays blue — no white disc. */

import {
  BackSide,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  SphereGeometry,
} from "three"
import {
  NINE_HUNDRED,
  NEG_HUNDRED,
  ONE_TWENTY_EIGHT,
  SIX,
  SIXTEEN,
  TWELVE,
  TWENTY_FOUR,
  TWO_FIFTY_SIX,
} from "../literals.js"

export const SKY_DOME_RADIUS = NINE_HUNDRED

function skipRaycast(): void {
  return
}

function hex(n: number): string {
  return "#" + n.toString(SIXTEEN).padStart(SIX, "0")
}

function paintSky(zenith: number, horizon: number, nadir: number): CanvasTexture {
  const w = TWO_FIFTY_SIX
  const h = ONE_TWENTY_EIGHT
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (ctx === null) throw new Error("sky canvas")
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, hex(zenith))
  g.addColorStop(0.44, hex(horizon))
  g.addColorStop(1, hex(nadir))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function makeSkyDome(zenith: number, horizon: number, nadir: number): Mesh {
  const map = paintSky(zenith, horizon, nadir)
  const geo = new SphereGeometry(SKY_DOME_RADIUS, TWENTY_FOUR, TWELVE)
  const mat = new MeshBasicMaterial({
    map,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
  const mesh = new Mesh(geo, mat)
  mesh.name = "sky_dome"
  mesh.frustumCulled = false
  mesh.renderOrder = NEG_HUNDRED
  mesh.userData.skyDome = true
  mesh.raycast = skipRaycast
  return mesh
}
