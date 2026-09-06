import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { loadScene } from "./ground.js"
import { emptyHandle, type IslandHandle } from "./frame.js"
import { gpuCode, type GpuProbe } from "./gpu.js"
import { loadHeroCatalog, pickHeroLod, plantHeroes, type HeroLot } from "./heroes.js"
import {
  islandBoxes,
  islandCells,
  islandCenter,
  landCells,
  plantWater,
  shoreFoam,
  type IslandCell,
} from "./island.js"
import { currentPhase, hourOfDay } from "./light.js"
import { clampOrbit, orbitEye } from "./orbit.js"
import { pickFromRay } from "./pick.js"
import { signGainBps, sunDir, sunPose, windowGainBps, type SunPhase } from "./sun.js"
import { isPackedWalker, plantUnits, unitWorldPos } from "./units.js"
import {
  decorOfKind,
  isPackedDecor,
  isPackedDrone,
  isPackedVehicle,
  plantDecor,
  poseDrone,
  poseVehicle,
  type DecorKind,
} from "./world.js"
import type { TileHit } from "./camera.js"
import type { BlockRect, DroneStart, VehicleStart } from "./motion.js"

export type { IslandHandle } from "./frame.js"

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
  readonly scene: unknown
  readonly probe: GpuProbe
  readonly gridSize: bigint
  readonly landY: bigint
  readonly waterY: bigint
  readonly azimuthBps: bigint
  readonly tiltBps: bigint
  readonly distance: bigint
  readonly tiltMinBps: bigint
  readonly tiltMaxBps: bigint
  readonly distanceMin: bigint
  readonly distanceMax: bigint
  readonly fovDeg: bigint
  readonly spanBps: bigint
  readonly kindColor: { readonly [ch: string]: number }
  readonly objectColor: number
  readonly lots: unknown
  readonly catalog: unknown
  readonly lodNear: bigint
  readonly heroBytes: (file: string) => Promise<ArrayBuffer>
  readonly sun: IslandSunOpts
  readonly walkerColor: number
  readonly robotColor: number
  readonly unitHeightBps: bigint
  readonly unitShiftPeriod: bigint
  readonly unitShiftSpanBps: bigint
  readonly fillSky: number
  readonly fillGround: number
  readonly lanternColor: number
  readonly furnitureColor: number
  readonly plantColor: number
  readonly hullColor: number
  readonly vehicleColor: number
  readonly droneColor: number
  readonly foamColor: number
  readonly decorHeightBps: bigint
  readonly lanternHeightBps: bigint
  readonly canopyHeightBps: bigint
  readonly vehicleHeightBps: bigint
  readonly droneHoverHeightBps: bigint
  readonly layoutSeed: string
  readonly vehicleSpeed: bigint
  readonly vehicleStride: bigint
  readonly prngBytes: bigint
  readonly droneSpeed: bigint
  readonly droneAlt: bigint
  readonly droneBob: bigint
  readonly droneBobPeriod: bigint
  readonly vehicles: readonly VehicleStart[]
  readonly drones: readonly DroneStart[]
  readonly blocks: readonly BlockRect[]
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

function parseHero(loader: GLTFLoader, buf: ArrayBuffer): Promise<Group> {
  return new Promise((resolve, reject) => {
    loader.parse(buf, "", (gltf) => resolve(gltf.scene), reject)
  })
}

function collectEmissive(root: Group, kind: string, into: MeshStandardMaterial[]): void {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    if (obj.name !== kind) return
    const raw = obj.material
    const list = Array.isArray(raw) ? raw : [raw]
    for (const mat of list) {
      if (mat instanceof MeshStandardMaterial) into.push(mat)
    }
  })
}

function stampAt(
  mesh: InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const m = new Matrix4()
  m.makeScale(sx, sy, sz)
  m.setPosition(x, y, z)
  mesh.setMatrixAt(index, m)
}

function heightOf(bps: bigint, gradeBps: bigint): number {
  const grade = gradeBps <= 0n ? 1n : gradeBps
  return Number(bps) / Number(grade)
}

export async function mountIsland3(opts: Island3Opts): Promise<IslandHandle> {
  const refused = gpuCode(opts.probe)
  if (refused.length > 0) return emptyHandle(refused)

  const canvas = document.createElement("canvas")
  opts.host.appendChild(canvas)
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false })
  } catch {
    canvas.remove()
    return emptyHandle(gpuCode({ webgl2: false, webgl: false }))
  }

  const scene = new Scene()
  const two = 1 + 1
  const cam = new PerspectiveCamera(Number(opts.fovDeg), 1, 1, Number(opts.distanceMax) * two)
  const center = islandCenter(opts.gridSize)
  let tx = Number(center.x)
  let tz = Number(center.z)
  const ty = Number(opts.landY)
  applyEye(
    cam,
    opts.azimuthBps,
    opts.tiltBps,
    opts.distance,
    tx,
    ty,
    tz,
    opts.spanBps,
    opts.tiltMinBps,
    opts.tiltMaxBps,
    opts.distanceMin,
    opts.distanceMax,
  )

  const ambient = new AmbientLight()
  const fill = new HemisphereLight(opts.fillSky, opts.fillGround)
  const sun = new DirectionalLight()
  scene.add(ambient)
  scene.add(fill)
  scene.add(sun)
  scene.add(sun.target)

  const plane = new PlaneGeometry(1, 1)
  const box = new BoxGeometry(1, 1, 1)
  const mats: { [ch: string]: MeshLambertMaterial } = {}
  const colorOf = (ch: string): MeshLambertMaterial => {
    const hit = mats[ch]
    if (hit !== undefined) return hit
    const made = new MeshLambertMaterial({ color: opts.kindColor[ch] ?? 0 })
    mats[ch] = made
    return made
  }
  const cells = landCells(islandCells(opts.scene, opts.landY, opts.waterY))
  const landGroups: { [ch: string]: IslandCell[] } = {}
  for (const cell of cells) {
    const cur = landGroups[cell.kind]
    if (cur === undefined) landGroups[cell.kind] = [cell]
    else cur.push(cell)
  }
  for (const ch of Object.keys(landGroups)) {
    const rows = landGroups[ch]
    if (rows === undefined || rows.length === 0) continue
    const inst = new InstancedMesh(box, colorOf(ch), rows.length)
    let i = 0
    for (const row of rows) {
      stampAt(inst, i, Number(row.tileX), Number(row.y), Number(row.tileY), 1, 1, 1)
      i += 1
    }
    inst.instanceMatrix.needsUpdate = true
    scene.add(inst)
  }
  const sea = plantWater(opts.gridSize, opts.waterY)
  const waterMesh = new Mesh(plane, colorOf("~"))
  waterMesh.rotation.x = -Math.PI / two
  waterMesh.position.set(sea.x, sea.y, sea.z)
  waterMesh.scale.set(sea.span, 1, sea.span)
  scene.add(waterMesh)
  const foamMat = new MeshLambertMaterial({ color: opts.foamColor })
  const foamRows = shoreFoam(opts.scene, opts.waterY)
  for (const row of foamRows) {
    const mesh = new Mesh(plane, foamMat)
    mesh.rotation.x = -Math.PI / two
    mesh.position.set(Number(row.tileX), Number(row.y), Number(row.tileY))
    scene.add(mesh)
  }
  const objMat = new MeshLambertMaterial({ color: opts.objectColor })
  const catalog = loadHeroCatalog(opts.catalog)
  const lots = plantHeroes(opts.lots, catalog)
  const heroIds: { [id: string]: true } = {}
  for (const lot of lots) heroIds[lot.id] = true
  for (const row of islandBoxes(opts.scene)) {
    if (heroIds[row.id] === true) continue
    if (isPackedWalker(row.id)) continue
    if (isPackedDecor(row.id)) continue
    if (isPackedVehicle(row.id) || isPackedDrone(row.id)) continue
    const mesh = new Mesh(box, objMat)
    const top = Number(opts.landY) + 1
    mesh.position.set(Number(row.tileX), top, Number(row.tileY))
    scene.add(mesh)
  }
  const unitGeo = new PlaneGeometry(1, 1)
  const walkerMat = new MeshLambertMaterial({ color: opts.walkerColor })
  const robotMat = new MeshLambertMaterial({ color: opts.robotColor })
  const packed = loadScene(opts.scene)
  const unitRows = plantUnits(opts.scene)
  const unitMeshes: Mesh[] = []
  const unitH = Number(opts.unitHeightBps) / Number(opts.sun.gradeBps <= 0n ? 1n : opts.sun.gradeBps)
  const unitW = unitH / two
  for (const unit of unitRows) {
    const robot = unit.id.startsWith("robot_")
    const mesh = new Mesh(unitGeo, robot ? robotMat : walkerMat)
    mesh.scale.set(unitW, unitH, 1)
    scene.add(mesh)
    unitMeshes.push(mesh)
  }
  const decorRows = plantDecor(opts.scene)
  const lanternMat = new MeshStandardMaterial({ color: opts.lanternColor, emissive: opts.lanternColor })
  const furnitureMat = new MeshLambertMaterial({ color: opts.furnitureColor })
  const plantMat = new MeshLambertMaterial({ color: opts.plantColor })
  const hullMat = new MeshLambertMaterial({ color: opts.hullColor })
  const lanternH = heightOf(opts.lanternHeightBps, opts.sun.gradeBps)
  const furnH = heightOf(opts.decorHeightBps, opts.sun.gradeBps)
  const canopyH = heightOf(opts.canopyHeightBps, opts.sun.gradeBps)
  const landTop = Number(opts.landY)
  const plantFamily = (
    kind: DecorKind,
    mat: MeshLambertMaterial | MeshStandardMaterial,
    sx: number,
    sy: number,
    sz: number,
  ): InstancedMesh | undefined => {
    const rows = decorOfKind(decorRows, kind)
    if (rows.length === 0) return undefined
    const inst = new InstancedMesh(box, mat, rows.length)
    let i = 0
    for (const row of rows) {
      stampAt(
        inst,
        i,
        Number(row.tileX),
        landTop + sy / two,
        Number(row.tileY),
        sx,
        sy,
        sz,
      )
      i += 1
    }
    inst.instanceMatrix.needsUpdate = true
    scene.add(inst)
    return inst
  }
  const lanternInst = plantFamily("lantern", lanternMat, 1 / two, lanternH, 1 / two)
  const furnitureInst = plantFamily("furniture", furnitureMat, 1, furnH, 1)
  const plantInst = plantFamily("plant", plantMat, 1 / two, canopyH, 1 / two)
  const hullInst = plantFamily("hull", hullMat, 1, furnH, 1)
  const decorInst = [lanternInst, furnitureInst, plantInst, hullInst]
  const vehicleMat = new MeshLambertMaterial({ color: opts.vehicleColor })
  const droneMat = new MeshLambertMaterial({ color: opts.droneColor })
  const vehH = heightOf(opts.vehicleHeightBps, opts.sun.gradeBps)
  const vehicleMeshes: Mesh[] = []
  for (const _start of opts.vehicles) {
    void _start
    const mesh = new Mesh(box, vehicleMat)
    mesh.scale.set(1, vehH, 1 / two)
    scene.add(mesh)
    vehicleMeshes.push(mesh)
  }
  const droneMeshes: Mesh[] = []
  for (const _start of opts.drones) {
    void _start
    const mesh = new Mesh(box, droneMat)
    mesh.scale.set(1 / two, 1 / two, 1 / two)
    scene.add(mesh)
    droneMeshes.push(mesh)
  }
  const loader = new GLTFLoader()
  const templates: { [file: string]: Group } = {}
  const lodPairs: { high: Group; low: Group }[] = []
  const windowMats: MeshStandardMaterial[] = []
  const signMats: MeshStandardMaterial[] = []
  for (const lot of lots) {
    const row = catalog[lot.id]
    if (row === undefined) continue
    let highTpl = templates[row.lodHigh]
    if (highTpl === undefined) {
      try {
        highTpl = await parseHero(loader, await opts.heroBytes(row.lodHigh))
      } catch {
        continue
      }
      templates[row.lodHigh] = highTpl
    }
    let lowTpl = templates[row.lodLow]
    if (lowTpl === undefined) {
      try {
        lowTpl = await parseHero(loader, await opts.heroBytes(row.lodLow))
      } catch {
        continue
      }
      templates[row.lodLow] = lowTpl
    }
    const high = highTpl.clone()
    const low = lowTpl.clone()
    const y = Number(opts.landY)
    high.position.set(Number(lot.tileX), y, Number(lot.tileY))
    low.position.set(Number(lot.tileX), y, Number(lot.tileY))
    high.scale.set(Number(lot.spanX), 1, Number(lot.spanZ))
    low.scale.set(Number(lot.spanX), 1, Number(lot.spanZ))
    scene.add(high)
    scene.add(low)
    lodPairs.push({ high, low })
    collectEmissive(high, "window", windowMats)
    collectEmissive(low, "window", windowMats)
    collectEmissive(high, "sign", signMats)
    collectEmissive(low, "sign", signMats)
  }
  const startLod = pickHeroLod(opts.distance, opts.lodNear)
  for (const pair of lodPairs) {
    pair.high.visible = startLod === "high"
    pair.low.visible = startLod === "low"
  }

  const ray = new Raycaster()
  const ndc = new Vector2()
  const landY = opts.landY
  const waterY = opts.waterY
  let lastTime = 0n

  const resize = (): void => {
    const w = opts.host.clientWidth
    const h = opts.host.clientHeight
    const width = w > 0 ? w : 1
    const height = h > 0 ? h : 1
    renderer.setSize(width, height, false)
    cam.aspect = width / height
    cam.updateProjectionMatrix()
    renderer.render(scene, cam)
  }
  resize()
  const ro = new ResizeObserver(() => {
    resize()
  })
  ro.observe(opts.host)

  let az = opts.azimuthBps
  let tilt = opts.tiltBps
  let dist = opts.distance

  const applySun = (cityTime: bigint): void => {
    lastTime = cityTime
    const span = opts.sun.gradeBps <= 0n ? 1n : opts.sun.gradeBps
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
    fill.intensity = Number(pose.ambientBps) / Number(span)
    const hour = hourOfDay(cityTime, opts.sun.ticksDay)
    const cur = currentPhase(hour, opts.sun.phases, opts.sun.ticksDay)
    const lights = cur === undefined ? 0n : cur.lights
    const name = cur === undefined ? "" : cur.name
    const win = windowGainBps(lights, opts.sun.emissiveBps)
    const sign = signGainBps(name, opts.sun.lanternsOn, lights, opts.sun.emissiveBps)
    const gainW = Number(win) / Number(span)
    const gainS = Number(sign) / Number(span)
    for (const mat of windowMats) mat.emissiveIntensity = gainW
    for (const mat of signMats) mat.emissiveIntensity = gainS
    lanternMat.emissiveIntensity = gainS
  }

  const paint = (): void => {
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
      opts.distanceMin,
      opts.distanceMax,
    )
    const lod = pickHeroLod(dist, opts.lodNear)
    for (const pair of lodPairs) {
      pair.high.visible = lod === "high"
      pair.low.visible = lod === "low"
    }
    applySun(lastTime)
    const grade = opts.sun.gradeBps
    let i = 0
    while (i < unitMeshes.length) {
      const unit = unitRows[i]
      const mesh = unitMeshes[i]
      if (unit !== undefined && mesh !== undefined) {
        const pos = unitWorldPos(
          unit,
          packed.map,
          lastTime,
          landY,
          opts.sun.minutesPerHour,
          opts.unitShiftPeriod,
          opts.unitShiftSpanBps,
          grade,
          opts.unitHeightBps,
        )
        mesh.position.set(pos.x, pos.y, pos.z)
        mesh.lookAt(cam.position.x, pos.y, cam.position.z)
      }
      i += 1
    }
    let vi = 0n
    while (vi < BigInt(vehicleMeshes.length)) {
      const start = opts.vehicles[Number(vi)]
      const mesh = vehicleMeshes[Number(vi)]
      if (start !== undefined && mesh !== undefined) {
        const pos = poseVehicle(
          packed.map,
          start,
          vi,
          lastTime,
          opts.sun.minutesPerHour,
          opts.vehicleSpeed,
          opts.vehicleStride,
          opts.prngBytes,
          opts.layoutSeed,
          landY,
          opts.vehicleHeightBps,
          grade,
        )
        mesh.position.set(pos.x, pos.y, pos.z)
        mesh.rotation.y = pos.yaw
      }
      vi += 1n
    }
    let di = 0
    while (di < droneMeshes.length) {
      const start = opts.drones[di]
      const mesh = droneMeshes[di]
      if (start !== undefined && mesh !== undefined) {
        const blk = opts.blocks[Number(start.blockId)]
        const pos = poseDrone(
          start,
          blk,
          lastTime,
          opts.sun.minutesPerHour,
          opts.droneSpeed,
          opts.droneAlt,
          opts.droneBob,
          opts.droneBobPeriod,
          landY,
          opts.droneHoverHeightBps,
          grade,
        )
        mesh.position.set(pos.x, pos.y, pos.z)
      }
      di += 1
    }
    renderer.render(scene, cam)
  }

  applySun(0n)
  paint()

  return {
    code: "",
    setCityTime(cityTime: bigint): void {
      applySun(cityTime)
      paint()
    },
    setCamera(tileX: bigint, tileY: bigint, zoomNum: bigint, zoomDen: bigint): void {
      void zoomNum
      void zoomDen
      tx = Number(tileX)
      tz = Number(tileY)
      paint()
    },
    setOrbit(azimuthBps: bigint, tiltBps: bigint, distance: bigint): void {
      az = azimuthBps
      tilt = tiltBps
      dist = distance
      paint()
    },
    hitAt(sx: bigint, sy: bigint): TileHit {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w <= 0 || h <= 0) return { tileX: 0n, tileY: 0n, objectId: "", kind: "", cell: "" }
      ndc.x = (Number(sx) / w) * two - 1
      ndc.y = -((Number(sy) / h) * two - 1)
      ray.setFromCamera(ndc, cam)
      const origin = ray.ray.origin
      const dir = ray.ray.direction
      return pickFromRay(
        origin.x,
        origin.y,
        origin.z,
        dir.x,
        dir.y,
        dir.z,
        landY,
        waterY,
        packed.map,
        lots,
      )
    },
    destroy(): void {
      ro.disconnect()
      renderer.dispose()
      canvas.remove()
      plane.dispose()
      box.dispose()
      unitGeo.dispose()
      objMat.dispose()
      walkerMat.dispose()
      robotMat.dispose()
      foamMat.dispose()
      lanternMat.dispose()
      furnitureMat.dispose()
      plantMat.dispose()
      hullMat.dispose()
      vehicleMat.dispose()
      droneMat.dispose()
      for (const mat of Object.values(mats)) {
        mat.dispose()
      }
      void decorInst
    },
  }
}
