import { atPath, canonical, fromUtf8, loadPack, parseJson, type Json } from "@corporator/contentpack"
import {
  createLiveTransport,
  createMockPort,
  createRpcPort,
  type AssetPort,
  type LiveRpcConfig,
  type PortConfig,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import {
  emptyConveyorState,
  runStockConveyor,
  type ConveyorBatch,
  type ConveyorReturn,
  type ConveyorSlice,
  type ConveyorState,
} from "./conveyor.js"
import type { BuybackPack } from "./pack.js"
import { createMockConveyorSource, type ConveyorSource } from "./source.js"
import { asBig, asObj, asText } from "./values.js"

export type ConveyorHandler = (body: Uint8Array) => Promise<Uint8Array>

function portCfg(pack: Json): PortConfig {
  const keys = asObj(atPath(pack, ["sections", "arch", "keys"]))
  const voucher = asObj(keys["voucher_signer"] ?? null)
  const buy = asObj(keys["buyback_executor"] ?? null)
  return {
    voucherTtlS: asBig(atPath(pack, ["generated", "api", "voucher_ttl_s"])),
    voucherSignerService: asText(voucher["service"]),
    buybackExecutorService: asText(buy["service"]),
  }
}

function asMap(value: Json | undefined): { readonly [key: string]: bigint } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) return {}
  const out: { [key: string]: bigint } = {}
  const row = value as { readonly [key: string]: Json }
  for (const key of Object.keys(row)) {
    try {
      out[key] = asBig(row[key])
    } catch {
      continue
    }
  }
  return out
}

function asTextMap(value: Json | undefined): { readonly [key: string]: string } | undefined {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) return undefined
  const out: { [key: string]: string } = {}
  const row = value as { readonly [key: string]: Json }
  for (const key of Object.keys(row)) {
    try {
      out[key] = asText(row[key])
    } catch {
      continue
    }
  }
  return out
}

function asJsonList(value: Json | undefined): readonly Json[] | undefined {
  return Array.isArray(value) ? value : undefined
}

function parseSlices(value: Json | undefined): readonly ConveyorSlice[] | undefined {
  const rows = asJsonList(value)
  if (rows === undefined) {
    if (value !== undefined) throw new Error(codes.API_MALFORMED)
    return undefined
  }
  const out: ConveyorSlice[] = []
  for (const raw of rows) {
    const row = asObj(raw)
    const players = asJsonList(row["players"])
    const amounts = asJsonList(row["amounts"])
    if (players === undefined || amounts === undefined || players.length !== amounts.length) {
      throw new Error(codes.API_MALFORMED)
    }
    out.push({
      kettle: asBig(row["kettle"]),
      token: asText(row["token"]),
      players: players.map((player) => asText(player)),
      amounts: amounts.map((amount) => asBig(amount)),
      callerService: asText(row["caller_service"]),
    })
  }
  return out
}

function parseReturns(value: Json | undefined): readonly ConveyorReturn[] | undefined {
  const rows = asJsonList(value)
  if (rows === undefined) {
    if (value !== undefined) throw new Error(codes.API_MALFORMED)
    return undefined
  }
  const out: ConveyorReturn[] = []
  for (const raw of rows) {
    const row = asObj(raw)
    out.push({
      kettle: asBig(row["kettle"]),
      token: asText(row["token"]),
    })
  }
  return out
}

function nonNegativeMap(value: { readonly [key: string]: bigint }): boolean {
  for (const amount of Object.values(value)) {
    if (amount < 0n) return false
  }
  return true
}

function parseBatch(raw: Uint8Array): ConveyorBatch | undefined {
  if (raw.length === 0) return undefined
  try {
    const row = asObj(parseJson(fromUtf8(raw)))
    const tokens = asTextMap(row["token_by_ticker"])
    const monthFills = asMap(row["month_fills"])
    const farmFills = asMap(row["farm_fills"])
    const slices = parseSlices(row["slices"])
    const returns = parseReturns(row["returns"])
    const corpDepthWei = row["corp_depth_wei"] === undefined ? undefined : asBig(row["corp_depth_wei"])
    const base = {
      cityTime: asBig(row["city_time"]),
      fundWei: asBig(row["fund_wei"]),
      leaderboardWei: asBig(row["leaderboard_wei"]),
      farmWei: asBig(row["farm_wei"]),
      depthsWei: asMap(row["depths_wei"]),
      fragmentDemand: asMap(row["fragment_demand"]),
      hopOk: asBig(row["hop_ok"]),
      callerService: asText(row["caller_service"]),
    }
    if (
      base.cityTime < 0n ||
      base.fundWei < 0n ||
      base.leaderboardWei < 0n ||
      base.farmWei < 0n ||
      base.hopOk < 0n ||
      (corpDepthWei !== undefined && corpDepthWei < 0n) ||
      !nonNegativeMap(base.depthsWei) ||
      !nonNegativeMap(base.fragmentDemand) ||
      !nonNegativeMap(monthFills) ||
      !nonNegativeMap(farmFills)
    ) {
      return undefined
    }
    return {
      ...base,
      ...(tokens === undefined ? {} : { tokenByTicker: tokens }),
      ...(monthFills === undefined ? {} : { monthFills }),
      ...(farmFills === undefined ? {} : { farmFills }),
      ...(corpDepthWei === undefined ? {} : { corpDepthWei }),
      ...(slices === undefined ? {} : { slices }),
      ...(returns === undefined ? {} : { returns }),
    }
  } catch {
    return undefined
  }
}

export function createConveyorSubmit(
  pack: BuybackPack,
  port: AssetPort,
  source: ConveyorSource,
): ConveyorHandler {
  let state: ConveyorState = emptyConveyorState(pack.tickers)
  return async (body: Uint8Array): Promise<Uint8Array> => {
    try {
      let batch = parseBatch(body)
      if (batch === undefined) {
        const pulled = await source.pull()
        if (!pulled.ok) {
          return canonical({ ok: 0n, code: pulled.code, degraded: 1n })
        }
        batch = pulled.batch
      }
      const out = await runStockConveyor(pack, port, state, batch)
      state = out.next
      return canonical({
        ok: out.degraded === 0n ? 1n : 0n,
        code: out.code,
        degraded: out.degraded,
        calls: BigInt(out.calls.length),
      })
    } catch {
      return canonical({ ok: 0n, code: codes.SERVICE_DEGRADED, degraded: 1n })
    }
  }
}

export function createBuybackPort(bytes: Uint8Array, pack: BuybackPack): AssetPort {
  const loaded = loadPack(bytes)
  const cfg = portCfg(loaded.pack)
  const live = liveRpcConfig()
  if (live !== undefined) {
    return createRpcPort(cfg, createLiveTransport(live))
  }
  return createMockPort(cfg, {
    prizeStocks: pack.tickers,
    prizeDepositor: pack.executorService,
    prizeSigner: pack.voucherService,
  })
}

export function createDefaultConveyorSubmit(bytes: Uint8Array, pack: BuybackPack): ConveyorHandler {
  return createConveyorSubmit(pack, createBuybackPort(bytes, pack), createMockConveyorSource())
}

function liveRpcConfig(): LiveRpcConfig | undefined {
  const url = process.env.CORPORATOR_RPC_URL
  const chainIdRaw = process.env.CORPORATOR_CHAIN_ID
  const timeoutRaw = process.env.CORPORATOR_RPC_TIMEOUT_MS
  const corpToken = process.env.CORPORATOR_CORP_TOKEN
  const vault = process.env.CORPORATOR_VAULT
  const stakeRegistry = process.env.CORPORATOR_STAKE_REGISTRY
  const merkleRoots = process.env.CORPORATOR_MERKLE_ROOTS
  const prizeTreasury = process.env.CORPORATOR_PRIZE_TREASURY
  const prizeDepositor = process.env.CORPORATOR_BUYBACK_EXECUTOR
  const prizeSigner = process.env.CORPORATOR_SIGNER
  if (
    url === undefined ||
    url.length === 0 ||
    chainIdRaw === undefined ||
    timeoutRaw === undefined ||
    corpToken === undefined ||
    vault === undefined ||
    stakeRegistry === undefined ||
    merkleRoots === undefined ||
    prizeTreasury === undefined ||
    prizeDepositor === undefined ||
    prizeSigner === undefined
  ) {
    return undefined
  }
  try {
    return {
      url,
      chainId: BigInt(chainIdRaw),
      timeoutMs: BigInt(timeoutRaw),
      contracts: { corpToken, vault, stakeRegistry, merkleRoots, prizeTreasury },
      callers: {
        depositorService: "buyback",
        depositorAddress: prizeDepositor,
        signerService: "api",
        signerAddress: prizeSigner,
      },
    }
  } catch {
    return undefined
  }
}
