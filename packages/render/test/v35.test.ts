import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadScene } from "../src/ground.ts"
import { isPackedWalker, plantUnits, unitShiftBps, unitWorldPos } from "../src/units.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly placement?: {
      readonly scene?: unknown
      readonly walkers?: readonly { readonly id?: string; readonly x?: number; readonly y?: number }[]
    }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly unit_height_bps?: { readonly v?: number }
        readonly unit_shift_period_city_minutes?: { readonly v?: number }
        readonly unit_shift_span_bps?: { readonly v?: number }
        readonly grade_bps?: { readonly v?: number }
        readonly city_minutes_per_hour?: { readonly v?: number }
      }
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

describe.sequential("V3-5 construction", () => {
  it("visual3_walkers_from_pack", () => {
    const pack = loadPack()
    const planted = plantUnits(pack.generated?.placement?.scene)
    const walkers = pack.generated?.placement?.walkers ?? []
    expect(walkers.length > 0).toBe(true)
    expect(planted.length).toBe(walkers.length)
    for (const row of planted) {
      expect(isPackedWalker(row.id)).toBe(true)
    }
    const scene = loadScene(pack.generated?.placement?.scene)
    let packed = 0
    for (const obj of scene.objects) {
      if (isPackedWalker(obj.id)) packed += 1
    }
    expect(packed).toBe(planted.length)
    const empty = plantUnits({ legend: {}, map: [], objects: [] })
    expect(empty.length).toBe(0)
  })

  it("visual3_units_billboard_or_mesh", () => {
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("plantUnits")).toBe(false)
    expect(threeSrc.includes("isPackedWalker")).toBe(false)
    expect(threeSrc.includes("unitWorldPos")).toBe(false)
    expect(threeSrc.includes("from \"pixi.js\"")).toBe(false)
    expect(threeSrc.includes("@corporator/render/pixi")).toBe(false)
    const pack = loadPack()
    const planted = plantUnits(pack.generated?.placement?.scene)
    const first = planted[0]
    expect(first).toBeDefined()
    if (first === undefined) return
    const map = loadScene(pack.generated?.placement?.scene).map
    const period = BigInt(pack.sections?.render?.params?.unit_shift_period_city_minutes?.v ?? 0)
    const span = BigInt(pack.sections?.render?.params?.unit_shift_span_bps?.v ?? 0)
    const grade = BigInt(pack.sections?.render?.params?.grade_bps?.v ?? 0)
    const minutes = BigInt(pack.sections?.render?.params?.city_minutes_per_hour?.v ?? 0)
    const height = BigInt(pack.sections?.render?.params?.unit_height_bps?.v ?? 0)
    expect(period > 0n).toBe(true)
    expect(span > 0n).toBe(true)
    expect(grade > 0n).toBe(true)
    expect(height > 0n).toBe(true)
    const a = unitWorldPos(first, map, 0n, 1n, minutes, period, span, grade, height)
    const b = unitWorldPos(first, map, 0n, 1n, minutes, period, span, grade, height)
    expect(a).toEqual(b)
  })

  it("visual3_units_not_lootable", () => {
    const unitsSrc = readFileSync(join(repo, "packages/render/src/units.ts"), "utf8")
    expect(unitsSrc.includes("agent_id")).toBe(false)
    expect(unitsSrc.includes("agentId")).toBe(false)
    expect(unitsSrc.includes("Date")).toBe(false)
    expect(unitsSrc.includes("Math.random")).toBe(false)
    const pickSrc = readFileSync(join(repo, "packages/render/src/pick.ts"), "utf8")
    expect(pickSrc.includes("walker_")).toBe(false)
    expect(pickSrc.includes("agent_id")).toBe(false)
    expect(pickSrc.includes("agentId")).toBe(false)
    const a = unitShiftBps(0n, 1n, 1n + 1n, 1n)
    const b = unitShiftBps(0n, 1n, 1n + 1n, 1n)
    expect(a).toBe(b)
    const moved = unitShiftBps(1n, 1n, 1n, 1n + 1n)
    expect(moved === a).toBe(false)
  })
})
