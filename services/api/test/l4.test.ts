import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { bytesEq, loadPack } from "@corporator/contentpack"
import { replayStored } from "../src/index.ts"
import { createHost } from "../src/host.ts"
import { openPg } from "../src/store.ts"
import { asObj, asText, bootHost, liveGenesis, makeInputs, migrationSql, packBytes } from "./harness.ts"
import { makeCtx } from "../src/pack_ctx.ts"
import { jsonToDict, walk } from "../src/values.ts"
import { startPostgres } from "./postgres_harness.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function dockerfile(): string {
  return readFileSync(join(repo, "deploy/Dockerfile"), "utf8")
}

function composeYaml(): string {
  return readFileSync(join(repo, "deploy/compose.yaml"), "utf8")
}

function runtimeStage(text: string): string {
  const matches = [...text.matchAll(/^FROM .+$/gm)]
  const last = matches[matches.length - 1]
  if (last === undefined || last.index === undefined) return ""
  return text.slice(last.index)
}

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

describe.sequential("L4 pg_compose", () => {
  it("compose_from_pack", async () => {
    expect(existsSync(join(repo, "deploy/compose.yaml"))).toBe(true)
    const yaml = composeYaml()
    const df = dockerfile()
    const host = await bootHost()
    const packages = asObj(walk(host.ctx.pack, ["sections", "arch", "packages"]))
    const ports = asObj(walk(host.ctx.pack, ["sections", "arch", "listen", "ports"]))
    const postgres = asObj(walk(host.ctx.pack, ["sections", "arch", "postgres"]))
    const envs = asObj(walk(host.ctx.pack, ["sections", "arch", "environments"]))
    const service = asText(postgres["service"])
    expect(yaml.includes("\n  " + service + ":\n")).toBe(true)
    for (const name of Object.keys(packages)) {
      const spec = asObj(packages[name] ?? {})
      if (asText(spec["root"]) !== "services") continue
      const entry = spec["entrypoint"]
      if (entry !== 1 && entry !== 1n) continue
      expect(yaml.includes("\n  " + name + ":\n")).toBe(true)
      expect(df.includes("services/" + name + "/dist")).toBe(true)
      const port = String(ports[name] ?? "")
      expect(port.length > 0).toBe(true)
      expect(yaml.includes(port + ":" + port)).toBe(true)
    }
    for (const envName of Object.keys(envs)) {
      expect(yaml.includes(envName)).toBe(true)
    }
    const runtime = runtimeStage(df).toLowerCase()
    expect(runtime.includes("python")).toBe(false)
    expect(runtime.includes("pglite")).toBe(false)
    expect(runtime.includes("embedded-postgres")).toBe(false)
    expect(runtime.includes("content/")).toBe(false)
  })

  it("postgres_replay_matches_pglite", async () => {
    const lite = await bootHost()
    const cityId = "a"
    const n = lite.ctx.ticksDay
    const recs: Uint8Array[] = []
    const hdrs: Uint8Array[] = []
    let i = 0n
    while (i < n) {
      const ran = await lite.stepTick(makeInputs(lite.ctx.cfg, i))
      hdrs.push(ran.headerBytes)
      for (const blob of ran.recordBytes) recs.push(blob)
      i += 1n
    }
    const liteReplay = await replayStored(lite.ctx, lite.store, structuredClone(lite.genesis), cityId)
    expectBytes(liteReplay.headers, hdrs)
    expectBytes(liteReplay.records, recs)
    const pg = await startPostgres()
    try {
      const bytes = packBytes()
      const loaded = loadPack(bytes)
      const ctx = makeCtx(loaded)
      const genesis = liveGenesis(ctx.cfg, jsonToDict(loaded.pack))
      const mig = migrationSql()
      const store = await openPg(pg.url)
      try {
        const host = await createHost(bytes, mig.sql, mig.name, genesis, () => Promise.resolve(store))
        let j = 0n
        const pgHdrs: Uint8Array[] = []
        const pgRecs: Uint8Array[] = []
        while (j < n) {
          const ran = await host.stepTick(makeInputs(host.ctx.cfg, j))
          pgHdrs.push(ran.headerBytes)
          for (const blob of ran.recordBytes) pgRecs.push(blob)
          j += 1n
        }
        expectBytes(pgHdrs, hdrs)
        expectBytes(pgRecs, recs)
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
        const ready = await host.readiness()
        expect(ready.ready).toBe(true)
        expect(ready.pack_hash).toBe(host.ctx.hash)
      } finally {
        await store.close()
      }
    } finally {
      await pg.stop()
    }
  }, 600_000)
})
