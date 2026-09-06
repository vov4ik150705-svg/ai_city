import { type PackCtx } from "./pack_ctx.js";
import type { Store } from "./store.js";
export type Readiness = {
    readonly ready: boolean;
    readonly pack_hash: string;
    readonly migration_version: bigint;
};
export declare function readMigrationHead(store: Store): Promise<{
    hash: string;
    version: bigint;
} | undefined>;
export declare function evaluateReadiness(ctx: PackCtx, store: Store, expectVersion: bigint): Promise<Readiness>;
export declare function readinessRequiresPack(ctx: PackCtx): boolean;
