import { afterEach, describe, expect, it } from "vitest"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { channelMap, listenBind, listenPorts, packHash, readyTemplate, samplerPeriodMs, wsHeartbeatMs, wsTemplate } from "@corporator/protocol"
import { listenReady } from "../../sampler/src/ready.ts"
import { listenReady as listenBuyback } from "../../buyback/src/ready.ts"
import { listenReady as listenAttestor } from "../../attestor/src/ready.ts"
import { asEngineDict, bootHost, demoAuth } from "./harness.ts"
import { listenApi } from "../src/listen.ts"
import { applyTemplate } from "../src/pack_ctx.ts"
import { tickOnce, catchUpOnce } from "../src/scheduler.ts"
import { asBigint, asObj, asText } from "../src/values.ts"
import { listBytes } from "../src/store.ts"
import { clipOfflineHours } from "@corporator/engine"

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

async function getJson(
  url: string,
  headers: { readonly [name: string]: string } = {},
): Promise<{ readonly status: number; readonly body: ReturnType<typeof parseJson> }> {
  const res = await fetch(url, { headers })
  const buf = new Uint8Array(await res.arrayBuffer())
  return { status: res.status, body: parseJson(fromUtf8(buf)) }
}

describe("l2 process hosts", () => {
  it("process_listens", async () => {
    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    closers.push(await listenReady(host.ctx.hash, listenPorts.sampler))
    closers.push(await listenBuyback(host.ctx.hash, listenPorts.buyback))
    closers.push(await listenAttestor(host.ctx.hash, listenPorts.attestor))
    const auth = await demoAuth(host)
    const statePath = applyTemplate(host.ctx.stateTemplate, "city_id", auth.cityId)
    const got = await getJson(origin(api.port) + statePath, auth.headers)
    expect(got.status).toBe(Number(host.ctx.httpOk))
    const body = asObj(got.body)
    expect(asText(body["pack_hash"])).toBe(host.ctx.hash)
    expect(asText(body["pack_hash"])).toBe(packHash)
    expect("city_time" in body).toBe(true)
    for (const port of [listenPorts.sampler, listenPorts.buyback, listenPorts.attestor]) {
      const ready = await getJson(origin(port) + readyTemplate)
      expect(ready.status).toBe(Number(host.ctx.httpOk))
      expect(asText(asObj(ready.body)["pack_hash"])).toBe(host.ctx.hash)
    }
  })

  it("ws_heartbeat_derived", async () => {
    expect(3n * wsHeartbeatMs <= samplerPeriodMs).toBe(true)
    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    const auth = await demoAuth(host)
    const path = applyTemplate(wsTemplate, "city_id", auth.cityId)
    const ws = new WebSocket("ws://" + listenBind + ":" + api.port.toString() + path, {
      headers: { authorization: auth.headers.authorization },
    })
    const pulses: unknown[] = []
    const patches: { readonly [key: string]: unknown }[] = []
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve())
      ws.addEventListener("error", () => reject(new Error("ws error")))
    })
    ws.addEventListener("message", (ev) => {
      pulses.push(1)
      const raw = ev.data
      let text = ""
      if (typeof raw === "string") text = raw
      else if (raw instanceof Uint8Array) text = fromUtf8(raw)
      else if (raw instanceof ArrayBuffer) text = fromUtf8(new Uint8Array(raw))
      if (text.length === 0) return
      const body = asObj(parseJson(text))
      if (typeof body["channel"] === "string") patches.push(body)
    })
    await new Promise<void>((resolve) => {
      const done = (): void => {
        if (pulses.length >= 3) resolve()
      }
      ws.addEventListener("message", done)
      api.pulse()
      api.pulse()
      api.pulse()
    })
    expect(pulses.length >= 3).toBe(true)
    await tickOnce(host)
    const deadline = Date.now() + 1000
    while (patches.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    ws.close()
    expect(patches.length > 0).toBe(true)
    const channels = new Set(patches.map((row) => asText(row["channel"])))
    expect(channels.has("clock")).toBe(false)
    expect(channels.has("tick")).toBe(true)
    for (const row of patches) {
      const sections = asObj(row["sections"])
      expect("clock" in sections).toBe(false)
      for (const id of Object.keys(sections)) {
        expect(channelMap[id as keyof typeof channelMap]).toBe(asText(row["channel"]))
      }
      if (asText(row["channel"]) === "tick") {
        expect("aggregate.gdp" in sections).toBe(false)
        expect("tick.capital" in sections).toBe(true)
      }
    }
  })

  it("tick_scheduler_uses_city_time", async () => {
    const host = await bootHost()
    await tickOnce(host)
    const mid = asBigint(host.state["city_time"])
    const length = asBigint(host.ctx.cfg["tick_length_city_hours"])
    const anchor = asBigint(host.ctx.cfg["anchor_hour"])
    expect(mid).toBe(anchor)
    await tickOnce(host)
    const after = asBigint(host.state["city_time"])
    expect(after).toBe(mid + length)
    expect(after < 1000000000n).toBe(true)
    expect(host.attestLag).toBe(2n)
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    expect(asBigint(city["payout"]) >= 0n).toBe(true)
    const batched = await bootHost()
    await catchUpOnce(batched, undefined, 2n)
    expect(asBigint(batched.state["city_time"])).toBe(after)
    expect(asBigint(batched.state["tick_index"])).toBe(asBigint(host.state["tick_index"]))
    expect(asBigint(batched.state["fund"])).toBe(asBigint(host.state["fund"]))
    const clipped = await bootHost()
    await catchUpOnce(clipped, undefined, 100n)
    const capHours = clipOfflineHours(
      asBigint(clipped.ctx.cfg["offline_cap"]),
      asBigint(clipped.state["offline_cap_hours"]),
      asBigint(clipped.ctx.cfg["offline_hard_cap"], 18n),
    )
    const stored = await listBytes(clipped.store, "tick_inputs", "a:")
    expect(BigInt(stored.length)).toBe(length === 0n ? 0n : capHours / length)
    expect(capHours <= asBigint(clipped.ctx.cfg["offline_hard_cap"], 18n)).toBe(true)
  })
})
