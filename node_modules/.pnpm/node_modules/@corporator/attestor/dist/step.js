import { bytesToHex } from "@corporator/engine";
import { codes } from "@corporator/protocol";
import { cityDayOf } from "./pack.js";
import { cityDayStoreKey, cityDayCid, cityReps, minuteRoot } from "./tree.js";
export function emptyAttestorState() {
    return {
        lagTicks: 0n,
        outbox: [],
        rootJobs: [],
        lastFlushWallS: 0n,
        hasFlushed: 0n,
        degraded: "",
    };
}
export function flushDue(pack, state, wallS) {
    if (pack.rootPeriodS <= 0n)
        return false;
    if (state.hasFlushed === 0n)
        return true;
    return wallS - state.lastFlushWallS >= pack.rootPeriodS;
}
function degradedOf(pack, lag) {
    if (lag >= pack.lagAlertTicks)
        return codes.SERVICE_DEGRADED;
    return "";
}
export function stepAttestor(pack, store, state, ticks, wallS, publish) {
    if (!flushDue(pack, state, wallS)) {
        return { next: state, root: undefined, cid: undefined };
    }
    const root = minuteRoot(pack, ticks);
    if (root === undefined) {
        return { next: state, root: undefined, cid: undefined };
    }
    store.putMinute(wallS, root);
    const reps = cityReps(ticks);
    const newCids = [];
    let cid;
    for (const tick of reps) {
        const nextCid = cityDayCid(pack, tick.cityId, tick.cityTime, root);
        store.putCityDay(cityDayStoreKey(pack, tick.cityId, tick.cityTime), nextCid);
        newCids.push(nextCid);
        if (cid === undefined)
            cid = nextCid;
    }
    const jobs = [];
    const rootHex = bytesToHex(root);
    for (const tick of reps) {
        jobs.push({ cityId: tick.cityId, cityDay: cityDayOf(pack, tick.cityTime), rootHex });
    }
    const published = publish.ipfs && publish.rpc;
    // Flags only: a down publisher must not throw. drainRootOutbox retries putRoot. docs/TICK.md §9.
    if (published) {
        return {
            next: {
                lagTicks: 0n,
                outbox: [],
                rootJobs: [...state.rootJobs, ...jobs],
                lastFlushWallS: wallS,
                hasFlushed: 1n,
                degraded: "",
            },
            root,
            cid,
        };
    }
    const lag = state.lagTicks + 1n;
    return {
        next: {
            lagTicks: lag,
            outbox: [...state.outbox, ...newCids],
            rootJobs: [...state.rootJobs, ...jobs],
            lastFlushWallS: wallS,
            hasFlushed: 1n,
            degraded: degradedOf(pack, lag),
        },
        root,
        cid,
    };
}
