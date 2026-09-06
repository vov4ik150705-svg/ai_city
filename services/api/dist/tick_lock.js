import { bytesEq, utf8 } from "@corporator/contentpack";
import { getBytes, payloadHash } from "./store.js";
export function memoryTickLock(held, replicaId) {
    return {
        async tryAcquire(cityId) {
            const owner = held.get(cityId);
            if (owner === undefined) {
                held.set(cityId, replicaId);
                return true;
            }
            return owner === replicaId;
        },
        async release(cityId) {
            if (held.get(cityId) === replicaId)
                held.delete(cityId);
        },
    };
}
export function pgTickLock(store, replicaId) {
    const payload = utf8(replicaId);
    const hash = payloadHash(payload);
    return {
        async tryAcquire(cityId) {
            const inserted = await store.query(`INSERT INTO tick_locks (id, payload, payload_hash) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING RETURNING id`, [cityId, payload, hash]);
            if (inserted.length > 0)
                return true;
            const existing = await getBytes(store, "tick_locks", cityId);
            if (existing === undefined)
                return false;
            return bytesEq(existing, payload);
        },
        async release(cityId) {
            await store.query(`DELETE FROM tick_locks WHERE id = $1 AND payload_hash = $2`, [cityId, hash]);
        },
    };
}
