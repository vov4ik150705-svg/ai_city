import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  TERRA19_ALLOWED_DECOR_REFS,
  TERRA19_BLOB_REF,
  TERRA19_BUILDING_COUNT,
  formatTerra19DecorStatus,
  terra19DecorId,
  validateTerra19Canon,
} from "./terra19Decor.ts"
import {
  asHardGeometryIssue,
  auditTerra19Geometry,
  classifyTerra19GeometryRole,
  formatTerra19GeometryStatus,
  sampleXzGrid3,
  xzBoxesOverlap,
  type Terra19XzBox,
} from "./terra19Geometry.ts"

const here = dirname(fileURLToPath(import.meta.url))
const basePath = join(here, "maps", "terra-19.json")
const decorPath = join(here, "maps", "terra-19.decor.json")

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown
}

function fail(message: string): never {
  throw new Error(message)
}

function expect(cond: boolean, message: string): void {
  if (!cond) fail(message)
}

const base = readJson(basePath)
const decor = readJson(decorPath)
const report = validateTerra19Canon(base, decor)

expect(report.buildings.length === TERRA19_BUILDING_COUNT, "expected 19 buildings, got " + String(report.buildings.length))
expect(report.accepted.length === 36, "expected 36 accepted decor, got " + String(report.accepted.length))
expect(report.rejected.length === 0, "unexpected rejected: " + report.rejected.map((row) => row.id).join(", "))
expect(
  report.issues.filter((row) => row.level === "error").length === 0,
  "unexpected errors: " + report.issues.map((row) => row.message).join(" | "),
)
expect(report.environmentSeed === "terra-19-decor-pass-1", "environmentSeed drift")
expect(report.reviewRequired, "first pass must stay draft/reviewRequired")

const ids = new Set<string>()
for (const row of report.accepted) {
  expect(!ids.has(row.id), "duplicate accepted id " + row.id)
  ids.add(row.id)
  expect(TERRA19_ALLOWED_DECOR_REFS.has(row.ref), "accepted unknown ref " + row.ref)
  const indexToken = row.id.split(":").at(-1)
  expect(indexToken !== undefined, "id missing index " + row.id)
  expect(row.id === terra19DecorId(row.group, row.ref, Number(indexToken)), "unstable id " + row.id)
}

const blobGroups = report.accepted.filter((row) => row.ref === TERRA19_BLOB_REF).map((row) => row.placementGroup)
expect(blobGroups.length === 6, "expected 6 terrain blobs")
for (const group of blobGroups) {
  const trees = report.accepted.filter((row) => row.placementGroup === group && row.ref.startsWith("Tree_Neon_"))
  expect(trees.length >= 3, "blob group " + group + " needs trees")
}

const again = validateTerra19Canon(base, decor)
expect(JSON.stringify(again.accepted) === JSON.stringify(report.accepted), "validator is not deterministic")

const decorText = readFileSync(decorPath, "utf8")
expect(!decorText.includes("Math.random"), "sidecar contains Math.random")
expect(!decorText.includes("city_id"), "sidecar contains city_id")
expect(!decorText.includes("layout_seed"), "sidecar contains layout_seed")

const mutatedBuildings = structuredClone(base) as { objects: unknown[] }
mutatedBuildings.objects = mutatedBuildings.objects.slice(0, 18)
const short = validateTerra19Canon(mutatedBuildings, decor)
expect(
  short.issues.some((row) => row.code === "building-count"),
  "18 buildings must fail building-count",
)

const withBush = structuredClone(decor) as { placements: Record<string, unknown>[] }
withBush.placements.push({
  id: "terra19:civic:Bush_Forest:0",
  kind: "decor",
  ref: "Bush_Forest",
  group: "civic",
  placementGroup: "civic-grove",
  x: -8,
  y: 0.081,
  z: -20,
  yaw: 0,
  scale: 1,
  status: "draft",
  reviewRequired: true,
})
const bushReport = validateTerra19Canon(base, withBush)
expect(
  bushReport.rejected.some((row) => row.ref === "Bush_Forest"),
  "Bush_Forest must be rejected",
)
expect(
  bushReport.accepted.every((row) => row.ref !== "Bush_Forest"),
  "Bush_Forest must not load",
)

const withWater = structuredClone(decor) as { placements: Record<string, unknown>[] }
withWater.placements.push({
  id: "terra19:civic:WF-001-water:0",
  kind: "decor",
  ref: "WF-001-water",
  group: "civic",
  placementGroup: "civic-grove",
  x: -8,
  y: 0.081,
  z: -20,
  yaw: 0,
  scale: 1,
  status: "draft",
  reviewRequired: true,
})
const waterReport = validateTerra19Canon(base, withWater)
expect(
  waterReport.rejected.some((row) => row.ref === "WF-001-water"),
  "WF-001-water must be rejected from terra-19 canon",
)
expect(
  waterReport.accepted.every((row) => row.ref !== "WF-001-water"),
  "WF-001-water must not load into terra-19 canon",
)

const withBuilding = structuredClone(decor) as { placements: Record<string, unknown>[] }
withBuilding.placements.push({
  id: "b1",
  kind: "building",
  ref: "city_hall",
  group: "civic",
  placementGroup: "civic-grove",
  x: 0,
  y: 0.081,
  z: 0,
  yaw: 0,
  scale: 1,
  status: "draft",
  reviewRequired: true,
})
const buildingSidecar = validateTerra19Canon(base, withBuilding)
expect(
  buildingSidecar.issues.some((row) => row.code === "sidecar-not-decor" || row.code === "building-id-in-sidecar"),
  "building row in sidecar must error",
)
expect(
  buildingSidecar.accepted.every((row) => row.id !== "b1"),
  "building id b1 must not load from sidecar",
)

const lonelyBlob = structuredClone(decor) as { placements: Record<string, unknown>[] }
lonelyBlob.placements = [
  {
    id: "terra19:civic:grass-terrain-blob-389daa:0",
    kind: "decor",
    ref: TERRA19_BLOB_REF,
    group: "civic",
    placementGroup: "empty-grove",
    x: -6.4,
    y: 0.081,
    z: -22.8,
    yaw: 0,
    scale: 0.95,
    status: "draft",
    reviewRequired: true,
  },
]
const blobReport = validateTerra19Canon(base, lonelyBlob)
expect(
  blobReport.issues.some((row) => row.code === "blob-without-trees"),
  "blob without trees must fail",
)

const nanRow = structuredClone(decor) as { placements: Record<string, unknown>[] }
const first = nanRow.placements[0]
if (first === undefined) fail("sidecar empty")
first.x = Number.NaN
const nanReport = validateTerra19Canon(base, nanRow)
expect(
  nanReport.issues.some((row) => row.code === "decor-transform"),
  "NaN transform must fail",
)

const dup = structuredClone(decor) as { placements: Record<string, unknown>[] }
const copy = dup.placements[1]
if (copy === undefined) fail("missing tree row")
dup.placements.push({ ...copy })
const dupReport = validateTerra19Canon(base, dup)
expect(
  dupReport.issues.some((row) => row.code === "duplicate-id"),
  "duplicate ids must fail",
)

const seeded = structuredClone(decor) as Record<string, unknown>
seeded.layout_seed = 99
seeded.city_id = "abc"
const seededReport = validateTerra19Canon(base, seeded)
expect(
  seededReport.issues.some((row) => row.code === "generator-key"),
  "layout_seed/city_id must be rejected",
)

function xzBox(partial: {
  readonly id: string
  readonly ref: string
  readonly role: Terra19XzBox["role"]
  readonly placementGroup: string
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}): Terra19XzBox {
  return partial
}

expect(classifyTerra19GeometryRole("building", "city_hall") === "building", "building role")
expect(classifyTerra19GeometryRole("decor", "Lantern_Cyan") === "lamp", "lamp role")
expect(classifyTerra19GeometryRole("decor", "Tree_Neon_Lime") === "tree", "tree role")
expect(classifyTerra19GeometryRole("decor", TERRA19_BLOB_REF) === "blob", "blob role")

const groveTree = xzBox({
  id: "terra19:civic:Tree_Neon_Lime:0",
  ref: "Tree_Neon_Lime",
  role: "tree",
  placementGroup: "civic-grove",
  minX: 0,
  maxX: 2,
  minZ: 0,
  maxZ: 2,
})
const groveBlob = xzBox({
  id: "terra19:civic:grass-terrain-blob-389daa:0",
  ref: TERRA19_BLOB_REF,
  role: "blob",
  placementGroup: "civic-grove",
  minX: 0.5,
  maxX: 2.5,
  minZ: 0.5,
  maxZ: 2.5,
})
expect(xzBoxesOverlap(groveTree, groveBlob), "same-grove xz must overlap in fixture")
expect(
  auditTerra19Geometry([groveTree, groveBlob]).length === 0,
  "same-group blob/tree must not be a geometry error",
)

const hall = xzBox({
  id: "b1",
  ref: "city_hall",
  role: "building",
  placementGroup: "",
  minX: 1,
  maxX: 3,
  minZ: 1,
  maxZ: 3,
})
const hitBuilding = auditTerra19Geometry([groveTree, hall])
expect(
  hitBuilding.some((row) => row.code === "geometry-building-overlap" && row.id === groveTree.id && row.otherId === "b1"),
  "decor vs building xz overlap must fail",
)

const lamp = xzBox({
  id: "terra19:lamps:Lantern_Cyan:0",
  ref: "Lantern_Cyan",
  role: "lamp",
  placementGroup: "civic-spine",
  minX: 1,
  maxX: 3,
  minZ: 1,
  maxZ: 3,
})
const hitLamp = auditTerra19Geometry([groveTree, lamp])
expect(
  hitLamp.some((row) => row.code === "geometry-decor-overlap"),
  "lamp vs other-group tree must fail",
)

const sameGroupLamp = xzBox({
  id: "terra19:civic:Lantern_Cyan:0",
  ref: "Lantern_Cyan",
  role: "lamp",
  placementGroup: "civic-grove",
  minX: 1,
  maxX: 3,
  minZ: 1,
  maxZ: 3,
})
expect(
  auditTerra19Geometry([groveTree, sameGroupLamp]).length === 0,
  "lamp vs same placementGroup grove is not in this audit",
)

const beside = xzBox({
  id: "terra19:lamps:Lantern_Amber:0",
  ref: "Lantern_Amber",
  role: "lamp",
  placementGroup: "west-arc",
  minX: 4,
  maxX: 5,
  minZ: 4,
  maxZ: 5,
})
expect(!xzBoxesOverlap(groveTree, beside), "disjoint xz must not overlap")
expect(auditTerra19Geometry([groveTree, beside]).length === 0, "Y-only is ignored because audit is XZ-only")
expect(hitBuilding.every((row) => row.level === "warning"), "broad AABB stays proxy warning")
expect(hitLamp.every((row) => row.level === "warning"), "lamp AABB overlap stays proxy warning")
expect(formatTerra19GeometryStatus([]).includes("geometry ok"), "ok status")
expect(formatTerra19GeometryStatus([], hitBuilding).includes("geometry ok"), "proxy must not replace hard ok")
expect(formatTerra19GeometryStatus([], hitBuilding).includes("proxy warnings 1"), "proxy count stays visible")
expect(!formatTerra19GeometryStatus([], hitBuilding).includes("PASS"), "proxy is not PASS")
expect(formatTerra19GeometryStatus(hitBuilding).includes("geometry errors 1"), "hard uses errors label")
const firstBuildingHit = hitBuilding[0]
expect(firstBuildingHit !== undefined, "overlapping boxes must fail broad audit")
expect(firstBuildingHit !== undefined && asHardGeometryIssue(firstBuildingHit).level === "error", "hard promotion")
const grid = sampleXzGrid3(groveTree)
expect(grid.length === 9, "3x3 sample count")
const gridMin = grid[0]
const gridMax = grid[8]
expect(gridMin !== undefined && gridMin.x === groveTree.minX && gridMin.z === groveTree.minZ, "3x3 min corner")
expect(gridMax !== undefined && gridMax.x === groveTree.maxX && gridMax.z === groveTree.maxZ, "3x3 max corner")

console.log(formatTerra19DecorStatus(report))
console.log("terra19 decor check ok · accepted " + String(report.accepted.length))
