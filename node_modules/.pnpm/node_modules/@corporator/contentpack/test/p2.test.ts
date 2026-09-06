import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type CiStep = {
  readonly id: string
  readonly cmd: string
  readonly track: string
}

type ArchFile = {
  readonly ci_steps: { readonly [id: string]: { readonly cmd: string; readonly track: string } }
}

function loadArch(): ArchFile {
  return JSON.parse(readFileSync(join(repo, "content/params/arch.json"), "utf8")) as ArchFile
}

function loadWorkflow(): string {
  return readFileSync(join(repo, ".github/workflows/ci.yml"), "utf8")
}

function loadRunner(): string {
  return readFileSync(join(repo, "scripts/ci.mjs"), "utf8")
}

function jobBody(workflow: string, name: string): string {
  const jobsAt = workflow.indexOf("\njobs:")
  const from = jobsAt < 0 ? workflow : workflow.slice(jobsAt)
  const token = `\n  ${name}:`
  const start = from.indexOf(token)
  if (start < 0) return ""
  const rest = from.slice(start + token.length)
  const next = rest.search(/\n {2}[a-z]+:/)
  return next < 0 ? rest : rest.slice(0, next)
}

describe.sequential("P2 construction", () => {
  it("nightly_track_has_full_attack", () => {
    const arch = loadArch()
    const full = arch.ci_steps["attack_full"]
    expect(full).toBeDefined()
    if (full === undefined) return
    expect(full.track).toBe("nightly")
    expect(full.cmd.includes("--jobs 8")).toBe(true)
    const sim = arch.ci_steps["sim"]
    expect(sim).toBeDefined()
    if (sim === undefined) return
    expect(sim.track).toBe("nightly")
    expect(sim.cmd.includes("sim.py")).toBe(true)
    const night = jobBody(loadWorkflow(), "nightly")
    expect(night.includes("python content/attack.py --jobs 8")).toBe(true)
    expect(night.includes("python content/sim.py")).toBe(true)
    expect(night.includes("forge test --root contracts")).toBe(true)
    const dropped = { ...full, cmd: "python content/lint.py" }
    expect(dropped.cmd.includes("--jobs 8")).toBe(false)
  })

  it("push_track_has_no_full_attack", () => {
    const arch = loadArch()
    for (const [id, spec] of Object.entries(arch.ci_steps)) {
      if (spec.track !== "push") continue
      expect(spec.cmd.includes("--jobs 8"), id).toBe(false)
      expect(spec.cmd.includes("sim.py"), id).toBe(false)
    }
    const push = jobBody(loadWorkflow(), "push")
    expect(push.includes("--jobs 8")).toBe(false)
    expect(push.includes("sim.py")).toBe(false)
    expect(push.includes("secrets.")).toBe(false)
    const runner = loadRunner()
    expect(runner.includes('stepsOnTrack(ciSteps, "push")')).toBe(true)
    expect(runner.includes("attack.py --jobs 8")).toBe(true)
  })

  it("workflow_matches_pack_steps", () => {
    expect(existsSync(join(repo, ".github/workflows/ci.yml"))).toBe(true)
    const workflow = loadWorkflow()
    expect(workflow.startsWith("# GENERATED from pack ")).toBe(true)
    expect(workflow.includes("do not edit")).toBe(true)
    const arch = loadArch()
    const push = jobBody(workflow, "push")
    const night = jobBody(workflow, "nightly")
    for (const [id, spec] of Object.entries(arch.ci_steps)) {
      const needle = `name: ${id}`
      if (spec.track === "push") {
        expect(push.includes(needle), id).toBe(true)
        expect(push.includes(`run: ${spec.cmd}`), id).toBe(true)
      }
      expect(night.includes(needle), id).toBe(true)
      expect(night.includes(`run: ${spec.cmd}`), id).toBe(true)
    }
    const runner = loadRunner()
    const steps: readonly CiStep[] = JSON.parse(
      runner.slice(runner.indexOf("export const ciSteps = ") + "export const ciSteps = ".length).split(";")[0] ?? "[]",
    ) as CiStep[]
    expect(steps.length).toBe(Object.keys(arch.ci_steps).length)
    const planted = workflow.replace("name: ci", "name: patched")
    expect(planted === workflow).toBe(false)
  })
})
