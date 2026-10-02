import { listenBind, listenPorts, readyTemplate } from "@corporator/protocol"

function named(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.length === 0) return undefined
  return raw
}

/** Ready URL for an outbound call. Listen bind is never the host. */
export function outboundReadyUrl(raw: string | undefined, port: bigint): string | undefined {
  const set = named(raw)
  if (set !== undefined) return set
  const bind = process.env.CORPORATOR_LISTEN_BIND
  if (bind !== undefined && bind.length > 0 && bind !== listenBind) return undefined
  return "http://" + listenBind + ":" + port.toString() + readyTemplate
}

export function buybackReadyUrl(): string | undefined {
  return outboundReadyUrl(process.env.CORPORATOR_BUYBACK_URL, listenPorts.buyback)
}

export function attestorReadyUrl(): string | undefined {
  return outboundReadyUrl(process.env.CORPORATOR_ATTESTOR_URL, listenPorts.attestor)
}
