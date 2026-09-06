import { codes } from "@corporator/protocol"

export type Json =
  | bigint
  | string
  | boolean
  | null
  | Json[]
  | { readonly [key: string]: Json }

export class LoadError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export function isLoadError(value: unknown): value is LoadError {
  return value instanceof LoadError
}

export function asDict(value: Json | undefined): { readonly [key: string]: Json } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new LoadError(codes.API_MALFORMED)
  }
  return value
}

export function bytesEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function copyBytes(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length)
  out.set(data)
  return out
}

export function nibbleShift(): number {
  const t = 1 + 1
  return t * t
}

export function nibbleMask(): number {
  return nibbleShift() * nibbleShift() - 1
}

export function controlCeil(): number {
  const t = 1 + 1
  return t * t * t * t * t
}
