import type { CoolingRow, RpcOutcome, RpcTransport, StakeRow, TxLog } from "../values.js"
import {
  dataAllowance,
  dataApprove,
  dataBackingOf,
  dataBalanceOf,
  dataCapitalOf,
  dataClaimUnstaked,
  dataCoolingSnapshot,
  dataDeposit,
  dataGetRoot,
  dataIssueVoucher,
  dataIssued,
  dataMintCapital,
  dataOutcomeOf,
  dataOwed,
  dataPending,
  dataPresentVoucher,
  dataPrizeClaim,
  dataPrizeDeposit,
  dataPrizeReturnUnsettled,
  dataPrizeSlice,
  dataPutRoot,
  dataReleaseExpiredVoucher,
  dataRequestUnstake,
  dataReservedOf,
  dataSnapshot,
  dataStake,
  dataBatchUsed,
  dataUnsliced,
  dataUsed,
  dataTransfer,
  dataVaultCorp,
  decodeBytes32,
  decodeCooling,
  decodeSnapshot,
  decodeUint,
  isAddr,
} from "./abi.js"
import {
  encodeAmount,
  encodeChain,
  encodeCooling,
  encodeIssued,
  encodeOk,
  encodeRoot,
  encodeSnapshot,
  encodeTxView,
  encodeUsed,
  parseDec,
  parseDecList,
  parseStringList,
  rpcMethod,
} from "./codec.js"
import { fetchPoster, postEth, type JsonRpcPost } from "./jsonrpc.js"
import { addressOfPrivateKey, broadcastRoleTx, roleKey, type InflightTx } from "./sign.js"

export type LiveContracts = {
  readonly corpToken: string
  readonly vault: string
  readonly stakeRegistry: string
  readonly merkleRoots: string
  readonly prizeTreasury?: string
}

export type LiveRpcConfig = {
  readonly url: string
  readonly chainId: bigint
  readonly timeoutMs: bigint
  readonly contracts: LiveContracts
  readonly bps?: bigint
  readonly gasHeadroomBps?: bigint
  readonly callers?: {
    readonly depositorService: string
    readonly depositorAddress: string
    readonly signerService: string
    readonly signerAddress: string
  }
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

function decodeIssuedWords(hex: string): { readonly account: string; readonly corpAmount: bigint; readonly issuedAtS: bigint } | undefined {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex
  if (raw.length < 192) return undefined
  const account = "0x" + raw.slice(24, 64)
  if (!isAddr(account)) return undefined
  const corpAmount = decodeUint("0x" + raw.slice(64, 128))
  const issuedAtS = decodeUint("0x" + raw.slice(128, 192))
  if (corpAmount === undefined || issuedAtS === undefined) return undefined
  return { account, corpAmount, issuedAtS }
}

function txLogsOf(raw: unknown): readonly TxLog[] | undefined {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) return undefined
  const out: TxLog[] = []
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined
    const rec = item as { readonly [key: string]: unknown }
    const address = rec["address"]
    const data = rec["data"]
    const topics = rec["topics"]
    if (typeof address !== "string" || typeof data !== "string" || !Array.isArray(topics)) return undefined
    const tops: string[] = []
    for (const topic of topics) {
      if (typeof topic !== "string") return undefined
      tops.push(topic)
    }
    out.push({ address, topics: tops, data })
  }
  return out
}

function txViewOf(value: unknown): {
  readonly status: bigint
  readonly from: string
  readonly to: string
  readonly input: string
  readonly logs: readonly TxLog[]
  readonly blockHash?: string
  readonly blockNumber?: bigint
} | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
  const row = value as { readonly [key: string]: unknown }
  const statusRaw = row["status"]
  const from = row["from"]
  const to = row["to"]
  const input = row["input"]
  if (typeof from !== "string" || typeof to !== "string" || !isAddr(from) || !isAddr(to)) return undefined
  const status = typeof statusRaw === "string" ? parseHexUint(statusRaw) : 0n
  if (status === undefined) return undefined
  const data = typeof input === "string" ? input : "0x"
  const logs = txLogsOf(row["logs"])
  if (logs === undefined) return undefined
  const hashRaw = row["blockHash"]
  const blockHash = typeof hashRaw === "string" && hashRaw.length > 0 ? hashRaw : undefined
  const numberRaw = row["blockNumber"]
  const blockNumber = typeof numberRaw === "string" ? parseHexUint(numberRaw) : undefined
  const view = { status, from, to, input: data, logs }
  if (blockHash !== undefined && blockNumber !== undefined) return { ...view, blockHash, blockNumber }
  if (blockHash !== undefined) return { ...view, blockHash }
  if (blockNumber !== undefined) return { ...view, blockNumber }
  return view
}

function parseBlockTimestamp(raw: string): bigint | undefined {
  if (!raw.startsWith("0x") && !raw.startsWith("0X")) return undefined
  const body = raw.slice(2)
  if (body.length === 0 || !/^[0-9a-fA-F]+$/.test(body)) return undefined
  try {
    return BigInt(raw)
  } catch {
    return undefined
  }
}

async function readTx(post: JsonRpcPost, method: "eth_getTransactionReceipt" | "eth_getTransactionByHash", hash: string): Promise<RpcOutcome> {
  const raw = await postEth(post, method, [hash])
  if (raw.status !== "ok" || raw.body === "null") return { status: "silence" }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.body) as unknown
  } catch {
    return { status: "silence" }
  }
  const view = txViewOf(parsed)
  if (view === undefined) return { status: "silence" }
  return { status: "ok", body: encodeTxView(view) }
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

function callerAddress(
  raw: string,
  service: string,
  address: string,
): string {
  return raw === service ? address : raw
}

export function createLiveTransport(cfg: LiveRpcConfig, post?: JsonRpcPost): RpcTransport {
  const send = post === undefined ? fetchPoster(cfg.url, cfg.timeoutMs) : post
  const corp = isAddr(cfg.contracts.corpToken) ? cfg.contracts.corpToken : ""
  const vault = isAddr(cfg.contracts.vault) ? cfg.contracts.vault : ""
  const stake = isAddr(cfg.contracts.stakeRegistry) ? cfg.contracts.stakeRegistry : ""
  const roots = isAddr(cfg.contracts.merkleRoots) ? cfg.contracts.merkleRoots : ""
  const prizesRaw = cfg.contracts.prizeTreasury
  const prizes = prizesRaw !== undefined && isAddr(prizesRaw) ? prizesRaw : ""
  const callers = cfg.callers
  const inflight = new Map<string, InflightTx>()
  return {
    async call(method: string, args: readonly string[]): Promise<RpcOutcome> {
      try {
        return await dispatch(
          send,
          cfg.chainId,
          cfg.bps,
          cfg.gasHeadroomBps,
          corp,
          vault,
          stake,
          roots,
          prizes,
          callers,
          inflight,
          method,
          args,
        )
      } catch {
        return { status: "silence" }
      }
    },
  }
}

async function dispatch(
  post: JsonRpcPost,
  chainId: bigint,
  bps: bigint | undefined,
  gasHeadroomBps: bigint | undefined,
  corp: string,
  vault: string,
  stake: string,
  roots: string,
  prizes: string,
  callers: LiveRpcConfig["callers"],
  inflight: Map<string, InflightTx>,
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
      const token = arg(args, 1)
      const target = token.length > 0 ? token : corp
      if (target.length === 0 || !isAddr(target)) return { status: "silence" }
      return viewUint(post, target, dataBalanceOf(arg(args, 0)))
    }
    case rpcMethod.allowance: {
      const token = arg(args, 2)
      const target = token.length > 0 ? token : corp
      if (target.length === 0) return { status: "silence" }
      return viewUint(post, target, dataAllowance(arg(args, 0), arg(args, 1)))
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
    case rpcMethod.vaultPending: {
      if (vault.length === 0) return { status: "silence" }
      return viewUint(post, vault, dataPending(arg(args, 0)))
    }
    case rpcMethod.vaultBacking: {
      if (vault.length === 0) return { status: "silence" }
      return viewUint(post, vault, dataBackingOf(arg(args, 0)))
    }
    case rpcMethod.vaultReserved: {
      if (vault.length === 0) return { status: "silence" }
      return viewUint(post, vault, dataReservedOf(arg(args, 0)))
    }
    case rpcMethod.vaultUsed: {
      if (vault.length === 0) return { status: "silence" }
      const data = dataUsed(arg(args, 0))
      if (data.length === 0) return { status: "silence" }
      const raw = await postEth(post, "eth_call", [{ to: vault, data }, "latest"])
      if (raw.status !== "ok") return raw
      const flag = decodeUint(raw.body)
      if (flag === undefined) return { status: "silence" }
      return { status: "ok", body: encodeUsed(flag !== 0n) }
    }
    case rpcMethod.vaultIssued: {
      if (vault.length === 0) return { status: "silence" }
      const data = dataIssued(arg(args, 0))
      if (data.length === 0) return { status: "silence" }
      const raw = await postEth(post, "eth_call", [{ to: vault, data }, "latest"])
      if (raw.status !== "ok") return raw
      const issued = decodeIssuedWords(raw.body)
      if (issued === undefined) return { status: "silence" }
      return { status: "ok", body: encodeIssued(issued.account, issued.corpAmount, issued.issuedAtS) }
    }
    case rpcMethod.deposit: {
      if (vault.length === 0 || corp.length === 0) return { status: "silence" }
      const account = arg(args, 0)
      const amount = parseDec(arg(args, 1))
      if (!isAddr(account) || amount === undefined || amount <= 0n) return { status: "silence" }
      const from = addressOfPrivateKey(roleKey("buyback_executor"))
      if (from === undefined || from.toLowerCase() !== account.toLowerCase()) return { status: "silence" }
      const allowData = dataAllowance(account, vault)
      if (allowData.length === 0) return { status: "silence" }
      const rawAllow = await postEth(post, "eth_call", [{ to: corp, data: allowData }, "latest"])
      if (rawAllow.status !== "ok") return { status: "silence" }
      const have = decodeUint(rawAllow.body)
      if (have === undefined) return { status: "silence" }
      if (have < amount) {
        const approveData = dataApprove(vault, amount)
        if (approveData.length === 0) return { status: "silence" }
        const approved = await broadcastRoleTx({
          post,
          chainId,
          bps,
          gasHeadroomBps,
          role: "buyback_executor",
          to: corp,
          data: approveData,
          inflight,
        })
        if (approved.status !== "ok") return approved
      }
      const data = dataDeposit(account, amount)
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({
        post,
        chainId,
        bps,
        gasHeadroomBps,
        role: "buyback_executor",
        to: vault,
        data,
        inflight,
      })
    }
    case rpcMethod.mintCapital:
    case rpcMethod.signMintCapital: {
      if (vault.length === 0) return { status: "silence" }
      const corpAmount = parseDec(arg(args, 1))
      const capitalAmount = parseDec(arg(args, 2))
      if (corpAmount === undefined || capitalAmount === undefined) return { status: "silence" }
      const data = dataMintCapital(arg(args, 0), corpAmount, capitalAmount)
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({
        post,
        chainId,
        bps,
        gasHeadroomBps,
        role: "minter",
        to: vault,
        data,
        inflight,
        signOnly: method === rpcMethod.signMintCapital,
      })
    }
    case rpcMethod.issueVoucher: {
      if (vault.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 2))
      const issued = parseDec(arg(args, 3))
      if (amount === undefined || issued === undefined) return { status: "silence" }
      const data = dataIssueVoucher(arg(args, 0), arg(args, 1), amount, issued)
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({
        post,
        chainId,
        bps,
        gasHeadroomBps,
        role: "voucher",
        to: vault,
        data,
        inflight,
      })
    }
    case rpcMethod.presentVoucher: {
      if (vault.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 2))
      const issued = parseDec(arg(args, 3))
      if (amount === undefined || issued === undefined) return { status: "silence" }
      return sendTx(post, { to: vault, data: dataPresentVoucher(arg(args, 0), arg(args, 1), amount, issued) })
    }
    case rpcMethod.vaultOutcome: {
      if (vault.length === 0) return { status: "silence" }
      return viewUint(post, vault, dataOutcomeOf(arg(args, 0)))
    }
    case rpcMethod.releaseExpiredVoucher: {
      if (vault.length === 0) return { status: "silence" }
      const data = dataReleaseExpiredVoucher(arg(args, 0))
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({
        post,
        chainId,
        bps,
        gasHeadroomBps,
        role: "voucher",
        to: vault,
        data,
        inflight,
      })
    }
    case rpcMethod.stake: {
      if (stake.length === 0) return { status: "silence" }
      const amount = parseDec(arg(args, 2))
      if (amount === undefined) return { status: "silence" }
      return sendTx(post, { to: stake, data: dataStake(arg(args, 0), arg(args, 1), amount) })
    }
    case rpcMethod.requestUnstake: {
      if (stake.length === 0) return { status: "silence" }
      const from = arg(args, 0)
      const amount = parseDec(arg(args, 2))
      if (!isAddr(from) || amount === undefined) return { status: "silence" }
      return sendTx(post, { from, to: stake, data: dataRequestUnstake(arg(args, 1), amount) })
    }
    case rpcMethod.claimUnstaked: {
      if (stake.length === 0) return { status: "silence" }
      const from = arg(args, 0)
      if (!isAddr(from)) return { status: "silence" }
      return sendTx(post, { from, to: stake, data: dataClaimUnstaked(arg(args, 1)) })
    }
    case rpcMethod.coolingSnapshot: {
      if (stake.length === 0) return { status: "silence" }
      const data = dataCoolingSnapshot(arg(args, 0))
      if (data.length === 0) return { status: "silence" }
      const raw = await postEth(post, "eth_call", [{ to: stake, data }, "latest"])
      if (raw.status !== "ok") return raw
      const decoded = decodeCooling(raw.body)
      if (decoded === undefined) return { status: "silence" }
      const rows: CoolingRow[] = []
      for (const row of decoded) rows.push({ ticker: row.ticker, amount: row.amount, readyAtS: row.readyAtS })
      return { status: "ok", body: encodeCooling(rows) }
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
      const data = dataPutRoot(arg(args, 0), day, arg(args, 2))
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({ post, chainId, bps, gasHeadroomBps, role: "attestor", to: roots, data, inflight })
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
    case rpcMethod.prizeDeposit: {
      if (prizes.length === 0) return { status: "silence" }
      const rawFrom = arg(args, 0)
      const from =
        callers === undefined
          ? rawFrom
          : callerAddress(rawFrom, callers.depositorService, callers.depositorAddress)
      const kettle = parseDec(arg(args, 2))
      const amount = parseDec(arg(args, 3))
      if (!isAddr(from) || kettle === undefined || amount === undefined) return { status: "silence" }
      const data = dataPrizeDeposit(arg(args, 1), kettle, amount)
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({
        post,
        chainId,
        bps,
        gasHeadroomBps,
        role: "buyback_executor",
        to: prizes,
        data,
        inflight,
      })
    }
    case rpcMethod.prizeSlice: {
      if (prizes.length === 0) return { status: "silence" }
      if (callers !== undefined && arg(args, 0) !== callers.signerService) return { status: "silence" }
      const kettle = parseDec(arg(args, 3))
      const players = parseStringList(arg(args, 4))
      const amounts = parseDecList(arg(args, 5))
      if (kettle === undefined || players === undefined || amounts === undefined) return { status: "silence" }
      const data = dataPrizeSlice(arg(args, 1), arg(args, 2), kettle, players, amounts)
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({ post, chainId, bps, gasHeadroomBps, role: "signer", to: prizes, data, inflight })
    }
    case rpcMethod.owed: {
      if (prizes.length === 0) return { status: "silence" }
      const kettle = parseDec(arg(args, 0))
      if (kettle === undefined) return { status: "silence" }
      return viewUint(post, prizes, dataOwed(kettle, arg(args, 1), arg(args, 2)))
    }
    case rpcMethod.unsliced: {
      if (prizes.length === 0) return { status: "silence" }
      const kettle = parseDec(arg(args, 0))
      if (kettle === undefined) return { status: "silence" }
      return viewUint(post, prizes, dataUnsliced(kettle, arg(args, 1)))
    }
    case rpcMethod.batchUsed: {
      if (prizes.length === 0) return { status: "silence" }
      const data = dataBatchUsed(arg(args, 0))
      if (data.length === 0) return { status: "silence" }
      return viewUint(post, prizes, data)
    }
    case rpcMethod.prizeReturnUnsettled: {
      if (prizes.length === 0) return { status: "silence" }
      const rawFrom = arg(args, 0)
      const from =
        callers === undefined
          ? rawFrom
          : callerAddress(rawFrom, callers.depositorService, callers.depositorAddress)
      const kettle = parseDec(arg(args, 2))
      if (!isAddr(from) || kettle === undefined) return { status: "silence" }
      const signer = addressOfPrivateKey(roleKey("buyback_executor"))
      if (signer === undefined || signer.toLowerCase() !== from.toLowerCase()) return { status: "silence" }
      const data = dataPrizeReturnUnsettled(arg(args, 1), kettle)
      if (data.length === 0) return { status: "silence" }
      return broadcastRoleTx({
        post,
        chainId,
        bps,
        gasHeadroomBps,
        role: "buyback_executor",
        to: prizes,
        data,
        inflight,
      })
    }
    case rpcMethod.prizeClaimPrize: {
      if (prizes.length === 0) return { status: "silence" }
      const from = arg(args, 0)
      const kettle = parseDec(arg(args, 2))
      if (!isAddr(from) || kettle === undefined) return { status: "silence" }
      return sendTx(post, { from, to: prizes, data: dataPrizeClaim(arg(args, 1), kettle) })
    }
    case rpcMethod.sendRaw: {
      const raw = arg(args, 0)
      if (!raw.startsWith("0x")) return { status: "silence" }
      const sent = await postEth(post, "eth_sendRawTransaction", [raw])
      if (sent.status !== "ok") return { status: "silence" }
      return { status: "ok", body: encodeOk() }
    }
    case rpcMethod.txReceipt:
      return readTx(post, "eth_getTransactionReceipt", arg(args, 0))
    case rpcMethod.txByHash:
      return readTx(post, "eth_getTransactionByHash", arg(args, 0))
    case rpcMethod.pendingNonce: {
      const account = arg(args, 0)
      if (!isAddr(account)) return { status: "silence" }
      const raw = await postEth(post, "eth_getTransactionCount", [account, "pending"])
      if (raw.status !== "ok") return raw
      const nonce = parseHexUint(raw.body)
      if (nonce === undefined) return { status: "silence" }
      return { status: "ok", body: encodeAmount(nonce) }
    }
    case rpcMethod.gasPrice: {
      const raw = await postEth(post, "eth_gasPrice", [])
      if (raw.status !== "ok") return raw
      const price = parseHexUint(raw.body)
      if (price === undefined) return { status: "silence" }
      return { status: "ok", body: encodeAmount(price) }
    }
    case rpcMethod.latestBlockTime: {
      const raw = await postEth(post, "eth_getBlockByNumber", ["latest", false])
      if (raw.status !== "ok" || raw.body === "null") return { status: "silence" }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw.body) as unknown
      } catch {
        return { status: "silence" }
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "silence" }
      const stamp = (parsed as { readonly timestamp?: unknown }).timestamp
      if (typeof stamp !== "string") return { status: "silence" }
      const time = parseBlockTimestamp(stamp)
      if (time === undefined) return { status: "silence" }
      return { status: "ok", body: encodeAmount(time) }
    }
    case rpcMethod.estimateGas: {
      const from = arg(args, 0)
      const to = arg(args, 1)
      const data = arg(args, 2)
      if (!isAddr(from) || !isAddr(to) || data.length === 0) return { status: "silence" }
      const raw = await postEth(post, "eth_estimateGas", [{ from, to, data, value: "0x0" }])
      if (raw.status !== "ok") return raw
      const gas = parseHexUint(raw.body)
      if (gas === undefined) return { status: "silence" }
      return { status: "ok", body: encodeAmount(gas) }
    }
    default:
      return { status: "silence" }
  }
}
