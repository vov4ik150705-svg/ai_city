import { applySpend, unstake, type Dict } from "@corporator/engine"
import { dataApprove, dataClaimUnstaked, dataRequestUnstake, dataStake, type AssetPort } from "@corporator/chainport"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { type PackCtx } from "./pack_ctx.js"
import { cityKind, envelopeErr, errResult, okResult, statusFor, type HttpResult } from "./envelope.js"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "./values.js"
import { getBytes, type Store } from "./store.js"
import { commitPrepared, takenChainTx } from "./commit_bank.js"
import { receiptLanded } from "./reorg.js"
import { prizeCustodyLive } from "./custody.js"

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function districtIds(city: Dict): string[] {
  const out: string[] = []
  for (const item of asList(city["districts"])) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

export function districtSpec(
  ctx: PackCtx,
  districtId: string,
): { readonly id: string; readonly ticker: string; readonly playable: boolean } | undefined {
  const defs = asObj(walk(ctx.pack, ["sections", "districts", "districts"]))
  const raw = defs[districtId]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const def = asObj(raw)
  const ticker = asText(def["ticker"])
  if (ticker.length === 0) return undefined
  return { id: districtId, ticker, playable: def["playable_v1"] === true }
}

export function districtByTicker(ctx: PackCtx, ticker: string): string {
  if (ticker.length === 0) return ""
  const defs = asObj(walk(ctx.pack, ["sections", "districts", "districts"]))
  for (const id of Object.keys(defs)) {
    const spec = districtSpec(ctx, id)
    if (spec !== undefined && spec.ticker === ticker) return spec.id
  }
  return ""
}

export function stakeMin(ctx: PackCtx, ticker: string): bigint {
  return asBigint(walk(ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

export function stakeHeld(city: Dict, ticker: string): bigint {
  const settled = asEngineDict(city["stake_settled"])
  return asBigint(settled[ticker], 0n)
}

export function tokensHeld(city: Dict, ticker: string): bigint {
  const held = asEngineDict(city["tokens_held"])
  return asBigint(held[ticker], 0n)
}

function stakeStep(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["sections", "progression", "params", "stake_mult_step", "v"]))
}

export function nextStakeNeed(ctx: PackCtx, ticker: string, have: bigint): bigint {
  const unit = stakeStep(ctx) * stakeMin(ctx, ticker)
  if (unit <= 0n) return 0n
  return (have / unit + 1n) * unit
}

function moveStake(city: Dict, ticker: string, amount: bigint): void {
  const settled = asEngineDict(city["stake_settled"])
  const held = asEngineDict(city["tokens_held"])
  settled[ticker] = stakeHeld(city, ticker) + amount
  held[ticker] = tokensHeld(city, ticker) - amount
  city["stake_settled"] = settled
  city["tokens_held"] = held
}

function creditStake(city: Dict, ticker: string, amount: bigint): void {
  const settled = asEngineDict(city["stake_settled"])
  settled[ticker] = stakeHeld(city, ticker) + amount
  city["stake_settled"] = settled
}

export function settleStake(ctx: PackCtx, city: Dict, spec: { readonly id: string; readonly ticker: string; readonly playable: boolean }): void {
  if (stakeHeld(city, spec.ticker) < stakeMin(ctx, spec.ticker)) return
  thawDistrict(city, spec.ticker)
  if (asText(city["account_kind"]) === "wallet" && spec.playable && !districtIds(city).includes(spec.id)) {
    openDistrictAtTier1(ctx, city, spec)
  }
}

function thawDistrict(city: Dict, ticker: string): void {
  const freeze = asEngineDict(city["district_freeze_until"])
  if (ticker in freeze) {
    delete freeze[ticker]
    city["district_freeze_until"] = freeze
  }
  const kept: unknown[] = []
  for (const item of asList(city["unstake_pending"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      kept.push(item)
      continue
    }
    if (asText(asEngineDict(item)["ticker"]) === ticker) continue
    kept.push(item)
  }
  city["unstake_pending"] = kept
}

export function resolveDistrictId(ctx: PackCtx, body: { readonly [key: string]: Json }): string {
  const raw = asText(body["district_id"])
  if (districtSpec(ctx, raw) !== undefined) return raw
  const alias = raw.length > 0 ? raw : asText(body["ticker"])
  return districtByTicker(ctx, alias)
}

function tierCount(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["sections", "progression", "params", "tier_count", "v"]))
}

export function districtTier(city: Dict, districtId: string): bigint {
  return asBigint(asEngineDict(city["district_tiers"])[districtId], 0n)
}

function setDistrictTier(city: Dict, districtId: string, tier: bigint): void {
  const tiers = asEngineDict(city["district_tiers"])
  tiers[districtId] = tier
  city["district_tiers"] = tiers
}

function tierGate(
  ctx: PackCtx,
  t: bigint,
): { readonly cityLevelReq: bigint; readonly stakeMult: bigint; readonly requiresPrev: bigint } | undefined {
  const gates = asObj(walk(ctx.pack, ["generated", "progression", "tier_gates"]))
  const raw = gates[t.toString()]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const g = asObj(raw)
  if (!("city_level_req" in g) || !("stake_mult" in g)) return undefined
  return {
    cityLevelReq: asBigint(g["city_level_req"]),
    stakeMult: asBigint(g["stake_mult"]),
    requiresPrev: asBigint(g["requires_prev"], 0n),
  }
}

function tierCost(ctx: PackCtx, t: bigint): bigint | undefined {
  const costs = asObj(walk(ctx.pack, ["generated", "progression", "tier_cost"]))
  const key = t.toString()
  if (!(key in costs)) return undefined
  return asBigint(costs[key])
}

function progressionDividend(
  ctx: PackCtx,
  districtId: string,
  t: bigint,
): { readonly id: string; readonly key: string; readonly magnitude: bigint } | undefined {
  const id = "div_" + districtId + "_" + t.toString()
  const bag = asObj(walk(ctx.pack, ["generated", "progression", "progression_dividends"]))
  const raw = bag[id]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const row = asObj(raw)
  const key = asText(row["key"])
  if (key.length === 0 || !("magnitude" in row)) return undefined
  return { id, key, magnitude: asBigint(row["magnitude"]) }
}

export function pushNode(city: Dict, row: { readonly id: string; readonly key: string; readonly magnitude: bigint }): void {
  const nodes = asList(city["nodes"])
  for (const item of nodes) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    if (asText(asEngineDict(item)["id"]) === row.id) return
  }
  nodes.push({ id: row.id, key: row.key, magnitude: row.magnitude })
  city["nodes"] = nodes
}

function openDistrictAtTier1(
  ctx: PackCtx,
  city: Dict,
  spec: { readonly id: string; readonly ticker: string },
): void {
  const opened = districtIds(city)
  if (!opened.includes(spec.id)) {
    opened.push(spec.id)
    city["districts"] = opened
  }
  if (districtTier(city, spec.id) >= 1n) return
  const div = progressionDividend(ctx, spec.id, 1n)
  if (div !== undefined) pushNode(city, div)
  setDistrictTier(city, spec.id, 1n)
}

export function applyOpenDistrict(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
): HttpResult {
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const districtId = resolveDistrictId(ctx, body)
  if (districtId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const opened = districtIds(city)
  if (opened.includes(spec.id)) {
    return okResult(ctx, state, { effect: "open_district", district_id: spec.id, ticker: spec.ticker })
  }
  if (!spec.playable) return errResult(ctx, state, codes.DISTRICT_LOCKED)
  const need = stakeMin(ctx, spec.ticker)
  const have = stakeHeld(city, spec.ticker)
  if (have < need) return errResult(ctx, state, codes.STAKE_BELOW_THRESHOLD)
  openDistrictAtTier1(ctx, city, spec)
  return okResult(ctx, state, { effect: "open_district", district_id: spec.id, ticker: spec.ticker })
}

export async function applyStake(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  port?: AssetPort,
): Promise<HttpResult> {
  const source = asText(body["source"])
  if (source.length > 0 && source !== "ledger" && source !== "wallet") {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const fromWallet = source === "wallet"
  if (port !== undefined && prizeCustodyLive(port) && !fromWallet) {
    return errResult(ctx, state, codes.STAKE_LEDGER_LIVE)
  }
  const districtId = resolveDistrictId(ctx, body)
  if (districtId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const have = stakeHeld(city, spec.ticker)
  const need = nextStakeNeed(ctx, spec.ticker, have)
  if (need <= have) return errResult(ctx, state, codes.STAKE_MULT_SHORT)
  const delta = need - have
  let take = delta
  if ("amount" in body) {
    take = asBigint(body["amount"])
    if (take <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
    if (take < delta) return errResult(ctx, state, codes.STAKE_MULT_SHORT)
  }
  if (!fromWallet && tokensHeld(city, spec.ticker) < take) return errResult(ctx, state, codes.STAKE_MULT_SHORT)
  if (fromWallet) {
    if (port === undefined || !prizeCustodyLive(port)) return errResult(ctx, state, codes.API_MALFORMED)
    creditStake(city, spec.ticker, take)
  } else moveStake(city, spec.ticker, take)
  settleStake(ctx, city, spec)
  const extra: { [key: string]: Json } = {
    effect: "stake",
    district_id: spec.id,
    ticker: spec.ticker,
    stake: stakeHeld(city, spec.ticker),
  }
  if (fromWallet) extra["phase"] = "applied"
  return okResult(ctx, state, extra)
}

export function applyUnstake(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
): HttpResult {
  const districtId = resolveDistrictId(ctx, body)
  if (districtId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (!("amount" in body)) return errResult(ctx, state, codes.API_MALFORMED)
  const amount = asBigint(body["amount"])
  if (amount <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
  const grace = asBigint(ctx.cfg["unstake_grace_city_hours"])
  const moved = unstake(city, spec.ticker, amount, asBigint(state["city_time"]), grace, stakeMin(ctx, spec.ticker))
  if (asBigint(moved["ok"]) !== 1n) return errResult(ctx, state, codes.STAKE_BELOW_THRESHOLD)
  return okResult(ctx, state, {
    effect: "unstake",
    district_id: spec.id,
    ticker: spec.ticker,
    stake: stakeHeld(city, spec.ticker),
  })
}

export function applyUnlockTier(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
): HttpResult {
  const districtId = resolveDistrictId(ctx, body)
  if (districtId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (!districtIds(city).includes(spec.id)) return errResult(ctx, state, codes.DISTRICT_LOCKED)
  const current = districtTier(city, spec.id)
  const max = tierCount(ctx)
  if (current >= max) return errResult(ctx, state, codes.TIER_NOT_UNLOCKED)
  const next = current + 1n
  const gate = tierGate(ctx, next)
  if (gate === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (current !== gate.requiresPrev) return errResult(ctx, state, codes.TIER_NOT_UNLOCKED)
  if (asBigint(city["city_level"], 1n) < gate.cityLevelReq) return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW)
  const need = gate.stakeMult * stakeMin(ctx, spec.ticker)
  if (stakeHeld(city, spec.ticker) < need) return errResult(ctx, state, codes.STAKE_MULT_SHORT)
  const cost = tierCost(ctx, next)
  if (cost === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const div = progressionDividend(ctx, spec.id, next)
  if (div === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (asBigint(city["capital"]) < cost) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  if (cost > 0n) applySpend(ctx.cfg, state, city, cost, 0n)
  pushNode(city, div)
  setDistrictTier(city, spec.id, next)
  return okResult(ctx, state, {
    effect: "unlock_tier",
    district_id: spec.id,
    ticker: spec.ticker,
    tier: next,
    capital: asBigint(city["capital"]),
  })
}

function progressionNode(
  ctx: PackCtx,
  nodeId: string,
):
  | {
      readonly id: string
      readonly district: string
      readonly axis: string
      readonly tier: bigint
      readonly exclusiveWith: string
      readonly key: string
      readonly magnitude: bigint
      readonly playable: boolean
    }
  | undefined {
  if (nodeId.length === 0) return undefined
  const bag = asObj(walk(ctx.pack, ["generated", "progression", "progression_nodes"]))
  const raw = bag[nodeId]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const row = asObj(raw)
  const district = asText(row["district"])
  const axis = asText(row["axis"])
  const key = asText(row["key"])
  if (district.length === 0 || axis.length === 0 || key.length === 0 || !("magnitude" in row) || !("tier" in row)) {
    return undefined
  }
  return {
    id: nodeId,
    district,
    axis,
    tier: asBigint(row["tier"]),
    exclusiveWith: asText(row["exclusive_with"]),
    key,
    magnitude: asBigint(row["magnitude"]),
    playable: row["playable_v1"] === true,
  }
}

function cityNodeIds(city: Dict): readonly string[] {
  const out: string[] = []
  for (const item of asList(city["nodes"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const id = asText(asEngineDict(item)["id"])
    if (id.length > 0) out.push(id)
  }
  return out
}

export function applyPickNode(ctx: PackCtx, state: Dict, city: Dict, body: { readonly [key: string]: Json }): HttpResult {
  const nodeId = asText(body["node_id"])
  const node = progressionNode(ctx, nodeId)
  if (node === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const hinted = resolveDistrictId(ctx, body)
  if (hinted.length > 0 && hinted !== node.district) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, node.district)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (!districtIds(city).includes(spec.id)) return errResult(ctx, state, codes.DISTRICT_LOCKED)
  if (!node.playable) return errResult(ctx, state, codes.DISTRICT_LOCKED)
  if (districtTier(city, spec.id) < node.tier) return errResult(ctx, state, codes.TIER_NOT_UNLOCKED)
  const taken = cityNodeIds(city)
  if (taken.includes(node.id)) {
    return okResult(ctx, state, {
      effect: "pick_node",
      district_id: spec.id,
      node_id: node.id,
      axis: node.axis,
      tier: node.tier,
    })
  }
  if (node.exclusiveWith.length > 0 && taken.includes(node.exclusiveWith)) {
    return errResult(ctx, state, codes.NODE_SIDE_LOCKED)
  }
  pushNode(city, { id: node.id, key: node.key, magnitude: node.magnitude })
  return okResult(ctx, state, {
    effect: "pick_node",
    district_id: spec.id,
    node_id: node.id,
    axis: node.axis,
    tier: node.tier,
  })
}

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export type StakeConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | {
      readonly ok: true
      readonly districtId: string
      readonly amount: bigint
      readonly hashes: readonly string[]
      readonly rows: readonly { readonly ticker: string; readonly amount: bigint }[]
    }

function envAddr(name: string): string {
  const raw = process.env[name]
  if (raw === undefined || !ADDR_RE.test(raw)) return ""
  return raw
}

function stockEnv(ticker: string): string {
  switch (ticker) {
    case "NVDA":
      return "CORPORATOR_STOCK_NVDA"
    case "TSLA":
      return "CORPORATOR_STOCK_TSLA"
    case "AMZN":
      return "CORPORATOR_STOCK_AMZN"
    case "AAPL":
      return "CORPORATOR_STOCK_AAPL"
    case "MSFT":
      return "CORPORATOR_STOCK_MSFT"
    case "COIN":
      return "CORPORATOR_STOCK_COIN"
    default:
      return ""
  }
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
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

function stakeChainId(ctx: PackCtx): string {
  return asBigint(walk(ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
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

function readTxs(value: Json | undefined): readonly { readonly to: string; readonly data: string }[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: { readonly to: string; readonly data: string }[] = []
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined
    const to = asText(item["to"])
    const data = asText(item["data"])
    if (to.length === 0 || data.length === 0) return undefined
    out.push({ to, data })
  }
  return out
}

function stakeTake(
  ctx: PackCtx,
  city: Dict,
  spec: { readonly ticker: string },
  body: { readonly [key: string]: Json },
): { readonly ok: true; readonly take: bigint } | { readonly ok: false; readonly code: string } {
  const have = stakeHeld(city, spec.ticker)
  const need = nextStakeNeed(ctx, spec.ticker, have)
  if (need <= have) return { ok: false, code: codes.STAKE_MULT_SHORT }
  const delta = need - have
  if (!("amount" in body)) return { ok: true, take: delta }
  let take: bigint
  try {
    take = asBigint(body["amount"])
  } catch {
    return { ok: false, code: codes.API_MALFORMED }
  }
  if (take <= 0n) return { ok: false, code: codes.API_MALFORMED }
  if (take < delta) return { ok: false, code: codes.STAKE_MULT_SHORT }
  return { ok: true, take }
}

/** Wallet stake recipe. Does not move tokens_held or open a district. */
export async function prepareStake(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  intentId: string,
  expected: bigint,
  port: AssetPort,
): Promise<HttpResult> {
  const key = cityId + ":" + intentId
  const prior = await getBytes(store, "intents", key)
  if (prior !== undefined) return { status: statusForStored(ctx, prior), body: prior, headers: {} }
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const account = asText(city["wallet"])
  if (account.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const districtId = resolveDistrictId(ctx, body)
  if (districtId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const planned = stakeTake(ctx, city, spec, body)
  if (!planned.ok) return errResult(ctx, state, planned.code)
  const token = envAddr(stockEnv(spec.ticker))
  const registry = envAddr("CORPORATOR_STAKE_REGISTRY")
  if (token.length === 0 || registry.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const allowed = await port.corpToken.allowance(account, registry, token)
  if (!allowed.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const txs: { readonly [key: string]: Json }[] = []
  if (allowed.amount < planned.take) {
    const approveData = dataApprove(registry, planned.take)
    if (approveData.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
    txs.push({ to: token, data: approveData, value: "0", label: "approve" })
  }
  const stakeData = dataStake(account, spec.ticker, planned.take)
  if (stakeData.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  txs.push({ to: registry, data: stakeData, value: "0", label: "stake" })
  const chainBefore = asBigint(asEngineDict(city["stake_chain"])[spec.ticker], 0n)
  const result = okResult(ctx, state, {
    phase: "prepared",
    ticket: intentId,
    chain_id: stakeChainId(ctx),
    effect: "stake",
    district_id: spec.id,
    ticker: spec.ticker,
    amount: planned.take,
    chain_before: chainBefore,
    txs,
  })
  const blocked = await commitPrepared(ctx, store, state, cityId, key, result.body)
  if (blocked !== undefined) return blocked
  return result
}

/** Chain check for a wallet stake. A spent hash returns the first answer. */
export async function verifyStakeConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
): Promise<StakeConfirm> {
  const ticket = asText(body["ticket"])
  const hashes = readHashes(body["tx_hashes"])
  if (ticket.length === 0 || hashes === undefined) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  for (const hash of hashes) {
    const taken = await takenChainTx(ctx, store, state, cityId, hash)
    if (taken !== undefined) return { ok: false, result: taken }
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
  if (asText(parsed["phase"]) !== "prepared" || asText(parsed["effect"]) !== "stake" || asText(parsed["ticket"]) !== ticket) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const districtId = asText(parsed["district_id"])
  let amount: bigint
  try {
    amount = asBigint(parsed["amount"])
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const txs = readTxs(parsed["txs"])
  if (districtId.length === 0 || amount <= 0n || txs === undefined || txs.length !== hashes.length) {
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
    if (!receiptLanded(ctx, receipt)) {
      return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    }
    const seen = await port.chain.transactionByHash(hash)
    if (!seen.ok) return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED) }
    if (!sameHex(seen.from, wallet) || !sameHex(seen.to, tx.to) || !sameHex(seen.input, tx.data)) {
      return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
    }
  }
  const ticker = asText(parsed["ticker"])
  const chainBefore = "chain_before" in parsed ? asBigint(parsed["chain_before"]) : 0n
  const snap = await port.stakeRegistry.snapshot(wallet)
  if (!snap.ok) return { ok: false, result: errResult(ctx, state, codes.SERVICE_DEGRADED) }
  let seenStake = 0n
  for (const row of snap.rows) {
    if (row.ticker === ticker) seenStake = row.amount
  }
  if (seenStake < chainBefore + amount) {
    return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED, true) }
  }
  return { ok: true, districtId, amount, hashes, rows: snap.rows }
}

export function stakeConfirmResult(ctx: PackCtx, state: Dict, city: Dict, districtId: string): HttpResult {
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  return okResult(ctx, state, {
    effect: "stake",
    district_id: spec.id,
    ticker: spec.ticker,
    stake: stakeHeld(city, spec.ticker),
    phase: "applied",
  })
}

type CoolingRow = { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }

export type UnstakeConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | {
      readonly ok: true
      readonly districtId: string
      readonly ticker: string
      readonly amount: bigint
      readonly priorCooling: bigint
      readonly hashes: readonly string[]
      readonly rows: readonly { readonly ticker: string; readonly amount: bigint }[]
      readonly cooling: readonly CoolingRow[]
    }

function cooldownS(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["generated", "api", "unstake_cooldown_s"]))
}

function coolingOf(rows: readonly CoolingRow[], ticker: string): CoolingRow | undefined {
  let found: CoolingRow | undefined
  for (const row of rows) {
    if (row.ticker === ticker) found = row
  }
  return found
}

function stakeOf(rows: readonly { readonly ticker: string; readonly amount: bigint }[], ticker: string): bigint {
  let seen = 0n
  for (const row of rows) {
    if (row.ticker === ticker) seen = row.amount
  }
  return seen
}

function coolingFresh(rows: readonly CoolingRow[], ticker: string, priorAmount: bigint, priorReady: bigint): boolean {
  const row = coolingOf(rows, ticker)
  if (row === undefined || row.amount <= 0n) return false
  if (priorAmount === 0n && priorReady === 0n) return true
  return row.amount !== priorAmount || row.readyAtS !== priorReady
}

/** Wallet unstake recipe. Reads the chain before any lock and does not move stake. */
export async function prepareUnstake(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  intentId: string,
  expected: bigint,
  port: AssetPort,
): Promise<HttpResult> {
  const key = cityId + ":" + intentId
  const prior = await getBytes(store, "intents", key)
  if (prior !== undefined) return { status: statusForStored(ctx, prior), body: prior, headers: {} }
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const account = asText(city["wallet"])
  if (account.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const districtId = resolveDistrictId(ctx, body)
  if (districtId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (!("amount" in body)) return errResult(ctx, state, codes.API_MALFORMED)
  let amount: bigint
  try {
    amount = asBigint(body["amount"])
  } catch {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (amount <= 0n) return errResult(ctx, state, codes.API_MALFORMED)
  const registry = envAddr("CORPORATOR_STAKE_REGISTRY")
  if (registry.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const snap = await port.stakeRegistry.snapshot(account)
  if (!snap.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const chainBefore = stakeOf(snap.rows, spec.ticker)
  if (amount > chainBefore) return errResult(ctx, state, codes.STAKE_BELOW_THRESHOLD)
  const cool = await port.stakeRegistry.coolingSnapshot(account)
  if (!cool.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const now = await port.chain.latestBlockTime()
  if (!now.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  let cooldown: bigint
  try {
    cooldown = cooldownS(ctx)
  } catch {
    return errResult(ctx, state, codes.SERVICE_DEGRADED)
  }
  const data = dataRequestUnstake(spec.ticker, amount)
  if (data.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const bucket = coolingOf(cool.rows, spec.ticker)
  const coolingBefore = bucket === undefined ? 0n : bucket.amount
  const coolingReady = bucket === undefined ? 0n : bucket.readyAtS
  const extra: { [key: string]: Json } = {
    phase: "prepared",
    ticket: intentId,
    chain_id: stakeChainId(ctx),
    effect: "unstake",
    district_id: spec.id,
    ticker: spec.ticker,
    amount,
    cooldown_s: cooldown,
    chain_before: chainBefore,
    cooling_before: coolingBefore,
    cooling_ready: coolingReady,
    txs: [{ to: registry, data, value: "0", label: "request_unstake" }],
  }
  if (bucket !== undefined && bucket.amount > 0n && bucket.readyAtS > now.amount) {
    extra["restarts_timer"] = 1n
    extra["ready_at_s"] = bucket.readyAtS
  }
  const result = okResult(ctx, state, extra)
  const blocked = await commitPrepared(ctx, store, state, cityId, key, result.body)
  if (blocked !== undefined) return blocked
  return result
}

/** Chain check for a wallet unstake. A lagged snapshot is retryable and is not stored. */
export async function verifyUnstakeConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
): Promise<UnstakeConfirm> {
  const ticket = asText(body["ticket"])
  const hashes = readHashes(body["tx_hashes"])
  if (ticket.length === 0 || hashes === undefined) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  for (const hash of hashes) {
    const taken = await takenChainTx(ctx, store, state, cityId, hash)
    if (taken !== undefined) return { ok: false, result: taken }
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
  const districtId = asText(parsed["district_id"])
  const ticker = asText(parsed["ticker"])
  let amount: bigint
  try {
    amount = asBigint(parsed["amount"])
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const txs = readTxs(parsed["txs"])
  if (districtId.length === 0 || ticker.length === 0 || amount <= 0n || txs === undefined || txs.length !== hashes.length) {
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
  const chainBefore = "chain_before" in parsed ? asBigint(parsed["chain_before"]) : 0n
  const priorCooling = "cooling_before" in parsed ? asBigint(parsed["cooling_before"]) : 0n
  const priorReady = "cooling_ready" in parsed ? asBigint(parsed["cooling_ready"]) : 0n
  const snap = await port.stakeRegistry.snapshot(wallet)
  if (!snap.ok) return { ok: false, result: errResult(ctx, state, codes.SERVICE_DEGRADED) }
  const seenStake = stakeOf(snap.rows, ticker)
  if (chainBefore < amount || seenStake > chainBefore - amount) {
    return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED, true) }
  }
  const cool = await port.stakeRegistry.coolingSnapshot(wallet)
  if (!cool.ok) return { ok: false, result: errResult(ctx, state, codes.SERVICE_DEGRADED) }
  if (!coolingFresh(cool.rows, ticker, priorCooling, priorReady)) {
    return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED, true) }
  }
  return {
    ok: true,
    districtId,
    ticker,
    amount,
    priorCooling,
    hashes,
    rows: snap.rows,
    cooling: cool.rows,
  }
}

export function unstakeConfirmResult(ctx: PackCtx, state: Dict, city: Dict, districtId: string): HttpResult {
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const bucket = asEngineDict(asEngineDict(city["unstake_cooldown"])[spec.ticker])
  return okResult(ctx, state, {
    effect: "unstake",
    district_id: spec.id,
    ticker: spec.ticker,
    stake: stakeHeld(city, spec.ticker),
    phase: "applied",
    cooldown_amount: asBigint(bucket["amount"], 0n),
    ready_at_s: asBigint(bucket["ready_at_s"], 0n),
  })
}

function coolingRefusal(ctx: PackCtx, state: Dict, readyAtS: bigint): HttpResult {
  const row = envelopeErr(ctx, state, codes.UNSTAKE_COOLING)
  const body =
    row !== null && typeof row === "object" && !Array.isArray(row) ? { ...row, ready_at_s: readyAtS } : row
  return { status: statusFor(ctx, codes.UNSTAKE_COOLING), body: canonical(body), headers: {} }
}

export type ClaimConfirm =
  | { readonly ok: false; readonly result: HttpResult }
  | {
      readonly ok: true
      readonly districtId: string
      readonly ticker: string
      readonly amount: bigint
      readonly hashes: readonly string[]
      readonly cooling: readonly CoolingRow[]
    }

/** Wallet claim of a mature unstake bucket. The deadline is the chain clock. */
export async function prepareClaimUnstake(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  intentId: string,
  expected: bigint,
  port: AssetPort,
): Promise<HttpResult> {
  const key = cityId + ":" + intentId
  const prior = await getBytes(store, "intents", key)
  if (prior !== undefined) return { status: statusForStored(ctx, prior), body: prior, headers: {} }
  if (asBigint(state["city_time"]) !== expected) return errResult(ctx, state, ctx.staleCode)
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_CLAIM)
  if (cityKind(state, cityId) !== "wallet") return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const account = asText(city["wallet"])
  if (account.length === 0) return errResult(ctx, state, codes.WALLET_NOT_CONNECTED)
  const districtId = resolveDistrictId(ctx, body)
  if (districtId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const registry = envAddr("CORPORATOR_STAKE_REGISTRY")
  if (registry.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const cool = await port.stakeRegistry.coolingSnapshot(account)
  if (!cool.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const now = await port.chain.latestBlockTime()
  if (!now.ok) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const bucket = coolingOf(cool.rows, spec.ticker)
  if (bucket === undefined || bucket.amount <= 0n) return errResult(ctx, state, codes.UNSTAKE_NOTHING_PENDING)
  if (now.amount < bucket.readyAtS) return coolingRefusal(ctx, state, bucket.readyAtS)
  const data = dataClaimUnstaked(spec.ticker)
  if (data.length === 0) return errResult(ctx, state, codes.SERVICE_DEGRADED)
  const result = okResult(ctx, state, {
    phase: "prepared",
    ticket: intentId,
    chain_id: stakeChainId(ctx),
    effect: "claim_unstaked",
    district_id: spec.id,
    ticker: spec.ticker,
    amount: bucket.amount,
    ready_at_s: bucket.readyAtS,
    txs: [{ to: registry, data, value: "0", label: "claim_unstaked" }],
  })
  const blocked = await commitPrepared(ctx, store, state, cityId, key, result.body)
  if (blocked !== undefined) return blocked
  return result
}

/** Chain check for a claim. A bucket that is still on the snapshot is retryable and is not stored. */
export async function verifyClaimConfirm(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
  cityId: string,
  port: AssetPort,
): Promise<ClaimConfirm> {
  const ticket = asText(body["ticket"])
  const hashes = readHashes(body["tx_hashes"])
  if (ticket.length === 0 || hashes === undefined) {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  for (const hash of hashes) {
    const taken = await takenChainTx(ctx, store, state, cityId, hash)
    if (taken !== undefined) return { ok: false, result: taken }
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
  const districtId = asText(parsed["district_id"])
  const ticker = asText(parsed["ticker"])
  let amount: bigint
  let readyAtS: bigint
  try {
    amount = asBigint(parsed["amount"])
    readyAtS = asBigint(parsed["ready_at_s"])
  } catch {
    return { ok: false, result: errResult(ctx, state, codes.API_MALFORMED) }
  }
  const txs = readTxs(parsed["txs"])
  if (districtId.length === 0 || ticker.length === 0 || amount <= 0n || txs === undefined || txs.length !== hashes.length) {
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
  const cool = await port.stakeRegistry.coolingSnapshot(wallet)
  if (!cool.ok) return { ok: false, result: errResult(ctx, state, codes.SERVICE_DEGRADED) }
  const bucket = coolingOf(cool.rows, ticker)
  if (bucket !== undefined && bucket.amount === amount && bucket.readyAtS === readyAtS) {
    return { ok: false, result: errResult(ctx, state, codes.CHAIN_TX_UNCONFIRMED, true) }
  }
  return { ok: true, districtId, ticker, amount, hashes, cooling: cool.rows }
}

export function claimConfirmResult(ctx: PackCtx, state: Dict, city: Dict, districtId: string, amount: bigint): HttpResult {
  const spec = districtSpec(ctx, districtId)
  if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  return okResult(ctx, state, {
    effect: "claim_unstaked",
    district_id: spec.id,
    ticker: spec.ticker,
    claimed: amount,
    phase: "applied",
  })
}

/** Mock claim. The live port uses prepare/confirm; the mock has no custody bucket. */
export function applyClaimUnstake(ctx: PackCtx, state: Dict, cityId: string): HttpResult {
  if (cityKind(state, cityId) === "demo") return errResult(ctx, state, codes.DEMO_NO_CLAIM)
  return errResult(ctx, state, codes.UNSTAKE_NOTHING_PENDING)
}
