import { applyStamp, buybackDue, planSend } from "./policy.js";
export function emptyBuybackState() {
    return {
        collectedWei: 0n,
        lastRunCityTime: 0n,
        hasRun: 0n,
        sendCount: 0n,
        stamps: {},
    };
}
export function stepBuyback(pack, state, cityTime, inflowWei, depthWei) {
    const collected = state.collectedWei + inflowWei;
    const hold = { ...state, collectedWei: collected };
    if (!buybackDue(pack.cadence, state.hasRun, state.lastRunCityTime, cityTime)) {
        return { next: hold, sendWei: 0n };
    }
    const sendWei = planSend(pack, collected, depthWei);
    if (sendWei === 0n)
        return { next: hold, sendWei: 0n };
    const stamped = applyStamp(pack, {}, "eth_collected", cityTime);
    if (stamped === undefined)
        return { next: hold, sendWei: 0n };
    return {
        next: {
            collectedWei: collected - sendWei,
            lastRunCityTime: cityTime,
            hasRun: 1n,
            sendCount: state.sendCount + 1n,
            stamps: stamped,
        },
        sendWei,
    };
}
