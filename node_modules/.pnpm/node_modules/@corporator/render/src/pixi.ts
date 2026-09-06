import {
  Application,
  ColorMatrixFilter,
  Container,
  Filter,
  Sprite,
  Texture,
  type ColorMatrix,
} from "pixi.js"
import { codes } from "@corporator/protocol"
import {
  cameraWorldOffset,
  screenToWorld,
  hitFromWorld,
  type TileHit,
} from "./camera.js"
import { chunkCount, chunkIndex } from "./chunk.js"
import { cellAt, isShore, loadScene, groundTopId, padFootprints } from "./ground.js"
import { gpuCode, type GpuProbe } from "./gpu.js"
import { tileOrigin } from "./iso.js"
import {
  currentPhase,
  glowGainBps,
  hourOfDay,
  hoursLeftInPhase,
  nextPhase,
  phaseBlendBps,
  type PhaseRow,
} from "./light.js"
import { paintObjects } from "./objects.js"
import { placeCube, placeWaterPlane, textureOf } from "./pixiDraw.js"
import { mountMotion, type MotionPack } from "./pixiMotion.js"
import type { GlyphMetric } from "./glyphs.js"
import type { AtlasFrame, BadgeRow, OverlayRow } from "./sprites.js"
import { badgePulseOn, labelsVisible } from "./sprites.js"
import { glowGainWithTick } from "./fx.js"
import { snapLutFilter } from "./lut.js"
import { waterFrameId, isShoreWater } from "./water.js"

export type { AtlasFrame, BadgeRow, OverlayRow } from "./sprites.js"
export type { GlyphMetric } from "./glyphs.js"
export type { PhaseRow } from "./light.js"
export type { TileHit } from "./camera.js"
export type { MotionPack } from "./pixiMotion.js"

export type GradeTint = {
  readonly r: number
  readonly g: number
  readonly b: number
}

export type IslandOpts = {
  readonly host: HTMLElement
  readonly scene: unknown
  readonly sprites: { readonly [ch: string]: string }
  readonly frames: { readonly [id: string]: AtlasFrame }
  readonly atlas: HTMLImageElement | ImageBitmap
  readonly tileW: bigint
  readonly cubeH: bigint
  readonly chunkTiles: bigint
  readonly waterFrames: bigint
  readonly waterSteps: bigint
  readonly waterStrip: readonly string[]
  readonly roadAutotile: readonly string[]
  readonly sidewalkAutotile: readonly string[]
  readonly shadowOffset: bigint
  readonly shallowId: string
  readonly deepId: string
  readonly dirtId: string
  readonly cliffId: string
  readonly rockId: string
  readonly lotPadId: string
  readonly lotPadSkip: readonly string[]
  readonly cityTime: bigint
  readonly background: number
  readonly zoomNum: bigint
  readonly zoomDen: bigint
  readonly shadowTint: number
  readonly probe: GpuProbe
  readonly pipStep: bigint
  readonly pipOffset: bigint
  readonly pulsePeriod: bigint
  readonly hoverOutlinePx: bigint
  readonly hoverTint: number
  readonly selectLift: bigint
  readonly contactAlphaBps: bigint
  readonly contactInsetBps: bigint
  readonly labelMinZoomNum: bigint
  readonly labelMinZoomDen: bigint
  readonly overlays: { readonly [lv: string]: OverlayRow }
  readonly badges: readonly BadgeRow[]
  readonly energy: bigint
  readonly compute: bigint
  readonly levels: { readonly [id: string]: bigint }
  readonly hoverId: string
  readonly selectedId: string
  readonly glowAtlas: HTMLImageElement | ImageBitmap
  readonly snapLut: HTMLImageElement | ImageBitmap | undefined
  readonly snapLutSide: bigint
  readonly phases: readonly PhaseRow[]
  readonly blendMinutes: bigint
  readonly minutesPerHour: bigint
  readonly ticksDay: bigint
  readonly emissiveBps: bigint
  readonly gradeBps: bigint
  readonly tints: { readonly [name: string]: GradeTint }
  readonly lampTint: number
  readonly motion: MotionPack
  readonly labels: { readonly [id: string]: string }
  readonly tickers: { readonly [id: string]: string }
  readonly glyphs: { readonly [ch: string]: GlyphMetric }
  readonly fontAtlas: HTMLImageElement | ImageBitmap | undefined
}

import { emptyHandle, type IslandHandle } from "./frame.js"
export type { IslandHandle } from "./frame.js"

export async function mountIsland(opts: IslandOpts): Promise<IslandHandle> {
  const refused = gpuCode(opts.probe)
  if (refused.length > 0) return emptyHandle(refused)

  const scene = loadScene(opts.scene)
  const app = new Application()
  try {
    await app.init({
      preference: "webgl",
      autoStart: false,
      antialias: false,
      roundPixels: true,
      autoDensity: false,
      resizeTo: opts.host,
      background: opts.background,
    })
  } catch {
    return emptyHandle(codes.RENDER_NO_GPU)
  }

  opts.host.appendChild(app.canvas)
  void opts.dirtId
  void opts.rockId
  const base = Texture.from(opts.atlas)
  base.source.scaleMode = "nearest"

  const world = new Container()
  const graded = new Container()
  const waterLayer = new Container()
  const shadowLayer = new Container()
  const topLayer = new Container()
  const objShadow = new Container()
  const spriteLayer = new Container()
  spriteLayer.sortableChildren = true
  const overlayLayer = new Container()
  const labelLayer = new Container()
  const fxLayer = new Container()
  const glowLayer = new Container()
  const gradeFilter = new ColorMatrixFilter()
  const gradeFilters: Filter[] = [gradeFilter]
  if (opts.snapLut !== undefined) {
    const snap = snapLutFilter(opts.snapLut, opts.snapLutSide)
    if (snap !== undefined) gradeFilters.push(snap)
  }
  graded.filters = gradeFilters
  graded.addChild(waterLayer)
  graded.addChild(shadowLayer)
  graded.addChild(topLayer)
  graded.addChild(objShadow)
  graded.addChild(spriteLayer)
  graded.addChild(overlayLayer)
  graded.addChild(labelLayer)
  graded.addChild(fxLayer)
  world.addChild(graded)
  world.addChild(glowLayer)
  const glowBase = Texture.from(opts.glowAtlas)
  glowBase.source.scaleMode = "nearest"

  const sizeY = BigInt(scene.map.length)
  let sizeX = 0n
  for (const line of scene.map) {
    const n = BigInt(line.length)
    if (n > sizeX) sizeX = n
  }
  const grid = sizeX > sizeY ? sizeX : sizeY
  const chunks = chunkCount(grid, opts.chunkTiles)
  const chunkBoxes: Container[] = []
  {
    let cy = 0n
    while (cy < chunks) {
      let cx = 0n
      while (cx < chunks) {
        const box = new Container()
        const origin = tileOrigin(cx * opts.chunkTiles, cy * opts.chunkTiles, opts.tileW)
        box.x = Number(origin.x)
        box.y = Number(origin.y)
        chunkBoxes.push(box)
        topLayer.addChild(box)
        cx += 1n
      }
      cy += 1n
    }
  }

  const waterPlaced: { readonly sprite: Sprite; readonly tx: bigint; readonly ty: bigint }[] = []
  const waterTex: { [id: string]: Texture } = {}
  const texWater = (sid: string): Texture | undefined => {
    const cached = waterTex[sid]
    if (cached !== undefined) return cached
    const made = textureOf(base, opts.frames, sid)
    if (made !== undefined) waterTex[sid] = made
    return made
  }

  placeWaterPlane(
    waterLayer,
    opts.background,
    tileOrigin(0n, 0n, opts.tileW),
    tileOrigin(sizeX, 0n, opts.tileW),
    tileOrigin(0n, sizeY, opts.tileW),
    tileOrigin(sizeX, sizeY, opts.tileW),
    opts.cubeH,
    opts.tileW,
  )

  const pads = padFootprints(scene.objects, opts.frames, opts.lotPadSkip)

  let ty = 0n
  while (ty < sizeY) {
    const line = scene.map[Number(ty)] ?? ""
    let tx = 0n
    while (tx < BigInt(line.length)) {
      const ch = cellAt(scene.map, tx, ty)
      const origin = tileOrigin(tx, ty, opts.tileW)
      if (ch === "~") {
        if (isShoreWater(scene.map, tx, ty)) {
          const sid = waterFrameId(
            scene.map,
            tx,
            ty,
            1n + 1n,
            opts.waterStrip,
            opts.deepId,
            opts.cityTime,
            opts.waterSteps,
            opts.waterFrames,
          )
          const tex = texWater(sid)
          const fr = opts.frames[sid]
          if (tex !== undefined && fr !== undefined) {
            const spr = placeCube(waterLayer, tex, fr, origin.x, origin.y, opts.tileW, 0n)
            waterPlaced.push({ sprite: spr, tx, ty })
          }
        }
      } else if (ch.length > 0) {
        const topId = groundTopId(
          scene.map,
          tx,
          ty,
          opts.sprites,
          opts.roadAutotile,
          opts.sidewalkAutotile,
          opts.lotPadId,
          pads,
        )
        const topTex = textureOf(base, opts.frames, topId)
        const topFr = opts.frames[topId]
        if (topTex !== undefined && topFr !== undefined) {
          const ci = chunkIndex(tx, opts.chunkTiles)
          const cj = chunkIndex(ty, opts.chunkTiles)
          const box = chunkBoxes[Number(cj * chunks + ci)]
          if (box !== undefined) {
            const local = tileOrigin(
              tx - ci * opts.chunkTiles,
              ty - cj * opts.chunkTiles,
              opts.tileW,
            )
            const shadow = placeCube(
              shadowLayer,
              topTex,
              topFr,
              origin.x + opts.shadowOffset,
              origin.y + opts.shadowOffset,
              opts.tileW,
              0n,
            )
            shadow.tint = opts.shadowTint
            if (isShore(scene.map, tx, ty)) {
              const cliffTex = textureOf(base, opts.frames, opts.cliffId)
              const cliffFr = opts.frames[opts.cliffId]
              if (cliffTex !== undefined && cliffFr !== undefined) {
                placeCube(box, cliffTex, cliffFr, local.x, local.y, opts.tileW, 0n)
              }
            }
            placeCube(box, topTex, topFr, local.x, local.y, opts.tileW, 0n)
          }
        }
      }
      tx += 1n
    }
    ty += 1n
  }

  for (const box of chunkBoxes) {
    box.cacheAsTexture(true)
  }

  const painted = paintObjects({
    objects: scene.objects,
    frames: opts.frames,
    tex: (id) => textureOf(base, opts.frames, id),
    tileW: opts.tileW,
    cubeH: opts.cubeH,
    pipStep: opts.pipStep,
    pipOffset: opts.pipOffset,
    pulsePeriod: opts.pulsePeriod,
    hoverOutlinePx: opts.hoverOutlinePx,
    hoverTint: opts.hoverTint,
    selectLift: opts.selectLift,
    contactAlphaBps: opts.contactAlphaBps,
    contactInsetBps: opts.contactInsetBps,
    gradeBps: opts.gradeBps,
    labelMinZoomNum: opts.labelMinZoomNum,
    labelMinZoomDen: opts.labelMinZoomDen,
    zoomNum: opts.zoomNum,
    zoomDen: opts.zoomDen,
    overlays: opts.overlays,
    badges: opts.badges,
    energy: opts.energy,
    compute: opts.compute,
    levels: opts.levels,
    hoverId: opts.hoverId,
    selectedId: opts.selectedId,
    shadowTint: opts.shadowTint,
    cityTime: opts.cityTime,
    shadowLayer: objShadow,
    spriteLayer,
    overlayLayer,
    labelLayer,
    glowLayer,
    glowTex: (id) => textureOf(glowBase, opts.frames, id),
    lampTint: opts.lampTint,
    labels: opts.labels,
    tickers: opts.tickers,
    glyphs: opts.glyphs,
    fontTex: opts.fontAtlas === undefined ? undefined : Texture.from(opts.fontAtlas),
    map: scene.map,
  })

  const motion = mountMotion({
    map: scene.map,
    objects: scene.objects,
    frames: opts.frames,
    tex: (id) => textureOf(base, opts.frames, id),
    tileW: opts.tileW,
    cubeH: opts.cubeH,
    shadowTint: opts.shadowTint,
    spriteLayer,
    shadowLayer: objShadow,
    fxLayer,
    pack: opts.motion,
  })
  motion.apply(opts.cityTime)

  const den = opts.zoomDen === 0n ? 1n : opts.zoomDen
  world.scale.set(Number(opts.zoomNum) / Number(den))
  app.stage.addChild(world)

  let camX = 0n
  let camY = 0n
  let camZoomNum = opts.zoomNum
  let camZoomDen = opts.zoomDen === 0n ? 1n : opts.zoomDen

  const viewSize = (): { readonly w: bigint; readonly h: bigint } => {
    return {
      w: BigInt(app.screen.width | 0),
      h: BigInt(app.screen.height | 0),
    }
  }

  const applyCamera = (tx: bigint, ty: bigint, zNum: bigint, zDen: bigint): void => {
    camX = tx
    camY = ty
    camZoomNum = zNum === 0n ? 1n : zNum
    camZoomDen = zDen === 0n ? 1n : zDen
    const view = viewSize()
    const off = cameraWorldOffset(camX, camY, camZoomNum, camZoomDen, view.w, view.h, opts.tileW)
    world.x = Number(off.x)
    world.y = Number(off.y)
    world.scale.set(Number(camZoomNum) / Number(camZoomDen))
    labelLayer.visible = labelsVisible(
      camZoomNum,
      camZoomDen,
      opts.labelMinZoomNum,
      opts.labelMinZoomDen,
    )
  }

  applyCamera(0n, 0n, opts.zoomNum, opts.zoomDen)

  const applyLight = (cityTime: bigint): void => {
    const hour = hourOfDay(cityTime, opts.ticksDay)
    const cur = currentPhase(hour, opts.phases, opts.ticksDay)
    const nxt = nextPhase(hour, opts.phases, opts.ticksDay)
    const bps = opts.gradeBps <= 0n ? 1n : opts.gradeBps
    let mix = 0
    let r = 0
    let g = 0
    let b = 0
    if (cur !== undefined) {
      const leftH = hoursLeftInPhase(
        hour,
        cur.startHour,
        cur.durationHours,
        opts.ticksDay,
      )
      const blend = phaseBlendBps(leftH * opts.minutesPerHour, opts.blendMinutes, bps)
      const t = Number(blend) / Number(bps)
      const ta = opts.tints[cur.name]
      const tb = nxt !== undefined ? opts.tints[nxt.name] : ta
      const a0 = Number(cur.tintAlphaBps) / Number(bps)
      const a1 = nxt !== undefined ? Number(nxt.tintAlphaBps) / Number(bps) : a0
      mix = a0 * (1 - t) + a1 * t
      if (ta !== undefined) {
        const other = tb ?? ta
        r = ta.r * (1 - t) + other.r * t
        g = ta.g * (1 - t) + other.g * t
        b = ta.b * (1 - t) + other.b * t
      }
      const baseGain = glowGainBps(cur.lights, opts.emissiveBps)
      const gain = glowGainWithTick(
        baseGain,
        opts.motion.fxEnabled && opts.motion.fxGlowOn,
        opts.motion.fxTickGlowBps,
        bps,
      )
      glowLayer.visible = gain > 0n
      glowLayer.alpha = Number(gain) / Number(bps)
    } else {
      glowLayer.visible = false
    }
    const keep = 1 - mix
    const matrix: number[] = []
    matrix.push(keep, 0, 0, 0, r * mix)
    matrix.push(0, keep, 0, 0, g * mix)
    matrix.push(0, 0, keep, 0, b * mix)
    matrix.push(0, 0, 0, 1, 0)
    gradeFilter.matrix = matrix as ColorMatrix
  }

  applyLight(opts.cityTime)

  const applyWater = (cityTime: bigint): void => {
    const reach = 1n + 1n
    for (const cell of waterPlaced) {
      const sid = waterFrameId(
        scene.map,
        cell.tx,
        cell.ty,
        reach,
        opts.waterStrip,
        opts.deepId,
        cityTime,
        opts.waterSteps,
        opts.waterFrames,
      )
      const tex = texWater(sid)
      if (tex !== undefined) cell.sprite.texture = tex
    }
  }

  applyWater(opts.cityTime)
  app.render()

  return {
    code: "",
    setCityTime(cityTime: bigint): void {
      const two = 1n + 1n
      const on = badgePulseOn(cityTime, opts.pulsePeriod)
      const alpha = on ? 1 : 1 / Number(two)
      for (const mark of painted.badges) {
        mark.alpha = alpha
      }
      motion.apply(cityTime)
      applyLight(cityTime)
      applyWater(cityTime)
      app.render()
    },
    setCamera(tileX: bigint, tileY: bigint, zoomNum: bigint, zoomDen: bigint): void {
      applyCamera(tileX, tileY, zoomNum, zoomDen)
      app.render()
    },
    setOrbit(azimuthBps: bigint, tiltBps: bigint, distance: bigint): void {
      void azimuthBps
      void tiltBps
      void distance
    },
    hitAt(sx: bigint, sy: bigint): TileHit {
      const view = viewSize()
      const worldPt = screenToWorld(
        sx,
        sy,
        camX,
        camY,
        camZoomNum,
        camZoomDen,
        view.w,
        view.h,
        opts.tileW,
      )
      return hitFromWorld(worldPt.x, worldPt.y, opts.tileW, scene.map, scene.objects, opts.frames)
    },
    destroy(): void {
      app.destroy(
        { removeView: true, releaseGlobalResources: true },
        { children: true, texture: true, textureSource: true },
      )
    },
  }
}
