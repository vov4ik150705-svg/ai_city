import { canonical } from "@corporator/contentpack";
export function memoryBatchStore() {
    const rows = new Map();
    return {
        put(batchId, payload) {
            rows.set(batchId, payload);
        },
        get(batchId) {
            return rows.get(batchId);
        },
    };
}
export function batchJson(batchId, sendWei, stamps) {
    const row = {
        batch_id: batchId,
        send_wei: sendWei,
    };
    if (stamps.eth_collected !== undefined)
        row["eth_collected"] = stamps.eth_collected;
    if (stamps.corp_bought !== undefined)
        row["corp_bought"] = stamps.corp_bought;
    if (stamps.deposit_confirmed !== undefined)
        row["deposit_confirmed"] = stamps.deposit_confirmed;
    if (stamps.mint !== undefined)
        row["mint"] = stamps.mint;
    return row;
}
export function publishBatch(store, batchId, sendWei, stamps) {
    store.put(batchId, canonical(batchJson(batchId, sendWei, stamps)));
}
