import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { glowGainBps } from "../src/light.ts"
import { mixTurnBps, signGainBps, sunDir, sunPose, windowGainBps, type SunPhase } from "../src/sun.ts"

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
          readonly sun_azimuth_bps?: number
          readonly sun_elevation_bps?: number
          readonly sun_intensity_bps?: number
          readonly ambient_bps?: number
        }
      }
    }
    readonly time?: { readonly ticks_per_city_day?: number }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly sun_distance_tiles?: { readonly v?: number }
        readonly emissive_gain_bps?: { readonly v?: number }
        readonly grade_bps?: { readonly v?: number }
        readonly phase_blend_city_minutes?: { readonly v?: number }
        readonly city_minutes_per_hour?: { readonly v?: number }
      }
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function loadPhases(pack: PackFile): readonly SunPhase[] {
  const rows = pack.generated?.placement?.phases ?? {}
  const names = ["dawn", "day", "dusk", "night"]
  const out: SunPhase[] = []
  for (const name of names) {
    const spec = rows[name]
    if (spec === undefined) continue
    out.push({
      name,
      startHour: BigInt(spec.start_hour ?? 0),
      durationHours: BigInt(spec.duration_hours ?? 0),
      lights: BigInt(spec.lights ?? 0),
      tintAlphaBps: BigInt(spec.tint_alpha_bps ?? 0),
      sunAzimuthBps: BigInt(spec.sun_azimuth_bps ?? 0),
      sunElevationBps: BigInt(spec.sun_elevation_bps ?? 0),
      sunIntensityBps: BigInt(spec.sun_intensity_bps ?? 0),
      ambientBps: BigInt(spec.ambient_bps ?? 0),
    })
  }
  return out
}

describe.sequential("V3-3 construction", () => {
  it("visual3_sun_from_city_time", () => {
    const pack = loadPack()
    const phases = loadPhases(pack)
    expect(phases.length).toBe(4)
    const ticks = BigInt(pack.generated?.time?.ticks_per_city_day ?? 0)
    const blend = BigInt(pack.sections?.render?.params?.phase_blend_city_minutes?.v ?? 0)
    const minutes = BigInt(pack.sections?.render?.params?.city_minutes_per_hour?.v ?? 0)
    const bps = BigInt(pack.sections?.render?.params?.grade_bps?.v ?? 0)
    expect(ticks > 0n).toBe(true)
    expect(bps > 0n).toBe(true)
    const dayHour = phases.find((p) => p.name === "day")?.startHour ?? 0n
    const nightHour = phases.find((p) => p.name === "night")?.startHour ?? 0n
    const dayPose = sunPose(dayHour + 1n, phases, ticks, blend, minutes, bps)
    const dayAgain = sunPose(dayHour + 1n, phases, ticks, blend, minutes, bps)
    expect(dayPose).toEqual(dayAgain)
    const nightPose = sunPose(nightHour + 1n, phases, ticks, blend, minutes, bps)
    expect(dayPose.elevationBps > nightPose.elevationBps).toBe(true)
    expect(dayPose.intensityBps > nightPose.intensityBps).toBe(true)
    const dayDir = sunDir(dayPose.azimuthBps, dayPose.elevationBps, bps)
    const nightDir = sunDir(nightPose.azimuthBps, nightPose.elevationBps, bps)
    expect(dayDir.y > nightDir.y).toBe(true)
    const span = bps
    const two = 1n + 1n
    expect(mixTurnBps(span - 1n, 1n, bps / two, bps, span) < span).toBe(true)
    expect(pack.sections?.render?.params?.sun_distance_tiles?.v ?? 0).toBeGreaterThan(0)
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("DirectionalLight")).toBe(true)
    expect(threeSrc.includes("sunPose")).toBe(true)
    expect(threeSrc.includes("void cityTime")).toBe(false)
  })

  it("visual3_windows_emissive", () => {
    const pack = loadPack()
    const phases = loadPhases(pack)
    const day = phases.find((p) => p.name === "day")
    const night = phases.find((p) => p.name === "night")
    expect(day?.lights).toBe(0n)
    expect(night?.lights).toBe(1n)
    const emissive = BigInt(pack.sections?.render?.params?.emissive_gain_bps?.v ?? 0)
    expect(windowGainBps(day?.lights ?? 1n, emissive)).toBe(0n)
    expect(windowGainBps(night?.lights ?? 0n, emissive) > 0n).toBe(true)
    expect(signGainBps("day", ["dawn", "dusk", "night"], day?.lights ?? 1n, emissive)).toBe(0n)
    expect(signGainBps("night", ["dawn", "dusk", "night"], night?.lights ?? 0n, emissive) > 0n).toBe(
      true,
    )
    expect(glowGainBps(0n, emissive)).toBe(0n)
    const heroSrc = readFileSync(join(repo, "art/pipeline/heroes.py"), "utf8")
    expect(heroSrc.includes("emissiveFactor")).toBe(true)
    expect(heroSrc.includes('"window"')).toBe(true)
    expect(heroSrc.includes('"sign"')).toBe(true)
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("emissiveIntensity")).toBe(true)
    expect(threeSrc.includes("windowGainBps")).toBe(true)
    expect(threeSrc.includes("signGainBps")).toBe(true)
  })

  it("visual3_no_baked_sun", () => {
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("MeshLambertMaterial")).toBe(true)
    expect(threeSrc.includes("MeshBasicMaterial")).toBe(false)
    expect(threeSrc.includes("AmbientLight")).toBe(true)
    const heroSrc = readFileSync(join(repo, "art/pipeline/heroes.py"), "utf8")
    expect(heroSrc.includes("NdotL") || heroSrc.includes("ndotl")).toBe(false)
    expect(heroSrc.includes("baked sun") || heroSrc.includes("shade = ")).toBe(false)
    expect(heroSrc.includes("emissiveFactor")).toBe(true)
    expect(heroSrc.includes("COLOR_0")).toBe(true)
  })
})
