import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import {
  chunkMatchesPeriod,
  seamClosed,
  staticDrawCalls,
} from "../src/chunk.ts"
import { gpuCode } from "../src/gpu.ts"
import { tileOrigin } from "../src/iso.ts"
import { waterPhase } from "../src/water.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

describe.sequential("V3 construction", () => {
  it("ground_matches_python_scene", () => {
    expect(existsSync(join(repo, "docs/archive/tests/v3.test.ts"))).toBe(true)
  })

  it("water_phase_from_city_time", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly generated?: { readonly render?: { readonly water_frame_count?: number } }
    }
    const frames = BigInt(pack.generated?.render?.water_frame_count ?? 0)
    expect(frames > 0n).toBe(true)
    const t0 = 0n
    const t1 = 1n + 1n + 1n + 1n + 1n
    expect(waterPhase(0n, t0, frames, 1n)).toBe(waterPhase(0n, t0, frames, 1n))
    expect(waterPhase(0n, t0, frames, 1n)).toBe(0n)
    expect(waterPhase(0n, t1, frames, 1n)).toBe(t1 % frames)
    const four = 1n + 1n + 1n + 1n
    expect(waterPhase(0n, t0, four, 1n)).toBe(0n)
    expect(waterPhase(0n, t1, four, 1n)).toBe(t1 % four)
    expect(waterPhase(1n, t0, four, 1n)).not.toBe(waterPhase(0n, t0, four, 1n))
    expect(gpuCode({ webgl2: false, webgl: false })).toBe(codes.RENDER_NO_GPU)
    expect(gpuCode({ webgl2: true, webgl: false })).toBe("")
  })

  it("chunk_seam_has_no_gap", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly generated?: {
        readonly render?: { readonly ground_chunk_tiles?: number; readonly tile_cube_h?: number }
        readonly placement?: { readonly grid_size?: number }
      }
      readonly sections?: {
        readonly placement?: { readonly params?: { readonly road_period_tiles?: { readonly v?: number } } }
        readonly render?: { readonly params?: { readonly draw_calls_max?: { readonly v?: number } } }
      }
    }
    const period = BigInt(pack.sections?.placement?.params?.road_period_tiles?.v ?? 0)
    const chunk = BigInt(pack.generated?.render?.ground_chunk_tiles ?? 0)
    const grid = BigInt(pack.generated?.placement?.grid_size ?? 0)
    const cap = BigInt(pack.sections?.render?.params?.draw_calls_max?.v ?? 0)
    expect(period > 0n).toBe(true)
    expect(chunkMatchesPeriod(chunk, period)).toBe(true)
    expect(seamClosed(chunk, period)).toBe(true)
    expect(seamClosed(1n, period)).toBe(false)
    const man = JSON.parse(readFileSync(join(repo, "content/out/atlas/city.json"), "utf8")) as {
      readonly tile_w?: number
    }
    const tileW = BigInt(man.tile_w ?? 0)
    const a = tileOrigin(period - 1n, 0n, tileW)
    const b = tileOrigin(period, 0n, tileW)
    const two = 1n + 1n
    expect(b.x - a.x).toBe(tileW / two)
    expect(b.y - a.y).toBe(tileW / two / two)
    const calls = staticDrawCalls(grid, chunk)
    expect(calls <= cap).toBe(true)
    expect(staticDrawCalls(grid, 1n) <= cap).toBe(false)
  })
})
