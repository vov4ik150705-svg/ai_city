import { Container, Graphics, Sprite, type Texture } from "pixi.js"
import type { SceneObject } from "./ground.js"
import { spriteGlows } from "./light.js"
import { isMotionUnit, walkerFacing, walkerSpriteId } from "./motion.js"
import { blitGlyphs, joinLabel, measureGlyphs, type GlyphMetric } from "./glyphs.js"
import {
  badgeKind,
  badgeOnScene,
  badgePulseOn,
  badgeSprite,
  cloudLift,
  footprintDiamond,
  instanceFoot,
  instanceFlip,
  labelRank,
  objectIdle,
  overlayAt,
  pipWorldPos,
  skipOverlappingLabels,
  sortPlaced,
  spriteScreenPos,
  type AtlasFrame,
  type BadgeRow,
  type LabelBox,
  type OverlayRow,
  type Ranked,
  type SpriteFrame,
} from "./sprites.js"
import { keepMaskGraphics, needsColumnMask } from "./columnMask.js"
import type { IsoPoint } from "./iso.js"

export type ObjectPaint = {
  readonly badges: Sprite[]
}

function toFrame(fr: AtlasFrame): SpriteFrame {
  return {
    footX: fr.footX,
    footY: fr.footY,
    cols: fr.cols,
    rows: fr.rows,
    kind: fr.kind,
    w: fr.w,
    h: fr.h,
  }
}

function frameMap(frames: { readonly [id: string]: AtlasFrame }): {
  readonly [id: string]: SpriteFrame
} {
  const out: { [id: string]: SpriteFrame } = {}
  for (const id of Object.keys(frames)) {
    const fr = frames[id]
    if (fr === undefined) continue
    out[id] = toFrame(fr)
  }
  return out
}

export type ObjectOpts = {
  readonly objects: readonly SceneObject[]
  readonly frames: { readonly [id: string]: AtlasFrame }
  readonly tex: (id: string) => Texture | undefined
  readonly tileW: bigint
  readonly cubeH: bigint
  readonly pipStep: bigint
  readonly pipOffset: bigint
  readonly pulsePeriod: bigint
  readonly hoverOutlinePx: bigint
  readonly hoverTint: number
  readonly selectLift: bigint
  readonly contactAlphaBps: bigint
  readonly contactInsetBps: bigint
  readonly gradeBps: bigint
  readonly labelMinZoomNum: bigint
  readonly labelMinZoomDen: bigint
  readonly zoomNum: bigint
  readonly zoomDen: bigint
  readonly overlays: { readonly [lv: string]: OverlayRow }
  readonly badges: readonly BadgeRow[]
  readonly energy: bigint
  readonly compute: bigint
  readonly levels: { readonly [id: string]: bigint }
  readonly hoverId: string
  readonly selectedId: string
  readonly shadowTint: number
  readonly cityTime: bigint
  readonly shadowLayer: Container
  readonly spriteLayer: Container
  readonly overlayLayer: Container
  readonly labelLayer: Container
  readonly glowLayer: Container
  readonly glowTex: (id: string) => Texture | undefined
  readonly lampTint: number
  readonly labels: { readonly [id: string]: string }
  readonly tickers: { readonly [id: string]: string }
  readonly glyphs: { readonly [ch: string]: GlyphMetric }
  readonly fontTex: Texture | undefined
  readonly map: readonly string[]
}

function sourceOf(objects: readonly SceneObject[], row: Ranked): SceneObject {
  for (const obj of objects) {
    if (obj.id === row.id && obj.tileX === row.tileX && obj.tileY === row.tileY) return obj
  }
  return {
    id: row.id,
    tileX: row.tileX,
    tileY: row.tileY,
    ox: 0n,
    oy: 0n,
    lift: 0n,
    wPx: 0n,
    hPx: 0n,
    flip: 0n,
  }
}

function placeAt(parent: Container, tex: Texture, x: bigint, y: bigint): Sprite {
  const sprite = new Sprite(tex)
  sprite.roundPixels = true
  sprite.x = Number(x)
  sprite.y = Number(y)
  parent.addChild(sprite)
  return sprite
}

function drawContact(
  parent: Container,
  pts: readonly { readonly x: bigint; readonly y: bigint }[],
  fill: number,
  alphaBps: bigint,
  insetBps: bigint,
  gradeBps: bigint,
): void {
  const two = 1n + 1n
  const grade = gradeBps === 0n ? 1n : gradeBps
  const i2 = 1 + 1
  const left = pts[0]
  const top = pts[1]
  const right = pts[i2]
  const bottom = pts[i2 + 1]
  if (left === undefined || top === undefined || right === undefined || bottom === undefined) return
  const cx = (left.x + right.x) / two
  const cy = (top.y + bottom.y) / two
  const rx = ((right.x - left.x) * insetBps) / (two * grade)
  const ry = ((bottom.y - top.y) * insetBps) / (two * grade)
  if (rx <= 0n || ry <= 0n) return
  const alpha = Number(alphaBps) / Number(grade)
  if (alpha <= 0) return
  const g = new Graphics()
  g.ellipse(Number(cx), Number(cy), Number(rx), Number(ry))
  g.fill({ color: fill, alpha })
  parent.addChild(g)
}

function occupiedBuildings(
  objects: readonly SceneObject[],
  frames: { readonly [id: string]: SpriteFrame },
): readonly IsoPoint[] {
  const seen = new Set<string>()
  const out: IsoPoint[] = []
  for (const row of objects) {
    const fr = frames[row.id]
    if (fr === undefined || fr.kind !== "building") continue
    let dy = 0n
    while (dy < fr.rows) {
      let dx = 0n
      while (dx < fr.cols) {
        const p = { x: row.tileX + dx, y: row.tileY + dy }
        const k = `${p.x},${p.y}`
        if (!seen.has(k)) {
          seen.add(k)
          out.push(p)
        }
        dx += 1n
      }
      dy += 1n
    }
  }
  return out
}

function drawDiamond(
  parent: Container,
  pts: readonly { readonly x: bigint; readonly y: bigint }[],
  fill: number,
  fillAlpha: number,
  stroke: number,
  strokeAlpha: number,
  width: number,
): void {
  const g = new Graphics()
  const nums: number[] = []
  for (const p of pts) {
    nums.push(Number(p.x), Number(p.y))
  }
  g.poly(nums, true)
  if (fillAlpha > 0) g.fill({ color: fill, alpha: fillAlpha })
  if (strokeAlpha > 0 && width > 0) g.stroke({ width, color: stroke, alpha: strokeAlpha })
  parent.addChild(g)
}

export function paintObjects(opts: ObjectOpts): ObjectPaint {
  const frames = frameMap(opts.frames)
  const ranked = sortPlaced(opts.objects, frames)
  const occupied = occupiedBuildings(opts.objects, frames)
  const two = 1n + 1n
  const half = 1 / Number(two)
  const pulse = badgePulseOn(opts.cityTime, opts.pulsePeriod)
  const pulseAlpha = pulse ? 1 : half
  const badges: Sprite[] = []
  const labelBoxes: LabelBox[] = []

  for (const row of ranked) {
    if (isMotionUnit(row.id)) continue
    let bodyId = row.id
    if (row.id.startsWith("walker_")) {
      bodyId = walkerSpriteId(row.id, walkerFacing(opts.map, row.tileX, row.tileY))
    }
    const mapped = frames[bodyId] ?? frames[row.id]
    const tex = opts.tex(bodyId) ?? opts.tex(row.id)
    if (mapped === undefined || tex === undefined) continue
    const selected = opts.selectedId.length > 0 && opts.selectedId === row.id
    const extra = selected ? opts.selectLift : 0n
    const src = sourceOf(opts.objects, row)
    const inst = instanceFoot(
      mapped.footX,
      mapped.footY,
      mapped.w,
      mapped.h,
      src.wPx ?? 0n,
      src.hPx ?? 0n,
    )
    const flip = src.flip ?? 0n
    const footX = instanceFlip(inst.footX, inst.w, flip)
    const lift = cloudLift(row.id, opts.tileW) + extra + (src.lift ?? 0n)
    const pos = spriteScreenPos(
      row.tileX,
      row.tileY,
      row.cols,
      row.rows,
      opts.tileW,
      opts.cubeH,
      footX,
      inst.footY,
      lift,
    )
    const atX = pos.x + (src.ox ?? 0n)
    const atY = pos.y + (src.oy ?? 0n)
    const diamond = footprintDiamond(
      row.tileX,
      row.tileY,
      row.cols,
      row.rows,
      opts.tileW,
      opts.cubeH,
    )
    drawContact(
      opts.shadowLayer,
      diamond,
      opts.shadowTint,
      opts.contactAlphaBps,
      opts.contactInsetBps,
      opts.gradeBps,
    )
    const liveBody = row.id === "wind_turbine" || row.id === "district_billboard"
    if (!liveBody) {
      const wrap = new Container()
      wrap.zIndex = Number(row.depth)
      wrap.sortableChildren = true
      opts.spriteLayer.addChild(wrap)
      const spr = placeAt(wrap, tex, atX, atY)
      if (inst.w !== mapped.w) spr.width = Number(inst.w)
      if (inst.h !== mapped.h) spr.height = Number(inst.h)
      if (flip === 1n) {
        spr.scale.x = -1
        spr.x = Number(atX) + Number(inst.w)
      }
      if (
        mapped.kind !== "building" &&
        needsColumnMask(opts.map, row.tileX, row.tileY, row.cols, row.rows, occupied)
      ) {
        const g = keepMaskGraphics(
          opts.map,
          row.tileX,
          row.tileY,
          row.cols,
          row.rows,
          opts.tileW,
          mapped.h,
          occupied,
        )
        wrap.mask = g
        wrap.addChild(g)
      }
    }
    if (!liveBody && spriteGlows(mapped.kind, row.id)) {
      const gtex = opts.glowTex(row.id)
      if (gtex !== undefined) {
        const lamp = placeAt(opts.glowLayer, gtex, atX, atY)
        if (inst.w !== mapped.w) lamp.width = Number(inst.w)
        if (inst.h !== mapped.h) lamp.height = Number(inst.h)
        if (flip === 1n) {
          lamp.scale.x = -1
          lamp.x = Number(atX) + Number(inst.w)
        }
        lamp.blendMode = "add"
        lamp.tint = opts.lampTint
      }
    }

    const level = opts.levels[row.id] ?? 1n
    const overlay = overlayAt(level, opts.overlays)
    let pipI = 0n
    while (pipI < overlay.pips) {
      const pipTex = opts.tex("overlay_pip")
      const pipFr = frames["overlay_pip"]
      if (pipTex !== undefined && pipFr !== undefined) {
        const pip = pipWorldPos(
          row.tileX,
          row.tileY,
          row.cols,
          row.rows,
          opts.tileW,
          opts.cubeH,
          opts.pipStep,
          opts.pipOffset,
          pipI,
        )
        placeAt(opts.overlayLayer, pipTex, pip.x - pipFr.footX, pip.y - pipFr.footY)
      }
      pipI += 1n
    }
    if (overlay.antenna > 0n) {
      const antTex = opts.tex("overlay_antenna")
      const antFr = frames["overlay_antenna"]
      if (antTex !== undefined && antFr !== undefined) {
        const pip = pipWorldPos(
          row.tileX,
          row.tileY,
          row.cols,
          row.rows,
          opts.tileW,
          opts.cubeH,
          opts.pipStep,
          opts.pipOffset,
          overlay.pips,
        )
        placeAt(opts.overlayLayer, antTex, pip.x - antFr.footX, pip.y - antFr.footY)
      }
    }

    const code = objectIdle(mapped.kind, opts.energy, opts.compute)
    if (code.length > 0 && badgeOnScene(code, opts.badges)) {
      const sid = badgeSprite(badgeKind(code))
      const bTex = opts.tex(sid)
      const bFr = frames[sid]
      if (bTex !== undefined && bFr !== undefined) {
        const pip = pipWorldPos(
          row.tileX,
          row.tileY,
          row.cols,
          row.rows,
          opts.tileW,
          opts.cubeH,
          opts.pipStep,
          opts.pipOffset,
          overlay.pips + overlay.antenna + 1n,
        )
        const mark = placeAt(opts.overlayLayer, bTex, pip.x - bFr.footX, pip.y - bFr.footY)
        mark.alpha = pulseAlpha
        badges.push(mark)
      }
    }

    if (selected) {
      const ringTex = opts.tex("select_ring")
      const ringFr = frames["select_ring"]
      if (ringTex !== undefined && ringFr !== undefined) {
        placeAt(
          opts.overlayLayer,
          ringTex,
          pos.x + mapped.footX - ringFr.footX,
          pos.y + mapped.footY - ringFr.footY,
        )
      }
    }

    if (opts.hoverId.length > 0 && opts.hoverId === row.id) {
      drawDiamond(
        opts.overlayLayer,
        diamond,
        0,
        0,
        opts.hoverTint,
        opts.hoverOutlinePx > 0n ? 1 : 0,
        Number(opts.hoverOutlinePx),
      )
    }

    if (mapped.kind === "building") {
      const front = pipWorldPos(
        row.tileX,
        row.tileY,
        row.cols,
        row.rows,
        opts.tileW,
        opts.cubeH,
        0n,
        opts.pipOffset,
        0n,
      )
      const ticker = opts.tickers[row.id] ?? ""
      const name = opts.labels[row.id] ?? ""
      const level = opts.levels[row.id] ?? 0n
      const text = joinLabel(name, ticker, level)
      const textW = measureGlyphs(text, opts.glyphs)
      const halfW = opts.tileW / two
      const boxW = textW > 0n ? textW : opts.tileW
      labelBoxes.push({
        id: `${row.id}:${row.tileX.toString()}:${row.tileY.toString()}`,
        rank: ticker.length > 0 ? labelRank("beacon") : labelRank("base"),
        depth: row.depth,
        x: front.x - halfW,
        y: front.y - halfW,
        w: boxW,
        h: halfW,
        text,
      })
    }
  }

  const kept = new Set(skipOverlappingLabels(labelBoxes))
  for (const box of labelBoxes) {
    if (!kept.has(box.id)) continue
    const g = new Graphics()
    g.rect(Number(box.x), Number(box.y), Number(box.w), Number(box.h / two))
    g.fill({ color: opts.shadowTint, alpha: half })
    opts.labelLayer.addChild(g)
    const font = opts.fontTex
    if (font !== undefined && box.text.length > 0) {
      blitGlyphs(opts.labelLayer, box.text, box.x, box.y, font, opts.glyphs)
    }
  }

  opts.spriteLayer.sortableChildren = false
  return { badges }
}
