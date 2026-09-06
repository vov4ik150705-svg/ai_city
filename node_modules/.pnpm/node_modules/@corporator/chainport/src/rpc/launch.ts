import type { RpcOutcome } from "../values.js"
import { dataCreatorTaxBps, decodeUint, isAddr } from "./abi.js"
import { postEth, type JsonRpcPost } from "./jsonrpc.js"

export type LaunchIntent = {
  readonly valueWei: bigint
  readonly taxBps: bigint
}

const RAW_TX = /^0x[0-9a-fA-F]+$/

export function launchIntent(shareBps: bigint, taxBps: bigint): LaunchIntent | undefined {
  // docs/LAUNCH.md §4: share 0 means no ETH on the launch tx.
  if (shareBps !== 0n) return undefined
  return { valueWei: 0n, taxBps }
}

export async function postSignedRaw(post: JsonRpcPost, signedRaw: string): Promise<RpcOutcome> {
  if (!RAW_TX.test(signedRaw) || signedRaw.length < 4) return { status: "silence" }
  return postEth(post, "eth_sendRawTransaction", [signedRaw])
}

export async function readCreatorTaxBps(post: JsonRpcPost, curve: string): Promise<bigint | undefined> {
  if (!isAddr(curve)) return undefined
  const data = dataCreatorTaxBps()
  if (data.length === 0) return undefined
  const raw = await postEth(post, "eth_call", [{ to: curve, data }, "latest"])
  if (raw.status !== "ok") return undefined
  return decodeUint(raw.body)
}
