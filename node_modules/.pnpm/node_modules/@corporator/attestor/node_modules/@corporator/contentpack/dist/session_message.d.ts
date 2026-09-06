import type { Json } from "./values.js";
export declare function assembleSessionMessage(fields: readonly string[], values: {
    readonly [key: string]: string;
}): string;
export declare function sessionMessageValues(args: {
    readonly domain: string;
    readonly address: string;
    readonly nonce: string;
    readonly packHash: string;
    readonly expiresCityTime: string;
}): {
    readonly [key: string]: string;
};
export type { Json };
