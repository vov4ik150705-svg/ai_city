import { canonical } from "@corporator/contentpack"
import { describe, expect, it } from "vitest"
import {
  armChainClock,
  outsideWorldLock,
  watchSnapshot,
  withWorldLock,
  WorldMoved,
} from "../src/city_lock.ts"
import { listBytes, getBytes, putBytes, type Store } from "../src/store.ts"
import { snapJson, WORLD_ROW_ID } from "../src/tick_host.ts"
import { asBigint, asEngineDict, type Dict, walk } from "../src/values.ts"
import { bootHost, bootHostOn, demoAuth, makeInputs, openPglite, seedPlayerCapital } from "./harness.ts"

function capitalOf(state: Dict, cityId: string): bigint {
  return asBigint(asEngineDict(asEngineDict(state["cities"])[cityId])["capital"])
}

function agentCount(state: Dict, cityId: string): number {
  const agents = asEngineDict(asEngineDict(state["cities"])[cityId])["agents"]
  return Array.isArray(agents) ? agents.length : 0
}

function hireBody(intent: string, cityTime: bigint): Uint8Array {
  return canonical({ intent_id: intent, expected_city_time: cityTime, role: "engineer" })
}

function wrapping(inner: Store, trap: { readonly fail: (sql: string) => void }): Store {
  return {
    async exec(sql: string): Promise<void> {
      trap.fail(sql)
      await inner.exec(sql)
    },
    async query(sql: string, params: readonly unknown[]): Promise<readonly { readonly [key: string]: unknown }[]> {
      trap.fail(sql)
      return inner.query(sql, params)
    },
    async close(): Promise<void> {
      await inner.close()
    },
  }
}

describe.sequential("W2 world lock", () => {
  it("drops the per-city lock name", async () => {
    const lock = await import("../src/city_lock.ts")
    expect("withCityLock" in lock).toBe(false)
    expect(typeof lock.withWorldLock).toBe("function")
  })

  it("releases the world lock while a chain call waits", async () => {
    let releaseNet = (): void => {}
    const gate = new Promise<void>((resolve) => {
      releaseNet = resolve
    })
    let markEntered = (): void => {}
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve
    })
    const state: Dict = { city_time: 1n }
    const first = withWorldLock(async () => {
      await outsideWorldLock(state, async () => {
        markEntered()
        await gate
      })
    })
    await entered
    let secondDone = false
    const second = withWorldLock(async () => {
      secondDone = true
    })
    await second
    expect(secondDone).toBe(true)
    releaseNet()
    await first
  })

  it("chain clock rejects a world that moved during the wait", async () => {
    const state: Dict = { city_time: 5n }
    let refreshed = false
    await withWorldLock(async () => {
      armChainClock(5n)
      watchSnapshot(() => {
        refreshed = true
      })
      await expect(
        outsideWorldLock(state, async () => {
          state["city_time"] = 6n
        }),
      ).rejects.toBeInstanceOf(WorldMoved)
    })
    expect(refreshed).toBe(true)
    expect(asBigint(state["city_time"])).toBe(6n)
  })

  it("two cities commit in parallel", async () => {
    const host = await bootHost()
    const left = await demoAuth(host)
    const right = await demoAuth(host)
    expect(left.cityId === right.cityId).toBe(false)
    const hireCost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, left.cityId, hireCost + hireCost)
    seedPlayerCapital(host, right.cityId, hireCost + hireCost)
    const t = asBigint(host.state["city_time"])
    const [a, b] = await Promise.all([
      host.handle("POST", "/command/hire", hireBody("w2-a", t), left.headers),
      host.handle("POST", "/command/hire", hireBody("w2-b", t), right.headers),
    ])
    expect(Number(a.status)).toBe(Number(host.ctx.httpOk))
    expect(Number(b.status)).toBe(Number(host.ctx.httpOk))
    expect(agentCount(host.state, left.cityId)).toBe(1)
    expect(agentCount(host.state, right.cityId)).toBe(1)
    expect(capitalOf(host.state, left.cityId) < hireCost + hireCost).toBe(true)
    expect(capitalOf(host.state, right.cityId) < hireCost + hireCost).toBe(true)
  })

  it("repeated intent returns the first body and does not hire twice", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const hireCost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, hireCost + hireCost)
    const t = asBigint(host.state["city_time"])
    const body = hireBody("w2-once", t)
    const first = await host.handle("POST", "/command/hire", body, auth.headers)
    const after = capitalOf(host.state, auth.cityId)
    const second = await host.handle("POST", "/command/hire", body, auth.headers)
    expect(second.status).toBe(first.status)
    expect(Buffer.from(second.body).equals(Buffer.from(first.body))).toBe(true)
    expect(agentCount(host.state, auth.cityId)).toBe(1)
    expect(capitalOf(host.state, auth.cityId)).toBe(after)
  })

  it("putBytes failure after apply restores capital", async () => {
    const inner = await openPglite()
    let armed = false
    const store = wrapping(inner, {
      fail(sql: string): void {
        if (armed && sql.includes("INSERT INTO intents")) throw new Error("putBytes down")
      },
    })
    const host = await bootHostOn(store)
    const auth = await demoAuth(host)
    const hireCost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, hireCost + hireCost)
    const before = capitalOf(host.state, auth.cityId)
    armed = true
    await expect(
      host.handle("POST", "/command/hire", hireBody("w2-put", asBigint(host.state["city_time"])), auth.headers),
    ).rejects.toThrow("putBytes down")
    expect(capitalOf(host.state, auth.cityId)).toBe(before)
    expect(agentCount(host.state, auth.cityId)).toBe(0)
  })

  it("a throwing COMMIT does not keep the hire debit", async () => {
    const inner = await openPglite()
    let armed = false
    let commits = 0
    const store = wrapping(inner, {
      fail(sql: string): void {
        if (!armed || sql !== "COMMIT") return
        commits += 1
        if (commits >= 2) throw new Error("commit down")
      },
    })
    const host = await bootHostOn(store)
    const auth = await demoAuth(host)
    const hireCost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, hireCost + hireCost)
    const before = capitalOf(host.state, auth.cityId)
    armed = true
    await expect(
      host.handle("POST", "/command/hire", hireBody("w2-commit", asBigint(host.state["city_time"])), auth.headers),
    ).rejects.toThrow("commit down")
    expect(commits).toBe(2)
    expect(capitalOf(host.state, auth.cityId)).toBe(before)
    expect(agentCount(host.state, auth.cityId)).toBe(0)
  })

  it("restart reads every city from the world row", async () => {
    const store = await openPglite()
    const host = await bootHostOn(store)
    const left = await demoAuth(host)
    const right = await demoAuth(host)
    const hireCost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, left.cityId, hireCost + hireCost)
    seedPlayerCapital(host, right.cityId, hireCost + hireCost)
    const t = asBigint(host.state["city_time"])
    const hiredLeft = await host.handle("POST", "/command/hire", hireBody("w2-ra", t), left.headers)
    const hiredRight = await host.handle("POST", "/command/hire", hireBody("w2-rb", t), right.headers)
    expect(Number(hiredLeft.status)).toBe(Number(host.ctx.httpOk))
    expect(Number(hiredRight.status)).toBe(Number(host.ctx.httpOk))
    const restarted = await bootHostOn(store)
    expect(agentCount(restarted.state, left.cityId)).toBe(1)
    expect(agentCount(restarted.state, right.cityId)).toBe(1)
    expect(capitalOf(restarted.state, left.cityId)).toBe(capitalOf(host.state, left.cityId))
    expect(capitalOf(restarted.state, right.cityId)).toBe(capitalOf(host.state, right.cityId))
    const world = await getBytes(store, "cities", WORLD_ROW_ID)
    expect(world !== undefined).toBe(true)
    if (world === undefined) return
    const thin = structuredClone(host.state)
    delete asEngineDict(thin["cities"])[right.cityId]
    await putBytes(store, "cities", "a", canonical(snapJson(thin)), "demo")
    const preferred = await bootHostOn(store)
    expect(agentCount(preferred.state, right.cityId)).toBe(1)
    await store.query("DELETE FROM cities WHERE id = $1", [WORLD_ROW_ID])
    await putBytes(store, "cities", "a", world, "demo")
    const legacy = await bootHostOn(store)
    expect(agentCount(legacy.state, left.cityId)).toBe(1)
    expect(agentCount(legacy.state, right.cityId)).toBe(1)
  })

  it("keeps the city id in the record key and attests after commit", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const hireCost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, hireCost + hireCost)
    const hired = await host.handle(
      "POST",
      "/command/hire",
      hireBody("w2-rec", asBigint(host.state["city_time"])),
      auth.headers,
    )
    expect(Number(hired.status)).toBe(Number(host.ctx.httpOk))
    let during = 0
    await host.stepTick(makeInputs(host.ctx.cfg, 0n, { city_id: auth.cityId }), {
      async submit(): Promise<undefined> {
        const rows = await listBytes(host.store, "tick_inputs", auth.cityId + ":")
        during = rows.length
        throw new Error("attest down")
      },
    })
    expect(during).toBe(1)
    const inputs = await listBytes(host.store, "tick_inputs", auth.cityId + ":")
    expect(inputs.length).toBe(1)
    const records = await listBytes(host.store, "records", auth.cityId + ":")
    expect(records.length > 0).toBe(true)
    const first = records[0]
    expect(first !== undefined && first.id.startsWith(auth.cityId + ":")).toBe(true)
  })
})
