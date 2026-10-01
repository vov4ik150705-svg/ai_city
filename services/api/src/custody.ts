import { atPath, type Json } from "@corporator/contentpack"
import {
  createLiveTransport,
  createMockPort,
  createRpcPort,
  readPlayerReady,
  readWalletPrice,
  type AssetPort,
  type EnvMap,
  type LiveRpcConfig,
  type PortConfig,
} from "@corporator/chainport"
import { asBigint, asObj, asText } from "./values.js"

export function portCfgFromPack(pack: Json): PortConfig {
  const keys = asObj(atPath(pack, ["sections", "arch", "keys"]))
  const voucher = asObj(keys["voucher_signer"] ?? null)
  const buy = asObj(keys["buyback_executor"] ?? null)
  return {
    voucherTtlS: asBigint(atPath(pack, ["generated", "api", "voucher_ttl_s"])),
    voucherSignerService: asText(voucher["service"]),
    buybackExecutorService: asText(buy["service"]),
    bps:
      asBigint(atPath(pack, ["sections", "economy", "params", "spend_burn_bps", "v"])) +
      asBigint(atPath(pack, ["sections", "economy", "params", "spend_fund_bps", "v"])) +
      asBigint(atPath(pack, ["sections", "economy", "params", "spend_protocol_bps", "v"])),
    gasHeadroomBps: asBigint(atPath(pack, ["sections", "api", "params", "server_gas_headroom_bps", "v"])),
  }
}

function liveRpcConfig(env: EnvMap): LiveRpcConfig | undefined {
  const url = env["CORPORATOR_RPC_URL"]
  const chainIdRaw = env["CORPORATOR_CHAIN_ID"]
  const timeoutRaw = env["CORPORATOR_RPC_TIMEOUT_MS"]
  if (url === undefined || url.length === 0) return undefined
  if (chainIdRaw === undefined || timeoutRaw === undefined) return undefined
  const ready = readPlayerReady(env)
  if (ready.contracts === undefined) return undefined
  const prizeTreasury = ready.contracts.prizeTreasury
  if (prizeTreasury === undefined || prizeTreasury.length === 0) return undefined
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

/** Live RPC only when deposits are open and the env is complete. Otherwise mock. A half-open flag is a refusal, not a mock. */
export type ApiPortPick =
  | { readonly kind: "mock"; readonly port: AssetPort }
  | { readonly kind: "rpc"; readonly port: AssetPort }
  | { readonly kind: "refuse" }

export function pickApiPort(cfg: PortConfig, env: EnvMap): ApiPortPick {
  const open = env["CORPORATOR_DEPOSITS_OPEN"] === "1"
  if (!open) return { kind: "mock", port: createMockPort(cfg) }
  const live = liveRpcConfig(env)
  if (live === undefined) return { kind: "refuse" }
  const withGas =
    cfg.bps !== undefined && cfg.gasHeadroomBps !== undefined
      ? { ...live, bps: cfg.bps, gasHeadroomBps: cfg.gasHeadroomBps }
      : live
  return { kind: "rpc", port: createRpcPort(cfg, createLiveTransport(withGas)) }
}

export function selectApiPort(cfg: PortConfig, env: EnvMap): AssetPort {
  const picked = pickApiPort(cfg, env)
  if (picked.kind === "refuse") {
    throw new Error("DEPOSITS_OPEN")
  }
  return picked.port
}

export function prizeCustodyLive(port: AssetPort): boolean {
  return port.kind === "rpc"
}

/** Chain wallet overlay. Silent or mock ports do not invent a balance. */
export async function readWalletOverlay(
  pack: Json,
  env: EnvMap,
  account: string,
): Promise<{ readonly chain: string; readonly corp: bigint } | undefined> {
  if (account.length === 0) return undefined
  const live = liveRpcConfig(env)
  if (live === undefined) return undefined
  const transport = createLiveTransport(live)
  const port = createRpcPort(portCfgFromPack(pack), transport)
  const price = await readWalletPrice(port, account, transport, undefined)
  if (price.chain.length === 0) return undefined
  return { chain: price.chain, corp: price.corp }
}
