import { codes } from "@corporator/protocol";
export function asObj(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(codes.API_MALFORMED);
    }
    return value;
}
export function asBig(value) {
    if (typeof value === "bigint")
        return value;
    throw new Error(codes.API_MALFORMED);
}
export function asText(value) {
    if (typeof value === "string")
        return value;
    throw new Error(codes.API_MALFORMED);
}
export function asFlag(value) {
    if (value === true || value === 1n)
        return true;
    if (value === false || value === 0n)
        return false;
    throw new Error(codes.API_MALFORMED);
}
export function asList(value) {
    if (!Array.isArray(value))
        throw new Error(codes.API_MALFORMED);
    return value;
}
export function paramV(section, name) {
    const row = asObj(asObj(asObj(section)["params"])[name]);
    return asBig(row["v"]);
}
