import { broadcastRoleTx, isAddr, type InflightTx, type JsonRpcPost } from "@corporator/chainport"

const inflight = new Map<string, InflightTx>()

export async function sendStudioEth(args: {
  readonly post: JsonRpcPost
  readonly chainId: bigint
  readonly bps: bigint
  readonly gasHeadroomBps: bigint
  readonly to: string
  readonly wei: bigint
}): Promise<boolean> {
  if (!isAddr(args.to) || args.wei <= 0n) return false
  const sent = await broadcastRoleTx({
    post: args.post,
    chainId: args.chainId,
    bps: args.bps,
    gasHeadroomBps: args.gasHeadroomBps,
    role: "buyback_executor",
    to: args.to,
    data: "0x",
    value: args.wei,
    inflight,
  })
  return sent.status === "ok"
}
