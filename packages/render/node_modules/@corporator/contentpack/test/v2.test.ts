import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly placement?: {
      readonly scene?: {
        readonly legend?: Readonly<Record<string, string>>
        readonly map?: readonly string[]
      }
      readonly decor_realized_share_bps?: number
    }
  }
  readonly sections?: {
    readonly placement?: {
      readonly params?: Readonly<Record<string, { readonly v?: number } | undefined>>
    }
    readonly districts?: {
      readonly districts?: Readonly<Record<string, { readonly beacon?: string } | undefined>>
    }
  }
}

type AssetsFile = {
  readonly assets?: readonly { readonly id?: string; readonly sign_box?: readonly number[] }[]
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

const GROUND_CHARS = ["~", ".", "r", "s", "c", "p", "k", "b", "d", "w", "m"] as const

describe.sequential("V2 construction", () => {
  it("new_ground_kinds_registered", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    const legend = pack.generated?.placement?.scene?.legend ?? {}
    for (const ch of GROUND_CHARS) {
      expect(legend[ch], ch).toBeDefined()
    }
    const map = pack.generated?.placement?.scene?.map ?? []
    expect(map.length).toBeGreaterThan(0)
    for (const ch of GROUND_CHARS) {
      expect(map.some((row) => row.includes(ch)), ch).toBe(true)
    }
    for (const row of map) {
      for (const ch of row) {
        expect(legend[ch], ch).toBeDefined()
      }
    }
  })

  it("decor_share_within_band", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    const target = pack.sections?.placement?.params?.decor_target_share_bps?.v ?? 0
    const tol = pack.sections?.placement?.params?.decor_share_tolerance_bps?.v ?? 0
    const got = pack.generated?.placement?.decor_realized_share_bps ?? 0
    expect(target).toBeGreaterThan(0)
    expect(got).toBeGreaterThanOrEqual(target - tol)
    expect(got).toBeLessThanOrEqual(target + tol)
  })

  it("beacon_has_logo_and_ticker", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    const assets = loadJson<AssetsFile>("art/pipeline/assets.json")
    const byId = new Map((assets.assets ?? []).map((row) => [row.id, row]))
    const districts = pack.sections?.districts?.districts ?? {}
    const beacons = Object.values(districts).map((d) => d?.beacon).filter((id): id is string => Boolean(id))
    expect(beacons.length).toBeGreaterThan(0)
    for (const bid of beacons) {
      const box = byId.get(bid)?.sign_box
      expect(box, bid).toHaveLength(4)
    }
  })
})
