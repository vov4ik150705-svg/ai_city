import type { Json } from "./values.js"

export function assembleSessionMessage(
  fields: readonly string[],
  values: { readonly [key: string]: string },
): string {
  const lines: string[] = []
  for (const key of fields) {
    const val = values[key]
    if (val === undefined) throw new Error("session message")
    lines.push(key + "=" + val)
  }
  return lines.join("\n")
}

export function sessionMessageValues(args: {
  readonly domain: string
  readonly address: string
  readonly nonce: string
  readonly packHash: string
  readonly expiresCityTime: string
}): { readonly [key: string]: string } {
  const out: { [key: string]: string } = {
    domain: args.domain,
    address: args.address,
    nonce: args.nonce,
    pack_hash: args.packHash,
    expires_city_time: args.expiresCityTime,
  }
  return out
}

export type { Json }
