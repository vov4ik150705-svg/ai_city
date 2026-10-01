import { gpuCode, probeCanvas } from "../../packages/render/src/gpu.js"
import { bindIslandPreviewOrbit } from "../../packages/render/src/islandOrbitInput.ts"
import {
  isGlbMagic,
  mountIsland3,
  STUDIO_PLANTS,
  WORLD_HEMI_GROUND,
  WORLD_HEMI_SKY,
  azimuthToBps,
  elevationToTiltBps,
  parseIslandLook,
  lookOrbitLimits,
} from "@corporator/render/three"
import type { IslandLook, OccupiedPlant } from "@corporator/render/three"

const MASS_FALLBACK = "./runtime_terra19/island_mass.glb"
const BUILDINGS_FALLBACK = "./runtime_terra19/buildings/"
const LOOK_JSON = "./maps/terra-look.json"
const ANCHOR_PREFIX = "anchor_"
const BUILDING_GLB = import.meta.glob("./runtime_terra19/buildings/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as { readonly [path: string]: string }

const DECOR_GLB = import.meta.glob("../../decoration/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as { readonly [path: string]: string }

function globUrl(files: { readonly [path: string]: string }, stem: string): string {
  const needle = "/" + stem + ".glb"
  const winNeedle = "\\" + stem + ".glb"
  for (const [path, url] of Object.entries(files)) {
    if (path.endsWith(needle) || path.endsWith(winNeedle)) return url
  }
  return ""
}

function hostPath(host: HTMLElement, name: string, fallback: string): string {
  const raw = host.getAttribute(name)
  if (raw === null || raw.length === 0) return fallback
  return raw
}

function massUrl(host: HTMLElement): string {
  const rel = hostPath(host, "data-mass", MASS_FALLBACK)
  if (rel.includes("island.glb") && !rel.includes("island_mass.glb")) {
    throw new Error("fat island.glb is not a loader path")
  }
  if (!rel.includes("island_mass.glb")) {
    throw new Error("LOOK-03 mass path is not island_mass.glb")
  }
  return new URL(rel, import.meta.url).href
}

function occupiedFromHost(host: HTMLElement): readonly OccupiedPlant[] {
  const prefix = hostPath(host, "data-anchor-prefix", ANCHOR_PREFIX)
  if (prefix !== ANCHOR_PREFIX) {
    throw new Error("LOOK-02 plant path is not anchor_*")
  }
  for (const row of STUDIO_PLANTS) {
    if (!row.anchor.startsWith(prefix)) {
      throw new Error(`${row.slug} occupancy is not ${prefix}`)
    }
  }
  return STUDIO_PLANTS
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

function buildingUrl(stem: string, buildingsDir: string): string {
  const dir = buildingsDir.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/?$/, "/")
  const needle = "/" + stem + ".glb"
  const winNeedle = "\\" + stem + ".glb"
  for (const [path, url] of Object.entries(BUILDING_GLB)) {
    const norm = path.replace(/\\/g, "/")
    if (!norm.includes(dir)) continue
    if (path.endsWith(needle) || path.endsWith(winNeedle) || norm.endsWith(needle)) return url
  }
  return globUrl(BUILDING_GLB, stem)
}

async function fetchLook(): Promise<IslandLook | null> {
  const url = new URL(LOOK_JSON, import.meta.url).href
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  const raw: unknown = await res.json()
  return parseIslandLook(raw)
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf)
  const bytes = new Uint8Array(digest)
  let out = ""
  for (const b of bytes) out += b.toString(16).padStart(2, "0")
  return out
}

async function fetchRecorded(url: string): Promise<{ url: string; bytes: number; sha256: string; buf: ArrayBuffer }> {
  if (url.includes("island.glb") && !url.includes("island_mass.glb")) {
    throw new Error("fat island.glb is not a loader path")
  }
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${url} HTTP ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  if (!isGlbMagic(buf)) {
    throw new Error(`${url} is not a GLB (missing glTF magic)`)
  }
  return { url: res.url, bytes: buf.byteLength, sha256: await sha256Hex(buf), buf }
}

async function main(): Promise<void> {
  const host = document.getElementById("host")
  if (host === null) throw new Error("LOOK-03 missing #host")
  const MASS_GLB = massUrl(host)
  const buildingsDir = hostPath(host, "data-buildings", BUILDINGS_FALLBACK)
  const plants: readonly OccupiedPlant[] = occupiedFromHost(host)
  const params = new URLSearchParams(globalThis.location.search)
  const forceNoGpu = params.get("forceNoGpu") === "1"
  const shot = params.get("shot") ?? "hero"
  const massRev = params.get("massRev") ?? ""
  const massHref =
    massRev.length === 0
      ? MASS_GLB
      : `${MASS_GLB}${MASS_GLB.includes("?") ? "&" : "?"}v=${encodeURIComponent(massRev)}`
  const exposureRaw = Number(params.get("exposure"))
  const exposure = Number.isFinite(exposureRaw) && exposureRaw > 0 ? exposureRaw : undefined
  const probeCanvasEl = document.createElement("canvas")
  const probe = forceNoGpu ? { webgl2: false, webgl: false } : probeCanvas(probeCanvasEl)
  const refused = gpuCode(probe)
  const cityTime = 12n
  const spanBps = 10000n
  const lookOrbitMaxMul = 8n
  const buildings: { slug: string; url: string; bytes: number; sha256: string }[] = []
  const mass = forceNoGpu
    ? { url: massHref, bytes: 0, sha256: "", buf: new ArrayBuffer(0) }
    : await fetchRecorded(massHref)
  const look = forceNoGpu ? null : await fetchLook()
  async function buildingBytes(slug: string, packId: string): Promise<ArrayBuffer> {
    if (forceNoGpu) return new ArrayBuffer(0)
    const stem = packId.length > 0 ? packId : slug
    const url = buildingUrl(stem, buildingsDir)
    if (url.length === 0) {
      throw new Error(`building ${stem} not found in ${buildingsDir}`)
    }
    const got = await fetchRecorded(url)
    buildings.push({ slug: stem, url: got.url, bytes: got.bytes, sha256: got.sha256 })
    return got.buf
  }
  async function propBytes(kind: "building" | "decor", ref: string): Promise<ArrayBuffer> {
    if (forceNoGpu) return new ArrayBuffer(0)
    const files = kind === "building" ? BUILDING_GLB : DECOR_GLB
    const url = globUrl(files, ref)
    if (url.length === 0) {
      throw new Error(`${kind} ${ref} not found`)
    }
    const got = await fetchRecorded(url)
    if (kind === "building") {
      buildings.push({ slug: ref, url: got.url, bytes: got.bytes, sha256: got.sha256 })
    }
    return got.buf
  }
  async function cloudBytes(file: string): Promise<ArrayBuffer> {
    if (forceNoGpu) return new ArrayBuffer(0)
    const stem = file.toLowerCase().endsWith(".glb") ? file.slice(0, file.length - 4) : file
    const url = globUrl(DECOR_GLB, stem)
    if (url.length === 0) {
      throw new Error(`cloud ${stem} not found`)
    }
    const got = await fetchRecorded(url)
    return got.buf
  }

  const topShot = shot === "top"
  const tiltMinBps = topShot ? 400n : 2777n
  const tiltMaxBps = topShot ? 9600n : 6889n
  const mounted = await mountIsland3({
    host,
    probe,
    azimuthBps: 1250n,
    tiltBps: 6111n,
    distance: 1n,
    tiltMinBps,
    tiltMaxBps,
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
    ...(look === null ? {} : { look, propBytes, cloudBytes }),
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
    bloomStrengthBps: 3500n,
    bloomRadiusBps: 4000n,
    bloomThresholdBps: 8500n,
    ...(exposure === undefined ? {} : { exposure }),
  })

  if (!forceNoGpu && mounted.code.length === 0) {
    mounted.setCityTime(cityTime)
    const fitted = mounted.captureMeta()
    const dist = BigInt(Math.round(fitted.camera.distance > 0 ? fitted.camera.distance : 1))
    if (shot === "side") {
      mounted.setOrbit(azimuthToBps(135, spanBps), elevationToTiltBps(35, spanBps), dist)
    } else if (shot === "top") {
      mounted.setOrbit(azimuthToBps(45, spanBps), elevationToTiltBps(82, spanBps), dist)
    } else if (shot === "hall") {
      mounted.setOrbit(azimuthToBps(45, spanBps), elevationToTiltBps(52, spanBps), dist)
    } else if (shot === "az10") {
      mounted.setOrbit(azimuthToBps(10, spanBps), elevationToTiltBps(35, spanBps), dist)
    } else if (shot === "az80") {
      mounted.setOrbit(azimuthToBps(80, spanBps), elevationToTiltBps(35, spanBps), dist)
    }
  }

  const network = [{ slug: "island_mass", url: mass.url, bytes: mass.bytes, sha256: mass.sha256 }, ...buildings]
  const publish = (): void => {
    const meta = mounted.captureMeta()
    ;(globalThis as unknown as { __look03: unknown }).__look03 = {
      ready: true,
      kind: "preview",
      shot,
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
  if (!forceNoGpu && mounted.code.length === 0) {
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
      tiltMinBps,
      tiltMaxBps,
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

function showLookError(message: string): void {
  const host = document.getElementById("host")
  if (host === null) return
  const el = document.createElement("p")
  el.dataset.lookError = message
  el.textContent = message
  host.appendChild(el)
}

void main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  showLookError(message)
})
