import { afterEach, describe, expect, it } from "vitest"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import {
  listenBind,
  listenPorts,
  packHash,
  readyTemplate,
  samplerPeriodMs,
  wsHeartbeatMs,
  wsTemplate,
} from "@corporator/protocol"
import { listenReady } from "../../sampler/src/ready.ts"
import { listenReady as listenBuyback } from "../../buyback/src/ready.ts"
import { listenReady as listenAttestor } from "../../attestor/src/ready.ts"
import { listenReady as listenLlm } from "../../llm/src/ready.ts"
import { asEngineDict, bootHost } from "./harness.ts"
import { listenApi } from "../src/listen.ts"
import { applyTemplate } from "../src/pack_ctx.ts"
import { tickOnce } from "../src/scheduler.ts"
import { asBigint, asObj, asText } from "../src/values.ts"

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

async function getJson(url: string): Promise<{ readonly status: number; readonly body: ReturnType<typeof parseJson> }> {
  const res = await fetch(url)
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
    closers.push(await listenLlm(host.ctx.hash, listenPorts.llm))
    const statePath = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const got = await getJson(origin(api.port) + statePath)
    expect(got.status).toBe(Number(host.ctx.httpOk))
    const body = asObj(got.body)
    expect(asText(body["pack_hash"])).toBe(host.ctx.hash)
    expect(asText(body["pack_hash"])).toBe(packHash)
    expect("city_time" in body).toBe(true)
    for (const port of [listenPorts.sampler, listenPorts.buyback, listenPorts.attestor, listenPorts.llm]) {
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
    const path = applyTemplate(wsTemplate, "city_id", "a")
    const ws = new WebSocket("ws://" + listenBind + ":" + api.port.toString() + path)
    const pulses: unknown[] = []
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve())
      ws.addEventListener("error", () => reject(new Error("ws error")))
    })
    await new Promise<void>((resolve) => {
      ws.addEventListener("message", () => {
        pulses.push(1)
        if (pulses.length >= 3) resolve()
      })
      api.pulse()
      api.pulse()
      api.pulse()
    })
    ws.close()
    expect(pulses.length >= 3).toBe(true)
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
  })
})
