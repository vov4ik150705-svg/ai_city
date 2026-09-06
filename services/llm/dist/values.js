import { LoadError } from "@corporator/contentpack";
import { codes } from "@corporator/protocol";
export { LoadError };
export function asObj(value) {
    if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new LoadError(codes.API_MALFORMED);
    }
    return value;
}
export function asBig(value, fallback = 0n) {
    if (value === undefined || value === null)
        return fallback;
    if (typeof value === "bigint")
        return value;
    if (typeof value === "string" && value.length > 0)
        return BigInt(value);
    if (typeof value === "boolean")
        return value ? 1n : 0n;
    throw new LoadError(codes.API_MALFORMED);
}
export function asText(value, fallback = "") {
    if (typeof value === "string")
        return value;
    if (value === undefined || value === null)
        return fallback;
    throw new LoadError(codes.API_MALFORMED);
}
