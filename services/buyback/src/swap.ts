import {
  addressOfPrivateKey,
  gasLimitOf,
  postEth,
  signLegacyTx,
  type JsonRpcPost,
} from "@corporator/chainport"
import type { HopLog } from "./hop.js"

const inflight = new Map<string, { readonly hash: string; readonly token: string }>()

export function resetSwapInflight(): void {
  inflight.clear()
}

export type SwapSend = {
  readonly post: JsonRpcPost
  readonly chainId: bigint
  readonly bps: bigint
  readonly gasHeadroomBps: bigint
  readonly privateKey: string
  readonly executor: string
  readonly to: string
  readonly data: string
  readonly value: bigint
  readonly token: string
}

function hexUint(raw: string): bigint | undefined {
  if (!raw.startsWith("0x") && !raw.startsWith("0X")) return undefined
  if (raw === "0x" || raw === "0X") return 0n
  try {
    return BigInt(raw)
  } catch {
    return undefined
  }
}

function hexOf(n: bigint): string {
  return "0x" + n.toString(16)
}

function same(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function logsOf(body: string): readonly HopLog[] | undefined {
  if (body === "null") return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(body) as unknown
  } catch {
    return []
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return []
  const row = parsed as { readonly status?: unknown; readonly logs?: unknown }
  if (row.status !== "0x1" && row.status !== "0X1") return []
  if (!Array.isArray(row.logs)) return []
  const out: HopLog[] = []
  for (const item of row.logs) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const log = item as { readonly address?: unknown; readonly topics?: unknown; readonly data?: unknown }
    if (typeof log.address !== "string" || typeof log.data !== "string" || !Array.isArray(log.topics)) continue
    const topics: string[] = []
    for (const topic of log.topics) {
      if (typeof topic === "string") topics.push(topic)
    }
    out.push({ address: log.address, topics, data: log.data })
  }
  return out
}

async function receiptLogs(post: JsonRpcPost, hash: string): Promise<readonly HopLog[] | undefined> {
  const rec = await postEth(post, "eth_getTransactionReceipt", [hash])
  if (rec.status !== "ok") return undefined
  return logsOf(rec.body)
}

async function sendSwap(args: SwapSend, from: string): Promise<string | undefined> {
  const chain = await postEth(args.post, "eth_chainId", [])
  if (chain.status !== "ok") return undefined
  const gotChain = hexUint(chain.body)
  if (gotChain === undefined || gotChain !== args.chainId) return undefined
  const nonceRaw = await postEth(args.post, "eth_getTransactionCount", [from, "pending"])
  if (nonceRaw.status !== "ok") return undefined
  const nonce = hexUint(nonceRaw.body)
  if (nonce === undefined) return undefined
  const priceRaw = await postEth(args.post, "eth_gasPrice", [])
  if (priceRaw.status !== "ok") return undefined
  const gasPrice = hexUint(priceRaw.body)
  if (gasPrice === undefined) return undefined
  const estimateRaw = await postEth(args.post, "eth_estimateGas", [
    { from, to: args.to, data: args.data, value: hexOf(args.value) },
  ])
  if (estimateRaw.status !== "ok") return undefined
  const estimate = hexUint(estimateRaw.body)
  if (estimate === undefined) return undefined
  const gasLimit = gasLimitOf(estimate, args.bps, args.gasHeadroomBps)
  if (gasLimit === undefined) return undefined
  const signed = signLegacyTx({
    privateKey: args.privateKey,
    chainId: args.chainId,
    nonce,
    gasPrice,
    gasLimit,
    to: args.to,
    data: args.data,
    value: args.value,
  })
  if (signed === undefined) return undefined
  const sent = await postEth(args.post, "eth_sendRawTransaction", [signed.raw])
  if (sent.status !== "ok" || sent.body.length === 0 || sent.body === "null") return undefined
  return sent.body
}

export async function receiptOrSend(args: SwapSend): Promise<readonly HopLog[]> {
  const from = addressOfPrivateKey(args.privateKey)
  if (from === undefined || !same(from, args.executor) || args.value < 0n) return []
  const key = from.toLowerCase()
  const pending = inflight.get(key)
  if (pending !== undefined) {
    if (!same(pending.token, args.token)) return []
    const logs = await receiptLogs(args.post, pending.hash)
    if (logs === undefined) return []
    inflight.delete(key)
    return logs
  }
  const hash = await sendSwap(args, from)
  if (hash === undefined) return []
  inflight.set(key, { hash, token: args.token })
  const logs = await receiptLogs(args.post, hash)
  if (logs === undefined) return []
  inflight.delete(key)
  return logs
}
