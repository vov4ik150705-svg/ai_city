import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  clampCamera,
  hitFromWorld,
  routeSceneClick,
  screenToWorld,
  snapZoomIndex,
  stepZoomIndex,
  zoomAt,
  zoomInPack,
  type CamBounds,
  type ZoomLevel,
} from "../src/camera.ts"
import { inTileDiamond, tileCenter, tileFromWorld } from "../src/iso.ts"
import { pinchZoomDir } from "../src/input.ts"
import type { SceneObject } from "../src/ground.ts"
import type { SpriteFrame } from "../src/sprites.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly placement?: {
      readonly zoom_levels?: readonly { readonly num?: number; readonly den?: number }[]
      readonly camera_bounds?: {
        readonly min_x?: number
        readonly min_y?: number
        readonly max_x?: number
        readonly max_y?: number
      }
      readonly iso_w_px?: number
      readonly iso_h_px?: number
      readonly safe_rect_w_px?: number
      readonly safe_rect_h_px?: number
      readonly zoom_min_scale_num?: number
      readonly zoom_min_scale_den?: number
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function asBig(n: number | undefined): bigint {
  return BigInt(n ?? 0)
}

function packedLevels(pack: PackFile): ZoomLevel[] {
  const rows = pack.generated?.placement?.zoom_levels ?? []
  const out: ZoomLevel[] = []
  for (const lv of rows) {
    out.push({ num: asBig(lv.num), den: asBig(lv.den) })
  }
  return out
}

function packedBounds(pack: PackFile): CamBounds {
  const b = pack.generated?.placement?.camera_bounds ?? {}
  return {
    minX: asBig(b.min_x),
    minY: asBig(b.min_y),
    maxX: asBig(b.max_x),
    maxY: asBig(b.max_y),
  }
}

function frame(kind: string, cols: bigint, rows: bigint): SpriteFrame {
  return { footX: 0n, footY: 0n, cols, rows, kind, w: 1n, h: 1n }
}

describe("v6", () => {
  it("zoom_levels_from_pack", () => {
    const pack = loadPack()
    const levels = packedLevels(pack)
    expect(levels.length > 0).toBe(true)
    const minN = asBig(pack.generated?.placement?.zoom_min_scale_num)
    const minD = asBig(pack.generated?.placement?.zoom_min_scale_den)
    expect(zoomInPack(minN, minD, levels)).toBe(true)
    expect(zoomInPack(1n, 1n, levels)).toBe(true)
    const three = 1n + 1n + 1n
    const two = 1n + 1n
    expect(zoomInPack(three, two, levels)).toBe(false)
    const count = BigInt(levels.length)
    expect(snapZoomIndex(0n - 1n, count)).toBe(0n)
    expect(snapZoomIndex(count + 1n, count)).toBe(count - 1n)
    expect(stepZoomIndex(count - 1n, 1n, count)).toBe(count - 1n)
    const first = zoomAt(levels, 0n)
    expect(first.num * minD === minN * first.den).toBe(true)
    const isoW = asBig(pack.generated?.placement?.iso_w_px)
    const isoH = asBig(pack.generated?.placement?.iso_h_px)
    const safeW = asBig(pack.generated?.placement?.safe_rect_w_px)
    const safeH = asBig(pack.generated?.placement?.safe_rect_h_px)
    expect(isoW * minN <= safeW * minD).toBe(true)
    expect(isoH * minN <= safeH * minD).toBe(true)
    const bps = 10000n
    expect(pinchZoomDir(100n, 101n, 1500n, bps)).toBe(0n)
    expect(pinchZoomDir(100n, 120n, 1500n, bps)).toBe(1n)
  })

  it("camera_clamped_to_bounds", () => {
    const bounds = packedBounds(loadPack())
    expect(bounds.minX < bounds.maxX).toBe(true)
    expect(bounds.minY < bounds.maxY).toBe(true)
    const lo = clampCamera(bounds.minX - 1n, bounds.minY - 1n, bounds)
    expect(lo.x).toBe(bounds.minX)
    expect(lo.y).toBe(bounds.minY)
    const hi = clampCamera(bounds.maxX + 1n, bounds.maxY + 1n, bounds)
    expect(hi.x).toBe(bounds.maxX)
    expect(hi.y).toBe(bounds.maxY)
    const mid = clampCamera(bounds.minX, bounds.maxY, bounds)
    expect(mid.x).toBe(bounds.minX)
    expect(mid.y).toBe(bounds.maxY)
  })

  it("click_maps_to_tile", () => {
    const pack = loadPack()
    const tileW = 64n
    const two = 1n + 1n
    const halfW = tileW / two
    const quarterH = halfW / two
    const tx = 5n
    const ty = 5n
    const c = tileCenter(tx, ty, tileW)
    expect(tileFromWorld(c.x, c.y, tileW)).toEqual({ tx, ty })
    const corners: readonly { readonly x: bigint; readonly y: bigint }[] = [
      { x: c.x, y: c.y - quarterH / two },
      { x: c.x + halfW / two, y: c.y },
      { x: c.x, y: c.y + quarterH / two },
      { x: c.x - halfW / two, y: c.y },
    ]
    for (const p of corners) {
      expect(inTileDiamond(p.x, p.y, tx, ty, tileW)).toBe(true)
      expect(tileFromWorld(p.x, p.y, tileW)).toEqual({ tx, ty })
    }
    const levels = packedLevels(pack)
    const viewW = asBig(pack.generated?.placement?.safe_rect_w_px)
    const viewH = asBig(pack.generated?.placement?.safe_rect_h_px)
    for (const lv of levels) {
      const world = screenToWorld(
        viewW / two,
        viewH / two,
        tx,
        ty,
        lv.num,
        lv.den,
        viewW,
        viewH,
        tileW,
      )
      expect(tileFromWorld(world.x, world.y, tileW)).toEqual({ tx, ty })
    }
    const waterHit = hitFromWorld(
      c.x,
      c.y,
      tileW,
      ["~~~~~~~", "~~~~~~~", "~~~~~~~", "~~~~~~~", "~~~~~~~", "~~~~~~~", "~~~~~~~"],
      [],
      {},
    )
    expect(routeSceneClick(waterHit, {}, {})).toBe("build")
    const workshop: SceneObject = { id: "workshop", tileX: tx, tileY: ty }
    const beacon: SceneObject = { id: "ai_research_center", tileX: tx, tileY: ty }
    const frames: { readonly [id: string]: SpriteFrame } = {
      workshop: frame("building", two, two),
      ai_research_center: frame("building", two, two),
    }
    const land = [".......", ".......", ".......", ".......", ".......", ".......", "......."]
    const shopHit = hitFromWorld(c.x, c.y, tileW, land, [workshop], frames)
    expect(shopHit.objectId).toBe("workshop")
    expect(routeSceneClick(shopHit, { ai_research_center: "compute" }, {})).toBe("building_card")
    expect(routeSceneClick(shopHit, { ai_research_center: "compute" }, {})).not.toBe("commit:build")
    const closed = hitFromWorld(c.x, c.y, tileW, land, [beacon], frames)
    expect(routeSceneClick(closed, { ai_research_center: "compute" }, {})).toBe("districts")
    const opened = hitFromWorld(c.x, c.y, tileW, land, [beacon], frames)
    expect(routeSceneClick(opened, { ai_research_center: "compute" }, { compute: 1n })).toBe(
      "building_card",
    )
  })
})
