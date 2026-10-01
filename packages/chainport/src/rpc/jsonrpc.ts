import type { RpcOutcome } from "../values.js"

export type JsonRpcPost = (body: string) => Promise<string | undefined>

function asRecord(value: unknown): { readonly [key: string]: unknown } | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as { readonly [key: string]: unknown }
}

function noJsonNumber(value: unknown): boolean {
  if (typeof value === "number") return false
  if (value === null || typeof value !== "object") return true
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!noJsonNumber(item)) return false
    }
    return true
  }
  const rec = value as { readonly [key: string]: unknown }
  for (const key of Object.keys(rec)) {
    if (!noJsonNumber(rec[key])) return false
  }
  return true
}

export function fetchPoster(url: string, timeoutMs: bigint): JsonRpcPost {
  return async (body: string): Promise<string | undefined> => {
    const ac = new AbortController()
    const timer = setTimeout(() => {
      ac.abort()
    }, Number(timeoutMs))
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: ac.signal,
      })
      if (!res.ok) return undefined
      return await res.text()
    } catch {
      return undefined
    } finally {
      clearTimeout(timer)
    }
  }
}

export async function postEth(
  post: JsonRpcPost,
  method: string,
  params: readonly unknown[],
): Promise<RpcOutcome> {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: "0", method, params })
  let reply: string | undefined
  try {
    reply = await post(payload)
  } catch {
    return { status: "silence" }
  }
  if (reply === undefined || reply.length === 0) return { status: "silence" }
  let parsed: unknown
  try {
    parsed = JSON.parse(reply) as unknown
  } catch {
    return { status: "lie", body: reply }
  }
  if (!noJsonNumber(parsed)) return { status: "silence" }
  const row = asRecord(parsed)
  if (row === undefined) return { status: "lie", body: reply }
  if (row["error"] !== undefined) return { status: "silence" }
  const result = row["result"]
  if (typeof result === "string") return { status: "ok", body: result }
  if (result === true) return { status: "ok", body: "0x" }
  if (result === null) return { status: "ok", body: "null" }
  if (typeof result === "object") return { status: "ok", body: JSON.stringify(result) }
  if (result === undefined) return { status: "silence" }
  return { status: "silence" }
}
