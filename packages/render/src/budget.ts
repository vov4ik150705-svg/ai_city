import { staticDrawCalls } from "./chunk.js"

export type VisualCaps = {
  readonly drawCallsMax: bigint
  readonly spriteInstancesMax: bigint
  readonly atlasMaxBytes: bigint
  readonly textureBytesMax: bigint
  readonly bundleMaxBytes: bigint
}

export type VisualObserved = {
  readonly drawCalls: bigint
  readonly sprites: bigint
  readonly atlasBytes: bigint
  readonly textureBytes: bigint
  readonly bundleBytes: bigint
}

export type ObserveArgs = {
  readonly grid: bigint
  readonly chunkTiles: bigint
  readonly sprites: bigint
  readonly atlasBytes: bigint
  readonly pagePx: bigint
  readonly colorPages: bigint
  readonly glowPages: bigint
  readonly bundleBytes: bigint
}

/** Measured picture budgets. Callers pass file sizes and pack-derived sizes; caps stay outside. */
export function observeVisualBudgets(args: ObserveArgs): VisualObserved {
  const rgba = 1n + 1n + 1n + 1n
  const pageArea = args.pagePx * args.pagePx
  return {
    drawCalls: staticDrawCalls(args.grid, args.chunkTiles),
    sprites: args.sprites,
    atlasBytes: args.atlasBytes,
    textureBytes: pageArea * rgba * args.colorPages + pageArea * args.glowPages,
    bundleBytes: args.bundleBytes,
  }
}

export function underVisualCaps(obs: VisualObserved, caps: VisualCaps): boolean {
  if (obs.drawCalls > caps.drawCallsMax) return false
  if (obs.sprites > caps.spriteInstancesMax) return false
  if (obs.atlasBytes > caps.atlasMaxBytes) return false
  if (obs.textureBytes > caps.textureBytesMax) return false
  if (obs.bundleBytes > caps.bundleMaxBytes) return false
  return true
}

export function copiedFromCaps(obs: VisualObserved, caps: VisualCaps): boolean {
  if (obs.drawCalls === caps.drawCallsMax) return true
  if (obs.sprites === caps.spriteInstancesMax) return true
  if (obs.atlasBytes === caps.atlasMaxBytes) return true
  if (obs.textureBytes === caps.textureBytesMax) return true
  if (obs.bundleBytes === caps.bundleMaxBytes) return true
  return false
}

export type Observe3Args = {
  readonly landTiles: bigint
  readonly waterPlanes: bigint
  readonly foamTiles: bigint
  readonly leftoverBoxes: bigint
  readonly walkers: bigint
  readonly decorFamilies: bigint
  readonly vehicles: bigint
  readonly drones: bigint
  readonly heroesVisible: bigint
  readonly sprites: bigint
  readonly atlasBytes: bigint
  readonly pagePx: bigint
  readonly colorPages: bigint
  readonly glowPages: bigint
  readonly bundleBytes: bigint
}

/** Measured v3 graph. Archive of the cell frame; caps stay outside. */
export function observeVisual3Budgets(args: Observe3Args): VisualObserved {
  const rgba = 1n + 1n + 1n + 1n
  const pageArea = args.pagePx * args.pagePx
  return {
    drawCalls:
      args.landTiles +
      args.waterPlanes +
      args.foamTiles +
      args.leftoverBoxes +
      args.walkers +
      args.decorFamilies +
      args.vehicles +
      args.drones +
      args.heroesVisible,
    sprites: args.sprites,
    atlasBytes: args.atlasBytes,
    textureBytes: pageArea * rgba * args.colorPages + pageArea * args.glowPages,
    bundleBytes: args.bundleBytes,
  }
}

export type ObserveIslandArgs = {
  readonly massPrimitives: bigint
  readonly buildingPrimitives: bigint
  readonly sprites: bigint
  readonly atlasBytes: bigint
  readonly pagePx: bigint
  readonly colorPages: bigint
  readonly glowPages: bigint
  readonly bundleBytes: bigint
}

/** Measured authored-island graph. Callers pass file-derived counts; caps stay outside. */
export function observeIslandBudgets(args: ObserveIslandArgs): VisualObserved {
  const rgba = 1n + 1n + 1n + 1n
  const pageArea = args.pagePx * args.pagePx
  return {
    drawCalls: args.massPrimitives + args.buildingPrimitives,
    sprites: args.sprites,
    atlasBytes: args.atlasBytes,
    textureBytes: pageArea * rgba * args.colorPages + pageArea * args.glowPages,
    bundleBytes: args.bundleBytes,
  }
}
