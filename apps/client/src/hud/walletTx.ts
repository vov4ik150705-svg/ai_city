import type { Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { parseWalletChain } from "./flows.js"
import type { WalletRequest } from "../walletLogin.js"

/** EIP-1193: the wallet has no local config for this chain. */
const CHAIN_NOT_ADDED = 4902

export type ChainTx = {
  readonly to: string
  readonly data: string
  readonly value: string
}

export type ChainSignResult =
  | { readonly ok: true; readonly hashes: readonly string[] }
  | { readonly ok: false; readonly code: string; readonly hashes: readonly string[] }

export type PreparedCommand =
  | { readonly kind: "applied" }
  | { readonly kind: "prepared"; readonly ticket: string; readonly chainId: bigint | undefined; readonly txs: readonly ChainTx[] }
  | { readonly kind: "failed"; readonly code: string }

export function chainIdHex(chainId: bigint): string {
  return "0x" + chainId.toString(16)
}

export function readPreparedCommand(body: unknown): PreparedCommand {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return { kind: "failed", code: codes.API_MALFORMED }
  const row = body as { readonly [key: string]: unknown }
  const code = row["code"]
  if (typeof code === "string" && code.length > 0) return { kind: "failed", code }
  if (row["phase"] !== "prepared") return { kind: "applied" }
  const ticket = row["ticket"]
  if (typeof ticket !== "string" || ticket.length === 0) return { kind: "failed", code: codes.API_MALFORMED }
  const txs = readTxs(row["txs"])
  if (txs === undefined) return { kind: "failed", code: codes.API_MALFORMED }
  const chainRaw = row["chain_id"]
  const chainId = chainRaw === undefined ? undefined : parseWalletChain(chainRaw)
  return chainId === undefined && chainRaw !== undefined
    ? { kind: "failed", code: codes.API_MALFORMED }
    : { kind: "prepared", ticket, chainId, txs }
}

function readTxs(value: unknown): readonly ChainTx[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: ChainTx[] = []
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined
    const row = item as { readonly [key: string]: unknown }
    const to = row["to"]
    const data = row["data"]
    const rawValue = row["value"]
    if (typeof to !== "string" || to.length === 0) return undefined
    if (typeof data !== "string" || data.length === 0) return undefined
    if (typeof rawValue !== "string") return undefined
    out.push({ to, data, value: rawValue })
  }
  return out
}

export async function ensurePackChain(args: {
  readonly wallet: WalletRequest
  readonly chainId: bigint
  readonly rpcUrl: string
  readonly chainName: string
  readonly nativeSymbol: string
  readonly nativeDecimals: number
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: string }> {
  const current = await readChain(args.wallet)
  if (current === args.chainId) return { ok: true }
  const hex = chainIdHex(args.chainId)
  try {
    await args.wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] })
  } catch (err) {
    if (errorCode(err) !== CHAIN_NOT_ADDED || args.rpcUrl.length === 0) return { ok: false, code: codes.WALLET_WRONG_CHAIN }
    try {
      await args.wallet.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: args.chainName,
            nativeCurrency: { name: args.nativeSymbol, symbol: args.nativeSymbol, decimals: args.nativeDecimals },
            rpcUrls: [args.rpcUrl],
          },
        ],
      })
      await args.wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] })
    } catch {
      return { ok: false, code: codes.WALLET_WRONG_CHAIN }
    }
  }
  const after = await readChain(args.wallet)
  if (after !== args.chainId) return { ok: false, code: codes.WALLET_WRONG_CHAIN }
  return { ok: true }
}

/**
 * Sign `txs` in order and wait for each receipt.
 * An empty list does not call the wallet. A rejection stops the rest and does not invent a confirm.
 */
export async function signChainTxs(args: {
  readonly wallet: WalletRequest
  readonly from: string
  readonly txs: readonly ChainTx[]
  readonly pollMs: bigint
  readonly timeoutMs: bigint
  readonly now: () => bigint
  readonly sleep: (ms: bigint) => Promise<void>
  readonly onStep?: (step: "sign" | "wait") => void
}): Promise<ChainSignResult> {
  if (args.txs.length === 0) return { ok: true, hashes: [] }
  const hashes: string[] = []
  for (const tx of args.txs) {
    args.onStep?.("sign")
    let hash = ""
    try {
      const sent = await args.wallet.request({
        method: "eth_sendTransaction",
        params: [{ from: args.from, to: tx.to, data: tx.data, value: hexQuantity(tx.value) }],
      })
      if (typeof sent !== "string" || sent.length === 0) return { ok: false, code: codes.WALLET_TX_REJECTED, hashes }
      hash = sent
    } catch {
      return { ok: false, code: codes.WALLET_TX_REJECTED, hashes }
    }
    hashes.push(hash)
    args.onStep?.("wait")
    const mined = await waitReceipt(args.wallet, hash, args.pollMs, args.timeoutMs, args.now, args.sleep)
    if (!mined) return { ok: false, code: codes.CHAIN_TX_UNCONFIRMED, hashes }
  }
  return { ok: true, hashes }
}

export type CsCommandResult =
  | { readonly kind: "applied"; readonly stockOut?: string }
  | { readonly kind: "signed"; readonly hashes: readonly string[]; readonly stockOut?: string }
  | { readonly kind: "failed"; readonly code: string }

function stockOutOf(body: unknown): string | undefined {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return undefined
  const row = body as { readonly [key: string]: unknown }
  const value = row["stock_out"]
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "string" && value.length > 0) return value
  return undefined
}

function withStockOut<T extends { readonly kind: "applied" } | { readonly kind: "signed"; readonly hashes: readonly string[] }>(
  result: T,
  stockOut: string | undefined,
): T {
  if (stockOut === undefined) return result
  return { ...result, stockOut }
}

/** One CS round: prepare, then sign only when the port returned txs. A mock `applied` stops after that single post. */
export async function runCsCommand(args: {
  readonly post: (fields: { readonly [key: string]: Json }) => Promise<unknown>
  readonly wallet: WalletRequest | undefined
  readonly from: string
  readonly expectedChainId: bigint
  readonly rpcUrl: string
  readonly chainName: string
  readonly nativeSymbol: string
  readonly nativeDecimals: number
  readonly pollMs: bigint
  readonly timeoutMs: bigint
  readonly now: () => bigint
  readonly sleep: (ms: bigint) => Promise<void>
  readonly onStep?: (step: "sign" | "wait") => void
  readonly beforeConfirm?: () => Promise<void>
}): Promise<CsCommandResult> {
  const preparedBody = await args.post({ phase: "prepare" })
  const prepared = readPreparedCommand(preparedBody)
  if (prepared.kind === "failed") return prepared
  if (prepared.kind === "applied") return withStockOut({ kind: "applied" }, stockOutOf(preparedBody))
  let delivered = stockOutOf(preparedBody)
  if (args.wallet === undefined || args.from.length === 0) return { kind: "failed", code: codes.WALLET_NOT_CONNECTED }
  if (prepared.chainId !== undefined && prepared.chainId !== args.expectedChainId) {
    return { kind: "failed", code: codes.WALLET_WRONG_CHAIN }
  }
  const chain = await ensurePackChain({
    wallet: args.wallet,
    chainId: args.expectedChainId,
    rpcUrl: args.rpcUrl,
    chainName: args.chainName,
    nativeSymbol: args.nativeSymbol,
    nativeDecimals: args.nativeDecimals,
  })
  if (!chain.ok) return { kind: "failed", code: chain.code }
  let signed: ChainSignResult
  try {
    signed = await signChainTxs({
      wallet: args.wallet,
      from: args.from,
      txs: prepared.txs,
      pollMs: args.pollMs,
      timeoutMs: args.timeoutMs,
      now: args.now,
      sleep: args.sleep,
      ...(args.onStep === undefined ? {} : { onStep: args.onStep }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    return { kind: "failed", code: message.length > 0 ? message : codes.API_PACK_STALE }
  }
  if (!signed.ok) return { kind: "failed", code: signed.code }
  if (signed.hashes.length === 0) return { kind: "failed", code: codes.API_MALFORMED }
  const confirmFields = {
    phase: "confirm",
    ticket: prepared.ticket,
    tx_hashes: [...signed.hashes],
  }
  try {
    const confirmed = await postConfirm(args, confirmFields)
    const out = stockOutOf(confirmed)
    if (out !== undefined) delivered = out
    const reply = readPreparedCommand(confirmed)
    if (reply.kind === "failed") return { kind: "failed", code: reply.code }
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    return { kind: "failed", code: message.length > 0 ? message : codes.API_PACK_STALE }
  }
  return withStockOut({ kind: "signed", hashes: signed.hashes }, delivered)
}

function isStaleError(err: unknown): boolean {
  return err instanceof Error && err.message === codes.API_PACK_STALE
}

function isStaleBody(body: unknown): boolean {
  const reply = readPreparedCommand(body)
  return reply.kind === "failed" && reply.code === codes.API_PACK_STALE
}

/** Refresh, confirm the same ticket, and on a stale city clock confirm that ticket once more. */
async function postConfirm(
  args: {
    readonly beforeConfirm?: () => Promise<void>
    readonly post: (fields: { readonly [key: string]: Json }) => Promise<unknown>
  },
  fields: { readonly [key: string]: Json },
): Promise<unknown> {
  const send = async (): Promise<unknown> => {
    if (args.beforeConfirm !== undefined) await args.beforeConfirm()
    return args.post(fields)
  }
  try {
    const body = await send()
    if (!isStaleBody(body) || args.beforeConfirm === undefined) return body
  } catch (err) {
    if (!isStaleError(err) || args.beforeConfirm === undefined) throw err
  }
  return send()
}

export async function finishChainSign(args: {
  readonly wallet: WalletRequest
  readonly from: string
  readonly txs: readonly ChainTx[]
  readonly pollMs: bigint
  readonly timeoutMs: bigint
  readonly now: () => bigint
  readonly sleep: (ms: bigint) => Promise<void>
  readonly onStep?: (step: "sign" | "wait") => void
  readonly confirm: (hashes: readonly string[]) => Promise<void>
}): Promise<ChainSignResult> {
  const signed = await signChainTxs(args)
  if (!signed.ok) return signed
  if (signed.hashes.length === 0) return signed
  await args.confirm(signed.hashes)
  return signed
}

async function readChain(wallet: WalletRequest): Promise<bigint | undefined> {
  try {
    return parseWalletChain(await wallet.request({ method: "eth_chainId" }))
  } catch {
    return undefined
  }
}

async function waitReceipt(
  wallet: WalletRequest,
  hash: string,
  pollMs: bigint,
  timeoutMs: bigint,
  now: () => bigint,
  sleep: (ms: bigint) => Promise<void>,
): Promise<boolean> {
  const start = now()
  while (now() - start <= timeoutMs) {
    let receipt: unknown
    try {
      receipt = await wallet.request({ method: "eth_getTransactionReceipt", params: [hash] })
    } catch {
      receipt = undefined
    }
    const status = receiptStatus(receipt)
    if (status === "ok") return true
    if (status === "fail") return false
    if (now() - start >= timeoutMs) return false
    await sleep(pollMs)
  }
  return false
}

function receiptStatus(receipt: unknown): "ok" | "fail" | "pending" {
  if (receipt === null || receipt === undefined || typeof receipt !== "object") return "pending"
  const status = (receipt as { readonly status?: unknown }).status
  if (status === "0x1" || status === "0x01" || status === 1 || status === 1n) return "ok"
  if (status === "0x0" || status === "0x00" || status === 0 || status === 0n) return "fail"
  return "pending"
}

function hexQuantity(value: string): string {
  if (value.startsWith("0x")) return value
  if (value.length === 0) return "0x0"
  return "0x" + BigInt(value).toString(16)
}

function errorCode(err: unknown): number | undefined {
  if (err === null || typeof err !== "object") return undefined
  const code = (err as { readonly code?: unknown }).code
  if (typeof code === "number") return code
  return undefined
}
