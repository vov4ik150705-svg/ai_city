import type { Dict } from "./values.js";
export declare function seededPrng(cityId: string, tickIndex: bigint, agentId: string, stream?: string): bigint;
export declare function shiftSeedHex(cityId: string, tickIndex: bigint, agentId: string): string;
export declare function companionCommandsHash(commands: unknown): string;
export declare function cityClock(cfg: Dict, tickIndex: bigint): readonly [bigint, bigint, bigint];
export declare function resolveCityTime(cfg: Dict, inputs: Dict, fallbackIndex: bigint): readonly [bigint, bigint];
export declare function emptyDayMon(): Dict;
export declare function emptyAcc(): Dict;
export declare function newState(cfg: Dict, cities: Dict, flags?: Dict): Dict;
