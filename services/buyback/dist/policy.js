import { mulBps } from "@corporator/engine";
export function buybackTranche(depthWei, trancheCapBps, bps) {
    if (bps <= 0n)
        return 0n;
    return mulBps(depthWei, trancheCapBps, bps);
}
export function buybackBelowMin(collectedWei, minBatchWei) {
    return collectedWei < minBatchWei;
}
export function buybackOrderOk(timestamps, order) {
    if (!order.includes("deposit_confirmed") || !order.includes("mint"))
        return false;
    const dep = timestamps.deposit_confirmed;
    const minted = timestamps.mint;
    if (dep === undefined || minted === undefined)
        return true;
    return dep < minted;
}
export function buybackDue(cadence, hasRun, lastRunCityTime, now) {
    if (cadence <= 0n)
        return false;
    if (now % cadence !== 0n)
        return false;
    if (hasRun === 0n)
        return true;
    return now - lastRunCityTime >= cadence;
}
export function planSend(pack, collectedWei, depthWei) {
    if (buybackBelowMin(collectedWei, pack.minBatchWei))
        return 0n;
    const cap = buybackTranche(depthWei, pack.trancheCapBps, pack.bps);
    const sized = collectedWei < cap ? collectedWei : cap;
    return sized <= depthWei ? sized : depthWei;
}
export function slippageSafetyOk(pack) {
    return pack.slippageSafety >= pack.slippageSafetyMin;
}
export function trancheSlipWithinTax(pack, depthWei) {
    const tranche = buybackTranche(depthWei, pack.trancheCapBps, pack.bps);
    return tranche * pack.slippageSafety <= mulBps(depthWei, pack.creatorTaxBps, pack.bps);
}
export function stampOf(stamps, field) {
    switch (field) {
        case "eth_collected":
            return stamps.eth_collected;
        case "corp_bought":
            return stamps.corp_bought;
        case "deposit_confirmed":
            return stamps.deposit_confirmed;
        case "mint":
            return stamps.mint;
        default: {
            const _never = field;
            return _never;
        }
    }
}
export function withStamp(stamps, field, cityTime) {
    switch (field) {
        case "eth_collected":
            return { ...stamps, eth_collected: cityTime };
        case "corp_bought":
            return { ...stamps, corp_bought: cityTime };
        case "deposit_confirmed":
            return { ...stamps, deposit_confirmed: cityTime };
        case "mint":
            return { ...stamps, mint: cityTime };
        default: {
            const _never = field;
            return _never;
        }
    }
}
export function nextUnset(order, stamps) {
    for (const field of order) {
        if (stampOf(stamps, field) === undefined)
            return field;
    }
    return undefined;
}
export function applyStamp(pack, stamps, field, cityTime) {
    if (nextUnset(pack.order, stamps) !== field)
        return undefined;
    if (field === "mint") {
        const dep = stamps.deposit_confirmed;
        if (dep === undefined || dep >= cityTime)
            return undefined;
        if (!buybackOrderOk(withStamp(stamps, "mint", cityTime), pack.order))
            return undefined;
    }
    return withStamp(stamps, field, cityTime);
}
