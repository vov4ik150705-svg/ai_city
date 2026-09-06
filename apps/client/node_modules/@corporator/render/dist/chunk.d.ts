export declare function chunkIndex(tile: bigint, chunkTiles: bigint): bigint;
export declare function chunkCount(grid: bigint, chunkTiles: bigint): bigint;
/** Seam lies on a road axis only when the chunk side equals the road period. */
export declare function chunkMatchesPeriod(chunkTiles: bigint, roadPeriod: bigint): boolean;
/**
 * Adjacent tiles on a chunk boundary share an edge: origin(period,0).x
 * equals origin(period-1,0).x + half_w. A mismatched period is a GPU seam, not a
 * formula gap; the period check is the invariant (L333).
 */
export declare function seamClosed(chunkTiles: bigint, roadPeriod: bigint): boolean;
/** One draw per ground chunk plus water, low-tier, and island-shadow batches. */
export declare function staticDrawCalls(grid: bigint, chunkTiles: bigint): bigint;
