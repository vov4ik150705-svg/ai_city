import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { islandCells, landCells, plantWater, shoreFoam } from "../src/island.ts"
import { loadScene } from "../src/ground.ts"
import { isShoreWater } from "../src/water.ts"
import {
  decorKind,
  isPackedDecor,
  isPackedDrone,
  isPackedVehicle,
  plantDecor,
  poseVehicle,
  vehicleWorldXZ,
} from "../src/world.ts"
import { vehiclePose } from "../src/motion.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly placement?: {
      readonly grid_size?: number
      readonly scene?: unknown
      readonly vehicles?: readonly { readonly x?: number; readonly y?: number }[]
    }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly decor_height_bps?: { readonly v?: number }
        readonly lantern_height_bps?: { readonly v?: number }
        readonly canopy_height_bps?: { readonly v?: number }
        readonly vehicle_height_bps?: { readonly v?: number }
        readonly drone_hover_height_bps?: { readonly v?: number }
        readonly grade_bps?: { readonly v?: number }
      }
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

describe.sequential("V3-6 construction", () => {
  it("visual3_water_one_plane", () => {
    const pack = loadPack()
    const scene = pack.generated?.placement?.scene
    const grid = BigInt(pack.generated?.placement?.grid_size ?? 0)
    expect(grid > 0n).toBe(true)
    const cells = islandCells(scene, 1n, 0n)
    const land = landCells(cells)
    expect(land.length < cells.length).toBe(true)
    for (const cell of land) {
      expect(cell.kind === "~").toBe(false)
    }
    const sea = plantWater(grid, 0n)
    expect(sea.span).toBe(Number(grid))
    const foam = shoreFoam(scene, 0n)
    expect(foam.length > 0).toBe(true)
    const map = loadScene(scene).map
    for (const row of foam) {
      expect(isShoreWater(map, row.tileX, row.tileY)).toBe(true)
    }
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("plantWater")).toBe(true)
    expect(threeSrc.includes("landCells")).toBe(true)
    expect(threeSrc.includes("shoreFoam")).toBe(true)
    expect(threeSrc.includes("HemisphereLight")).toBe(true)
  })

  it("visual3_decor_instanced", () => {
    const pack = loadPack()
    const planted = plantDecor(pack.generated?.placement?.scene)
    expect(planted.length > 0).toBe(true)
    for (const row of planted) {
      expect(isPackedDecor(row.id)).toBe(true)
      expect(decorKind(row.id).length > 0).toBe(true)
    }
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("plantDecor")).toBe(true)
    expect(threeSrc.includes("InstancedMesh")).toBe(true)
    expect(threeSrc.includes("isPackedDecor")).toBe(true)
    expect(threeSrc.includes("isPackedVehicle")).toBe(true)
    expect(threeSrc.includes("from \"pixi.js\"")).toBe(false)
    const params = pack.sections?.render?.params
    expect((params?.decor_height_bps?.v ?? 0) > 0).toBe(true)
    expect((params?.lantern_height_bps?.v ?? 0) > 0).toBe(true)
    expect((params?.canopy_height_bps?.v ?? 0) > 0).toBe(true)
  })

  it("visual3_fill_light_no_physics", () => {
    const pack = loadPack()
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("HemisphereLight")).toBe(true)
    expect(threeSrc.includes("poseVehicle")).toBe(true)
    expect(threeSrc.includes("poseDrone")).toBe(true)
    expect(threeSrc.includes("cannon")).toBe(false)
    expect(threeSrc.includes("Rapier")).toBe(false)
    const worldSrc = readFileSync(join(repo, "packages/render/src/world.ts"), "utf8")
    expect(worldSrc.includes("Math.random")).toBe(false)
    expect(worldSrc.includes("Date")).toBe(false)
    expect(isPackedVehicle("vehicle")).toBe(true)
    expect(isPackedVehicle("vehicle_ambulance")).toBe(true)
    expect(isPackedDrone("drone")).toBe(true)
    const vehicles = pack.generated?.placement?.vehicles ?? []
    expect(vehicles.length > 0).toBe(true)
    const first = vehicles[0]
    expect(first).toBeDefined()
    if (first === undefined) return
    const map = loadScene(pack.generated?.placement?.scene).map
    const start = { x: BigInt(first.x ?? 0), y: BigInt(first.y ?? 0) }
    const bytes = 8n
    const a = poseVehicle(map, start, 0n, 0n, 1n, 1n, 1n, bytes, "1", 1n, 1n, 1n)
    const b = poseVehicle(map, start, 0n, 0n, 1n, 1n, 1n, bytes, "1", 1n, 1n, 1n)
    expect(a).toEqual(b)
    const pose = vehiclePose(map, start, 0n, 0n, 1n, 1n, 1n, bytes, "1")
    const xz = vehicleWorldXZ(pose, 1n, 1n, 1n)
    expect(xz.y > 0).toBe(true)
    const params = pack.sections?.render?.params
    expect((params?.vehicle_height_bps?.v ?? 0) > 0).toBe(true)
    expect((params?.drone_hover_height_bps?.v ?? 0) > 0).toBe(true)
    expect((params?.grade_bps?.v ?? 0) > 0).toBe(true)
  })
})
