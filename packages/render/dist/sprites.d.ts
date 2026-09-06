import type { SceneObject } from "./ground.js";
export type SpriteFrame = {
    readonly footX: bigint;
    readonly footY: bigint;
    readonly cols: bigint;
    readonly rows: bigint;
    readonly kind: string;
    readonly w: bigint;
    readonly h: bigint;
};
export type AtlasFrame = SpriteFrame & {
    readonly x: bigint;
    readonly y: bigint;
};
export type OverlayRow = {
    readonly pips: bigint;
    readonly antenna: bigint;
    readonly depends: bigint;
};
export type BadgeRow = {
    readonly code: string;
    readonly kind: string;
    readonly logOnly: bigint;
};
export type Ranked = {
    readonly id: string;
    readonly tileX: bigint;
    readonly tileY: bigint;
    readonly cols: bigint;
    readonly rows: bigint;
    readonly depth: bigint;
    readonly tie: bigint;
    readonly index: bigint;
};
export type LabelBox = {
    readonly id: string;
    readonly rank: bigint;
    readonly depth: bigint;
    readonly x: bigint;
    readonly y: bigint;
    readonly w: bigint;
    readonly h: bigint;
    readonly text: string;
};
export type SceneMarker = {
    readonly sprite: string;
    readonly tileX: bigint;
    readonly tileY: bigint;
};
export declare function cloudLift(id: string, tileW: bigint): bigint;
export declare function painterDepth(tx: bigint, ty: bigint, cols: bigint, rows: bigint): bigint;
export declare function painterTie(tx: bigint): bigint;
/** Sprite top-left. Same as scene.py: front vertex minus foot_anchor minus cube drop minus lift. */
export declare function spriteScreenPos(tx: bigint, ty: bigint, cols: bigint, rows: bigint, tileW: bigint, cubeH: bigint, footX: bigint, footY: bigint, lift: bigint): {
    readonly x: bigint;
    readonly y: bigint;
};
export declare function sortPlaced(objects: readonly SceneObject[], frames: {
    readonly [id: string]: SpriteFrame;
}): readonly Ranked[];
export declare function overlayAt(level: bigint, rows: {
    readonly [lv: string]: OverlayRow;
}): OverlayRow;
export declare function badgeKind(code: string): string;
export declare function badgeSprite(kind: string): string;
export declare function badgeOnScene(code: string, badges: readonly BadgeRow[]): boolean;
export declare function objectIdle(kind: string, energy: bigint, compute: bigint): string;
export declare function labelsVisible(zoomNum: bigint, zoomDen: bigint, minNum: bigint, minDen: bigint): boolean;
export declare function labelRank(kind: string): bigint;
export declare function skipOverlappingLabels(boxes: readonly LabelBox[]): readonly string[];
export declare function badgePulseOn(cityTime: bigint, period: bigint): boolean;
export declare function pipWorldPos(tx: bigint, ty: bigint, cols: bigint, rows: bigint, tileW: bigint, cubeH: bigint, step: bigint, offset: bigint, index: bigint): {
    readonly x: bigint;
    readonly y: bigint;
};
export declare function sceneMarkers(objects: readonly SceneObject[], frames: {
    readonly [id: string]: SpriteFrame;
}, energy: bigint, compute: bigint, badges: readonly BadgeRow[]): readonly SceneMarker[];
export declare function footprintDiamond(tx: bigint, ty: bigint, cols: bigint, rows: bigint, tileW: bigint, cubeH: bigint): readonly {
    readonly x: bigint;
    readonly y: bigint;
}[];
