import type { Json } from "@corporator/contentpack";
import type { ActionRow, CapabilityRow } from "./demo.js";
import type { HudFixture } from "./layout.js";
export type CatalogBuilding = {
    readonly id: string;
    readonly cost: bigint;
};
export type DistrictRow = {
    readonly id: string;
    readonly ticker: string;
    readonly role: string;
    readonly provides: string;
    readonly beacon: string;
};
export type PackPhase = {
    readonly name: string;
    readonly startHour: bigint;
    readonly durationHours: bigint;
    readonly lights: bigint;
    readonly tintAlphaBps: bigint;
    readonly tintRamp: string;
};
export type ClientLight = {
    readonly phases: readonly PackPhase[];
    readonly lanternsOn: readonly string[];
    readonly blendMinutes: bigint;
    readonly minutesPerHour: bigint;
    readonly emissiveBps: bigint;
    readonly gradeBps: bigint;
};
export type ScreenMeta = {
    readonly id: string;
    readonly mount: string;
    readonly loadingKind: string;
    readonly emptyKind: string;
    readonly titleKey: string;
    readonly v1: string;
};
export type OnboardStep = {
    readonly id: string;
    readonly step: bigint;
    readonly codes: readonly string[];
};
export type SettingRow = {
    readonly id: string;
    readonly kind: string;
    readonly labelKey: string;
    readonly v1: string;
};
export type PackZoom = {
    readonly num: bigint;
    readonly den: bigint;
};
export type PackCamBounds = {
    readonly minX: bigint;
    readonly minY: bigint;
    readonly maxX: bigint;
    readonly maxY: bigint;
};
export type ClientCamera = {
    readonly levels: readonly PackZoom[];
    readonly bounds: PackCamBounds;
    readonly centroids: {
        readonly [id: string]: {
            readonly x: bigint;
            readonly y: bigint;
        };
    };
    readonly beacons: {
        readonly [buildingId: string]: string;
    };
    readonly panDeadzonePx: bigint;
    readonly tapMaxMovePx: bigint;
    readonly pinchStepBps: bigint;
    readonly zoomStepMs: bigint;
    readonly panInertiaMs: bigint;
    readonly doubleTapMs: bigint;
    readonly panTilesPerCitySecond: bigint;
};
export type ClientBlock = {
    readonly west: bigint;
    readonly north: bigint;
    readonly east: bigint;
    readonly south: bigint;
};
export type ClientVehicle = {
    readonly x: bigint;
    readonly y: bigint;
};
export type ClientDrone = {
    readonly x: bigint;
    readonly y: bigint;
    readonly blockId: bigint;
};
export type ClientPopup = {
    readonly tileX: bigint;
    readonly tileY: bigint;
    readonly amount: bigint;
    readonly eventTime: bigint;
};
export type ClientMotion = {
    readonly layoutSeed: string;
    readonly vehicleSpeed: bigint;
    readonly vehicleStride: bigint;
    readonly droneSpeed: bigint;
    readonly droneAlt: bigint;
    readonly droneBob: bigint;
    readonly droneBobPeriod: bigint;
    readonly turbineFrames: bigint;
    readonly turbinePeriod: bigint;
    readonly smokeFrames: bigint;
    readonly flagFrames: bigint;
    readonly billboardPeriod: bigint;
    readonly birdsPerDay: bigint;
    readonly prngBytes: bigint;
    readonly fxPopupRise: bigint;
    readonly fxTickGlowBps: bigint;
    readonly fxAlphaSteps: bigint;
    readonly fxEnabled: boolean;
    readonly fxGlowOn: boolean;
    readonly minutesPerHour: bigint;
    readonly ticksDay: bigint;
    readonly gradeBps: bigint;
    readonly blocks: readonly ClientBlock[];
    readonly drones: readonly ClientDrone[];
    readonly vehicles: readonly ClientVehicle[];
    readonly popups: readonly ClientPopup[];
};
export type ClientPack = {
    readonly hash: string;
    readonly demoIsolated: boolean;
    readonly bps: bigint;
    readonly rateBps: bigint;
    readonly ticksDay: bigint;
    readonly anchorCityTime: bigint;
    readonly anchorDay: bigint;
    readonly anchorWeekday: bigint;
    readonly weekDays: bigint;
    readonly bankOpenHour: bigint;
    readonly bankCloseHour: bigint;
    readonly bankClosedWeekday: bigint;
    readonly gridSize: bigint;
    readonly packSafeW: bigint;
    readonly packSafeH: bigint;
    readonly packIsoW: bigint;
    readonly packIsoH: bigint;
    readonly zoomMinNum: bigint;
    readonly zoomMinDen: bigint;
    readonly tileW: bigint;
    readonly scene: unknown;
    readonly chunkTiles: bigint;
    readonly cubeH: bigint;
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
    readonly pipStep: bigint;
    readonly pipOffset: bigint;
    readonly pulsePeriod: bigint;
    readonly hoverOutlinePx: bigint;
    readonly hoverOutlineAlphaBps: bigint;
    readonly selectLift: bigint;
    readonly contactShadowAlphaBps: bigint;
    readonly contactShadowInsetBps: bigint;
    readonly labelMinZoomNum: bigint;
    readonly labelMinZoomDen: bigint;
    readonly overlays: {
        readonly [lv: string]: {
            readonly pips: bigint;
            readonly antenna: bigint;
            readonly depends: bigint;
        };
    };
    readonly badges: readonly {
        readonly code: string;
        readonly kind: string;
        readonly logOnly: bigint;
    }[];
    readonly actions: {
        readonly [id: string]: ActionRow;
    };
    readonly capabilities: {
        readonly [id: string]: CapabilityRow;
    };
    readonly menuIds: readonly string[];
    readonly districts: readonly DistrictRow[];
    readonly catalog: readonly CatalogBuilding[];
    readonly prizeAssets: readonly string[];
    readonly prizePeriodRealHours: bigint;
    readonly happinessPenaltyThresholdBps: bigint;
    readonly stabilityHintThresholdBps: bigint;
    readonly light: ClientLight;
    readonly camera: ClientCamera;
    readonly motion: ClientMotion;
    readonly siMin: bigint;
    readonly siBase: bigint;
    readonly clockIntervalMs: bigint;
    readonly fontPixelFamily: string;
    readonly fontLogFamily: string;
    readonly fontPixelFile: string;
    readonly fontLogFile: string;
    readonly screens: {
        readonly [id: string]: ScreenMeta;
    };
    readonly emptyKinds: {
        readonly [id: string]: string;
    };
    readonly onboardSteps: readonly OnboardStep[];
    readonly settingsRows: readonly SettingRow[];
    readonly refusalShowCount: bigint;
    readonly mintRate: bigint;
    readonly bankLimit: bigint;
    readonly quoteLo: bigint;
    readonly quoteHi: bigint;
    readonly companionReliefBps: bigint;
    readonly companionCmdPerTick: bigint;
    readonly companionAdvisorDepth: bigint;
    readonly companionAdvisorCalls: bigint;
    readonly companionAdvisorCooldown: bigint;
    readonly companionOfflineCap: bigint;
    readonly companionCarryOver: bigint;
    readonly companionCommands: readonly {
        readonly id: string;
        readonly effect: string;
    }[];
    readonly autopilotLive: boolean;
};
export declare function loadHudFixture(root: unknown): HudFixture;
export declare function loadTileW(sprites: unknown): bigint;
export declare function loadClientPack(pack: Json): ClientPack;
export declare function navigateTarget(effect: string): string | undefined;
