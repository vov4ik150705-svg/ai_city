import type { TileHit } from "./camera.js"
import type { LookFrame, LookPoint } from "./lookPan.js"
import {
  HERO_AZIMUTH_DEG,
  HERO_ELEVATION_DEG,
  HERO_FOV_DEG,
  RENDERER_REVISION,
  WORLD_EXPOSURE,
  WORLD_HEMI_GROUND,
  WORLD_HEMI_SKY,
} from "./islandConfig.js"
import type { IslandCaptureMeta } from "./islandCapture.js"
import type { OccupancyMode } from "./islandOccupancy.js"

/** Canvas-space projection of an authored building. Coordinates are CSS pixels on the host canvas.
 * `x`/`y` are the mesh center; `width`/`height` are the projected AABB so HUD chrome can sit beside it. */
export type IslandObjectProjection = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly visible: boolean
}

/** Shared GPU island handle. Pixi archive implements setCamera; v3 implements setOrbit. */
export type IslandHandle = {
  readonly code: string
  setCityTime(cityTime: bigint): void
  setCamera(tileX: bigint, tileY: bigint, zoomNum: bigint, zoomDen: bigint): void
  setOrbit(azimuthBps: bigint, tiltBps: bigint, distance: bigint): void
  /** Slide the orbit look point on the ground. Height stays at the home point. */
  setLookAt(x: number, z: number): void
  lookFrame(): LookFrame | undefined
  objectGround(objectId: string): LookPoint | undefined
  /** View follows the drag across the look plane. Returns the look-point delta. */
  slideGround(fromX: number, fromY: number, toX: number, toY: number): LookPoint | undefined
  hitAt(sx: bigint, sy: bigint): TileHit
  selectObject(objectId: string): void
  projectObject(objectId: string): IslandObjectProjection | undefined
  captureMeta(): IslandCaptureMeta
  destroy(): void
}

export function emptyHit(): TileHit {
  return { tileX: 0n, tileY: 0n, objectId: "", kind: "", cell: "" }
}

function emptyMeta(code: string): IslandCaptureMeta {
  return {
    rendererRevision: RENDERER_REVISION,
    occupancyMode: "production",
    cityPhase: "",
    cityTime: null,
    exposure: WORLD_EXPOSURE,
    toneMapping: "ACESFilmic",
    colorSpace: "srgb",
    dpr: 1,
    antialias: false,
    fillSky: WORLD_HEMI_SKY,
    fillGround: WORLD_HEMI_GROUND,
    meshopt: false,
    loadError: code,
    camera: {
      fovDeg: HERO_FOV_DEG,
      azimuthDeg: HERO_AZIMUTH_DEG,
      elevationDeg: HERO_ELEVATION_DEG,
      distance: 0,
      target: { x: 0, y: 0, z: 0 },
      near: 1,
      far: 1,
      aspect: 1,
      widthFill: 0,
    },
  }
}

export function emptyHandle(code: string): IslandHandle {
  const meta = emptyMeta(code)
  return {
    code,
    setCityTime(cityTime: bigint): void {
      void cityTime
    },
    setCamera(tileX: bigint, tileY: bigint, zoomNum: bigint, zoomDen: bigint): void {
      void tileX
      void tileY
      void zoomNum
      void zoomDen
    },
    setOrbit(azimuthBps: bigint, tiltBps: bigint, distance: bigint): void {
      void azimuthBps
      void tiltBps
      void distance
    },
    setLookAt(x: number, z: number): void {
      void x
      void z
    },
    lookFrame(): LookFrame | undefined {
      return undefined
    },
    objectGround(objectId: string): LookPoint | undefined {
      void objectId
      return undefined
    },
    slideGround(fromX: number, fromY: number, toX: number, toY: number): LookPoint | undefined {
      void fromX
      void fromY
      void toX
      void toY
      return undefined
    },
    hitAt(sx: bigint, sy: bigint): TileHit {
      void sx
      void sy
      return emptyHit()
    },
    selectObject(objectId: string): void {
      void objectId
    },
    projectObject(objectId: string): IslandObjectProjection | undefined {
      void objectId
      return undefined
    },
    captureMeta(): IslandCaptureMeta {
      return meta
    },
    destroy(): void {},
  }
}

export type { OccupancyMode }
