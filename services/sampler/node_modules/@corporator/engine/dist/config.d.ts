import type { Dict } from "./values.js";
export declare function poolPriceWeiPerWhole(poolEth: bigint, poolCorp: bigint, wei: bigint): bigint;
export declare function rateRawFromSamples(cfg: Dict, corpEthWeiPerWhole: bigint, ethUsd8dec: bigint): bigint;
export declare function loadConfig(pack: Dict): Dict;
export declare function leafPrefixes(cfg: Dict): readonly [Uint8Array, Uint8Array];
