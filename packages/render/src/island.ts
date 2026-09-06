import { cellAt, loadScene } from "./ground.js"
import { isShoreWater } from "./water.js"

export type IslandCell = {
  readonly tileX: bigint
  readonly tileY: bigint
  readonly kind: string
  readonly y: bigint
}

export type IslandBox = {
  readonly id: string
  readonly tileX: bigint
  readonly tileY: bigint
}

export type WaterPlane = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly span: number
}

const WATER = "~"
const ONE = 1n

/** XZ cells from generated.placement.scene. Water sits at waterY; land at landY. */
export function islandCells(root: unknown, landY: bigint, waterY: bigint): readonly IslandCell[] {
  const scene = loadScene(root)
  const out: IslandCell[] = []
  let y = 0n
  while (y < BigInt(scene.map.length)) {
    const line = scene.map[Number(y)] ?? ""
    let x = 0n
    while (x < BigInt(line.length)) {
      const ch = cellAt(scene.map, x, y)
      if (ch.length > 0) {
        const isWater = ch === WATER
        out.push({
          tileX: x,
          tileY: y,
          kind: ch,
          y: isWater ? waterY : landY,
        })
      }
      x += 1n
    }
    y += 1n
  }
  return out
}

export function islandBoxes(root: unknown): readonly IslandBox[] {
  const scene = loadScene(root)
  const out: IslandBox[] = []
  for (const row of scene.objects) {
    out.push({ id: row.id, tileX: row.tileX, tileY: row.tileY })
  }
  return out
}

export function islandCenter(gridSize: bigint): { readonly x: bigint; readonly z: bigint } {
  if (gridSize <= 0n) return { x: 0n, z: 0n }
  const last = gridSize - 1n
  const two = ONE + ONE
  return { x: last / two, z: last / two }
}

/** Land tiles only. Water is plantWater plus shoreFoam, not a ~ grid. */
export function landCells(cells: readonly IslandCell[]): readonly IslandCell[] {
  const out: IslandCell[] = []
  for (const cell of cells) {
    if (cell.kind !== WATER) out.push(cell)
  }
  return out
}

/** One sea quad covering the grid. Interior ~ is not a cube per cell. */
export function plantWater(gridSize: bigint, waterY: bigint): WaterPlane {
  const mid = islandCenter(gridSize)
  const span = gridSize <= 0n ? ONE : gridSize
  return {
    x: Number(mid.x),
    y: Number(waterY),
    z: Number(mid.z),
    span: Number(span),
  }
}

/** Orthogonal shore foam only. Deep water stays on the single plane. */
export function shoreFoam(root: unknown, waterY: bigint): readonly IslandCell[] {
  const scene = loadScene(root)
  const out: IslandCell[] = []
  let y = 0n
  while (y < BigInt(scene.map.length)) {
    const line = scene.map[Number(y)] ?? ""
    let x = 0n
    while (x < BigInt(line.length)) {
      if (isShoreWater(scene.map, x, y)) {
        out.push({ tileX: x, tileY: y, kind: WATER, y: waterY })
      }
      x += 1n
    }
    y += 1n
  }
  return out
}
