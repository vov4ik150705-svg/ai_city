import { canonical } from "@corporator/contentpack";
import { bytesToHex, merkleRoot } from "@corporator/engine";
import { aggregateKey, cityDayOf } from "./pack.js";
import { cidV1 } from "./cid.js";
export function cityReps(ticks) {
    const seen = new Set();
    const out = [];
    for (const tick of minuteLeavesOrder(ticks)) {
        if (seen.has(tick.cityId))
            continue;
        seen.add(tick.cityId);
        out.push(tick);
    }
    return out;
}
function minuteLeavesOrder(ticks) {
    return [...ticks].sort((a, b) => {
        if (a.cityId < b.cityId)
            return -1;
        if (a.cityId > b.cityId)
            return 1;
        if (a.cityTime < b.cityTime)
            return -1;
        if (a.cityTime > b.cityTime)
            return 1;
        return 0;
    });
}
export function minuteLeaves(ticks) {
    const out = [];
    for (const tick of minuteLeavesOrder(ticks)) {
        for (const leaf of tick.leaves)
            out.push(leaf);
    }
    return out;
}
export function minuteRoot(pack, ticks) {
    const leaves = minuteLeaves(ticks);
    if (leaves.length === 0)
        return undefined;
    return merkleRoot(leaves, pack.leafPrefix, pack.nodePrefix);
}
export function cityDayPayload(cityId, cityDay, root) {
    const body = {
        city_day: cityDay,
        city_id: cityId,
        root: bytesToHex(root),
    };
    return canonical(body);
}
export function cityDayCid(pack, cityId, cityTime, root) {
    return cidV1(pack, cityDayPayload(cityId, cityDayOf(pack, cityTime), root));
}
export function cityDayStoreKey(pack, cityId, cityTime) {
    return aggregateKey(cityId, cityDayOf(pack, cityTime));
}
