import type { Json } from "./values.js"
import { TickError, controlCeil, nibbleMask, nibbleShift, utf8 } from "./values.js"

function isJson(value: unknown): value is Json {
  if (typeof value === "bigint" || typeof value === "string" || typeof value === "boolean") {
    return true
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isJson(item)) return false
    }
    return true
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const child = (value as { [k: string]: unknown })[key]
      if (!isJson(child)) return false
    }
    return true
  }
  return false
}

export function assertNoFloats(value: unknown, path: string = "$"): void {
  if (typeof value === "number") {
    throw new TickError("I9_FLOAT", 0n, "-", { bad: 1n })
  }
  if (value === null) {
    throw new Error(`${path}: null is forbidden in layout v1`)
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoFloats(value[i], `${path}[${String(i)}]`)
    }
    return
  }
  if (value !== undefined && typeof value === "object") {
    for (const key of Object.keys(value)) {
      assertNoFloats((value as { [k: string]: unknown })[key], `${path}.${key}`)
    }
  }
}

function escapeString(text: string): string {
  let out = "\""
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? ""
    const code = ch.charCodeAt(0)
    if (ch === "\"" || ch === "\\") {
      out += "\\" + ch
    } else if (ch === "\b") {
      out += "\\b"
    } else if (ch === "\f") {
      out += "\\f"
    } else if (ch === "\n") {
      out += "\\n"
    } else if (ch === "\r") {
      out += "\\r"
    } else if (ch === "\t") {
      out += "\\t"
    } else if (code < controlCeil()) {
      const hex = "0123456789abcdef"
      const hi = (code >> nibbleShift()) & nibbleMask()
      const lo = code & nibbleMask()
      const h = hex[hi] ?? "0"
      const l = hex[lo] ?? "0"
      out += "\\u00" + h + l
    } else {
      out += ch
    }
  }
  out += "\""
  return out
}

function printInt(value: bigint): string {
  if (value === 0n) return "0"
  return value.toString()
}

function canonicalText(value: Json): string {
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "bigint") return printInt(value)
  if (typeof value === "string") return escapeString(value)
  if (Array.isArray(value)) {
    let body = ""
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      if (item === undefined) {
        throw new Error("canonical: hole in array")
      }
      if (i > 0) body += ","
      body += canonicalText(item)
    }
    return "[" + body + "]"
  }
  const keys = Object.keys(value).sort()
  let body = ""
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (key === undefined) continue
    const child = value[key]
    if (child === undefined) {
      throw new Error(`canonical: missing ${key}`)
    }
    if (i > 0) body += ","
    body += escapeString(key) + ":" + canonicalText(child)
  }
  return "{" + body + "}"
}

export function asJson(value: unknown): Json {
  if (!isJson(value)) {
    throw new Error("canonical: value is not json")
  }
  return value
}

export function canonical(value: unknown): Uint8Array {
  assertNoFloats(value)
  const json = asJson(value)
  return utf8(canonicalText(json))
}
