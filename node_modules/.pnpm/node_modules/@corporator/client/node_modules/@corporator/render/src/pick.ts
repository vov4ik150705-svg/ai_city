import type { TileHit } from "./camera.js"
import { emptyHit } from "./frame.js"
import { cellAt } from "./ground.js"
import type { HeroLot } from "./heroes.js"

const WATER = "~"

export function hitPlaneY(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  planeY: number,
): { readonly x: number; readonly z: number } | undefined {
  if (dy === 0) return undefined
  const t = (planeY - oy) / dy
  if (t < 0) return undefined
  return { x: ox + dx * t, z: oz + dz * t }
}

export function snapTile(x: number, z: number): { readonly tileX: bigint; readonly tileY: bigint } {
  const half = 0.5
  return {
    tileX: BigInt(Math.floor(x + half)),
    tileY: BigInt(Math.floor(z + half)),
  }
}

export function heroAtTile(lots: readonly HeroLot[], tx: bigint, ty: bigint): string {
  let i = lots.length
  while (i > 0) {
    i -= 1
    const lot = lots[i]
    if (lot === undefined) continue
    if (tx >= lot.tileX && tx < lot.tileX + lot.spanX && ty >= lot.tileY && ty < lot.tileY + lot.spanZ) {
      return lot.id
    }
  }
  return ""
}

/** HUD chrome swallows the pick; only surface `scene` reaches the island. */
export function hudSurfaceBlocksPick(surface: string): boolean {
  return surface !== "scene"
}

function hitAtCell(
  map: readonly string[],
  lots: readonly HeroLot[],
  tileX: bigint,
  tileY: bigint,
  cell: string,
): TileHit {
  const objectId = heroAtTile(lots, tileX, tileY)
  return {
    tileX,
    tileY,
    objectId,
    kind: objectId.length > 0 ? "building" : "",
    cell,
  }
}

/**
 * Ray vs land (then water) plane → grid tile. Heroes occupy the lot span, not a 1×1 origin.
 * D-V3-15 / WORLD.md §8: the pick hits the legend cell, not an iso diamond.
 */
export function pickFromRay(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  landY: bigint,
  waterY: bigint,
  map: readonly string[],
  lots: readonly HeroLot[],
): TileHit {
  const land = hitPlaneY(ox, oy, oz, dx, dy, dz, Number(landY))
  if (land === undefined) return emptyHit()
  let snapped = snapTile(land.x, land.z)
  let cell = cellAt(map, snapped.tileX, snapped.tileY)
  if (cell === WATER) {
    const water = hitPlaneY(ox, oy, oz, dx, dy, dz, Number(waterY))
    if (water !== undefined) {
      snapped = snapTile(water.x, water.z)
      cell = cellAt(map, snapped.tileX, snapped.tileY)
    }
  }
  return hitAtCell(map, lots, snapped.tileX, snapped.tileY, cell)
}
