export class TickError extends Error {
    code;
    tickIndex;
    cityId;
    constructor(code, tickIndex, cityId, nums = {}) {
        const extra = Object.keys(nums)
            .sort()
            .map((k) => `${k}=${String(nums[k] ?? 0n)}`)
            .join(" ");
        super(`${code} tick=${tickIndex.toString()} city=${cityId} ${extra}`);
        this.code = code;
        this.tickIndex = tickIndex;
        this.cityId = cityId;
    }
}
export function at(xs, i) {
    const v = xs[i];
    if (v === undefined) {
        throw new TickError("INDEX", 0n, "-", { i: BigInt(i) });
    }
    return v;
}
export function asBig(value, fallback = 0n) {
    if (value === undefined || value === null)
        return fallback;
    if (typeof value === "bigint")
        return value;
    if (typeof value === "string") {
        if (value === "")
            return fallback;
        return BigInt(value);
    }
    if (typeof value === "boolean") {
        throw new TickError("I9_FLOAT", 0n, "-", { bad: 1n });
    }
    if (typeof value === "number") {
        throw new TickError("I9_FLOAT", 0n, "-", { bad: 1n });
    }
    return fallback;
}
export function asStr(value, fallback = "") {
    if (typeof value === "string")
        return value;
    return fallback;
}
export function asBool(value) {
    return value === true;
}
export function asDict(value) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return {};
}
export function asList(value) {
    return Array.isArray(value) ? value : [];
}
export function paramV(section, name) {
    const sec = asDict(section);
    const params = asDict(sec["params"]);
    const row = asDict(params[name]);
    return asBig(row["v"]);
}
export function pow10(exp) {
    let p = 1n;
    let i = 0n;
    const ten = 1n + 1n + 1n + 1n + 1n + 1n + 1n + 1n + 1n + 1n;
    while (i < exp) {
        p *= ten;
        i += 1n;
    }
    return p;
}
export function two() {
    return 1n + 1n;
}
export function twoNum() {
    return 1 + 1;
}
export { utf8, fromUtf8 } from "./utf8.js";
export function sortedKeys(obj) {
    return Object.keys(obj).sort();
}
export function bytesEq(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
export function concatBytes(parts) {
    let n = 0;
    for (const p of parts)
        n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) {
        out.set(p, o);
        o += p.length;
    }
    return out;
}
export function domainByte(value) {
    const eight = 1n + 1n + 1n + 1n + 1n + 1n + 1n + 1n;
    return new Uint8Array([Number(value % (1n << eight))]);
}
export function clampInt(value, lo, hi) {
    let a = lo;
    let b = hi;
    if (a > b) {
        const t = a;
        a = b;
        b = t;
    }
    if (value < a)
        return a;
    if (value > b)
        return b;
    return value;
}
export function minBig(a, b) {
    return a < b ? a : b;
}
export function maxBig(a, b) {
    return a > b ? a : b;
}
export function max1(value) {
    return value > 1n ? value : 1n;
}
export function nibbleShift() {
    const t = 1 + 1;
    return t * t;
}
export function nibbleMask() {
    return nibbleShift() * nibbleShift() - 1;
}
export function controlCeil() {
    const t = 1 + 1;
    return t * t * t * t * t;
}
