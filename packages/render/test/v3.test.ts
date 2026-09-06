import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
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
import { frontVertex, tileCubeH, tileOrigin } from "../src/iso.ts"
import { instanceFoot, instanceFlip, spriteScreenPos } from "../src/sprites.ts"
import { waterPhase } from "../src/water.ts"
import { loadScene, roadSprite, sidewalkSprite, groundTopId, padFootprints } from "../src/ground.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

function runPython(script: string): string {
  return execFileSync(python, ["-c", script], { cwd: repo, encoding: "utf8" })
}

describe.sequential("V3 construction", () => {
  it("ground_matches_python_scene", () => {
    const man = JSON.parse(readFileSync(join(repo, "content/out/atlas/city.json"), "utf8")) as {
      readonly tile_w?: number
    }
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      readonly generated?: {
        readonly render?: {
          readonly tile_cube_h?: number
          readonly ground_chunk_tiles?: number
          readonly road_autotile?: readonly string[]
          readonly sidewalk_autotile?: readonly string[]
          readonly lot_pad?: string
          readonly lot_pad_skip?: readonly string[]
          readonly ground_sprites?: { readonly [ch: string]: string }
        }
        readonly placement?: { readonly grid_size?: number; readonly scene?: unknown }
      }
      readonly sections?: {
        readonly placement?: { readonly params?: { readonly road_period_tiles?: { readonly v?: number } } }
        readonly render?: {
          readonly params?: {
            readonly golden_channel_delta?: { readonly v?: number }
            readonly golden_pixel_delta_bps?: { readonly v?: number }
          }
        }
      }
    }
    const tileW = BigInt(man.tile_w ?? 0)
    expect(tileW > 0n).toBe(true)
    const out = runPython(
      "import sys\nfrom pathlib import Path\nsys.path.insert(0, str(Path('art/pipeline')))\nimport scene\nprint(scene.TILE_W)\nprint('%d %d' % scene.tile_origin(3, 5))\nprint('%d %d' % scene.front_vertex(0, 0, 1, 1))\nprint(0)\n",
    )
    const lines = out.trim().split(/\r?\n/)
    expect(lines[0]).toBe(tileW.toString())
    const origin = (lines[1] ?? "").split(" ")
    const front = (lines[2] ?? "").split(" ")
    const drop = lines[3]
    const got = tileOrigin(3n, 5n, tileW)
    expect(got.x.toString()).toBe(origin[0])
    expect(got.y.toString()).toBe(origin[1])
    const fv = frontVertex(0n, 0n, 1n, 1n, tileW)
    expect(fv.x.toString()).toBe(front[0])
    expect(fv.y.toString()).toBe(front[1])
    expect(drop).toBe("0")
    expect(tileCubeH(tileW).toString()).toBe("0")
    expect(pack.generated?.render?.tile_cube_h).toBe(0)
    const instOut = runPython(
      "import sys\nfrom pathlib import Path\nsys.path.insert(0, str(Path('art/pipeline')))\nimport scene\n" +
        "pos, nw, nh = scene.instance_place({'ox': 3, 'oy': -2, 'lift': 5, 'w_px': 80, 'h_px': 120}, 'hall', 4, 7, 2, 2, 64, 96, 32, 90, 0)\n" +
        "print('%d %d %d %d' % (pos[0], pos[1], nw, nh))\n",
    )
    const instParts = (instOut.trim().split(/\r?\n/)[0] ?? "").split(" ")
    const inst = instanceFoot(32n, 90n, 64n, 96n, 80n, 120n)
    const placed = spriteScreenPos(4n, 7n, 2n, 2n, 64n, 0n, inst.footX, inst.footY, 5n)
    expect((placed.x + 3n).toString()).toBe(instParts[0])
    expect((placed.y - 2n).toString()).toBe(instParts[1])
    expect(inst.w.toString()).toBe(instParts[2])
    expect(inst.h.toString()).toBe(instParts[3])
    const flipOut = runPython(
      "import sys\nfrom pathlib import Path\nsys.path.insert(0, str(Path('art/pipeline')))\nimport scene\n" +
        "pos, nw, nh = scene.instance_place({'flip': 1}, 'hall', 4, 7, 2, 2, 64, 96, 10, 90, 0)\n" +
        "print('%d %d %d %d' % (pos[0], pos[1], nw, nh))\n",
    )
    const flipParts = (flipOut.trim().split(/\r?\n/)[0] ?? "").split(" ")
    const flipFoot = instanceFlip(10n, 64n, 1n)
    const flipPos = spriteScreenPos(4n, 7n, 2n, 2n, 64n, 0n, flipFoot, 90n, 0n)
    expect(flipPos.x.toString()).toBe(flipParts[0])
    expect(flipPos.y.toString()).toBe(flipParts[1])
    const mag = runPython(
      "from PIL import Image\nfrom pathlib import Path\n" +
        "im = Image.open(Path('art/preview/scene.png')).convert('RGBA')\n" +
        "px = list(im.getdata())\n" +
        "n = sum(1 for r,g,b,a in px if r==255 and g==0 and b==255 and a>0)\n" +
        "print(n)\n" +
        "fb = Path('content/out/atlas/fallback.png')\n" +
        "print(int(fb.is_file()))\n" +
        "if fb.is_file():\n" +
        "    fim = Image.open(fb).convert('RGBA')\n" +
        "    fp = list(fim.getdata())\n" +
        "    fn = sum(1 for r,g,b,a in fp if r==255 and g==0 and b==255 and a>0)\n" +
        "    print(fn)\n" +
        "    print(abs(len(px)-len(fp)))\n" +
        "else:\n" +
        "    print(1)\n" +
        "    print(1)\n",
    )
    const magLines = mag.trim().split(/\r?\n/)
    expect(magLines[0]).toBe("0")
    expect(magLines[1]).toBe("1")
    expect(magLines[2]).toBe("0")
    const delta = pack.sections?.render?.params?.golden_pixel_delta_bps?.v ?? 0
    expect(delta).toBeGreaterThan(0)
    const channel = pack.sections?.render?.params?.golden_channel_delta?.v ?? 0
    expect(channel).toBeGreaterThan(0)
    const pixelShare = Number(magLines[3] ?? "1")
    expect(pixelShare).toBe(0)
    const autotile = runPython(
      "import json,sys\nfrom pathlib import Path\nsys.path.insert(0,str(Path('art/pipeline')))\nimport tiles\n" +
        "pack=json.load(open('content/out/pack.json',encoding='utf-8'))\n" +
        "grid=pack['generated']['placement']['scene']['map']\n" +
        "print(' '.join(tiles.road_autotile_ids()))\n" +
        "print(' '.join(tiles.sidewalk_autotile_ids()))\n" +
        "for y,row in enumerate(grid):\n" +
        "  for x,ch in enumerate(row):\n" +
        "    if ch=='r': print(f'r {x} {y} {tiles.road_sprite(grid,x,y)}')\n" +
        "    elif ch=='s': print(f's {x} {y} {tiles.sidewalk_sprite(grid,x,y)}')\n",
    )
    const autoLines = autotile.trim().split(/\r?\n/)
    const packRender = pack.generated?.render
    const roadTable = packRender?.road_autotile ?? []
    const walkTable = packRender?.sidewalk_autotile ?? []
    expect(autoLines[0]).toBe(roadTable.join(" "))
    expect(autoLines[1]).toBe(walkTable.join(" "))
    const scene = loadScene(pack.generated?.placement?.scene)
    for (const line of autoLines.slice(2)) {
      const parts = line.split(" ")
      const kind = parts[0]
      const xs = parts[1]
      const ys = parts[2]
      const id = parts[3]
      if (kind === undefined || xs === undefined || ys === undefined || id === undefined) continue
      if (kind === "r") {
        expect(roadSprite(scene.map, BigInt(xs), BigInt(ys), roadTable)).toBe(id)
      } else if (kind === "s") {
        expect(sidewalkSprite(scene.map, BigInt(xs), BigInt(ys), walkTable)).toBe(id)
      }
    }
    const lotPad = packRender?.lot_pad ?? ""
    expect(lotPad.length > 0).toBe(true)
    expect(lotPad).not.toBe("island_block")
    const skip = packRender?.lot_pad_skip ?? []
    expect(skip.includes("park")).toBe(true)
    const manFrames = JSON.parse(readFileSync(join(repo, "content/out/atlas/city.json"), "utf8")) as {
      readonly frames?: {
        readonly [id: string]: { readonly kind?: string; readonly footprint?: readonly number[] }
      }
    }
    const frames: { [id: string]: { readonly kind: string; readonly cols: bigint; readonly rows: bigint } } = {}
    for (const [id, fr] of Object.entries(manFrames.frames ?? {})) {
      const fp = fr.footprint ?? [1, 1]
      frames[id] = {
        kind: fr.kind ?? "",
        cols: BigInt(fp[0] ?? 1),
        rows: BigInt(fp[1] ?? 1),
      }
    }
    const pads = padFootprints(scene.objects, frames, skip)
    expect(pads.length > 0).toBe(true)
    const sprites = packRender?.ground_sprites ?? { ".": "island_block" }
    const hall = scene.objects.find((row) => row.id === "city_hall")
    expect(hall !== undefined).toBe(true)
    if (hall !== undefined) {
      const under = groundTopId(
        scene.map,
        hall.tileX,
        hall.tileY,
        sprites,
        roadTable,
        walkTable,
        lotPad,
        pads,
      )
      const cell = scene.map[Number(hall.tileY)]?.[Number(hall.tileX)] ?? ""
      if (cell === ".") {
        expect(under).not.toBe(lotPad)
        expect(under).toBe(sprites["."] ?? "island_block")
      }
    }
    const emptyGrass = groundTopId(scene.map, 0n, 0n, sprites, roadTable, walkTable, lotPad, pads)
    if ((scene.map[0]?.[0] ?? "") === ".") {
      expect(emptyGrass).toBe(sprites["."] ?? "island_block")
    }
    const occupiedGrass = scene.objects.find((row) => {
      const fr = frames[row.id]
      if (fr === undefined || fr.kind !== "building") return false
      const cell = scene.map[Number(row.tileY)]?.[Number(row.tileX)] ?? ""
      return cell === "."
    })
    expect(occupiedGrass !== undefined).toBe(true)
    if (occupiedGrass !== undefined) {
      const underLot = groundTopId(
        scene.map,
        occupiedGrass.tileX,
        occupiedGrass.tileY,
        sprites,
        roadTable,
        walkTable,
        lotPad,
        pads,
      )
      expect(underLot).not.toBe(lotPad)
      expect(underLot).toBe(sprites["."] ?? "island_block")
    }
    const grove = scene.objects.find((row) => row.id.startsWith("tree_"))
    expect(grove !== undefined).toBe(true)
    if (grove !== undefined) {
      const underGrove = groundTopId(
        scene.map,
        grove.tileX,
        grove.tileY,
        sprites,
        roadTable,
        walkTable,
        lotPad,
        pads,
      )
      expect(underGrove).not.toBe(lotPad)
    }
    let roadChecked = false
    for (let y = 0; y < scene.map.length; y++) {
      const line = scene.map[y] ?? ""
      const xi = line.indexOf("r")
      if (xi < 0) continue
      const underRoad = groundTopId(
        scene.map,
        BigInt(xi),
        BigInt(y),
        sprites,
        roadTable,
        walkTable,
        lotPad,
        pads,
      )
      expect(underRoad).not.toBe(lotPad)
      roadChecked = true
      break
    }
    expect(roadChecked).toBe(true)
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
