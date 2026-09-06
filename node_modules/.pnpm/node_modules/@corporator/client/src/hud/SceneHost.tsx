import { useEffect, useRef, useState, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { gpuCode, probeCanvas } from "@corporator/render"
import type { HeroCatalogRow } from "@corporator/render"
import { mountIsland3, type IslandHandle } from "@corporator/render/three"
import { wallNowMs } from "../clock.js"
import { hexToPixi, rampHex } from "../palette.js"
import type { Palette } from "../palette.js"
import type { ClientCamera, ClientLight, ClientMotion } from "../packview.js"
import { applyCam, bindSceneInput, lookCam, startCam, type CamPos } from "./sceneInput.js"

const FALLBACK_PNG = new URL("../../../../content/out/atlas/fallback.png", import.meta.url).href
const HERO_GLB = import.meta.glob("../../../../content/out/heroes/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as { readonly [path: string]: string }

function heroUrl(file: string): string {
  for (const [path, url] of Object.entries(HERO_GLB)) {
    if (path.endsWith("/" + file) || path.endsWith("\\" + file)) return url
  }
  return ""
}

async function heroBytes(file: string): Promise<ArrayBuffer> {
  const url = heroUrl(file)
  if (url.length === 0) return new ArrayBuffer(0)
  const res = await fetch(url)
  return await res.arrayBuffer()
}

function kindColors(palette: Palette): { readonly [ch: string]: number } {
  const hex = (ramp: string, index: bigint): number => hexToPixi(rampHex(palette, ramp, index))
  const two = 1n + 1n
  const three = two + 1n
  const four = two + two
  const five = four + 1n
  const six = three + three
  return {
    "~": hex("navy", 0n),
    ".": hex("green", two),
    r: hex("concrete", two),
    s: hex("concrete", four),
    c: hex("concrete", five),
    p: hex("concrete", three),
    m: hex("concrete", 1n),
    k: hex("concrete", two),
    b: hex("amber", two),
    d: hex("amber", 1n),
    w: hex("blue", two),
    object: hex("concrete", six),
    walker: hex("amber", 1n),
    robot: hex("concrete", six),
    foam: hex("blue", 1n),
    lantern: hex("amber", 0n),
    furniture: hex("concrete", three),
    plant: hex("green", 1n),
    hull: hex("navy", 1n),
    vehicle: hex("concrete", 0n),
    drone: hex("concrete", five),
  }
}

export function SceneHost(props: {
  readonly scene: unknown
  readonly palette: Palette
  readonly gridSize: bigint
  readonly camera: ClientCamera
  readonly cityTime: bigint
  readonly lookId: string
  readonly lookRev: bigint
  readonly opened: { readonly [district: string]: bigint }
  readonly onSceneRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void
  readonly noGpuText: string
  readonly lots: unknown
  readonly heroCatalog: { readonly [id: string]: HeroCatalogRow }
  readonly lodNear: bigint
  readonly light: ClientLight
  readonly ticksDay: bigint
  readonly unitHeightBps: bigint
  readonly unitShiftPeriod: bigint
  readonly unitShiftSpanBps: bigint
  readonly motion: ClientMotion
  readonly decorHeightBps: bigint
  readonly lanternHeightBps: bigint
  readonly canopyHeightBps: bigint
  readonly vehicleHeightBps: bigint
  readonly droneHoverHeightBps: bigint
}): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<IslandHandle | undefined>(undefined)
  const camRef = useRef<CamPos>(startCam(props.camera))
  const routeRef = useRef(props.onSceneRoute)
  routeRef.current = props.onSceneRoute
  const [code, setCode] = useState("")
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const canvas = document.createElement("canvas")
    const probe = probeCanvas(canvas)
    const refused = gpuCode(probe)
    if (refused.length > 0) {
      setCode(refused)
      return
    }
    let alive = true
    let unbind: (() => void) | undefined
    const colors = kindColors(props.palette)
    const orbit = props.camera.orbit
    void (async () => {
      const mounted = await mountIsland3({
        host,
        scene: props.scene,
        probe,
        gridSize: props.gridSize,
        landY: 1n,
        waterY: 0n,
        azimuthBps: orbit.azimuthBps,
        tiltBps: clampMid(orbit.tiltMinBps, orbit.tiltMaxBps),
        distance: orbit.distanceDefault,
        tiltMinBps: orbit.tiltMinBps,
        tiltMaxBps: orbit.tiltMaxBps,
        distanceMin: orbit.distanceMin,
        distanceMax: orbit.distanceMax,
        fovDeg: orbit.fovDeg,
        spanBps: orbit.spanBps,
        kindColor: colors,
        objectColor: colors["object"] ?? 0,
        lots: props.lots,
        catalog: props.heroCatalog,
        lodNear: props.lodNear,
        heroBytes,
        sun: {
          phases: props.light.phases,
          lanternsOn: props.light.lanternsOn,
          ticksDay: props.ticksDay,
          blendMinutes: props.light.blendMinutes,
          minutesPerHour: props.light.minutesPerHour,
          emissiveBps: props.light.emissiveBps,
          gradeBps: props.light.gradeBps,
          sunDistance: props.light.sunDistance,
        },
        walkerColor: colors["walker"] ?? 0,
        robotColor: colors["robot"] ?? 0,
        unitHeightBps: props.unitHeightBps,
        unitShiftPeriod: props.unitShiftPeriod,
        unitShiftSpanBps: props.unitShiftSpanBps,
        fillSky: colors["~"] ?? 0,
        fillGround: colors["."] ?? 0,
        lanternColor: colors["lantern"] ?? 0,
        furnitureColor: colors["furniture"] ?? 0,
        plantColor: colors["plant"] ?? 0,
        hullColor: colors["hull"] ?? 0,
        vehicleColor: colors["vehicle"] ?? 0,
        droneColor: colors["drone"] ?? 0,
        foamColor: colors["foam"] ?? 0,
        decorHeightBps: props.decorHeightBps,
        lanternHeightBps: props.lanternHeightBps,
        canopyHeightBps: props.canopyHeightBps,
        vehicleHeightBps: props.vehicleHeightBps,
        droneHoverHeightBps: props.droneHoverHeightBps,
        layoutSeed: props.motion.layoutSeed,
        vehicleSpeed: props.motion.vehicleSpeed,
        vehicleStride: props.motion.vehicleStride,
        prngBytes: props.motion.prngBytes,
        droneSpeed: props.motion.droneSpeed,
        droneAlt: props.motion.droneAlt,
        droneBob: props.motion.droneBob,
        droneBobPeriod: props.motion.droneBobPeriod,
        vehicles: props.motion.vehicles,
        drones: props.motion.drones,
        blocks: props.motion.blocks,
      })
      if (!alive) {
        mounted.destroy()
        return
      }
      if (mounted.code.length > 0) {
        setCode(mounted.code)
        mounted.destroy()
        return
      }
      handleRef.current = mounted
      applyCam(mounted, camRef.current, props.camera)
      unbind = bindSceneInput({
        host,
        handle: mounted,
        camera: props.camera,
        tileW: 1n,
        gradeBps: orbit.spanBps,
        opened: props.opened,
        wallNowMs,
        onRoute: (screen, objectId, cell, tileX, tileY) => {
          routeRef.current(screen, objectId, cell, tileX, tileY)
        },
        cam: camRef,
      })
    })()
    return () => {
      alive = false
      unbind?.()
      handleRef.current?.destroy()
      handleRef.current = undefined
    }
  }, [props.scene, props.palette, props.gridSize, props.camera, props.opened, props.lots, props.heroCatalog, props.lodNear, props.light, props.ticksDay, props.unitHeightBps, props.unitShiftPeriod, props.unitShiftSpanBps, props.motion, props.decorHeightBps, props.lanternHeightBps, props.canopyHeightBps, props.vehicleHeightBps, props.droneHoverHeightBps])
  useEffect(() => {
    if (props.lookId.length === 0) return
    camRef.current = lookCam(props.camera, props.lookId, camRef.current)
    const handle = handleRef.current
    if (handle !== undefined) applyCam(handle, camRef.current, props.camera)
  }, [props.lookId, props.lookRev, props.camera])
  useEffect(() => {
    const handle = handleRef.current
    if (handle === undefined) return
    handle.setCityTime(props.cityTime)
  }, [props.cityTime])
  return (
    <div ref={hostRef} data-surface="scene" className="hud-scene" style={{ position: "absolute", inset: 0 }}>
      {code.length > 0 ? (
        <div data-code={codes.RENDER_NO_GPU} data-key={codes.RENDER_NO_GPU}>
          <img src={FALLBACK_PNG} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          <span>{props.noGpuText}</span>
        </div>
      ) : null}
    </div>
  )
}

function clampMid(min: bigint, max: bigint): bigint {
  const two = 1n + 1n
  return (min + max) / two
}
