import { bytesToHex } from "@corporator/engine";
import { codes } from "@corporator/protocol";
import { drainRootOutbox } from "./drain.js";
import { attestBadge } from "./badge.js";
import { cityDayOf, aggregateKey } from "./pack.js";
import { cityDayPayload } from "./tree.js";
import { stepAttestor } from "./step.js";
function hexOf(bytes) {
    if (bytes === undefined)
        return "";
    return bytesToHex(bytes);
}
export async function publishSealed(pack, port, ipfs, store, state, ticks, wallS) {
    const pinProbe = await ipfs.pin(aggregateKey("_", 0n), new Uint8Array());
    const flags = { ipfs: pinProbe.ok, rpc: true };
    const stepped = stepAttestor(pack, store, state, ticks, wallS, flags);
    const rootHex = hexOf(stepped.root);
    const cidHex = hexOf(stepped.cid);
    if (stepped.cid !== undefined && flags.ipfs) {
        const tick = ticks[0];
        if (tick !== undefined && stepped.root !== undefined) {
            const day = cityDayOf(pack, tick.cityTime);
            const payload = cityDayPayload(tick.cityId, day, stepped.root);
            const pinned = await ipfs.pin(aggregateKey(tick.cityId, day), payload);
            if (!pinned.ok) {
                const lag = stepped.next.lagTicks + 1n;
                const degraded = lag >= pack.lagAlertTicks ? codes.SERVICE_DEGRADED : stepped.next.degraded;
                return {
                    rootHex,
                    cidHex: "",
                    badge: attestBadge(rootHex, "", true),
                    degraded,
                    next: { ...stepped.next, lagTicks: lag, degraded, outbox: [...stepped.next.outbox, stepped.cid] },
                };
            }
        }
    }
    const drained = await drainRootOutbox(port, stepped.next.rootJobs);
    const rpcOk = drained.rest.length === 0;
    const next = {
        ...stepped.next,
        rootJobs: drained.rest,
        degraded: drained.degraded.length > 0 ? drained.degraded : stepped.next.degraded,
        lagTicks: rpcOk ? stepped.next.lagTicks : stepped.next.lagTicks + 1n,
    };
    const liveRoot = rpcOk ? rootHex : "";
    const liveCid = flags.ipfs && rpcOk ? cidHex : "";
    const degraded = next.degraded.length > 0;
    return {
        rootHex: liveRoot,
        cidHex: liveCid,
        badge: attestBadge(liveRoot, liveCid, degraded),
        degraded: next.degraded,
        next,
    };
}
