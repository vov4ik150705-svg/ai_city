import type { Dict } from "./values.js";
export declare function housingTermBps(housingCapacity: bigint, occupiedJobs: bigint, populationPerJob: bigint, bps: bigint): bigint;
export declare function parksTermBps(parkSlots: bigint, parkCapacityJobs: bigint, occupiedJobs: bigint, bps: bigint): bigint;
export declare function energyTermBps(energyStock: bigint, energyDemandPerTick: bigint, energyBufferTicks: bigint, bps: bigint): bigint;
export declare function productivityBps(realized: bigint, nominal: bigint, bps: bigint): bigint;
export declare function population(occupiedJobs: bigint, populationPerJob: bigint, housingCapacity: bigint): bigint;
export declare function gdpDay(payouts: readonly bigint[]): bigint;
export declare function happinessBps(terms: Dict, weights: Dict, bps: bigint): readonly [bigint, Dict];
export declare function happinessOfCity(cfg: Dict, state: Dict, city: Dict): bigint;
