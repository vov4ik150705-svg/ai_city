import { useEffect, useRef, useState, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { gpuCode, probeCanvas } from "@corporator/render"
import type { IslandHandle, IslandObjectProjection, OccupiedPlant } from "@corporator/render"
import {
  mountIsland3,
  WORLD_HEMI_GROUND,
  WORLD_HEMI_SKY,
  azimuthToBps,
  elevationToTiltBps,
  lookOrbitLimits,
} from "@corporator/render/three"
import { wallNowMs } from "../clock.js"
import type { Palette } from "../palette.js"
import type { ClientCamera, ClientLight } from "../packview.js"
import { applyCam, bindSceneInput, lookCam, startCam, type CamPos } from "./sceneInput.js"
import {
  fetchCloudBytes,
  fetchIslandLook,
  fetchLookProp,
  fetchMassBytes,
} from "../islandLookAssets.js"

/** Live Terra mass: art/island_v3/runtime_terra19/island_mass.glb */
const FALLBACK_PNG = new URL("../../../../content/out/atlas/fallback.png", import.meta.url).href

export function SceneHost(props: {
  readonly palette: Palette
  readonly camera: ClientCamera
  readonly cityTime: bigint
  readonly lookId: string
  readonly lookRev: bigint
  readonly opened: { readonly [district: string]: bigint }
  readonly selectedObjectId: string
  readonly onProjection: (proj: IslandObjectProjection | undefined) => void
  readonly onSceneRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void
  readonly noGpuText: string
  readonly light: ClientLight
  readonly ticksDay: bigint
  readonly occupied: readonly OccupiedPlant[]
  readonly bloomStrengthBps: bigint
  readonly bloomRadiusBps: bigint
  readonly bloomThresholdBps: bigint
}): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<IslandHandle | undefined>(undefined)
  const camRef = useRef<CamPos>(startCam(props.camera))
  const routeRef = useRef(props.onSceneRoute)
  routeRef.current = props.onSceneRoute
  const selectedRef = useRef(props.selectedObjectId)
  selectedRef.current = props.selectedObjectId
  const projectRef = useRef(props.onProjection)
  projectRef.current = props.onProjection
  const [code, setCode] = useState("")

  function emitProjection(handle: IslandHandle, objectId: string): void {
    if (objectId.length === 0) {
      projectRef.current(undefined)
      return
    }
    projectRef.current(handle.projectObject(objectId))
  }

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
    const orbit = props.camera.orbit
    void (async () => {
      const look = await fetchIslandLook()
      if (!alive) return
      if (look === null) {
        const el = document.createElement("p")
        el.dataset.lookError = "terra-look.json"
        el.textContent = "terra-look.json"
        host.appendChild(el)
        return
      }
      const mounted = await mountIsland3({
        host,
        probe,
        azimuthBps: orbit.azimuthBps,
        tiltBps: clampMid(orbit.tiltMinBps, orbit.tiltMaxBps),
        distance: orbit.distanceDefault,
        tiltMinBps: orbit.tiltMinBps,
        tiltMaxBps: orbit.tiltMaxBps,
        distanceMin: orbit.distanceMin,
        distanceMax: orbit.distanceMax,
        fovDeg: orbit.fovDeg,
        spanBps: orbit.spanBps,
        targetY: orbit.targetY,
        massBytes: await fetchMassBytes(),
        buildingBytes: (slug, packId) => {
          void packId
          return fetchLookProp("building", slug)
        },
        occupied: props.occupied,
        occupancyMode: "production",
        look,
        propBytes: fetchLookProp,
        cloudBytes: fetchCloudBytes,
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
        fillSky: WORLD_HEMI_SKY,
        fillGround: WORLD_HEMI_GROUND,
        bloomStrengthBps: 0n,
        bloomRadiusBps: props.bloomRadiusBps,
        bloomThresholdBps: props.bloomThresholdBps,
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
      const meta = mounted.captureMeta()
      const dist = BigInt(Math.round(meta.camera.distance > 0 ? meta.camera.distance : 1))
      const lim = lookOrbitLimits(dist)
      camRef.current.azimuthBps = azimuthToBps(meta.camera.azimuthDeg, orbit.spanBps)
      camRef.current.tiltBps = elevationToTiltBps(meta.camera.elevationDeg, orbit.spanBps)
      camRef.current.distance = dist
      const cameraForInput = {
        ...props.camera,
        orbit: { ...orbit, distanceMin: lim.min, distanceMax: lim.max },
      }
      mounted.selectObject(selectedRef.current)
      emitProjection(mounted, selectedRef.current)
      unbind = bindSceneInput({
        host,
        handle: mounted,
        camera: cameraForInput,
        tileW: 1n,
        gradeBps: orbit.spanBps,
        opened: props.opened,
        wallNowMs,
        onRoute: (screen, objectId, cell, tileX, tileY) => {
          routeRef.current(screen, objectId, cell, tileX, tileY)
        },
        onCamChange: () => {
          emitProjection(mounted, selectedRef.current)
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
  }, [
    props.palette,
    props.camera,
    props.opened,
    props.light,
    props.ticksDay,
    props.occupied,
    props.bloomStrengthBps,
    props.bloomRadiusBps,
    props.bloomThresholdBps,
  ])
  useEffect(() => {
    if (props.lookId.length === 0) return
    camRef.current = lookCam(props.camera, props.lookId, camRef.current)
    const handle = handleRef.current
    if (handle !== undefined) {
      applyCam(handle, camRef.current, props.camera)
      emitProjection(handle, selectedRef.current)
    }
  }, [props.lookId, props.lookRev, props.camera])
  useEffect(() => {
    const handle = handleRef.current
    if (handle === undefined) return
    handle.setCityTime(props.cityTime)
  }, [props.cityTime])
  useEffect(() => {
    const handle = handleRef.current
    if (handle === undefined) return
    handle.selectObject(props.selectedObjectId)
    emitProjection(handle, props.selectedObjectId)
  }, [props.selectedObjectId])
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    function project(): void {
      const handle = handleRef.current
      if (handle === undefined) return
      emitProjection(handle, selectedRef.current)
    }
    const ro = new ResizeObserver(() => {
      project()
    })
    ro.observe(host)
    window.addEventListener("resize", project)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", project)
    }
  }, [])
  return (
    <div ref={hostRef} data-surface="scene" className="hud-scene" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
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
