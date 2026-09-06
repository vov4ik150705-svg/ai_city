import { LoadError } from "@corporator/contentpack";
import { codes } from "@corporator/protocol";
export { LoadError };
export function asObj(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new LoadError(codes.API_MALFORMED);
    }
    return value;
}
export function asEngineDict(value) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return {};
}
export function asBigint(value, fallback = 0n) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "string" && value.length > 0)
        return BigInt(value);
    if (value === undefined || value === null)
        return fallback;
    if (typeof value === "number" || typeof value === "boolean") {
        throw new LoadError(codes.API_MALFORMED);
    }
    return fallback;
}
export function asText(value, fallback = "") {
    if (typeof value === "string")
        return value;
    return fallback;
}
export function walk(root, parts) {
    let cur = root;
    for (const part of parts) {
        const obj = asObj(cur);
        const next = obj[part];
        if (next === undefined)
            throw new LoadError(codes.API_MALFORMED);
        cur = next;
    }
    return cur;
}
export function jsonToDict(value) {
    return value;
}
