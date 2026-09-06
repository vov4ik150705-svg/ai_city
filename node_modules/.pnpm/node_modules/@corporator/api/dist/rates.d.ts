import { type Store } from "./store.js";
export declare function incrementCommandRate(store: Store, cityId: string, tickIndex: bigint, limit: bigint): Promise<"ok" | "limited">;
export declare function readCommandRate(store: Store, cityId: string, tickIndex: bigint): Promise<bigint>;
