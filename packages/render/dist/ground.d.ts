export declare function cellAt(map: readonly string[], x: bigint, y: bigint): string;
export type SceneObject = {
    readonly id: string;
    readonly tileX: bigint;
    readonly tileY: bigint;
};
export declare function loadScene(root: unknown): {
    readonly legend: {
        readonly [ch: string]: string;
    };
    readonly map: readonly string[];
    readonly objects: readonly SceneObject[];
};
export declare function isShore(map: readonly string[], tx: bigint, ty: bigint): boolean;
export declare function isRoadCell(map: readonly string[], x: bigint, y: bigint): boolean;
/** 4-bit NESW mask; bit0=N, bit1=E, bit2=S, bit3=W. Same as tiles.neighbor_mask. */
export declare function neighborMask(map: readonly string[], tx: bigint, ty: bigint): bigint;
/** Same 16-way pick as art/pipeline/tiles.py road_sprite. Table from the pack. */
export declare function roadSprite(map: readonly string[], tx: bigint, ty: bigint, table: readonly string[]): string;
/** Curb faces adjacent road/crosswalk. Table from the pack. */
export declare function sidewalkSprite(map: readonly string[], tx: bigint, ty: bigint, table: readonly string[]): string;
export declare function topSpriteId(map: readonly string[], tx: bigint, ty: bigint, sprites: {
    readonly [ch: string]: string;
}, roadTable: readonly string[], walkTable: readonly string[]): string;
export type PadFoot = {
    readonly tx: bigint;
    readonly ty: bigint;
    readonly cols: bigint;
    readonly rows: bigint;
};
export declare function padFootprints(objects: readonly SceneObject[], frames: {
    readonly [id: string]: {
        readonly kind: string;
        readonly cols: bigint;
        readonly rows: bigint;
    };
}, skip: readonly string[]): readonly PadFoot[];
export declare function tileOnPad(tx: bigint, ty: bigint, pads: readonly PadFoot[]): boolean;
export declare function groundTopId(map: readonly string[], tx: bigint, ty: bigint, sprites: {
    readonly [ch: string]: string;
}, roadTable: readonly string[], walkTable: readonly string[], padId: string, pads: readonly PadFoot[]): string;
export declare function lowerSpriteId(map: readonly string[], tx: bigint, ty: bigint, dirt: string, cliff: string, rock: string): string;
