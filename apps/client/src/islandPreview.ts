import { gpuCode, probeCanvas, bindIslandPreviewOrbit } from "@corporator/render"
import {
  mountIsland3,
  STUDIO_PLANTS,
  WORLD_HEMI_GROUND,
  WORLD_HEMI_SKY,
  azimuthToBps,
  elevationToTiltBps,
  lookOrbitLimits,
} from "@corporator/render/three"
import type { OccupiedPlant } from "@corporator/render/three"
import {
  fetchCloudBytes,
  fetchIslandLook,
  fetchLookProp,
  fetchMassBytes,
  islandMassUrl,
} from "./islandLookAssets.js"

type IslandCaptureApi = {
  readonly apply: (azDeg: number, elDeg: number, dist: number, hour: number) => void
}

type CaptureHost = {
  __look03?: unknown
  __islandCapture?: IslandCaptureApi
}

function wrapAzimuthDeg(deg: number): number {
  const turn = 360
  const wrapped = deg % turn
  return wrapped < 0 ? wrapped + turn : wrapped
}

const PHASES = [
  {
    name: "dawn",
    startHour: 6n,
    durationHours: 2n,
    lights: 1n,
    tintAlphaBps: 2800n,
    sunAzimuthBps: 2500n,
    sunElevationBps: 1850n,
    sunIntensityBps: 4100n,
    ambientBps: 2350n,
  },
  {
    name: "day",
    startHour: 8n,
    durationHours: 12n,
    lights: 0n,
    tintAlphaBps: 0n,
    sunAzimuthBps: 625n,
    sunElevationBps: 7100n,
    sunIntensityBps: 9100n,
    ambientBps: 3450n,
  },
  {
    name: "dusk",
    startHour: 20n,
    durationHours: 2n,
    lights: 1n,
    tintAlphaBps: 3200n,
    sunAzimuthBps: 7500n,
    sunElevationBps: 1650n,
    sunIntensityBps: 3700n,
    ambientBps: 1750n,
  },
  {
    name: "night",
    startHour: 22n,
    durationHours: 8n,
    lights: 1n,
    tintAlphaBps: 4500n,
    sunAzimuthBps: 4375n,
    sunElevationBps: 400n,
    sunIntensityBps: 850n,
    ambientBps: 1050n,
  },
]

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf)
  const bytes = new Uint8Array(digest)
  let out = ""
  for (const b of bytes) out += b.toString(16).padStart(2, "0")
  return out
}

async function main(): Promise<void> {
  const host = document.getElementById("host")
  if (host === null) throw new Error("LOOK-03 missing #host")
  const params = new URLSearchParams(globalThis.location.search)
  const forceNoGpu = params.get("forceNoGpu") === "1"
  const captureMode = params.get("capture") === "1"
  const exposureRaw = Number(params.get("exposure"))
  const exposure = Number.isFinite(exposureRaw) && exposureRaw > 0 ? exposureRaw : undefined
  const probeCanvasEl = document.createElement("canvas")
  const probe = forceNoGpu ? { webgl2: false, webgl: false } : probeCanvas(probeCanvasEl)
  const refused = gpuCode(probe)
  const cityTime = 12n
  const spanBps = 10000n
  const lookOrbitMaxMul = 8n
  const plants: readonly OccupiedPlant[] = STUDIO_PLANTS
  const massUrl = islandMassUrl()
  if (massUrl.includes("island.glb") && !massUrl.includes("island_mass.glb")) {
    throw new Error("fat island.glb is not a loader path")
  }
  const mass = forceNoGpu
    ? { url: massUrl, bytes: 0, sha256: "", buf: new ArrayBuffer(0) }
    : await (async () => {
        const buf = await fetchMassBytes()
        return { url: massUrl, bytes: buf.byteLength, sha256: await sha256Hex(buf), buf }
      })()
  const look = forceNoGpu ? null : await fetchIslandLook()
  async function buildingBytes(slug: string, packId: string): Promise<ArrayBuffer> {
    void packId
    if (forceNoGpu) return new ArrayBuffer(0)
    return fetchLookProp("building", slug)
  }

  const mounted = await mountIsland3({
    host,
    probe,
    azimuthBps: 1250n,
    tiltBps: 6111n,
    distance: 1n,
    tiltMinBps: captureMode ? 800n : 2777n,
    tiltMaxBps: captureMode ? 9111n : 6889n,
    distanceMin: 800n,
    distanceMax: 44000n,
    lookOrbitMaxMul,
    fovDeg: 36n,
    spanBps,
    targetY: 0n,
    massBytes: mass.buf,
    buildingBytes,
    occupied: plants,
    occupancyMode: "review-all-18",
    ...(look === null
      ? {}
      : { look, propBytes: fetchLookProp, cloudBytes: fetchCloudBytes }),
    sun: {
      phases: PHASES,
      lanternsOn: ["dawn", "dusk", "night"],
      ticksDay: 24n,
      blendMinutes: 120n,
      minutesPerHour: 60n,
      emissiveBps: 8000n,
      gradeBps: spanBps,
      sunDistance: 12000n,
      waterStepsPerTick: 1n,
    },
    fillSky: WORLD_HEMI_SKY,
    fillGround: WORLD_HEMI_GROUND,
    bloomStrengthBps: 0n,
    bloomRadiusBps: 4000n,
    bloomThresholdBps: 8500n,
    ...(exposure === undefined ? {} : { exposure }),
    ...(captureMode ? { canvasAntialias: true } : {}),
  })

  if (!forceNoGpu && mounted.code.length === 0) {
    mounted.setCityTime(cityTime)
  }

  if (captureMode) {
    host.style.cursor = "none"
    const capture: IslandCaptureApi = {
      apply(azDeg: number, elDeg: number, dist: number, hour: number): void {
        const az = wrapAzimuthDeg(azDeg)
        const el = elDeg < 8 ? 8 : elDeg > 82 ? 82 : elDeg
        const distance = dist < 1 ? 1 : dist
        mounted.setCityTime(BigInt(Math.round(hour)))
        mounted.setOrbit(azimuthToBps(az, spanBps), elevationToTiltBps(el, spanBps), BigInt(Math.round(distance)))
      },
    }
    ;(globalThis as CaptureHost).__islandCapture = capture
  }

  const network = [{ slug: "island_mass", url: mass.url, bytes: mass.bytes, sha256: mass.sha256 }]
  const publish = (): void => {
    const meta = mounted.captureMeta()
    ;(globalThis as unknown as { __look03: unknown }).__look03 = {
      ready: true,
      kind: "client_preview",
      gpuCode: refused.length > 0 ? refused : mounted.code,
      city_phase: meta.cityPhase,
      renderer: meta.rendererRevision,
      url: globalThis.location.href,
      viewport: {
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
        devicePixelRatio: globalThis.devicePixelRatio,
      },
      camera: meta.camera,
      output: {
        exposure: meta.exposure,
        toneMapping: meta.toneMapping,
        colorSpace: meta.colorSpace,
        dpr: meta.dpr,
        antialias: meta.antialias,
        fillSky: meta.fillSky,
        fillGround: meta.fillGround,
        meshopt: meta.meshopt,
      },
      occupancyMode: meta.occupancyMode,
      loadError: meta.loadError,
      network,
    }
  }
  if (!forceNoGpu && mounted.code.length === 0 && !captureMode) {
    const meta = mounted.captureMeta()
    const dist = BigInt(Math.round(meta.camera.distance > 0 ? meta.camera.distance : 1))
    const lim = lookOrbitLimits(dist, lookOrbitMaxMul)
    bindIslandPreviewOrbit({
      host,
      handle: mounted,
      state: {
        azimuthBps: azimuthToBps(meta.camera.azimuthDeg, spanBps),
        tiltBps: elevationToTiltBps(meta.camera.elevationDeg, spanBps),
        distance: dist,
      },
      spanBps,
      tiltMinBps: 2777n,
      tiltMaxBps: 6889n,
      distanceMin: lim.min,
      distanceMax: lim.max,
      onChange: publish,
    })
  }
  publish()
  globalThis.addEventListener("resize", () => {
    globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(publish)
    })
  })
}

void main()
