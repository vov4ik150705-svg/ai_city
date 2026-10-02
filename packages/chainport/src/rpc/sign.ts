import { createHmac } from "node:crypto"
import { etc, getPublicKey, sign, Signature } from "@noble/secp256k1"
import { bytesToHex, hexToBytes, keccak256 } from "./keccak.js"
import type { RpcOutcome } from "../values.js"
import { encodeSignedTx } from "./codec.js"
import { postEth, type JsonRpcPost } from "./jsonrpc.js"

const EIP155_V_OFFSET = 35n
const EIP155_CHAIN_MUL = 2n

let hmacReady = false

function ensureHmac(): void {
  if (hmacReady) return
  etc.hmacSha256Sync = (key, ...msgs) => {
    const mac = createHmac("sha256", key)
    for (const msg of msgs) mac.update(msg)
    return new Uint8Array(mac.digest())
  }
  hmacReady = true
}

function strip0x(hex: string): string {
  if (hex.length >= 2 && (hex.startsWith("0x") || hex.startsWith("0X"))) return hex.slice(2)
  return hex
}

function parsePriv(raw: string): Uint8Array | undefined {
  const hex = strip0x(raw)
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return undefined
  try {
    return hexToBytes(hex.toLowerCase())
  } catch {
    return undefined
  }
}

export function addressOfPrivateKey(raw: string): string | undefined {
  const priv = parsePriv(raw)
  if (priv === undefined) return undefined
  const pub = getPublicKey(priv, false)
  const body = pub.subarray(1)
  return "0x" + bytesToHex(keccak256(body).subarray(12))
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let n = 0
  for (const part of parts) n += part.length
  const out = new Uint8Array(n)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

function beLen(n: number): Uint8Array {
  if (n <= 0) return new Uint8Array()
  let hex = n.toString(16)
  if (hex.length % 2 !== 0) hex = "0" + hex
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function intBytes(n: bigint): Uint8Array {
  if (n <= 0n) return new Uint8Array()
  let hex = n.toString(16)
  if (hex.length % 2 !== 0) hex = "0" + hex
  return hexToBytes(hex)
}

function rlpString(bytes: Uint8Array): Uint8Array {
  const head = bytes[0]
  if (bytes.length === 1 && head !== undefined && head < 0x80) return bytes
  if (bytes.length <= 55) {
    const out = new Uint8Array(1 + bytes.length)
    out[0] = 0x80 + bytes.length
    out.set(bytes, 1)
    return out
  }
  const len = beLen(bytes.length)
  const out = new Uint8Array(1 + len.length + bytes.length)
  out[0] = 0xb7 + len.length
  out.set(len, 1)
  out.set(bytes, 1 + len.length)
  return out
}

function rlpList(items: readonly Uint8Array[]): Uint8Array {
  const payload = concat(items)
  if (payload.length <= 55) {
    const out = new Uint8Array(1 + payload.length)
    out[0] = 0xc0 + payload.length
    out.set(payload, 1)
    return out
  }
  const len = beLen(payload.length)
  const out = new Uint8Array(1 + len.length + payload.length)
  out[0] = 0xf7 + len.length
  out.set(len, 1)
  out.set(payload, 1 + len.length)
  return out
}

function readLen(bytes: Uint8Array, at: number, size: number): { readonly n: number; readonly next: number } | undefined {
  if (at + size > bytes.length) return undefined
  let n = 0
  for (let i = 0; i < size; i += 1) {
    const b = bytes[at + i]
    if (b === undefined) return undefined
    n = n * 256 + b
  }
  return { n, next: at + size }
}

function rlpRead(bytes: Uint8Array, at: number): { readonly item: Uint8Array | readonly Uint8Array[]; readonly next: number } | undefined {
  const tag = bytes[at]
  if (tag === undefined) return undefined
  if (tag < 0x80) return { item: bytes.subarray(at, at + 1), next: at + 1 }
  if (tag <= 0xb7) {
    const len = tag - 0x80
    const next = at + 1 + len
    if (next > bytes.length) return undefined
    return { item: bytes.subarray(at + 1, next), next }
  }
  if (tag <= 0xbf) {
    const size = tag - 0xb7
    const got = readLen(bytes, at + 1, size)
    if (got === undefined) return undefined
    const next = got.next + got.n
    if (next > bytes.length) return undefined
    return { item: bytes.subarray(got.next, next), next }
  }
  if (tag <= 0xf7) {
    const len = tag - 0xc0
    const end = at + 1 + len
    if (end > bytes.length) return undefined
    const items = rlpItems(bytes.subarray(at + 1, end))
    if (items === undefined) return undefined
    return { item: items, next: end }
  }
  const size = tag - 0xf7
  const got = readLen(bytes, at + 1, size)
  if (got === undefined) return undefined
  const end = got.next + got.n
  if (end > bytes.length) return undefined
  const items = rlpItems(bytes.subarray(got.next, end))
  if (items === undefined) return undefined
  return { item: items, next: end }
}

function rlpItems(bytes: Uint8Array): Uint8Array[] | undefined {
  const out: Uint8Array[] = []
  let at = 0
  while (at < bytes.length) {
    const got = rlpRead(bytes, at)
    if (got === undefined) return undefined
    if (got.item instanceof Uint8Array) out.push(got.item)
    else return undefined
    at = got.next
  }
  return out
}

export type LegacyFields = {
  readonly nonce: bigint
  readonly gasPrice: bigint
  readonly gasLimit: bigint
  readonly to: string
  readonly value: bigint
  readonly data: string
  readonly v: bigint
  readonly r: bigint
  readonly s: bigint
}

function bytesToInt(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n
  return BigInt("0x" + bytesToHex(bytes))
}

function addrOf(bytes: Uint8Array): string {
  return "0x" + bytesToHex(bytes)
}

export function parseLegacyTx(rawHex: string): LegacyFields | undefined {
  const hex = strip0x(rawHex)
  if (hex.length === 0 || hex.length % 2 !== 0) return undefined
  let bytes: Uint8Array
  try {
    bytes = hexToBytes(hex)
  } catch {
    return undefined
  }
  const top = rlpRead(bytes, 0)
  if (top === undefined || top.next !== bytes.length || top.item instanceof Uint8Array) return undefined
  const items = top.item
  if (items.length !== 9) return undefined
  const nonce = items[0]
  const gasPrice = items[1]
  const gasLimit = items[2]
  const to = items[3]
  const value = items[4]
  const data = items[5]
  const v = items[6]
  const r = items[7]
  const s = items[8]
  if (
    nonce === undefined ||
    gasPrice === undefined ||
    gasLimit === undefined ||
    to === undefined ||
    value === undefined ||
    data === undefined ||
    v === undefined ||
    r === undefined ||
    s === undefined
  ) {
    return undefined
  }
  return {
    nonce: bytesToInt(nonce),
    gasPrice: bytesToInt(gasPrice),
    gasLimit: bytesToInt(gasLimit),
    to: addrOf(to),
    value: bytesToInt(value),
    data: "0x" + bytesToHex(data),
    v: bytesToInt(v),
    r: bytesToInt(r),
    s: bytesToInt(s),
  }
}

function pad32(n: bigint): Uint8Array | undefined {
  const raw = intBytes(n)
  if (raw.length > 32) return undefined
  const out = new Uint8Array(32)
  out.set(raw, 32 - raw.length)
  return out
}

export function recoverLegacySender(rawHex: string, chainId: bigint): string | undefined {
  const fields = parseLegacyTx(rawHex)
  if (fields === undefined) return undefined
  const rec = fields.v - (chainId * EIP155_CHAIN_MUL + EIP155_V_OFFSET)
  if (rec !== 0n && rec !== 1n) return undefined
  const parsed = parseRawItems(rawHex)
  if (parsed === undefined) return undefined
  const unsigned = rlpList([
    rlpString(parsed[0] ?? new Uint8Array()),
    rlpString(parsed[1] ?? new Uint8Array()),
    rlpString(parsed[2] ?? new Uint8Array()),
    rlpString(parsed[3] ?? new Uint8Array()),
    rlpString(parsed[4] ?? new Uint8Array()),
    rlpString(parsed[5] ?? new Uint8Array()),
    rlpString(intBytes(chainId)),
    rlpString(new Uint8Array()),
    rlpString(new Uint8Array()),
  ])
  const r = pad32(fields.r)
  const s = pad32(fields.s)
  if (r === undefined || s === undefined) return undefined
  try {
    const hash = keccak256(unsigned)
    const compact = concat([r, s])
    const sig = Signature.fromCompact(compact).addRecoveryBit(Number(rec))
    const pub = sig.recoverPublicKey(hash).toRawBytes(false)
    return "0x" + bytesToHex(keccak256(pub.subarray(1)).subarray(12))
  } catch {
    return undefined
  }
}

function parseRawItems(rawHex: string): Uint8Array[] | undefined {
  const hex = strip0x(rawHex)
  let bytes: Uint8Array
  try {
    bytes = hexToBytes(hex)
  } catch {
    return undefined
  }
  const top = rlpRead(bytes, 0)
  if (top === undefined || top.item instanceof Uint8Array) return undefined
  return [...top.item]
}

function hexData(data: string): Uint8Array | undefined {
  const hex = strip0x(data)
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return undefined
  try {
    return hexToBytes(hex.toLowerCase())
  } catch {
    return undefined
  }
}

function addrBytes(raw: string): Uint8Array | undefined {
  const hex = strip0x(raw)
  if (hex.length !== 40) return undefined
  return hexData("0x" + hex)
}

export function gasLimitOf(estimate: bigint, bps: bigint, headroomBps: bigint): bigint | undefined {
  if (bps <= 0n || estimate <= 0n) return undefined
  return (estimate * (bps + headroomBps)) / bps
}

export type SignedLegacy = {
  readonly raw: string
  readonly nonce: bigint
}

export function signLegacyTx(args: {
  readonly privateKey: string
  readonly chainId: bigint
  readonly nonce: bigint
  readonly gasPrice: bigint
  readonly gasLimit: bigint
  readonly to: string
  readonly data: string
  readonly value?: bigint
}): SignedLegacy | undefined {
  const priv = parsePriv(args.privateKey)
  const to = addrBytes(args.to)
  const data = hexData(args.data)
  const value = args.value ?? 0n
  if (priv === undefined || to === undefined || data === undefined || value < 0n) return undefined
  ensureHmac()
  const unsigned = rlpList([
    rlpString(intBytes(args.nonce)),
    rlpString(intBytes(args.gasPrice)),
    rlpString(intBytes(args.gasLimit)),
    rlpString(to),
    rlpString(intBytes(value)),
    rlpString(data),
    rlpString(intBytes(args.chainId)),
    rlpString(new Uint8Array()),
    rlpString(new Uint8Array()),
  ])
  let sig: ReturnType<typeof sign>
  try {
    sig = sign(keccak256(unsigned), priv, { lowS: true })
  } catch {
    return undefined
  }
  const v = args.chainId * EIP155_CHAIN_MUL + EIP155_V_OFFSET + BigInt(sig.recovery)
  const rawBody = rlpList([
    rlpString(intBytes(args.nonce)),
    rlpString(intBytes(args.gasPrice)),
    rlpString(intBytes(args.gasLimit)),
    rlpString(to),
    rlpString(intBytes(value)),
    rlpString(data),
    rlpString(intBytes(v)),
    rlpString(intBytes(sig.r)),
    rlpString(intBytes(sig.s)),
  ])
  return { raw: "0x" + bytesToHex(rawBody), nonce: args.nonce }
}

export const ROLE_ENV = {
  minter: "CORPORATOR_VAULT_MINTER",
  voucher: "CORPORATOR_VOUCHER_SIGNER",
  signer: "CORPORATOR_SIGNER",
} as const

export type RoleName = keyof typeof ROLE_ENV

export function roleKey(role: RoleName): string {
  const value = process.env[ROLE_ENV[role]]
  if (value === undefined || value.length === 0) return ""
  return value
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

function receiptConfirmed(body: string): boolean {
  if (body === "null") return false
  let parsed: unknown
  try {
    parsed = JSON.parse(body) as unknown
  } catch {
    return false
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false
  const status = (parsed as { readonly status?: unknown }).status
  return status === "0x1" || status === "0X1"
}

export type InflightTx = { readonly nonce: bigint; readonly hash: string }

export async function broadcastRoleTx(args: {
  readonly post: JsonRpcPost
  readonly chainId: bigint
  readonly bps: bigint | undefined
  readonly gasHeadroomBps: bigint | undefined
  readonly role: RoleName
  readonly to: string
  readonly data: string
  readonly inflight: Map<string, InflightTx>
  readonly signOnly?: boolean
}): Promise<RpcOutcome> {
  const key = roleKey(args.role)
  const from = key.length === 0 ? undefined : addressOfPrivateKey(key)
  if (from === undefined || args.bps === undefined || args.gasHeadroomBps === undefined) {
    return { status: "silence" }
  }
  const chain = await postEth(args.post, "eth_chainId", [])
  if (chain.status !== "ok") return { status: "silence" }
  const gotChain = parseHexUint(chain.body)
  if (gotChain === undefined || gotChain !== args.chainId) return { status: "silence" }
  const prior = args.inflight.get(from)
  if (prior !== undefined) {
    const rec = await postEth(args.post, "eth_getTransactionReceipt", [prior.hash])
    if (rec.status !== "ok" || !receiptConfirmed(rec.body)) return { status: "silence" }
    args.inflight.delete(from)
  }
  const nonceRaw = await postEth(args.post, "eth_getTransactionCount", [from, "pending"])
  if (nonceRaw.status !== "ok") return { status: "silence" }
  const nonce = parseHexUint(nonceRaw.body)
  if (nonce === undefined) return { status: "silence" }
  const priceRaw = await postEth(args.post, "eth_gasPrice", [])
  if (priceRaw.status !== "ok") return { status: "silence" }
  const gasPrice = parseHexUint(priceRaw.body)
  if (gasPrice === undefined) return { status: "silence" }
  const estimateRaw = await postEth(args.post, "eth_estimateGas", [{ from, to: args.to, data: args.data, value: "0x0" }])
  if (estimateRaw.status !== "ok") return { status: "silence" }
  const estimate = parseHexUint(estimateRaw.body)
  if (estimate === undefined) return { status: "silence" }
  const gasLimit = gasLimitOf(estimate, args.bps, args.gasHeadroomBps)
  if (gasLimit === undefined) return { status: "silence" }
  const signed = signLegacyTx({
    privateKey: key,
    chainId: args.chainId,
    nonce,
    gasPrice,
    gasLimit,
    to: args.to,
    data: args.data,
  })
  if (signed === undefined) return { status: "silence" }
  const hash = "0x" + bytesToHex(keccak256(hexToBytes(strip0x(signed.raw))))
  if (args.signOnly === true) {
    return { status: "ok", body: encodeSignedTx(hash, nonce, signed.raw) }
  }
  const sent = await postEth(args.post, "eth_sendRawTransaction", [signed.raw])
  if (sent.status !== "ok") return { status: "silence" }
  args.inflight.set(from, { nonce, hash: sent.body })
  return { status: "ok", body: encodeSignedTx(hash, nonce, signed.raw) }
}
