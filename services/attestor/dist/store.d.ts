export type RootStore = {
    putMinute(wallS: bigint, root: Uint8Array): void;
    getMinute(wallS: bigint): Uint8Array | undefined;
    putCityDay(key: string, cid: Uint8Array): void;
    getCityDay(key: string): Uint8Array | undefined;
};
export declare function memoryRootStore(): RootStore;
