import { type SceneObject } from "./ground.js";
import { type SpriteFrame } from "./sprites.js";
export type ZoomLevel = {
    readonly num: bigint;
    readonly den: bigint;
};
export type CamBounds = {
    readonly minX: bigint;
    readonly minY: bigint;
    readonly maxX: bigint;
    readonly maxY: bigint;
};
export type Camera = {
    readonly centerTileX: bigint;
    readonly centerTileY: bigint;
    readonly zoomIndex: bigint;
};
export type TileHit = {
    readonly tileX: bigint;
    readonly tileY: bigint;
    readonly objectId: string;
    readonly kind: string;
    readonly cell: string;
};
export declare function snapZoomIndex(index: bigint, count: bigint): bigint;
export declare function zoomAt(levels: readonly ZoomLevel[], index: bigint): ZoomLevel;
export declare function stepZoomIndex(index: bigint, dir: bigint, count: bigint): bigint;
export declare function zoomInPack(num: bigint, den: bigint, levels: readonly ZoomLevel[]): boolean;
export declare function clampCamera(x: bigint, y: bigint, bounds: CamBounds): {
    readonly x: bigint;
    readonly y: bigint;
};
export declare function lookAtZone(id: string, centroids: {
    readonly [id: string]: {
        readonly x: bigint;
        readonly y: bigint;
    };
}, bounds: CamBounds): {
    readonly x: bigint;
    readonly y: bigint;
};
export declare function cameraWorldOffset(centerTX: bigint, centerTY: bigint, zoomNum: bigint, zoomDen: bigint, viewW: bigint, viewH: bigint, tileW: bigint): {
    readonly x: bigint;
    readonly y: bigint;
};
export declare function screenToWorld(sx: bigint, sy: bigint, centerTX: bigint, centerTY: bigint, zoomNum: bigint, zoomDen: bigint, viewW: bigint, viewH: bigint, tileW: bigint): {
    readonly x: bigint;
    readonly y: bigint;
};
export declare function objectAtTile(objects: readonly SceneObject[], frames: {
    readonly [id: string]: SpriteFrame;
}, tx: bigint, ty: bigint): string;
export declare function hitFromWorld(px: bigint, py: bigint, tileW: bigint, map: readonly string[], objects: readonly SceneObject[], frames: {
    readonly [id: string]: SpriteFrame;
}): TileHit;
/**
 * Closed stock beacon → districts; other building → building_card;
 * empty / water / road → build catalog (R-V-55). Tile legality is BUILD_TILE_ILLEGAL.
 */
export declare function routeSceneClick(hit: TileHit, beacons: {
    readonly [id: string]: string;
}, opened: {
    readonly [district: string]: bigint;
}): string;
