export type SampleStore = {
    putPriceDay(cityDay: bigint, payload: Uint8Array): void;
    getPriceDay(cityDay: bigint): Uint8Array | undefined;
};
export declare function memoryStore(): SampleStore;
