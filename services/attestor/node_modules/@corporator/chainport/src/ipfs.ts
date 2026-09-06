import { codes } from "@corporator/protocol"
import { err, type PortErr, type PortOk } from "./values.js"
import type { EnvMap } from "./rpc/playerReady.js"

export type IpfsKind = "mock" | "http"

export type PinOk = PortOk & { readonly cidHex: string }
export type PinResult = PinOk | PortErr

export type IpfsPort = {
  readonly kind: IpfsKind
  pin(key: string, bytes: Uint8Array): Promise<PinResult>
}

const PIN_URL = "CORPORATOR_IPFS_PIN_URL"
const PIN_TOKEN = "CORPORATOR_IPFS_PIN_TOKEN"

function pinOk(cidHex: string): PinOk {
  return { ok: true, cidHex }
}

export function createMockIpfs(down: boolean): IpfsPort {
  const stored = new Map<string, Uint8Array>()
  return {
    kind: "mock",
    async pin(key: string, bytes: Uint8Array): Promise<PinResult> {
      if (down || key.length === 0) return err(codes.SERVICE_DEGRADED)
      stored.set(key, bytes)
      return pinOk(key)
    },
  }
}

export function createHttpIpfs(env: EnvMap): IpfsPort {
  const url = env[PIN_URL]
  const token = env[PIN_TOKEN]
  const endpoint = url === undefined ? "" : url
  const auth = token === undefined ? "" : token
  return {
    kind: "http",
    async pin(key: string, bytes: Uint8Array): Promise<PinResult> {
      if (endpoint.length === 0 || key.length === 0) return err(codes.SERVICE_DEGRADED)
      try {
        const headers: { [name: string]: string } = { "content-type": "application/octet-stream" }
        if (auth.length > 0) headers.authorization = auth
        const res = await fetch(endpoint, { method: "POST", headers, body: bytes })
        if (!res.ok) return err(codes.SERVICE_DEGRADED)
        return pinOk(key)
      } catch {
        return err(codes.SERVICE_DEGRADED)
      }
    },
  }
}
