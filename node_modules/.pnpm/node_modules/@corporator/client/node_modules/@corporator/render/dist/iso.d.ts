export type IsoPoint = {
    readonly x: bigint;
    readonly y: bigint;
};
/** Tile origin. Same formula as art/pipeline/scene.py tile_origin (R-V-10). */
export declare function tileOrigin(tx: bigint, ty: bigint, tileW: bigint): IsoPoint;
/** Diamond centre of a 1×1 tile. Origin plus (half_w, quarter_h). */
export declare function tileCenter(tx: bigint, ty: bigint, tileW: bigint): IsoPoint;
/** Front vertex of a footprint. Same as scene.py front_vertex. */
export declare function frontVertex(tx: bigint, ty: bigint, cols: bigint, rows: bigint, tileW: bigint): IsoPoint;
/** Diamond island: no cube drop (R-V-52). Argument kept for call-site parity. */
export declare function tileCubeH(tileW: bigint): bigint;
/** Division toward −∞. JS bigint `/` truncates toward 0. */
export declare function floorDiv(n: bigint, d: bigint): bigint;
/** Point inside the 1×1 iso diamond of tile (tx, ty), edges inclusive. */
export declare function inTileDiamond(px: bigint, py: bigint, tx: bigint, ty: bigint, tileW: bigint): boolean;
/**
 * World pixel → tile. Inverse of tileOrigin / tileCenter (TZ_RENDER §2).
 * Candidate from the centre formula, then the containing diamond among neighbours.
 */
export declare function tileFromWorld(px: bigint, py: bigint, tileW: bigint): {
    readonly tx: bigint;
    readonly ty: bigint;
};
