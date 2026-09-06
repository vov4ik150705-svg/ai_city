export declare const KETTLE_FARM = "farm";
export declare const KETTLE_MONTH = "month";
export declare const RETURN_FN = "returnUnsettled";
export declare const REFUND_FN = "refundPlayer";
export declare const POOL_IN_MEASURED = "measured";
export declare const CODE_UNSETTLED = "PRIZE_UNSETTLED_RETURNED";
export declare const CODE_UNCOVERED = "PRIZE_CLAIM_UNCOVERED";
export declare const CODE_DEMO_NO_PRIZE = "DEMO_NO_PRIZE";
export type OwedMap = {
    readonly [wallet: string]: bigint;
};
export type ReturnResult = {
    readonly toBot: bigint;
    readonly owedSum: bigint;
    readonly owed: OwedMap;
};
export type ClaimResult = {
    readonly paid: bigint;
    readonly code: string;
    readonly owed: bigint;
    readonly assetPool: bigint;
};
export type AssetClaim = {
    readonly asset: string;
    readonly paid: bigint;
    readonly code: string;
    readonly owed: bigint;
    readonly assetPool: bigint;
};
export type RefundResult = {
    readonly ok: bigint;
    readonly reason: string;
    readonly paid: bigint;
    readonly backing: bigint;
    readonly capital: bigint;
    readonly reserve: bigint;
    readonly corpLeft: bigint;
};
export declare function returnUnsettled(unsliced: bigint, owed: OwedMap): ReturnResult;
export declare function returnUnsettledAttack(unsliced: bigint, owed: OwedMap, eatSettled: boolean): ReturnResult;
export declare function claimPrize(args: {
    readonly owed: bigint;
    readonly poolIn: bigint;
    readonly paused: boolean;
    readonly demo: boolean;
    readonly honorPause: boolean;
}): ClaimResult;
export declare function claimEveryAsset(args: {
    readonly assets: readonly string[];
    readonly owed: {
        readonly [asset: string]: bigint;
    };
    readonly poolIn: {
        readonly [asset: string]: bigint;
    };
    readonly paused: boolean;
    readonly demo: boolean;
    readonly honorPause: boolean;
}): readonly AssetClaim[];
export declare function refundPlayer(args: {
    readonly backing: bigint;
    readonly amount: bigint;
    readonly capital: bigint;
    readonly anchor: bigint;
    readonly corpInVault: bigint;
    readonly totalBacking: bigint;
}): RefundResult;
