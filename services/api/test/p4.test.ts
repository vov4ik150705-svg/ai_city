import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { bytesEq, canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes, readyTemplate } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { listenApi } from "../src/listen.ts"
import { replayStored, restoreLiveState } from "../src/tick_host.ts"
import { tickIfWriter, tickOnce } from "../src/scheduler.ts"
import { listBytes, putBytes } from "../src/store.ts"
import { pgTickLock } from "../src/tick_lock.ts"
import { asEngineDict, asObj, asText, bootHost, bootHostOn, demoAuth, openPglite, seedPlayerCapital } from "./harness.ts"
import { asBigint, walk } from "../src/values.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function composeProd(): string {
  return readFileSync(join(repo, "deploy/compose.prod.yaml"), "utf8")
}

function composeDev(): string {
  return readFileSync(join(repo, "deploy/compose.yaml"), "utf8")
}

function dockerfile(): string {
  return readFileSync(join(repo, "deploy/Dockerfile"), "utf8")
}

function runtimeStage(text: string): string {
  const matches = [...text.matchAll(/^FROM .+$/gm)]
  const last = matches[matches.length - 1]
  if (last === undefined || last.index === undefined) return ""
  return text.slice(last.index)
}

describe.sequential("P4 construction", () => {
  it("prod_profile_has_no_source_mount", async () => {
    expect(existsSync(join(repo, "deploy/compose.prod.yaml"))).toBe(true)
    const prod = composeProd()
    const dev = composeDev()
    expect(dev.includes("..:/app")).toBe(true)
    expect(prod.includes("..:/app")).toBe(false)
    expect(prod.includes(".:/app")).toBe(false)
    expect(prod.includes("\n  migrate:")).toBe(true)
    expect(prod.includes("corporator:${PACK_HASH}")).toBe(true)
    expect(prod.includes("healthcheck:")).toBe(true)
    expect(prod.includes("restart:")).toBe(true)
    const runtime = runtimeStage(dockerfile())
    expect(runtime.includes("USER node")).toBe(true)
    expect(runtime.includes("content/")).toBe(false)
    expect(runtime.includes("/app/pack.json")).toBe(true)
    const host = await bootHost()
    const listening = await listenApi(host, 0n)
    const res = await fetch("http://127.0.0.1:" + listening.port.toString() + readyTemplate)
    const csp = res.headers.get("content-security-policy") ?? ""
    expect(csp.includes("default-src 'self'")).toBe(true)
    expect(csp.includes("unsafe-inline")).toBe(false)
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    const body = asObj(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))))
    expect(asText(body["pack_hash"])).toBe(host.ctx.hash)
    expect(body["migration_version"] === undefined).toBe(false)
    await listening.close()
  })

  it("restore_replay_matches_origin", async () => {
    const originHost = await bootHost()
    await tickOnce(originHost)
    await tickOnce(originHost)
    const dumped = await listBytes(originHost.store, "tick_inputs", "a:")
    expect(dumped.length > 0).toBe(true)
    const originReplay = await replayStored(originHost.ctx, originHost.store, originHost.genesis, "a")
    const store = await openPglite()
    const restored = await bootHostOn(store)
    for (const row of dumped) {
      await putBytes(store, "tick_inputs", row.id, row.payload, undefined)
    }
    const replayed = await replayStored(restored.ctx, store, restored.genesis, "a")
    expect(replayed.headers.length).toBe(originReplay.headers.length)
    for (let i = 0; i < originReplay.headers.length; i += 1) {
      const a = originReplay.headers[i]
      const b = replayed.headers[i]
      if (a === undefined || b === undefined) {
        expect.fail("missing header")
        return
      }
      expect(bytesEq(a, b)).toBe(true)
    }
    restored.state = await restoreLiveState(restored.ctx, store, restored.genesis)
    expect(asBigint(restored.state["city_time"])).toBe(asBigint(originHost.state["city_time"]))
    expect(asBigint(restored.state["tick_index"])).toBe(asBigint(originHost.state["tick_index"]))
    const liveStore = await openPglite()
    const first = await bootHostOn(liveStore)
    await tickOnce(first)
    await tickOnce(first)
    const auth = await demoAuth(first)
    const hireCost = asBigint(walk(first.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(first, auth.cityId, hireCost + hireCost)
    const hireAt = asBigint(first.state["city_time"])
    const hired = await first.handle(
      "POST",
      "/command/hire",
      canonical({ intent_id: "p4h", expected_city_time: hireAt, role: "engineer" }),
      auth.headers,
    )
    expect(Number(hired.status)).toBe(Number(first.ctx.httpOk))
    const hiredCity = asEngineDict(asEngineDict(first.state["cities"])[auth.cityId])
    const hiredAgents = Array.isArray(hiredCity["agents"]) ? hiredCity["agents"].length : 0
    expect(hiredAgents).toBe(1)
    const hiredCapital = asBigint(hiredCity["capital"])
    const restarted = await bootHostOn(liveStore)
    expect(asBigint(restarted.state["city_time"])).toBe(asBigint(first.state["city_time"]))
    expect(asBigint(restarted.state["tick_index"])).toBe(asBigint(first.state["tick_index"]))
    expect(asBigint(asEngineDict(asEngineDict(restarted.state["cities"])["a"])["capital"])).toBe(
      asBigint(asEngineDict(asEngineDict(first.state["cities"])["a"])["capital"]),
    )
    const restartedCity = asEngineDict(asEngineDict(restarted.state["cities"])[auth.cityId])
    expect(Array.isArray(restartedCity["agents"]) ? restartedCity["agents"].length : 0).toBe(hiredAgents)
    expect(asBigint(restartedCity["capital"])).toBe(hiredCapital)
  })

  it("two_replicas_tick_once", async () => {
    const unlockedStore = await openPglite()
    const unlockedA = await bootHostOn(unlockedStore)
    const unlockedB = await bootHostOn(unlockedStore)
    unlockedB.state = unlockedA.state
    await tickOnce(unlockedA)
    await tickOnce(unlockedB)
    const unlockedRows = await listBytes(unlockedStore, "tick_inputs", "a:")
    expect(unlockedRows.length).toBe(2)

    const store = await openPglite()
    const writer = await bootHostOn(store)
    const replica = await bootHostOn(store)
    replica.state = writer.state
    const lockA = pgTickLock(store, "writer")
    const lockB = pgTickLock(store, "replica")
    expect(await tickIfWriter(writer, lockA)).toBe(true)
    expect(await tickIfWriter(replica, lockB)).toBe(false)
    const lockedRows = await listBytes(store, "tick_inputs", "a:")
    expect(lockedRows.length).toBe(1)
    const ready = await replica.handle("GET", readyTemplate, new Uint8Array())
    expect(Number(ready.status)).toBe(200)
    const body = asObj(parseJson(fromUtf8(ready.body)))
    expect(asText(body["pack_hash"])).toBe(writer.ctx.hash)
    writer.commandLock = lockA
    replica.commandLock = lockB
    const auth = await demoAuth(writer)
    const t = asBigint(writer.state["city_time"])
    const cmd = canonical({ intent_id: "p4c", expected_city_time: t })
    const blocked = await replica.handle("POST", "/command/noop", cmd, auth.headers)
    const blockedJson = parseJson(fromUtf8(blocked.body))
    const blockedCode =
      blockedJson !== null && typeof blockedJson === "object" && !Array.isArray(blockedJson)
        ? asText(asObj(blockedJson)["code"])
        : ""
    expect(blockedCode).toBe(codes.SERVICE_DEGRADED)
    const allowed = await writer.handle("POST", "/command/noop", cmd, auth.headers)
    const allowedJson = parseJson(fromUtf8(allowed.body))
    const allowedCode =
      allowedJson !== null && typeof allowedJson === "object" && !Array.isArray(allowedJson)
        ? asText(asObj(allowedJson)["code"])
        : ""
    expect(allowedCode).toBe(codes.FEATURE_NOT_IN_V1)
  })
})
