import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import {
  copiedFromCaps,
  observeVisual3Budgets,
  underVisualCaps,
  type VisualCaps,
} from "../src/budget.ts"
import { gpuCode } from "../src/gpu.ts"
import { loadHeroCatalog, plantHeroes } from "../src/heroes.ts"
import { islandBoxes, islandCells, landCells, plantWater, shoreFoam } from "../src/island.ts"
import { isPackedWalker, plantUnits } from "../src/units.ts"
import {
  decorOfKind,
  isPackedDecor,
  isPackedDrone,
  isPackedVehicle,
  plantDecor,
  type DecorKind,
} from "../src/world.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

type PackFile = {
  readonly generated?: {
    readonly render?: {
      readonly atlas_bytes?: number
      readonly atlas_page_count?: number
      readonly hero_catalog?: unknown
    }
    readonly placement?: {
      readonly scene?: unknown
      readonly grid_size?: number
      readonly reference_layout?: unknown
      readonly vehicles?: readonly unknown[]
      readonly drones?: readonly unknown[]
    }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly draw_calls_max?: { readonly v?: number }
        readonly sprite_instances_max?: { readonly v?: number }
        readonly atlas_max_bytes?: { readonly v?: number }
        readonly texture_bytes_max?: { readonly v?: number }
        readonly atlas_page_px?: { readonly v?: number }
        readonly visual3_frame_live?: { readonly v?: number }
      }
    }
    readonly arch?: {
      readonly params?: { readonly client_bundle_max_bytes?: { readonly v?: number } }
    }
    readonly screens?: { readonly params?: { readonly missions_live?: { readonly v?: number } } }
    readonly companion?: {
      readonly params?: { readonly companion_revenue_live?: { readonly v?: number } }
    }
    readonly seasons?: { readonly params?: { readonly prize_nft_share_bps?: { readonly v?: number } } }
    readonly fragments?: {
      readonly params?: { readonly fragment_nft_share_bps?: { readonly v?: number } }
    }
  }
}

function asBig(n: number | undefined): bigint {
  return BigInt(n ?? 0)
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function bundleBytes(): bigint {
  const dist = join(repo, "apps/client/dist-web")
  let total = 0n
  function walk(dir: string): void {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name)
      if (name.isDirectory()) {
        walk(p)
        continue
      }
      if (name.name.endsWith(".js") || name.name.endsWith(".mjs")) {
        total += BigInt(statSync(p).size)
      }
    }
  }
  walk(dist)
  return total
}

function capsOf(pack: PackFile): VisualCaps {
  const rp = pack.sections?.render?.params
  return {
    drawCallsMax: asBig(rp?.draw_calls_max?.v),
    spriteInstancesMax: asBig(rp?.sprite_instances_max?.v),
    atlasMaxBytes: asBig(rp?.atlas_max_bytes?.v),
    textureBytesMax: asBig(rp?.texture_bytes_max?.v),
    bundleMaxBytes: asBig(pack.sections?.arch?.params?.client_bundle_max_bytes?.v),
  }
}

describe.sequential("V3-7 construction", () => {
  it("visual3_budgets_measured", () => {
    const pack = loadPack()
    const scene = pack.generated?.placement?.scene
    const grid = asBig(pack.generated?.placement?.grid_size)
    const cells = landCells(islandCells(scene, 1n, 0n))
    const foam = shoreFoam(scene, 0n)
    const sea = plantWater(grid, 0n)
    expect(sea.span).toBe(Number(grid))
    const catalog = loadHeroCatalog(pack.generated?.render?.hero_catalog)
    const lots = plantHeroes(pack.generated?.placement?.reference_layout, catalog)
    const heroIds: { [id: string]: true } = {}
    for (const lot of lots) heroIds[lot.id] = true
    let leftover = 0n
    for (const row of islandBoxes(scene)) {
      if (heroIds[row.id] === true) continue
      if (isPackedWalker(row.id)) continue
      if (isPackedDecor(row.id)) continue
      if (isPackedVehicle(row.id) || isPackedDrone(row.id)) continue
      leftover += 1n
    }
    const planted = plantDecor(scene)
    const kinds: readonly DecorKind[] = ["lantern", "furniture", "plant", "hull"]
    let families = 0n
    for (const kind of kinds) {
      if (decorOfKind(planted, kind).length > 0) families += 1n
    }
    const units = plantUnits(scene)
    const vehicles = asBig(pack.generated?.placement?.vehicles?.length)
    const drones = asBig(pack.generated?.placement?.drones?.length)
    const pages = asBig(pack.generated?.render?.atlas_page_count)
    const glowPages = pages > 0n ? 1n : 0n
    const bundle = bundleBytes()
    expect(bundle > 0n).toBe(true)
    const obs = observeVisual3Budgets({
      landTiles: BigInt(cells.length),
      waterPlanes: 1n,
      foamTiles: BigInt(foam.length),
      leftoverBoxes: leftover,
      walkers: BigInt(units.length),
      decorFamilies: families,
      vehicles,
      drones,
      heroesVisible: BigInt(lots.length),
      sprites: asBig(islandBoxes(scene).length),
      atlasBytes: asBig(pack.generated?.render?.atlas_bytes),
      pagePx: asBig(pack.sections?.render?.params?.atlas_page_px?.v),
      colorPages: pages,
      glowPages,
      bundleBytes: bundle,
    })
    const caps = capsOf(pack)
    expect(underVisualCaps(obs, caps)).toBe(true)
    expect(copiedFromCaps(obs, caps)).toBe(false)
    const md = readFileSync(join(repo, "docs/reports/GATE_VISUAL.md"), "utf8")
    expect(md.includes("observe.software")).toBe(true)
    expect(md.includes("observe.desktop")).toBe(true)
    expect(md.includes(`draw_calls=${obs.drawCalls.toString()}`)).toBe(true)
    expect(md.includes(`sprites=${obs.sprites.toString()}`)).toBe(true)
    expect(md.includes(`atlas_bytes=${obs.atlasBytes.toString()}`)).toBe(true)
    expect(md.includes(`texture_bytes=${obs.textureBytes.toString()}`)).toBe(true)
    expect(md.includes(`bundle_bytes=${obs.bundleBytes.toString()}`)).toBe(true)
    expect(md.includes("observedFromThresholds")).toBe(false)
    expect(pack.sections?.render?.params?.visual3_frame_live?.v).toBe(1)
    expect(pack.sections?.screens?.params?.missions_live?.v).toBe(0)
    expect(pack.sections?.companion?.params?.companion_revenue_live?.v).toBe(0)
    expect(pack.sections?.seasons?.params?.prize_nft_share_bps?.v).toBe(0)
    expect(pack.sections?.fragments?.params?.fragment_nft_share_bps?.v).toBe(0)
  })

  it("visual3_golden_frames_match", () => {
    const script =
      "from PIL import Image\nimport numpy as np\n" +
      "im=np.array(Image.open('content/out/atlas/fallback.png').convert('RGB'))\n" +
      "sc=np.array(Image.open('art/preview/scene.png').convert('RGB'))\n" +
      "def mag(a):\n    return int(((a[:,:,0]==255)&(a[:,:,1]==0)&(a[:,:,2]==255)).sum())\n" +
      "print(mag(im))\nprint(mag(sc))\n"
    const out = execFileSync(python, ["-c", script], { cwd: repo, encoding: "utf8" }).trim().split(/\r?\n/)
    expect(out[0]).toBe("0")
    expect(out[1]).toBe("0")
    expect(gpuCode({ webgl2: false, webgl: false })).toBe(codes.RENDER_NO_GPU)
    const md = readFileSync(join(repo, "docs/reports/GATE_VISUAL.md"), "utf8")
    expect(/^# GATE_VISUAL — v3 /m.test(md)).toBe(true)
    expect(md.includes("archive.v12.software")).toBe(true)
    expect(existsSync(join(repo, "art/preview/scene.png"))).toBe(true)
  })
})
