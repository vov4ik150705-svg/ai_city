/**
 * Water frame from city_time, not a frame delta (L334, D-V-8).
 * step = cityTime * water_steps_per_tick; phase = (tx + step) mod frames.
 */
export declare function waterPhase(tx: bigint, cityTime: bigint, frames: bigint, stepsPerTick: bigint): bigint;
export declare function isShoreWater(map: readonly string[], tx: bigint, ty: bigint): boolean;
export declare function isShallowWater(map: readonly string[], tx: bigint, ty: bigint, reach: bigint): boolean;
export declare function waterSpriteId(map: readonly string[], tx: bigint, ty: bigint, reach: bigint, shallowId: string, deepId: string): string;
/** Shallow water picks strip[phase]; deep stays deepId. Phase is city_time (L334). */
export declare function waterFrameId(map: readonly string[], tx: bigint, ty: bigint, reach: bigint, strip: readonly string[], deepId: string, cityTime: bigint, stepsPerTick: bigint, frames: bigint): string;
