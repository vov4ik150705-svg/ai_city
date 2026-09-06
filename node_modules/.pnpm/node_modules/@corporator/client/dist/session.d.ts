export type SessionOk = {
    readonly sessionId: string;
    readonly cityId: string;
    readonly accountKind: string;
};
export type PostJson = (url: string, body: Uint8Array) => Promise<{
    readonly status: number;
    readonly body: Uint8Array;
}>;
export declare function openDemoSession(origin: string, post: PostJson): Promise<SessionOk | undefined>;
export declare function openWalletSession(args: {
    readonly origin: string;
    readonly address: string;
    readonly sign: (message: string) => Promise<string>;
    readonly post: PostJson;
}): Promise<SessionOk | undefined>;
export declare function authHeaders(sessionId: string): {
    readonly [name: string]: string;
};
