import { type Json } from "@corporator/contentpack";
export type Row = {
    readonly [key: string]: unknown;
};
export type Store = {
    exec(sql: string): Promise<void>;
    query(sql: string, params: readonly unknown[]): Promise<readonly Row[]>;
    close(): Promise<void>;
};
export declare function openPglite(): Promise<Store>;
export declare function openPg(url: string): Promise<Store>;
export declare function payloadHash(bytes: Uint8Array): string;
export declare function putBytes(store: Store, table: string, id: string, payload: Uint8Array, accountKind: string | undefined): Promise<void>;
export declare function getBytes(store: Store, table: string, id: string): Promise<Uint8Array | undefined>;
export declare function listBytes(store: Store, table: string, prefix: string): Promise<readonly {
    readonly id: string;
    readonly payload: Uint8Array;
}[]>;
export declare function putJson(store: Store, table: string, id: string, value: Json, accountKind: string | undefined): Promise<void>;
