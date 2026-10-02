import { request } from "node:http"
import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { listenApi } from "../src/listen.ts"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { bootHost, seedPlayerCapital, type ApiHost } from "./harness.ts"

const ADDRESS = "0x" + "11".repeat(20)
const closers: { close(): Promise<void> }[] = []

afterEach(async () => {
  while (closers.length > 0) {
    const row = closers.pop()
    if (row === undefined) continue
    await row.close()
  }
})

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function readParam(pack: Json, key: string): bigint {
  const params = asObj(asObj(asObj(asObj(pack)["sections"])["api"])["params"])
  const row = params[key]
  if (row === undefined || row === null || typeof row !== "object" || Array.isArray(row)) return 0n
  return asBigint(asObj(row)["v"])
}

function cityCount(host: ApiHost): number {
  return Object.keys(asEngineDict(host.state["cities"])).length
}

async function postDemo(host: ApiHost) {
  return host.handle("POST", host.ctx.authSessionTemplate, canonical({ account_kind: "demo" }))
}

function postRaw(port: bigint, path: string, body: Buffer): Promise<void> {
  return new Promise((resolve) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port: Number(port),
        method: "POST",
        path,
        headers: { "content-length": body.length.toString() },
      },
      (res) => {
        res.resume()
        res.on("end", () => resolve())
      },
    )
    req.on("error", () => resolve())
    req.end(body)
  })
}

describe("PL14 demo window and body cap", () => {
  it("the demo after the window does not create a city", async () => {
    const host = await bootHost()
    const n = readParam(host.ctx.pack, "demo_new_per_window")
    let i = 0n
    while (i < n) {
      const ok = await postDemo(host)
      expect(bodyCode(ok.body)).toBe("")
      i += 1n
    }
    const before = cityCount(host)
    const extra = await postDemo(host)
    expect(bodyCode(extra.body)).toBe(codes.API_RATE_LIMITED)
    expect(cityCount(host)).toBe(before)
    await host.store.close()
  })

  it("a body over the pack limit does not reach handle", async () => {
    const host = await bootHost()
    const max = readParam(host.ctx.pack, "http_body_max_bytes")
    let calls = 0
    const inner = host.handle.bind(host)
    host.handle = (method, path, body, headers) => {
      calls += 1
      return inner(method, path, body, headers)
    }
    const api = await listenApi(host, 0n)
    closers.push(api)
    const path = host.ctx.authSessionTemplate
    if (max > 1n) {
      await postRaw(api.port, path, Buffer.alloc(1))
      expect(calls).toBe(1)
      await postRaw(api.port, path, Buffer.alloc(Number(max)))
      expect(calls).toBe(2)
    }
    await postRaw(api.port, path, Buffer.alloc(Number(max) + 1))
    expect(calls).toBe(max > 1n ? 2 : 0)
    await host.store.close()
  })

  it("demo limit 0 leaves an existing city and a wallet command", async () => {
    const host = await bootHost()
    const params = asObj(asObj(asObj(asObj(host.ctx.pack)["sections"])["api"])["params"])
    params["demo_new_per_window"] = { v: 0n, u: "count", src: "pl14-test", why: "zero forbids a new demo" }
    const before = cityCount(host)
    expect(asEngineDict(host.state["cities"])["a"] !== undefined).toBe(true)
    const refused = await postDemo(host)
    expect(bodyCode(refused.body)).toBe(codes.API_RATE_LIMITED)
    expect(cityCount(host)).toBe(before)
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["account_kind"] = "wallet"
    city["wallet"] = ADDRESS
    const expires = asBigint(host.state["city_time"]) + host.ctx.sessionTtlCity
    await putJson(
      host.store,
      "sessions",
      "pl14-wallet",
      { kind: "session", city_id: "a", account_kind: "wallet", expires_city_time: expires.toString() },
      "wallet",
    )
    const hire = asBigint(asObj(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1"]))["cost"])
    seedPlayerCapital(host, "a", hire)
    const hired = await host.handle(
      "POST",
      "/command/hire",
      canonical({
        intent_id: "pl14-hire",
        expected_city_time: asBigint(host.state["city_time"]),
        role: "engineer",
      }),
      { authorization: "Bearer pl14-wallet" },
    )
    expect(hired.status).toBe(host.ctx.httpOk)
    expect(bodyCode(hired.body)).toBe("")
    await host.store.close()
  })

  it("a nonce past the command rate is not stored", async () => {
    const host = await bootHost()
    const limit = host.ctx.rateLimit
    const kept: string[] = []
    let i = 0n
    while (i < limit) {
      const res = await host.handle(
        "POST",
        host.ctx.authNonceTemplate,
        canonical({ address: ADDRESS }),
      )
      const nonce = asText(asObj(parseJson(fromUtf8(res.body)))["nonce"])
      expect(nonce.length > 0).toBe(true)
      kept.push(nonce)
      i += 1n
    }
    const extra = await host.handle(
      "POST",
      host.ctx.authNonceTemplate,
      canonical({ address: ADDRESS }),
    )
    expect(bodyCode(extra.body)).toBe(codes.API_RATE_LIMITED)
    expect(asText(asObj(parseJson(fromUtf8(extra.body)))["nonce"]).length).toBe(0)
    expect(kept.length).toBe(Number(limit))
    const other = await host.handle(
      "POST",
      host.ctx.authNonceTemplate,
      canonical({ address: "0x" + "22".repeat(20) }),
    )
    expect(asText(asObj(parseJson(fromUtf8(other.body)))["nonce"]).length > 0).toBe(true)
    await host.store.close()
  })
})
