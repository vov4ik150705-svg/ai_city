import type { Dict } from "./values.js";
export declare function shareFloor(pool: bigint, weight: bigint, total: bigint): bigint;
export declare function zipfWeights(n: bigint, bps: bigint): bigint[];
export type ZipfPayout = {
    readonly payouts: readonly bigint[];
    readonly weights: readonly bigint[];
    readonly sumPayout: bigint;
    readonly dust: bigint;
};
export declare function zipfPayout(pool: bigint, n: bigint, bps: bigint): ZipfPayout;
export type PrizeRow = {
    readonly wallet: string;
    readonly city_id: string;
    readonly influence: bigint;
    readonly rank: bigint;
    readonly payout: bigint;
    readonly amounts: Readonly<Record<string, bigint>>;
};
export type AssetRankRow = {
    readonly wallet: string;
    readonly city_id: string;
    readonly rank: bigint;
    readonly payout: bigint;
};
export type AssetPayout = {
    readonly sum_payout: bigint;
    readonly dust: bigint;
    readonly pool: bigint;
    readonly invariant_ok: bigint;
    readonly payouts: readonly AssetRankRow[];
};
export type SeasonSettle = {
    readonly payouts: readonly PrizeRow[];
    readonly n_eligible: bigint;
    readonly n_paid: bigint;
    readonly sum_payout: bigint;
    readonly dust: bigint;
    readonly pool_left: bigint;
    readonly dust_by_asset: Readonly<Record<string, bigint>>;
    readonly by_asset: Readonly<Record<string, AssetPayout>>;
    readonly codes: readonly string[];
    readonly assets: readonly string[];
    readonly asset: string;
    readonly kettle: string;
    readonly mints_capital: bigint;
    readonly live: bigint;
    readonly need_days: bigint;
    readonly invariant_ok: bigint;
    readonly qualify_rejected: bigint;
    readonly share_cap_applied: bigint;
    readonly share_cap_bps: bigint;
};
export declare function periodSettleDue(data: Dict, cityDay: bigint, hour: bigint): boolean;
export declare function seasonSettleDue(data: Dict, cityDay: bigint, hour: bigint): boolean;
export declare function seasonSettle(data: Dict, rows: readonly Dict[], pool: bigint | Dict, hopStale?: boolean, cityDay?: bigint, hour?: bigint): SeasonSettle;
