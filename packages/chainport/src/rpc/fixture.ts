import { codes } from "@corporator/protocol"
import type { AssetPort } from "../port.js"
import type { RpcOutcome, RpcTransport, Voucher } from "../values.js"
import {
  encodeAmountResult,
  encodeChain,
  encodeCooling,
  encodeErr,
  encodeIssued,
  encodeResult,
  encodeRoot,
  encodeSnapshot,
  encodeTxView,
  parseDec,
  parseDecList,
  parseStringList,
  rpcMethod,
} from "./codec.js"

function arg(args: readonly string[], i: number): string {
  const v = args[i]
  if (v === undefined) return ""
  return v
}

function asBig(raw: string): bigint | undefined {
  return parseDec(raw)
}

function voucherOf(args: readonly string[]): Voucher | undefined {
  const nonce = arg(args, 0)
  const account = arg(args, 1)
  const corpAmount = asBig(arg(args, 2))
  const issuedAtS = asBig(arg(args, 3))
  if (corpAmount === undefined || issuedAtS === undefined) return undefined
  return { nonce, account, corpAmount, issuedAtS }
}

export function lyingTransport(body: string): RpcTransport {
  return {
    async call(): Promise<RpcOutcome> {
      return { status: "lie", body }
    },
  }
}

export function transportFromPort(inner: AssetPort, chain: string): RpcTransport {
  return {
    async call(method: string, args: readonly string[]): Promise<RpcOutcome> {
      try {
        const body = await dispatch(inner, chain, method, args)
        if (body === undefined) return { status: "lie", body: "" }
        return { status: "ok", body }
      } catch {
        return { status: "silence" }
      }
    },
  }
}

async function dispatch(
  inner: AssetPort,
  chain: string,
  method: string,
  args: readonly string[],
): Promise<string | undefined> {
  switch (method) {
    case rpcMethod.balanceOf: {
      const token = arg(args, 1)
      if (token.length > 0) return encodeAmountResult(await inner.corpToken.balanceOf(arg(args, 0), token))
      return encodeAmountResult(await inner.corpToken.balanceOf(arg(args, 0)))
    }
    case rpcMethod.allowance: {
      const token = arg(args, 2)
      const allowed =
        token.length > 0
          ? await inner.corpToken.allowance(arg(args, 0), arg(args, 1), token)
          : await inner.corpToken.allowance(arg(args, 0), arg(args, 1))
      return encodeAmountResult(allowed)
    }
    case rpcMethod.transfer: {
      const amount = asBig(arg(args, 2))
      if (amount === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.corpToken.transfer(arg(args, 0), arg(args, 1), amount))
    }
    case rpcMethod.vaultCorp:
      return encodeAmountResult(await inner.vault.vaultCorp())
    case rpcMethod.capitalOf:
      return encodeAmountResult(await inner.vault.capitalOf(arg(args, 0)))
    case rpcMethod.deposit: {
      const amount = asBig(arg(args, 1))
      if (amount === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.vault.deposit(arg(args, 0), amount))
    }
    case rpcMethod.mintCapital:
    case rpcMethod.signMintCapital: {
      const corpAmount = asBig(arg(args, 1))
      const capitalAmount = asBig(arg(args, 2))
      if (corpAmount === undefined || capitalAmount === undefined) return encodeErr(codes.API_MALFORMED)
      const account = arg(args, 0)
      if (method === rpcMethod.signMintCapital) {
        return encodeResult(await inner.vault.signMintCapital(account, corpAmount, capitalAmount))
      }
      return encodeResult(await inner.vault.mintCapital(account, corpAmount, capitalAmount))
    }
    case rpcMethod.vaultPending:
      return encodeAmountResult(await inner.vault.pending(arg(args, 0)))
    case rpcMethod.vaultBacking:
      return encodeAmountResult(await inner.vault.backingOf(arg(args, 0)))
    case rpcMethod.vaultReserved:
      return encodeAmountResult(await inner.vault.reservedOf(arg(args, 0)))
    case rpcMethod.issueVoucher: {
      const voucher = voucherOf(args)
      if (voucher === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.vault.issueVoucher(voucher))
    }
    case rpcMethod.presentVoucher: {
      const voucher = voucherOf(args)
      const nowS = asBig(arg(args, 4))
      if (voucher === undefined || nowS === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.vault.presentVoucher(voucher, nowS))
    }
    case rpcMethod.vaultOutcome:
      return encodeAmountResult(await inner.vault.outcomeOf(arg(args, 0)))
    case rpcMethod.vaultIssued: {
      const known = await inner.vault.issued(arg(args, 0))
      if (!known.ok) return encodeErr(known.code)
      return encodeIssued(known.account, known.corpAmount, known.issuedAtS)
    }
    case rpcMethod.releaseExpiredVoucher:
      return encodeResult(await inner.vault.releaseExpiredVoucher(arg(args, 0)))
    case rpcMethod.stake: {
      const amount = asBig(arg(args, 2))
      if (amount === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.stakeRegistry.stake(arg(args, 0), arg(args, 1), amount))
    }
    case rpcMethod.requestUnstake: {
      const amount = asBig(arg(args, 2))
      if (amount === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.stakeRegistry.requestUnstake(arg(args, 0), arg(args, 1), amount))
    }
    case rpcMethod.claimUnstaked:
      return encodeResult(await inner.stakeRegistry.claimUnstaked(arg(args, 0), arg(args, 1)))
    case rpcMethod.coolingSnapshot: {
      const cool = await inner.stakeRegistry.coolingSnapshot(arg(args, 0))
      if (!cool.ok) return encodeErr(cool.code)
      return encodeCooling(cool.rows)
    }
    case rpcMethod.snapshot: {
      const snap = await inner.stakeRegistry.snapshot(arg(args, 0))
      if (!snap.ok) return encodeErr(snap.code)
      return encodeSnapshot(snap.rows)
    }
    case rpcMethod.putRoot: {
      const day = asBig(arg(args, 1))
      if (day === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.merkleRoots.putRoot(arg(args, 0), day, arg(args, 2)))
    }
    case rpcMethod.getRoot: {
      const day = asBig(arg(args, 1))
      if (day === undefined) return encodeErr(codes.API_MALFORMED)
      const got = await inner.merkleRoots.getRoot(arg(args, 0), day)
      if (!got.ok) return encodeErr(got.code)
      return encodeRoot(got.root)
    }
    case rpcMethod.prizeDeposit: {
      const kettle = asBig(arg(args, 2))
      const amount = asBig(arg(args, 3))
      if (kettle === undefined || amount === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.prizeTreasury.deposit(arg(args, 0), arg(args, 1), kettle, amount))
    }
    case rpcMethod.prizeSlice: {
      const kettle = asBig(arg(args, 3))
      const players = parseStringList(arg(args, 4))
      const amounts = parseDecList(arg(args, 5))
      if (kettle === undefined || players === undefined || amounts === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(
        await inner.prizeTreasury.slice(arg(args, 0), arg(args, 1), arg(args, 2), kettle, players, amounts),
      )
    }
    case rpcMethod.owed: {
      const kettle = asBig(arg(args, 0))
      if (kettle === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeAmountResult(await inner.prizeTreasury.owed(kettle, arg(args, 1), arg(args, 2)))
    }
    case rpcMethod.unsliced: {
      const kettle = asBig(arg(args, 0))
      if (kettle === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeAmountResult(await inner.prizeTreasury.unsliced(kettle, arg(args, 1)))
    }
    case rpcMethod.batchUsed:
      return encodeAmountResult(await inner.prizeTreasury.batchUsed(arg(args, 0)))
    case rpcMethod.prizeReturnUnsettled: {
      const kettle = asBig(arg(args, 2))
      if (kettle === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.prizeTreasury.returnUnsettled(arg(args, 0), arg(args, 1), kettle))
    }
    case rpcMethod.prizeClaimPrize: {
      const kettle = asBig(arg(args, 2))
      if (kettle === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.prizeTreasury.claimPrize(arg(args, 0), arg(args, 1), kettle))
    }
    case rpcMethod.latestBlockTime:
      return encodeAmountResult(await inner.chain.latestBlockTime())
    case rpcMethod.sendRaw: {
      const send = inner.chain.sendRaw
      if (send === undefined) return encodeErr(codes.SERVICE_DEGRADED)
      return encodeResult(await send(arg(args, 0)))
    }
    case rpcMethod.txReceipt: {
      const view = await inner.chain.transactionReceipt(arg(args, 0))
      if (!view.ok) return encodeErr(view.code)
      return encodeTxView(view)
    }
    case rpcMethod.txByHash: {
      const view = await inner.chain.transactionByHash(arg(args, 0))
      if (!view.ok) return encodeErr(view.code)
      return encodeTxView(view)
    }
    case rpcMethod.chainId:
      return encodeChain(chain)
    default:
      return undefined
  }
}

export function transportFromPost(
  post: (body: string) => Promise<string | undefined>,
): RpcTransport {
  return {
    async call(method: string, args: readonly string[]): Promise<RpcOutcome> {
      const payload = JSON.stringify({ jsonrpc: "2.0", id: "0", method, params: args })
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
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { status: "lie", body: reply }
      }
      const row = parsed as { readonly [key: string]: unknown }
      if (row["error"] !== undefined) return { status: "silence" }
      const result = row["result"]
      if (typeof result === "string") return { status: "ok", body: result }
      if (result === undefined) return { status: "silence" }
      try {
        return { status: "ok", body: JSON.stringify(result) }
      } catch {
        return { status: "lie", body: reply }
      }
    },
  }
}
