import type { RpcOutcome, RpcTransport, StakeRow } from "../values.js"
import {
  dataBalanceOf,
  dataCapitalOf,
  dataDeposit,
  dataGetRoot,
  dataIssueVoucher,
  dataMintCapital,
  dataPresentVoucher,
  dataPutRoot,
  dataSnapshot,
  dataStake,
  dataTransfer,
  dataVaultCorp,
  decodeBytes32,
  decodeSnapshot,
  decodeUint,
  isAddr,
} from "./abi.js"
import { encodeAmount, encodeChain, encodeOk, encodeRoot, encodeSnapshot, parseDec, rpcMethod } from "./codec.js"
import { fetchPoster, postEth, type JsonRpcPost } from "./jsonrpc.js"

export type LiveContracts = {
  readonly corpToken: string
  readonly vault: string
  readonly stakeRegistry: string
  readonly merkleRoots: string
}

export type LiveRpcConfig = {
  readonly url: string
  readonly chainId: bigint
  readonly timeoutMs: bigint
  readonly contracts: LiveContracts
}

function arg(args: readonly string[], i: number): string {
  const v = args[i]
  if (v === undefined) return ""
  return v
}

function parseHexUint(raw: string): bigint | undefined {
  if (!raw.startsWith("0x") && !raw.startsWith("0X")) return undefined
  if (raw === "0x" || raw === "0X") return 0n
  try {
    return BigInt(raw)
  } catch {
    return undefined
  }
}

async function viewUint(post: JsonRpcPost, to: string, data: string): Promise<RpcOutcome> {
  if (data.length === 0) return { status: "silence" }
  const raw = await postEth(post, "eth_call", [{ to, data }, "latest"])
  if (raw.status !== "ok") return raw
  const amount = decodeUint(raw.body)
  if (amount === undefined) return { status: "silence" }
  return { status: "ok", body: encodeAmount(amount) }
}

async function sendTx(
  post: JsonRpcPost,
  tx: { readonly to: string; readonly data: string; readonly from?: string },
): Promise<RpcOutcome> {
  if (tx.data.length === 0) return { status: "silence" }
  const outcome = await postEth(post, "eth_sendTransaction", [tx])
  if (outcome.status !== "ok") return outcome
  return { status: "ok", body: encodeOk() }
}

export function createLiveTransport(cfg: LiveRpcConfig, post?: JsonRpcPost): RpcTransport {
  const send = post === undefined ? fetchPoster(cfg.url, cfg.timeoutMs) : post
  const corp = isAddr(cfg.contracts.corpToken) ? cfg.contracts.corpToken : ""
  const vault = isAddr(cfg.contracts.vault) ? cfg.contracts.vault : ""
  const stake = isAddr(cfg.contracts.stakeRegistry) ? cfg.contracts.stakeRegistry : ""
  const roots = isAddr(cfg.contracts.merkleRoots) ? cfg.contracts.merkleRoots : ""
  return {
    async call(method: string, args: readonly string[]): Promise<RpcOutcome> {
      try {
        return await dispatch(send, cfg.chainId, corp, vault, stake, roots, method, args)
      } catch {
        return { status: "silence" }
      }
    },
  }
}

async function dispatch(
  post: JsonRpcPost,
  chainId: bigint,
  corp: string,
  vault: string,
  stake: string,
  roots: string,
  method: string,
  args: readonly string[],
): Promise<RpcOutcome> {
  switch (method) {
    case rpcMethod.chainId: {
      const outcome = await postEth(post, "eth_chainId", [])
      if (outcome.status !== "ok") return { status: "silence" }
      const got = parseHexUint(outcome.body)
      if (got === undefined || got !== chainId) return { status: "silence" }
      return { status: "ok", body: encodeChain(got.toString()) }
    }
    case rpcMethod.balanceOf: {
      if (corp.length === 0) return { status: "silence" }
      return viewUint(post, corp, dataBalanceOf(arg(args, 0)))
    }
    case rpcMethod.transfer: {
      if (corp.length === 0) return { status: "silence" }
      const from = arg(args, 0)
      const amount = parseDec(arg(args, 2))
      if (!isAddr(from) || amount === undefined) return { status: "silence" }
      return sendTx(post, { from, to: corp, data: dataTransfer(arg(args, 1), amount) })
    }
    case rpcMethod.vaultCorp: {
      if (vault.length === 0) return { status: "silence" }
      return viewUint(post, vault, dataVaultCorp())
    }
    case rpcMethod.capitalOf: {
      if (vault.length === 0) return { status: "silence" }
      return viewUint(post, vault, dataCapitalOf(arg(args, 0)))
    }
    case rpcMethod.deposit: {
      if (vault.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 1))
      if (amount === undefined) return { status: "silence" }
      return sendTx(post, { to: vault, data: dataDeposit(arg(args, 0), amount) })
    }
    case rpcMethod.mintCapital: {
      if (vault.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 1))
      if (amount === undefined) return { status: "silence" }
      return sendTx(post, { to: vault, data: dataMintCapital(arg(args, 0), amount) })
    }
    case rpcMethod.issueVoucher: {
      if (vault.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 2))
      const issued = parseDec(arg(args, 3))
      if (amount === undefined || issued === undefined) return { status: "silence" }
      return sendTx(post, { to: vault, data: dataIssueVoucher(arg(args, 0), arg(args, 1), amount, issued) })
    }
    case rpcMethod.presentVoucher: {
      if (vault.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 2))
      const issued = parseDec(arg(args, 3))
      if (amount === undefined || issued === undefined) return { status: "silence" }
      return sendTx(post, { to: vault, data: dataPresentVoucher(arg(args, 0), arg(args, 1), amount, issued) })
    }
    case rpcMethod.stake: {
      if (stake.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 2))
      if (amount === undefined) return { status: "silence" }
      return sendTx(post, { to: stake, data: dataStake(arg(args, 0), arg(args, 1), amount) })
    }
    case rpcMethod.snapshot: {
      if (stake.length === 0) return { status: "silence" }
      const data = dataSnapshot(arg(args, 0))
      if (data.length === 0) return { status: "silence" }
      const raw = await postEth(post, "eth_call", [{ to: stake, data }, "latest"])
      if (raw.status !== "ok") return raw
      const decoded = decodeSnapshot(raw.body)
      if (decoded === undefined) return { status: "silence" }
      const rows: StakeRow[] = []
      for (const row of decoded) rows.push({ ticker: row.ticker, amount: row.amount })
      return { status: "ok", body: encodeSnapshot(rows) }
    }
    case rpcMethod.putRoot: {
      if (roots.length === 0) return { status: "silence" }
      const day = parseDec(arg(args, 1))
      if (day === undefined) return { status: "silence" }
      return sendTx(post, { to: roots, data: dataPutRoot(arg(args, 0), day, arg(args, 2)) })
    }
    case rpcMethod.getRoot: {
      if (roots.length === 0) return { status: "silence" }
      const day = parseDec(arg(args, 1))
      if (day === undefined) return { status: "silence" }
      const data = dataGetRoot(arg(args, 0), day)
      if (data.length === 0) return { status: "silence" }
      const raw = await postEth(post, "eth_call", [{ to: roots, data }, "latest"])
      if (raw.status !== "ok") return raw
      const got = decodeBytes32(raw.body)
      if (got === undefined) return { status: "silence" }
      return { status: "ok", body: encodeRoot(got) }
    }
    default:
      return { status: "silence" }
  }
}
