import { codes } from "@corporator/protocol"

export function asObj(value: unknown): { readonly [key: string]: unknown } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(codes.API_MALFORMED)
  }
  return value as { readonly [key: string]: unknown }
}

export function asBig(value: unknown): bigint {
  if (typeof value === "bigint") return value
  throw new Error(codes.API_MALFORMED)
}

export function asMaybeBig(value: unknown): bigint | undefined {
  if (value === undefined) return undefined
  if (typeof value === "bigint") return value
  return undefined
}

export function asText(value: unknown): string {
  if (typeof value === "string") return value
  throw new Error(codes.API_MALFORMED)
}

export function asFlag(value: unknown): boolean {
  if (value === true || value === 1n) return true
  if (value === false || value === 0n) return false
  throw new Error(codes.API_MALFORMED)
}

export function asList(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(codes.API_MALFORMED)
  return value
}

export function paramV(section: unknown, name: string): bigint {
  const row = asObj(asObj(asObj(section)["params"])[name])
  return asBig(row["v"])
}
