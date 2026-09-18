import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BoxHelper,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three"
import { TransformControls } from "three/addons/controls/TransformControls.js"
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import type { Material, Object3D } from "three"
import { applyIslandMaterials } from "../../packages/render/src/islandMaterials.ts"
import {
  ANTIALIAS,
  DPR_CAP,
  HERO_FOV_DEG,
  WORLD_CLEAR,
  WORLD_EXPOSURE,
  WORLD_HEMI_GROUND,
  WORLD_HEMI_SKY,
} from "../../packages/render/src/islandConfig.ts"
import { meshoptDecoderReady } from "../../packages/render/src/islandZoom.ts"
import {
  DEFAULT_SKY_ENV,
  ENV_LOOK_REV,
  applyEnvironmentLook,
  bakeOutdoorEnvironment,
  disposeEnvironment,
  mountEnvironment,
  tagMeshShadows,
  tickEnvironment,
  type WorldCloudHint,
} from "./environment/index.ts"
import { applyWaterFlow, setWaterfallWorldBand, tickWaterFlow } from "./waterFlow.ts"
import {
  TERRA19_ALLOWED_DECOR_REFS,
  TERRA19_BUILDING_COUNT,
  formatTerra19DecorStatus,
  validateTerra19Canon,
} from "./terra19Decor.ts"
import {
  TERRA19_GROUND_SLICE_Y,
  asHardGeometryIssue,
  auditTerra19Geometry,
  classifyTerra19GeometryRole,
  formatTerra19GeometryStatus,
  isTerra19GroveRole,
  sampleXzGrid3,
  type Terra19GeometryIssue,
  type Terra19XzBox,
} from "./terra19Geometry.ts"

type Kind = "building" | "decor"
type Skyline = "hall" | "tower" | "wide" | "low" | "home"
type DecorFamily = "tree" | "green" | "lantern" | "fence" | "road" | "waterfall" | "cloud" | "other"
type CatalogItem = {
  readonly kind: Kind
  readonly ref: string
  readonly pack: string
  readonly label: string
  readonly url: string
  readonly family: DecorFamily
  readonly skyline: Skyline | ""
  native: { x: number; y: number; z: number }
}
type MapRow = {
  readonly id: string
  readonly kind: Kind
  readonly ref: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly scale: number
}
type ClipItem = {
  readonly kind: Kind
  readonly ref: string
  readonly dx: number
  readonly dy: number
  readonly dz: number
  readonly yaw: number
  readonly scale: number
}
type CamSave = {
  readonly theta: number
  readonly phi: number
  readonly radius: number
  readonly tx: number
  readonly ty: number
  readonly tz: number
}
type SaveV3 = {
  version: 3
  island: string
  islandScale?: number
  islandScaleX?: number
  islandScaleY?: number
  islandScaleZ?: number
  islandLod?: number
  objects: MapRow[]
  cam?: CamSave
  rev?: number
}
type IslandSpec = {
  readonly id: string
  readonly label: string
  readonly folder: string
  readonly file: string
  readonly preview: string
  readonly note: string
  readonly lodFiles?: readonly string[]
}

const STORE = "corporator-map-v3"
const STORE_OLD = "corporator-map-v2"
const ISLANDS: readonly IslandSpec[] = [
  { id: "atoll", label: "1 · Atoll", folder: "island1", file: "atoll-island-lod0.glb", preview: "1.png", note: "LOD0–2 отдельными файлами", lodFiles: ["atoll-island-lod0.glb", "atoll-island-lod1.glb", "atoll-island-lod2.glb"] },
  { id: "citadel", label: "2 · Citadel", folder: "island 2", file: "citadel-island.glb", preview: "2.png", note: "террасы-цитадель" },
  { id: "strata", label: "3 · Strata", folder: "island 3", file: "Strata_Island.glb", preview: "3.png", note: "крупный, районы" },
  { id: "fort", label: "4 · Fort", folder: "island 4", file: "strata-island-LOD0-LOD1.glb", preview: "4.png", note: "LOD0/1 в одном файле" },
  { id: "aether", label: "5 · Aether", folder: "island 5", file: "Aether_Island_LOD0_LOD1.glb", preview: "5.png", note: "LOD0/1 в одном файле" },
  { id: "terra", label: "6 · Terra", folder: "island 6", file: "TERRA_Floating_Island.glb", preview: "6.png", note: "крепления WF" },
]
const DECOR_FILES: readonly string[] = [
  "Bush_Forest.glb",
  "Bush_Round.glb",
  "cascade-waterfall.glb",
  "cascade-waterfall-water.glb",
  "CL-001.glb",
  "CL-002.glb",
  "CL-003.glb",
  "cumulus-cloud.glb",
  "elongated-cloud.glb",
  "Fence_Corner.glb",
  "Fence_Straight.glb",
  "grass-ground-tile-131ec0.glb",
  "grass-terrain-blob-389daa.glb",
  "Grass_Meadow.glb",
  "Grass_Tall.glb",
  "Ground_Grass.glb",
  "Lantern_Amber.glb",
  "Lantern_Cyan.glb",
  "Lantern_Violet.glb",
  "large-cloud.glb",
  "low_poly_city_props__roads_-_game_ready_asset.glb",
  "narrow-waterfall.glb",
  "narrow-waterfall-water.glb",
  "Tree_Emerald.glb",
  "Tree_Maple.glb",
  "Tree_Neon_Amethyst.glb",
  "Tree_Neon_Cyan.glb",
  "Tree_Neon_Lime.glb",
  "Tree_Neon_Rose.glb",
  "Tree_Pine.glb",
  "Tree_Young.glb",
  "WF-001.glb",
  "WF-001-water.glb",
  "WF-002.glb",
  "WF-002-water.glb",
  "WF-003.glb",
  "WF-003-water.glb",
  "wide-waterfall.glb",
  "wide-waterfall-water.glb",
]
const BUILDING_FILES: readonly { file: string; ref: string; label: string; skyline: Skyline }[] = [
  { file: "City Hall.glb", ref: "city_hall", label: "City Hall", skyline: "hall" },
  { file: "AI Research Center.glb", ref: "ai_research_center", label: "AI Research Center", skyline: "tower" },
  { file: "Cloud Campus.glb", ref: "cloud_campus", label: "Cloud Campus", skyline: "tower" },
  { file: "Finance Tower.glb", ref: "finance_tower", label: "Finance Tower", skyline: "tower" },
  { file: "Bank.glb", ref: "bank", label: "Bank", skyline: "low" },
  { file: "Exchange.glb", ref: "exchange", label: "Exchange", skyline: "low" },
  { file: "Power Node.glb", ref: "power_node", label: "Power Node", skyline: "low" },
  { file: "Agent Hub.glb", ref: "agent_hub", label: "Agent Hub", skyline: "low" },
  { file: "Workshop.glb", ref: "workshop", label: "Workshop", skyline: "low" },
  { file: "Energy Plant.glb", ref: "energy_plant", label: "Energy Plant", skyline: "wide" },
  { file: "Logistics Hub.glb", ref: "logistics_hub", label: "Logistics Hub", skyline: "wide" },
  { file: "Flagship Store.glb", ref: "flagship_store", label: "Flagship Store", skyline: "low" },
  { file: "Fleet Yard.glb", ref: "fleet_yard", label: "Fleet Yard", skyline: "wide" },
  { file: "Drone Depot.glb", ref: "drone_depot", label: "Drone Depot", skyline: "low" },
  { file: "Data Center.glb", ref: "data_center", label: "Data Center", skyline: "wide" },
  { file: "Retail_complex.glb", ref: "retail_complex", label: "Retail Complex", skyline: "wide" },
  { file: "Robotics Lab.glb", ref: "robotics_lab", label: "Robotics Lab", skyline: "low" },
  { file: "Clearing House.glb", ref: "clearing_house", label: "Clearing House", skyline: "low" },
  { file: "neon-residence.glb", ref: "neon_residence", label: "Neon Residence · опц.", skyline: "home" },
]
const TERRA19_MASS = "/art/island_v3/runtime_terra19/island_mass.glb"
const TERRA19_MAP = "/art/island_v3/maps/terra-19.json"
const TERRA19_DECOR = "/art/island_v3/maps/terra-19.decor.json"

const SCALE_REL_MIN = 0.15
const SCALE_REL_MIN_BLOB = 0.03
const SCALE_REL_MAX = 12
const BLOB_REF = "grass-terrain-blob-389daa"
const CLOUD_LIFT_FRAC = 0.62
const DECOR_FAMILIES: readonly { id: DecorFamily; label: string }[] = [
  { id: "tree", label: "Деревья" },
  { id: "green", label: "Зелень" },
  { id: "lantern", label: "Фонари" },
  { id: "fence", label: "Заборы" },
  { id: "road", label: "Дороги" },
  { id: "waterfall", label: "Водопады" },
  { id: "other", label: "Прочее" },
]

function status(text: string): void {
  const el = document.getElementById("status")
  if (el) el.textContent = text
}

function mountRenderFallback(host: HTMLElement, canvas: HTMLCanvasElement): void {
  canvas.remove()
  host.dataset.renderError = "RENDER_NO_GPU"
  const panel = document.createElement("div")
  panel.className = "render-fallback"
  panel.setAttribute("role", "alert")
  panel.textContent = "RENDER_NO_GPU · для 3D-просмотра нужен WebGL"
  host.appendChild(panel)
  status("RENDER_NO_GPU · WebGL недоступен в этом браузере или профиле")
}

function assetUrl(parts: readonly string[]): string {
  return "/" + parts.map((p) => encodeURIComponent(p)).join("/")
}

function fileStem(path: string): string {
  return path.replace(/\.glb$/i, "")
}

function prettyStem(stem: string): string {
  const n = stem.replace(/-water$/i, "")
  const base = n.replaceAll("_", " ").replaceAll("-", " ").trim()
  if (stem.toLowerCase().endsWith("-water")) return "Вода · " + base
  return base
}

function decorFamilyOf(stem: string): DecorFamily {
  const n = stem.toLowerCase()
  if (n.includes("tree")) return "tree"
  if (n.includes("bush") || n.includes("grass") || n.includes("ground")) return "green"
  if (n.includes("lantern") || n.includes("lamp")) return "lantern"
  if (n.includes("road")) return "road"
  if (n.includes("fence")) return "fence"
  if (n.includes("waterfall") || n.startsWith("wf")) return "waterfall"
  if (n.includes("cloud") || n.startsWith("cl-") || n.startsWith("cl_")) return "cloud"
  return "other"
}

function isLinearDecor(item: CatalogItem): boolean {
  if (item.kind !== "decor") return false
  if (item.family === "road") return true
  return item.family === "fence" && item.ref.toLowerCase() !== "fence_corner"
}

function linearAxis(item: CatalogItem): "x" | "z" {
  return item.native.x >= item.native.z ? "x" : "z"
}

function linearYaw(item: CatalogItem, dx: number, dz: number): number {
  return linearAxis(item) === "x" ? Math.atan2(0 - dz, dx) : Math.atan2(dx, dz)
}

function isHiddenNode(obj: Object3D): boolean {
  let cur: Object3D | null = obj
  while (cur) {
    if (!cur.visible) return true
    cur = cur.parent
  }
  return false
}

function worldBox(obj: Object3D, visibleOnly = false): Box3 {
  obj.updateMatrixWorld(true)
  const box = new Box3()
  box.makeEmpty()
  if (!visibleOnly) {
    box.expandByObject(obj)
    return box
  }
  obj.traverse((node) => {
    if (!(node instanceof Mesh) || isHiddenNode(node)) return
    const geo = node.geometry
    if (geo.boundingBox === null) geo.computeBoundingBox()
    if (geo.boundingBox === null) return
    box.union(geo.boundingBox.clone().applyMatrix4(node.matrixWorld))
  })
  if (box.isEmpty()) box.expandByObject(obj)
  return box
}

function boxSize(box: Box3): { x: number; y: number; z: number } {
  return { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z }
}

function grounded(src: Object3D): Group {
  const root = new Group()
  const inner = src.clone(true)
  root.add(inner)
  const box = worldBox(root)
  if (box.isEmpty()) return root
  inner.position.x += 0 - 0.5 * (box.min.x + box.max.x)
  inner.position.y += 0 - box.min.y
  inner.position.z += 0 - 0.5 * (box.min.z + box.max.z)
  return root
}

const TEXTURE_KEYS = [
  "map",
  "emissiveMap",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
] as const

function texturesOf(mat: Material): Texture[] {
  const bag = mat as Material & Record<string, unknown>
  const out: Texture[] = []
  for (const key of TEXTURE_KEYS) {
    const value = bag[key]
    if (value instanceof Texture) out.push(value)
  }
  return out
}

function prepareAsset(root: Object3D, doubleSide: boolean, anisotropy: number): void {
  root.traverse((node) => {
    if ("isLight" in node && node.isLight === true) {
      node.visible = false
      const lit = node as Object3D & { intensity?: number }
      if (typeof lit.intensity === "number") lit.intensity = 0
      return
    }
    if (!(node instanceof Mesh)) return
    const geo = node.geometry
    if (geo.getAttribute("normal") == null) geo.computeVertexNormals()
    const mats = Array.isArray(node.material) ? node.material : [node.material]
    for (const mat of mats) {
      if (doubleSide) mat.side = DoubleSide
      if (mat.transparent) mat.depthWrite = false
      if (anisotropy > 1) {
        for (const tex of texturesOf(mat)) {
          if (tex.magFilter === NearestFilter) continue
          tex.anisotropy = anisotropy
          tex.needsUpdate = true
        }
      }
    }
    node.castShadow = false
    node.receiveShadow = false
  })
}

function lodLevelOf(name: string): number | null {
  const n = name.toLowerCase().replace(/\s+/g, "")
  const m = n.match(/lod(\d+)/)
  if (m === null || m[1] === undefined) return null
  return Number(m[1])
}

function collectLodLevels(root: Object3D): number[] {
  const found = new Set<number>()
  root.traverse((node) => {
    const lv = lodLevelOf(node.name)
    if (lv !== null) found.add(lv)
  })
  return [...found].sort((a, b) => a - b)
}

function applyEmbeddedLod(root: Object3D, level: number): void {
  const levels = collectLodLevels(root)
  if (levels.length < 2) return
  const use = levels.includes(level) ? level : (levels[0] ?? 0)
  root.traverse((node) => {
    const lv = lodLevelOf(node.name)
    if (lv === null) return
    node.visible = lv === use
  })
}

function lodsFromFiles(spec: IslandSpec): number[] {
  if (spec.lodFiles === undefined || spec.lodFiles.length < 2) return []
  const found = new Set<number>()
  for (const file of spec.lodFiles) {
    const lv = lodLevelOf(file)
    if (lv !== null) found.add(lv)
  }
  return [...found].sort((a, b) => a - b)
}

function islandGlbFile(spec: IslandSpec, lod: number): string {
  const hit = spec.lodFiles?.find((file) => lodLevelOf(file) === lod)
  return hit ?? spec.file
}

function islandCacheKey(spec: IslandSpec, lod: number): string {
  return lodsFromFiles(spec).length > 1 ? spec.id + ":" + String(lod) : spec.id
}

function isWfMountName(name: string): boolean {
  const n = name.toLowerCase().replace(/\s+/g, "_")
  return /wf[_-]?\d+.*(mount|socket)/.test(n)
}

function isWfAttachmentName(name: string): boolean {
  const n = name.toLowerCase().replace(/\s+/g, "_")
  return n === "attachments" || n.startsWith("waterfall_attachment_")
}

function hideWfAttachmentVisuals(root: Object3D): void {
  root.traverse((node) => {
    if (isWfAttachmentName(node.name)) node.visible = false
  })
}

async function listDecorFiles(): Promise<string[]> {
  try {
    const ac = new AbortController()
    const timer = globalThis.setTimeout(() => ac.abort(), 2500)
    const res = await fetch("/api/decoration", { signal: ac.signal })
    globalThis.clearTimeout(timer)
    if (!res.ok) throw new Error("decoration api " + String(res.status))
    const body: unknown = await res.json()
    if (typeof body !== "object" || body === null || !("files" in body)) throw new Error("decoration api shape")
    const files = (body as { files: unknown }).files
    if (!Array.isArray(files)) throw new Error("decoration api files")
    const out: string[] = []
    const seen = new Set<string>()
    for (const row of files) {
      if (typeof row !== "string") continue
      if (!row.toLowerCase().endsWith(".glb")) continue
      if (row.includes("/") || row.includes("\\") || row.includes("..")) continue
      if (seen.has(row)) continue
      seen.add(row)
      out.push(row)
    }
    if (out.length === 0) throw new Error("decoration api empty")
    out.sort((a, b) => a.localeCompare(b))
    return out
  } catch {
    return [...DECOR_FILES]
  }
}

function floats(item: CatalogItem): boolean {
  return item.family === "cloud" || item.family === "waterfall"
}

function finiteNum(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null
}

function camFromUnknown(raw: unknown): CamSave | null {
  if (typeof raw !== "object" || raw === null) return null
  const row = raw as Record<string, unknown>
  const theta = finiteNum(row.theta)
  const phi = finiteNum(row.phi)
  const radius = finiteNum(row.radius)
  const tx = finiteNum(row.tx)
  const ty = finiteNum(row.ty)
  const tz = finiteNum(row.tz)
  if (theta === null || phi === null || radius === null || tx === null || ty === null || tz === null) return null
  if (radius <= 0) return null
  return { theta, phi, radius, tx, ty, tz }
}

function ghostShade(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    const raw = node.material
    const list = Array.isArray(raw) ? [...raw] : [raw]
    const next: Material[] = []
    for (const mat of list) {
      const copy = mat.clone()
      copy.transparent = true
      copy.opacity = 0.55
      copy.depthWrite = false
      next.push(copy)
    }
    node.castShadow = false
    node.receiveShadow = false
    const first = next[0]
    if (next.length === 1 && first !== undefined) node.material = first
    else node.material = next
  })
}

async function loadGlb(loader: GLTFLoader, url: string): Promise<Group> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("glb " + url + " " + String(res.status))
  const buf = await res.arrayBuffer()
  return await new Promise((resolve, reject) => {
    loader.parse(buf, "", (gltf) => resolve(gltf.scene), reject)
  })
}

function dietBuildingUrl(ref: string): string {
  return assetUrl(["art", "island_v3", "runtime_terra19", "buildings", ref + ".glb"])
}

function mapRoot(obj: Object3D): Object3D | null {
  let cur: Object3D | null = obj
  while (cur) {
    if (typeof cur.userData.mapId === "string" && cur.userData.mapId.length > 0) return cur
    cur = cur.parent
  }
  return null
}

function scaleRelMin(ref: string): number {
  return ref === BLOB_REF ? SCALE_REL_MIN_BLOB : SCALE_REL_MIN
}

function itemFit(item: CatalogItem, span: number): number {
  const sy = Math.max(item.native.y, 1e-6)
  const foot = Math.max(item.native.x, item.native.z, 1e-6)
  if (item.kind === "building") {
    if (item.skyline === "hall") return (span * 0.28) / sy
    if (item.skyline === "tower") return (span * 0.2) / sy
    if (item.skyline === "home") return (span * 0.14) / sy
    const byFoot = (span * (item.skyline === "wide" ? 0.12 : 0.1)) / foot
    const byH = (span * 0.16) / sy
    return Math.min(byFoot, byH)
  }
  if (item.family === "tree") return (span * 0.055) / sy
  if (item.family === "lantern") return (span * 0.035) / sy
  if (item.family === "green") return (span * 0.03) / sy
  if (item.family === "fence") return (span * 0.028) / sy
  if (item.family === "road") return (span * 0.06) / foot
  if (item.family === "waterfall") return (span * 0.22) / sy
  if (item.family === "cloud") return (span * 0.15) / sy
  return (span * 0.04) / sy
}

/** LOOK-03 `preview.ts` day/dusk/night light bps. Bloom stays LOOK-09 (not on stone). */
const LOOK03_SPAN = 10000
const LOOK03_DAY_SUN_BPS = 9100
const LOOK03_DAY_AMBIENT_BPS = 3450
const LOOK03_DUSK_SUN_BPS = 3700
const LOOK03_DUSK_AMBIENT_BPS = 1750
const LOOK03_NIGHT_SUN_BPS = 850
const LOOK03_NIGHT_AMBIENT_BPS = 1050
const LOOK03_EMISSIVE_BPS = 8000

function look03FromBps(v: number): number {
  return v / LOOK03_SPAN
}

type StudioRuntime = {
  stop: boolean
  raf: number
  renderer: WebGLRenderer | null
  thumb: WebGLRenderer | null
}

function loseRenderer(gl: WebGLRenderer | null): void {
  if (gl === null) return
  gl.dispose()
}

function stopStudio(rt: StudioRuntime): void {
  rt.stop = true
  if (rt.raf !== 0) {
    globalThis.cancelAnimationFrame(rt.raf)
    rt.raf = 0
  }
  loseRenderer(rt.renderer)
  rt.renderer = null
  loseRenderer(rt.thumb)
  rt.thumb = null
}

function studioRuntime(): StudioRuntime {
  const g = globalThis as typeof globalThis & { __corporatorIslandStudio?: StudioRuntime }
  const prev = g.__corporatorIslandStudio
  if (prev !== undefined) stopStudio(prev)
  const next: StudioRuntime = { stop: false, raf: 0, renderer: null, thumb: null }
  g.__corporatorIslandStudio = next
  return next
}

export async function main(): Promise<void> {
  const host = document.getElementById("host")
  const railB = document.getElementById("buildings")
  const railD = document.getElementById("decor")
  const placedList = document.getElementById("placed")
  const islandRail = document.getElementById("islands")
  if (host === null || railB === null || railD === null || placedList === null || islandRail === null) {
    throw new Error("map shell missing")
  }
  const runtime = studioRuntime()
  for (const old of [...host.querySelectorAll("canvas")]) old.remove()

  const catalog: CatalogItem[] = []
  const proto = new Map<string, Group>()
  const islandCache = new Map<string, Group>()
  const placed = new Group()
  placed.name = "placed"
  const markers = new Group()
  markers.name = "wf_markers"
  const selected = new Set<Object3D>()
  const selHelpers = new Group()
  selHelpers.name = "sel_helpers"
  const selPivot = new Group()
  selPivot.name = "sel_pivot"
  selPivot.visible = false
  const clipBoard: ClipItem[] = []
  const lastGround = new Vector3()
  let hasLastGround = false
  const pivotDragOrigin = new Vector3()
  let pivotDragYaw = 0
  let pivotDragScale = 1
  const pivotStartPos = new Map<Object3D, Vector3>()
  const pivotStartYaw = new Map<Object3D, number>()
  const pivotStartScale = new Map<Object3D, number>()
  const yAxis = new Vector3(0, 1, 0)
  const tmpV = new Vector3()
  let seq = 1
  let stamp: CatalogItem | null = null
  let ghost: Group | null = null
  const hist: string[] = []
  let histAt = -1
  let hushHist = false
  let islandId = "atoll"
  let island = new Group()
  island.name = "island_mass"
  let islandBox = new Box3()
  let islandSpan = 32
  let nativeSpan = 32
  let islandScaleX = 1
  let islandScaleY = 1
  let islandScaleZ = 1
  const islandAnchor = new Vector3()
  let islandLod = 0
  let islandGen = 0
  let series = true
  let lineOn = false
  let snapOn = false
  let randYaw = true
  let wfOn = false
  let sameScaleOn = false
  let sessionReady = false
  let sessionRev = 0
  let skyRoot: Group | null = null
  let skyBusy = false
  let envDirty = false
  let envSpan = -1
  let envLookRev = -1
  let envPlaced = -1
  let envTimer = 0
  let lightMode = "day"
  let shadowDirty = true
  let fpsFrames = 0
  let fpsStamp = 0
  const clock = new Clock()
  let decorFilter: DecorFamily | "all" = "all"
  const wfPoints: { name: string; pos: Vector3 }[] = []

  const canvas = document.createElement("canvas")
  host.appendChild(canvas)
  const marquee = document.createElement("div")
  marquee.id = "marquee"
  marquee.hidden = true
  document.body.appendChild(marquee)
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: ANTIALIAS,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    })
  } catch {
    mountRenderFallback(host, canvas)
    return
  }
  runtime.renderer = renderer
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = WORLD_EXPOSURE
  renderer.setClearColor(WORLD_CLEAR)
  const rawDpr = globalThis.devicePixelRatio
  const dpr = rawDpr > DPR_CAP ? DPR_CAP : rawDpr > 0 ? rawDpr : 1
  renderer.setPixelRatio(dpr)
  renderer.setSize(host.clientWidth, host.clientHeight, false)
  renderer.shadowMap.enabled = false
  canvas.addEventListener("webglcontextlost", () => {
    runtime.stop = true
    status("RENDER_NO_GPU · WebGL context lost · обнови страницу (Ctrl+F5)")
  })
  const textureAnisotropy = renderer.capabilities.getMaxAnisotropy()
  async function withHushedShadows<T>(fn: () => Promise<T>): Promise<T> {
    return fn()
  }

  const scene = new Scene()
  scene.background = new Color(WORLD_CLEAR)
  scene.environment = null
  scene.add(placed)
  scene.add(markers)
  scene.add(selHelpers)
  scene.add(selPivot)
  scene.add(island)
  const glowMats: MeshStandardMaterial[] = []
  const glowExport = new WeakMap<MeshStandardMaterial, number>()
  const ambient = new AmbientLight()
  ambient.intensity = look03FromBps(LOOK03_DAY_AMBIENT_BPS)
  scene.add(ambient)
  const hemi = new HemisphereLight(WORLD_HEMI_SKY, WORLD_HEMI_GROUND)
  hemi.intensity = look03FromBps(LOOK03_DAY_AMBIENT_BPS)
  scene.add(hemi)
  const sun = new DirectionalLight()
  sun.intensity = look03FromBps(LOOK03_DAY_SUN_BPS)
  sun.position.set(18, 42, 14)
  sun.castShadow = false
  scene.add(sun)
  scene.add(sun.target)
  const fill = new DirectionalLight()
  fill.intensity = 0
  fill.position.set(-14, 12, -10)
  fill.castShadow = false
  scene.add(fill)
  scene.add(fill.target)
  const skyEnv = bakeOutdoorEnvironment(renderer)
  if (skyEnv !== null) {
    scene.environment = skyEnv
    const withIbl = scene as Scene & { environmentIntensity?: number }
    if (typeof withIbl.environmentIntensity === "number") withIbl.environmentIntensity = DEFAULT_SKY_ENV.environmentIntensity
  }

  const camera = new PerspectiveCamera(
    HERO_FOV_DEG,
    host.clientWidth / Math.max(host.clientHeight, 1),
    0.05,
    4000,
  )
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault())

  await meshoptDecoderReady(MeshoptDecoder)
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  const target = new Vector3(0, 2, 0)
  const MIN_PHI = 0.12
  const MAX_PHI = Math.PI / 2 - 0.06
  let theta = Math.PI / 4
  let phi = 0.95
  let radius = 48
  let gizmoBusy = false
  let ptr: {
    id: number
    x: number
    y: number
    sx: number
    sy: number
    button: number
    dragging: boolean
    mode: "none" | "orbit" | "pan" | "move" | "line" | "box"
  } | null = null
  let lineStart: Vector3 | null = null

  function minR(): number {
    return Math.max(4, islandSpan * 0.08)
  }
  function maxR(): number {
    return Math.max(120, islandSpan * 12)
  }

  function applyCam(): void {
    if (phi < MIN_PHI) phi = MIN_PHI
    if (phi > MAX_PHI) phi = MAX_PHI
    if (radius < minR()) radius = minR()
    if (radius > maxR()) radius = maxR()
    const sp = Math.sin(phi)
    camera.position.set(target.x + radius * sp * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + radius * sp * Math.cos(theta))
    const nextNear = Math.max(0.2, radius * 0.01)
    const nextFar = Math.max(radius * 6, islandSpan * 6, 400)
    if (camera.near !== nextNear || camera.far !== nextFar) {
      camera.near = nextNear
      camera.far = nextFar
      camera.updateProjectionMatrix()
    }
    camera.lookAt(target.x, target.y, target.z)
    host.dataset.camRadius = radius.toFixed(4)
    if (ptr === null || !ptr.dragging) scheduleStore()
  }

  function panScreen(dx: number, dy: number): void {
    const vScale = (radius * Math.tan((camera.fov * Math.PI) / 360) * 2) / Math.max(host.clientHeight, 1)
    const rx = Math.cos(theta)
    const rz = 0 - Math.sin(theta)
    const ux = 0 - Math.cos(phi) * Math.sin(theta)
    const uy = Math.sin(phi)
    const uz = 0 - Math.cos(phi) * Math.cos(theta)
    const sx = vScale * (0 - dx)
    const sy = vScale * dy
    target.x += rx * sx + ux * sy
    target.y += uy * sy
    target.z += rz * sx + uz * sy
    applyCam()
  }

  function reviewBox(): Box3 {
    const box = worldBox(island, true)
    const placedBox = worldBox(placed, true)
    if (!placedBox.isEmpty()) box.union(placedBox)
    return box
  }

  function fitIslandView(): void {
    const box = reviewBox()
    if (box.isEmpty()) return
    const size = boxSize(box)
    target.set(0.5 * (box.min.x + box.max.x), 0.5 * (box.min.y + box.max.y) + size.y * 0.08, 0.5 * (box.min.z + box.max.z))
    radius = Math.max(size.x, size.z, size.y) * 1.85
    theta = Math.PI / 4
    phi = 0.95
    applyCam()
  }

  applyCam()

  const gizmo = new TransformControls(camera, canvas)
  gizmo.setSpace("world")
  gizmo.setSize(0.9)
  gizmo.enabled = false
  scene.add(gizmo.getHelper())
  gizmo.addEventListener("dragging-changed", (ev) => {
    gizmoBusy = ev.value === true
    const obj = gizmo.object
    if (ev.value === true) {
      if (obj === selPivot) capturePivotDrag()
      return
    }
    if (obj !== undefined) {
      if (obj === selPivot) {
        bakePivotDrag()
      } else {
        if (gizmo.mode === "translate") maybeDrop(obj)
        if (gizmo.mode === "rotate") {
          obj.rotation.x = 0
          obj.rotation.z = 0
        }
        if (gizmo.mode === "scale") {
          applyRelativeScale(obj, relativeScale(obj))
          spreadSameModelScale(obj)
        }
      }
    }
    persist()
    pushHist()
    syncProps()
    shadowDirty = true
  })
  gizmo.addEventListener("objectChange", () => {
    const obj = gizmo.object
    if (obj === undefined) return
    if (obj === selPivot) {
      applyPivotDrag()
      return
    }
    if (gizmo.mode === "translate") maybeDrop(obj)
    if (gizmo.mode === "scale") {
      applyRelativeScale(obj, relativeScale(obj))
      spreadSameModelScale(obj)
    }
    if (gizmo.mode === "rotate") {
      obj.rotation.x = 0
      obj.rotation.z = 0
    }
    syncProps()
  })

  const ray = new Raycaster()
  const geoRay = new Raycaster()
  const geoOrigin = new Vector3()
  const geoDown = new Vector3(0, -1, 0)
  const ndc = new Vector2()
  const thumbCanvas = document.createElement("canvas")
  let thumbRenderer: WebGLRenderer | null = null
  try {
    thumbRenderer = new WebGLRenderer({ canvas: thumbCanvas, antialias: false, alpha: false, powerPreference: "low-power" })
    thumbRenderer.outputColorSpace = SRGBColorSpace
    thumbRenderer.toneMapping = ACESFilmicToneMapping
    thumbRenderer.setSize(96, 96, false)
    thumbRenderer.setClearColor(0x243040, 1)
    runtime.thumb = thumbRenderer
  } catch {
    status("RENDER_THUMBNAILS_UNAVAILABLE · превью палитры отключено")
  }
  const thumbCam = new PerspectiveCamera(28, 1, 0.1, 20000)

  const loop = (): void => {
    if (runtime.stop) return
    tickWaterFlow(clock.getElapsedTime())
    tickEnvironment(skyRoot, camera)
    if (selHelpers.children.length > 0) {
      for (const h of selHelpers.children) {
        if (h instanceof BoxHelper) h.update()
      }
    }
    if (shadowDirty && renderer.shadowMap.enabled) {
      renderer.shadowMap.needsUpdate = true
      shadowDirty = false
    }
    renderer.render(scene, camera)
    fpsFrames += 1
    const now = performance.now()
    if (now - fpsStamp >= 1000) {
      host.dataset.fps = String(fpsFrames)
      fpsFrames = 0
      fpsStamp = now
    }
    runtime.raf = globalThis.requestAnimationFrame(loop)
  }
  runtime.raf = globalThis.requestAnimationFrame(loop)
  function holdPtr(id: number): void {
    try {
      canvas.setPointerCapture(id)
    } catch {
      return
    }
  }

  function dropPtr(id: number): void {
    try {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
    } catch {
      return
    }
  }

  function stampYaw(item: CatalogItem): number {
    if (randYaw && (item.family === "tree" || item.family === "green" || item.family === "cloud")) {
      return Math.random() * Math.PI * 2
    }
    return 0
  }

  function bindCanvasInput(): void {
    canvas.addEventListener("pointerdown", (ev) => {
      if (gizmoBusy) return
      if (ev.button === 0 && gizmo.object !== undefined && gizmo.axis !== null && gizmo.axis !== undefined) return
      holdPtr(ev.pointerId)
      const lineReady = ev.button === 0 && !ev.shiftKey && stamp !== null && lineOn && isLinearDecor(stamp)
      lineStart = lineReady ? groundHit(ev.clientX, ev.clientY) : null
      ptr = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, button: ev.button, dragging: false, mode: "none" }
      if (ev.button === 0) host.style.cursor = stamp === null ? "grabbing" : "crosshair"
      else host.style.cursor = "move"
    })

    canvas.addEventListener("pointermove", (ev) => {
      if (ptr !== null && ptr.id === ev.pointerId) {
        const dx = ev.clientX - ptr.x
        const dy = ev.clientY - ptr.y
        ptr.x = ev.clientX
        ptr.y = ev.clientY
        if (!ptr.dragging && Math.hypot(ev.clientX - ptr.sx, ev.clientY - ptr.sy) > 5) {
          ptr.dragging = true
          if (ptr.button === 0 && ev.shiftKey && stamp === null) {
            ptr.mode = "box"
          } else if (ptr.button === 0 && !ev.shiftKey) {
            if (stamp !== null && lineOn && isLinearDecor(stamp) && lineStart !== null) {
              ptr.mode = "line"
            } else {
              const hit = stamp === null ? pickHit(ptr.sx, ptr.sy) : null
              ptr.mode = hit !== null ? "move" : "orbit"
              if (hit !== null && !selected.has(hit)) selectOnly(hit)
              if (hit !== null) syncProps()
            }
          } else if (ptr.button === 0) {
            ptr.mode = "orbit"
          } else ptr.mode = "pan"
        }
        if (ptr.dragging) {
          if (ptr.mode === "line") {
            const start = lineStart
            const end = groundHit(ev.clientX, ev.clientY)
            if (start !== null && end !== null) updateLineGhost(start, end)
          } else {
            if (ghost !== null) ghost.visible = false
          }
          if (ptr.mode === "box") showMarquee(ptr.sx, ptr.sy, ev.clientX, ev.clientY)
          else if (ptr.mode === "orbit") {
            theta -= dx * 0.0075
            phi -= dy * 0.0055
            applyCam()
          } else if (ptr.mode === "pan") panScreen(dx, dy)
          else if (ptr.mode === "move") {
            const ground = groundHit(ev.clientX, ev.clientY)
            if (ground !== null) moveSelectionTo(ground)
          }
          return
        }
      }
      if (ghost === null || stamp === null) return
      if (ptr !== null && ptr.dragging) return
      const ground = groundHit(ev.clientX, ev.clientY)
      if (ground === null) return
      ghost.visible = true
      ghost.position.set(ground.x, ground.y, ground.z)
      const sc = stampFit(stamp)
      ghost.scale.set(sc, sc, sc)
    })

    canvas.addEventListener("pointerup", (ev) => {
      if (ptr === null || ptr.id !== ev.pointerId) return
      const dragged = ptr.dragging
      const mode = ptr.mode
      const sx = ptr.sx
      const sy = ptr.sy
      const start = lineStart
      const end = mode === "line" ? groundHit(ev.clientX, ev.clientY) : null
      ptr = null
      lineStart = null
      dropPtr(ev.pointerId)
      host.style.cursor = stamp === null ? "grab" : "crosshair"
      if (dragged) {
        if (mode === "box") {
          hideMarquee()
          if (Math.abs(ev.clientX - sx) < 8 && Math.abs(ev.clientY - sy) < 8) {
            const picked = pickHit(sx, sy)
            if (picked !== null) toggleSelect(picked)
          } else {
            marqueeSelect(sx, sy, ev.clientX, ev.clientY, true)
          }
          syncProps()
        } else if (mode === "move") {
          settleNodes(selectionList())
          persist()
          pushHist()
          shadowDirty = true
        } else if (mode === "line" && start !== null && end !== null && stamp !== null) {
          const item = stamp
          const keep = series
          const scale = stampFit(item)
          if (!keep) setStamp(null, null)
          if (ghost !== null) ghost.visible = false
          void placeLine(item, start, end, scale).then((count) => {
            persist()
            pushHist()
            syncProps()
            status("линия: " + item.label + " · " + String(count) + " шт.")
          }).catch((err: unknown) => {
            status("ошибка линии: " + String(err))
          })
        } else if (mode === "orbit" || mode === "pan") {
          scheduleStore()
        }
        return
      }
      if (ev.button !== 0 || gizmoBusy) return
      if (stamp !== null) {
        const ground = groundHit(ev.clientX, ev.clientY)
        if (ground === null) return
        const item = stamp
        const keep = series
        if (!keep) {
          setStamp(null, null)
          host.style.cursor = "grab"
        }
        const sc = stampFit(item)
        void spawn(item, ground.x, ground.y, ground.z, stampYaw(item), sc).then((node) => {
          if (!floats(item)) dropToGround(node)
          selectOnly(node)
          persist()
          pushHist()
          syncProps()
        })
        return
      }
      const picked = pickHit(ev.clientX, ev.clientY)
      if (picked !== null) {
        if (ev.shiftKey || ev.ctrlKey || ev.metaKey) toggleSelect(picked)
        else if (!selected.has(picked)) selectOnly(picked)
        status("выбрано " + String(selected.size) + " шт.")
      } else if (!ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
        clearSelection()
      }
      syncProps()
    })

    canvas.addEventListener("pointercancel", (ev) => {
      if (ptr !== null && ptr.id === ev.pointerId) ptr = null
      lineStart = null
      hideMarquee()
      if (ghost !== null) ghost.visible = false
      host.style.cursor = stamp === null ? "grab" : "crosshair"
    })

    canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault()
        const raw = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * host.clientHeight : ev.deltaY
        const steps = Math.max(-3, Math.min(3, raw / 100))
        const next = radius * Math.pow(1.12, steps)
        if (steps < 0) {
          const hit = groundHit(ev.clientX, ev.clientY)
          if (hit !== null) {
            const k = 0.18
            target.x += (hit.x - target.x) * k
            target.y += (hit.y - target.y) * k
            target.z += (hit.z - target.z) * k
          }
        }
        radius = next
        applyCam()
      },
      { passive: false },
    )
  }

  bindCanvasInput()
  globalThis.addEventListener("resize", () => {
    camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1)
    camera.updateProjectionMatrix()
    renderer.setSize(host.clientWidth, host.clientHeight, false)
  })

  function protoKey(item: CatalogItem): string {
    return item.kind + ":" + item.ref
  }

  async function ensureProto(item: CatalogItem): Promise<void> {
    const key = protoKey(item)
    if (proto.has(key)) return
    const loaded = await loadGlb(loader, item.url)
    // The road GLB is an asset pack. Use its straight Road child as the
    // repeatable module; placing the whole pack would duplicate every prop.
    const sceneG =
      item.family === "road" && item.ref.includes("city_props")
        ? (loaded.getObjectByName("Road") ?? loaded)
        : loaded
    prepareAsset(sceneG, item.kind === "decor", textureAnisotropy)
    applyIslandMaterials(sceneG, glowMats)
    applyGlow()
    if (item.family === "waterfall") {
      hideWfAttachmentVisuals(sceneG)
    }
    const g = grounded(sceneG)
    if (item.family === "waterfall") applyWaterFlow(g)
    item.native = boxSize(worldBox(g))
    proto.set(key, g)
  }

  function catalogItem(kind: Kind, ref: string): CatalogItem | null {
    for (const row of catalog) {
      if (row.kind === kind && row.ref === ref) return row
    }
    return null
  }

  function fitOf(obj: Object3D): number {
    const kind = obj.userData.kind
    const ref = obj.userData.ref
    if ((kind !== "building" && kind !== "decor") || ref === undefined) return 1
    const item = catalogItem(kind, ref)
    return item === null ? 1 : stampFit(item)
  }

  function stampFit(item: CatalogItem): number {
    if (item.kind === "decor" && (item.family === "waterfall" || item.family === "cloud")) return itemFit(item, islandSpan)
    return itemFit(item, nativeSpan)
  }

  function relativeScale(obj: Object3D): number {
    const fit = fitOf(obj)
    if (fit <= 1e-8) return 1
    return obj.scale.x / fit
  }

  function applyRelativeScale(obj: Object3D, rel: number): void {
    const ref = typeof obj.userData.ref === "string" ? obj.userData.ref : ""
    const s = fitOf(obj) * Math.min(SCALE_REL_MAX, Math.max(scaleRelMin(ref), rel))
    obj.scale.set(s, s, s)
  }

  function snapXZ(x: number, z: number): { x: number; z: number } {
    if (!snapOn) return { x, z }
    const step = Math.max(0.25, islandSpan / 80)
    return { x: Math.round(x / step) * step, z: Math.round(z / step) * step }
  }

  function groundYAt(x: number, z: number): number | null {
    ray.ray.origin.set(x, islandBox.max.y + islandSpan, z)
    ray.ray.direction.set(0, -1, 0)
    const hits = ray.intersectObject(island, true)
    for (const h of hits) {
      if (!(h.object instanceof Mesh) || isHiddenNode(h.object)) continue
      return h.point.y
    }
    return null
  }

  function dropToGround(obj: Object3D): void {
    const gy = groundYAt(obj.position.x, obj.position.z)
    if (gy === null) return
    obj.position.y = gy
  }

  function objectFloats(obj: Object3D): boolean {
    const kind = obj.userData.kind
    const ref = obj.userData.ref
    if (kind !== "building" && kind !== "decor") return false
    const item = catalogItem(kind, typeof ref === "string" ? ref : "")
    return item !== null && floats(item)
  }

  function settleNodes(nodes: readonly Object3D[]): void {
    let bestGap = 0
    let found = false
    for (const obj of nodes) {
      if (objectFloats(obj)) continue
      const gy = groundYAt(obj.position.x, obj.position.z)
      if (gy === null) continue
      const gap = gy - obj.position.y
      if (!found || gap > bestGap) {
        bestGap = gap
        found = true
      }
    }
    if (!found || Math.abs(bestGap) < 1e-5) return
    for (const obj of nodes) {
      if (objectFloats(obj)) continue
      obj.position.y += bestGap
    }
  }

  function maybeDrop(obj: Object3D): void {
    const kind = obj.userData.kind
    const ref = obj.userData.ref
    if (kind !== "building" && kind !== "decor") {
      dropToGround(obj)
      return
    }
    const item = catalogItem(kind, ref ?? "")
    if (item !== null && floats(item)) return
    dropToGround(obj)
  }

  function nearestWf(point: Vector3): Vector3 | null {
    if (wfPoints.length === 0) return null
    let best: Vector3 | null = null
    let bestD = islandSpan * 0.09
    for (const row of wfPoints) {
      const d = point.distanceTo(row.pos)
      if (d < bestD) {
        bestD = d
        best = row.pos
      }
    }
    return best
  }

  function groundHit(clientX: number, clientY: number): Vector3 | null {
    const rect = canvas.getBoundingClientRect()
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hits = ray.intersectObject(island, true)
    for (const h of hits) {
      if (!(h.object instanceof Mesh) || isHiddenNode(h.object)) continue
      const p = h.point.clone()
      const xz = snapXZ(p.x, p.z)
      p.x = xz.x
      p.z = xz.z
      if (stamp !== null && stamp.family === "waterfall") {
        const sock = nearestWf(p)
        if (sock !== null) {
          lastGround.copy(sock)
          hasLastGround = true
          return sock.clone()
        }
      }
      if (stamp !== null && stamp.family === "cloud") p.y += islandSpan * CLOUD_LIFT_FRAC
      lastGround.copy(p)
      hasLastGround = true
      return p
    }
    return null
  }

  function pickHit(clientX: number, clientY: number): Object3D | null {
    const rect = canvas.getBoundingClientRect()
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hits = ray.intersectObjects(placed.children, true)
    for (const h of hits) {
      const root = mapRoot(h.object)
      if (root !== null) return root
    }
    return null
  }

  function selectionList(): Object3D[] {
    const out: Object3D[] = []
    for (const child of placed.children) {
      if (selected.has(child)) out.push(child)
    }
    return out
  }

  function modelKeyOf(obj: Object3D): { kind: Kind; ref: string } | null {
    const kind = obj.userData.kind
    const ref = obj.userData.ref
    if ((kind !== "building" && kind !== "decor") || typeof ref !== "string" || ref.length === 0) return null
    return { kind, ref }
  }

  function sameModelList(kind: Kind, ref: string): Object3D[] {
    const out: Object3D[] = []
    for (const child of placed.children) {
      if (child.userData.kind === kind && child.userData.ref === ref) out.push(child)
    }
    return out
  }

  function selectionModel(): { kind: Kind; ref: string } | null {
    const objs = selectionList()
    const first = objs[0]
    if (first === undefined) return null
    const key = modelKeyOf(first)
    if (key === null) return null
    for (const obj of objs) {
      const k = modelKeyOf(obj)
      if (k === null || k.kind !== key.kind || k.ref !== key.ref) return null
    }
    return key
  }

  function scaleTargets(): Object3D[] {
    const model = selectionModel()
    if (sameScaleOn && model !== null) return sameModelList(model.kind, model.ref)
    return selectionList()
  }

  function spreadSameModelScale(from: Object3D): void {
    if (!sameScaleOn) return
    const key = modelKeyOf(from)
    if (key === null) return
    const rel = relativeScale(from)
    for (const obj of sameModelList(key.kind, key.ref)) {
      if (obj === from) continue
      applyRelativeScale(obj, rel)
    }
  }

  function applyRelToScaleTargets(rel: number): number {
    const targets = scaleTargets()
    for (const obj of targets) applyRelativeScale(obj, rel)
    return targets.length
  }

  function syncSameScaleUi(): void {
    const el = document.getElementById("same-scale")
    if (!(el instanceof HTMLButtonElement)) return
    const model = selectionModel()
    el.dataset.on = sameScaleOn ? "1" : "0"
    el.disabled = model === null
    if (model === null) {
      el.textContent = "Все такие"
      el.title = "выбери объекты одной модели"
      return
    }
    const n = sameModelList(model.kind, model.ref).length
    const item = catalogItem(model.kind, model.ref)
    const label = item === null ? model.ref : item.label
    el.textContent = "Все такие · " + String(n)
    el.title = sameScaleOn
      ? "размер идёт на все «" + label + "» (" + String(n) + " шт.)"
      : "включить: размер для всех «" + label + "» на карте"
  }

  function centroidOf(objs: readonly Object3D[]): Vector3 {
    const c = new Vector3()
    if (objs.length === 0) return c
    for (const obj of objs) c.add(obj.position)
    return c.multiplyScalar(1 / objs.length)
  }

  function syncSelHelpers(): void {
    while (selHelpers.children.length > 0) {
      const ch = selHelpers.children[selHelpers.children.length - 1]
      if (ch) selHelpers.remove(ch)
    }
    for (const obj of selectionList()) {
      const helper = new BoxHelper(obj, 0xc9e27a)
      helper.raycast = () => {}
      selHelpers.add(helper)
    }
    host.dataset.selCount = String(selected.size)
    for (const el of placedList.querySelectorAll("button")) {
      if (!(el instanceof HTMLElement)) continue
      const id = el.dataset.mapId
      el.dataset.on = id !== undefined && [...selected].some((o) => o.userData.mapId === id) ? "1" : "0"
    }
  }

  function bindGizmoToSelection(): void {
    const objs = selectionList()
    gizmo.detach()
    selPivot.visible = false
    selPivot.rotation.set(0, 0, 0)
    selPivot.scale.set(1, 1, 1)
    if (objs.length === 0) {
      gizmo.enabled = false
      syncSelHelpers()
      return
    }
    gizmo.enabled = true
    if (objs.length === 1) {
      const only = objs[0]
      if (only !== undefined) {
        gizmo.attach(only)
        setMode(gizmo.mode)
      }
      syncSelHelpers()
      return
    }
    selPivot.position.copy(centroidOf(objs))
    selPivot.visible = true
    gizmo.attach(selPivot)
    setMode(gizmo.mode)
    syncSelHelpers()
  }

  function selectOnly(obj: Object3D | null): void {
    selected.clear()
    if (obj !== null) selected.add(obj)
    bindGizmoToSelection()
  }

  function toggleSelect(obj: Object3D): void {
    if (selected.has(obj)) selected.delete(obj)
    else selected.add(obj)
    bindGizmoToSelection()
  }

  function clearSelection(): void {
    selected.clear()
    bindGizmoToSelection()
  }

  function capturePivotDrag(): void {
    pivotDragOrigin.copy(selPivot.position)
    pivotDragYaw = selPivot.rotation.y
    pivotDragScale = Math.max(Math.abs(selPivot.scale.x), 1e-6)
    pivotStartPos.clear()
    pivotStartYaw.clear()
    pivotStartScale.clear()
    for (const obj of selectionList()) {
      pivotStartPos.set(obj, obj.position.clone())
      pivotStartYaw.set(obj, obj.rotation.y)
      pivotStartScale.set(obj, obj.scale.x)
    }
  }

  function applyPivotDrag(): void {
    selPivot.rotation.x = 0
    selPivot.rotation.z = 0
    const s = Math.abs(selPivot.scale.x)
    selPivot.scale.set(s, s, s)
    const dyaw = selPivot.rotation.y - pivotDragYaw
    const ds = s / pivotDragScale
    for (const obj of selectionList()) {
      const p0 = pivotStartPos.get(obj)
      const y0 = pivotStartYaw.get(obj)
      const s0 = pivotStartScale.get(obj)
      if (p0 === undefined || y0 === undefined || s0 === undefined) continue
      tmpV.copy(p0).sub(pivotDragOrigin).applyAxisAngle(yAxis, dyaw).multiplyScalar(ds)
      obj.position.copy(selPivot.position).add(tmpV)
      obj.rotation.y = y0 + dyaw
      const next = s0 * ds
      obj.scale.set(next, next, next)
    }
  }

  function bakePivotDrag(): void {
    applyPivotDrag()
    selPivot.rotation.set(0, 0, 0)
    selPivot.scale.set(1, 1, 1)
    const objs = selectionList()
    if (objs.length > 0) selPivot.position.copy(centroidOf(objs))
  }

  function moveSelectionTo(ground: Vector3): void {
    const objs = selectionList()
    if (objs.length === 0) return
    if (objs.length === 1) {
      const only = objs[0]
      if (only === undefined) return
      only.position.x = ground.x
      only.position.y = ground.y
      only.position.z = ground.z
      return
    }
    const c = centroidOf(objs)
    const dx = ground.x - c.x
    const dz = ground.z - c.z
    for (const obj of objs) {
      obj.position.x += dx
      obj.position.z += dz
    }
    if (gizmo.object === selPivot) {
      selPivot.position.x += dx
      selPivot.position.z += dz
    }
  }

  function yawSelection(delta: number): void {
    const objs = selectionList()
    if (objs.length === 0) return
    const c = centroidOf(objs)
    for (const obj of objs) {
      tmpV.copy(obj.position).sub(c).applyAxisAngle(yAxis, delta)
      obj.position.copy(c).add(tmpV)
      obj.rotation.y += delta
    }
    if (gizmo.object === selPivot) selPivot.rotation.y += delta
  }

  function scaleSelection(factor: number): void {
    const objs = selectionList()
    if (objs.length === 0) return
    const model = selectionModel()
    if (sameScaleOn && model !== null) {
      const first = objs[0]
      if (first === undefined) return
      applyRelToScaleTargets(relativeScale(first) * factor)
      return
    }
    if (objs.length === 1) {
      const only = objs[0]
      if (only === undefined) return
      applyRelativeScale(only, relativeScale(only) * factor)
      return
    }
    const c = centroidOf(objs)
    for (const obj of objs) {
      tmpV.copy(obj.position).sub(c).multiplyScalar(factor)
      obj.position.copy(c).add(tmpV)
      applyRelativeScale(obj, relativeScale(obj) * factor)
    }
    if (gizmo.object === selPivot) selPivot.position.copy(centroidOf(objs))
  }

  function dropSelection(): void {
    const objs = selectionList()
    if (objs.length === 0) return
    if (objs.length === 1) {
      const only = objs[0]
      if (only !== undefined) maybeDrop(only)
      return
    }
    const c = centroidOf(objs)
    let baseY = objs[0]?.position.y ?? c.y
    for (const obj of objs) {
      if (obj.position.y < baseY) baseY = obj.position.y
    }
    ray.ray.origin.set(c.x, islandBox.max.y + islandSpan, c.z)
    ray.ray.direction.set(0, -1, 0)
    const hits = ray.intersectObject(island, true)
    for (const h of hits) {
      if (!(h.object instanceof Mesh) || isHiddenNode(h.object)) continue
      const dy = h.point.y - baseY
      for (const obj of objs) obj.position.y += dy
      if (gizmo.object === selPivot) selPivot.position.y += dy
      return
    }
  }

  function focusSelection(): void {
    const objs = selectionList()
    if (objs.length === 0) return
    const box = new Box3()
    box.makeEmpty()
    for (const obj of objs) box.union(worldBox(obj))
    if (box.isEmpty()) return
    const size = boxSize(box)
    const span = Math.max(size.x, size.y, size.z, islandSpan * 0.05)
    target.set(0.5 * (box.min.x + box.max.x), 0.5 * (box.min.y + box.max.y) + size.y * 0.15, 0.5 * (box.min.z + box.max.z))
    radius = span * 2.6
    applyCam()
  }

  function captureSelection(): ClipItem[] {
    const objs = selectionList()
    const c = centroidOf(objs)
    let baseY = objs[0]?.position.y ?? 0
    for (const obj of objs) {
      if (obj.position.y < baseY) baseY = obj.position.y
    }
    const out: ClipItem[] = []
    for (const obj of objs) {
      const kind = obj.userData.kind
      const ref = obj.userData.ref
      if ((kind !== "building" && kind !== "decor") || typeof ref !== "string") continue
      out.push({
        kind,
        ref,
        dx: obj.position.x - c.x,
        dy: obj.position.y - baseY,
        dz: obj.position.z - c.z,
        yaw: obj.rotation.y,
        scale: obj.scale.x,
      })
    }
    return out
  }

  function copySelection(): void {
    const rows = captureSelection()
    clipBoard.length = 0
    for (const row of rows) clipBoard.push(row)
    status(clipBoard.length === 0 ? "нечего копировать" : "скопировано " + String(clipBoard.length) + " шт.")
  }

  async function pasteClipboard(x: number, y: number, z: number, rows: readonly ClipItem[]): Promise<Object3D[]> {
    const nodes: Object3D[] = []
    await withHushedShadows(async () => {
      for (const row of rows) {
        const item = catalogItem(row.kind, row.ref)
        if (item === null) continue
        const node = await spawn(item, x + row.dx, y + row.dy, z + row.dz, row.yaw, row.scale)
        nodes.push(node)
      }
    })
    settleNodes(nodes)
    selected.clear()
    for (const node of nodes) selected.add(node)
    bindGizmoToSelection()
    persist()
    pushHist()
    syncProps()
    return nodes
  }

  function pasteHere(): void {
    if (clipBoard.length === 0) {
      status("буфер пуст · Ctrl+C")
      return
    }
    let x = lastGround.x
    let y = lastGround.y
    let z = lastGround.z
    if (!hasLastGround) {
      const objs = selectionList()
      if (objs.length > 0) {
        const c = centroidOf(objs)
        x = c.x + islandSpan * 0.06
        y = objs[0]?.position.y ?? c.y
        for (const obj of objs) {
          if (obj.position.y < y) y = obj.position.y
        }
        z = c.z
      } else {
        x = islandAnchor.x
        y = islandAnchor.y
        z = islandAnchor.z
      }
    }
    void pasteClipboard(x, y, z, clipBoard).then((nodes) => {
      status("вставлено " + String(nodes.length) + " шт.")
    })
  }

  function duplicateSelection(): void {
    const rows = captureSelection()
    if (rows.length === 0) {
      status("нечего дублировать")
      return
    }
    const objs = selectionList()
    const c = centroidOf(objs)
    let baseY = objs[0]?.position.y ?? c.y
    for (const obj of objs) {
      if (obj.position.y < baseY) baseY = obj.position.y
    }
    void pasteClipboard(c.x + islandSpan * 0.06, baseY, c.z, rows).then((nodes) => {
      status("дубль " + String(nodes.length) + " шт.")
    })
  }

  function projectScreen(obj: Object3D): { x: number; y: number } | null {
    tmpV.copy(obj.position).project(camera)
    if (tmpV.z < -1 || tmpV.z > 1) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: rect.left + (tmpV.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (0 - tmpV.y * 0.5 + 0.5) * rect.height,
    }
  }

  function marqueeSelect(x0: number, y0: number, x1: number, y1: number, additive: boolean): void {
    const minX = Math.min(x0, x1)
    const maxX = Math.max(x0, x1)
    const minY = Math.min(y0, y1)
    const maxY = Math.max(y0, y1)
    if (!additive) selected.clear()
    for (const child of placed.children) {
      const p = projectScreen(child)
      if (p === null) continue
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue
      selected.add(child)
    }
    bindGizmoToSelection()
  }

  function showMarquee(x0: number, y0: number, x1: number, y1: number): void {
    const left = Math.min(x0, x1)
    const top = Math.min(y0, y1)
    marquee.hidden = false
    marquee.style.left = String(left) + "px"
    marquee.style.top = String(top) + "px"
    marquee.style.width = String(Math.abs(x1 - x0)) + "px"
    marquee.style.height = String(Math.abs(y1 - y0)) + "px"
  }

  function hideMarquee(): void {
    marquee.hidden = true
  }

  function dump(): SaveV3 {
    const objects: MapRow[] = []
    for (const child of placed.children) {
      const id = child.userData.mapId
      const kind = child.userData.kind
      const ref = child.userData.ref
      if (id === undefined || kind === undefined || ref === undefined) continue
      if (kind !== "building" && kind !== "decor") continue
      objects.push({
        id,
        kind,
        ref,
        x: child.position.x,
        y: child.position.y,
        z: child.position.z,
        yaw: child.rotation.y,
        scale: child.scale.x,
      })
    }
    return {
      version: 3,
      island: islandId,
      islandScale: islandScaleX,
      islandScaleX,
      islandScaleY,
      islandScaleZ,
      islandLod,
      objects,
      cam: { theta, phi, radius, tx: target.x, ty: target.y, tz: target.z },
      rev: sessionRev,
    }
  }

  function refreshList(): void {
    placedList.replaceChildren()
    const rows = dump().objects
    for (const row of rows) {
      const b = document.createElement("button")
      b.type = "button"
      const item = catalogItem(row.kind, row.ref)
      b.textContent = (item === null ? row.ref : item.label) + " · " + row.id
      b.dataset.mapId = row.id
      b.addEventListener("click", (ev) => {
        for (const child of placed.children) {
          if (child.userData.mapId === row.id) {
            if (ev.shiftKey || ev.ctrlKey || ev.metaKey) toggleSelect(child)
            else selectOnly(child)
            syncProps()
            status("выбран " + row.id)
            break
          }
        }
      })
      placedList.appendChild(b)
    }
    syncSelHelpers()
  }

  let diskTimer = 0

  function writeStore(): void {
    const json = JSON.stringify(dump())
    globalThis.localStorage.setItem(STORE, json)
    if (!sessionReady) return
    globalThis.clearTimeout(diskTimer)
    diskTimer = globalThis.setTimeout(() => {
      void fetch("/api/studio-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
      }).catch(() => undefined)
    }, 800)
  }

  function scheduleStore(): void {
    if (!sessionReady) return
    globalThis.clearTimeout(diskTimer)
    diskTimer = globalThis.setTimeout(() => writeStore(), 400)
  }

  function persist(): void {
    writeStore()
    const snap = dump()
    const n = snap.objects.length
    const b = snap.objects.filter((r) => r.kind === "building").length
    const lods = availableIslandLods()
    const lodBit = lods.length >= 2 ? " · LOD" + String(islandLod) : ""
    status((ISLANDS.find((i) => i.id === islandId)?.label ?? islandId) + " · " + islandScaleX.toFixed(2) + "×" + islandScaleY.toFixed(2) + "×" + islandScaleZ.toFixed(2) + lodBit + " · " + String(b) + " зд. / " + String(n) + " шт.")
    refreshList()
    const first = placed.children[0]
    if (first !== undefined) {
      const sz = boxSize(worldBox(first))
      host.dataset.objSize = sz.x.toFixed(4) + "," + sz.y.toFixed(4) + "," + sz.z.toFixed(4)
    } else delete host.dataset.objSize
  }

  function pushHist(): void {
    if (hushHist) return
    const snap = JSON.stringify(dump())
    if (snap === hist[histAt]) return
    hist.splice(histAt + 1)
    hist.push(snap)
    if (hist.length > 80) hist.shift()
    histAt = hist.length - 1
  }

  async function spawn(item: CatalogItem, x: number, y: number, z: number, yaw: number, scale: number, id?: string): Promise<Object3D> {
    await ensureProto(item)
    const src = proto.get(protoKey(item))
    if (src === undefined) throw new Error("proto missing " + item.ref)
    const mapId = id ?? item.kind[0] + String(seq++)
    const node: Object3D = src.clone(true)
    node.userData.mapId = mapId
    node.userData.kind = item.kind
    node.userData.ref = item.ref
    node.position.set(x, y, z)
    node.rotation.y = yaw
    node.scale.set(scale, scale, scale)
    placed.add(node)
    if (lightMode === "day") tagMeshShadows(node, true, skipShadowRoot(node))
    shadowDirty = true
    if (skipShadowRoot(node)) scheduleEnvironment()
    return node
  }

  function lineModuleCount(item: CatalogItem, start: Vector3, end: Vector3, scale: number): number {
    const distance = Math.hypot(end.x - start.x, end.z - start.z)
    const nativeLength = linearAxis(item) === "x" ? item.native.x : item.native.z
    const spacing = Math.max(nativeLength * scale * 0.92, islandSpan * 0.004, 0.01)
    if (distance <= spacing * 0.35) return 1
    return Math.min(256, Math.max(2, Math.round(distance / spacing) + 1))
  }

  function updateLineGhost(start: Vector3, end: Vector3): void {
    if (ghost === null || stamp === null || !isLinearDecor(stamp)) return
    const dx = end.x - start.x
    const dz = end.z - start.z
    const distance = Math.hypot(dx, dz)
    const scale = stampFit(stamp)
    const axis = linearAxis(stamp)
    const nativeLength = Math.max(axis === "x" ? stamp.native.x : stamp.native.z, 1e-6)
    const stretch = Math.max(1, distance / (nativeLength * scale))
    ghost.visible = true
    ghost.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2)
    ghost.rotation.y = linearYaw(stamp, dx, dz)
    if (axis === "x") ghost.scale.set(scale * stretch, scale, scale)
    else ghost.scale.set(scale, scale, scale * stretch)
  }

  async function placeLine(item: CatalogItem, start: Vector3, end: Vector3, scale: number): Promise<number> {
    await ensureProto(item)
    const count = lineModuleCount(item, start, end, scale)
    const yaw = linearYaw(item, end.x - start.x, end.z - start.z)
    await withHushedShadows(async () => {
      let i = 0
      while (i < count) {
        const t = count <= 1 ? 0 : i / (count - 1)
        const point = new Vector3().lerpVectors(start, end, t)
        const node = await spawn(item, point.x, point.y, point.z, yaw, scale)
        dropToGround(node)
        i += 1
      }
    })
    return count
  }

  function clearPlaced(): void {
    selected.clear()
    gizmo.detach()
    selPivot.visible = false
    syncSelHelpers()
    while (placed.children.length > 0) {
      const ch = placed.children[placed.children.length - 1]
      if (ch) placed.remove(ch)
    }
  }

  async function yieldFrame(): Promise<void> {
    await new Promise<void>((resolve) => {
      globalThis.requestAnimationFrame(() => resolve())
    })
  }

  async function loadRows(rows: readonly MapRow[], record: boolean): Promise<void> {
    await withHushedShadows(async () => {
      clearPlaced()
      let i = 0
      for (const row of rows) {
        const item = catalogItem(row.kind, row.ref)
        if (item === null) continue
        const n = Number(row.id.replace(/^[bd]/, ""))
        if (Number.isFinite(n) && n >= seq) seq = n + 1
        try {
          await spawn(item, row.x, row.y, row.z, row.yaw, row.scale, row.id)
        } catch {
          continue
        }
        i += 1
        if (i % 8 === 0) await yieldFrame()
      }
    })
    persist()
    if (record) pushHist()
  }

  function rebuildWf(): void {
    while (markers.children.length > 0) {
      const ch = markers.children[markers.children.length - 1]
      if (ch) markers.remove(ch)
    }
    wfPoints.length = 0
    hideWfAttachmentVisuals(island)
    island.updateMatrixWorld(true)
    island.traverse((node) => {
      if (!isWfMountName(node.name)) return
      const pos = new Vector3()
      node.getWorldPosition(pos)
      wfPoints.push({ name: node.name, pos })
    })
    if (!wfOn) {
      markers.visible = false
      return
    }
    const geo = new SphereGeometry(Math.max(0.12, islandSpan * 0.008), 10, 8)
    const mat = new MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.85, depthTest: false })
    for (const row of wfPoints) {
      const m = new Mesh(geo, mat)
      m.position.copy(row.pos)
      m.renderOrder = 10
      m.userData.wf = row.name
      markers.add(m)
    }
    markers.visible = true
  }

  function skipShadowRoot(node: Object3D): boolean {
    const ref = String(node.userData.ref ?? "").toLowerCase()
    if (ref.startsWith("wf-") || ref.includes("waterfall")) return true
    if (node.userData.kind !== "decor") return false
    return ref.includes("cloud") || ref.startsWith("cl-")
  }

  function waterfallHints(): WorldCloudHint[] {
    const out: WorldCloudHint[] = []
    for (const child of placed.children) {
      const ref = String(child.userData.ref ?? "")
      if (!ref.startsWith("WF-") && !ref.toLowerCase().includes("waterfall")) continue
      out.push({ x: child.position.x, y: child.position.y, z: child.position.z })
    }
    return out
  }

  function applySolidShadows(on: boolean): void {
    tagMeshShadows(island, on, false)
    for (const child of placed.children) {
      tagMeshShadows(child, on, skipShadowRoot(child))
    }
  }

  function applyGlow(): void {
    for (const mat of glowMats) {
      if (!glowExport.has(mat)) glowExport.set(mat, mat.emissiveIntensity)
      const exported = glowExport.get(mat)
      const base = exported === undefined ? 1 : exported
      mat.emissiveIntensity =
        lightMode === "dusk" || lightMode === "night" ? look03FromBps(LOOK03_EMISSIVE_BPS) : base
    }
  }

  function applyLight(mode: string): void {
    lightMode = mode
    if (skyRoot !== null) skyRoot.visible = mode === "day"
    if (mode === "dusk") {
      scene.fog = null
      renderer.shadowMap.enabled = false
      sun.castShadow = false
      scene.environment = null
      fill.intensity = 0
      scene.background = new Color(0x3a4a78)
      renderer.setClearColor(0x3a4a78)
      renderer.toneMappingExposure = 1.1
      ambient.color.setHex(0xffffff)
      ambient.intensity = look03FromBps(LOOK03_DUSK_AMBIENT_BPS)
      hemi.color.setHex(WORLD_HEMI_SKY)
      hemi.groundColor.setHex(0x283653)
      hemi.intensity = look03FromBps(LOOK03_DUSK_AMBIENT_BPS)
      sun.color.setHex(0xffbd86)
      sun.intensity = look03FromBps(LOOK03_DUSK_SUN_BPS)
      sun.position.set(22, 18, -8)
      applySolidShadows(false)
    } else if (mode === "night") {
      scene.fog = null
      renderer.shadowMap.enabled = false
      sun.castShadow = false
      scene.environment = null
      fill.intensity = 0
      scene.background = new Color(0x0c1220)
      renderer.setClearColor(0x0c1220)
      renderer.toneMappingExposure = 0.94
      ambient.color.setHex(0xffffff)
      ambient.intensity = look03FromBps(LOOK03_NIGHT_AMBIENT_BPS)
      hemi.color.setHex(WORLD_HEMI_SKY)
      hemi.groundColor.setHex(0x101827)
      hemi.intensity = look03FromBps(LOOK03_NIGHT_AMBIENT_BPS)
      sun.color.setHex(0x7089c6)
      sun.intensity = look03FromBps(LOOK03_NIGHT_SUN_BPS)
      sun.position.set(-8, 28, 16)
      applySolidShadows(false)
    } else if (mode === "studio") {
      scene.fog = null
      renderer.shadowMap.enabled = false
      sun.castShadow = false
      scene.environment = null
      fill.intensity = 0
      scene.background = new Color(0x1a222c)
      renderer.setClearColor(0x1a222c)
      renderer.toneMappingExposure = WORLD_EXPOSURE
      ambient.color.setHex(0xffffff)
      ambient.intensity = look03FromBps(LOOK03_DAY_AMBIENT_BPS)
      hemi.color.setHex(WORLD_HEMI_SKY)
      hemi.groundColor.setHex(WORLD_HEMI_GROUND)
      hemi.intensity = look03FromBps(LOOK03_DAY_AMBIENT_BPS)
      sun.color.setHex(0xffffff)
      sun.intensity = look03FromBps(LOOK03_DAY_SUN_BPS)
      sun.position.set(18, 42, 14)
      applySolidShadows(false)
    } else {
      const box = reviewBox()
      applyEnvironmentLook(
        renderer,
        scene,
        sun,
        hemi,
        fill,
        ambient,
        box,
        islandSpan,
        DEFAULT_SKY_ENV,
        true,
      )
      if (skyEnv !== null) scene.environment = skyEnv
      applySolidShadows(true)
      shadowDirty = true
    }
    applyGlow()
  }

  async function setIsland(id: string, keep: boolean, opts?: { fit?: boolean; resetPose?: boolean; persist?: boolean }): Promise<void> {
    const spec = ISLANDS.find((row) => row.id === id)
    if (spec === undefined) return
    const gen = ++islandGen
    let lod = islandLod
    const fileLods = lodsFromFiles(spec)
    if (fileLods.length > 1 && !fileLods.includes(lod)) lod = fileLods[0] ?? 0
    const file = islandGlbFile(spec, lod)
    const cacheKey = islandCacheKey(spec, lod)
    const url = spec.id === "terra" ? TERRA19_MASS : assetUrl(["models", spec.folder, file])
    const prevPos = island.position.clone()
    status("гружу " + spec.label + (fileLods.length > 1 ? " · LOD" + String(lod) : "") + "…")
    let src = islandCache.get(cacheKey)
    if (src === undefined) {
      let loaded: Group
      try {
        loaded = await loadGlb(loader, url)
      } catch (err) {
        if (spec.id !== "terra") throw err
        loaded = await loadGlb(loader, assetUrl(["models", spec.folder, file]))
      }
      prepareAsset(loaded, false, textureAnisotropy)
      islandCache.set(cacheKey, loaded)
      src = loaded
    }
    if (gen !== islandGen) return
    scene.remove(island)
    island = src.clone(true)
    island.name = "island_mass"
    applyEmbeddedLod(island, lod)
    const embedded = collectLodLevels(island)
    if (embedded.length > 1 && !embedded.includes(lod)) {
      lod = embedded[0] ?? 0
      applyEmbeddedLod(island, lod)
    }
    if (opts?.resetPose === false) island.position.copy(prevPos)
    else island.position.set(0, 0, 0)
    scene.add(island)
    islandId = id
    islandLod = lod
    hideWfAttachmentVisuals(island)
    refreshIslandMetrics()
    const cx = 0.5 * (islandBox.min.x + islandBox.max.x)
    const cy = 0.5 * (islandBox.min.y + islandBox.max.y)
    const cz = 0.5 * (islandBox.min.z + islandBox.max.z)
    sun.target.position.set(cx, cy, cz)
    rebuildWf()
    if (opts?.fit !== false) fitIslandView()
    syncIslandScaleUi()
    syncLodUi()
    for (const el of islandRail.querySelectorAll(".island-card")) {
      if (el instanceof HTMLElement) el.dataset.on = el.dataset.island === id ? "1" : "0"
    }
    if (keep) {
      for (const child of placed.children) maybeDrop(child)
    }
    if (opts?.persist !== false) persist()
  }

  function refreshIslandMetrics(): void {
    island.scale.set(1, 1, 1)
    island.position.set(0, 0, 0)
    island.updateMatrixWorld(true)
    const rawBox = worldBox(island, true)
    const raw = boxSize(rawBox)
    nativeSpan = Math.max(raw.x, raw.z, 8)
    const deckX = 0.5 * (rawBox.min.x + rawBox.max.x)
    const deckZ = 0.5 * (rawBox.min.z + rawBox.max.z)
    let deckY = rawBox.max.y
    ray.ray.origin.set(deckX, rawBox.max.y + Math.max(raw.y, nativeSpan, 8), deckZ)
    ray.ray.direction.set(0, -1, 0)
    for (const hit of ray.intersectObject(island, true)) {
      if (!(hit.object instanceof Mesh) || isHiddenNode(hit.object)) continue
      deckY = hit.point.y
      break
    }
    islandAnchor.set(deckX, deckY, deckZ)
    const local = island.worldToLocal(islandAnchor.clone())
    island.scale.set(islandScaleX, islandScaleY, islandScaleZ)
    island.updateMatrixWorld(true)
    const after = island.localToWorld(local.clone())
    island.position.add(islandAnchor.clone().sub(after))
    island.updateMatrixWorld(true)
    islandBox = worldBox(island, true)
    const size = boxSize(islandBox)
    islandSpan = Math.max(size.x, size.z, 8)
    setWaterfallWorldBand(islandBox.min.y, islandBox.min.y - Math.max(size.y * 0.95, islandSpan * 0.4))
    host.dataset.islandScale = islandScaleX.toFixed(4) + "," + islandScaleY.toFixed(4) + "," + islandScaleZ.toFixed(4)
    host.dataset.worldScale = island.scale.x.toFixed(4) + "," + island.scale.y.toFixed(4) + "," + island.scale.z.toFixed(4)
    host.dataset.islandSpan = islandSpan.toFixed(4)
    host.dataset.nativeSpan = nativeSpan.toFixed(4)
    host.dataset.anchorY = islandAnchor.y.toFixed(4)
    host.dataset.islandId = islandId
    host.dataset.islandLod = String(islandLod)
    scheduleEnvironment()
  }

  function scheduleEnvironment(): void {
    if (!sessionReady) return
    globalThis.clearTimeout(envTimer)
    envTimer = globalThis.setTimeout(() => {
      void ensureEnvironment()
    }, 80)
  }

  async function ensureEnvironment(): Promise<void> {
    if (skyBusy) {
      envDirty = true
      return
    }
    if (
      skyRoot !== null &&
      Math.abs(islandSpan - envSpan) < 0.5 &&
      envLookRev === ENV_LOOK_REV &&
      envPlaced === placed.children.length
    ) {
      return
    }
    skyBusy = true
    host.dataset.environmentState = "loading"
    const spanAt = islandSpan
    const boxAt = islandBox.clone()
    let mounted = false
    try {
      if (boxAt.isEmpty()) return
      const next = await mountEnvironment(
        (url) => loadGlb(loader, url),
        boxAt,
        spanAt,
        DEFAULT_SKY_ENV,
        waterfallHints(),
        [...placed.children],
        islandAnchor.y,
        island,
      )
      if (skyRoot !== null) {
        scene.remove(skyRoot)
        disposeEnvironment(skyRoot)
      }
      skyRoot = next
      envSpan = spanAt
      envLookRev = ENV_LOOK_REV
      envPlaced = placed.children.length
      skyRoot.visible = lightMode === "day"
      scene.add(skyRoot)
      tickEnvironment(skyRoot, camera)
      if (lightMode === "day") applyLight("day")
      host.dataset.environmentState = skyRoot.visible ? "mounted-visible" : "mounted-hidden"
      mounted = true
    } catch {
      host.dataset.environmentState = "error"
      status("небо не собралось")
    } finally {
      skyBusy = false
      if (mounted && (envDirty || Math.abs(islandSpan - envSpan) >= 0.5)) {
        envDirty = false
        void ensureEnvironment()
      }
    }
  }

  function availableIslandLods(): number[] {
    const spec = ISLANDS.find((row) => row.id === islandId)
    if (spec === undefined) return []
    const files = lodsFromFiles(spec)
    if (files.length > 1) return files
    const embedded = collectLodLevels(island)
    return embedded.length > 1 ? embedded : []
  }

  function syncLodUi(): void {
    const wrap = document.getElementById("island-lod-wrap")
    const row = document.getElementById("island-lod")
    if (!(wrap instanceof HTMLElement) || !(row instanceof HTMLElement)) return
    const levels = availableIslandLods()
    row.replaceChildren()
    if (levels.length < 2) {
      wrap.hidden = true
      return
    }
    wrap.hidden = false
    for (const lv of levels) {
      const b = document.createElement("button")
      b.type = "button"
      b.textContent = "LOD" + String(lv)
      b.dataset.on = lv === islandLod ? "1" : "0"
      b.addEventListener("click", () => {
        void setIslandLod(lv)
      })
      row.appendChild(b)
    }
  }

  async function setIslandLod(level: number): Promise<void> {
    if (level === islandLod || !availableIslandLods().includes(level)) return
    islandLod = level
    await setIsland(islandId, true, { fit: false, resetPose: false })
    pushHist()
  }

  async function applySavedIsland(parsed: { island?: string; islandScale?: number; islandScaleX?: number; islandScaleY?: number; islandScaleZ?: number; islandLod?: number }, fitIfIslandChanged: boolean): Promise<void> {
    const nextIsland = typeof parsed.island === "string" && ISLANDS.some((row) => row.id === parsed.island) ? parsed.island : islandId
    const legacy = typeof parsed.islandScale === "number" && Number.isFinite(parsed.islandScale) ? parsed.islandScale : null
    const px = typeof parsed.islandScaleX === "number" && Number.isFinite(parsed.islandScaleX) ? parsed.islandScaleX : legacy
    const py = typeof parsed.islandScaleY === "number" && Number.isFinite(parsed.islandScaleY) ? parsed.islandScaleY : legacy
    const pz = typeof parsed.islandScaleZ === "number" && Number.isFinite(parsed.islandScaleZ) ? parsed.islandScaleZ : legacy
    const nextX = px !== null ? Math.min(6, Math.max(1, px)) : islandScaleX
    const nextY = py !== null ? Math.min(6, Math.max(1, py)) : islandScaleY
    const nextZ = pz !== null ? Math.min(6, Math.max(1, pz)) : islandScaleZ
    const nextLod = typeof parsed.islandLod === "number" && Number.isFinite(parsed.islandLod) ? Math.max(0, Math.round(parsed.islandLod)) : 0
    const islandChanged = nextIsland !== islandId
    const lodChanged = nextLod !== islandLod
    if (islandChanged || lodChanged) {
      islandScaleX = nextX
      islandScaleY = nextY
      islandScaleZ = nextZ
      islandLod = nextLod
      await setIsland(nextIsland, false, { fit: fitIfIslandChanged && islandChanged, resetPose: islandChanged })
    } else applyIslandScale(nextX, nextY, nextZ, false)
  }

  async function applyCanonTerra19(): Promise<void> {
    randYaw = false
    const yawBtn = document.getElementById("rand-yaw")
    if (yawBtn) yawBtn.dataset.on = "0"
    status("гружу канон Terra-19…")
    const res = await fetch(TERRA19_MAP)
    if (!res.ok) {
      status("нет карты " + TERRA19_MAP)
      return
    }
    const baseRaw: unknown = await res.json()
    let decorRaw: unknown = null
    const decorRes = await fetch(TERRA19_DECOR)
    if (decorRes.ok) {
      try {
        decorRaw = await decorRes.json()
      } catch (err: unknown) {
        decorRaw = { parseError: String(err) }
      }
    }
    const report = validateTerra19Canon(baseRaw, decorRaw)
    if (report.buildings.length !== TERRA19_BUILDING_COUNT) {
      status(formatTerra19DecorStatus(report))
      return
    }
    await applySavedIsland(
      {
        island: "terra",
        islandScale: report.islandScaleX,
        islandScaleX: report.islandScaleX,
        islandScaleY: report.islandScaleY,
        islandScaleZ: report.islandScaleZ,
        islandLod: report.islandLod,
      },
      true,
    )
    const buildingRows: MapRow[] = report.buildings.map((row) => ({
      id: row.id,
      kind: "building",
      ref: row.ref,
      x: row.x,
      y: row.y,
      z: row.z,
      yaw: row.yaw,
      scale: row.scale,
    }))
    await withHushedShadows(async () => {
      await loadRows(buildingRows, false)
      const loadNotes: string[] = []
      for (const row of report.accepted) {
        if (!TERRA19_ALLOWED_DECOR_REFS.has(row.ref)) {
          loadNotes.push("не whitelist " + row.ref)
          continue
        }
        const item = catalogItem("decor", row.ref)
        if (item === null) {
          loadNotes.push("нет в каталоге " + row.ref)
          continue
        }
        try {
          const node = await spawn(item, row.x, row.y, row.z, row.yaw, row.scale, row.id)
          node.userData.placementGroup = row.placementGroup
        } catch (err: unknown) {
          loadNotes.push("не загружен " + row.id + ": " + String(err))
        }
      }
      persist()
      pushHist()
      const geo = auditPlacedGeometry()
      host.dataset.terraGeometryErrors = String(geo.hard.length)
      host.dataset.terraGeometryProxy = String(geo.proxy.length)
      host.dataset.terraBuildings = String(report.buildings.length)
      host.dataset.terraDecor = String(report.accepted.length)
      status(formatTerra19DecorStatus(report, loadNotes) + formatTerra19GeometryStatus(geo.hard, geo.proxy))
    })
  }

  function readUserString(obj: Object3D, key: string): string | null {
    const raw: unknown = obj.userData[key]
    if (typeof raw !== "string" || raw.length === 0) return null
    return raw
  }

  type Terra19PlacedGeo = {
    readonly obj: Object3D
    readonly box: Terra19XzBox
    readonly minY: number
    readonly maxY: number
  }

  type Terra19GeometryAudit = {
    readonly hard: readonly Terra19GeometryIssue[]
    readonly proxy: readonly Terra19GeometryIssue[]
  }

  function placedGeoFrom(obj: Object3D): Terra19PlacedGeo | null {
    const id = readUserString(obj, "mapId")
    const kind = readUserString(obj, "kind")
    const ref = readUserString(obj, "ref")
    if (id === null || kind === null || ref === null) return null
    const groupRaw: unknown = obj.userData.placementGroup
    const placementGroup = typeof groupRaw === "string" ? groupRaw : ""
    const box = worldBox(obj)
    if (box.isEmpty()) return null
    const minX = box.min.x
    const maxX = box.max.x
    const minY = box.min.y
    const maxY = box.max.y
    const minZ = box.min.z
    const maxZ = box.max.z
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY) ||
      !Number.isFinite(minZ) ||
      !Number.isFinite(maxZ)
    ) {
      return null
    }
    if (maxX <= minX || maxZ <= minZ) return null
    return {
      obj,
      box: {
        id,
        ref,
        role: classifyTerra19GeometryRole(kind, ref),
        placementGroup,
        minX,
        maxX,
        minZ,
        maxZ,
      },
      minY,
      maxY,
    }
  }

  function compactBaseFootprint(obj: Object3D, minY: number): {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  } {
    const sliceMax = minY + TERRA19_GROUND_SLICE_Y
    const acc = new Box3()
    acc.makeEmpty()
    obj.updateMatrixWorld(true)
    obj.traverse((node) => {
      if (!(node instanceof Mesh) || isHiddenNode(node)) return
      const geo = node.geometry
      if (geo.boundingBox === null) geo.computeBoundingBox()
      const local = geo.boundingBox
      if (local === null) return
      const world = local.clone().applyMatrix4(node.matrixWorld)
      if (world.max.y < minY || world.min.y > sliceMax) return
      acc.union(world)
    })
    if (acc.isEmpty()) {
      return {
        minX: obj.position.x,
        maxX: obj.position.x,
        minZ: obj.position.z,
        maxZ: obj.position.z,
      }
    }
    return { minX: acc.min.x, maxX: acc.max.x, minZ: acc.min.z, maxZ: acc.max.z }
  }

  function hitsGroundSlice(target: Terra19PlacedGeo, x: number, z: number, originY: number): boolean {
    geoOrigin.set(x, originY, z)
    geoRay.set(geoOrigin, geoDown)
    const hits = geoRay.intersectObject(target.obj, true)
    const sliceMax = target.minY + TERRA19_GROUND_SLICE_Y
    for (const hit of hits) {
      if (!(hit.object instanceof Mesh) || isHiddenNode(hit.object)) continue
      if (hit.point.y >= target.minY && hit.point.y <= sliceMax) return true
    }
    return false
  }

  function columnGroundContact(
    source: Terra19PlacedGeo,
    target: Terra19PlacedGeo,
    samples: readonly { readonly x: number; readonly z: number }[],
    originY: number,
  ): boolean {
    let i = 0
    while (i < samples.length) {
      const sample = samples[i]
      i += 1
      if (sample === undefined) continue
      if (!hitsGroundSlice(target, sample.x, sample.z, originY)) continue
      if (hitsGroundSlice(source, sample.x, sample.z, originY)) return true
    }
    return false
  }

  function confirmGroundContact(a: Terra19PlacedGeo, b: Terra19PlacedGeo, code: Terra19GeometryIssue["code"]): boolean {
    // Same XZ column must hit both meshes inside their ground slices; crown/roof-only is proxy.
    const originY = Math.max(a.maxY, b.maxY) + 1
    if (code === "geometry-building-overlap") {
      const decor = a.box.role === "building" ? b : a
      const building = a.box.role === "building" ? a : b
      if (building.box.role !== "building" || decor.box.role === "building") return false
      return columnGroundContact(decor, building, sampleXzGrid3(decor.box), originY)
    }
    const lamp = a.box.role === "lamp" ? a : b
    const grove = a.box.role === "lamp" ? b : a
    if (lamp.box.role !== "lamp" || !isTerra19GroveRole(grove.box.role)) return false
    const lampSamples = sampleXzGrid3(compactBaseFootprint(lamp.obj, lamp.minY))
    if (columnGroundContact(lamp, grove, lampSamples, originY)) return true
    return columnGroundContact(grove, lamp, sampleXzGrid3(compactBaseFootprint(grove.obj, grove.minY)), originY)
  }

  function auditPlacedGeometry(): Terra19GeometryAudit {
    const records: Terra19PlacedGeo[] = []
    for (const child of placed.children) {
      const rec = placedGeoFrom(child)
      if (rec !== null) records.push(rec)
    }
    const proxy = auditTerra19Geometry(records.map((row) => row.box))
    const hard: Terra19GeometryIssue[] = []
    let i = 0
    while (i < proxy.length) {
      const issue = proxy[i]
      i += 1
      if (issue === undefined) continue
      let a: Terra19PlacedGeo | null = null
      let b: Terra19PlacedGeo | null = null
      let j = 0
      while (j < records.length) {
        const rec = records[j]
        j += 1
        if (rec === undefined) continue
        if (rec.box.id === issue.id) a = rec
        if (rec.box.id === issue.otherId) b = rec
      }
      if (a === null || b === null) continue
      if (confirmGroundContact(a, b, issue.code)) hard.push(asHardGeometryIssue(issue))
    }
    return { hard, proxy }
  }

  function syncIslandScaleUi(): void {
    const axes: readonly { id: string; valId: string; value: number }[] = [
      { id: "island-scale-x", valId: "island-scale-x-val", value: islandScaleX },
      { id: "island-scale-y", valId: "island-scale-y-val", value: islandScaleY },
      { id: "island-scale-z", valId: "island-scale-z-val", value: islandScaleZ },
    ]
    for (const axis of axes) {
      const slider = document.getElementById(axis.id)
      const val = document.getElementById(axis.valId)
      if (slider instanceof HTMLInputElement && document.activeElement !== slider) slider.value = String(axis.value)
      if (val) val.textContent = axis.value.toFixed(2) + "×"
    }
    for (const el of document.querySelectorAll("#island-scale-presets button")) {
      if (!(el instanceof HTMLElement)) continue
      const s = Number(el.dataset.s)
      const on = Math.abs(s - islandScaleX) < 0.001 && Math.abs(s - islandScaleY) < 0.001 && Math.abs(s - islandScaleZ) < 0.001
      el.dataset.on = on ? "1" : "0"
    }
  }

  function applyIslandScale(nextX: number, nextY: number, nextZ: number, moveObjects: boolean): void {
    const cx = Math.min(6, Math.max(1, nextX))
    const cy = Math.min(6, Math.max(1, nextY))
    const cz = Math.min(6, Math.max(1, nextZ))
    if (Math.abs(cx - islandScaleX) < 1e-4 && Math.abs(cy - islandScaleY) < 1e-4 && Math.abs(cz - islandScaleZ) < 1e-4) {
      syncIslandScaleUi()
      return
    }
    const ax = islandAnchor.x
    const ay = islandAnchor.y
    const az = islandAnchor.z
    const kx = cx / islandScaleX
    const ky = cy / islandScaleY
    const kz = cz / islandScaleZ
    islandScaleX = cx
    islandScaleY = cy
    islandScaleZ = cz
    refreshIslandMetrics()
    if (moveObjects) {
      for (const child of placed.children) {
        child.position.x = ax + (child.position.x - ax) * kx
        child.position.z = az + (child.position.z - az) * kz
        const kind = child.userData.kind
        const ref = child.userData.ref
        const item = kind === "building" || kind === "decor" ? catalogItem(kind, ref ?? "") : null
        if (item !== null && floats(item)) {
          child.position.y = ay + (child.position.y - ay) * ky
          child.scale.multiplyScalar(Math.cbrt(kx * ky * kz))
        }
        maybeDrop(child)
      }
    }
    if (ghost !== null && stamp !== null) {
      const sc = stampFit(stamp)
      ghost.scale.set(sc, sc, sc)
    }
    target.x = ax + (target.x - ax) * kx
    target.z = az + (target.z - az) * kz
    applyCam()
    const scx = 0.5 * (islandBox.min.x + islandBox.max.x)
    const scy = 0.5 * (islandBox.min.y + islandBox.max.y)
    const scz = 0.5 * (islandBox.min.z + islandBox.max.z)
    sun.target.position.set(scx, scy, scz)
    fill.target.position.set(scx, scy, scz)
    fill.target.updateMatrixWorld()
    rebuildWf()
    syncIslandScaleUi()
    persist()
  }

  function setMode(mode: "translate" | "rotate" | "scale"): void {
    gizmo.setMode(mode)
    gizmo.setSpace(mode === "rotate" ? "local" : "world")
    gizmo.showX = mode !== "rotate"
    gizmo.showY = mode !== "translate"
    gizmo.showZ = mode !== "rotate"
    if (mode === "translate") {
      const obj = gizmo.object
      if (obj === selPivot) {
        gizmo.showY = true
      } else {
        const item =
          obj === undefined
            ? null
            : catalogItem(obj.userData.kind === "building" || obj.userData.kind === "decor" ? obj.userData.kind : "decor", obj.userData.ref ?? "")
        gizmo.showY = item !== null && floats(item)
      }
    }
    if (mode === "scale") {
      gizmo.showX = true
      gizmo.showY = true
      gizmo.showZ = true
    }
    const t = document.getElementById("mode-t")
    const r = document.getElementById("mode-r")
    const s = document.getElementById("mode-s")
    if (t) t.dataset.on = mode === "translate" ? "1" : "0"
    if (r) r.dataset.on = mode === "rotate" ? "1" : "0"
    if (s) s.dataset.on = mode === "scale" ? "1" : "0"
  }

  function markStamp(btn: HTMLElement | null): void {
    for (const el of document.querySelectorAll(".item, .cell")) {
      if (el instanceof HTMLElement) el.dataset.on = el === btn ? "1" : "0"
    }
    host.dataset.stamp = stamp === null ? "0" : "1"
  }

  function syncLineButton(): void {
    const el = document.getElementById("line")
    if (!(el instanceof HTMLElement)) return
    el.dataset.on = lineOn ? "1" : "0"
    el.textContent = lineOn ? "Линия ✓" : "Линия"
  }

  function destroyGhost(): void {
    if (ghost === null) return
    scene.remove(ghost)
    ghost = null
  }

  function setStamp(item: CatalogItem | null, btn: HTMLElement | null): void {
    if (item !== null && lineOn && !isLinearDecor(item)) {
      lineOn = false
      syncLineButton()
    }
    stamp = item
    markStamp(btn)
    destroyGhost()
    host.style.cursor = item === null ? "grab" : "crosshair"
    if (item === null) {
      status("штамп снят")
      return
    }
    void ensureProto(item).then(() => {
      if (stamp !== item) return
      destroyGhost()
      const src = proto.get(protoKey(item))
      if (src === undefined) return
      ghost = src.clone(true)
      ghostShade(ghost)
      ghost.visible = false
      const sc = stampFit(item)
      ghost.scale.set(sc, sc, sc)
      scene.add(ghost)
      const mode = lineOn && isLinearDecor(item) ? "линия: " : series ? "серия: " : "клик: "
      status(mode + item.label)
    })
  }

  function syncProps(): void {
    const nameEl = document.getElementById("sel-name")
    const sizeEl = document.getElementById("sel-size")
    const scaleEl = document.getElementById("scale")
    const scaleVal = document.getElementById("scale-val")
    const objs = selectionList()
    if (nameEl === null || scaleEl === null || scaleVal === null || !(scaleEl instanceof HTMLInputElement)) return
    if (objs.length === 0) {
      nameEl.textContent = "ничего не выбрано"
      if (sizeEl) sizeEl.textContent = ""
      syncSameScaleUi()
      return
    }
    const model = selectionModel()
    if (objs.length > 1 && model === null) {
      nameEl.textContent = "группа · " + String(objs.length) + " шт."
      scaleVal.textContent = "—"
      if (sizeEl) sizeEl.textContent = "вместе"
      syncSameScaleUi()
      return
    }
    const obj = objs[0]
    if (obj === undefined) return
    const item = catalogItem(obj.userData.kind === "building" || obj.userData.kind === "decor" ? obj.userData.kind : "decor", obj.userData.ref ?? "")
    const label = item === null ? obj.userData.ref ?? obj.userData.mapId ?? "" : item.label
    const sameN = model === null ? objs.length : sameModelList(model.kind, model.ref).length
    nameEl.textContent = sameScaleOn && sameN > 1 ? label + " · все " + String(sameN) : objs.length > 1 ? label + " · " + String(objs.length) + " шт." : label
    const rel = relativeScale(obj)
    scaleEl.min = String(model === null ? SCALE_REL_MIN : scaleRelMin(model.ref))
    if (document.activeElement !== scaleEl) scaleEl.value = String(rel)
    scaleVal.textContent = rel.toFixed(2) + "×"
    if (sizeEl) {
      const sz = boxSize(worldBox(obj))
      sizeEl.textContent = sz.x.toFixed(1) + " × " + sz.y.toFixed(1) + " × " + sz.z.toFixed(1)
    }
    syncSameScaleUi()
  }

  function deleteSelected(): void {
    const objs = selectionList()
    if (objs.length === 0) return
    gizmo.detach()
    selPivot.visible = false
    for (const obj of objs) placed.remove(obj)
    selected.clear()
    syncSelHelpers()
    persist()
    pushHist()
    syncProps()
  }

  function makeThumb(obj: Object3D): string | null {
    const sc = new Scene()
    const h = new HemisphereLight(WORLD_HEMI_SKY, WORLD_HEMI_GROUND)
    h.intensity = 1.45
    sc.add(h)
    const key = new DirectionalLight()
    key.intensity = 2.1
    key.position.set(2.2, 3.4, 1.6)
    sc.add(key)
    const fillL = new DirectionalLight()
    fillL.intensity = 0.7
    fillL.position.set(-1.8, 1.4, -1.2)
    sc.add(fillL)
    const copy = obj.clone(true)
    sc.add(copy)
    const box = worldBox(copy)
    const size = boxSize(box)
    const mx = Math.max(size.x, size.y, size.z, 0.01)
    const tcx = 0.5 * (box.min.x + box.max.x)
    const tcy = 0.5 * (box.min.y + box.max.y)
    const tcz = 0.5 * (box.min.z + box.max.z)
    const dist = mx * 1.45
    thumbCam.near = dist / 40
    thumbCam.far = dist * 20
    thumbCam.position.set(tcx + dist * 0.72, tcy + dist * 0.55, tcz + dist * 0.72)
    thumbCam.lookAt(tcx, tcy, tcz)
    thumbCam.updateProjectionMatrix()
    if (thumbRenderer === null) return null
    thumbRenderer.render(sc, thumbCam)
    return thumbCanvas.toDataURL("image/png")
  }

  function bindStampButton(el: HTMLElement, item: CatalogItem): void {
    el.dataset.q = (item.label + " " + item.ref + " " + item.pack + " " + item.family).toLowerCase()
    el.addEventListener("click", () => {
      if (stamp !== null && stamp.ref === item.ref) setStamp(null, null)
      else setStamp(item, el)
    })
  }

  const thumbJobs: { item: CatalogItem; img: HTMLImageElement }[] = []
  const thumbCells = new Map<HTMLElement, { readonly item: CatalogItem; readonly img: HTMLImageElement }>()
  const thumbQueued = new Set<HTMLImageElement>()
  let thumbsBusy = false

  function enqueueThumb(item: CatalogItem, img: HTMLImageElement): void {
    if (!sessionReady || thumbQueued.has(img) || img.getAttribute("src") !== null) return
    thumbQueued.add(img)
    thumbJobs.push({ item, img })
    void pumpThumbs()
  }

  async function pumpThumbs(): Promise<void> {
    if (thumbsBusy) return
    thumbsBusy = true
    while (thumbJobs.length > 0) {
      const job = thumbJobs.shift()
      if (job === undefined) break
      try {
        await ensureProto(job.item)
        const src = proto.get(protoKey(job.item))
        if (src === undefined) continue
        const thumb = makeThumb(src)
        if (thumb === null) {
          job.img.alt = job.item.label
          continue
        }
        job.img.src = thumb
        job.img.style.visibility = "visible"
      } catch {
        job.img.alt = job.item.label
      }
      await yieldFrame()
    }
    thumbsBusy = false
    if (thumbJobs.length > 0) void pumpThumbs()
  }

  const rail = document.getElementById("rail")
  const thumbObserver =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          (entries, observer) => {
            if (!sessionReady) return
            for (const entry of entries) {
              if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue
              const record = thumbCells.get(entry.target)
              if (record === undefined) continue
              observer.unobserve(entry.target)
              enqueueThumb(record.item, record.img)
            }
          },
          { root: rail instanceof HTMLElement ? rail : null, rootMargin: "240px 0px" },
        )

  function startThumbLoading(): void {
    if (thumbObserver !== null) {
      for (const cell of thumbCells.keys()) thumbObserver.observe(cell)
      return
    }
    const railBox = rail instanceof HTMLElement ? rail.getBoundingClientRect() : null
    for (const [cell, record] of thumbCells) {
      const box = cell.getBoundingClientRect()
      const visible = railBox === null || (box.bottom > railBox.top && box.top < railBox.bottom)
      if (visible) enqueueThumb(record.item, record.img)
    }
  }

  function addCell(parent: HTMLElement, item: CatalogItem, thumb: boolean): void {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "cell"
    const img = document.createElement("img")
    img.alt = item.label
    img.draggable = false
    img.style.visibility = "hidden"
    const cap = document.createElement("span")
    cap.textContent = item.label
    b.appendChild(img)
    b.appendChild(cap)
    bindStampButton(b, item)
    parent.appendChild(b)
    if (!thumb) return
    img.loading = "lazy"
    img.decoding = "async"
    thumbCells.set(b, { item, img })
  }

  function registerItem(
    kind: Kind,
    url: string,
    stem: string,
    meta?: { ref: string; label: string; skyline: Skyline },
  ): CatalogItem {
    const item: CatalogItem = {
      kind,
      ref: meta?.ref ?? stem,
      pack: "",
      label:
        meta?.label ??
        (stem.includes("city_props") ? "Road · City Props" : prettyStem(stem)),
      url,
      family: kind === "decor" ? decorFamilyOf(stem) : "other",
      skyline: meta?.skyline ?? "",
      native: { x: 1, y: 1, z: 1 },
    }
    catalog.push(item)
    return item
  }

  status("каталог…")
  for (const row of BUILDING_FILES) {
    registerItem("building", dietBuildingUrl(row.ref), row.ref, row)
  }
  for (const file of await listDecorFiles()) {
    registerItem("decor", assetUrl(["decoration", file]), fileStem(file))
  }

  const h2b = document.createElement("h2")
  h2b.textContent = "Здания · " + String(catalog.filter((i) => i.kind === "building").length)
  railB.appendChild(h2b)
  const buildGrid = document.createElement("div")
  buildGrid.className = "grid"
  railB.appendChild(buildGrid)
  for (const item of catalog) {
    if (item.kind === "building") addCell(buildGrid, item, true)
  }

  const filters = document.getElementById("decor-filters")
  if (filters) {
    const all = document.createElement("button")
    all.type = "button"
    all.textContent = "Все"
    all.dataset.on = "1"
    all.addEventListener("click", () => {
      decorFilter = "all"
      for (const el of filters.querySelectorAll("button")) el.dataset.on = el === all ? "1" : "0"
      applyDecorFilter()
    })
    filters.appendChild(all)
    for (const fam of DECOR_FAMILIES) {
      const b = document.createElement("button")
      b.type = "button"
      b.textContent = fam.label
      b.addEventListener("click", () => {
        decorFilter = fam.id
        for (const el of filters.querySelectorAll("button")) el.dataset.on = el === b ? "1" : "0"
        applyDecorFilter()
      })
      filters.appendChild(b)
    }
  }

  const h2d = document.createElement("h2")
  const decorLive = catalog.filter((i) => i.kind === "decor" && i.family !== "cloud")
  h2d.textContent = "Декор · " + String(decorLive.length)
  railD.appendChild(h2d)
  const decorGrid = document.createElement("div")
  decorGrid.className = "grid"
  decorGrid.id = "decor-grid"
  railD.appendChild(decorGrid)
  for (const item of catalog) {
    if (item.kind === "decor" && item.family !== "cloud") addCell(decorGrid, item, true)
  }

  function applyDecorFilter(): void {
    for (const el of decorGrid.querySelectorAll(".cell")) {
      if (!(el instanceof HTMLElement)) continue
      if (decorFilter === "all") {
        el.hidden = false
        continue
      }
      el.hidden = !(el.dataset.q ?? "").includes(decorFilter)
    }
  }

  for (const spec of ISLANDS) {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "island-card"
    b.dataset.island = spec.id
    b.dataset.q = (spec.label + " " + spec.file).toLowerCase()
    const img = document.createElement("img")
    img.alt = spec.label
    img.draggable = false
    img.src = assetUrl(["models", spec.folder, spec.preview])
    const cap = document.createElement("span")
    cap.textContent = spec.label
    const note = document.createElement("small")
    note.textContent = spec.note
    b.appendChild(img)
    b.appendChild(cap)
    b.appendChild(note)
    b.addEventListener("click", () => {
      if (islandId === spec.id) return
      const n = placed.children.length
      if (n > 0 && !globalThis.confirm("Сменить остров? Объекты останутся, высота пересчитается.")) return
      islandLod = 0
      void setIsland(spec.id, true).then(() => pushHist())
    })
    islandRail.appendChild(b)
  }

  let savedIsland = "atoll"
  let savedX = 1
  let savedY = 1
  let savedZ = 1
  let savedLod = 0
  let savedRows: MapRow[] = []
  let savedCam: CamSave | null = null
  let savedText: string | null = null
  try {
    const disk = await fetch("/api/studio-session", { cache: "no-store" })
    if (disk.ok) savedText = await disk.text()
  } catch {
    savedText = null
  }
  if (savedText === null || savedText.length <= 2) {
    savedText = globalThis.localStorage.getItem(STORE) ?? globalThis.localStorage.getItem(STORE_OLD)
  }
  if (savedText !== null && savedText.length > 2) {
    try {
      const parsed = JSON.parse(savedText) as {
        island?: string
        islandScale?: number
        islandScaleX?: number
        islandScaleY?: number
        islandScaleZ?: number
        islandLod?: number
        objects?: MapRow[]
        cam?: unknown
        rev?: unknown
      }
      if (typeof parsed.island === "string" && ISLANDS.some((i) => i.id === parsed.island)) savedIsland = parsed.island
      const legacy = typeof parsed.islandScale === "number" && Number.isFinite(parsed.islandScale) ? parsed.islandScale : null
      if (typeof parsed.islandScaleX === "number" && Number.isFinite(parsed.islandScaleX)) savedX = parsed.islandScaleX
      else if (legacy !== null) savedX = legacy
      if (typeof parsed.islandScaleY === "number" && Number.isFinite(parsed.islandScaleY)) savedY = parsed.islandScaleY
      else if (legacy !== null) savedY = legacy
      if (typeof parsed.islandScaleZ === "number" && Number.isFinite(parsed.islandScaleZ)) savedZ = parsed.islandScaleZ
      else if (legacy !== null) savedZ = legacy
      if (typeof parsed.islandLod === "number" && Number.isFinite(parsed.islandLod)) savedLod = Math.max(0, Math.round(parsed.islandLod))
      if (Array.isArray(parsed.objects)) savedRows = parsed.objects
      savedCam = camFromUnknown(parsed.cam)
      const loadedRev = finiteNum(parsed.rev)
      if (loadedRev !== null) sessionRev = loadedRev
    } catch {
      status("старый сейв не прочитался")
    }
  }
  islandScaleX = Math.min(6, Math.max(1, savedX))
  islandScaleY = Math.min(6, Math.max(1, savedY))
  islandScaleZ = Math.min(6, Math.max(1, savedZ))
  islandLod = savedLod
  const wantCanon = new URLSearchParams(location.search).get("map") === "terra-19"
  try {
    if (wantCanon) {
      islandLod = 0
      await setIsland("terra", false, { persist: false, fit: savedCam === null })
      await applyCanonTerra19()
    } else {
      await setIsland(savedIsland, false, { persist: false, fit: savedCam === null })
      if (savedRows.length > 0) await loadRows(savedRows, true)
      else {
        status("остров на месте · бери из палитры")
        pushHist()
      }
    }
    if (savedCam !== null) {
      theta = savedCam.theta
      phi = savedCam.phi
      radius = savedCam.radius
      target.set(savedCam.tx, savedCam.ty, savedCam.tz)
      applyCam()
    }
  } catch (err) {
    status("сессия не собралась: " + String(err))
  }
  sessionReady = true
  scheduleEnvironment()
  writeStore()
  startThumbLoading()
  globalThis.addEventListener("pagehide", () => writeStore())

  function nudge(dx: number, dz: number): void {
    const objs = selectionList()
    if (objs.length === 0) return
    const step = snapOn ? Math.max(0.25, islandSpan / 80) : islandSpan * 0.01
    const rx = Math.cos(theta)
    const rz = 0 - Math.sin(theta)
    const fx = Math.sin(theta)
    const fz = Math.cos(theta)
    const mx = rx * dx * step + fx * dz * step
    const mz = rz * dx * step + fz * dz * step
    for (const obj of objs) {
      obj.position.x += mx
      obj.position.z += mz
    }
    if (gizmo.object === selPivot) {
      selPivot.position.x += mx
      selPivot.position.z += mz
    }
    if (objs.length === 1) {
      const only = objs[0]
      if (only !== undefined) maybeDrop(only)
    }
    persist()
    syncProps()
  }

  globalThis.addEventListener("keydown", (ev) => {
    const t = ev.target
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
    if (ev.key === "g" || ev.key === "G") setMode("translate")
    if (ev.key === "r" || ev.key === "R") setMode("rotate")
    if (ev.key === "s" || ev.key === "S") setMode("scale")
    if (ev.key === "Escape") {
      setStamp(null, null)
      clearSelection()
      syncProps()
    }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault()
      deleteSelected()
    }
    if ((ev.key === "c" || ev.key === "C") && (ev.ctrlKey || ev.metaKey) && !ev.shiftKey) {
      ev.preventDefault()
      copySelection()
    }
    if ((ev.key === "v" || ev.key === "V") && (ev.ctrlKey || ev.metaKey) && !ev.shiftKey) {
      ev.preventDefault()
      pasteHere()
    }
    if ((ev.key === "d" || ev.key === "D") && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault()
      duplicateSelection()
    }
    if ((ev.key === "z" || ev.key === "Z") && ev.ctrlKey && !ev.shiftKey) {
      ev.preventDefault()
      document.getElementById("undo")?.click()
    }
    if ((ev.key === "y" || ev.key === "Y") && ev.ctrlKey) {
      ev.preventDefault()
      document.getElementById("redo")?.click()
    }
    if ((ev.key === "z" || ev.key === "Z") && ev.ctrlKey && ev.shiftKey) {
      ev.preventDefault()
      document.getElementById("redo")?.click()
    }
    if (ev.key === "f" || ev.key === "F") document.getElementById("focus")?.click()
    if (ev.key === "h" || ev.key === "H") document.getElementById("fit")?.click()
    if (ev.key === "q" || ev.key === "Q") {
      if (selectionList().length > 0) {
        yawSelection(ev.shiftKey ? 0 - Math.PI / 2 : 0 - Math.PI / 12)
        persist()
        syncProps()
      }
    }
    if (ev.key === "e" || ev.key === "E") {
      if (selectionList().length > 0) {
        yawSelection(ev.shiftKey ? Math.PI / 2 : Math.PI / 12)
        persist()
        syncProps()
      }
    }
    if (ev.key === "ArrowLeft") {
      ev.preventDefault()
      nudge(-1, 0)
    }
    if (ev.key === "ArrowRight") {
      ev.preventDefault()
      nudge(1, 0)
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault()
      nudge(0, -1)
    }
    if (ev.key === "ArrowDown") {
      ev.preventDefault()
      nudge(0, 1)
    }
    if (ev.key === "[" || ev.key === "]") {
      if (selectionList().length === 0) return
      scaleSelection(ev.key === "]" ? 1.1 : 0.9)
      persist()
      syncProps()
      if (sameScaleOn) {
        const n = scaleTargets().length
        if (n > 1) status("размер модели · " + String(n) + " шт.")
      }
    }
  })

  document.getElementById("mode-t")?.addEventListener("click", () => setMode("translate"))
  document.getElementById("mode-r")?.addEventListener("click", () => setMode("rotate"))
  document.getElementById("mode-s")?.addEventListener("click", () => setMode("scale"))
  document.getElementById("line")?.addEventListener("click", () => {
    const next = !lineOn
    if (next && stamp !== null && !isLinearDecor(stamp)) {
      status("режим линии доступен для заборов и дорог")
      return
    }
    lineOn = next
    syncLineButton()
    if (lineOn) status("линия: выбери забор или дорогу и протяни ЛКМ")
    else status("режим линии выключен")
  })
  document.getElementById("series")?.addEventListener("click", () => {
    series = !series
    const el = document.getElementById("series")
    if (el) el.dataset.on = series ? "1" : "0"
    status(series ? "серия: штамп не сбрасывается" : "один клик — один объект")
  })
  document.getElementById("snap")?.addEventListener("click", () => {
    snapOn = !snapOn
    const el = document.getElementById("snap")
    if (el) el.dataset.on = snapOn ? "1" : "0"
    status(snapOn ? "сетка включена" : "сетка выключена")
  })
  document.getElementById("rand-yaw")?.addEventListener("click", () => {
    randYaw = !randYaw
    const el = document.getElementById("rand-yaw")
    if (el) el.dataset.on = randYaw ? "1" : "0"
  })
  document.getElementById("wf")?.addEventListener("click", () => {
    wfOn = !wfOn
    rebuildWf()
    const el = document.getElementById("wf")
    if (el) el.dataset.on = wfOn ? "1" : "0"
  })
  document.getElementById("light")?.addEventListener("change", (ev) => {
    const el = ev.target
    if (el instanceof HTMLSelectElement) applyLight(el.value)
  })
  document.getElementById("fit")?.addEventListener("click", () => fitIslandView())
  document.getElementById("shot")?.addEventListener("click", () => {
    const helper = gizmo.getHelper()
    const showG = helper.visible
    const showM = markers.visible
    const showS = selHelpers.visible
    helper.visible = false
    markers.visible = false
    selHelpers.visible = false
    gizmo.detach()
    renderer.render(scene, camera)
    const a = document.createElement("a")
    a.href = renderer.domElement.toDataURL("image/png")
    a.download = islandId + "-island.png"
    a.click()
    helper.visible = showG
    markers.visible = showM
    selHelpers.visible = showS
    bindGizmoToSelection()
    status("снимок сохранён")
  })
  document.getElementById("del")?.addEventListener("click", () => deleteSelected())
  document.getElementById("del-all")?.addEventListener("click", () => {
    if (placed.children.length === 0) return
    if (!globalThis.confirm("Удалить все объекты с карты?")) return
    clearPlaced()
    persist()
    pushHist()
    syncProps()
  })
  document.getElementById("copy")?.addEventListener("click", () => copySelection())
  document.getElementById("paste")?.addEventListener("click", () => pasteHere())
  document.getElementById("dup")?.addEventListener("click", () => duplicateSelection())
  document.getElementById("drop")?.addEventListener("click", () => {
    if (selectionList().length === 0) return
    dropSelection()
    persist()
    pushHist()
    syncProps()
  })
  document.getElementById("native")?.addEventListener("click", () => {
    const targets = scaleTargets()
    if (targets.length === 0) return
    for (const obj of targets) obj.scale.set(1, 1, 1)
    persist()
    pushHist()
    syncProps()
    if (sameScaleOn) status("1:1 · " + String(targets.length) + " шт.")
  })
  document.getElementById("focus")?.addEventListener("click", () => focusSelection())
  document.getElementById("rot-l")?.addEventListener("click", () => {
    if (selectionList().length === 0) return
    yawSelection(0 - Math.PI / 2)
    persist()
    pushHist()
    syncProps()
  })
  document.getElementById("rot-r")?.addEventListener("click", () => {
    if (selectionList().length === 0) return
    yawSelection(Math.PI / 2)
    persist()
    pushHist()
    syncProps()
  })
  const scaleEl = document.getElementById("scale")
  if (scaleEl instanceof HTMLInputElement) {
    scaleEl.min = String(SCALE_REL_MIN_BLOB)
    scaleEl.max = String(SCALE_REL_MAX)
  }
  scaleEl?.addEventListener("input", () => {
    if (!(scaleEl instanceof HTMLInputElement)) return
    if (selectionList().length === 0) return
    if (selectionModel() === null) return
    const n = applyRelToScaleTargets(Number(scaleEl.value))
    syncProps()
    if (sameScaleOn && n > 1) status("размер модели · " + String(n) + " шт.")
  })
  scaleEl?.addEventListener("change", () => {
    persist()
    pushHist()
  })
  document.getElementById("same-scale")?.addEventListener("click", () => {
    if (selectionModel() === null) {
      status("выбери объекты одной модели")
      return
    }
    sameScaleOn = !sameScaleOn
    syncSameScaleUi()
    syncProps()
    const n = scaleTargets().length
    status(sameScaleOn ? "размер модели · все " + String(n) + " шт." : "размер только у выбранных")
  })
  document.getElementById("undo")?.addEventListener("click", () => {
    if (histAt <= 0) return
    histAt -= 1
    const snap = hist[histAt]
    if (snap === undefined) return
    hushHist = true
    const parsed = JSON.parse(snap) as SaveV3
    const run = async (): Promise<void> => {
      await applySavedIsland(parsed, true)
      await loadRows(parsed.objects, false)
    }
    void run().then(() => {
      hushHist = false
      gizmo.detach()
      syncProps()
    })
  })
  document.getElementById("redo")?.addEventListener("click", () => {
    if (histAt >= hist.length - 1) return
    histAt += 1
    const snap = hist[histAt]
    if (snap === undefined) return
    hushHist = true
    const parsed = JSON.parse(snap) as SaveV3
    const run = async (): Promise<void> => {
      await applySavedIsland(parsed, true)
      await loadRows(parsed.objects, false)
    }
    void run().then(() => {
      hushHist = false
      gizmo.detach()
      syncProps()
    })
  })
  document.getElementById("save")?.addEventListener("click", () => {
    persist()
    const blob = new Blob([JSON.stringify(dump(), null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = islandId + "-map.json"
    a.click()
    URL.revokeObjectURL(a.href)
  })
  document.getElementById("canon-terra19")?.addEventListener("click", () => {
    void applyCanonTerra19()
  })
  const file = document.getElementById("file")
  file?.addEventListener("change", () => {
    if (!(file instanceof HTMLInputElement) || file.files === null || file.files[0] === undefined) return
    void file.files[0].text().then(async (text) => {
      const parsed = JSON.parse(text) as { island?: string; islandScale?: number; islandScaleX?: number; islandScaleY?: number; islandScaleZ?: number; islandLod?: number; objects?: MapRow[] }
      await applySavedIsland(parsed, true)
      if (Array.isArray(parsed.objects)) await loadRows(parsed.objects, true)
      file.value = ""
    })
  })
  document.getElementById("q")?.addEventListener("input", (ev) => {
    const box = ev.target
    if (!(box instanceof HTMLInputElement)) return
    const q = box.value.trim().toLowerCase()
    for (const el of document.querySelectorAll("[data-q]")) {
      if (!(el instanceof HTMLElement)) continue
      el.hidden = q.length > 0 && !(el.dataset.q ?? "").includes(q)
    }
  })
  function bindIslandScaleSlider(id: string): void {
    const el = document.getElementById(id)
    if (!(el instanceof HTMLInputElement)) return
    el.addEventListener("input", () => {
      const xEl = document.getElementById("island-scale-x")
      const yEl = document.getElementById("island-scale-y")
      const zEl = document.getElementById("island-scale-z")
      if (!(xEl instanceof HTMLInputElement) || !(yEl instanceof HTMLInputElement) || !(zEl instanceof HTMLInputElement)) return
      let vx = Number(xEl.value)
      let vy = Number(yEl.value)
      let vz = Number(zEl.value)
      const linkEl = document.getElementById("island-scale-link")
      if (linkEl instanceof HTMLInputElement && linkEl.checked) {
        const v = Number(el.value)
        vx = v
        vy = v
        vz = v
      }
      applyIslandScale(vx, vy, vz, true)
    })
    el.addEventListener("change", () => pushHist())
  }
  bindIslandScaleSlider("island-scale-x")
  bindIslandScaleSlider("island-scale-y")
  bindIslandScaleSlider("island-scale-z")
  document.getElementById("island-scale-presets")?.addEventListener("click", (ev) => {
    const t = ev.target
    if (!(t instanceof HTMLElement) || t.dataset.s === undefined) return
    const s = Number(t.dataset.s)
    applyIslandScale(s, s, s, true)
    pushHist()
  })
  setMode("translate")
  applyLight("day")
  const hot = (import.meta as ImportMeta & { hot?: { dispose: (cb: () => void) => void } }).hot
  if (hot !== undefined) {
    hot.dispose(() => {
      stopStudio(runtime)
    })
  }
}

void main()
