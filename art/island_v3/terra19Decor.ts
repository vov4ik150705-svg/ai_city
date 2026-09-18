/** Editor-only Terra-19 decor sidecar types and read-only validator. */

export const TERRA19_BUILDING_COUNT = 19
export const TERRA19_DECOR_VERSION = 1
export const TERRA19_ISLAND = "terra"
export const TERRA19_BLOB_REF = "grass-terrain-blob-389daa"

export const TERRA19_TREE_REFS: ReadonlySet<string> = new Set([
  "Tree_Neon_Amethyst",
  "Tree_Neon_Cyan",
  "Tree_Neon_Lime",
  "Tree_Neon_Rose",
])

export const TERRA19_LANTERN_REFS: ReadonlySet<string> = new Set([
  "Lantern_Amber",
  "Lantern_Cyan",
  "Lantern_Violet",
])

export const TERRA19_ALLOWED_DECOR_REFS: ReadonlySet<string> = new Set([
  TERRA19_BLOB_REF,
  ...TERRA19_TREE_REFS,
  ...TERRA19_LANTERN_REFS,
])

export const TERRA19_FORBIDDEN_DECOR_REFS: ReadonlySet<string> = new Set([
  "Bush_Forest",
  "Bush_Round",
  "Fence_Corner",
  "Fence_Straight",
  "grass-ground-tile-131ec0",
  "Grass_Meadow",
  "Grass_Tall",
  "Ground_Grass",
  "low_poly_city_props__roads_-_game_ready_asset",
  "cascade-waterfall",
  "cascade-waterfall-water",
  "narrow-waterfall",
  "narrow-waterfall-water",
  "wide-waterfall",
  "wide-waterfall-water",
  "WF-001",
  "WF-001-water",
  "WF-002",
  "WF-002-water",
  "WF-003",
  "WF-003-water",
  "CL-001",
  "CL-002",
  "CL-003",
  "cumulus-cloud",
  "elongated-cloud",
  "large-cloud",
  "Tree_Emerald",
  "Tree_Maple",
  "Tree_Pine",
  "Tree_Young",
])

export const TERRA19_TREE_GROUPS: ReadonlySet<string> = new Set([
  "civic",
  "industry",
  "residential",
  "finance",
  "campus",
  "south",
])
export const TERRA19_LAMP_GROUP = "lamps"
export const TERRA19_GROUPS: ReadonlySet<string> = new Set(["civic", "industry", "residential", "finance", "campus", "south", "lamps"])

const FORBIDDEN_REF_BITS: readonly string[] = [
  "bush",
  "fence",
  "road",
  "cloud",
  "waterfall",
  "unit",
  "walker",
  "pedestrian",
  "drone_unit",
]

const GENERATOR_KEYS: ReadonlySet<string> = new Set(["city_id", "layout_seed", "layoutSeed", "cityId"])
const BASE_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "version",
  "island",
  "islandScale",
  "islandScaleX",
  "islandScaleY",
  "islandScaleZ",
  "islandLod",
  "objects",
])
const SIDECAR_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "version",
  "island",
  "environmentSeed",
  "placements",
  "status",
  "reviewRequired",
])

const LANTERN_MIN_BUILDING_DIST = 6.2
const TREE_MIN_BUILDING_DIST = 7.5
const BLOB_MIN_BUILDING_DIST = 8
const DUPLICATE_XZ_EPS = 0.02
const BLOB_CENTROID_MAX = 1.6
const TREE_CENTROID_MAX = 3.6

export type Terra19DecorGroup = "civic" | "industry" | "residential" | "finance" | "campus" | "south" | "lamps"
export type Terra19DecorStatus = "draft" | "final"

export type Terra19BuildingRow = {
  readonly id: string
  readonly kind: "building"
  readonly ref: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly scale: number
}

export type Terra19DecorPlacement = {
  readonly id: string
  readonly kind: "decor"
  readonly ref: string
  readonly group: Terra19DecorGroup
  readonly placementGroup: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly scale: number
  readonly status: Terra19DecorStatus
  readonly reviewRequired: boolean
}

export type Terra19DecorLayout = {
  readonly version: 1
  readonly island: "terra"
  readonly environmentSeed: string
  readonly placements: readonly Terra19DecorPlacement[]
  readonly status?: Terra19DecorStatus
  readonly reviewRequired?: boolean
}

export type Terra19Issue = {
  readonly level: "error" | "warning"
  readonly code: string
  readonly message: string
  readonly id?: string
}

export type Terra19Rejected = {
  readonly id: string
  readonly ref: string
  readonly issues: readonly Terra19Issue[]
}

export type Terra19CanonReport = {
  readonly buildings: readonly Terra19BuildingRow[]
  readonly accepted: readonly Terra19DecorPlacement[]
  readonly rejected: readonly Terra19Rejected[]
  readonly issues: readonly Terra19Issue[]
  readonly island: "terra"
  readonly islandScaleX: number
  readonly islandScaleY: number
  readonly islandScaleZ: number
  readonly islandLod: number
  readonly environmentSeed: string
  readonly reviewRequired: boolean
}

export function terra19DecorId(group: string, ref: string, index: number): string {
  return "terra19:" + group + ":" + ref + ":" + String(index)
}

export function isTerra19AllowedDecorRef(ref: string): boolean {
  return TERRA19_ALLOWED_DECOR_REFS.has(ref)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function issue(level: Terra19Issue["level"], code: string, message: string, id?: string): Terra19Issue {
  if (id === undefined) return { level, code, message }
  return { level, code, message, id }
}

function xzDist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz)
}

function forbiddenReason(ref: string): string | null {
  if (TERRA19_FORBIDDEN_DECOR_REFS.has(ref)) return "forbidden-ref"
  const n = ref.toLowerCase()
  if (n.endsWith("-water") || n.endsWith("_water")) return "forbidden-ref"
  for (const bit of FORBIDDEN_REF_BITS) {
    if (n.includes(bit)) return "forbidden-ref"
  }
  return null
}

function parseGroup(value: unknown): Terra19DecorGroup | null {
  if (
    value === "civic" ||
    value === "industry" ||
    value === "residential" ||
    value === "finance" ||
    value === "campus" ||
    value === "south" ||
    value === "lamps"
  ) {
    return value
  }
  return null
}

function parseStatus(value: unknown): Terra19DecorStatus | null {
  if (value === "draft" || value === "final") return value
  return null
}

function parseBuildingRow(raw: unknown, index: number): { row: Terra19BuildingRow | null; issues: Terra19Issue[] } {
  const issues: Terra19Issue[] = []
  if (!isRecord(raw)) {
    issues.push(issue("error", "building-row", "objects[" + String(index) + "] is not an object"))
    return { row: null, issues }
  }
  const id = raw.id
  const idText = typeof id === "string" ? id : "objects[" + String(index) + "]"
  if (typeof id !== "string" || id.length === 0) issues.push(issue("error", "building-id", "building id missing", idText))
  if (raw.kind !== "building") issues.push(issue("error", "base-not-building-only", idText + " kind is not building", idText))
  if (typeof raw.ref !== "string" || raw.ref.length === 0) issues.push(issue("error", "building-ref", idText + " ref missing", idText))
  if (!finiteNumber(raw.x) || !finiteNumber(raw.y) || !finiteNumber(raw.z) || !finiteNumber(raw.yaw) || !finiteNumber(raw.scale)) {
    issues.push(issue("error", "building-transform", idText + " transform is not finite", idText))
  }
  if (typeof raw.scale === "number" && Number.isFinite(raw.scale) && raw.scale <= 0) {
    issues.push(issue("error", "building-scale", idText + " scale must be > 0", idText))
  }
  if (issues.length > 0) return { row: null, issues }
  if (
    typeof raw.id !== "string" ||
    typeof raw.ref !== "string" ||
    !finiteNumber(raw.x) ||
    !finiteNumber(raw.y) ||
    !finiteNumber(raw.z) ||
    !finiteNumber(raw.yaw) ||
    !finiteNumber(raw.scale)
  ) {
    return { row: null, issues }
  }
  return {
    row: {
      id: raw.id,
      kind: "building",
      ref: raw.ref,
      x: raw.x,
      y: raw.y,
      z: raw.z,
      yaw: raw.yaw,
      scale: raw.scale,
    },
    issues,
  }
}

function parsePlacement(raw: unknown, index: number): { row: Terra19DecorPlacement | null; issues: Terra19Issue[] } {
  const issues: Terra19Issue[] = []
  if (!isRecord(raw)) {
    issues.push(issue("error", "placement-row", "placements[" + String(index) + "] is not an object"))
    return { row: null, issues }
  }
  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : "placements[" + String(index) + "]"
  if (typeof raw.id !== "string" || raw.id.length === 0) issues.push(issue("error", "decor-id", "placement id missing", id))
  if (raw.kind !== "decor") issues.push(issue("error", "sidecar-not-decor", id + " kind is not decor", id))
  if (typeof raw.ref !== "string" || raw.ref.length === 0) issues.push(issue("error", "decor-ref", id + " ref missing", id))
  const group = parseGroup(raw.group)
  if (group === null) {
    issues.push(issue("error", "decor-group", id + " group is not civic|industry|residential|finance|campus|south|lamps", id))
  }
  if (typeof raw.placementGroup !== "string" || raw.placementGroup.length === 0) {
    issues.push(issue("error", "placement-group", id + " placementGroup missing", id))
  }
  if (!finiteNumber(raw.x) || !finiteNumber(raw.y) || !finiteNumber(raw.z) || !finiteNumber(raw.yaw) || !finiteNumber(raw.scale)) {
    issues.push(issue("error", "decor-transform", id + " transform is not finite", id))
  }
  if (typeof raw.scale === "number" && Number.isFinite(raw.scale) && raw.scale <= 0) {
    issues.push(issue("error", "decor-scale", id + " scale must be > 0", id))
  }
  const status = parseStatus(raw.status)
  if (status === null) issues.push(issue("error", "decor-status", id + " status must be draft|final", id))
  if (typeof raw.reviewRequired !== "boolean") issues.push(issue("error", "review-flag", id + " reviewRequired must be boolean", id))
  if (issues.length > 0) return { row: null, issues }
  if (
    typeof raw.id !== "string" ||
    typeof raw.ref !== "string" ||
    typeof raw.placementGroup !== "string" ||
    group === null ||
    status === null ||
    !finiteNumber(raw.x) ||
    !finiteNumber(raw.y) ||
    !finiteNumber(raw.z) ||
    !finiteNumber(raw.yaw) ||
    !finiteNumber(raw.scale)
  ) {
    return { row: null, issues }
  }
  const ref = raw.ref
  const idMatch = /^terra19:([^:]+):([^:]+):(\d+)$/.exec(raw.id)
  if (idMatch === null) {
    issues.push(issue("error", "id-pattern", id + " must be terra19:<group>:<asset>:<index>", id))
    return { row: null, issues }
  }
  const idGroup = idMatch[1]
  const idAsset = idMatch[2]
  const idIndex = idMatch[3]
  if (idGroup !== group || idAsset !== ref || idIndex === undefined) {
    issues.push(
      issue("error", "id-mismatch", id + " does not match group/ref (expected " + terra19DecorId(group, ref, Number(idIndex)) + ")", id),
    )
    return { row: null, issues }
  }
  return {
    row: {
      id: raw.id,
      kind: "decor",
      ref,
      group,
      placementGroup: raw.placementGroup,
      x: raw.x,
      y: raw.y,
      z: raw.z,
      yaw: raw.yaw,
      scale: raw.scale,
      status,
      reviewRequired: raw.reviewRequired === true,
    },
    issues,
  }
}

function minBuildingDist(ref: string): number {
  if (ref === TERRA19_BLOB_REF) return BLOB_MIN_BUILDING_DIST
  if (TERRA19_TREE_REFS.has(ref)) return TREE_MIN_BUILDING_DIST
  return LANTERN_MIN_BUILDING_DIST
}

function nearestBuilding(x: number, z: number, buildings: readonly Terra19BuildingRow[]): { id: string; dist: number } | null {
  let best: { id: string; dist: number } | null = null
  for (const b of buildings) {
    const dist = xzDist(x, z, b.x, b.z)
    if (best === null || dist < best.dist) best = { id: b.id, dist }
  }
  return best
}

export function validateTerra19Canon(baseRaw: unknown, decorRaw: unknown): Terra19CanonReport {
  const issues: Terra19Issue[] = []
  const buildings: Terra19BuildingRow[] = []
  const accepted: Terra19DecorPlacement[] = []
  const rejected: Terra19Rejected[] = []
  let islandScaleX = 1
  let islandScaleY = 1
  let islandScaleZ = 1
  let islandLod = 0
  let environmentSeed = ""

  if (!isRecord(baseRaw)) {
    issues.push(issue("error", "base-map", "terra-19.json is not an object"))
    return {
      buildings,
      accepted,
      rejected,
      issues,
      island: TERRA19_ISLAND,
      islandScaleX,
      islandScaleY,
      islandScaleZ,
      islandLod,
      environmentSeed,
      reviewRequired: true,
    }
  }

  for (const key of Object.keys(baseRaw)) {
    if (!BASE_ALLOWED_KEYS.has(key)) issues.push(issue("error", "base-unknown-key", "terra-19.json unknown key " + key))
    if (GENERATOR_KEYS.has(key)) issues.push(issue("error", "generator-key", "terra-19.json must not contain " + key))
  }
  if (baseRaw.version !== 3) issues.push(issue("error", "base-version", "terra-19.json version must be 3"))
  if (baseRaw.island !== TERRA19_ISLAND) issues.push(issue("error", "base-island", "terra-19.json island must be terra"))
  if (finiteNumber(baseRaw.islandScaleX)) islandScaleX = baseRaw.islandScaleX
  else if (finiteNumber(baseRaw.islandScale)) islandScaleX = baseRaw.islandScale
  if (finiteNumber(baseRaw.islandScaleY)) islandScaleY = baseRaw.islandScaleY
  else if (finiteNumber(baseRaw.islandScale)) islandScaleY = baseRaw.islandScale
  if (finiteNumber(baseRaw.islandScaleZ)) islandScaleZ = baseRaw.islandScaleZ
  else if (finiteNumber(baseRaw.islandScale)) islandScaleZ = baseRaw.islandScale
  if (finiteNumber(baseRaw.islandLod)) islandLod = Math.max(0, Math.round(baseRaw.islandLod))

  const objects = baseRaw.objects
  if (!Array.isArray(objects)) {
    issues.push(issue("error", "base-objects", "terra-19.json objects must be an array"))
  } else {
    if (objects.length !== TERRA19_BUILDING_COUNT) {
      issues.push(issue("error", "building-count", "terra-19.json must contain exactly " + String(TERRA19_BUILDING_COUNT) + " building rows, got " + String(objects.length)))
    }
    const seen = new Set<string>()
    for (let i = 0; i < objects.length; i += 1) {
      const parsed = parseBuildingRow(objects[i], i)
      issues.push(...parsed.issues)
      const row = parsed.row
      if (row === null) continue
      if (seen.has(row.id)) issues.push(issue("error", "duplicate-id", "duplicate building id " + row.id, row.id))
      seen.add(row.id)
      buildings.push(row)
    }
    if (buildings.length !== TERRA19_BUILDING_COUNT) {
      issues.push(issue("error", "building-count-valid", "valid building rows " + String(buildings.length) + ", expected " + String(TERRA19_BUILDING_COUNT)))
    }
  }

  const buildingIds = new Set(buildings.map((row) => row.id))
  const buildingRefs = new Set(buildings.map((row) => row.ref))

  if (decorRaw === null || decorRaw === undefined) {
    issues.push(issue("error", "sidecar-missing", "нет sidecar terra-19.decor.json"))
    return {
      buildings,
      accepted,
      rejected,
      issues,
      island: TERRA19_ISLAND,
      islandScaleX,
      islandScaleY,
      islandScaleZ,
      islandLod,
      environmentSeed,
      reviewRequired: true,
    }
  }

  if (!isRecord(decorRaw)) {
    issues.push(issue("error", "sidecar-shape", "terra-19.decor.json is not an object"))
    return {
      buildings,
      accepted,
      rejected,
      issues,
      island: TERRA19_ISLAND,
      islandScaleX,
      islandScaleY,
      islandScaleZ,
      islandLod,
      environmentSeed,
      reviewRequired: true,
    }
  }

  for (const key of Object.keys(decorRaw)) {
    if (!SIDECAR_ALLOWED_KEYS.has(key)) issues.push(issue("error", "sidecar-unknown-key", "terra-19.decor.json unknown key " + key))
    if (GENERATOR_KEYS.has(key)) issues.push(issue("error", "generator-key", "terra-19.decor.json must not contain " + key))
  }
  if (decorRaw.version !== TERRA19_DECOR_VERSION) issues.push(issue("error", "sidecar-version", "sidecar version must be 1"))
  if (decorRaw.island !== TERRA19_ISLAND) issues.push(issue("error", "sidecar-island", "sidecar island must be terra"))
  if (typeof decorRaw.environmentSeed !== "string" || decorRaw.environmentSeed.length === 0) {
    issues.push(issue("error", "environment-seed", "environmentSeed must be a non-empty authored label, not a RNG seed"))
  } else environmentSeed = decorRaw.environmentSeed

  const placements = decorRaw.placements
  const parsedPlacements: Terra19DecorPlacement[] = []
  if (!Array.isArray(placements)) {
    issues.push(issue("error", "placements", "sidecar placements must be an array"))
  } else {
    const seenIds = new Set<string>()
    for (let i = 0; i < placements.length; i += 1) {
      const parsed = parsePlacement(placements[i], i)
      const row = parsed.row
      const rowIssues = [...parsed.issues]
      if (row === null) {
        rejected.push({ id: "placements[" + String(i) + "]", ref: "", issues: rowIssues })
        issues.push(...rowIssues)
        continue
      }
      if (seenIds.has(row.id)) {
        const dup = issue("error", "duplicate-id", "duplicate decor id " + row.id, row.id)
        rowIssues.push(dup)
        issues.push(dup)
        rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
        continue
      }
      seenIds.add(row.id)
      if (buildingIds.has(row.id)) {
        const hit = issue("error", "building-id-in-sidecar", "sidecar id collides with building " + row.id, row.id)
        rowIssues.push(hit)
        issues.push(hit)
        rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
        continue
      }
      if (buildingRefs.has(row.ref)) {
        const hit = issue("error", "building-ref-in-sidecar", "sidecar ref is a building: " + row.ref, row.id)
        rowIssues.push(hit)
        issues.push(hit)
        rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
        continue
      }
      const forbid = forbiddenReason(row.ref)
      if (forbid !== null) {
        const hit = issue("error", forbid, "forbidden decor " + row.ref, row.id)
        rowIssues.push(hit)
        issues.push(hit)
        rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
        continue
      }
      if (!TERRA19_ALLOWED_DECOR_REFS.has(row.ref)) {
        const hit = issue("error", "unknown-ref", "unknown decor " + row.ref, row.id)
        rowIssues.push(hit)
        issues.push(hit)
        rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
        continue
      }
      if (TERRA19_TREE_REFS.has(row.ref) && !TERRA19_TREE_GROUPS.has(row.group)) {
        const hit = issue("error", "tree-group", row.id + " tree must belong to a tree pocket group", row.id)
        rowIssues.push(hit)
        issues.push(hit)
        rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
        continue
      }
      if (row.ref === TERRA19_BLOB_REF && !TERRA19_TREE_GROUPS.has(row.group)) {
        const hit = issue("error", "blob-group", row.id + " terrain blob must sit under a tree pocket group", row.id)
        rowIssues.push(hit)
        issues.push(hit)
        rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
        continue
      }
      parsedPlacements.push(row)
    }
  }

  const byGroup = new Map<string, Terra19DecorPlacement[]>()
  for (const row of parsedPlacements) {
    const list = byGroup.get(row.placementGroup) ?? []
    list.push(row)
    byGroup.set(row.placementGroup, list)
  }

  for (const row of parsedPlacements) {
    const rowIssues: Terra19Issue[] = []
    if (row.ref === TERRA19_BLOB_REF) {
      const peers = byGroup.get(row.placementGroup) ?? []
      const trees = peers.filter((p) => TERRA19_TREE_REFS.has(p.ref))
      if (trees.length === 0) {
        rowIssues.push(issue("error", "blob-without-trees", row.id + " blob has no trees in placementGroup " + row.placementGroup, row.id))
      } else {
        const cx = trees.reduce((s, t) => s + t.x, 0) / trees.length
        const cz = trees.reduce((s, t) => s + t.z, 0) / trees.length
        if (xzDist(row.x, row.z, cx, cz) > BLOB_CENTROID_MAX) {
          rowIssues.push(issue("error", "blob-not-under-trees", row.id + " blob is not under its tree group centroid", row.id))
        }
        for (const tree of trees) {
          if (xzDist(tree.x, tree.z, cx, cz) > TREE_CENTROID_MAX) {
            rowIssues.push(issue("error", "tree-group-spread", tree.id + " is too far from grove centroid", tree.id))
          }
        }
      }
    }
    if (buildings.length > 0) {
      const near = nearestBuilding(row.x, row.z, buildings)
      const minDist = minBuildingDist(row.ref)
      if (near !== null && near.dist < minDist) {
        rowIssues.push(
          issue(
            "error",
            "building-clearance",
            row.id + " too close to building " + near.id + " (" + near.dist.toFixed(2) + " < " + String(minDist) + ")",
            row.id,
          ),
        )
      }
    }
    for (const other of parsedPlacements) {
      if (other.id <= row.id) continue
      if (other.ref !== row.ref) continue
      if (xzDist(row.x, row.z, other.x, other.z) < DUPLICATE_XZ_EPS) {
        rowIssues.push(issue("error", "duplicate-xz", row.id + " duplicates xz of " + other.id, row.id))
      }
    }
    if (rowIssues.length > 0) {
      issues.push(...rowIssues)
      rejected.push({ id: row.id, ref: row.ref, issues: rowIssues })
    } else accepted.push(row)
  }

  const reviewRequired =
    accepted.some((row) => row.reviewRequired || row.status === "draft") ||
    (isRecord(decorRaw) && (decorRaw.status === "draft" || decorRaw.reviewRequired === true))

  return {
    buildings,
    accepted,
    rejected,
    issues,
    island: TERRA19_ISLAND,
    islandScaleX,
    islandScaleY,
    islandScaleZ,
    islandLod,
    environmentSeed,
    reviewRequired,
  }
}

export function formatTerra19DecorStatus(report: Terra19CanonReport, extra: readonly string[] = []): string {
  const errors = report.issues.filter((row) => row.level === "error")
  const draft = report.reviewRequired ? " · draft, нужна проверка" : ""
  const extraBit = extra.length > 0 ? " · " + extra.join("; ") : ""
  const rejectBit = report.rejected.length > 0 ? " · отказ " + String(report.rejected.length) : ""
  const errBit =
    errors.length > 0
      ? " · ошибки: " + errors.slice(0, 4).map((row) => row.message).join("; ") + (errors.length > 4 ? "…" : "")
      : ""
  return (
    "канон Terra-19 · " +
    String(report.buildings.length) +
    " зд. / " +
    String(report.accepted.length) +
    " декор" +
    rejectBit +
    draft +
    errBit +
    extraBit
  )
}
