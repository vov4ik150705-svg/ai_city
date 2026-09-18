import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import { gpuCode } from "../src/gpu.ts"
import { islandBoxes, islandCells, landCells } from "../src/island.ts"
import { clampOrbit, orbitDefaultDistance, wrapOrbit } from "../src/orbit.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly render?: { readonly orbit_distance_default_tiles?: number }
    readonly placement?: {
      readonly grid_size?: number
      readonly scene?: unknown
      readonly zoom_levels?: readonly { readonly num?: number; readonly den?: number }[]
    }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly orbit_distance_min_tiles?: { readonly v?: number }
        readonly orbit_distance_max_tiles?: { readonly v?: number }
        readonly orbit_tilt_min_bps?: { readonly v?: number }
        readonly orbit_tilt_max_bps?: { readonly v?: number }
        readonly visual3_frame_live?: { readonly v?: number }
      }
    }
  }
}

describe.sequential("V3-1 construction", () => {
  it("visual3_island_from_legend", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
    const scene = pack.generated?.placement?.scene
    expect(scene).toBeDefined()
    const cells = islandCells(scene, 1n, 0n)
    expect(cells.length > 0).toBe(true)
    let water = 0
    let land = 0
    for (const cell of cells) {
      if (cell.kind === "~") {
        expect(cell.y).toBe(0n)
        water += 1
      } else {
        expect(cell.y).toBe(1n)
        land += 1
      }
    }
    expect(water > 0).toBe(true)
    expect(land > 0).toBe(true)
    const boxes = islandBoxes(scene)
    expect(boxes.length > 0).toBe(true)
    expect(islandCells({ map: [], objects: [] }, 1n, 0n).length).toBe(0)
    const src = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(src.includes('from "three"') || src.includes("from 'three'")).toBe(true)
    expect(src.includes("mountIsland3")).toBe(true)
    expect(src.includes("GLTFLoader")).toBe(true)
    expect(src.includes("islandCells")).toBe(false)
    expect(src.includes("landCells")).toBe(false)
    expect(landCells(islandCells({ map: ["..", ".."], objects: [] }, 1n, 0n)).length).toBe(4)
  })

  it("visual3_orbit_from_pack", () => {
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
    const params = pack.sections?.render?.params
    const minD = BigInt(params?.orbit_distance_min_tiles?.v ?? 0)
    const maxD = BigInt(params?.orbit_distance_max_tiles?.v ?? 0)
    const minT = BigInt(params?.orbit_tilt_min_bps?.v ?? 0)
    const maxT = BigInt(params?.orbit_tilt_max_bps?.v ?? 0)
    expect(minD > 0n).toBe(true)
    expect(maxD > minD).toBe(true)
    expect(minT > 0n).toBe(true)
    expect(maxT > minT).toBe(true)
    const zoom = pack.generated?.placement?.zoom_levels ?? []
    const zoomNums = new Set<number>()
    for (const lv of zoom) {
      if ((lv.den ?? 0) === 1) zoomNums.add(lv.num ?? 0)
    }
    expect(zoomNums.has(Number(minD))).toBe(false)
    expect(zoomNums.has(Number(maxD))).toBe(false)
    expect(clampOrbit(0n, minD, maxD)).toBe(minD)
    expect(clampOrbit(maxD + 1n, minD, maxD)).toBe(maxD)
    expect(orbitDefaultDistance(minD, maxD)).toBe(
      BigInt(pack.generated?.render?.orbit_distance_default_tiles ?? 0),
    )
    const span = 1n + 1n
    expect(wrapOrbit(0n - 1n, span)).toBe(1n)
    const orbitSrc = readFileSync(join(repo, "packages/render/src/orbit.ts"), "utf8")
    expect(orbitSrc.includes("zoom_levels")).toBe(false)
    expect(orbitSrc.includes("zoomAt")).toBe(false)
    expect(orbitSrc.includes("clampOrbit")).toBe(true)
  })

  it("visual3_no_gpu_stays", () => {
    expect(gpuCode({ webgl2: false, webgl: false })).toBe(codes.RENDER_NO_GPU)
    expect(gpuCode({ webgl2: true, webgl: false })).toBe("")
    expect(packFrameLive()).toBe(1)
    const host = readFileSync(join(repo, "apps/client/src/hud/SceneHost.tsx"), "utf8")
    expect(host.includes("@corporator/render/pixi")).toBe(false)
    expect(host.includes("mountIsland3")).toBe(true)
    expect(host.includes("island_mass.glb")).toBe(true)
    expect(host.includes("content/out/heroes")).toBe(false)
    expect(host.includes("RENDER_NO_GPU") || host.includes("codes.RENDER_NO_GPU")).toBe(true)
    const gpuSrc = readFileSync(join(repo, "packages/render/src/gpu.ts"), "utf8")
    expect(gpuSrc.includes("RENDER_NO_GPU")).toBe(true)
  })
})

function packFrameLive(): number {
  const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
  return pack.sections?.render?.params?.visual3_frame_live?.v ?? 0
}
