import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { Duplex } from "node:stream"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import {
  codes,
  listenBind,
  listenBindOrEnv,
  listenPorts,
  transportHttp,
  wsHeartbeatMs,
  wsTemplate,
} from "@corporator/protocol"
import { type ApiHost } from "./host.js"
import { matchTemplate } from "./pack_ctx.js"
import { errResult } from "./envelope.js"
import { sessionFromHeaders } from "./session.js"
import { bearerFromProtocol, handshake, pulseFrame, rejectUnauthorized, textFrame } from "./ws.js"
import { asBigint, asObj, asText, walk } from "./values.js"
import { wsChannelClasses } from "./ws_patch.js"

export type ApiListen = {
  readonly host: ApiHost
  readonly port: bigint
  pulse(): void
  close(): Promise<void>
}

type CitySocket = {
  readonly socket: Duplex
  readonly cityId: string
  readonly expiresCityTime: bigint
}

function portNumber(port: bigint): number {
  const n = Number(port)
  if (n.toString() !== port.toString()) throw new Error("listen port")
  return n
}

function envPort(fallback: bigint): bigint {
  const raw = process.env.CORPORATOR_LISTEN_PORT
  if (raw === undefined || raw.length === 0) return fallback
  return BigInt(raw)
}

function packClientOrigin(): string {
  return "http://" + listenBind + ":" + listenPorts.client.toString()
}

function originAllowed(origin: string): boolean {
  const raw = process.env.CORPORATOR_CORS_ORIGINS
  if (raw === undefined || raw.length === 0) return origin === packClientOrigin()
  for (const part of raw.split(",")) {
    if (part.trim() === origin) return true
  }
  return false
}

function securityHeaders(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'")
  res.setHeader("X-Content-Type-Options", "nosniff")
  const origin = req.headers.origin
  if (typeof origin !== "string" || origin.length === 0 || !originAllowed(origin)) return
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
}

function pathOf(raw: string): string {
  const cut = raw.indexOf("?")
  return cut < 0 ? raw : raw.slice(0, cut)
}

function bodyCeiling(host: ApiHost): number {
  const n = asBigint(walk(host.ctx.pack, ["sections", "api", "params", "http_body_max_bytes", "v"]))
  if (n <= 0n) return 0
  const asNum = Number(n)
  if (!Number.isSafeInteger(asNum)) return 0
  return asNum
}

export function listenApi(host: ApiHost, bindPort?: bigint): Promise<ApiListen> {
  const port = bindPort ?? envPort(listenPorts.api)
  const sockets: CitySocket[] = []
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = pathOf(req.url ?? "")
    const method = req.method ?? "GET"
    if (method === "OPTIONS") {
      securityHeaders(req, res)
      res.statusCode = 204
      res.end()
      return
    }
    const chunks: Buffer[] = []
    const ceiling = bodyCeiling(host)
    let size = 0
    let stopped = false
    req.on("data", (c: Buffer) => {
      if (stopped) return
      size += c.length
      if (size > ceiling) {
        stopped = true
        chunks.length = 0
        req.destroy()
        res.destroy()
        return
      }
      chunks.push(c)
    })
    req.on("error", () => {
      stopped = true
    })
    req.on("end", () => {
      if (stopped) return
      const body = new Uint8Array(Buffer.concat(chunks))
      const headers: { [name: string]: string } = {}
      const auth = req.headers.authorization
      if (typeof auth === "string") headers["authorization"] = auth
      void host
        .handle(method, url, body, headers)
        .then((result) => {
          res.statusCode = Number(result.status)
          securityHeaders(req, res)
          for (const name of Object.keys(result.headers)) {
            const val = result.headers[name]
            if (val !== undefined) res.setHeader(name, val)
          }
          res.end(Buffer.from(result.body))
        })
        .catch(() => {
          res.statusCode = Number(transportHttp.API_MALFORMED)
          securityHeaders(req, res)
          res.end()
        })
    })
  })
  function dropExpired(): void {
    const now = asBigint(host.state["city_time"])
    for (const row of [...sockets]) {
      if (row.expiresCityTime < now) row.socket.destroy()
    }
  }
  function send(cityId: string, payload: Uint8Array): void {
    dropExpired()
    const frame = textFrame(payload)
    for (const row of sockets) {
      if (row.cityId !== cityId) continue
      try {
        row.socket.write(frame)
      } catch {
        // closed
      }
    }
  }
  for (const channel of wsChannelClasses) {
    host.channels.subscribe(channel, (payload) => {
      try {
        const cityId = asText(asObj(parseJson(fromUtf8(payload)))["city_id"])
        if (cityId.length === 0) return
        send(cityId, payload)
      } catch {
        return
      }
    })
  }
  server.on("upgrade", (req: IncomingMessage, socket: Duplex) => {
    socket.on("error", () => {
      socket.destroy()
    })
    void acceptSocket(req, socket).catch(() => {
      socket.destroy()
    })
  })
  async function acceptSocket(req: IncomingMessage, socket: Duplex): Promise<void> {
    const hit = matchTemplate(wsTemplate, pathOf(req.url ?? ""))
    if (hit === undefined) {
      socket.destroy()
      return
    }
    const headers: { [name: string]: string } = {}
    const offered = req.headers["sec-websocket-protocol"]
    const fromProtocol = bearerFromProtocol(typeof offered === "string" ? offered : undefined, host.ctx.sessionScheme)
    const auth = req.headers.authorization
    if (typeof auth === "string" && auth.length > 0) headers["authorization"] = auth
    else if (fromProtocol.authorization.length > 0) headers["authorization"] = fromProtocol.authorization
    const session = await sessionFromHeaders(host.ctx, host.store, host.state, headers)
    const cityId = asText(hit["city_id"])
    if (session === undefined || session.cityId !== cityId) {
      const denied = errResult(host.ctx, host.state, codes.API_UNAUTHORIZED)
      rejectUnauthorized(socket, Number(denied.status), denied.body)
      return
    }
    if (!handshake(socket, req, fromProtocol.selected)) return
    const row: CitySocket = { socket, cityId: session.cityId, expiresCityTime: session.expiresCityTime }
    sockets.push(row)
    socket.on("close", () => {
      const i = sockets.indexOf(row)
      if (i >= 0) sockets.splice(i, 1)
    })
  }
  function pulse(): void {
    dropExpired()
    const body = pulseFrame({
      city_time: asBigint(host.state["city_time"]),
      pack_hash: host.ctx.hash,
    })
    for (const row of sockets) {
      try {
        row.socket.write(body)
      } catch {
        // closed
      }
    }
  }
  const delay = portNumber(wsHeartbeatMs)
  const timer = setInterval(pulse, delay)
  return new Promise((resolve, reject) => {
    server.listen(portNumber(port), listenBindOrEnv(process.env.CORPORATOR_LISTEN_BIND), () => {
      const addr = server.address()
      if (addr === null || typeof addr === "string") {
        reject(new Error("listen"))
        return
      }
      resolve({
        host,
        port: BigInt(addr.port),
        pulse,
        close: () =>
          new Promise((done, fail) => {
            clearInterval(timer)
            for (const row of sockets) row.socket.destroy()
            server.close((err) => {
              if (err) fail(err)
              else done()
            })
          }),
      })
    })
    server.on("error", reject)
  })
}
