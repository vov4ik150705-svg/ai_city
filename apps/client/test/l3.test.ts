import { afterEach, describe, expect, it } from "vitest"
import { atPath, canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import {
  commandRoutes,
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
  createLiveAdapter,
  emptySnapshot,
  HUD_ACTION_MAP,
  isLiveMutationEffect,
  LIVE_MUTATION_EFFECTS,
  nextIntentId,
  scopedIntentId,
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

function liveEffect(effect: string | undefined): boolean {
  if (effect === undefined) return false
  return isLiveMutationEffect(effect)
}

function hasCommandRoute(effect: string | undefined): boolean {
  if (effect === undefined) return false
  const path = "/command/" + effect
  for (const row of commandRoutes) {
    if (row === path) return true
  }
  return false
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
    expect([...LIVE_MUTATION_EFFECTS]).toEqual(["build", "hire", "set_objective"])
    for (const row of HUD_ACTION_MAP) {
      if (row.support === "live") {
        expect(liveEffect(row.effect)).toBe(true)
        expect(hasCommandRoute(row.effect)).toBe(true)
      }
      if (row.support === "refusal-only") {
        expect(hasCommandRoute(row.effect)).toBe(true)
        expect(liveEffect(row.effect)).toBe(false)
      }
      if (row.support === "unsupported") {
        expect(row.effect).toBeUndefined()
        expect(hasCommandRoute(row.intent)).toBe(false)
      }
    }
    for (const path of commandRoutes) {
      const effect = path.slice("/command/".length)
      expect(HUD_ACTION_MAP.some((row) => row.effect === effect)).toBe(true)
    }
    const hireMap = HUD_ACTION_MAP.find((row) => row.intent === "hire")
    expect(hireMap?.effect).toBe("hire")
    expect(hireMap?.support).toBe("live")
    const researchMap = HUD_ACTION_MAP.find((row) => row.intent === "research_start")
    expect(researchMap?.support).toBe("unsupported")
    expect(researchMap?.effect).toBeUndefined()

    const originBase = "http://adapter.test"
    const silentPost = async () => {
      throw new Error(codes.API_MALFORMED)
    }
    let postCalls = 0
    let fetchCalls = 0
    let capital = 100n
    const adapter = createLiveAdapter({
      origin: originBase,
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: silentPost,
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => {
        fetchCalls += 1
        capital = 50n
        return { ...emptySnapshot(), cityTime: 7n, capital }
      },
      postCommand: async (args) => {
        postCalls += 1
        void args
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const blocked = await adapter.dispatch({ kind: "research_start", axisId: "grid" })
    expect(blocked.kind).toBe("unavailable")
    if (blocked.kind === "unavailable") {
      expect(blocked.reason).toBe("no-live-route")
      expect(blocked.code).toBe(codes.FEATURE_NOT_IN_V1)
    }
    expect(postCalls).toBe(0)
    expect(fetchCalls).toBe(0)
    expect((await adapter.dispatch({ kind: "present_voucher" })).kind).toBe("unavailable")
    expect((await adapter.dispatch({ kind: "assign" })).kind).toBe("unavailable")
    expect((await adapter.dispatch({ kind: "unstake" })).kind).toBe("unavailable")
    expect((await adapter.dispatch({ kind: "navigate", target: "bank" })).kind).toBe("local")
    expect(postCalls).toBe(0)

    const sent: {
      readonly effect: string
      readonly extra: unknown
      readonly intentId: string
      readonly expectedCityTime: bigint
    }[] = []
    const live = createLiveAdapter({
      origin: originBase,
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: silentPost,
      cityTime: () => 7n,
      nextSeq: () => 3n,
      fetchSnapshot: async () => {
        fetchCalls += 1
        capital = 40n
        return { ...emptySnapshot(), cityTime: 7n, capital }
      },
      postCommand: async (args) => {
        postCalls += 1
        sent.push({
          effect: args.effect,
          extra: args.extra,
          intentId: args.intentId,
          expectedCityTime: args.expectedCityTime,
        })
        return { status: 200, body: canonical({ city_time: 7n, effect: args.effect }) }
      },
    })
    const hired = await live.dispatch({ kind: "hire" })
    expect(hired.kind).toBe("applied")
    expect(sent.length).toBe(1)
    expect(sent[0]?.effect).toBe("hire")
    expect(sent[0]?.extra).toBeUndefined()
    expect(sent[0]?.intentId).toBe(scopedIntentId("a", "s", 7n, 3n))
    expect(sent[0]?.expectedCityTime).toBe(7n)
    if (hired.kind === "applied") expect(hired.snapshot.capital).toBe(40n)
    expect(capital).toBe(40n)

    fetchCalls = 0
    const held = capital
    const rejected = createLiveAdapter({
      origin: originBase,
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: silentPost,
      cityTime: () => 7n,
      nextSeq: () => 4n,
      fetchSnapshot: async () => {
        fetchCalls += 1
        capital = 1n
        return { ...emptySnapshot(), cityTime: 7n, capital }
      },
      postCommand: async (args) => {
        postCalls += 1
        sent.push({
          effect: args.effect,
          extra: args.extra,
          intentId: args.intentId,
          expectedCityTime: args.expectedCityTime,
        })
        return {
          status: 409,
          body: canonical({ code: codes.NOT_ENOUGH_CAPITAL, city_time: 7n }),
        }
      },
    })
    const failed = await rejected.dispatch(
      { kind: "build", buildingId: "workshop" },
      { building_id: "workshop", tile_x: 1n, tile_y: 2n },
    )
    expect(failed.kind).toBe("failed")
    if (failed.kind === "failed") {
      expect(failed.code).toBe(codes.NOT_ENOUGH_CAPITAL)
      expect(failed.retryable).toBe(false)
      expect(failed.httpStatus).toBe(409)
      expect(failed.effect).toBe("build")
    }
    expect(fetchCalls).toBe(0)
    expect(capital).toBe(held)
    const last = sent[sent.length - 1]
    expect(last?.effect).toBe("build")
    expect(last?.extra).toEqual({ building_id: "workshop", tile_x: 1n, tile_y: 2n })

    const host = await bootHost()
    const hireRow = asObj(atPath(host.ctx.pack, ["generated", "balance", "hire_cost", "1"]))
    const hireCost = asBigint(hireRow["cost"])
    const costs = asObj(atPath(host.ctx.pack, ["generated", "balance", "level_cost"]))
    const workshopLevels = costs["workshop"]
    expect(Array.isArray(workshopLevels)).toBe(true)
    if (!Array.isArray(workshopLevels) || workshopLevels[0] === undefined) return
    const workshopCost = asBigint(workshopLevels[0])
    seedPlayerCapital(host, "a", hireCost + workshopCost)
    const capBefore = asBigint(asEngineDict(asEngineDict(host.state["cities"])["a"])["capital"])
    expect(capBefore >= hireCost + workshopCost).toBe(true)
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
    const noBuildingId = await postCommand({
      origin: base,
      effect: "build",
      commandTemplate,
      cityId: session.cityId,
      sessionId: session.sessionId,
      intentId: nextIntentId(session.cityId, t, 0n),
      expectedCityTime: t,
      post,
    })
    expect(asObj(parseJson(fromUtf8(noBuildingId.body)))["code"]).toBe(codes.API_MALFORMED)
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
      extra: { building_id: "workshop" },
      post,
    })
    const buildJson = asObj(parseJson(fromUtf8(built.body)))
    expect("code" in buildJson && buildJson["code"] === codes.API_MALFORMED).toBe(false)
    expect(buildJson["effect"]).toBe("build")
    const afterBuild = snapshotFromEnvelope(
      parseJson(fromUtf8(await fetchBytes(base + applyPath(stateTemplate, "city_id", session.cityId)))),
    )
    expect(afterBuild.capital < afterHire.capital).toBe(true)
  })
})
