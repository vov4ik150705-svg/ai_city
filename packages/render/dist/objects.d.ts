import { Container, Sprite, type Texture } from "pixi.js";
import type { SceneObject } from "./ground.js";
import { type GlyphMetric } from "./glyphs.js";
import { type AtlasFrame, type BadgeRow, type OverlayRow } from "./sprites.js";
export type ObjectPaint = {
    readonly badges: Sprite[];
};
export type ObjectOpts = {
    readonly objects: readonly SceneObject[];
    readonly frames: {
        readonly [id: string]: AtlasFrame;
    };
    readonly tex: (id: string) => Texture | undefined;
    readonly tileW: bigint;
    readonly cubeH: bigint;
    readonly pipStep: bigint;
    readonly pipOffset: bigint;
    readonly pulsePeriod: bigint;
    readonly hoverOutlinePx: bigint;
    readonly hoverTint: number;
    readonly selectLift: bigint;
    readonly contactAlphaBps: bigint;
    readonly contactInsetBps: bigint;
    readonly gradeBps: bigint;
    readonly labelMinZoomNum: bigint;
    readonly labelMinZoomDen: bigint;
    readonly zoomNum: bigint;
    readonly zoomDen: bigint;
    readonly overlays: {
        readonly [lv: string]: OverlayRow;
    };
    readonly badges: readonly BadgeRow[];
    readonly energy: bigint;
    readonly compute: bigint;
    readonly levels: {
        readonly [id: string]: bigint;
    };
    readonly hoverId: string;
    readonly selectedId: string;
    readonly shadowTint: number;
    readonly cityTime: bigint;
    readonly shadowLayer: Container;
    readonly spriteLayer: Container;
    readonly overlayLayer: Container;
    readonly labelLayer: Container;
    readonly glowLayer: Container;
    readonly glowTex: (id: string) => Texture | undefined;
    readonly lampTint: number;
    readonly labels: {
        readonly [id: string]: string;
    };
    readonly tickers: {
        readonly [id: string]: string;
    };
    readonly glyphs: {
        readonly [ch: string]: GlyphMetric;
    };
    readonly fontTex: Texture | undefined;
    readonly map: readonly string[];
};
export declare function paintObjects(opts: ObjectOpts): ObjectPaint;
