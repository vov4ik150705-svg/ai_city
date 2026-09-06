import { type Store } from "./store.js";
export type TickLock = {
    tryAcquire(cityId: string): Promise<boolean>;
    release(cityId: string): Promise<void>;
};
export declare function memoryTickLock(held: Map<string, string>, replicaId: string): TickLock;
export declare function pgTickLock(store: Store, replicaId: string): TickLock;
