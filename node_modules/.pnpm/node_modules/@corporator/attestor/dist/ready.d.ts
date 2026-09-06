export type ReadyListen = {
    readonly port: bigint;
    close(): Promise<void>;
};
export type SubmitFn = (body: Uint8Array) => Promise<Uint8Array>;
export declare function listenReady(hash: string, port: bigint, submit?: SubmitFn): Promise<ReadyListen>;
