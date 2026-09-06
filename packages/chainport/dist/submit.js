import { codes } from "@corporator/protocol";
import { err } from "./values.js";
// Fail-open: a down RPC must not throw into the attestor or the tick. docs/TICK.md §9.
export async function submitMinuteRoot(port, cityId, cityDay, rootHex) {
    try {
        return await port.merkleRoots.putRoot(cityId, cityDay, rootHex);
    }
    catch {
        return err(codes.SERVICE_DEGRADED);
    }
}
