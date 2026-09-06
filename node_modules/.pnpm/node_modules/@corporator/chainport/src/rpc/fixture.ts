import { codes } from "@corporator/protocol"
import type { AssetPort } from "../port.js"
import type { RpcOutcome, RpcTransport, Voucher } from "../values.js"
import {
  encodeAmountResult,
  encodeChain,
  encodeErr,
  encodeResult,
  encodeRoot,
  encodeSnapshot,
  parseDec,
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
    case rpcMethod.balanceOf:
      return encodeAmountResult(await inner.corpToken.balanceOf(arg(args, 0)))
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
    case rpcMethod.mintCapital: {
      const amount = asBig(arg(args, 1))
      if (amount === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.vault.mintCapital(arg(args, 0), amount))
    }
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
    case rpcMethod.stake: {
      const amount = asBig(arg(args, 2))
      if (amount === undefined) return encodeErr(codes.API_MALFORMED)
      return encodeResult(await inner.stakeRegistry.stake(arg(args, 0), arg(args, 1), amount))
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
