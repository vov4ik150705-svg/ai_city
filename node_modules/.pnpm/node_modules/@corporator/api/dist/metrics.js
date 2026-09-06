import { LoadError } from "@corporator/contentpack";
import { codes } from "@corporator/protocol";
import {} from "@corporator/engine";
import {} from "./pack_ctx.js";
import { asObj, walk } from "./values.js";
function tryWalk(root, parts) {
    let cur = root;
    for (const part of parts) {
        if (cur === null || typeof cur !== "object" || Array.isArray(cur))
            return undefined;
        const obj = cur;
        const next = obj[part];
        if (next === undefined)
            return undefined;
        cur = next;
    }
    return cur;
}
function thresholdValue(pack, src) {
    const parts = src.split(".");
    const head = parts[0];
    if (head === undefined)
        return src;
    let got;
    if (head === "generated") {
        got = tryWalk(pack, parts);
    }
    else if (parts[1] === "derived") {
        got = tryWalk(pack, ["generated", head, ...parts.slice(1 + 1)]);
    }
    else {
        got = tryWalk(pack, ["sections", ...parts]);
    }
    if (got === undefined)
        return src;
    if (got !== null && typeof got !== "object")
        return got;
    if (got !== null && typeof got === "object" && !Array.isArray(got)) {
        const row = asObj(got);
        const v = row["v"];
        if (v !== undefined)
            return v;
    }
    return got;
}
function asObserved(value) {
    if (Array.isArray(value))
        return BigInt(value.length);
    if (value !== null && typeof value === "object") {
        const row = value;
        if (row["v"] !== undefined)
            return row["v"];
        return BigInt(Object.keys(row).length);
    }
    return value;
}
export function observeValue(pack, state, src) {
    if (src.startsWith("state.")) {
        const key = src.slice("state.".length);
        const got = state[key];
        if (got === undefined)
            throw new LoadError(codes.API_MALFORMED);
        if (typeof got === "bigint" || typeof got === "string")
            return got;
        if (typeof got === "boolean")
            return got ? 1n : 0n;
        throw new LoadError(codes.API_MALFORMED);
    }
    const parts = src.split(".");
    return asObserved(walk(pack, parts));
}
export function observeFromState(ctx, state) {
    const out = {};
    const ids = Object.keys(ctx.metrics).sort();
    for (const id of ids) {
        const spec = ctx.metrics[id];
        if (spec === undefined)
            continue;
        out[id] = observeValue(ctx.pack, state, spec.observeSrc);
    }
    return out;
}
export function metricsFromPack(ctx) {
    const ids = Object.keys(ctx.metrics).sort();
    const out = [];
    for (const id of ids) {
        const spec = ctx.metrics[id];
        if (spec === undefined)
            continue;
        out.push({
            id,
            invariant: spec.invariant,
            service: spec.service,
            thresholdSrc: spec.thresholdSrc,
            observeSrc: spec.observeSrc,
            alertChannel: spec.alertChannel,
            threshold: thresholdValue(ctx.pack, spec.thresholdSrc),
        });
    }
    return out;
}
export function observedFromThresholds(rows) {
    const out = {};
    for (const row of rows)
        out[row.id] = row.threshold;
    return out;
}
export function exportLive(ctx, observed) {
    const rows = metricsFromPack(ctx);
    const out = [];
    for (const row of rows) {
        const got = observed[row.id];
        if (got === undefined)
            throw new LoadError(codes.API_MALFORMED);
        out.push({
            id: row.id,
            invariant: row.invariant,
            service: row.service,
            thresholdSrc: row.thresholdSrc,
            observeSrc: row.observeSrc,
            alertChannel: row.alertChannel,
            threshold: row.threshold,
            observed: got,
        });
    }
    return out;
}
export function ageAlertFiresBeforeDecay(age, alertHours, staleHours) {
    if (alertHours >= staleHours)
        return false;
    return age >= alertHours && age < staleHours;
}
export function liveMetricsJson(rows) {
    const out = [];
    for (const row of rows) {
        out.push({
            id: row.id,
            observed: row.observed,
            threshold: row.threshold,
            observe_src: row.observeSrc,
            alert_channel: row.alertChannel,
        });
    }
    return out;
}
