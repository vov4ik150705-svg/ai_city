import type { AssetPort } from "./port.js"
import { type RpcOutcome, type RpcTransport, type StakeRow, type WalletPrice } from "./values.js"
import { decodeChain, rpcMethod } from "./rpc/codec.js"

export function recordedStakeSnapshot(rows: readonly StakeRow[]): bigint {
  let total = 0n
  for (const row of rows) total += row.amount
  return total
}

export async function readWalletPrice(
  port: AssetPort,
  account: string,
  transport: RpcTransport | undefined,
  last: WalletPrice | undefined,
): Promise<WalletPrice> {
  const fallback: WalletPrice = last === undefined ? { chain: "", corp: 0n } : last
  const bal = await port.corpToken.balanceOf(account)
  const corp = bal.ok ? bal.amount : fallback.corp
  if (transport === undefined) return { chain: fallback.chain, corp }
  let outcome: RpcOutcome
  try {
    outcome = await transport.call(rpcMethod.chainId, [])
  } catch {
    return { chain: fallback.chain, corp }
  }
  const chain = decodeChain(outcome)
  if (chain === undefined) return { chain: fallback.chain, corp }
  return { chain, corp }
}
