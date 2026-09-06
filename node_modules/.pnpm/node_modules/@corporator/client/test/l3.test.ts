import { afterEach, describe, expect, it } from "vitest"
import { atPath, fromUtf8, parseJson } from "@corporator/contentpack"
import {
  commandTemplate,
  codes,
  listenBind,
  packHash,
  packTemplate,
  stateTemplate,
} from "@corporator/protocol"
import {
  applyPath,
  bootFromHost,
  nextIntentId,
  openDemoSession,
  postCommand,
  snapshotFromEnvelope,
} from "../src/index.ts"
import { asBigint, asEngineDict, asObj, bootHost, seedPlayerCapital } from "../../../services/api/test/harness.ts"
import { listenApi } from "../../../services/api/src/listen.ts"

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

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(codes.API_PACK_STALE)
  return new Uint8Array(await res.arrayBuffer())
}

async function post(
  url: string,
  body: Uint8Array,
  headers: { readonly [name: string]: string } = {},
): Promise<{ readonly status: number; readonly body: Uint8Array }> {
  const res = await fetch(url, { method: "POST", body, headers: { ...headers } })
  return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) }
}

describe("l3 client on host", () => {
  it("client_boot_requires_city_time", async () => {
    const missing = await bootFromHost({
      origin: origin(1n),
      packHash,
      cityId: "a",
      fetchBytes: async () => {
        throw new Error(codes.API_PACK_STALE)
      },
    })
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.code).toBe(codes.API_PACK_STALE)

    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    const base = origin(api.port)
    const packPath = applyPath(packTemplate, "pack_hash", packHash)
    const noTime = await bootFromHost({
      origin: base,
      packHash,
      cityId: "a",
      fetchBytes: async (url) => {
        if (url.includes("/pack/")) return fetchBytes(base + packPath)
        return new TextEncoder().encode('{"pack_hash":"00"}')
      },
    })
    expect(noTime.ok).toBe(false)
    if (!noTime.ok) expect(noTime.code).toBe(codes.API_PACK_STALE)

    const ok = await bootFromHost({
      origin: base,
      packHash,
      cityId: "a",
      fetchBytes,
    })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(ok.cityTime).toBe(ok.snapshot.cityTime)
    expect(ok.accountKind).toBe("demo")
  })

  it("command_posts_intent", async () => {
    const host = await bootHost()
    const hireRow = asObj(atPath(host.ctx.pack, ["generated", "balance", "hire_cost", "1"]))
    const hireCost = asBigint(hireRow["cost"])
    seedPlayerCapital(host, "a", hireCost)
    const capBefore = asBigint(asEngineDict(asEngineDict(host.state["cities"])["a"])["capital"])
    expect(capBefore >= hireCost).toBe(true)
    const api = await listenApi(host, 0n)
    closers.push(api)
    const base = origin(api.port)
    const session = await openDemoSession(base, post)
    expect(session).toBeDefined()
    if (session === undefined) return
    const boot = await bootFromHost({ origin: base, packHash, cityId: session.cityId, fetchBytes })
    expect(boot.ok).toBe(true)
    if (!boot.ok) return
    expect(boot.snapshot.capital).toBe(capBefore)
    const t = boot.cityTime
    const noTile = await postCommand({
      origin: base,
      effect: "build",
      commandTemplate,
      cityId: session.cityId,
      sessionId: session.sessionId,
      intentId: nextIntentId(session.cityId, t, 0n),
      expectedCityTime: t,
      post,
    })
    expect(asObj(parseJson(fromUtf8(noTile.body)))["code"]).toBe(codes.API_MALFORMED)
    const hire = await postCommand({
      origin: base,
      effect: "hire",
      commandTemplate,
      cityId: session.cityId,
      sessionId: session.sessionId,
      intentId: nextIntentId(session.cityId, t, 1n),
      expectedCityTime: t,
      post,
    })
    const hireJson = asObj(parseJson(fromUtf8(hire.body)))
    expect("code" in hireJson && hireJson["code"] === codes.API_MALFORMED).toBe(false)
    const afterHire = snapshotFromEnvelope(
      parseJson(fromUtf8(await fetchBytes(base + applyPath(stateTemplate, "city_id", session.cityId)))),
    )
    expect(afterHire.capital < capBefore).toBe(true)
    const built = await postCommand({
      origin: base,
      effect: "build",
      commandTemplate,
      cityId: session.cityId,
      sessionId: session.sessionId,
      intentId: nextIntentId(session.cityId, t, 2n),
      expectedCityTime: t,
      extra: { tile: { q: 0n, r: 0n }, building_id: "workshop" },
      post,
    })
    const buildJson = asObj(parseJson(fromUtf8(built.body)))
    expect(buildJson["code"]).toBe(codes.API_MALFORMED)
    const afterBuild = snapshotFromEnvelope(
      parseJson(fromUtf8(await fetchBytes(base + applyPath(stateTemplate, "city_id", session.cityId)))),
    )
    expect(afterBuild.capital).toBe(afterHire.capital)
  })
})
