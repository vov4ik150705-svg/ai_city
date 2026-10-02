import { fetchPoster } from "@corporator/chainport"
import { fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { emptyBasketState, planFarmHops, stepLeaderboardBasket, type BasketHop } from "./basket.js"
import { emptyBuybackState, stepBuyback } from "./step.js"
import { executorHopFill, posterFromEnv, type ExecutorHop } from "./hop.js"
import type { BuybackPack } from "./pack.js"
import { buybackBelowMin } from "./policy.js"
import { createMockConveyorSource, type ConveyorPull, type ConveyorSource } from "./source.js"
import type { ConveyorBatch, ConveyorSlice, ConveyorState } from "./conveyor.js"
import { asBig, asObj, asText } from "./values.js"
import { receiptOrSend } from "./swap.js"
import { sendStudioEth } from "./studio.js"
import { liveRpcReady } from "./worker.js"

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export type CollectorHop = (ticker: string, wei: bigint) => Promise<ExecutorHop>

export type CollectorDeps = {
  readonly hop: CollectorHop
  readonly sendEth?: (to: string, wei: bigint) => Promise<boolean>
}

const DEGRADED: ConveyorPull = { ok: false, code: codes.SERVICE_DEGRADED }
const BLOCKED = ["hop_ok", "caller_service", "farm_fills", "month_fills"] as const

type Frame = {
  readonly cityTime: bigint
  readonly turnover: bigint
  readonly fundWei: bigint
  readonly leaderboardWei: bigint
  readonly farmWei: bigint
  readonly depths: { readonly [key: string]: bigint }
  readonly demand: { readonly [key: string]: bigint }
  readonly studioWei: bigint
}

function present(value: Json | undefined): boolean {
  return value !== undefined && value !== null
}

function blocked(row: { readonly [key: string]: Json }): boolean {
  for (const key of BLOCKED) {
    if (present(row[key])) return true
  }
  return false
}

function mustBig(value: Json | undefined): bigint | undefined {
  if (!present(value)) return undefined
  const n = asBig(value)
  if (n < 0n) return undefined
  return n
}

function mustMap(value: Json | undefined): { readonly [key: string]: bigint } | undefined {
  if (!present(value) || typeof value !== "object" || Array.isArray(value)) return undefined
  const out: { [key: string]: bigint } = {}
  const row = value as { readonly [key: string]: Json }
  for (const key of Object.keys(row)) {
    const n = asBig(row[key])
    if (n < 0n) return undefined
    out[key] = n
  }
  return out
}

function readFrame(row: { readonly [key: string]: Json }): Frame | undefined {
  const cityTime = mustBig(row["city_time"])
  const turnover = mustBig(row["turnover_wei"])
  const fundWei = mustBig(row["fund_wei"])
  const leaderboardWei = mustBig(row["leaderboard_wei"])
  const farmWei = mustBig(row["farm_wei"])
  const depths = mustMap(row["depths_wei"])
  const demand = mustMap(row["fragment_demand"])
  const studioRaw = row["studio_wei"]
  const studioWei = !present(studioRaw) ? 0n : mustBig(studioRaw)
  if (
    cityTime === undefined ||
    turnover === undefined ||
    fundWei === undefined ||
    leaderboardWei === undefined ||
    farmWei === undefined ||
    depths === undefined ||
    demand === undefined ||
    studioWei === undefined
  ) {
    return undefined
  }
  return { cityTime, turnover, fundWei, leaderboardWei, farmWei, depths, demand, studioWei }
}

function slicesOf(value: Json): readonly ConveyorSlice[] {
  if (!Array.isArray(value)) throw new Error(codes.API_MALFORMED)
  const out: ConveyorSlice[] = []
  for (const raw of value) {
    const row = asObj(raw)
    const players = row["players"]
    const amounts = row["amounts"]
    if (!Array.isArray(players) || !Array.isArray(amounts) || players.length !== amounts.length) {
      throw new Error(codes.API_MALFORMED)
    }
    const playerList: string[] = []
    const amountList: bigint[] = []
    for (const player of players) playerList.push(asText(player))
    for (const amount of amounts) {
      const n = asBig(amount)
      if (n < 0n) throw new Error(codes.API_MALFORMED)
      amountList.push(n)
    }
    out.push({
      batchId: asText(row["batch_id"]),
      kettle: asBig(row["kettle"]),
      token: asText(row["token"]),
      players: playerList,
      amounts: amountList,
      callerService: asText(row["caller_service"]),
    })
  }
  return out
}

function demandSum(pack: BuybackPack, demand: { readonly [key: string]: bigint }): bigint {
  let sum = 0n
  for (const ticker of pack.tickers) {
    const weight = demand[ticker] ?? 0n
    if (weight > 0n) sum += weight
  }
  return sum
}

function zeros(pack: BuybackPack): { [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const ticker of pack.tickers) out[ticker] = 0n
  return out
}

function anySend(hops: readonly BasketHop[]): boolean {
  for (const hop of hops) {
    if (hop.sendWei > 0n) return true
  }
  return false
}

function anyFill(fills: { readonly [ticker: string]: bigint }): boolean {
  for (const ticker of Object.keys(fills)) {
    const amount = fills[ticker]
    if (amount !== undefined && amount > 0n) return true
  }
  return false
}

function tokenMap(value: Json | undefined): { readonly [key: string]: string } | undefined {
  if (!present(value) || typeof value !== "object" || Array.isArray(value)) return undefined
  const out: { [key: string]: string } = {}
  const row = value as { readonly [key: string]: Json }
  for (const key of Object.keys(row)) {
    let text = ""
    try {
      text = asText(row[key])
    } catch {
      return undefined
    }
    if (text.length === 0) return undefined
    out[key] = text
  }
  if (Object.keys(out).length === 0) return undefined
  return out
}

function applyTokens(
  slices: readonly ConveyorSlice[] | undefined,
  tokens: { readonly [key: string]: string } | undefined,
): readonly ConveyorSlice[] | undefined {
  if (slices === undefined || tokens === undefined) return slices
  const out: ConveyorSlice[] = []
  for (const row of slices) {
    const token = tokens[row.token]
    out.push(token === undefined ? row : { ...row, token })
  }
  return out
}

function idle(
  pack: BuybackPack,
  frame: Frame,
  slices: readonly ConveyorSlice[] | undefined,
  tokens: { readonly [key: string]: string } | undefined,
): ConveyorBatch {
  return {
    cityTime: frame.cityTime,
    fundWei: frame.fundWei,
    leaderboardWei: frame.leaderboardWei,
    farmWei: frame.farmWei,
    depthsWei: frame.depths,
    fragmentDemand: frame.demand,
    hopOk: 0n,
    callerService: pack.executorService,
    studioWei: frame.studioWei,
    ...(tokens === undefined ? {} : { tokenByTicker: tokens }),
    ...(slices === undefined ? {} : { slices }),
  }
}

async function take(
  deps: CollectorDeps,
  hops: readonly BasketHop[],
  into: { [ticker: string]: bigint },
): Promise<boolean> {
  for (const hop of hops) {
    if (hop.sendWei <= 0n) continue
    let got: ExecutorHop
    try {
      got = await deps.hop(hop.ticker, hop.sendWei)
    } catch {
      return false
    }
    if (got.hopOk === 0n || got.stockOut <= 0n) return false
    into[hop.ticker] = got.stockOut
  }
  return true
}

async function collect(
  pack: BuybackPack,
  deps: CollectorDeps,
  body: Uint8Array,
  state: ConveyorState | undefined,
): Promise<ConveyorPull> {
  const row = asObj(parseJson(fromUtf8(body)))
  if (blocked(row)) return DEGRADED
  const frame = readFrame(row)
  if (frame === undefined) return DEGRADED
  const tokens = tokenMap(row["token_by_ticker"])
  const rawSlices = row["slices"]
  const slices = applyTokens(rawSlices === undefined ? undefined : slicesOf(rawSlices), tokens)
  if (buybackBelowMin(frame.turnover, pack.minBatchWei) || demandSum(pack, frame.demand) <= 0n) {
    return { ok: true, batch: idle(pack, frame, slices, tokens) }
  }
  const farm = planFarmHops(
    pack,
    state === undefined ? zeros(pack) : state.farmCarry,
    frame.farmWei + (state === undefined ? 0n : state.farmRemainderWei),
    frame.demand,
    frame.depths,
    1n,
  )
  const month = stepLeaderboardBasket(
    pack,
    state === undefined ? emptyBasketState(pack.tickers) : state.month,
    frame.leaderboardWei,
    frame.depths,
    1n,
  )
  if (!anySend(farm.hops) && !anySend(month.hops)) {
    return { ok: true, batch: await withFund(pack, deps, frame, state, idle(pack, frame, slices, tokens)) }
  }
  const farmFills = zeros(pack)
  const monthFills = zeros(pack)
  const farmDone = await take(deps, farm.hops, farmFills)
  if (farmDone) await take(deps, month.hops, monthFills)
  if (!anyFill(farmFills) && !anyFill(monthFills)) return DEGRADED
  return {
    ok: true,
    batch: await withFund(pack, deps, frame, state, {
      ...idle(pack, frame, slices, tokens),
      hopOk: 1n,
      farmFills,
      monthFills,
    }),
  }
}

async function withFund(
  pack: BuybackPack,
  deps: CollectorDeps,
  frame: Frame,
  state: ConveyorState | undefined,
  batch: ConveyorBatch,
): Promise<ConveyorBatch> {
  let studioWei = frame.studioWei
  if (pack.studioRecipient.length > 0 && studioWei > 0n && deps.sendEth !== undefined) {
    const sent = await deps.sendEth(pack.studioRecipient, studioWei)
    if (sent) studioWei = 0n
  }
  const preview = stepBuyback(
    pack,
    state === undefined ? emptyBuybackState() : state.buyback,
    frame.cityTime,
    frame.fundWei,
    0n,
  )
  let fundCorpOut = 0n
  if (preview.sendWei > 0n) {
    try {
      const got = await deps.hop("CORP", preview.sendWei)
      if (got.hopOk === 1n && got.stockOut > 0n) fundCorpOut = got.stockOut
    } catch {
      fundCorpOut = 0n
    }
  }
  return {
    ...batch,
    studioWei,
    ...(fundCorpOut > 0n ? { fundCorpOut } : {}),
  }
}

export function createCollectorSource(pack: BuybackPack, deps: CollectorDeps): ConveyorSource {
  return {
    async pull(body?: Uint8Array, state?: ConveyorState): Promise<ConveyorPull> {
      if (body === undefined || body.length === 0) return DEGRADED
      try {
        return await collect(pack, deps, body, state)
      } catch {
        return DEGRADED
      }
    },
  }
}

export function selectConveyorSource(
  env: { readonly [key: string]: string | undefined },
  pack: BuybackPack,
  deps: CollectorDeps,
): ConveyorSource {
  const hopUrl = env["CORPORATOR_HOP_URL"]
  if (!liveRpcReady(env) || hopUrl === undefined || hopUrl.length === 0) return createMockConveyorSource()
  return createCollectorSource(pack, deps)
}

function stockToken(env: { readonly [key: string]: string | undefined }, ticker: string): string {
  const raw = env["CORPORATOR_STOCK_" + ticker]
  if (raw === undefined || !ADDR_RE.test(raw)) return ""
  return raw
}

export function hopToken(env: { readonly [key: string]: string | undefined }, ticker: string): string {
  if (ticker === "CORP") {
    const corp = env["CORPORATOR_CORP_TOKEN"]
    if (corp !== undefined && ADDR_RE.test(corp)) return corp
    return ""
  }
  return stockToken(env, ticker)
}

function envBig(raw: string | undefined): bigint {
  if (raw === undefined || raw.length === 0) return 0n
  try {
    return BigInt(raw)
  } catch {
    return 0n
  }
}

export function collectorDepsFromEnv(
  env: { readonly [key: string]: string | undefined },
  pack: BuybackPack,
): CollectorDeps {
  const poster = posterFromEnv(env, async (url, init) => {
    const res = await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
    })
    return { ok: res.ok, json: () => res.json() as Promise<unknown> }
  })
  const executor = env["CORPORATOR_BUYBACK_EXECUTOR"] ?? ""
  const key = env["CORPORATOR_BUYBACK_EXECUTOR_KEY"] ?? ""
  const chainId = envBig(env["CORPORATOR_CHAIN_ID"])
  const timeout = envBig(env["CORPORATOR_RPC_TIMEOUT_MS"])
  const url = env["CORPORATOR_RPC_URL"]
  const post = url !== undefined && url.length > 0 && timeout > 0n ? fetchPoster(url, timeout) : undefined
  return {
    ...(post === undefined || chainId <= 0n
      ? {}
      : {
          sendEth: (to: string, wei: bigint) =>
            sendStudioEth({
              post,
              chainId,
              bps: pack.bps,
              gasHeadroomBps: pack.gasHeadroomBps,
              to,
              wei,
            }),
        }),
    hop: (ticker, wei) => {
      const broadcast =
        post === undefined || chainId <= 0n
          ? undefined
          : async (tx: { readonly to: string; readonly data: string; readonly value: string }) => {
              let value = 0n
              try {
                value = BigInt(tx.value)
              } catch {
                return []
              }
              return receiptOrSend({
                post,
                chainId,
                bps: pack.bps,
                gasHeadroomBps: pack.gasHeadroomBps,
                privateKey: key,
                executor,
                token: hopToken(env, ticker),
                to: tx.to,
                data: tx.data,
                value,
              })
            }
      return executorHopFill({
        poster,
        ticker,
        amount: wei,
        hopQuality: 0n,
        executor,
        executorKey: key,
        token: hopToken(env, ticker),
        logs: [],
        sign: (signingKey, tx) =>
          signingKey.length > 0 && tx.to.length > 0 && tx.data.length > 0 && tx.value.length > 0,
        ...(broadcast === undefined ? {} : { broadcast }),
      })
    },
  }
}
