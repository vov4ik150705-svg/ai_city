import { staticDrawCalls } from "./chunk.js";
/** Measured picture budgets. Callers pass file sizes and pack-derived sizes; caps stay outside. */
export function observeVisualBudgets(args) {
    const rgba = 1n + 1n + 1n + 1n;
    const pageArea = args.pagePx * args.pagePx;
    return {
        drawCalls: staticDrawCalls(args.grid, args.chunkTiles),
        sprites: args.sprites,
        atlasBytes: args.atlasBytes,
        textureBytes: pageArea * rgba * args.colorPages + pageArea * args.glowPages,
        bundleBytes: args.bundleBytes,
    };
}
export function underVisualCaps(obs, caps) {
    if (obs.drawCalls > caps.drawCallsMax)
        return false;
    if (obs.sprites > caps.spriteInstancesMax)
        return false;
    if (obs.atlasBytes > caps.atlasMaxBytes)
        return false;
    if (obs.textureBytes > caps.textureBytesMax)
        return false;
    if (obs.bundleBytes > caps.bundleMaxBytes)
        return false;
    return true;
}
export function copiedFromCaps(obs, caps) {
    if (obs.drawCalls === caps.drawCallsMax)
        return true;
    if (obs.sprites === caps.spriteInstancesMax)
        return true;
    if (obs.atlasBytes === caps.atlasMaxBytes)
        return true;
    if (obs.textureBytes === caps.textureBytesMax)
        return true;
    if (obs.bundleBytes === caps.bundleMaxBytes)
        return true;
    return false;
}
