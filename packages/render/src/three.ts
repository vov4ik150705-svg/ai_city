import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { emptyHandle, emptyHit, type IslandHandle } from "./frame.js"
import {
  applyBuildingSelection,
  clearBuildingSelection,
  emptyBuildingSelection,
  findBuildingRoot,
  projectBuilding,
} from "./islandSelect.js"
import { gpuCode, type GpuProbe } from "./gpu.js"
import {
  applyAnchorPose,
  collectAnchors,
  pickObjectId,
  tagBuilding,
  type OccupiedPlant,
} from "./islandPlant.js"
import { applyIslandMaterials, cityMassBoxFilter } from "./islandMaterials.js"
import {
  aabbSize,
  azimuthBpsToDeg,
  azimuthToBps,
  elevationToTiltBps,
  fitHeroCamera,
  projectedWidthFill,
  tiltBpsToElevationDeg,
  type Aabb,
} from "./islandCamera.js"
import {
  ANTIALIAS,
  DPR_CAP,
  HERO_AZIMUTH_DEG,
  HERO_ELEVATION_DEG,
  HERO_FOV_DEG,
  RENDERER_REVISION,
  SHARED_ISLAND_RUNTIME,
  WORLD_CLEAR,
  WORLD_EXPOSURE,
  WORLD_HEMI_GROUND,
  WORLD_HEMI_SKY,
} from "./islandConfig.js"
import type { IslandCaptureMeta } from "./islandCapture.js"
import { occupiedForMode, type OccupancyMode } from "./islandOccupancy.js"
import { meshoptDecoderReady } from "./islandZoom.js"
import { currentPhase, hourOfDay } from "./light.js"
import { clampOrbit, orbitEye } from "./orbit.js"
import { signGainBps, sunDir, sunPose, windowGainBps, type SunPhase } from "./sun.js"
import type { TileHit } from "./camera.js"
import {
  tickEnvironment,
  disposeEnvironment,
} from "./islandEnv/index.js"
import { tickWaterFlow } from "./islandEnv/waterFlow.js"
import type { IslandLook } from "./islandLook.js"
import { hideWfAttachmentVisuals } from "./islandLookPlant.js"
import { mountAcceptedLook } from "./islandLookMount.js"

export type { IslandHandle, IslandObjectProjection } from "./frame.js"
export type { OccupiedPlant } from "./islandPlant.js"
export type { OccupancyMode } from "./islandOccupancy.js"
export type { IslandCaptureMeta } from "./islandCapture.js"
export { azimuthToBps, elevationToTiltBps } from "./islandCamera.js"
export { WORLD_HEMI_SKY, WORLD_HEMI_GROUND } from "./islandConfig.js"
export { STUDIO_PLANTS } from "./islandOccupancy.js"
export type { IslandLook, IslandLookObject } from "./islandLook.js"
export { parseIslandLook, lookBuildingCount, lookOrbitLimits } from "./islandLook.js"

const GLB_MAGIC = "glTF"

export function isGlbMagic(buf: ArrayBuffer): boolean {
  const two = 1 + 1
  const four = two + two
  if (buf.byteLength < four) return false
  const bytes = new Uint8Array(buf, 0, four)
  return (
    bytes[0] === GLB_MAGIC.charCodeAt(0) &&
    bytes[1] === GLB_MAGIC.charCodeAt(1) &&
    bytes[two] === GLB_MAGIC.charCodeAt(two) &&
    bytes[two + 1] === GLB_MAGIC.charCodeAt(two + 1)
  )
}

export function joinLoadError(prev: string, next: string): string {
  if (next.length === 0) return prev
  if (prev.length === 0) return next
  return prev + "; " + next
}

export function resizeKeepsOrbitDistance(orbitMoved: boolean): boolean {
  return orbitMoved
}

export function orbitPoseChanged(
  curAzimuthBps: bigint,
  curTiltBps: bigint,
  curDistance: bigint,
  nextAzimuthBps: bigint,
  nextTiltBps: bigint,
  nextDistance: bigint,
): boolean {
  return (
    curAzimuthBps !== nextAzimuthBps ||
    curTiltBps !== nextTiltBps ||
    curDistance !== nextDistance
  )
}

export type IslandSunOpts = {
  readonly phases: readonly SunPhase[]
  readonly lanternsOn: readonly string[]
  readonly ticksDay: bigint
  readonly blendMinutes: bigint
  readonly minutesPerHour: bigint
  readonly emissiveBps: bigint
  readonly gradeBps: bigint
  readonly sunDistance: bigint
}

export type Island3Opts = {
  readonly host: HTMLElement
  readonly probe: GpuProbe
  readonly azimuthBps: bigint
  readonly tiltBps: bigint
  readonly distance: bigint
  readonly tiltMinBps: bigint
  readonly tiltMaxBps: bigint
  readonly distanceMin: bigint
  readonly distanceMax: bigint
  readonly fovDeg: bigint
  readonly spanBps: bigint
  readonly targetY: bigint
  readonly massBytes: ArrayBuffer
  readonly buildingBytes: (slug: string, packId: string) => Promise<ArrayBuffer>
  readonly occupied: readonly OccupiedPlant[]
  readonly occupancyMode?: OccupancyMode
  readonly playerPackIds?: readonly string[]
  readonly look?: IslandLook
  readonly propBytes?: (kind: "building" | "decor", ref: string) => Promise<ArrayBuffer>
  readonly cloudBytes?: (file: string) => Promise<ArrayBuffer>
  readonly sun: IslandSunOpts
  readonly fillSky: number
  readonly fillGround: number
  readonly bloomStrengthBps: bigint
  readonly bloomRadiusBps: bigint
  readonly bloomThresholdBps: bigint
  readonly exposure?: number
  /** Capture may set this explicitly. Game MSAA follows ANTIALIAS. */
  readonly canvasAntialias?: boolean
}

function applyEye(
  camera: PerspectiveCamera,
  azimuthBps: bigint,
  tiltBps: bigint,
  distance: bigint,
  targetX: number,
  targetY: number,
  targetZ: number,
  spanBps: bigint,
  tiltMin: bigint,
  tiltMax: bigint,
  distMin: bigint,
  distMax: bigint,
): void {
  const tilt = clampOrbit(tiltBps, tiltMin, tiltMax)
  const dist = clampOrbit(distance, distMin, distMax)
  const eye = orbitEye(azimuthBps, tilt, dist, targetX, targetY, targetZ, spanBps)
  camera.position.set(eye.x, eye.y, eye.z)
  camera.lookAt(targetX, targetY, targetZ)
}

function parseGlb(loader: GLTFLoader, buf: ArrayBuffer): Promise<Group> {
  return new Promise((resolve, reject) => {
    loader.parse(buf, "", (gltf) => resolve(gltf.scene), reject)
  })
}

function showHostError(host: HTMLElement, message: string): void {
  const el = document.createElement("p")
  el.dataset.lookError = message
  el.textContent = message
  host.appendChild(el)
}

function boxToAabb(box: Box3): Aabb {
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  }
}

function cityAabb(scene: Scene): Aabb | undefined {
  const box = new Box3()
  box.makeEmpty()
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    if (!cityMassBoxFilter(obj)) return
    box.expandByObject(obj)
  })
  if (box.isEmpty()) return undefined
  return boxToAabb(box)
}

export async function mountIsland3(opts: Island3Opts): Promise<IslandHandle> {
  const refused = gpuCode(opts.probe)
  if (refused.length > 0) {
    showHostError(opts.host, refused)
    return emptyHandle(refused)
  }

  const canvas = document.createElement("canvas")
  canvas.style.display = "block"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  opts.host.appendChild(canvas)
  const exposure = opts.exposure ?? WORLD_EXPOSURE
  const fillSky = SHARED_ISLAND_RUNTIME ? WORLD_HEMI_SKY : opts.fillSky
  const fillGround = SHARED_ISLAND_RUNTIME ? WORLD_HEMI_GROUND : opts.fillGround
  const canvasAntialias = opts.canvasAntialias === true
  const useMsaa = canvasAntialias || ANTIALIAS
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: useMsaa,
      preserveDrawingBuffer: true,
    })
  } catch {
    canvas.remove()
    const code = gpuCode({ webgl2: false, webgl: false })
    showHostError(opts.host, code)
    return emptyHandle(code)
  }
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = exposure
  const dprCap = DPR_CAP
  const rawDpr = globalThis.devicePixelRatio
  const dpr = rawDpr > dprCap ? dprCap : rawDpr > 0 ? rawDpr : 1
  renderer.setPixelRatio(dpr)
  renderer.setClearColor(WORLD_CLEAR, 1)

  const scene = new Scene()
  scene.background = null
  const two = 1 + 1
  const occupancyMode: OccupancyMode = opts.occupancyMode ?? "production"
  const occupied = occupiedForMode(occupancyMode, opts.occupied, opts.playerPackIds)
  const span = opts.sun.gradeBps <= 0n ? 1n : opts.sun.gradeBps
  let az = SHARED_ISLAND_RUNTIME ? azimuthToBps(HERO_AZIMUTH_DEG, opts.spanBps) : opts.azimuthBps
  let tilt = SHARED_ISLAND_RUNTIME
    ? elevationToTiltBps(HERO_ELEVATION_DEG, opts.spanBps)
    : opts.tiltBps
  let dist = opts.distance
  let tx = 0
  let ty = SHARED_ISLAND_RUNTIME ? 0 : Number(opts.targetY)
  let tz = 0
  let widthFill = 0
  let loadError = ""
  let meshopt = false
  let cityPhase = ""
  let lastTime = 0n
  let orbitMoved = false
  let alive = true
  let paintFrame: number | undefined
  const fovDeg = SHARED_ISLAND_RUNTIME ? HERO_FOV_DEG : Number(opts.fovDeg)
  const cam = new PerspectiveCamera(fovDeg, 1, 1, Number(opts.distanceMax) * two)

  const look = opts.look
  const ambient = new AmbientLight()
  const hemi = new HemisphereLight(fillSky, fillGround)
  const fillDir = new DirectionalLight()
  const sun = new DirectionalLight()
  scene.add(ambient)
  scene.add(hemi)
  scene.add(fillDir)
  scene.add(fillDir.target)
  scene.add(sun)
  scene.add(sun.target)
  fillDir.castShadow = false
  let skyRoot: Group | null = null
  let lookDistMin = opts.distanceMin
  let lookDistMax = opts.distanceMax
  const glowBase: number[] = []
  const t0 = globalThis.performance.now()

  try {
    await meshoptDecoderReady(MeshoptDecoder)
    meshopt = true
  } catch (err) {
    canvas.remove()
    const message = err instanceof Error ? err.message : "MESHOPT_DECODER_MISSING"
    showHostError(opts.host, message)
    return emptyHandle(message)
  }
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  const glowMats: MeshStandardMaterial[] = []
  const pickMeshes: object[] = []
  if (opts.massBytes.byteLength > 0) {
    try {
      const mass = await parseGlb(loader, opts.massBytes)
      hideWfAttachmentVisuals(mass)
      applyIslandMaterials(mass, glowMats)
      scene.add(mass)
      if (look !== undefined && opts.propBytes !== undefined && opts.cloudBytes !== undefined) {
        const planted = await mountAcceptedLook({
          look,
          mass,
          scene,
          renderer,
          sun,
          hemi,
          fillDir,
          ambient,
          parseGlb: (buf) => parseGlb(loader, buf),
          propBytes: opts.propBytes,
          cloudBytes: opts.cloudBytes,
          glowMats,
          pickMeshes,
          joinLoadError,
          spanBps: opts.spanBps,
        })
        skyRoot = planted.skyRoot
        loadError = planted.loadError
        lookDistMin = planted.lookDistMin
        lookDistMax = planted.lookDistMax
        cam.near = Math.max(0.5, Number(lookDistMin) * 0.02)
        cam.far = Number(lookDistMax) * two
        if (planted.freezeOrbit) {
          az = planted.azimuthBps
          tilt = planted.tiltBps
          dist = planted.distance
          tx = planted.tx
          ty = planted.ty
          tz = planted.tz
          orbitMoved = true
        }
        if (loadError.length > 0) showHostError(opts.host, loadError)
      } else {
        const anchors = collectAnchors(mass)
        let i = 0
        while (i < occupied.length) {
          const plant = occupied[i]
          i += 1
          if (plant === undefined) continue
          const pose = anchors[plant.anchor]
          if (pose === undefined) continue
          let buf: ArrayBuffer
          try {
            buf = await opts.buildingBytes(plant.slug, plant.packId)
          } catch (err) {
            loadError = joinLoadError(loadError, plant.slug + ": " + String(err))
            continue
          }
          if (buf.byteLength === 0) {
            loadError = joinLoadError(loadError, plant.slug + ": empty glb")
            continue
          }
          if (!isGlbMagic(buf)) {
            loadError = joinLoadError(loadError, plant.slug + ": not a GLB (missing glTF magic)")
            continue
          }
          let root: Group
          try {
            root = await parseGlb(loader, buf)
          } catch (err) {
            loadError = joinLoadError(loadError, plant.slug + ": " + String(err))
            continue
          }
          applyAnchorPose(root, pose)
          tagBuilding(root, plant)
          applyIslandMaterials(root, glowMats)
          pickMeshes.push(root)
          scene.add(root)
        }
        if (loadError.length > 0) {
          showHostError(opts.host, loadError)
        }
      }
    } catch (err) {
      loadError = joinLoadError(loadError, err instanceof Error ? err.message : String(err))
      showHostError(opts.host, loadError)
    }
  }
  let gi0 = 0
  while (gi0 < glowMats.length) {
    const mat = glowMats[gi0]
    gi0 += 1
    if (mat === undefined) {
      glowBase.push(0)
      continue
    }
    glowBase.push(mat.emissiveIntensity)
  }

  const bloomStrength = look !== undefined ? 0 : Number(opts.bloomStrengthBps) / Number(span)
  const bloom = new UnrealBloomPass(
    new Vector2(1, 1),
    bloomStrength,
    Number(opts.bloomRadiusBps) / Number(span),
    Number(opts.bloomThresholdBps) / Number(span),
  )
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, cam))
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const ray = new Raycaster()
  const ndc = new Vector2()
  const selection = emptyBuildingSelection()

  const refit = (width: number, height: number): void => {
    cam.aspect = width / height
    if (SHARED_ISLAND_RUNTIME) {
      const box = cityAabb(scene)
      if (box !== undefined) {
        const fit = fitHeroCamera(box, cam.aspect)
        if (!resizeKeepsOrbitDistance(orbitMoved)) {
          tx = fit.target.x
          ty = fit.target.y
          tz = fit.target.z
          dist = clampOrbit(BigInt(Math.round(fit.distance)), lookDistMin, lookDistMax)
          cam.fov = fit.fovDeg
          cam.near = fit.near
          cam.far = fit.far
        }
        const size = aabbSize(box)
        const spanXz = size.x > size.z ? size.x : size.z
        widthFill = projectedWidthFill(spanXz, Number(dist), fit.hfovRad)
      }
    }
    cam.updateProjectionMatrix()
  }

  const applyCamera = (): void => {
    applyEye(
      cam,
      az,
      tilt,
      dist,
      tx,
      ty,
      tz,
      opts.spanBps,
      opts.tiltMinBps,
      opts.tiltMaxBps,
      lookDistMin,
      lookDistMax,
    )
  }

  const applySun = (cityTime: bigint): void => {
    lastTime = cityTime
    const hour = hourOfDay(cityTime, opts.sun.ticksDay)
    const cur = currentPhase(hour, opts.sun.phases, opts.sun.ticksDay)
    const lights = cur === undefined ? 0n : cur.lights
    const name = cur === undefined ? "" : cur.name
    cityPhase = name
    if (look !== undefined) return
    const pose = sunPose(
      cityTime,
      opts.sun.phases,
      opts.sun.ticksDay,
      opts.sun.blendMinutes,
      opts.sun.minutesPerHour,
      span,
    )
    const dir = sunDir(pose.azimuthBps, pose.elevationBps, span)
    const reach = Number(opts.sun.sunDistance)
    sun.position.set(tx + dir.x * reach, ty + dir.y * reach, tz + dir.z * reach)
    sun.target.position.set(tx, ty, tz)
    sun.intensity = Number(pose.intensityBps) / Number(span)
    ambient.intensity = Number(pose.ambientBps) / Number(span)
    hemi.intensity = Number(pose.ambientBps) / Number(span)
    const win = windowGainBps(lights, opts.sun.emissiveBps)
    const sign = signGainBps(name, opts.sun.lanternsOn, lights, opts.sun.emissiveBps)
    const gainW = Number(win) / Number(span)
    const gainS = Number(sign) / Number(span)
    let gi = 0
    while (gi < glowMats.length) {
      const mat = glowMats[gi]
      gi += 1
      if (mat === undefined) continue
      mat.emissiveIntensity = gainW > gainS ? gainW : gainS
    }
  }

  const flushPaint = (): void => {
    paintFrame = undefined
    if (!alive) return
    applyCamera()
    applySun(lastTime)
    if (look !== undefined) {
      tickWaterFlow((globalThis.performance.now() - t0) / 1000)
      tickEnvironment(skyRoot, cam)
    }
    if (useMsaa) {
      renderer.render(scene, cam)
    } else {
      composer.render()
    }
    if (look !== undefined && alive && typeof globalThis.requestAnimationFrame === "function") {
      schedulePaint()
    }
  }

  const schedulePaint = (): void => {
    if (!alive) return
    const raf = globalThis.requestAnimationFrame
    if (typeof raf !== "function") {
      flushPaint()
      return
    }
    if (paintFrame !== undefined) return
    paintFrame = raf(() => {
      flushPaint()
    })
  }

  const cancelPaint = (): void => {
    if (paintFrame === undefined) return
    const caf = globalThis.cancelAnimationFrame
    if (typeof caf === "function") caf(paintFrame)
    paintFrame = undefined
  }

  const resize = (): void => {
    if (!alive) return
    const w = opts.host.clientWidth
    const h = opts.host.clientHeight
    const width = w > 0 ? w : 1
    const height = h > 0 ? h : 1
    renderer.setSize(width, height, true)
    composer.setSize(width, height)
    bloom.resolution.set(width, height)
    refit(width, height)
    applyCamera()
    schedulePaint()
  }

  const metaOf = (): IslandCaptureMeta => {
    return {
      rendererRevision: RENDERER_REVISION,
      occupancyMode,
      cityPhase,
      cityTime: Number(lastTime),
      exposure,
      toneMapping: "ACESFilmic",
      colorSpace: "srgb",
      dpr: renderer.getPixelRatio(),
      antialias: useMsaa,
      fillSky,
      fillGround,
      meshopt,
      loadError,
      camera: {
        fovDeg: cam.fov,
        azimuthDeg: azimuthBpsToDeg(az, opts.spanBps),
        elevationDeg: tiltBpsToElevationDeg(tilt, opts.spanBps),
        distance: Number(dist),
        target: { x: tx, y: ty, z: tz },
        near: cam.near,
        far: cam.far,
        aspect: cam.aspect,
        widthFill,
      },
    }
  }

  resize()
  const ro = new ResizeObserver(() => {
    resize()
  })
  ro.observe(opts.host)

  applySun(0n)
  schedulePaint()

  return {
    code: "",
    setCityTime(cityTime: bigint): void {
      applySun(cityTime)
      schedulePaint()
    },
    setCamera(tileX: bigint, tileY: bigint, zoomNum: bigint, zoomDen: bigint): void {
      void tileX
      void tileY
      void zoomNum
      void zoomDen
    },
    setOrbit(azimuthBps: bigint, tiltBps: bigint, distance: bigint): void {
      if (orbitPoseChanged(az, tilt, dist, azimuthBps, tiltBps, distance)) {
        orbitMoved = true
      }
      az = azimuthBps
      tilt = tiltBps
      dist = distance
      applyCamera()
      schedulePaint()
    },
    hitAt(sx: bigint, sy: bigint): TileHit {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w <= 0 || h <= 0) return emptyHit()
      ndc.x = (Number(sx) / w) * two - 1
      ndc.y = -((Number(sy) / h) * two - 1)
      ray.setFromCamera(ndc, cam)
      const hits = ray.intersectObjects(pickMeshes, true)
      const picked = pickObjectId(hits)
      if (picked.objectId.length === 0) return emptyHit()
      return {
        tileX: 0n,
        tileY: 0n,
        objectId: picked.objectId,
        kind: picked.kind,
        cell: "",
      }
    },
    selectObject(objectId: string): void {
      if (objectId.length === 0) {
        clearBuildingSelection(selection)
        schedulePaint()
        return
      }
      const root = findBuildingRoot(pickMeshes, objectId)
      if (root === undefined) {
        clearBuildingSelection(selection)
        schedulePaint()
        return
      }
      applyBuildingSelection(selection, root, objectId)
      schedulePaint()
    },
    projectObject(objectId: string) {
      const root = findBuildingRoot(pickMeshes, objectId)
      if (root === undefined) return undefined
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      return projectBuilding(root, cam, w, h)
    },
    captureMeta(): IslandCaptureMeta {
      return metaOf()
    },
    destroy(): void {
      alive = false
      clearBuildingSelection(selection)
      cancelPaint()
      ro.disconnect()
      if (skyRoot !== null) disposeEnvironment(skyRoot)
      const env = scene.environment
      if (env !== null) env.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
