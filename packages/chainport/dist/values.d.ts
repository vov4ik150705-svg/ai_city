export type PortKind = "mock" | "rpc";
export type PortOk = {
    readonly ok: true;
};
export type PortErr = {
    readonly ok: false;
    readonly code: string;
};
export type PortResult = PortOk | PortErr;
export type PortAmount = (PortOk & {
    readonly amount: bigint;
}) | PortErr;
export type PortConfig = {
    readonly voucherTtlS: bigint;
    readonly voucherSignerService: string;
    readonly buybackExecutorService: string;
};
export type Voucher = {
    readonly nonce: string;
    readonly account: string;
    readonly corpAmount: bigint;
    readonly issuedAtS: bigint;
};
export type StakeRow = {
    readonly ticker: string;
    readonly amount: bigint;
};
export type MockSeed = {
    readonly corp?: {
        readonly [account: string]: bigint;
    };
};
export type RpcOutcome = {
    readonly status: "ok";
    readonly body: string;
} | {
    readonly status: "silence";
} | {
    readonly status: "lie";
    readonly body: string;
};
export type RpcTransport = {
    call(method: string, args: readonly string[]): Promise<RpcOutcome>;
};
export declare function silentTransport(): RpcTransport;
export type WalletPrice = {
    readonly chain: string;
    readonly corp: bigint;
};
export declare function isPortKind(kind: string): kind is PortKind;
export declare function ok(): PortOk;
export declare function err(code: string): PortErr;
export declare function amountOk(amount: bigint): PortAmount;
export declare function mapGet(map: ReadonlyMap<string, bigint>, id: string): bigint;
