import { LoadError, type Json } from "@corporator/contentpack"
import type { Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"

export { LoadError }
export type { Json, Dict }

export function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new LoadError(codes.API_MALFORMED)
  }
  return value
}

export function asEngineDict(value: unknown): Dict {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Dict
  }
  return {}
}

export function asBigint(value: unknown, fallback: bigint = 0n): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "string" && value.length > 0) return BigInt(value)
  if (value === undefined || value === null) return fallback
  if (typeof value === "number" || typeof value === "boolean") {
    throw new LoadError(codes.API_MALFORMED)
  }
  return fallback
}

export function asText(value: unknown, fallback: string = ""): string {
  if (typeof value === "string") return value
  return fallback
}

export function walk(root: Json, parts: readonly string[]): Json {
  let cur: Json = root
  for (const part of parts) {
    const obj = asObj(cur)
    const next = obj[part]
    if (next === undefined) throw new LoadError(codes.API_MALFORMED)
    cur = next
  }
  return cur
}

export function jsonToDict(value: Json): Dict {
  return value as unknown as Dict
}
