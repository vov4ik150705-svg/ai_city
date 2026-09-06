export declare function isTap(moved: bigint, tapMax: bigint): boolean;
export declare function isPan(moved: bigint, deadzone: bigint): boolean;
export declare function isDoubleTap(nowMs: bigint, lastMs: bigint, windowMs: bigint): boolean;
/** +1 zoom in, −1 zoom out, 0 hold. Distances in screen px; step and bps from the pack. */
export declare function pinchZoomDir(prevDist: bigint, dist: bigint, stepBps: bigint, bps: bigint): bigint;
export declare function keyPanDir(key: string): {
    readonly dx: bigint;
    readonly dy: bigint;
};
export declare function keyZoomDir(key: string): bigint;
export declare function applyKeyZoom(index: bigint, key: string, count: bigint): bigint;
