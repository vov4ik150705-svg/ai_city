import { LoadError, asDict, controlCeil, nibbleMask, nibbleShift } from "./values.js";
import { utf8 } from "./utf8.js";
import { codes } from "@corporator/protocol";
function isJson(value) {
    if (value === null)
        return true;
    if (typeof value === "bigint" || typeof value === "string" || typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            if (!isJson(item))
                return false;
        }
        return true;
    }
    if (typeof value === "object") {
        for (const key of Object.keys(value)) {
            const child = value[key];
            if (!isJson(child))
                return false;
        }
        return true;
    }
    return false;
}
export function assertNoFloats(value) {
    if (typeof value === "number") {
        throw new LoadError(codes.API_MALFORMED);
    }
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            assertNoFloats(value[i]);
        }
        return;
    }
    if (value !== null && value !== undefined && typeof value === "object") {
        for (const key of Object.keys(value)) {
            assertNoFloats(value[key]);
        }
    }
}
function escapeString(text) {
    let out = "\"";
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] ?? "";
        const code = ch.charCodeAt(0);
        if (ch === "\"" || ch === "\\") {
            out += "\\" + ch;
        }
        else if (ch === "\b") {
            out += "\\b";
        }
        else if (ch === "\f") {
            out += "\\f";
        }
        else if (ch === "\n") {
            out += "\\n";
        }
        else if (ch === "\r") {
            out += "\\r";
        }
        else if (ch === "\t") {
            out += "\\t";
        }
        else if (code < controlCeil()) {
            const hex = "0123456789abcdef";
            const hi = (code >> nibbleShift()) & nibbleMask();
            const lo = code & nibbleMask();
            const h = hex[hi] ?? "0";
            const l = hex[lo] ?? "0";
            out += "\\u00" + h + l;
        }
        else {
            out += ch;
        }
    }
    out += "\"";
    return out;
}
function printInt(value) {
    if (value === 0n)
        return "0";
    return value.toString();
}
function canonicalText(value) {
    if (value === null)
        return "null";
    if (typeof value === "boolean")
        return value ? "true" : "false";
    if (typeof value === "bigint")
        return printInt(value);
    if (typeof value === "string")
        return escapeString(value);
    if (Array.isArray(value)) {
        let body = "";
        for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (item === undefined) {
                throw new LoadError(codes.API_MALFORMED);
            }
            if (i > 0)
                body += ",";
            body += canonicalText(item);
        }
        return "[" + body + "]";
    }
    const keys = Object.keys(value).sort();
    let body = "";
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === undefined)
            continue;
        const child = value[key];
        if (child === undefined) {
            throw new LoadError(codes.API_MALFORMED);
        }
        if (i > 0)
            body += ",";
        body += escapeString(key) + ":" + canonicalText(child);
    }
    return "{" + body + "}";
}
export function asJson(value) {
    if (!isJson(value)) {
        throw new LoadError(codes.API_MALFORMED);
    }
    return value;
}
export function canonical(value) {
    assertNoFloats(value);
    const json = asJson(value);
    return utf8(canonicalText(json));
}
export function withoutHash(root) {
    const obj = asDict(root);
    const out = {};
    for (const key of Object.keys(obj)) {
        if (key === "hash")
            continue;
        const child = obj[key];
        if (child === undefined)
            continue;
        out[key] = child;
    }
    return out;
}
