import type { Dict } from "./values.js";
export declare function accrueAmount(data: Dict, grossOutput: bigint, rateMags: readonly bigint[], building: Dict, status: string, idle: boolean, bps: bigint, paid: string): bigint;
export declare function settleFromData(data: Dict, fragments: readonly bigint[], pool: bigint): Dict;
export declare function stabilityBps(validTicks: bigint, data: Dict, ticksDay: bigint): bigint;
