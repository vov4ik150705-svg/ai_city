import { buybackTranche } from "./policy.js";
function minWei(a, b) {
    return a < b ? a : b;
}
export function splitCollected(ethWei, prizeShareBps, studioShareBps, bps) {
    if (bps <= 0n || ethWei <= 0n) {
        return { fundWei: 0n, prizeWei: 0n, studioWei: 0n, stocksWei: 0n };
    }
    const prizeWei = (ethWei * prizeShareBps) / bps;
    const fundWei = ethWei - prizeWei;
    const studioWei = (prizeWei * studioShareBps) / bps;
    return { fundWei, prizeWei, studioWei, stocksWei: prizeWei - studioWei };
}
export function uniformBudget(stocksWei, n) {
    if (n <= 0n)
        return { perWei: 0n, dustWei: stocksWei < 0n ? 0n : stocksWei };
    const perWei = stocksWei / n;
    return { perWei, dustWei: stocksWei - perWei * n };
}
export function emptyBasketState(tickers) {
    const carry = {};
    for (const t of tickers) {
        carry[t] = 0n;
    }
    return { carryWei: carry, stocksRemainderWei: 0n, studioHeldWei: 0n, hopLag: 0n };
}
export function stepBasket(pack, state, collectedWei, depthsWei, hopOk) {
    const split = splitCollected(collectedWei, pack.prizeShareBps, pack.studioShareBps, pack.bps);
    const stocksWei = split.stocksWei + state.stocksRemainderWei;
    const n = BigInt(pack.tickers.length);
    const { perWei, dustWei } = uniformBudget(stocksWei, n);
    const hops = [];
    const nextCarry = {};
    const ok = hopOk !== 0n;
    for (const ticker of pack.tickers) {
        const depth = depthsWei[ticker] ?? 0n;
        const prev = state.carryWei[ticker] ?? 0n;
        const available = perWei + prev;
        const quoteAsset = pack.quoteAssetByTicker[ticker] ?? "";
        if (!ok) {
            hops.push({ ticker, quoteAsset, sendWei: 0n, haircutBps: pack.hopHaircutBps });
            nextCarry[ticker] = available;
            continue;
        }
        const cap = buybackTranche(depth, pack.trancheCapBps, pack.bps);
        const sendWei = minWei(available, cap);
        hops.push({ ticker, quoteAsset, sendWei, haircutBps: pack.hopHaircutBps });
        nextCarry[ticker] = available - sendWei;
    }
    const hasRecipient = pack.studioRecipient.length > 0;
    const studioSentWei = hasRecipient ? split.studioWei : 0n;
    const studioHeldWei = hasRecipient ? state.studioHeldWei : state.studioHeldWei + split.studioWei;
    return {
        next: {
            carryWei: nextCarry,
            stocksRemainderWei: dustWei,
            studioHeldWei,
            hopLag: ok ? state.hopLag : state.hopLag + 1n,
        },
        fundWei: split.fundWei,
        prizeWei: split.prizeWei,
        studioWei: split.studioWei,
        studioSentWei,
        stocksWei: split.stocksWei,
        perTickerWei: perWei,
        dustWei,
        hops,
    };
}
