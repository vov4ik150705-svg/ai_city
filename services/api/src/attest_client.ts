import { fromUtf8, parseJson } from "@corporator/contentpack"
import { listenBindOrEnv, listenPorts, readyTemplate } from "@corporator/protocol"
import type { AttestResult, Attestor } from "./tick_host.js"

function asRow(value: unknown): { readonly [key: string]: unknown } | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as { readonly [key: string]: unknown }
}

/** POST sealed ticks to the attestor ready socket. Fail-open: throw lets tick_host catch. */
export function remoteAttestor(): Attestor {
  const bind = listenBindOrEnv(process.env.CORPORATOR_LISTEN_BIND)
  const url = "http://" + bind + ":" + listenPorts.attestor.toString() + readyTemplate
  return {
    async submit(payload: Uint8Array): Promise<AttestResult | undefined> {
      const res = await fetch(url, { method: "POST", body: payload })
      if (!res.ok) return undefined
      const row = asRow(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))))
      if (row === undefined) return undefined
      const rootHex = row["rootHex"]
      const cidHex = row["cidHex"]
      const badge = row["badge"]
      if (typeof rootHex !== "string" || typeof cidHex !== "string" || typeof badge !== "string") return undefined
      return { rootHex, cidHex, badge }
    },
  }
}
