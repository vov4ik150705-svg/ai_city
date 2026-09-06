import { type Store } from "./store.js";
export declare function versionFromFilename(name: string): bigint;
export declare function applyMigration(store: Store, sql: string, filename: string, packHash: string): Promise<bigint>;
