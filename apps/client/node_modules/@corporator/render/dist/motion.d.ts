import { type IsoPoint } from "./iso.js";
export type Dir = {
    readonly dx: bigint;
    readonly dy: bigint;
};
export type VehicleStart = {
    readonly x: bigint;
    readonly y: bigint;
};
export type DroneStart = {
    readonly x: bigint;
    readonly y: bigint;
    readonly blockId: bigint;
};
export type BlockRect = {
    readonly west: bigint;
    readonly north: bigint;
    readonly east: bigint;
    readonly south: bigint;
};
export type VehiclePose = {
    readonly tileX: bigint;
    readonly tileY: bigint;
    readonly nextX: bigint;
    readonly nextY: bigint;
    readonly fracNum: bigint;
    readonly fracDen: bigint;
    readonly onRoad: boolean;
    readonly dx: bigint;
    readonly dy: bigint;
};
export type DronePose = {
    readonly tileX: bigint;
    readonly tileY: bigint;
    readonly nextX: bigint;
    readonly nextY: bigint;
    readonly fracNum: bigint;
    readonly fracDen: bigint;
    readonly altitude: bigint;
};
/**
 * Same eight-byte sha256 as content/world.py world_prng (TZ_RENDER §8, D-V-8).
 * byteCount is packed world_prng_bytes and is also the per-byte shift.
 */
export declare function worldPrng(cityId: string, stream: string, index: bigint, byteCount: bigint): bigint;
export declare function isMotionUnit(id: string): boolean;
export declare function isBackgroundUnit(id: string): boolean;
/** Heading from sidewalk/road neighbours. East/south keep the skin; west/north use `_w`. */
export declare function walkerFacing(map: readonly string[], tx: bigint, ty: bigint): string;
export declare function walkerSpriteId(base: string, facing: string): string;
export declare function cityMinutes(cityTime: bigint, minutesPerHour: bigint): bigint;
export declare function atlasFrame(cityTime: bigint, period: bigint, frames: bigint): bigint;
export declare function smokeSpriteId(frame: bigint): string;
export declare function turbineSpriteId(frame: bigint): string;
export declare function flagSpriteId(frame: bigint): string;
export declare function billboardSpriteId(frame: bigint): string;
export declare function waterfallSpriteId(frame: bigint): string;
export declare function shoreWaveSpriteId(frame: bigint): string;
export declare function droneBobSpriteId(frame: bigint): string;
/** Heading from the last road step (TZ_ART §4.5). +x east, +y south. */
export declare function vehicleDirSprite(dx: bigint, dy: bigint): string;
export declare function roadDirs(map: readonly string[], x: bigint, y: bigint, prev: Dir): readonly Dir[];
/**
 * Vehicle tile from city_time. Speed is tiles per city minute (TZ_RENDER §8.1).
 * frac is the leftover city minutes in the current tile.
 */
export declare function vehiclePose(map: readonly string[], start: VehicleStart, index: bigint, cityTime: bigint, minutesPerHour: bigint, speed: bigint, stride: bigint, byteCount: bigint, cityId: string): VehiclePose;
export declare function lerpIso(a: IsoPoint, b: IsoPoint, num: bigint, den: bigint): IsoPoint;
export declare function vehicleWorldPos(pose: VehiclePose, tileW: bigint): IsoPoint;
export declare function dronePose(start: DroneStart, block: BlockRect | undefined, cityTime: bigint, minutesPerHour: bigint, speed: bigint, altPx: bigint, bobPx: bigint, bobPeriod: bigint): DronePose;
export declare function droneWorldPos(pose: DronePose, tileW: bigint): IsoPoint;
export declare function droneShadowPos(pose: DronePose, tileW: bigint): IsoPoint;
export declare function shadowAlphaBps(altitude: bigint, baseAlt: bigint, gradeBps: bigint): bigint;
export declare function birdVisible(cityTime: bigint, ticksDay: bigint, birdsPerDay: bigint): boolean;
