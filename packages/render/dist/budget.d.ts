export type VisualCaps = {
    readonly drawCallsMax: bigint;
    readonly spriteInstancesMax: bigint;
    readonly atlasMaxBytes: bigint;
    readonly textureBytesMax: bigint;
    readonly bundleMaxBytes: bigint;
};
export type VisualObserved = {
    readonly drawCalls: bigint;
    readonly sprites: bigint;
    readonly atlasBytes: bigint;
    readonly textureBytes: bigint;
    readonly bundleBytes: bigint;
};
export type ObserveArgs = {
    readonly grid: bigint;
    readonly chunkTiles: bigint;
    readonly sprites: bigint;
    readonly atlasBytes: bigint;
    readonly pagePx: bigint;
    readonly colorPages: bigint;
    readonly glowPages: bigint;
    readonly bundleBytes: bigint;
};
/** Measured picture budgets. Callers pass file sizes and pack-derived sizes; caps stay outside. */
export declare function observeVisualBudgets(args: ObserveArgs): VisualObserved;
export declare function underVisualCaps(obs: VisualObserved, caps: VisualCaps): boolean;
export declare function copiedFromCaps(obs: VisualObserved, caps: VisualCaps): boolean;
