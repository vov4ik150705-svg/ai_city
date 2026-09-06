import { asBig, asBool, asDict, asStr } from "./values.js";
function districtPlayable(data, did) {
    if (!did)
        return false;
    const row = asDict(asDict(asDict(data["districts"])["districts"])[did]);
    return asBool(row["playable_v1"]);
}
function tickAccrues(data, building, status, idle, paid) {
    if (asBool(building["force_fragment_accrual"]))
        return true;
    if (idle || status !== paid)
        return false;
    if (asStr(building["tier"]) !== "beacon")
        return false;
    const did = asStr(building["district"]);
    if (!did)
        return false;
    return districtPlayable(data, did);
}
function composedRate(mags, bps) {
    if (mags.length === 0)
        return bps;
    let num = 1n;
    for (const m of mags)
        num *= bps + m;
    let den = 1n;
    let i = 1;
    while (i < mags.length) {
        den *= bps;
        i += 1;
    }
    return den === 0n ? num : num / den;
}
export function accrueAmount(data, grossOutput, rateMags, building, status, idle, bps, paid) {
    if (!tickAccrues(data, building, status, idle, paid))
        return 0n;
    const composed = composedRate(rateMags, bps);
    if (grossOutput <= 0n || composed <= 0n)
        return 0n;
    return (grossOutput * composed) / bps;
}
export function settleFromData(data, fragments, pool) {
    const cap = asBig(asDict(asDict(asDict(data["fragments"])["params"])["fragment_city_cap_bps"])["v"]);
    let nClaim = 0n;
    let total = 0n;
    for (const f of fragments) {
        total += f;
        if (f > 0n)
            nClaim += 1n;
    }
    const payouts = [];
    for (const f of fragments) {
        payouts.push(total > 0n && pool > 0n ? (f * pool) / total : 0n);
    }
    return { payouts, pool, cap, n_claiming: nClaim, sum_payout: payouts.reduce((a, b) => a + b, 0n) };
}
export function stabilityBps(validTicks, data, ticksDay) {
    if (ticksDay <= 0n)
        return 0n;
    const bps = asBig(asDict(asDict(asDict(data["economy"])["params"])["spend_burn_bps"])["v"]) +
        asBig(asDict(asDict(asDict(data["economy"])["params"])["spend_fund_bps"])["v"]) +
        asBig(asDict(asDict(asDict(data["economy"])["params"])["spend_protocol_bps"])["v"]);
    return (validTicks * bps) / ticksDay;
}
