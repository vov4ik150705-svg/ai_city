export type LlmPack = {
    readonly hash: string;
    readonly queueCapacity: bigint;
    readonly onProviderFail: string;
    readonly templateText: string;
    readonly templateCode: string;
    readonly blocksTick: bigint;
    readonly failMode: string;
};
export declare function loadLlmPack(bytes: Uint8Array): LlmPack;
export declare function queueCapacityOk(pack: LlmPack): boolean;
