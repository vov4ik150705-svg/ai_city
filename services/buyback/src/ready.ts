import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { canonical } from "@corporator/contentpack"
import { listenBindOrEnv, readyTemplate, transportHttp } from "@corporator/protocol"
import { liveRpcReady } from "./worker.js"

export type ReadyListen = {
  readonly port: bigint
  close(): Promise<void>
}

export type ConveyorSubmit = (body: Uint8Array) => Promise<Uint8Array>

function portNumber(port: bigint): number {
  const n = Number(port)
  if (n.toString() !== port.toString()) throw new Error("listen port")
  return n
}

function readBody(req: IncomingMessage, done: (body: Uint8Array) => void, fail: () => void): void {
  const chunks: Buffer[] = []
  req.on("data", (c: Buffer) => {
    chunks.push(c)
  })
  req.on("end", () => {
    done(new Uint8Array(Buffer.concat(chunks)))
  })
  req.on("error", fail)
}

export function listenReady(hash: string, port: bigint, submit?: ConveyorSubmit): Promise<ReadyListen> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? ""
    if (req.method === "GET" && url === readyTemplate) {
      const hop = process.env.CORPORATOR_HOP_URL
      const live = hop !== undefined && hop.length > 0 && liveRpcReady(process.env)
      res.statusCode = Number(transportHttp.API_INTENT_REPLAY)
      res.end(
        Buffer.from(
          canonical({
            pack_hash: hash,
            ready: live ? 1n : 0n,
            source: live ? "live" : "mock",
          }),
        ),
      )
      return
    }
    if (req.method === "POST" && url === readyTemplate && submit !== undefined) {
      readBody(
        req,
        (body) => {
          void submit(body)
            .then((out) => {
              res.statusCode = Number(transportHttp.API_INTENT_REPLAY)
              res.end(Buffer.from(out))
            })
            .catch(() => {
              res.statusCode = Number(transportHttp.SERVICE_DEGRADED)
              res.end()
            })
        },
        () => {
          res.statusCode = Number(transportHttp.API_MALFORMED)
          res.end()
        },
      )
      return
    }
    res.statusCode = Number(transportHttp.API_MALFORMED)
    res.end()
  })
  return new Promise((resolve, reject) => {
    server.listen(portNumber(port), listenBindOrEnv(process.env.CORPORATOR_LISTEN_BIND), () => {
      resolve({
        port,
        close: () =>
          new Promise((done, fail) => {
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
