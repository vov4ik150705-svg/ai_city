export type ReadyListen = {
    readonly port: bigint;
    close(): Promise<void>;
};
export declare function listenReady(hash: string, port: bigint): Promise<ReadyListen>;
