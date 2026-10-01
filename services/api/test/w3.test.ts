import { request as httpRequest } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { codes, listenBind, transportHttp, wsTemplate } from "@corporator/protocol"
import { applyTemplate } from "../src/pack_ctx.ts"
import { listenApi } from "../src/listen.ts"
import { asObj, asText } from "../src/values.ts"
import { bootHost, demoAuth } from "./harness.ts"

const closers: { close(): Promise<void> }[] = []

afterEach(async () => {
  while (closers.length > 0) {
    const row = closers.pop()
    if (row === undefined) continue
    await row.close()
  }
})

function origin(port: bigint): string {
  return "http://" + listenBind + ":" + port.toString()
}

function statePath(host: Awaited<ReturnType<typeof bootHost>>, cityId: string): string {
  return applyTemplate(host.ctx.stateTemplate, "city_id", cityId)
}

async function getState(
  port: bigint,
  path: string,
  authorization = "",
): Promise<{ readonly status: number; readonly body: ReturnType<typeof parseJson> }> {
  const headers: { [name: string]: string } = {}
  if (authorization.length > 0) headers["authorization"] = authorization
  const res = await fetch(origin(port) + path, { headers })
  const buf = new Uint8Array(await res.arrayBuffer())
  return { status: res.status, body: parseJson(fromUtf8(buf)) }
}

function upgrade(
  port: bigint,
  path: string,
  authorization = "",
): Promise<{ readonly status: number }> {
  const headers: { [name: string]: string } = {
    Connection: "Upgrade",
    Upgrade: "websocket",
    "Sec-WebSocket-Key": Buffer.from("0123456789abcdef").toString("base64"),
    "Sec-WebSocket-Version": "13",
  }
  if (authorization.length > 0) headers["authorization"] = authorization
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: listenBind,
        port: Number(port),
        path,
        headers,
      },
      (res) => {
        res.resume()
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0 })
        })
      },
    )
    req.on("upgrade", (_res, socket) => {
      const status = _res.statusCode ?? 0
      socket.destroy()
      resolve({ status })
    })
    req.on("error", reject)
    req.end()
  })
}

describe.sequential("W3 session on read and ws", () => {
  it("refuses state and socket without a session", async () => {
    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    const path = statePath(host, "a")
    const read = await getState(api.port, path)
    expect(read.status).toBe(Number(transportHttp.API_UNAUTHORIZED))
    expect(asText(asObj(read.body)["code"])).toBe(codes.API_UNAUTHORIZED)
    const wsPath = applyTemplate(wsTemplate, "city_id", "a")
    const sock = await upgrade(api.port, wsPath)
    expect(sock.status).toBe(Number(transportHttp.API_UNAUTHORIZED))
  })

  it("returns the city to its own session", async () => {
    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    const auth = await demoAuth(host)
    const read = await getState(api.port, statePath(host, auth.cityId), auth.headers.authorization)
    expect(read.status).toBe(Number(host.ctx.httpOk))
    expect(asText(asObj(read.body)["city_id"])).toBe(auth.cityId)
    const ws = new WebSocket("ws://" + listenBind + ":" + api.port.toString() + applyTemplate(wsTemplate, "city_id", auth.cityId), {
      headers: { authorization: auth.headers.authorization },
    })
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve())
      ws.addEventListener("error", () => reject(new Error("ws error")))
    })
    const pulse = new Promise<string>((resolve) => {
      ws.addEventListener("message", (ev) => {
        const raw = ev.data
        if (typeof raw === "string") resolve(raw)
        else if (raw instanceof Uint8Array) resolve(fromUtf8(raw))
        else if (raw instanceof ArrayBuffer) resolve(fromUtf8(new Uint8Array(raw)))
      })
    })
    api.pulse()
    const text = await pulse
    const body = asObj(parseJson(text))
    expect(asText(body["pack_hash"])).toBe(host.ctx.hash)
    ws.close()
  })

  it("forged city id does not return the other city", async () => {
    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    const owner = await demoAuth(host)
    const other = await demoAuth(host)
    expect(owner.cityId === other.cityId).toBe(false)
    const read = await getState(api.port, statePath(host, other.cityId), owner.headers.authorization)
    expect(read.status).toBe(Number(transportHttp.API_UNAUTHORIZED))
    expect(asText(asObj(read.body)["code"])).toBe(codes.API_UNAUTHORIZED)
    expect(asText(asObj(read.body)["city_id"])).not.toBe(other.cityId)
    const sock = await upgrade(
      api.port,
      applyTemplate(wsTemplate, "city_id", other.cityId),
      owner.headers.authorization,
    )
    expect(sock.status).toBe(Number(transportHttp.API_UNAUTHORIZED))
    const own = await getState(api.port, statePath(host, owner.cityId), owner.headers.authorization)
    expect(own.status).toBe(Number(host.ctx.httpOk))
    expect(asText(asObj(own.body)["city_id"])).toBe(owner.cityId)
  })
})
