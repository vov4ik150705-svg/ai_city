import { type Json, type LoadedPack } from "@corporator/contentpack";
import { type Dict } from "@corporator/engine";
export type TableSpec = {
    readonly accountKind: boolean;
    readonly money: boolean;
};
export type MetricSpec = {
    readonly invariant: string;
    readonly service: string;
    readonly thresholdSrc: string;
    readonly observeSrc: string;
    readonly alertChannel: string;
};
export type PackCtx = {
    readonly pack: Json;
    readonly hash: string;
    readonly cfg: Dict;
    readonly rulesVersion: string;
    readonly ticksDay: bigint;
    readonly snapshotEvery: bigint;
    readonly rateLimit: bigint;
    readonly staleCode: string;
    readonly replayCode: string;
    readonly domainHttp: bigint;
    readonly httpOk: bigint;
    readonly commandPaths: readonly string[];
    readonly commandTemplate: string;
    readonly authNonceTemplate: string;
    readonly authSessionTemplate: string;
    readonly sessionMessageFields: readonly string[];
    readonly sessionDomain: string;
    readonly sessionHeader: string;
    readonly sessionScheme: string;
    readonly sessionTtlCity: bigint;
    readonly nonceTtlCity: bigint;
    readonly stateTemplate: string;
    readonly packTemplate: string;
    readonly packCache: string;
    readonly readyTemplate: string;
    readonly wsTemplate: string;
    readonly envelopeOk: readonly string[];
    readonly envelopeErr: readonly string[];
    readonly refusals: {
        readonly [effect: string]: readonly string[];
    };
    readonly stubEffects: ReadonlySet<string>;
    readonly stateSources: readonly string[];
    readonly metrics: {
        readonly [id: string]: MetricSpec;
    };
    readonly readinessRequires: readonly string[];
    readonly services: {
        readonly [id: string]: {
            readonly failMode: string;
            readonly blocksTick: bigint;
        };
    };
    readonly schemaTables: {
        readonly [tid: string]: TableSpec;
    };
};
export declare function makeCtx(loaded: LoadedPack): PackCtx;
export declare function codeSlots(ctx: PackCtx, code: string): readonly string[];
export declare function commitPathsFromPack(ctx: PackCtx): readonly string[];
export declare function applyTemplate(template: string, param: string, value: string): string;
export declare function matchTemplate(template: string, path: string): {
    readonly [key: string]: string;
} | undefined;
