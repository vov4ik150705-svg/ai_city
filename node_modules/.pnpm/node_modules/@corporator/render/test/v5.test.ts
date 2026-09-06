import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  currentPhase,
  glowGainBps,
  gradeRgb,
  hourOfDay,
  hoursLeftInPhase,
  lightsOn,
  nextPhase,
  phaseBlendBps,
  type PhaseRow,
  type Rgb,
} from "../src/light.ts"
import { snapLutFilter } from "../src/lut.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly placement?: {
      readonly phases?: {
        readonly [name: string]: {
          readonly start_hour?: number
          readonly duration_hours?: number
          readonly lights?: number
          readonly tint_alpha_bps?: number
        }
      }
      readonly lanterns_on_phases?: readonly string[]
    }
    readonly time?: { readonly ticks_per_city_day?: number }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly phase_blend_city_minutes?: { readonly v?: number }
        readonly city_minutes_per_hour?: { readonly v?: number }
        readonly emissive_gain_bps?: { readonly v?: number }
        readonly grade_bps?: { readonly v?: number }
      }
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function asBig(n: number | undefined): bigint {
  return BigInt(n ?? 0)
}

function packedPhases(pack: PackFile): readonly PhaseRow[] {
  const rows = pack.generated?.placement?.phases ?? {}
  const names = ["dawn", "day", "dusk", "night"]
  const out: PhaseRow[] = []
  for (const name of names) {
    const spec = rows[name]
    if (spec === undefined) continue
    out.push({
      name,
      startHour: asBig(spec.start_hour),
      durationHours: asBig(spec.duration_hours),
      lights: asBig(spec.lights),
      tintAlphaBps: asBig(spec.tint_alpha_bps),
    })
  }
  return out
}

function isKey(rgb: Rgb): boolean {
  const hi = 255n
  return rgb.r === hi && rgb.g === 0n && rgb.b === hi
}

describe("v5", () => {
  it("frame_has_no_magenta_leak", () => {
    const pack = loadPack()
    const bps = asBig(pack.sections?.render?.params?.grade_bps?.v)
    const tints: readonly Rgb[] = [
      { r: 255n, g: 180n, b: 40n },
      { r: 255n, g: 255n, b: 255n },
      { r: 200n, g: 40n, b: 40n },
      { r: 20n, g: 30n, b: 80n },
    ]
    const srcs: readonly Rgb[] = [
      { r: 0n, g: 0n, b: 0n },
      { r: 255n, g: 255n, b: 255n },
      { r: 10n, g: 20n, b: 30n },
      { r: 128n, g: 64n, b: 32n },
      { r: 0n, g: 255n, b: 0n },
    ]
    const mixes = [0n, bps / (1n + 1n), bps]
    for (const src of srcs) {
      for (const tint of tints) {
        for (const mix of mixes) {
          const out = gradeRgb(src, tint, mix, bps)
          if (mix === 0n) {
            expect(out).toEqual(src)
          }
          expect(isKey(out)).toBe(false)
        }
      }
    }
  })

  it("lights_off_at_day", () => {
    const pack = loadPack()
    const phases = packedPhases(pack)
    const lanterns = pack.generated?.placement?.lanterns_on_phases ?? []
    const emissive = asBig(pack.sections?.render?.params?.emissive_gain_bps?.v)
    const day = phases.find((row) => row.name === "day")
    expect(day?.lights).toBe(0n)
    expect(lanterns.includes("day")).toBe(false)
    expect(glowGainBps(day?.lights ?? 1n, emissive)).toBe(0n)
    expect(lightsOn("day", lanterns, day?.lights ?? 0n)).toBe(false)
    for (const row of phases) {
      if (row.name === "day") continue
      expect(row.lights).toBe(1n)
      expect(glowGainBps(row.lights, emissive) > 0n).toBe(true)
      expect(lightsOn(row.name, lanterns, row.lights)).toBe(true)
    }
  })

  it("phase_blend_is_monotonic", () => {
    const pack = loadPack()
    const phases = packedPhases(pack)
    const ticksDay = asBig(pack.generated?.time?.ticks_per_city_day)
    const minutes = asBig(pack.sections?.render?.params?.city_minutes_per_hour?.v)
    const window = asBig(pack.sections?.render?.params?.phase_blend_city_minutes?.v)
    const bps = asBig(pack.sections?.render?.params?.grade_bps?.v)
    const day = phases.find((row) => row.name === "day")
    expect(day).toBeDefined()
    if (day === undefined) return
    const blends: bigint[] = []
    let hour = day.startHour
    while (hour < day.startHour + day.durationHours) {
      const left = hoursLeftInPhase(hour, day.startHour, day.durationHours, ticksDay)
      blends.push(phaseBlendBps(left * minutes, window, bps))
      hour += 1n
    }
    let i = 1
    while (i < blends.length) {
      const prev = blends[i - 1] ?? 0n
      const cur = blends[i] ?? 0n
      expect(cur >= prev).toBe(true)
      i += 1
    }
    const last = blends[blends.length - 1] ?? 0n
    expect(last > 0n).toBe(true)
    const nxt = nextPhase(day.startHour + day.durationHours - 1n, phases, ticksDay)
    expect(nxt?.name).not.toBe("day")
    const edge = hourOfDay(day.startHour + day.durationHours, ticksDay)
    const firstNext = currentPhase(edge, phases, ticksDay)
    expect(firstNext?.name).toBe(nxt?.name)
    if (firstNext !== undefined) {
      const leftN = hoursLeftInPhase(
        edge,
        firstNext.startHour,
        firstNext.durationHours,
        ticksDay,
      )
      expect(phaseBlendBps(leftN * minutes, window, bps)).toBe(0n)
    }
    expect(snapLutFilter({} as ImageBitmap, 0n)).toBeUndefined()
    expect(snapLutFilter({} as ImageBitmap, 1n)).toBeUndefined()
  })
})
