import type { OccupancyMode } from "./islandOccupancy.js"
import type { Vec3 } from "./islandCamera.js"

export type IslandCaptureMeta = {
  readonly rendererRevision: string
  readonly occupancyMode: OccupancyMode
  readonly cityPhase: string
  readonly cityTime: number | null
  readonly exposure: number
  readonly toneMapping: string
  readonly colorSpace: string
  readonly dpr: number
  readonly antialias: boolean
  readonly fillSky: number
  readonly fillGround: number
  readonly meshopt: boolean
  readonly loadError: string
  readonly camera: {
    readonly fovDeg: number
    readonly azimuthDeg: number
    readonly elevationDeg: number
    readonly distance: number
    readonly target: Vec3
    readonly near: number
    readonly far: number
    readonly aspect: number
    readonly widthFill: number
  }
}

export function parityMismatch(a: IslandCaptureMeta, b: IslandCaptureMeta): readonly string[] {
  const out: string[] = []
  if (a.rendererRevision !== b.rendererRevision) out.push("rendererRevision")
  if (a.occupancyMode !== b.occupancyMode) out.push("occupancyMode")
  if (a.cityPhase !== b.cityPhase) out.push("cityPhase")
  if (a.exposure !== b.exposure) out.push("exposure")
  if (a.toneMapping !== b.toneMapping) out.push("toneMapping")
  if (a.colorSpace !== b.colorSpace) out.push("colorSpace")
  if (a.antialias !== b.antialias) out.push("antialias")
  if (a.fillSky !== b.fillSky) out.push("fillSky")
  if (a.fillGround !== b.fillGround) out.push("fillGround")
  if (a.meshopt !== b.meshopt) out.push("meshopt")
  if (a.camera.fovDeg !== b.camera.fovDeg) out.push("fov")
  if (a.camera.azimuthDeg !== b.camera.azimuthDeg) out.push("azimuth")
  if (a.camera.elevationDeg !== b.camera.elevationDeg) out.push("elevation")
  if (a.camera.distance !== b.camera.distance) out.push("distance")
  if (a.camera.target.x !== b.camera.target.x) out.push("targetX")
  if (a.camera.target.y !== b.camera.target.y) out.push("targetY")
  if (a.camera.target.z !== b.camera.target.z) out.push("targetZ")
  return out
}
