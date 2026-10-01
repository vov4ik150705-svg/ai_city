import { atPath, canonical, loadPack, type Json } from "@corporator/contentpack"
import {
  createHttpIpfs,
  createLiveTransport,
  createMockIpfs,
  createMockPort,
  createRpcPort,
  readPlayerReady,
  type AssetPort,
  type EnvMap,
  type LiveRpcConfig,
  type PortConfig,
} from "@corporator/chainport"
import { loadAttestorPack } from "./pack.js"
import { publishSealed } from "./publish.js"
import { sealedFromPayload } from "./sealed.js"
import { openRootStore, type RootStore } from "./store.js"
import { emptyAttestorState, type AttestorState } from "./step.js"
import { asBig, asObj, asText } from "./values.js"

export type SubmitDeps = {
  readonly store?: RootStore
  readonly port?: AssetPort
}

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

function wallOf(packPeriod: bigint, state: AttestorState): bigint {
  if (state.hasFlushed === 0n) return packPeriod
  return state.lastFlushWallS + packPeriod
}

function liveRpcConfig(env: EnvMap): LiveRpcConfig | undefined {
  const url = env["CORPORATOR_RPC_URL"]
  const chainIdRaw = env["CORPORATOR_CHAIN_ID"]
  const timeoutRaw = env["CORPORATOR_RPC_TIMEOUT_MS"]
  if (url === undefined || url.length === 0) return undefined
  if (chainIdRaw === undefined || timeoutRaw === undefined) return undefined
  const ready = readPlayerReady(env)
  if (ready.contracts === undefined) return undefined
  try {
    return {
      url,
      chainId: BigInt(chainIdRaw),
      timeoutMs: BigInt(timeoutRaw),
      contracts: ready.contracts,
    }
  } catch {
    return undefined
  }
}

/** Live RPC when env contracts and RPC URL are valid; otherwise mock. */
export function selectAttestorPort(cfg: PortConfig, env: EnvMap): AssetPort {
  const live = liveRpcConfig(env)
  if (live === undefined) return createMockPort(cfg)
  return createRpcPort(cfg, createLiveTransport(live))
}

/** Injected wall_s, never Date. Live chain when env is complete. TICK.md §9. */
export function createSubmit(
  bytes: Uint8Array,
  env: EnvMap,
  deps: SubmitDeps = {},
): (body: Uint8Array) => Promise<Uint8Array> {
  const pack = loadAttestorPack(bytes)
  const loaded = loadPack(bytes)
  const cfg = portCfg(loaded.pack)
  const pin = env["CORPORATOR_IPFS_PIN_URL"]
  const ipfs = pin !== undefined && pin.length > 0 ? createHttpIpfs(env) : createMockIpfs(false)
  const port = deps.port ?? selectAttestorPort(cfg, env)
  let store = deps.store
  let opening: Promise<RootStore> | undefined
  let state = emptyAttestorState()
  return async (body: Uint8Array): Promise<Uint8Array> => {
    const tick = sealedFromPayload(body)
    if (tick === undefined) {
      return canonical({ rootHex: "", cidHex: "", badge: "logged" })
    }
    if (store === undefined) {
      if (opening === undefined) opening = openRootStore(env)
      store = await opening
    }
    const published = await publishSealed(pack, port, ipfs, store, state, [tick], wallOf(pack.rootPeriodS, state))
    state = published.next
    return canonical({
      rootHex: published.rootHex,
      cidHex: published.cidHex,
      badge: published.badge,
      degraded: published.degraded,
    })
  }
}
