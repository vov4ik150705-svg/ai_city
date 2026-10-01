import {
  cityBankShareBps,
  gdpDay,
  happinessOfCity,
  housingCapacityOf,
  personalCapWei,
  population,
  productivityBps,
  payrollBoostBps,
  payrollBoostDaysLeft,
  remainingGlobal,
  stabilityBps,
  stickyCityLevel,
  cityLevelFromPopulation,
  unstake,
  zipfPayout,
  type Dict,
} from "@corporator/engine"
import type { AssetPort } from "@corporator/chainport"
import { cityKind, envelopeOk } from "./envelope.js"
import { type PackCtx } from "./pack_ctx.js"
import { districtIds, districtByTicker, districtSpec, nextStakeNeed, settleStake, stakeHeld, stakeMin, tokensHeld } from "./commit_districts.js"
import { prizeCustodyLive } from "./custody.js"
import { withWorldLock } from "./city_lock.js"
import { type ProjectLive } from "./project_live.js"
import { persistLiveState, restoreMemory } from "./tick_host.js"
import type { Store } from "./store.js"
import { asBigint, asEngineDict, asObj, asText, LoadError, walk, type Json } from "./values.js"
import { projectRank, qualifiedPrizeSlots, walletOf } from "./project_rank.js"

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Remaining build ticks. `true` is still under construction; zero and missing are omitted. */
function constructionLeft(value: unknown): bigint | undefined {
  if (value === true) return 1n
  if (typeof value === "bigint") return value > 0n ? value : undefined
  if (typeof value === "string" && value.length > 0) {
    try {
      const n = BigInt(value)
      return n > 0n ? n : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

function flagOn(value: unknown): boolean {
  if (value === true) return true
  if (value === false || value === undefined || value === null) return false
  try {
    return asBigint(value) !== 0n
  } catch {
    return false
  }
}

function packBig(ctx: PackCtx, parts: readonly string[], fallback: bigint): bigint {
  try {
    return asBigint(walk(ctx.pack, parts), fallback)
  } catch (e) {
    if (e instanceof LoadError) return fallback
    throw e
  }
}

/** Zipf top-N prize table. Live ranking (`board`) stays uncapped in project_rank.ts. */
function projectPrizeBoard(ctx: PackCtx, state: Dict, viewerWallet: string): Json[] {
  const topN = packBig(ctx, ["sections", "seasons", "params", "prize_top_n", "v"], 10n)
  const bps = asBigint(ctx.cfg["bps"])
  const alpha = packBig(ctx, ["sections", "seasons", "params", "prize_curve_alpha_bps", "v"], bps)
  const pool = asBigint(state["treasury_leaderboard_eth"], 0n)
  const slots = qualifiedPrizeSlots(ctx, state)
  const count = BigInt(slots.length)
  const n = count === 0n ? 0n : count < topN ? count : topN
  const zipf = zipfPayout(pool, n, bps, alpha)
  const rows: Json[] = []
  let i = 0n
  while (i < n) {
    const idx = Number(i)
    const slot = slots[idx]
    if (slot === undefined) break
    const payout = zipf.payouts[idx]
    rows.push({
      rank: i + 1n,
      wallet: slot.wallet,
      influence: slot.influence,
      gdp: slot.gdp,
      positive_days: slot.positiveDays,
      qualified: 1n,
      self: viewerWallet.length > 0 && slot.wallet === viewerWallet ? 1n : 0n,
      payout: payout === undefined ? 0n : payout,
    })
    i += 1n
  }
  return rows
}

function districtTicker(ctx: PackCtx, id: string): string {
  try {
    const defs = asObj(walk(ctx.pack, ["sections", "districts", "districts"]))
    const spec = defs[id]
    if (spec === undefined || spec === null || typeof spec !== "object" || Array.isArray(spec)) return ""
    return asText(asObj(spec)["ticker"])
  } catch (e) {
    if (e instanceof LoadError) return ""
    throw e
  }
}

function agentIdleKey(row: Dict): string {
  const own = asText(row["idle"])
  if (own.length > 0) return own
  if (asText(row["building_id"]).length === 0 && asText(row["buildingId"]).length === 0) {
    return "IDLE_NO_AGENT"
  }
  return "UI_AVAILABLE"
}

function functionStatusKey(row: Dict, city: Dict): string {
  if (flagOn(row["construction"])) return "IDLE_UNDER_CONSTRUCTION"
  if (flagOn(row["frozen"])) return "UI_FROZEN"
  if (flagOn(row["deactivated"])) return "UI_DEACTIVATED"
  const staff = workerOn(city, functionId(row))
  if (staff.worker.length === 0) return "IDLE_NO_AGENT"
  for (const item of asList(city["agents"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const agent = asEngineDict(item)
    if (asText(agent["id"]) !== staff.worker) continue
    const idle = agentIdleKey(agent)
    return idle === "UI_AVAILABLE" ? "UI_AVAILABLE" : idle
  }
  return "IDLE_NO_AGENT"
}

function functionId(row: Dict): string {
  const id = asText(row["id"])
  if (id.length > 0) return id
  return asText(row["archetype"])
}

function dayPayouts(city: Dict): bigint[] {
  const raw = city["day_payouts"]
  if (Array.isArray(raw)) {
    const out: bigint[] = []
    for (const item of raw) out.push(asBigint(item, 0n))
    return out
  }
  if ("day_gdp" in city) return [asBigint(city["day_gdp"])]
  return []
}

function validTicksOf(city: Dict): bigint {
  if ("day_valid_ticks" in city) return asBigint(city["day_valid_ticks"])
  if ("valid_ticks" in city) return asBigint(city["valid_ticks"])
  return 0n
}

function workerOn(city: Dict, bid: string): { readonly worker: string; readonly task: string } {
  for (const item of asList(city["agents"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["building_id"]) !== bid && asText(row["buildingId"]) !== bid) continue
    return { worker: asText(row["id"]), task: asText(row["objective"]) }
  }
  return { worker: "", task: "" }
}

function projectFunctions(city: Dict): Json {
  const rows: Json[] = []
  for (const item of asList(city["functions"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    const id = functionId(row)
    if (id.length === 0) continue
    const staff = workerOn(city, id)
    const construction = constructionLeft(row["construction"])
    rows.push({
      id,
      nameKey: "UI_BLD_" + id.toUpperCase(),
      statusKey: functionStatusKey(row, city),
      ...(construction === undefined ? {} : { construction }),
      level: asBigint(row["level"], 1n),
      worker: staff.worker,
      task: staff.task,
    })
  }
  return rows
}

function projectAgents(city: Dict): Json {
  const rows: Json[] = []
  for (const item of asList(city["agents"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    const id = asText(row["id"])
    if (id.length === 0) continue
    const idleKey = agentIdleKey(row)
    const traits: string[] = []
    for (const trait of asList(row["traits"])) {
      if (typeof trait === "string" && trait.length > 0) traits.push(trait)
    }
    rows.push({
      id,
      idleKey,
      role: asText(row["role"]),
      buildingId: asText(row["building_id"]),
      objective: asText(row["objective"]),
      level: asBigint(row["level"], 1n),
      xp: asBigint(row["xp"]),
      traits,
    })
  }
  return rows
}

function projectProgress(
  ctx: PackCtx,
  city: Dict,
): { readonly population: bigint; readonly cityLevel: bigint; readonly productivity: bigint } {
  const cfg = ctx.cfg
  const bps = asBigint(cfg["bps"])
  const functions = asList(city["functions"])
  const thresholds = asEngineDict(cfg["population_thresholds"])
  const housing =
    "housing_capacity" in city
      ? asBigint(city["housing_capacity"])
      : Array.isArray(city["functions"])
        ? housingCapacityOf(functions, thresholds, asBigint(city["housing_capacity_add"]))
        : 0n
  const jobs = asBigint(city["occupied_jobs"])
  const pop = population(jobs, asBigint(cfg["population_per_job"]), housing)
  const derived = cityLevelFromPopulation(pop, thresholds, asBigint(cfg["city_level_max"], 1n))
  const level = stickyCityLevel(asBigint(city["city_level"], 1n), derived)
  const realized = asBigint(city["payout"])
  const nominal = asBigint(city["request"])
  return {
    population: pop,
    cityLevel: level,
    productivity: productivityBps(realized, nominal, bps),
  }
}

function projectHappiness(ctx: PackCtx, state: Dict, city: Dict): bigint {
  const view: Dict = { ...city }
  return happinessOfCity(ctx.cfg, state, view)
}

function projectStability(ctx: PackCtx, city: Dict): bigint {
  return stabilityBps(validTicksOf(city), asBigint(ctx.cfg["ticks_day"]), asBigint(ctx.cfg["bps"]))
}

function tierOf(city: Dict, id: string): bigint {
  return asBigint(asEngineDict(city["district_tiers"])[id], 0n)
}

function freezeUntil(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["district_freeze_until"])[ticker], 0n)
}

function graceOf(city: Dict, ticker: string, cityTime: bigint): boolean {
  return freezeUntil(city, ticker) > cityTime
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

function cityMergeIds(city: Dict): readonly string[] {
  const out: string[] = []
  for (const item of asList(city["merges"])) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function nodeSideOpen(ctx: PackCtx, city: Dict, districtId: string): boolean {
  const taken = cityNodeIds(city)
  try {
    const bag = asObj(walk(ctx.pack, ["generated", "progression", "progression_nodes"]))
    for (const id of Object.keys(bag)) {
      const raw = bag[id]
      if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
      const row = asObj(raw)
      if (asText(row["district"]) !== districtId) continue
      if (row["playable_v1"] !== true) continue
      const exclusive = asText(row["exclusive_with"])
      if (exclusive.length > 0 && taken.includes(exclusive)) continue
      return true
    }
  } catch (e) {
    if (e instanceof LoadError) return true
    throw e
  }
  return true
}

function mergeFree(ctx: PackCtx, city: Dict, districtId: string): boolean {
  const used = cityMergeIds(city)
  for (const mid of used) {
    try {
      const raw = walk(ctx.pack, ["generated", "progression", "progression_merges", mid])
      if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
      const districts = asObj(raw)["districts"]
      if (!Array.isArray(districts)) continue
      if (districts.includes(districtId)) return false
    } catch (e) {
      if (e instanceof LoadError) continue
      throw e
    }
  }
  try {
    const cap = asBigint(walk(ctx.pack, ["generated", "progression", "merge_active_cap"]), 0n)
    if (cap > 0n && BigInt(used.length) >= cap) return false
  } catch (e) {
    if (e instanceof LoadError) return true
    throw e
  }
  return true
}

function projectEfficiency(ctx: PackCtx, city: Dict, cityTime: bigint): Json {
  const rows: Json[] = []
  const slots = asEngineDict(city["district_efficiency"])
  const seen = new Set<string>()
  const opened: string[] = []
  for (const item of asList(city["districts"])) {
    if (typeof item === "string" && item.length > 0) opened.push(item)
  }
  for (const id of Object.keys(slots)) opened.push(id)
  for (const id of opened) {
    if (seen.has(id)) continue
    seen.add(id)
    const slot = asEngineDict(slots[id])
    const ticker = districtTicker(ctx, id)
    const bps =
      "efficiency_bps" in slot || "ema_24h" in slot
        ? asBigint(slot["efficiency_bps"], asBigint(ctx.cfg["bps"]))
        : asBigint(ctx.cfg["bps"])
    const stake = stakeHeld(city, ticker)
    let min = 0n
    let need = 0n
    try {
      if (ticker.length > 0) {
        min = stakeMin(ctx, ticker)
        need = nextStakeNeed(ctx, ticker, stake)
      }
    } catch (e) {
      if (!(e instanceof LoadError)) throw e
    }
    const delta = need > stake ? need - stake : 0n
    const held = ticker.length === 0 ? 0n : tokensHeld(city, ticker)
    const tier = tierOf(city, id)
    rows.push({
      id,
      ticker,
      bps,
      stake,
      stake_min: min,
      tier,
      frozen: freezeUntil(city, ticker) > 0n && freezeUntil(city, ticker) <= cityTime ? 1n : 0n,
      grace: graceOf(city, ticker, cityTime) ? 1n : 0n,
      stake_ok: min <= 0n || stake >= min ? 1n : 0n,
      stake_mult_ok: delta > 0n && held >= delta ? 1n : 0n,
      tier_unlocked: tier > 0n ? 1n : 0n,
      node_open: nodeSideOpen(ctx, city, id) ? 1n : 0n,
      merge_free: mergeFree(ctx, city, id) ? 1n : 0n,
    })
  }
  return { rows }
}

/** Live quote uses the wallet balance. A missing key is unknown, not the city ledger and not zero. */
export function quoteStockAmount(
  ledger: bigint,
  walletStocks: { readonly [ticker: string]: bigint } | undefined,
  ticker: string,
): bigint | undefined {
  if (walletStocks === undefined) return ledger
  return walletStocks[ticker]
}

function projectStocks(
  city: Dict,
  efficiency: Json,
  live: boolean,
  ageMs: bigint | undefined,
  quote: { readonly corpEth: bigint; readonly ethUsd: bigint } | undefined,
  walletStocks: { readonly [ticker: string]: bigint } | undefined,
): Json {
  const rows: Json[] = []
  if (efficiency !== null && typeof efficiency === "object" && !Array.isArray(efficiency)) {
    const list = efficiency["rows"]
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item === null || typeof item !== "object" || Array.isArray(item)) continue
        const row = asObj(item)
        const ticker = asText(row["ticker"])
        if (ticker.length === 0) continue
        const held = quoteStockAmount(tokensHeld(city, ticker), walletStocks, ticker)
        const quoteRow: { [key: string]: Json } = {
          ticker,
          price: "",
          day_pct: "",
          effect: asBigint(row["bps"]).toString(),
        }
        if (held !== undefined) quoteRow["stocks"] = held
        rows.push(quoteRow)
      }
    }
  }
  const out: { [key: string]: Json } = { live, rows }
  if (live && ageMs !== undefined) out["age_ms"] = ageMs
  if (live && quote !== undefined) {
    out["corp_eth"] = quote.corpEth
    out["eth_usd"] = quote.ethUsd
  }
  return out
}

function packChainId(ctx: PackCtx): bigint {
  try {
    return asBigint(walk(ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"]))
  } catch (e) {
    if (e instanceof LoadError) return 0n
    throw e
  }
}

function bankLimitOf(ctx: PackCtx, state: Dict, city: Dict): bigint {
  const depth = asBigint(state["pool_eth"], 0n)
  const poolShare = asBigint(ctx.cfg["bank_pool_share_bps"], 0n)
  const bps = asBigint(ctx.cfg["bps"])
  const share = cityBankShareBps(ctx.cfg, city)
  const personal = personalCapWei(depth, poolShare, share, bps)
  let roomP = personal - asBigint(city["withdrawn_day"], 0n) - asBigint(city["reserved_day"], 0n)
  if (roomP < 0n) roomP = 0n
  const roomG = remainingGlobal(state, depth, poolShare, bps)
  return roomP < roomG ? roomP : roomG
}

function quoteAgeMs(cityTime: bigint, sampleCityTime: bigint): bigint | undefined {
  if (sampleCityTime <= 0n) return 1n
  const delta = cityTime >= sampleCityTime ? cityTime - sampleCityTime : 0n
  return delta > 0n ? delta : 1n
}

function projectLedger(city: Dict): Json {
  const rows: Json[] = []
  const ledger = asEngineDict(city["fragment_ledger"])
  const keys = Object.keys(ledger).sort()
  for (const ticker of keys) {
    rows.push({ ticker, amount: asBigint(ledger[ticker]) })
  }
  if (rows.length > 0) return { rows }
  if ("fragments" in city) return { total: asBigint(city["fragments"]) }
  return {}
}

function projectVouchers(ctx: PackCtx, city: Dict): Json[] {
  let ttl = 0n
  try {
    ttl = asBigint(walk(ctx.pack, ["generated", "api", "voucher_ttl_s"]))
  } catch {
    ttl = 0n
  }
  const raw = city["vouchers"]
  if (!Array.isArray(raw)) return []
  const open: Json[] = []
  let last: Json | undefined
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asObj(item)
    const status = asText(row["status"])
    const issued = asBigint(row["issued_at_s"], 0n)
    const view: Json = {
      id: asText(row["id"]),
      status,
      corp: asBigint(row["corp"], 0n),
      expires_at_s: issued + ttl,
      nonce: asText(row["nonce"]),
      capital: asBigint(row["capital"], 0n),
    }
    if (status === "signing" || status === "open") open.push(view)
    else if (status === "presented" || status === "expired" || status === "rejected") last = view
  }
  if (last !== undefined) open.push(last)
  return open
}

function projectCooldown(city: Dict): Json {
  const raw = asEngineDict(city["unstake_cooldown"])
  const out: { [key: string]: Json } = {}
  for (const ticker of Object.keys(raw)) {
    const row = asEngineDict(raw[ticker])
    const amount = asBigint(row["amount"], 0n)
    if (amount <= 0n) continue
    out[ticker] = { amount, ready_at_s: asBigint(row["ready_at_s"], 0n) }
  }
  return out
}

function projectStake(city: Dict): Json | undefined {
  const chain = asEngineDict(city["stake_chain"])
  const keys = Object.keys(chain)
  if (keys.length === 0) return undefined
  let sum = 0n
  for (const ticker of keys) sum += asBigint(chain[ticker], 0n)
  return sum
}

export function projectState(
  ctx: PackCtx,
  state: Dict,
  cityId: string,
  attestLog: readonly {
    readonly id: string
    readonly key: string
    readonly badge: string
    readonly root: string
    readonly cid: string
  }[],
  live?: ProjectLive,
): Json {
  const sections: { [key: string]: Json } = {}
  for (const id of ctx.stateSources) {
    sections[id] = {}
  }
  const cities = asEngineDict(state["cities"])
  const city = asEngineDict(cities[cityId])
  if (cityId in cities) {
    sections["tick.capital"] = asBigint(city["capital"])
    sections["tick.energy"] = "energy_stock" in city ? asBigint(city["energy_stock"]) : asBigint(city["energy"])
    sections["tick.compute"] = "compute_stock" in city ? asBigint(city["compute_stock"]) : asBigint(city["compute"])
    const payrollPaid = asBigint(city["payout"], 0n)
    const payrollRequested = asBigint(city["request"], 0n)
    sections["aggregate.payroll_ratio"] = asBigint(state["payroll_ratio_bps"], 0n)
    sections["aggregate.payroll_boost_bps"] = payrollBoostBps(ctx.cfg, state)
    sections["aggregate.payroll_boost_days_left"] = payrollBoostDaysLeft(ctx.cfg, state)
    sections["wallet.protocol_eth_in_flight"] = asBigint(city["protocol_eth_in_flight"])
    sections["wallet.protocol_vault_corp"] = asBigint(city["protocol_vault_corp"])
    sections["wallet.protocol_studio_eth"] = asBigint(city["protocol_studio_eth"])
    const basket: { [ticker: string]: Json } = {
      notice: asText(city["prize_notice"]),
      eth_pots: {
        leaderboard: asBigint(state["treasury_leaderboard_eth"]),
        farm: asBigint(state["treasury_farm_eth"]),
        studio: asBigint(state["treasury_studio_eth"]),
      },
    }
    try {
      const raw = walk(ctx.pack, ["generated", "seasons", "prize_assets"])
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item !== "string") continue
          const pots = asEngineDict(asEngineDict(city["prize_kettles"])[item])
          basket[item] = {
            farm: asBigint(pots["farm"]),
            month: asBigint(pots["month"]),
          }
        }
      }
    } catch {
      // pack path missing: leave notice-only basket
    }
    sections["seasons.prize_basket"] = basket
    const progress = projectProgress(ctx, city)
    sections["aggregate.gdp"] = gdpDay(dayPayouts(city))
    sections["aggregate.happiness"] = projectHappiness(ctx, state, city)
    sections["aggregate.stability"] = projectStability(ctx, city)
    sections["tick.building_level"] = {
      rows: projectFunctions(city),
      population: progress.population,
      city_level: progress.cityLevel,
      productivity: progress.productivity,
      city_label: cityId,
      bank_limit_live: bankLimitOf(ctx, state, city),
      opened_districts: districtIds(city),
      corp_held: asBigint(city["corp_held"], 0n),
      energy_demand: asBigint(city["energy_draw"], 0n),
      compute_demand: asBigint(city["compute_draw"], 0n),
      payroll_paid: payrollPaid,
      payroll_requested: payrollRequested,
      unstake_cooldown: projectCooldown(city),
      vouchers: projectVouchers(ctx, city),
      mint_rate: asBigint(state["mint_rate"], 0n),
      ...(live !== undefined && live.chainTimeS !== undefined ? { chain_time_s: live.chainTimeS } : {}),
    }
    sections["tick.agent_state"] = { rows: projectAgents(city) }
    const efficiency = projectEfficiency(ctx, city, asBigint(state["city_time"], 0n))
    sections["oracle.district_efficiency"] = efficiency
    const hopReady = live !== undefined && live.hopFill !== undefined
    const age = hopReady ? quoteAgeMs(asBigint(state["city_time"]), live === undefined ? 0n : live.sampleCityTime) : undefined
    const quote =
      hopReady && live !== undefined ? { corpEth: live.corpEth, ethUsd: live.ethUsd } : undefined
    sections["oracle.stock_price"] = projectStocks(
      city,
      efficiency,
      hopReady,
      age,
      quote,
      live === undefined ? undefined : live.walletStocks,
    )
    sections["seasons.influence_rank"] = {
      ...asObj(projectRank(ctx, state, cityId, city)),
      prize_board: projectPrizeBoard(ctx, state, walletOf(city, cityId)),
    }
    const ledger = projectLedger(city)
    if (Object.keys(asEngineDict(ledger)).length > 0) sections["fragments.city_ledger"] = ledger
    const stake = projectStake(city)
    if (stake !== undefined) sections["wallet.stake_tokens"] = stake
    if (live !== undefined && live.walletChain.length > 0) {
      const expected = packChainId(ctx)
      sections["wallet.chain"] = {
        id: live.walletChain,
        match: expected === 0n || live.walletChain === expected.toString() ? 1n : 0n,
      }
    } else {
      sections["wallet.chain"] = {}
    }
    if (live !== undefined && live.walletStocks !== undefined && live.walletCorp === undefined) {
      sections["wallet.corp_known"] = 0n
      sections["wallet.corp_balance"] = {}
    } else if (live !== undefined && live.walletCorp !== undefined) {
      sections["wallet.corp_balance"] = live.walletCorp
      if (live.walletStocks !== undefined) sections["wallet.corp_known"] = 1n
    } else {
      sections["wallet.corp_balance"] = {}
    }
  }
  const rows: Json[] = []
  let logError = 0n
  for (const row of attestLog) {
    rows.push({ id: row.id, key: row.key, badge: row.badge, root: row.root, cid: row.cid })
    if (row.badge === "degraded") logError = 1n
  }
  sections["log.events"] = { rows, loading: 0n, error: logError, unread: BigInt(rows.length) }
  return envelopeOk(ctx, state, {
    city_id: cityId,
    account_kind: cityKind(state, cityId),
    sections,
  })
}

function copyHeld(city: Dict): Dict {
  const held = asEngineDict(city["tokens_held"])
  const out: Dict = {}
  for (const key of Object.keys(held)) {
    const value = held[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

function pushCityCode(city: Dict, code: string): void {
  const list = asList(city["codes"])
  list.push(code)
  city["codes"] = list
}

function coolingMap(
  ctx: PackCtx,
  rows: readonly { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }[],
): Dict {
  const next: Dict = {}
  for (const row of rows) {
    if (row.ticker.length === 0 || row.amount <= 0n) continue
    if (districtByTicker(ctx, row.ticker).length === 0) continue
    next[row.ticker] = { amount: row.amount, ready_at_s: row.readyAtS }
  }
  return next
}

function sameCooling(prior: Dict, next: Dict): boolean {
  const left = Object.keys(prior).sort()
  const right = Object.keys(next).sort()
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
    const key = left[i]
    if (key === undefined) return false
    const a = asEngineDict(prior[key])
    const b = asEngineDict(next[key])
    if (asBigint(a["amount"], 0n) !== asBigint(b["amount"], 0n)) return false
    if (asBigint(a["ready_at_s"], 0n) !== asBigint(b["ready_at_s"], 0n)) return false
  }
  return true
}

export function applyCoolingRows(
  ctx: PackCtx,
  city: Dict,
  rows: readonly { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }[],
): boolean {
  const prior = asEngineDict(city["unstake_cooldown"])
  const next = coolingMap(ctx, rows)
  if (sameCooling(prior, next)) return false
  city["unstake_cooldown"] = next
  return true
}

export function noteUnstakeClaimed(city: Dict, ticker: string, amount: bigint): void {
  if (amount <= 0n || ticker.length === 0) return
  const list = asList(city["unstake_journal"])
  list.push({ code: "unstake_claimed", ticker, amount })
  city["unstake_journal"] = list
}

export function applyClaimReceipt(
  ctx: PackCtx,
  city: Dict,
  cooling: readonly { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }[],
  ticker: string,
  claimed: bigint,
): void {
  applyCoolingRows(ctx, city, cooling)
  noteUnstakeClaimed(city, ticker, claimed)
}

export function applyUnstakeReceipt(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  rows: readonly { readonly ticker: string; readonly amount: bigint }[],
  cooling: readonly { readonly ticker: string; readonly amount: bigint; readonly readyAtS: bigint }[],
  ticker: string,
  priorCooling: bigint,
  request: bigint,
): void {
  applyChainRows(ctx, state, city, rows, true)
  applyCoolingRows(ctx, city, cooling)
  let network = 0n
  let seen = false
  for (const row of cooling) {
    if (row.ticker !== ticker) continue
    network = row.amount
    seen = true
  }
  const sum = priorCooling + request
  if (seen && network < sum) noteUnstakeClaimed(city, ticker, sum - network)
}

function alignStake(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  ticker: string,
  target: bigint,
  spec: { readonly id: string; readonly ticker: string; readonly playable: boolean },
  live: boolean,
): boolean {
  const chain = asEngineDict(city["stake_chain"])
  const prev = asBigint(chain[ticker], 0n)
  const settled = stakeHeld(city, ticker)
  if (target === prev && settled === target) return false
  const chainDelta = prev > target ? prev - target : 0n
  if (target > settled) {
    const bag = asEngineDict(city["stake_settled"])
    bag[ticker] = settled + (target - settled)
    city["stake_settled"] = bag
    settleStake(ctx, city, spec)
  } else if (target < settled) {
    const before = copyHeld(city)
    let min = 0n
    try {
      min = stakeMin(ctx, ticker)
    } catch (e) {
      if (e instanceof LoadError) return false
      throw e
    }
    const moved = unstake(
      city,
      ticker,
      settled - target,
      asBigint(state["city_time"]),
      asBigint(ctx.cfg["unstake_grace_city_hours"]),
      min,
    )
    if (asBigint(moved["ok"]) !== 1n) return false
    if (live) city["tokens_held"] = before
    else {
      const held = asEngineDict(city["tokens_held"])
      const cut = settled - target
      const debit = chainDelta > cut ? chainDelta : cut
      const next = asBigint(held[ticker], 0n) - debit
      held[ticker] = next > 0n ? next : 0n
      city["tokens_held"] = held
    }
  }
  if (chainDelta > settled) pushCityCode(city, "STAKE_BELOW_THRESHOLD")
  chain[ticker] = target
  city["stake_chain"] = chain
  return true
}

export function applyChainRows(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  rows: readonly { readonly ticker: string; readonly amount: bigint }[],
  live: boolean,
): boolean {
  const chain = asEngineDict(city["stake_chain"])
  city["stake_chain"] = chain
  const seen = new Set<string>()
  let changed = false
  for (const row of rows) {
    if (row.ticker.length === 0) continue
    const id = districtByTicker(ctx, row.ticker)
    if (id.length === 0) continue
    const spec = districtSpec(ctx, id)
    if (spec === undefined) continue
    seen.add(row.ticker)
    const target = row.amount < 0n ? 0n : row.amount
    if (alignStake(ctx, state, city, row.ticker, target, spec, live)) changed = true
  }
  for (const ticker of Object.keys(chain)) {
    if (seen.has(ticker)) continue
    const prev = asBigint(chain[ticker], 0n)
    if (prev <= 0n) continue
    const id = districtByTicker(ctx, ticker)
    if (id.length === 0) continue
    const spec = districtSpec(ctx, id)
    if (spec === undefined) continue
    if (alignStake(ctx, state, city, ticker, 0n, spec, live)) changed = true
  }
  return changed
}

/** Chain stake snapshot on a state read. Not part of the tick. */
export async function syncStakeSnapshot(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
  port: AssetPort,
): Promise<void> {
  if (!prizeCustodyLive(port)) return
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return
  const city = asEngineDict(cities[cityId])
  const account = asText(city["wallet"])
  if (account.length === 0) return
  const snap = await port.stakeRegistry.snapshot(account)
  if (!snap.ok) return
  const cool = await port.stakeRegistry.coolingSnapshot(account)
  await withWorldLock(async () => {
    const before = structuredClone(state)
    let changed = applyChainRows(ctx, state, city, snap.rows, true)
    if (cool.ok && applyCoolingRows(ctx, city, cool.rows)) changed = true
    if (!changed) return
    let opened = false
    try {
      await store.exec("BEGIN")
      opened = true
      await persistLiveState(store, state, cityId)
      await store.exec("COMMIT")
    } catch (err) {
      if (opened) {
        try {
          await store.exec("ROLLBACK")
        } catch {
          // The caller's error is the one to surface.
        }
      }
      restoreMemory(state, before)
      throw err
    }
  })
}
