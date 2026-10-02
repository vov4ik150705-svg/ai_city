import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createMockPort, type AssetPort } from "@corporator/chainport"
import { bytesEq } from "@corporator/contentpack"
import { tickLengthRealMs } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { worldLockHeld } from "../src/city_lock.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { syncStakeSnapshot } from "../src/project.ts"
import { tickIfWriter } from "../src/scheduler.ts"
import { getBytes } from "../src/store.ts"
import { WORLD_ROW_ID } from "../src/tick_host.ts"
import { pgTickLock, replicaIdOf } from "../src/tick_lock.ts"
import { asBigint, asEngineDict, bootHost, bootHostOn, openPglite, repo } from "./harness.ts"

const wallet = "0x" + "ab".repeat(20)

function stakeOf(host: { readonly state: { readonly [key: string]: unknown } }, cityId: string): bigint {
  const city = asEngineDict(asEngineDict(host.state["cities"])[cityId])
  return asBigint(asEngineDict(city["stake_chain"])["NVDA"], 0n)
}

function portWith(hostPack: Parameters<typeof portCfgFromPack>[0], snapshot: AssetPort["stakeRegistry"]["snapshot"]): AssetPort {
  const mock = createMockPort(portCfgFromPack(hostPack))
  return {
    ...mock,
    kind: "rpc",
    stakeRegistry: {
      ...mock.stakeRegistry,
      snapshot,
      async coolingSnapshot() {
        return { ok: true, rows: [] }
      },
    },
  }
}

function apiServices(text: string): number {
  return [...text.matchAll(/^  api:$/gm)].length
}

describe("PL9 world lock", () => {
  it("a stake snapshot of 100 does not overwrite a confirm of 40", async () => {
    const host = await bootHost()
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["wallet"] = wallet
    city["stake_settled"] = { NVDA: 40n }
    city["stake_chain"] = { NVDA: 40n }
    const port = portWith(host.ctx.pack, async () => {
      if (!worldLockHeld()) return { ok: true, rows: [{ ticker: "NVDA", amount: 100n }] }
      return { ok: true, rows: [{ ticker: "NVDA", amount: 40n }] }
    })
    await syncStakeSnapshot(host.ctx, host.store, host.state, "a", port)
    expect(stakeOf(host, "a")).toBe(40n)
  })

  it("a stake read that sees the world move does not write 100", async () => {
    const host = await bootHost()
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["wallet"] = wallet
    city["stake_settled"] = { NVDA: 40n }
    city["stake_chain"] = { NVDA: 40n }
    let lockedReads = 0
    const port = portWith(host.ctx.pack, async () => {
      if (!worldLockHeld()) return { ok: true, rows: [{ ticker: "NVDA", amount: 100n }] }
      lockedReads += 1
      if (lockedReads === 1) {
        city["stake_chain"] = { NVDA: 7n }
        return { ok: true, rows: [{ ticker: "NVDA", amount: 100n }] }
      }
      return { ok: true, rows: [{ ticker: "NVDA", amount: 40n }] }
    })
    await syncStakeSnapshot(host.ctx, host.store, host.state, "a", port)
    expect(stakeOf(host, "a")).toBe(40n)
    expect(lockedReads).toBe(2)
  })

  it("a second stake read that still sees the world move does not write 100", async () => {
    const host = await bootHost()
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["wallet"] = wallet
    city["stake_settled"] = { NVDA: 40n }
    city["stake_chain"] = { NVDA: 40n }
    let lockedReads = 0
    const port = portWith(host.ctx.pack, async () => {
      if (!worldLockHeld()) return { ok: true, rows: [{ ticker: "NVDA", amount: 100n }] }
      lockedReads += 1
      city["stake_chain"] = { NVDA: lockedReads === 1 ? 7n : 9n }
      return { ok: true, rows: [{ ticker: "NVDA", amount: 100n }] }
    })
    await syncStakeSnapshot(host.ctx, host.store, host.state, "a", port)
    expect(stakeOf(host, "a")).toBe(9n)
    expect(lockedReads).toBe(2)
  })

  it("a second lock store cannot change the world row", async () => {
    const store = await openPglite()
    const writer = await bootHostOn(store)
    const lockA = pgTickLock(store, "api")
    const lockB = pgTickLock(store, "api")
    expect(await lockA.tryAcquire()).toBe(true)
    expect(await tickIfWriter(writer, lockA)).toBe(true)
    const world = await getBytes(store, "cities", WORLD_ROW_ID)
    expect(world === undefined).toBe(false)
    expect(await lockB.tryAcquire()).toBe(false)
    expect(await tickIfWriter(writer, lockB)).toBe(false)
    const after = await getBytes(store, "cities", WORLD_ROW_ID)
    expect(after === undefined).toBe(false)
    if (world !== undefined && after !== undefined) expect(bytesEq(world, after)).toBe(true)
  })

  it("an expired tick lock can be taken without SIGTERM", async () => {
    const store = await openPglite()
    await bootHostOn(store)
    let now = 0
    const clock = (): number => now
    const dead = pgTickLock(store, "old", clock)
    const next = pgTickLock(store, "new", clock)
    expect(await dead.tryAcquire()).toBe(true)
    expect(await next.tryAcquire()).toBe(false)
    now += Number(tickLengthRealMs) - 1
    expect(await next.tryAcquire()).toBe(false)
    now += 1
    expect(await next.tryAcquire()).toBe(true)
  })

  it("SIGTERM releases the world lock", async () => {
    const store = await openPglite()
    await bootHostOn(store)
    const holder = pgTickLock(store, "pod-a")
    const next = pgTickLock(store, "pod-b")
    expect(await holder.tryAcquire()).toBe(true)
    expect(await next.tryAcquire()).toBe(false)
    await holder.release()
    expect(await next.tryAcquire()).toBe(true)
  })

  it("a live holder named api does not yield the lock", async () => {
    const store = await openPglite()
    await bootHostOn(store)
    const holder = pgTickLock(store, "api")
    const other = pgTickLock(store, "api")
    expect(await holder.tryAcquire()).toBe(true)
    expect(await other.tryAcquire()).toBe(false)
    await other.release()
    expect(await other.tryAcquire()).toBe(false)
    expect(await holder.tryAcquire()).toBe(true)
    const row = await getBytes(store, "tick_locks", WORLD_ROW_ID)
    expect(row === undefined).toBe(false)
  })

  it("an empty HOSTNAME is not the replica id api", () => {
    expect(replicaIdOf(undefined)).toBeUndefined()
    expect(replicaIdOf("")).toBeUndefined()
    expect(replicaIdOf("pod-1")).toBe("pod-1")
    const src = readFileSync(join(repo, "services/api/src/main.ts"), "utf8")
    expect(src.includes(': "api"')).toBe(false)
  })

  it("compose keeps a single api service", () => {
    const dev = readFileSync(join(repo, "deploy/compose.yaml"), "utf8")
    const prod = readFileSync(join(repo, "deploy/compose.prod.yaml"), "utf8")
    expect(apiServices(dev)).toBe(1)
    expect(apiServices(prod)).toBe(1)
  })
})
