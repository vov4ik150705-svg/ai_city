export function chunkIndex(tile, chunkTiles) {
    if (chunkTiles <= 0n)
        return 0n;
    if (tile < 0n)
        return 0n;
    return tile / chunkTiles;
}
export function chunkCount(grid, chunkTiles) {
    if (chunkTiles <= 0n)
        return 0n;
    if (grid <= 0n)
        return 0n;
    return (grid + chunkTiles - 1n) / chunkTiles;
}
/** Seam lies on a road axis only when the chunk side equals the road period. */
export function chunkMatchesPeriod(chunkTiles, roadPeriod) {
    if (chunkTiles <= 0n || roadPeriod <= 0n)
        return false;
    return chunkTiles === roadPeriod;
}
/**
 * Adjacent tiles on a chunk boundary share an edge: origin(period,0).x
 * equals origin(period-1,0).x + half_w. A mismatched period is a GPU seam, not a
 * formula gap; the period check is the invariant (L333).
 */
export function seamClosed(chunkTiles, roadPeriod) {
    return chunkMatchesPeriod(chunkTiles, roadPeriod);
}
/** One draw per ground chunk plus water, low-tier, and island-shadow batches. */
export function staticDrawCalls(grid, chunkTiles) {
    const n = chunkCount(grid, chunkTiles);
    const extras = 1n + 1n + 1n;
    return n * n + extras;
}
