import { atPath, loadPack } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { asBig, asObj, asText, LoadError } from "./values.js"

export type LlmPack = {
  readonly hash: string
  readonly queueCapacity: bigint
  readonly onProviderFail: string
  readonly templateText: string
  readonly templateCode: string
  readonly blocksTick: bigint
  readonly failMode: string
}

export function loadLlmPack(bytes: Uint8Array): LlmPack {
  const loaded = loadPack(bytes)
  const pack = loaded.pack
  const arch = asObj(atPath(pack, ["sections", "arch"]))
  const companion = asObj(atPath(pack, ["sections", "companion"]))
  const llm = asObj(companion["llm"])
  const archGen = asObj(atPath(pack, ["generated", "arch"]))
  const services = asObj(arch["services"])
  const host = asObj(services["llm"])
  const ru = asObj(atPath(pack, ["strings", "ru"]))
  const templateText = asText(ru[codes.COMPANION_LLM_TEMPLATE])
  if (templateText.length === 0) throw new LoadError(codes.API_MALFORMED)
  const fail = asObj(llm["on_provider_fail"])
  return {
    hash: loaded.hash,
    queueCapacity: asBig(archGen["companion_queue_capacity"]),
    onProviderFail: asText(fail["v"]),
    templateText,
    templateCode: codes.COMPANION_LLM_TEMPLATE,
    blocksTick: asBig(host["blocks_tick"]),
    failMode: asText(host["fail_mode"]),
  }
}

export function queueCapacityOk(pack: LlmPack): boolean {
  return pack.queueCapacity > 0n
}
