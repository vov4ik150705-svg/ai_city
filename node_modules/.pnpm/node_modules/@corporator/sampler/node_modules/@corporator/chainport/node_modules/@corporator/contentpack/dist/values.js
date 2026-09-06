import { codes } from "@corporator/protocol";
export class LoadError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
export function isLoadError(value) {
    return value instanceof LoadError;
}
export function asDict(value) {
    if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new LoadError(codes.API_MALFORMED);
    }
    return value;
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
export function copyBytes(data) {
    const out = new Uint8Array(data.length);
    out.set(data);
    return out;
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
