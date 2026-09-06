import { Container, type Texture } from "pixi.js";
import { type PopupEvent } from "./fx.js";
import { type BlockRect, type DroneStart, type VehicleStart } from "./motion.js";
import { type AtlasFrame } from "./sprites.js";
export type MotionPack = {
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
    readonly blocks: readonly BlockRect[];
    readonly drones: readonly DroneStart[];
    readonly vehicles: readonly VehicleStart[];
    readonly popups: readonly PopupEvent[];
};
export type MotionHandle = {
    apply(cityTime: bigint): void;
};
export declare function mountMotion(args: {
    readonly map: readonly string[];
    readonly objects: readonly {
        readonly id: string;
        readonly tileX: bigint;
        readonly tileY: bigint;
    }[];
    readonly frames: {
        readonly [id: string]: AtlasFrame;
    };
    readonly tex: (id: string) => Texture | undefined;
    readonly tileW: bigint;
    readonly cubeH: bigint;
    readonly shadowTint: number;
    readonly spriteLayer: Container;
    readonly shadowLayer: Container;
    readonly fxLayer: Container;
    readonly pack: MotionPack;
}): MotionHandle;
