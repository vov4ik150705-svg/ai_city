import { type Json } from "@corporator/contentpack";
import { type Dict } from "@corporator/engine";
import { type PackCtx } from "./pack_ctx.js";
export type MetricView = {
    readonly id: string;
    readonly invariant: string;
    readonly service: string;
    readonly thresholdSrc: string;
    readonly observeSrc: string;
    readonly alertChannel: string;
    readonly threshold: Json;
};
export type LiveMetric = MetricView & {
    readonly observed: Json;
};
export declare function observeValue(pack: Json, state: Dict, src: string): Json;
export declare function observeFromState(ctx: PackCtx, state: Dict): {
    readonly [id: string]: Json;
};
export declare function metricsFromPack(ctx: PackCtx): readonly MetricView[];
export declare function observedFromThresholds(rows: readonly MetricView[]): {
    readonly [id: string]: Json;
};
export declare function exportLive(ctx: PackCtx, observed: {
    readonly [id: string]: Json;
}): readonly LiveMetric[];
export declare function ageAlertFiresBeforeDecay(age: bigint, alertHours: bigint, staleHours: bigint): boolean;
export declare function liveMetricsJson(rows: readonly LiveMetric[]): Json;
