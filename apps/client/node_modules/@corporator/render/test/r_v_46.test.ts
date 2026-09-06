import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isShoreWater } from "../src/water.ts"
import { tileCenter } from "../src/iso.ts"
import { pixelKept } from "../src/columnMask.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

describe.sequential("R-V-46 construction", () => {
  it("sprite_fits_footprint_width", () => {
    const man = JSON.parse(readFileSync(join(repo, "content/out/atlas/city.json"), "utf8")) as {
      readonly tile_w?: number
      readonly frames?: {
        readonly [id: string]: {
          readonly kind?: string
          readonly w?: number
          readonly footprint?: readonly number[]
        }
      }
    }
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly sections?: {
        readonly render?: { readonly params?: { readonly sprite_overhang_bps?: { readonly v?: number } } }
      }
    }
    const tileW = man.tile_w ?? 0
    expect(tileW > 0).toBe(true)
    const half = tileW / (1 + 1)
    const overhang = pack.sections?.render?.params?.sprite_overhang_bps?.v ?? 0
    const frames = man.frames ?? {}
    for (const [id, fr] of Object.entries(frames)) {
      if (fr.kind !== "building") continue
      const fp = fr.footprint ?? [1, 1]
      const cols = fp[0] ?? 1
      const rows = fp[1] ?? 1
      const lot = Math.max(half, (cols + rows) * half)
      const cap = lot + Math.floor((lot * overhang) / 10000)
      expect(fr.w ?? 0, id).toBeLessThanOrEqual(cap)
    }
  })

  it("district_fabric_not_glued", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly generated?: {
        readonly placement?: {
          readonly reference_layout?: readonly {
            readonly kind?: string
            readonly id?: string
            readonly zone?: string
            readonly x?: number
            readonly y?: number
            readonly w?: number
            readonly h?: number
          }[]
        }
      }
    }
    const placed = pack.generated?.placement?.reference_layout ?? []
    const houses = placed.filter((row) => row.id === "residential_block" && row.zone === "consumer")
    const beacons = placed.filter((row) => row.kind === "beacon" && row.zone === "consumer")
    expect(beacons.length > 0).toBe(true)
    for (const house of houses) {
      for (const beacon of beacons) {
        const ax0 = house.x ?? 0
        const ay0 = house.y ?? 0
        const ax1 = ax0 + (house.w ?? 0)
        const ay1 = ay0 + (house.h ?? 0)
        const bx0 = beacon.x ?? 0
        const by0 = beacon.y ?? 0
        const bx1 = bx0 + (beacon.w ?? 0)
        const by1 = by0 + (beacon.h ?? 0)
        const yOv = ay0 < by1 && by0 < ay1
        const xOv = ax0 < bx1 && bx0 < ax1
        const gap = 1
        const glued =
          (yOv && ((ax1 <= bx0 && bx0 - ax1 <= gap) || (bx1 <= ax0 && ax0 - bx1 <= gap))) ||
          (xOv && ((ay1 <= by0 && by0 - ay1 <= gap) || (by1 <= ay0 && ay0 - by1 <= gap)))
        expect(glued, `${house.x},${house.y}`).toBe(false)
      }
    }
  })

  it("decor_follows_tile_tag", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly generated?: {
        readonly placement?: {
          readonly scene?: { readonly map?: readonly string[] }
          readonly street?: readonly { readonly id?: string; readonly x?: number; readonly y?: number }[]
          readonly trees?: readonly { readonly x?: number; readonly y?: number }[]
        }
      }
    }
    const map = pack.generated?.placement?.scene?.map ?? []
    const cell = (x: number, y: number): string => {
      const line = map[y]
      if (line === undefined || x < 0 || x >= line.length) return ""
      return line[x] ?? ""
    }
    for (const row of pack.generated?.placement?.street ?? []) {
      if (!(row.id ?? "").startsWith("phone_booth")) continue
      const ch = cell(row.x ?? 0, row.y ?? 0)
      expect(["s", "p"].includes(ch), `${row.id} on ${ch}`).toBe(true)
    }
    for (const row of pack.generated?.placement?.trees ?? []) {
      const ch = cell(row.x ?? 0, row.y ?? 0)
      expect(["r", "k", "c", "~", "s"].includes(ch), `tree on ${ch}`).toBe(false)
    }
    const man = JSON.parse(readFileSync(join(repo, "content/out/atlas/city.json"), "utf8")) as {
      readonly tile_w?: number
    }
    const tileW = BigInt(man.tile_w ?? 0)
    expect(tileW > 0n).toBe(true)
    const probe = ["......", "......", "..bb..", "..bb..", "..r...", "......"]
    const wall = tileCenter(2n, 2n, tileW)
    expect(pixelKept(wall.x, wall.y - tileW, probe, 2n, 2n, 2n, 2n, tileW, "building")).toBe(true)
    const road = tileCenter(2n, 4n, tileW)
    expect(pixelKept(road.x, road.y, probe, 2n, 2n, 2n, 2n, tileW, "building")).toBe(true)
    expect(pixelKept(road.x, road.y, probe, 2n, 4n, 1n, 1n, tileW, "decor")).toBe(true)
    expect(pixelKept(road.x, road.y, probe, 1n, 4n, 1n, 1n, tileW, "decor")).toBe(false)
  })

  it("water_plane_not_tiled_cubes", () => {
    const src = readFileSync(join(repo, "packages/render/src/pixi.ts"), "utf8")
    expect(src.includes("placeWaterPlane")).toBe(true)
    expect(src.includes("isShoreWater")).toBe(true)
    const map = ["~~~~", "~~~.", "~~~~"]
    expect(isShoreWater(map, 2n, 1n)).toBe(true)
    expect(isShoreWater(map, 1n, 1n)).toBe(false)
  })
})
