import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { Duplex } from "node:stream"
import {
  listenBindOrEnv,
  listenPorts,
  transportHttp,
  wsHeartbeatMs,
  wsTemplate,
} from "@corporator/protocol"
import { type ApiHost } from "./host.js"
import { matchTemplate } from "./pack_ctx.js"
import { handshake, pulseFrame } from "./ws.js"
import { asBigint } from "./values.js"

export type ApiListen = {
  readonly host: ApiHost
  readonly port: bigint
  pulse(): void
  close(): Promise<void>
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

function securityHeaders(res: ServerResponse): void {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'")
  res.setHeader("X-Content-Type-Options", "nosniff")
}

export function listenApi(host: ApiHost, bindPort?: bigint): Promise<ApiListen> {
  const port = bindPort ?? envPort(listenPorts.api)
  const sockets: Duplex[] = []
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const raw = req.url ?? ""
    const cut = raw.indexOf("?")
    const url = cut < 0 ? raw : raw.slice(0, cut)
    const method = req.method ?? "GET"
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => {
      chunks.push(c)
    })
    req.on("end", () => {
      const body = new Uint8Array(Buffer.concat(chunks))
      const headers: { [name: string]: string } = {}
      const auth = req.headers.authorization
      if (typeof auth === "string") headers["authorization"] = auth
      void host
        .handle(method, url, body, headers)
        .then((result) => {
          res.statusCode = Number(result.status)
          securityHeaders(res)
          for (const name of Object.keys(result.headers)) {
            const val = result.headers[name]
            if (val !== undefined) res.setHeader(name, val)
          }
          res.end(Buffer.from(result.body))
        })
        .catch(() => {
          res.statusCode = Number(transportHttp.API_MALFORMED)
          securityHeaders(res)
          res.end()
        })
    })
  })
  server.on("upgrade", (req: IncomingMessage, socket: Duplex) => {
    const url = req.url ?? ""
    if (matchTemplate(wsTemplate, url) === undefined) {
      socket.destroy()
      return
    }
    if (!handshake(socket, req)) return
    sockets.push(socket)
    socket.on("close", () => {
      const i = sockets.indexOf(socket)
      if (i >= 0) sockets.splice(i, 1)
    })
  })
  function pulse(): void {
    const body = pulseFrame({
      city_time: asBigint(host.state["city_time"]),
      pack_hash: host.ctx.hash,
    })
    for (const socket of sockets) socket.write(body)
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
            for (const socket of sockets) socket.destroy()
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

