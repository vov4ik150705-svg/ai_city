import { type ReactElement } from "react";
import { type BadgeRow, type OverlayRow, type MotionPack } from "@corporator/render/pixi";
import type { Palette } from "../palette.js";
import type { ClientCamera, ClientLight } from "../packview.js";
export declare function SceneHost(props: {
    readonly scene: unknown;
    readonly palette: Palette;
    readonly tileW: bigint;
    readonly cubeH: bigint;
    readonly chunkTiles: bigint;
    readonly waterFrames: bigint;
    readonly waterSteps: bigint;
    readonly waterStrip: readonly string[];
    readonly roadAutotile: readonly string[];
    readonly sidewalkAutotile: readonly string[];
    readonly shadowOffset: bigint;
    readonly groundSprites: {
        readonly [ch: string]: string;
    };
    readonly cubeDirt: string;
    readonly cubeCliff: string;
    readonly cubeRock: string;
    readonly snapLutSide: bigint;
    readonly lotPad: string;
    readonly lotPadSkip: readonly string[];
    readonly zoomMinNum: bigint;
    readonly zoomMinDen: bigint;
    readonly pipStep: bigint;
    readonly pipOffset: bigint;
    readonly pulsePeriod: bigint;
    readonly hoverOutlinePx: bigint;
    readonly selectLift: bigint;
    readonly contactShadowAlphaBps: bigint;
    readonly contactShadowInsetBps: bigint;
    readonly labelMinZoomNum: bigint;
    readonly labelMinZoomDen: bigint;
    readonly overlays: {
        readonly [lv: string]: OverlayRow;
    };
    readonly badges: readonly BadgeRow[];
    readonly energy: bigint;
    readonly compute: bigint;
    readonly cityTime: bigint;
    readonly ticksDay: bigint;
    readonly light: ClientLight;
    readonly camera: ClientCamera;
    readonly motion: MotionPack;
    readonly lookId: string;
    readonly lookRev: bigint;
    readonly opened: {
        readonly [district: string]: bigint;
    };
    readonly onSceneRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void;
    readonly noGpuText: string;
    readonly labels: {
        readonly [id: string]: string;
    };
    readonly tickers: {
        readonly [id: string]: string;
    };
}): ReactElement;
