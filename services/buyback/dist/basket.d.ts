import type { BuybackPack } from "./pack.js";
export type BasketHop = {
    readonly ticker: string;
    readonly quoteAsset: string;
    readonly sendWei: bigint;
    readonly haircutBps: bigint;
};
export type BasketState = {
    readonly carryWei: {
        readonly [ticker: string]: bigint;
    };
    readonly stocksRemainderWei: bigint;
    readonly studioHeldWei: bigint;
    readonly hopLag: bigint;
};
export type BasketStepOut = {
    readonly next: BasketState;
    readonly fundWei: bigint;
    readonly prizeWei: bigint;
    readonly studioWei: bigint;
    readonly studioSentWei: bigint;
    readonly stocksWei: bigint;
    readonly perTickerWei: bigint;
    readonly dustWei: bigint;
    readonly hops: readonly BasketHop[];
};
export declare function splitCollected(ethWei: bigint, prizeShareBps: bigint, studioShareBps: bigint, bps: bigint): {
    readonly fundWei: bigint;
    readonly prizeWei: bigint;
    readonly studioWei: bigint;
    readonly stocksWei: bigint;
};
export declare function uniformBudget(stocksWei: bigint, n: bigint): {
    readonly perWei: bigint;
    readonly dustWei: bigint;
};
export declare function emptyBasketState(tickers: readonly string[]): BasketState;
export declare function stepBasket(pack: BuybackPack, state: BasketState, collectedWei: bigint, depthsWei: {
    readonly [ticker: string]: bigint;
}, hopOk: bigint): BasketStepOut;
