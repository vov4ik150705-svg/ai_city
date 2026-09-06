import { Container, Graphics, Sprite, type Texture } from "pixi.js"
import { popupPose, type PopupEvent } from "./fx.js"
import { cellAt } from "./ground.js"
import {
  atlasFrame,
  billboardSpriteId,
  birdVisible,
  droneBobSpriteId,
  dronePose,
  droneShadowPos,
  flagSpriteId,
  isBackgroundUnit,
  shadowAlphaBps,
  shoreWaveSpriteId,
  smokeSpriteId,
  turbineSpriteId,
  vehicleDirSprite,
  vehiclePose,
  waterfallSpriteId,
  type BlockRect,
  type DroneStart,
  type VehicleStart,
} from "./motion.js"
import { footprintDiamond, painterDepth, spriteScreenPos, cloudLift, type AtlasFrame } from "./sprites.js"

export type MotionPack = {
  readonly layoutSeed: string
  readonly vehicleSpeed: bigint
  readonly vehicleStride: bigint
  readonly droneSpeed: bigint
  readonly droneAlt: bigint
  readonly droneBob: bigint
  readonly droneBobPeriod: bigint
  readonly turbineFrames: bigint
  readonly turbinePeriod: bigint
  readonly smokeFrames: bigint
  readonly flagFrames: bigint
  readonly billboardPeriod: bigint
  readonly birdsPerDay: bigint
  readonly prngBytes: bigint
  readonly fxPopupRise: bigint
  readonly fxTickGlowBps: bigint
  readonly fxAlphaSteps: bigint
  readonly fxEnabled: boolean
  readonly fxGlowOn: boolean
  readonly minutesPerHour: bigint
  readonly ticksDay: bigint
  readonly gradeBps: bigint
  readonly blocks: readonly BlockRect[]
  readonly drones: readonly DroneStart[]
  readonly vehicles: readonly VehicleStart[]
  readonly popups: readonly PopupEvent[]
}

export type MotionHandle = {
  apply(cityTime: bigint): void
}

function placeAt(parent: Container, tex: Texture, x: bigint, y: bigint): Sprite {
  const sprite = new Sprite(tex)
  sprite.roundPixels = true
  sprite.x = Number(x)
  sprite.y = Number(y)
  parent.addChild(sprite)
  return sprite
}

export function mountMotion(args: {
  readonly map: readonly string[]
  readonly objects: readonly { readonly id: string; readonly tileX: bigint; readonly tileY: bigint }[]
  readonly frames: { readonly [id: string]: AtlasFrame }
  readonly tex: (id: string) => Texture | undefined
  readonly tileW: bigint
  readonly cubeH: bigint
  readonly shadowTint: number
  readonly spriteLayer: Container
  readonly shadowLayer: Container
  readonly fxLayer: Container
  readonly pack: MotionPack
}): MotionHandle {
  const pin = (
    sprite: Sprite,
    sid: string,
    tileX: bigint,
    tileY: bigint,
    lift: bigint,
  ): void => {
    const tex = args.tex(sid)
    const fr = args.frames[sid]
    if (tex !== undefined) sprite.texture = tex
    if (fr === undefined) return
    const pos = spriteScreenPos(
      tileX,
      tileY,
      fr.cols,
      fr.rows,
      args.tileW,
      args.cubeH,
      fr.footX,
      fr.footY,
      lift,
    )
    sprite.x = Number(pos.x)
    sprite.y = Number(pos.y)
    sprite.zIndex = Number(painterDepth(tileX, tileY, fr.cols, fr.rows))
  }
  const cars: Sprite[] = []
  for (const _start of args.pack.vehicles) {
    void _start
    const tex = args.tex("vehicle_dir_e") ?? args.tex("vehicle")
    if (tex === undefined) continue
    cars.push(placeAt(args.spriteLayer, tex, 0n, 0n))
  }
  const drones: { readonly sprite: Sprite; readonly shadow: Graphics; readonly start: DroneStart }[] = []
  for (const start of args.pack.drones) {
    const tex = args.tex("drone_bob_0") ?? args.tex("drone")
    if (tex === undefined) continue
    const shadow = new Graphics()
    args.shadowLayer.addChild(shadow)
    drones.push({ sprite: placeAt(args.spriteLayer, tex, 0n, 0n), shadow, start })
  }
  let birdHome: { readonly tileX: bigint; readonly tileY: bigint } | undefined
  for (const obj of args.objects) {
    if (!obj.id.startsWith("cloud")) continue
    birdHome = { tileX: obj.tileX, tileY: obj.tileY }
    break
  }
  const birdTex = args.tex("bird")
  const birdSprite = birdTex === undefined ? undefined : placeAt(args.spriteLayer, birdTex, 0n, 0n)
  if (birdSprite !== undefined) birdSprite.visible = false
  const smokes: { readonly sprite: Sprite; readonly tileX: bigint; readonly tileY: bigint }[] = []
  for (const obj of args.objects) {
    if (isBackgroundUnit(obj.id)) continue
    if (obj.id !== "energy_plant" && obj.id !== "workshop") continue
    const tex = args.tex("smoke")
    if (tex === undefined) continue
    smokes.push({ sprite: placeAt(args.spriteLayer, tex, 0n, 0n), tileX: obj.tileX, tileY: obj.tileY })
  }
  const flags: { readonly sprite: Sprite; readonly tileX: bigint; readonly tileY: bigint }[] = []
  for (const obj of args.objects) {
    if (obj.id !== "city_hall") continue
    const tex = args.tex("flag_0") ?? args.tex("banner")
    if (tex === undefined) continue
    flags.push({ sprite: placeAt(args.spriteLayer, tex, 0n, 0n), tileX: obj.tileX, tileY: obj.tileY })
  }
  const turbines: { readonly sprite: Sprite; readonly tileX: bigint; readonly tileY: bigint }[] = []
  for (const obj of args.objects) {
    if (obj.id !== "wind_turbine") continue
    const tex = args.tex("turbine_blade_0")
    if (tex === undefined) continue
    turbines.push({ sprite: placeAt(args.spriteLayer, tex, 0n, 0n), tileX: obj.tileX, tileY: obj.tileY })
  }
  const boards: { readonly sprite: Sprite; readonly tileX: bigint; readonly tileY: bigint }[] = []
  for (const obj of args.objects) {
    if (obj.id !== "district_billboard") continue
    const tex = args.tex("billboard_0")
    if (tex === undefined) continue
    boards.push({ sprite: placeAt(args.spriteLayer, tex, 0n, 0n), tileX: obj.tileX, tileY: obj.tileY })
  }
  const falls: { readonly sprite: Sprite; readonly tileX: bigint; readonly tileY: bigint }[] = []
  const waves: { readonly sprite: Sprite; readonly tileX: bigint; readonly tileY: bigint }[] = []
  let wy = 0n
  while (wy < BigInt(args.map.length)) {
    const line = args.map[Number(wy)] ?? ""
    let wx = 0n
    while (wx < BigInt(line.length)) {
      const ch = cellAt(args.map, wx, wy)
      if (ch === "w") {
        const tex = args.tex("waterfall_0")
        if (tex !== undefined) {
          falls.push({ sprite: placeAt(args.spriteLayer, tex, 0n, 0n), tileX: wx, tileY: wy })
        }
      }
      if (ch === "b") {
        const stride = args.pack.flagFrames
        if (stride > 0n && (wx + wy) % stride === 0n) {
          const tex = args.tex("shore_wave_0")
          if (tex !== undefined) {
            waves.push({ sprite: placeAt(args.spriteLayer, tex, 0n, 0n), tileX: wx, tileY: wy })
          }
        }
      }
      wx += 1n
    }
    wy += 1n
  }

  const apply = (cityTime: bigint): void => {
    const p = args.pack
    let i = 0n
    for (const car of cars) {
      const start = p.vehicles[Number(i)]
      if (start === undefined) break
      const pose = vehiclePose(
        args.map,
        start,
        i,
        cityTime,
        p.minutesPerHour,
        p.vehicleSpeed,
        p.vehicleStride,
        p.prngBytes,
        p.layoutSeed,
      )
      const sid = vehicleDirSprite(pose.dx, pose.dy)
      const live = args.frames[sid] !== undefined ? sid : "vehicle"
      const dirTex = args.tex(live)
      if (dirTex !== undefined) car.texture = dirTex
      const fr = args.frames[live]
      if (fr !== undefined) {
        const pos = spriteScreenPos(
          pose.tileX,
          pose.tileY,
          fr.cols,
          fr.rows,
          args.tileW,
          args.cubeH,
          fr.footX,
          fr.footY,
          0n,
        )
        const next = spriteScreenPos(
          pose.nextX,
          pose.nextY,
          fr.cols,
          fr.rows,
          args.tileW,
          args.cubeH,
          fr.footX,
          fr.footY,
          0n,
        )
        car.x = Number(pos.x + ((next.x - pos.x) * pose.fracNum) / pose.fracDen)
        car.y = Number(pos.y + ((next.y - pos.y) * pose.fracNum) / pose.fracDen)
        car.zIndex = Number(painterDepth(pose.tileX, pose.tileY, fr.cols, fr.rows))
      }
      i += 1n
    }
    for (const drone of drones) {
      const blk = p.blocks[Number(drone.start.blockId)]
      const pose = dronePose(
        drone.start,
        blk,
        cityTime,
        p.minutesPerHour,
        p.droneSpeed,
        p.droneAlt,
        p.droneBob,
        p.droneBobPeriod,
      )
      const bobId = droneBobSpriteId(atlasFrame(cityTime, p.droneBobPeriod, p.flagFrames))
      const droneLive = args.frames[bobId] !== undefined ? bobId : "drone"
      const bobTex = args.tex(droneLive)
      if (bobTex !== undefined) drone.sprite.texture = bobTex
      const fr = args.frames[droneLive]
      if (fr !== undefined) {
        const pos = spriteScreenPos(
          pose.tileX,
          pose.tileY,
          fr.cols,
          fr.rows,
          args.tileW,
          args.cubeH,
          fr.footX,
          fr.footY,
          pose.altitude,
        )
        const next = spriteScreenPos(
          pose.nextX,
          pose.nextY,
          fr.cols,
          fr.rows,
          args.tileW,
          args.cubeH,
          fr.footX,
          fr.footY,
          pose.altitude,
        )
        drone.sprite.x = Number(pos.x + ((next.x - pos.x) * pose.fracNum) / pose.fracDen)
        drone.sprite.y = Number(pos.y + ((next.y - pos.y) * pose.fracNum) / pose.fracDen)
        drone.sprite.zIndex = Number(painterDepth(pose.tileX, pose.tileY, fr.cols, fr.rows))
      }
      void droneShadowPos(pose, args.tileW)
      const diamond = footprintDiamond(pose.tileX, pose.tileY, 1n, 1n, args.tileW, args.cubeH)
      const alpha = Number(shadowAlphaBps(pose.altitude, p.droneAlt, p.gradeBps)) / Number(p.gradeBps)
      const nums: number[] = []
      for (const pt of diamond) nums.push(Number(pt.x), Number(pt.y))
      drone.shadow.clear()
      drone.shadow.poly(nums, true)
      drone.shadow.fill({ color: args.shadowTint, alpha })
    }
    const smokeId = smokeSpriteId(atlasFrame(cityTime, 1n, p.smokeFrames))
    const smokeTex = args.tex(smokeId)
    for (const row of smokes) {
      if (smokeTex !== undefined) row.sprite.texture = smokeTex
      pin(row.sprite, smokeId, row.tileX, row.tileY, args.tileW)
    }
    const flagId = flagSpriteId(atlasFrame(cityTime, 1n, p.flagFrames))
    for (const row of flags) {
      pin(row.sprite, flagId, row.tileX, row.tileY, args.cubeH)
    }
    const bladeId = turbineSpriteId(atlasFrame(cityTime, p.turbinePeriod, p.turbineFrames))
    for (const row of turbines) {
      pin(row.sprite, bladeId, row.tileX, row.tileY, 0n)
    }
    const boardId = billboardSpriteId(atlasFrame(cityTime, p.billboardPeriod, p.flagFrames))
    for (const row of boards) {
      pin(row.sprite, boardId, row.tileX, row.tileY, 0n)
    }
    const fallId = waterfallSpriteId(atlasFrame(cityTime, 1n, p.flagFrames))
    for (const row of falls) {
      pin(row.sprite, fallId, row.tileX, row.tileY, 0n)
    }
    const waveId = shoreWaveSpriteId(atlasFrame(cityTime, 1n, p.flagFrames))
    for (const row of waves) {
      pin(row.sprite, waveId, row.tileX, row.tileY, 0n)
    }
    const shown = birdVisible(cityTime, p.ticksDay, p.birdsPerDay)
    if (birdSprite !== undefined && birdHome !== undefined) {
      birdSprite.visible = shown
      if (shown) {
        pin(birdSprite, "bird", birdHome.tileX, birdHome.tileY, cloudLift("cloud_small", args.tileW))
      }
    }
    args.fxLayer.removeChildren()
    if (!p.fxEnabled) return
    for (const ev of p.popups) {
      const pose = popupPose(cityTime, ev, 1n, p.fxPopupRise, p.fxAlphaSteps)
      if (pose === undefined) continue
      const origin = footprintDiamond(pose.tileX, pose.tileY, 1n, 1n, args.tileW, args.cubeH)
      const top = origin[0]
      if (top === undefined) continue
      const a = Number(pose.alphaNum) / Number(pose.alphaDen)
      const g = new Graphics()
      g.rect(Number(top.x), Number(top.y) - Number(pose.rise), 1, 1)
      g.fill({ color: args.shadowTint, alpha: a })
      args.fxLayer.addChild(g)
      void pose.amount
    }
  }

  apply(0n)
  return { apply }
}
