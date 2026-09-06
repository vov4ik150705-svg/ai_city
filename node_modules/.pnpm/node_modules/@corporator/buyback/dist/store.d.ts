import { type Json } from "@corporator/contentpack";
import type { BatchStamps } from "./policy.js";
export type BatchStore = {
    put(batchId: string, payload: Uint8Array): void;
    get(batchId: string): Uint8Array | undefined;
};
export declare function memoryBatchStore(): BatchStore;
export declare function batchJson(batchId: string, sendWei: bigint, stamps: BatchStamps): Json;
export declare function publishBatch(store: BatchStore, batchId: string, sendWei: bigint, stamps: BatchStamps): void;
