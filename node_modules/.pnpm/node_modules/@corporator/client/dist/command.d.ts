import { type Json } from "@corporator/contentpack";
export type PostFn = (url: string, body: Uint8Array, headers: {
    readonly [name: string]: string;
}) => Promise<{
    readonly status: number;
    readonly body: Uint8Array;
}>;
export declare function applyPath(template: string, param: string, value: string): string;
export declare function postCommand(args: {
    readonly origin: string;
    readonly effect: string;
    readonly commandTemplate: string;
    readonly cityId: string;
    readonly intentId: string;
    readonly expectedCityTime: bigint;
    readonly sessionId: string;
    readonly extra?: {
        readonly [key: string]: Json;
    };
    readonly post: PostFn;
}): Promise<{
    readonly status: number;
    readonly body: Uint8Array;
}>;
export declare function nextIntentId(cityId: string, cityTime: bigint, seq: bigint): string;
