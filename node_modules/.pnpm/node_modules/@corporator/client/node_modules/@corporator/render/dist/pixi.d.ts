import { type TileHit } from "./camera.js";
import { type GpuProbe } from "./gpu.js";
import { type PhaseRow } from "./light.js";
import { type MotionPack } from "./pixiMotion.js";
import type { GlyphMetric } from "./glyphs.js";
import type { AtlasFrame, BadgeRow, OverlayRow } from "./sprites.js";
export type { AtlasFrame, BadgeRow, OverlayRow } from "./sprites.js";
export type { GlyphMetric } from "./glyphs.js";
export type { PhaseRow } from "./light.js";
export type { TileHit } from "./camera.js";
export type { MotionPack } from "./pixiMotion.js";
export type GradeTint = {
    readonly r: number;
    readonly g: number;
    readonly b: number;
};
export type IslandOpts = {
    readonly host: HTMLElement;
    readonly scene: unknown;
    readonly sprites: {
        readonly [ch: string]: string;
    };
    readonly frames: {
        readonly [id: string]: AtlasFrame;
    };
    readonly atlas: HTMLImageElement | ImageBitmap;
    readonly tileW: bigint;
    readonly cubeH: bigint;
    readonly chunkTiles: bigint;
    readonly waterFrames: bigint;
    readonly waterSteps: bigint;
    readonly waterStrip: readonly string[];
    readonly roadAutotile: readonly string[];
    readonly sidewalkAutotile: readonly string[];
    readonly shadowOffset: bigint;
    readonly shallowId: string;
    readonly deepId: string;
    readonly dirtId: string;
    readonly cliffId: string;
    readonly rockId: string;
    readonly lotPadId: string;
    readonly lotPadSkip: readonly string[];
    readonly cityTime: bigint;
    readonly background: number;
    readonly zoomNum: bigint;
    readonly zoomDen: bigint;
    readonly shadowTint: number;
    readonly probe: GpuProbe;
    readonly pipStep: bigint;
    readonly pipOffset: bigint;
    readonly pulsePeriod: bigint;
    readonly hoverOutlinePx: bigint;
    readonly hoverTint: number;
    readonly selectLift: bigint;
    readonly contactAlphaBps: bigint;
    readonly contactInsetBps: bigint;
    readonly labelMinZoomNum: bigint;
    readonly labelMinZoomDen: bigint;
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
    readonly glowAtlas: HTMLImageElement | ImageBitmap;
    readonly snapLut: HTMLImageElement | ImageBitmap | undefined;
    readonly snapLutSide: bigint;
    readonly phases: readonly PhaseRow[];
    readonly blendMinutes: bigint;
    readonly minutesPerHour: bigint;
    readonly ticksDay: bigint;
    readonly emissiveBps: bigint;
    readonly gradeBps: bigint;
    readonly tints: {
        readonly [name: string]: GradeTint;
    };
    readonly lampTint: number;
    readonly motion: MotionPack;
    readonly labels: {
        readonly [id: string]: string;
    };
    readonly tickers: {
        readonly [id: string]: string;
    };
    readonly glyphs: {
        readonly [ch: string]: GlyphMetric;
    };
    readonly fontAtlas: HTMLImageElement | ImageBitmap | undefined;
};
export type IslandHandle = {
    readonly code: string;
    setCityTime(cityTime: bigint): void;
    setCamera(tileX: bigint, tileY: bigint, zoomNum: bigint, zoomDen: bigint): void;
    hitAt(sx: bigint, sy: bigint): TileHit;
    destroy(): void;
};
export declare function mountIsland(opts: IslandOpts): Promise<IslandHandle>;
