import { describe, expect, it } from "vitest"
import { bytesEq, canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { channelMap, codes, commandRoutes } from "@corporator/protocol"
import { applyTemplate, commitPathsFromPack } from "../src/pack_ctx.ts"
import { partitionsSources } from "../src/channels.ts"
import { channelPatches } from "../src/ws_patch.ts"
import { readinessRequiresPack } from "../src/readiness.ts"
import { isPackHashHalt, replayFromSnapshot, replayStored } from "../src/index.ts"
import { putJson } from "../src/store.ts"
import { asObj, asText, asEngineDict, walk } from "../src/values.ts"
import { asBigint, bootHost, demoAuth, makeInputs, packBytes, seedPlayerCapital } from "./harness.ts"

function expectBytes(got: readonly Uint8Array[], want: readonly Uint8Array[]): void {
  expect(got.length).toBe(want.length)
  for (let i = 0; i < got.length; i += 1) {
    const a = got[i]
    const b = want[i]
    if (a === undefined || b === undefined) {
      expect.fail("missing blob")
      return
    }
    expect(bytesEq(a, b)).toBe(true)
  }
}

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function cmdBody(intent: string, city: string, cityTime: bigint): Uint8Array {
  return canonical({ intent_id: intent, city_id: city, expected_city_time: cityTime })
}

describe.sequential("C3 construction", () => {
  it("replay_from_storage", async () => {
    const host = await bootHost()
    const cityId = "a"
    const n = host.ctx.ticksDay
    const recs: Uint8Array[] = []
    const hdrs: Uint8Array[] = []
    let i = 0n
    while (i < n) {
      const ran = await host.stepTick(makeInputs(host.ctx.cfg, i))
      hdrs.push(ran.headerBytes)
      for (const blob of ran.recordBytes) recs.push(blob)
      i += 1n
    }
    const replayed = await replayStored(host.ctx, host.store, structuredClone(host.genesis), cityId)
    expectBytes(replayed.headers, hdrs)
    expectBytes(replayed.records, recs)
    let crossed = false
    try {
      await host.store.query(
        "INSERT INTO demo_wallet_transfers (id, from_kind, to_kind) VALUES ($1, $2, $3)",
        ["edge", "demo", "wallet"],
      )
      crossed = true
    } catch {
      crossed = false
    }
    expect(crossed).toBe(false)
    await host.store.query(
      "INSERT INTO demo_wallet_transfers (id, from_kind, to_kind) VALUES ($1, $2, $3)",
      ["ok", "demo", "demo"],
    )
  })

  it("snapshot_tail_equals_full_replay", async () => {
    const host = await bootHost()
    const cityId = "a"
    const n = host.ctx.ticksDay
    const after: { cityTime: bigint; recs: Uint8Array[] }[] = []
    let snapAt: bigint | undefined
    let i = 0n
    while (i < n) {
      const inputs = makeInputs(host.ctx.cfg, i)
      const ran = await host.stepTick(inputs)
      const cityTime = asBigint(inputs["city_time"])
      after.push({ cityTime, recs: [...ran.recordBytes] })
      if (asBigint(ran.state["hour"]) === 0n) snapAt = cityTime
      i += 1n
    }
    expect(snapAt).toBeDefined()
    const cut = snapAt ?? 0n
    const want: Uint8Array[] = []
    for (const row of after) {
      if (row.cityTime > cut) {
        for (const blob of row.recs) want.push(blob)
      }
    }
    const tail = await replayFromSnapshot(host.ctx, host.store, structuredClone(host.genesis), cityId, cut)
    expectBytes(tail.records, want)
  })

  it("intent_replay_once", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const t = asBigint(host.state["city_time"])
    const body = cmdBody("i1", "a", t)
    const first = await host.handle("POST", "/command/noop", body, auth.headers)
    expect(bodyCode(first.body)).toBe(codes.FEATURE_NOT_IN_V1)
    const fund = asBigint(host.state["fund"])
    const second = await host.handle("POST", "/command/noop", body, auth.headers)
    expect(second.status).toBe(first.status)
    expect(bytesEq(second.body, first.body)).toBe(true)
    expect(bodyCode(second.body)).toBe(codes.FEATURE_NOT_IN_V1)
    expect(asBigint(host.state["fund"])).toBe(fund)
    const hireCost = asBigint(asObj(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1"]))["cost"])
    seedPlayerCapital(host, auth.cityId, hireCost + hireCost)
    const city = asEngineDict(asEngineDict(host.state["cities"])[auth.cityId])
    const hireBody = canonical({ intent_id: "ih1", expected_city_time: t })
    const [left, right] = await Promise.all([
      host.handle("POST", "/command/hire", hireBody, auth.headers),
      host.handle("POST", "/command/hire", hireBody, auth.headers),
    ])
    expect(left.status).toBe(host.ctx.httpOk)
    expect(right.status).toBe(left.status)
    expect(bytesEq(left.body, right.body)).toBe(true)
    const agents = city["agents"]
    expect(Array.isArray(agents) ? agents.length : 0).toBe(1)
  })

  it("stale_expected_city_time", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const now = asBigint(host.state["city_time"])
    const stale = now === 0n ? 1n : 0n
    const res = await host.handle("POST", "/command/noop", cmdBody("s1", "a", stale), auth.headers)
    expect(bodyCode(res.body)).toBe(host.ctx.staleCode)
    expect(res.status).toBe(host.ctx.domainHttp)
  })

  it("rate_limit_derived", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const params = asObj(walk(host.ctx.pack, ["sections", "api", "params"]))
    expect("command_rate_limit_per_city_tick" in params).toBe(false)
    const t = asBigint(host.state["city_time"])
    let i = 0n
    let last = codes.FEATURE_NOT_IN_V1
    while (i <= host.ctx.rateLimit) {
      const res = await host.handle("POST", "/command/noop", cmdBody("r" + i.toString(), "a", t), auth.headers)
      last = bodyCode(res.body)
      i += 1n
    }
    expect(last).toBe(codes.API_RATE_LIMITED)
  })

  it("endpoint_bijection", async () => {
    const host = await bootHost()
    const fromPack = commitPathsFromPack(host.ctx)
    expect([...host.ctx.commandPaths].sort().join("\n")).toBe([...fromPack].sort().join("\n"))
    expect([...commandRoutes].sort().join("\n")).toBe([...fromPack].sort().join("\n"))
    const res = await host.handle("GET", applyTemplate(host.ctx.packTemplate, "pack_hash", host.ctx.hash), new Uint8Array())
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bytesEq(res.body, packBytes())).toBe(true)
  })

  it("refusal_matrix_matches_t9", async () => {
    const host = await bootHost()
    const want = host.ctx.refusals["withdraw"] ?? []
    const raw = walk(host.ctx.pack, ["generated", "api", "endpoint_refusals"])
    const authored = asObj(raw)["withdraw"]
    const fromPack: string[] = []
    if (Array.isArray(authored)) {
      for (const item of authored) {
        if (typeof item === "string") fromPack.push(item)
      }
    }
    expect(want.join("\n")).toBe(fromPack.join("\n"))
  })

  it("stub_endpoint_no_spend", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const fund = asBigint(host.state["fund"])
    const t = asBigint(host.state["city_time"])
    const prize = await host.handle("POST", "/command/claim_prize", cmdBody("p1", "a", t), auth.headers)
    expect(bodyCode(prize.body)).not.toBe(codes.FEATURE_NOT_IN_V1)
    expect(bodyCode(prize.body)).toBe(codes.DEMO_NO_PRIZE)
    const noop = await host.handle("POST", "/command/noop", cmdBody("n1", "a", t), auth.headers)
    expect(bodyCode(noop.body)).toBe(codes.FEATURE_NOT_IN_V1)
    expect(asBigint(host.state["fund"])).toBe(fund)
  })

  it("channels_partition_state_sources", async () => {
    const host = await bootHost()
    expect(partitionsSources(host.channels)).toBe(true)
    const fromHub = [...host.channels.sourceIds()].sort()
    const fromPack = [...host.ctx.stateSources].sort()
    expect(fromHub.join("\n")).toBe(fromPack.join("\n"))
    for (const id of fromHub) {
      expect(host.channels.channelOf(id)).toBeDefined()
    }
  })

  it("clock_has_no_channel", async () => {
    const host = await bootHost()
    expect(host.channels.channelOf("clock")).toBeUndefined()
    expect("clock" in channelMap).toBe(false)
    expect(host.channels.hasChannel("clock")).toBe(false)
    const patches = channelPatches(host.ctx, host.state, "a", [])
    for (const row of patches) {
      expect(row.channel).not.toBe("clock")
      for (const id of Object.keys(row.sections)) {
        expect(channelMap[id as keyof typeof channelMap]).toBe(row.channel)
      }
    }
  })

  it("readiness_requires_pack", async () => {
    const host = await bootHost()
    expect(readinessRequiresPack(host.ctx)).toBe(true)
    const ok = await host.readiness()
    expect(ok.ready).toBe(true)
    expect(ok.pack_hash).toBe(host.ctx.hash)
    await putJson(host.store, "schema_migrations", "head", { version: ok.migration_version, pack_hash: "00" }, undefined)
    const bad = await host.readiness()
    expect(bad.ready).toBe(false)
  })

  it("invariants_all_metered", async () => {
    const host = await bootHost()
    const authored = asObj(walk(host.ctx.pack, ["sections", "arch", "metrics"]))
    expect(host.metrics.length).toBe(Object.keys(authored).length)
    for (const row of host.metrics) {
      expect(row.thresholdSrc.length > 0).toBe(true)
      expect(row.invariant.length > 0).toBe(true)
      expect(row.service.length > 0).toBe(true)
      const spec = asObj(authored[row.id] ?? {})
      expect("threshold" in spec).toBe(false)
      expect(row.threshold === undefined).toBe(false)
    }
  })

  it("services_do_not_block_tick", async () => {
    const host = await bootHost()
    for (const id of Object.keys(host.ctx.services)) {
      const spec = host.ctx.services[id]
      if (spec === undefined) continue
      if (id === "pack_gate") {
        expect(spec.failMode).toBe("closed")
        continue
      }
      expect(spec.failMode).toBe("open")
      expect(spec.blocksTick).toBe(0n)
    }
    let called = false
    await host.stepTick(makeInputs(host.ctx.cfg, 0n), {
      async submit(): Promise<undefined> {
        called = true
        throw new Error("ipfs")
      },
    })
    expect(called).toBe(true)
    try {
      await host.stepTick(makeInputs(host.ctx.cfg, 1n, { pack_hash: "00" }))
      expect.fail("PACK_HASH must halt")
    } catch (err) {
      expect(isPackHashHalt(err)).toBe(true)
    }
  })
})
