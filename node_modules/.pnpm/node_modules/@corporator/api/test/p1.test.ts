import { describe, expect, it } from "vitest"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { authSessionTemplate, codes, transportHttp } from "@corporator/protocol"
import { applyTemplate } from "../src/pack_ctx.ts"
import { getBytes } from "../src/store.ts"
import { asEngineDict, asObj, asText } from "../src/values.ts"
import { asBigint, bootHost, bootHostOn, demoAuth, makeInputs, openPglite } from "./harness.ts"

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function commandBody(intent: string, city: string, cityTime: bigint): Uint8Array {
  return canonical({ intent_id: intent, city_id: city, expected_city_time: cityTime })
}

const IDENTITY_MARKERS = ["owner_address", "session_id", "player_address", "wallet_address", "account_address"]

describe.sequential("P1 construction", () => {
  it("command_without_session_refused", async () => {
    const host = await bootHost()
    const t = asBigint(host.state["city_time"])
    const naked = await host.handle("POST", "/command/claim_prize", commandBody("n1", "a", t))
    expect(naked.status).toBe(transportHttp.API_UNAUTHORIZED)
    expect(bodyCode(naked.body)).toBe(codes.API_UNAUTHORIZED)
    const statePath = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const read = await host.handle("GET", statePath, new Uint8Array())
    expect(read.status).toBe(host.ctx.httpOk)
    const auth = await demoAuth(host)
    const ok = await host.handle("POST", "/command/claim_prize", commandBody("n2", "a", t), auth.headers)
    expect(bodyCode(ok.body)).toBe(codes.DEMO_NO_PRIZE)
  })

  it("city_id_comes_from_session", async () => {
    const host = await bootHost()
    const t = asBigint(host.state["city_time"])
    const auth = await demoAuth(host)
    expect(auth.cityId).toBe("a")
    const res = await host.handle(
      "POST",
      "/command/claim_prize",
      commandBody("x1", "zzz", t),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.DEMO_NO_PRIZE)
    expect(bodyCode(res.body)).not.toBe(codes.API_MALFORMED)
    const cities = asEngineDict(host.state["cities"])
    expect("zzz" in cities).toBe(false)
    expect("a" in cities).toBe(true)
  })

  it("demo_session_has_no_address", async () => {
    const host = await bootHost()
    const res = await host.handle("POST", authSessionTemplate, canonical({ account_kind: "demo" }))
    expect(res.status).toBe(host.ctx.httpOk)
    const obj = asObj(parseJson(fromUtf8(res.body)))
    expect(asText(obj["account_kind"])).toBe("demo")
    expect("address" in obj).toBe(false)
    const sessionId = asText(obj["session_id"])
    expect(sessionId.length > 0).toBe(true)
    const row = await getBytes(host.store, "sessions", sessionId)
    expect(row).toBeDefined()
    if (row === undefined) return
    const payload = asObj(parseJson(fromUtf8(row)))
    expect(asText(payload["account_kind"])).toBe("demo")
    expect("address" in payload).toBe(false)
  })

  it("identity_absent_from_record_bytes", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const ran = await host.stepTick(makeInputs(host.ctx.cfg, 0n))
    const blobs = [ran.headerBytes, ...ran.recordBytes]
    expect(blobs.length > 0).toBe(true)
    for (const blob of blobs) {
      const text = fromUtf8(blob)
      for (const name of IDENTITY_MARKERS) {
        expect(text.includes(name), name).toBe(false)
      }
    }
    const hdr = asObj(parseJson(fromUtf8(ran.headerBytes)))
    expect(asBigint(hdr["layout_version"])).toBe(1n)
    expect("session_id" in hdr).toBe(false)
    expect(asText(hdr["city_id"]).length > 0).toBe(true)
    expect(auth.sessionId.length > 0).toBe(true)
  })

  it("rate_limit_survives_restart", async () => {
    const store = await openPglite()
    const host1 = await bootHostOn(store)
    const auth = await demoAuth(host1)
    const t = asBigint(host1.state["city_time"])
    let i = 0n
    let last = ""
    while (i <= host1.ctx.rateLimit) {
      const res = await host1.handle(
        "POST",
        "/command/noop",
        commandBody("r" + i.toString(), "a", t),
        auth.headers,
      )
      last = bodyCode(res.body)
      i += 1n
    }
    expect(last).toBe(codes.API_RATE_LIMITED)
    const host2 = await bootHostOn(store)
    const again = await host2.handle(
      "POST",
      "/command/noop",
      commandBody("r-after", "a", t),
      auth.headers,
    )
    expect(bodyCode(again.body)).toBe(codes.API_RATE_LIMITED)
  })
})
