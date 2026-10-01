import { claimEveryAsset, type Dict } from "@corporator/engine"
import { dataPrizeClaim, PRIZE_KETTLE_FARM, PRIZE_KETTLE_MONTH, type AssetPort, type PrizeTreasuryPort } from "@corporator/chainport"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { outsideWorldLock } from "./city_lock.js"
import { chainTxKey } from "./commit_bank.js"
import { type PackCtx } from "./pack_ctx.js"
import { cityKind, errResult, okResult, statusFor, type HttpResult } from "./envelope.js"
import { getBytes, putBytes, type Store } from "./store.js"
import { asBigint, asEngineDict, asText, walk, type Json } from "./values.js"

export type PrizeCustody = {
  readonly live: boolean
  readonly treasury: PrizeTreasuryPort
  readonly caller: string
  readonly settled?: boolean
}

export function prizeAssets(ctx: PackCtx): readonly string[] {
  const raw = walk(ctx.pack, ["generated", "seasons", "prize_assets"])
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === "string") out.push(item)
  }
  return out
}

async function claimOnChain(
  treasury: PrizeTreasuryPort,
  caller: string,
  asset: string,
): Promise<boolean> {
  const farm = await treasury.claimPrize(caller, asset, PRIZE_KETTLE_FARM)
  const month = await treasury.claimPrize(caller, asset, PRIZE_KETTLE_MONTH)
  return farm.ok || month.ok
}

/** Local projection is not custody. Paid atoms require a live PrizeTreasury transfer. */
export async function applyClaimPrize(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  cityId: string,
  custody?: PrizeCustody,
): Promise<HttpResult> {
  const kind = cityKind(state, cityId)
  if (kind === "demo") return errResult(ctx, state, codes.DEMO_NO_PRIZE)
  const assets = prizeAssets(ctx)
  const owedRaw = asEngineDict(city["prize_owed"] ?? {})
  const poolRaw = asEngineDict(city["prize_pool_in"] ?? {})
  const owed: { [asset: string]: bigint } = {}
  const poolIn: { [asset: string]: bigint } = {}
  for (const asset of assets) {
    try {
      owed[asset] = asBigint(owedRaw[asset], 0n)
    } catch {
      owed[asset] = 0n
    }
    try {
      poolIn[asset] = asBigint(poolRaw[asset], 0n)
    } catch {
      poolIn[asset] = 0n
    }
  }
  const rows = claimEveryAsset({
    assets,
    owed,
    poolIn,
    demo: false,
  })
  const listed: Json[] = []
  for (const row of rows) {
    let paid = row.paid
    let code = row.code
    if (paid > 0n) {
      const settled = custody !== undefined && custody.settled === true
      const live = custody !== undefined && custody.live && custody.caller.length > 0
      if (settled) {
        paid = row.paid
        code = row.code
      } else if (!live) {
        paid = 0n
        code = codes.PRIZE_CLAIM_UNCOVERED
      } else {
        const transferred = await outsideWorldLock(state, () =>
          claimOnChain(custody.treasury, custody.caller, row.asset),
        )
        if (!transferred) {
          paid = 0n
          code = codes.PRIZE_CLAIM_UNCOVERED
        }
      }
    }
    listed.push({
      asset: row.asset,
      paid,
      code,
      owed: row.owed,
      pool_in: row.assetPool,
    })
  }
  return okResult(ctx, state, { effect: "claim_prize", assets: listed })
}

export function walletCallerOf(city: Dict): string {
  return asText(city["wallet"])
}

const DEPLOYED_KEYS = ["token", "curve", "pool", "hook", "tx"] as const
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

/** True only when every launch.deployed field is a non-empty string. */
export function launchDeployed(ctx: PackCtx): boolean {
  for (const key of DEPLOYED_KEYS) {
    const val = walk(ctx.pack, ["sections", "launch", "deployed", key])
    if (typeof val !== "string" || val.length === 0) return false
  }
  return true
}

function envAddr(name: string): string {
  const v = process.env[name]
  if (v === undefined || !ADDR_RE.test(v)) return ""
  return v
}

export function stockAddress(ticker: string): string {
  return envAddr("CORPORATOR_STOCK_" + ticker)
}

export function prizeTreasuryAddress(): string {
  return envAddr("CORPORATOR_PRIZE_TREASURY")
}

export function prizeChainId(ctx: PackCtx): string {
  return asBigint(walk(ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
}

function statusForStored(ctx: PackCtx, body: Uint8Array): bigint {
  try {
    const parsed = parseJson(fromUtf8(body))
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const code = asText(parsed["code"])
      if (code.length > 0) return statusFor(ctx, code)
    }
  } catch {
    return ctx.httpOk
  }
  return ctx.httpOk
}

function readHashes(value: Json | undefined): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || !item.startsWith("0x") || item.length < 3) return undefined
    out.push(item)
  }
  return out
}

function readTxs(value: Json | undefined): readonly { readonly to: string; readonly data: string; readonly value: string; readonly label: string }[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: { readonly to: string; readonly data: string; readonly value: string; readonly label: string }[] = []
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined
    const to = asText(item["to"])
    const data = asText(item["data"])
    const label = asText(item["label"])
    if (to.length === 0 || data.length === 0 || label.length === 0) return undefined
    out.push({ to, data, value: asText(item["value"]), label })
  }
  return out
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** Player-signed claim. Only when launch.deployed is filled. Empty deployed never reaches here. */
export async function prepareClaimPrize(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  cityId: string,
  intentId: string,
  expected: bigint,
  port: AssetPort,
): Promise<HttpResult> {
  if (!launchDeployed(ctx)) return errResult(ctx, state, codes.DEMO_NO_PRIZE)
  const key = cityId + ":" + intentId
  const prior = await getBytes(store, "intents", key)
  if (prior !== undefined) return { status: statusForStored(ctx, prior), body: prior, headers: {} }
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_PRIZE)
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  const wallet = asText(city["wallet"])
  if (wallet.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const treasury = prizeTreasuryAddress()
  if (treasury.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const txJson: { readonly [key: string]: Json }[] = []
  let readable = 0
  for (const asset of prizeAssets(ctx)) {
    const token = stockAddress(asset)
    if (token.length === 0) continue
    const owed = await port.prizeTreasury.owed(PRIZE_KETTLE_MONTH, token, wallet)
    if (!owed.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    readable += 1
    if (owed.amount <= 0n) continue
    const data = dataPrizeClaim(token, PRIZE_KETTLE_MONTH)
    if (data.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    txJson.push({ to: treasury, data, value: "0", label: "claim" })
  }
  if (readable === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  if (txJson.length === 0) return errResult(ctx, state, codes.PRIZE_NOTHING_OWED)
  const result = okResult(ctx, state, {
    phase: "prepared",
    ticket: intentId,
    chain_id: prizeChainId(ctx),
    effect: "claim_prize",
    txs: txJson,
  })
  await putBytes(store, "intents", key, result.body, cityKind(state, cityId))
  return result
}

export type PrizeConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | { readonly ok: true; readonly hashes: readonly string[] }

export async function verifyPrizeConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
): Promise<PrizeConfirm> {
  if (!launchDeployed(ctx)) return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  const ticket = asText(body["ticket"])
  const hashes = readHashes(body["tx_hashes"])
  if (ticket.length === 0 || hashes === undefined) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  for (const hash of hashes) {
    const prior = await getBytes(store, "intents", chainTxKey(hash))
    if (prior !== undefined) {
      return { ok: false, result: { status: statusForStored(ctx, prior), body: prior, headers: {} } }
    }
  }
  const raw = await getBytes(store, "intents", cityId + ":" + ticket)
  if (raw === undefined) return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  let parsed: Json
  try {
    parsed = parseJson(fromUtf8(raw))
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  if (asText(parsed["phase"]) !== "prepared" || asText(parsed["effect"]) !== "claim_prize" || asText(parsed["ticket"]) !== ticket) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const txs = readTxs(parsed["txs"])
  if (txs === undefined || txs.length !== hashes.length) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const wallet = asText(city["wallet"])
  if (wallet.length === 0) return { ok: false, result: errResult(ctx, state, codes.WALLET_NOT_CONNECTED) }
  for (let i = 0; i < hashes.length; i += 1) {
    const hash = hashes.at(i)
    const tx = txs.at(i)
    if (hash === undefined || tx === undefined) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
    const receipt = await port.chain.transactionReceipt(hash)
    if (!receipt.ok || receipt.status !== 1n) {
      return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    }
    const seen = await port.chain.transactionByHash(hash)
    if (!seen.ok) return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    if (!sameHex(seen.from, wallet) || !sameHex(seen.to, tx.to) || !sameHex(seen.input, tx.data)) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
  }
  return { ok: true, hashes }
}
