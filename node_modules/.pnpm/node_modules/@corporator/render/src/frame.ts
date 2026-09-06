import type { TileHit } from "./camera.js"

/** Shared GPU island handle. Pixi archive implements setCamera; v3 implements setOrbit. */
export type IslandHandle = {
  readonly code: string
  setCityTime(cityTime: bigint): void
  setCamera(tileX: bigint, tileY: bigint, zoomNum: bigint, zoomDen: bigint): void
  setOrbit(azimuthBps: bigint, tiltBps: bigint, distance: bigint): void
  hitAt(sx: bigint, sy: bigint): TileHit
  destroy(): void
}

export function emptyHit(): TileHit {
  return { tileX: 0n, tileY: 0n, objectId: "", kind: "", cell: "" }
}

export function emptyHandle(code: string): IslandHandle {
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
    hitAt(sx: bigint, sy: bigint): TileHit {
      void sx
      void sy
      return emptyHit()
    },
    destroy(): void {},
  }
}
