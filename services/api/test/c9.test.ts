import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { LoadError } from "@corporator/contentpack"
import { exportLive, observedFromThresholds } from "../src/metrics.ts"
import { asObj, walk } from "../src/values.ts"
import { bootHost } from "./harness.ts"
import { putJson } from "../src/store.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function dockerfile(): string {
  return readFileSync(join(repo, "deploy/Dockerfile"), "utf8")
}

function ciRunner(): string {
  return readFileSync(join(repo, "scripts/ci.mjs"), "utf8")
}

function runtimeStage(text: string): string {
  const matches = [...text.matchAll(/^FROM .+$/gm)]
  const last = matches[matches.length - 1]
  if (last === undefined || last.index === undefined) return ""
  return text.slice(last.index)
}

type CiStep = {
  readonly id: string
  readonly cmd: string
  readonly catches: string
  readonly red_input: string
}

function runCiSteps(
  steps: readonly CiStep[],
  exec: (step: CiStep) => number,
): readonly { readonly id: string; readonly code: number }[] {
  const out: { readonly id: string; readonly code: number }[] = []
  for (const step of steps) {
    out.push({ id: step.id, code: exec(step) })
  }
  return out
}

describe.sequential("C9 construction", () => {
  it("image_pins_pack_hash", async () => {
    const df = dockerfile()
    expect(df.includes("ARG PACK_HASH")).toBe(true)
    expect(df.includes("ENV PACK_HASH=$PACK_HASH")).toBe(true)
    const host = await bootHost()
    const rows = host.metrics
    const authored = asObj(walk(host.ctx.pack, ["sections", "arch", "metrics"]))
    expect(rows.length).toBe(Object.keys(authored).length)
    const live = exportLive(host.ctx, observedFromThresholds(rows))
    expect(live.length).toBe(rows.length)
    for (const row of live) {
      expect(row.observed === undefined).toBe(false)
      expect(row.thresholdSrc.length > 0).toBe(true)
    }
    try {
      exportLive(host.ctx, {})
      expect.fail("exportLive must refuse a missing observed id")
    } catch (err) {
      expect(err instanceof LoadError).toBe(true)
    }
    const ok = await host.readiness()
    expect(ok.ready).toBe(true)
    await putJson(
      host.store,
      "schema_migrations",
      "head",
      { version: ok.migration_version, pack_hash: "00" },
      undefined,
    )
    const badHash = await host.readiness()
    expect(badHash.ready).toBe(false)
    await putJson(
      host.store,
      "schema_migrations",
      "head",
      { version: ok.migration_version + 1n, pack_hash: host.ctx.hash },
      undefined,
    )
    const badMig = await host.readiness()
    expect(badMig.ready).toBe(false)
  })

  it("image_has_no_python", () => {
    const runtime = runtimeStage(dockerfile()).toLowerCase()
    expect(runtime.includes("python")).toBe(false)
    expect(runtime.includes("content/")).toBe(false)
    expect(runtime.includes("copy content")).toBe(false)
    expect(runtime.includes("pglite")).toBe(false)
    expect(runtime.includes("embedded-postgres")).toBe(false)
  })

  it("ci_step_has_red_run", async () => {
    const host = await bootHost()
    const authored = asObj(walk(host.ctx.pack, ["sections", "arch", "ci_steps"]))
    const ids = Object.keys(authored)
    expect(ids.length === 0).toBe(false)
    const steps: CiStep[] = []
    for (const id of ids) {
      const spec = asObj(authored[id] ?? {})
      const red = spec["red_input"]
      const cmd = spec["cmd"]
      const catches = spec["catches"]
      expect(typeof red === "string" && red.length > 0).toBe(true)
      const track = spec["track"]
      const jobsOnPush = typeof cmd === "string" && cmd.includes("attack.py --jobs") && track !== "nightly"
      expect(jobsOnPush).toBe(false)
      if (typeof cmd !== "string" || typeof catches !== "string" || typeof red !== "string") {
        expect.fail("ci step fields")
        return
      }
      steps.push({ id, cmd, catches, red_input: red })
    }
    const body = ciRunner()
    const forIdx = body.indexOf("for (")
    const exitIdx = body.lastIndexOf("process.exit")
    expect(forIdx >= 0 && exitIdx > forIdx).toBe(true)
    expect(body.includes("break;")).toBe(false)
    let ran = 0
    const results = runCiSteps(steps.slice(0, 1 + 1), (step) => {
      ran += 1
      return step.id === steps[0]?.id ? 1 : 0
    })
    expect(ran).toBe(1 + 1)
    expect(results.length).toBe(1 + 1)
    expect(results[0]?.code).toBe(1)
    expect(results[1]?.code).toBe(0)
  })
})
