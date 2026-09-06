import { atPath, canonical, loadPack, type Json } from "@corporator/contentpack"
import {
  createHttpIpfs,
  createMockIpfs,
  createMockPort,
  type EnvMap,
  type PortConfig,
} from "@corporator/chainport"
import { loadAttestorPack } from "./pack.js"
import { publishSealed } from "./publish.js"
import { sealedFromPayload } from "./sealed.js"
import { memoryRootStore } from "./store.js"
import { emptyAttestorState, type AttestorState } from "./step.js"
import { asBig, asObj, asText } from "./values.js"

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

/** Injected wall_s, never Date. Mock chain until R-V-5 fills RPC. TICK.md §9. */
export function createSubmit(bytes: Uint8Array, env: EnvMap): (body: Uint8Array) => Promise<Uint8Array> {
  const pack = loadAttestorPack(bytes)
  const loaded = loadPack(bytes)
  const cfg = portCfg(loaded.pack)
  const pin = env["CORPORATOR_IPFS_PIN_URL"]
  const ipfs = pin !== undefined && pin.length > 0 ? createHttpIpfs(env) : createMockIpfs(false)
  const port = createMockPort(cfg)
  const store = memoryRootStore()
  let state = emptyAttestorState()
  return async (body: Uint8Array): Promise<Uint8Array> => {
    const tick = sealedFromPayload(body)
    if (tick === undefined) {
      return canonical({ rootHex: "", cidHex: "", badge: "logged" })
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
