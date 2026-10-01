import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { loadPack, parseJson, fromUtf8 } from "@corporator/contentpack"
import { listenBind, listenPorts, packHash, wsTemplate } from "@corporator/protocol"
import { listenApi } from "../../../services/api/src/listen.ts"
import { asObj, asText } from "../../../services/api/src/values.ts"
import { bootHost, demoAuth } from "../../../services/api/test/harness.ts"
import { applyPath } from "../src/command.ts"
import {
  apiOrigin,
  bootFromHost,
  cityTimeFromWall,
  loadClientPack,
  openCitySocket,
  originFromListen,
  resyncDue,
  resyncWaitMs,
  sessionWsProtocol,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const msPerHour = 60n * 60n * 1000n
const oneSecondMs = 1000n
const closers: { close(): Promise<void> }[] = []

afterEach(async () => {
  while (closers.length > 0) {
    const row = closers.pop()
    if (row === undefined) continue
    await row.close()
  }
})

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function clientPack() {
  return loadClientPack(loadPack(packBytes()).pack)
}

function shown(args: {
  readonly cityTime: bigint
  readonly anchorMs: bigint
  readonly nowMs: bigint
  readonly rateBps: bigint
  readonly bps: bigint
}): bigint {
  return cityTimeFromWall({
    anchorCityTime: args.cityTime,
    anchorMs: args.anchorMs,
    nowMs: args.nowMs,
    rateBps: args.rateBps,
    bps: args.bps,
  })
}

describe("W15", () => {
  it("two snapshots stay within one tick of the server", () => {
    const pack = clientPack()
    const oneCityHourMs = (pack.bps * msPerHour) / pack.rateBps
    expect(oneCityHourMs > oneSecondMs).toBe(true)
    const server = 40n
    const justAfter = shown({
      cityTime: server,
      anchorMs: oneSecondMs,
      nowMs: oneSecondMs,
      rateBps: pack.rateBps,
      bps: pack.bps,
    })
    expect(justAfter).toBe(server)
    expect(justAfter - server <= 1n).toBe(true)
    const server2 = server + 1n
    const at = oneCityHourMs + oneSecondMs
    const fresh = shown({
      cityTime: server2,
      anchorMs: at,
      nowMs: at + oneSecondMs,
      rateBps: pack.rateBps,
      bps: pack.bps,
    })
    const stale = shown({
      cityTime: server2,
      anchorMs: 0n,
      nowMs: at,
      rateBps: pack.rateBps,
      bps: pack.bps,
    })
    expect(fresh - server2 <= 1n).toBe(true)
    expect(fresh).toBe(server2)
    expect(stale - server2 >= 1n).toBe(true)
  })

  it("uses the env origin when set and the pack origin otherwise", () => {
    const packOrigin = originFromListen(listenBind, listenPorts.api)
    expect(apiOrigin(packOrigin, undefined)).toBe(packOrigin)
    expect(apiOrigin(packOrigin, "")).toBe(packOrigin)
    expect(apiOrigin(packOrigin, "https://api.example.test")).toBe("https://api.example.test")
    const main = readFileSync(join(repo, "apps/client/src/main.tsx"), "utf8")
    expect(main.includes("VITE_CORPORATOR_API_ORIGIN")).toBe(true)
    expect(main.includes("127.0.0.1")).toBe(false)
  })

  it("refetches only after a silent resync window", () => {
    const pack = clientPack()
    const wait = resyncWaitMs({
      resyncTicks: pack.resyncTicks,
      tickHours: pack.offlineTickLengthHours,
      rateBps: pack.rateBps,
      bps: pack.bps,
    })
    expect(pack.resyncTicks > 0n).toBe(true)
    expect(wait).toBe((pack.resyncTicks * pack.offlineTickLengthHours * pack.bps * msPerHour) / pack.rateBps)
    expect(resyncDue({ lastEventMs: 0n, nowMs: wait - 1n, waitMs: wait })).toBe(false)
    expect(resyncDue({ lastEventMs: 0n, nowMs: wait, waitMs: wait })).toBe(true)
    expect(resyncDue({ lastEventMs: oneSecondMs, nowMs: wait, waitMs: wait })).toBe(false)
    expect(resyncDue({ lastEventMs: 0n, nowMs: wait, waitMs: 0n })).toBe(false)
  })

  it("sends the session on the state read and not on the pack", async () => {
    const seen: { url: string; authorization: string }[] = []
    const result = await bootFromHost({
      origin: "http://pack.test",
      packHash,
      cityId: "city",
      sessionId: "abc",
      fetchBytes: async (url, headers) => {
        const authorization = headers === undefined ? "" : (headers["Authorization"] ?? "")
        seen.push({ url, authorization })
        if (url.includes("/pack/")) return packBytes()
        return new TextEncoder().encode("null")
      },
    })
    expect(result.ok).toBe(false)
    expect(seen.length).toBe(2)
    const packCall = seen[0]
    const stateCall = seen[1]
    expect(packCall !== undefined && packCall.url.includes("/pack/") && packCall.authorization.length === 0).toBe(true)
    expect(stateCall !== undefined && stateCall.authorization).toBe("Bearer abc")
  })

  it("browser fallback still offers the session protocol", () => {
    const calls: unknown[] = []
    const prev = globalThis.WebSocket
    class FakeSocket {
      constructor(_url: string, second?: unknown) {
        calls.push(second)
        if (second !== null && typeof second === "object" && !Array.isArray(second)) throw new TypeError("protocols")
      }
    }
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket
    try {
      openCitySocket("ws://example.test/city/ab/ws", "ab")
    } finally {
      globalThis.WebSocket = prev
    }
    expect(calls.length).toBe(2)
    expect(calls[1]).toEqual([sessionWsProtocol("ab")])
  })

  it("node socket sends Authorization and a protocol-only socket is the same session", async () => {
    const sniffed: { authorization: string; protocol: string }[] = []
    const probe = createServer()
    probe.on("upgrade", (req, socket) => {
      sniffed.push({
        authorization: typeof req.headers.authorization === "string" ? req.headers.authorization : "",
        protocol: typeof req.headers["sec-websocket-protocol"] === "string" ? req.headers["sec-websocket-protocol"] : "",
      })
      socket.destroy()
    })
    await new Promise<void>((resolve) => {
      probe.listen(0, listenBind, () => resolve())
    })
    closers.push({
      close: () =>
        new Promise((resolve, reject) => {
          probe.close((err) => (err === undefined ? resolve() : reject(err)))
        }),
    })
    const addr = probe.address()
    if (addr === null || typeof addr === "string") throw new Error("listen")
    const sock = openCitySocket("ws://" + listenBind + ":" + addr.port.toString() + "/city/ab/ws", "ab")
    await new Promise<void>((resolve) => {
      sock.addEventListener("close", () => resolve())
      sock.addEventListener("error", () => resolve())
    })
    sock.close()
    const row = sniffed[0]
    expect(row !== undefined && row.authorization).toBe("Bearer ab")
    expect(row !== undefined && row.protocol).toBe(sessionWsProtocol("ab"))

    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    const auth = await demoAuth(host)
    const other = await demoAuth(host)
    const url = "ws://" + listenBind + ":" + api.port.toString() + applyPath(wsTemplate, "city_id", auth.cityId)
    const opened = new WebSocket(url, [sessionWsProtocol(auth.sessionId)])
    await new Promise<void>((resolve, reject) => {
      opened.addEventListener("open", () => resolve())
      opened.addEventListener("error", () => reject(new Error("protocol socket failed")))
    })
    const pulse = new Promise<string>((resolve) => {
      opened.addEventListener("message", (ev) => {
        const raw = ev.data
        if (typeof raw === "string") resolve(raw)
        else if (raw instanceof Uint8Array) resolve(fromUtf8(raw))
        else if (raw instanceof ArrayBuffer) resolve(fromUtf8(new Uint8Array(raw)))
      })
    })
    api.pulse()
    const body = asObj(parseJson(await pulse))
    expect(asText(body["pack_hash"])).toBe(host.ctx.hash)
    opened.close()
    const foreign = new WebSocket(
      "ws://" + listenBind + ":" + api.port.toString() + applyPath(wsTemplate, "city_id", auth.cityId),
      [sessionWsProtocol(other.sessionId)],
    )
    const denied = await new Promise<string>((resolve) => {
      foreign.addEventListener("open", () => resolve("opened"))
      foreign.addEventListener("error", () => resolve("denied"))
    })
    expect(denied).toBe("denied")
    const junk = new WebSocket(url, ["Bearer.zz"])
    const junked = await new Promise<string>((resolve) => {
      junk.addEventListener("open", () => resolve("opened"))
      junk.addEventListener("error", () => resolve("denied"))
    })
    expect(junked).toBe("denied")
  })
})
