import { canonical } from "./canonical.js"
import { asDict, asStr, TickError } from "./values.js"
import type { Dict } from "./values.js"

function isBool(value: unknown): boolean {
  return value === true || value === false
}

function isInt(value: unknown): boolean {
  return typeof value === "bigint" && !isBool(value)
}

function isStr(value: unknown): boolean {
  return typeof value === "string"
}

function validateValue(value: unknown, fieldSpec: Dict, path: string, fieldName: string): string[] {
  const errors: string[] = []
  if (value === null) {
    errors.push(`${path}: null is forbidden in layout v1 (use empty string)`)
    return errors
  }
  if (typeof value === "number") {
    errors.push(`${path}: float is forbidden`)
    return errors
  }
  const ftype = asStr(fieldSpec["type"])
  const unit = asStr(fieldSpec["unit"])
  if (unit === "bps" && !fieldName.endsWith("_bps")) {
    errors.push(`${path}: bps value must use a _bps suffix`)
  }
  if (ftype === "int") {
    if (isBool(value)) {
      errors.push(`${path}: bool is not a legal int (True serialises as true, changing bytes)`)
    } else if (!isInt(value)) {
      errors.push(`${path}: expected int, got ${typeof value}`)
    }
  } else if (ftype === "str") {
    if (!isStr(value)) {
      errors.push(`${path}: expected str, got ${typeof value}`)
    }
  } else if (ftype === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path}: expected object, got ${typeof value}`)
    } else {
      const inner = asDict(fieldSpec["of"])
      errors.push(...validateObject(value as Dict, inner, path))
    }
  } else {
    errors.push(`${path}: unknown spec type ${JSON.stringify(ftype)}`)
  }
  return errors
}

function validateObject(obj: Dict, fields: Dict, path: string): string[] {
  const errors: string[] = []
  for (const key of Object.keys(obj)) {
    if (!(key in fields)) {
      errors.push(`${path}.${key}: extra field`)
    }
  }
  for (const key of Object.keys(fields)) {
    const child = `${path}.${key}`
    if (!(key in obj)) {
      errors.push(`${child}: missing field`)
    } else {
      errors.push(...validateValue(obj[key], asDict(fields[key]), child, key))
    }
  }
  return errors
}

function validate(obj: unknown, spec: Dict, kind: string): string[] {
  const errors: string[] = []
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return [`${kind}: expected dict`]
  }
  const rec = obj as Dict
  const fields = spec["fields"]
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    errors.push(`${kind}: spec.fields must be an object`)
    return errors
  }
  if (!("layout_version" in spec)) {
    errors.push(`${kind}: spec.layout_version missing`)
  }
  errors.push(...validateObject(rec, fields as Dict, kind))
  if ("layout_version" in rec && "layout_version" in spec) {
    const got = rec["layout_version"]
    const want = spec["layout_version"]
    if (typeof got === "bigint" && typeof want === "bigint" && got !== want) {
      errors.push(`${kind}.layout_version ${String(got)} != spec ${String(want)}`)
    }
  }
  return errors
}

export function validateRecord(rec: Dict, spec: Dict): string[] {
  return validate(rec, spec, "record")
}

export function validateHeader(hdr: Dict, spec: Dict): string[] {
  return validate(hdr, spec, "header")
}

export function encodeRecord(rec: Dict, spec: Dict): Uint8Array {
  const errors = validateRecord(rec, spec)
  if (errors.length > 0) {
    throw new Error("encode_record: " + errors.join("; "))
  }
  return canonical(rec)
}

export function encodeHeader(hdr: Dict, spec: Dict): Uint8Array {
  const errors = validateHeader(hdr, spec)
  if (errors.length > 0) {
    throw new Error("encode_header: " + errors.join("; "))
  }
  return canonical(hdr)
}

export function requireRecord(rec: Dict, spec: Dict, tickIndex: bigint, cityId: string): void {
  const errors = validateRecord(rec, spec)
  if (errors.length > 0) {
    throw new TickError("RECORD_LAYOUT", tickIndex, cityId, { n: BigInt(errors.length) })
  }
}

export function requireHeader(hdr: Dict, spec: Dict, tickIndex: bigint, cityId: string): void {
  const errors = validateHeader(hdr, spec)
  if (errors.length > 0) {
    throw new TickError("HEADER_LAYOUT", tickIndex, cityId, { n: BigInt(errors.length) })
  }
}
