import { canonical } from "./canonical.js";
import { asDict, asStr, TickError } from "./values.js";
function isBool(value) {
    return value === true || value === false;
}
function isInt(value) {
    return typeof value === "bigint" && !isBool(value);
}
function isStr(value) {
    return typeof value === "string";
}
function validateValue(value, fieldSpec, path, fieldName) {
    const errors = [];
    if (value === null) {
        errors.push(`${path}: null is forbidden in layout v1 (use empty string)`);
        return errors;
    }
    if (typeof value === "number") {
        errors.push(`${path}: float is forbidden`);
        return errors;
    }
    const ftype = asStr(fieldSpec["type"]);
    const unit = asStr(fieldSpec["unit"]);
    if (unit === "bps" && !fieldName.endsWith("_bps")) {
        errors.push(`${path}: bps value must use a _bps suffix`);
    }
    if (ftype === "int") {
        if (isBool(value)) {
            errors.push(`${path}: bool is not a legal int (True serialises as true, changing bytes)`);
        }
        else if (!isInt(value)) {
            errors.push(`${path}: expected int, got ${typeof value}`);
        }
    }
    else if (ftype === "str") {
        if (!isStr(value)) {
            errors.push(`${path}: expected str, got ${typeof value}`);
        }
    }
    else if (ftype === "object") {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            errors.push(`${path}: expected object, got ${typeof value}`);
        }
        else {
            const inner = asDict(fieldSpec["of"]);
            errors.push(...validateObject(value, inner, path));
        }
    }
    else {
        errors.push(`${path}: unknown spec type ${JSON.stringify(ftype)}`);
    }
    return errors;
}
function validateObject(obj, fields, path) {
    const errors = [];
    for (const key of Object.keys(obj)) {
        if (!(key in fields)) {
            errors.push(`${path}.${key}: extra field`);
        }
    }
    for (const key of Object.keys(fields)) {
        const child = `${path}.${key}`;
        if (!(key in obj)) {
            errors.push(`${child}: missing field`);
        }
        else {
            errors.push(...validateValue(obj[key], asDict(fields[key]), child, key));
        }
    }
    return errors;
}
function validate(obj, spec, kind) {
    const errors = [];
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
        return [`${kind}: expected dict`];
    }
    const rec = obj;
    const fields = spec["fields"];
    if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
        errors.push(`${kind}: spec.fields must be an object`);
        return errors;
    }
    if (!("layout_version" in spec)) {
        errors.push(`${kind}: spec.layout_version missing`);
    }
    errors.push(...validateObject(rec, fields, kind));
    if ("layout_version" in rec && "layout_version" in spec) {
        const got = rec["layout_version"];
        const want = spec["layout_version"];
        if (typeof got === "bigint" && typeof want === "bigint" && got !== want) {
            errors.push(`${kind}.layout_version ${String(got)} != spec ${String(want)}`);
        }
    }
    return errors;
}
export function validateRecord(rec, spec) {
    return validate(rec, spec, "record");
}
export function validateHeader(hdr, spec) {
    return validate(hdr, spec, "header");
}
export function encodeRecord(rec, spec) {
    const errors = validateRecord(rec, spec);
    if (errors.length > 0) {
        throw new Error("encode_record: " + errors.join("; "));
    }
    return canonical(rec);
}
export function encodeHeader(hdr, spec) {
    const errors = validateHeader(hdr, spec);
    if (errors.length > 0) {
        throw new Error("encode_header: " + errors.join("; "));
    }
    return canonical(hdr);
}
export function requireRecord(rec, spec, tickIndex, cityId) {
    const errors = validateRecord(rec, spec);
    if (errors.length > 0) {
        throw new TickError("RECORD_LAYOUT", tickIndex, cityId, { n: BigInt(errors.length) });
    }
}
export function requireHeader(hdr, spec, tickIndex, cityId) {
    const errors = validateHeader(hdr, spec);
    if (errors.length > 0) {
        throw new TickError("HEADER_LAYOUT", tickIndex, cityId, { n: BigInt(errors.length) });
    }
}
