/** Local HUD artwork registry. Sources: visual/buildings orig, visual/units. Not GLB. */

export const BUILDING_ART_DIR = "visual/buildings orig"
export const UNIT_ART_DIR = "visual/units"

export const FUNCTIONAL_BUILDING_IDS = [
  "city_hall",
  "workshop",
  "agent_hub",
  "power_node",
  "bank",
  "exchange",
  "ai_research_center",
  "energy_plant",
  "logistics_hub",
  "flagship_store",
  "cloud_campus",
  "finance_tower",
  "robotics_lab",
  "drone_depot",
  "data_center",
  "fleet_yard",
  "retail_complex",
  "clearing_house",
] as const

export type FunctionalBuildingId = (typeof FUNCTIONAL_BUILDING_IDS)[number]

export const BUILDING_THUMB_FILES: { readonly [K in FunctionalBuildingId]: string } = {
  city_hall: "City Hall.png",
  workshop: "Workshop.png",
  agent_hub: "Agent Hub.png",
  power_node: "Power Node.png",
  bank: "Bank.png",
  exchange: "Exchange.png",
  ai_research_center: "AI Research Center.png",
  energy_plant: "Energy Plant.png",
  logistics_hub: "Logistics Hub.png",
  flagship_store: "Flagship Store.png",
  cloud_campus: "Cloud Campus.png",
  finance_tower: "Finance Tower.png",
  robotics_lab: "Robotics Lab.png",
  drone_depot: "Drone Depot.png",
  data_center: "Data Center.png",
  fleet_yard: "Fleet Yard.png",
  retail_complex: "Retail Complex.png",
  clearing_house: "Clearing House.png",
}

export const DECORATIVE_BUILDING_ID = "neon_residence"
export const DECORATIVE_BUILDING_FILE = "Neon Residence.png"

export const BUILDING_SHEET_FILES = [
  "Canonical_Building_Reference_11_19.png",
  "Corporator_Building_Reference_01_10.png",
] as const

export const AGENT_ROLE_IDS = ["engineer", "logistician", "manager", "scientist", "trader"] as const
export type AgentRoleId = (typeof AGENT_ROLE_IDS)[number]

export const ROLE_PORTRAIT_FILES: { readonly [K in AgentRoleId]: string } = {
  engineer: "Engineer_anfas.png",
  logistician: "Logistician_anfas.png",
  manager: "manager_anfas.png",
  scientist: "scientist_anfas.png",
  trader: "trader_anfas.png",
}

export const ROLE_ICON_FILES: { readonly [K in AgentRoleId]: string } = {
  engineer: "Engineer_icon.png",
  logistician: "Logistician_icon.png",
  manager: "manager_icon.png",
  scientist: "scientist_icon.png",
  trader: "trader_icon.png",
}

export const ROLE_FULL_FILES: { readonly [K in AgentRoleId]: string } = {
  engineer: "Engineer.png",
  logistician: "Logistician.png",
  manager: "manager.png",
  scientist: "scientist.png",
  trader: "trader.png",
}

export const UNIT_SHEET_FILE = "unit_roster_5_originals.png"
export const BRAND_UNIT_FILES = ["corporator.png", "corporator_icon.png"] as const

export type BuildingArtKind = "functional" | "decorative" | "sheet" | "unavailable"
export type RoleArtKind = "ready" | "unavailable" | "sheet" | "brand"
export type RoleArtVariant = "portrait" | "icon"

export type BuildingArtHit = {
  readonly kind: BuildingArtKind
  readonly id: string
  readonly file: string
}

export type RoleArtHit = {
  readonly kind: RoleArtKind
  readonly roleId: string
  readonly variant: RoleArtVariant
  readonly file: string
}

export function artIdKey(raw: string): string {
  const trimmed = raw.trim()
  const dot = trimmed.lastIndexOf(".")
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed
  return base.toLowerCase().replace(/[\s-]+/g, "_")
}

export function isFunctionalBuildingId(id: string): id is FunctionalBuildingId {
  for (const row of FUNCTIONAL_BUILDING_IDS) {
    if (row === id) return true
  }
  return false
}

export function buildingCardKind(rawId: string): "functional" | "decorative" | "unavailable" {
  const hit = resolveBuildingArt(rawId)
  if (hit.kind === "functional") return "functional"
  if (hit.kind === "decorative") return "decorative"
  return "unavailable"
}

export function isAgentRoleId(id: string): id is AgentRoleId {
  for (const row of AGENT_ROLE_IDS) {
    if (row === id) return true
  }
  return false
}

export function isBuildingSheetFile(file: string): boolean {
  for (const row of BUILDING_SHEET_FILES) {
    if (row === file) return true
  }
  return artIdKey(file).includes("building_reference")
}

export function resolveBuildingArt(rawId: string): BuildingArtHit {
  const id = artIdKey(rawId)
  if (id.length === 0) return { kind: "unavailable", id, file: "" }
  if (isBuildingSheetFile(rawId) || isBuildingSheetFile(id)) {
    return { kind: "sheet", id, file: rawId }
  }
  if (id === DECORATIVE_BUILDING_ID) {
    return { kind: "decorative", id, file: DECORATIVE_BUILDING_FILE }
  }
  if (isFunctionalBuildingId(id)) {
    return { kind: "functional", id, file: BUILDING_THUMB_FILES[id] }
  }
  return { kind: "unavailable", id, file: "" }
}

export function resolveRolePortrait(rawRole: string | undefined, variant: RoleArtVariant = "portrait"): RoleArtHit {
  if (rawRole === undefined || rawRole.length === 0) {
    return { kind: "unavailable", roleId: "", variant, file: "" }
  }
  const id = artIdKey(rawRole)
  if (id === "unit_roster_5_originals") {
    return { kind: "sheet", roleId: id, variant, file: UNIT_SHEET_FILE }
  }
  if (id === "corporator" || id === "corporator_icon") {
    return { kind: "brand", roleId: id, variant, file: id === "corporator_icon" ? "corporator_icon.png" : "corporator.png" }
  }
  if (!isAgentRoleId(id)) {
    return { kind: "unavailable", roleId: id, variant, file: "" }
  }
  if (variant === "icon") {
    return { kind: "ready", roleId: id, variant, file: ROLE_ICON_FILES[id] }
  }
  return { kind: "ready", roleId: id, variant, file: ROLE_PORTRAIT_FILES[id] }
}

export function roleArtFallback(roleId: AgentRoleId, variant: RoleArtVariant): readonly string[] {
  if (variant === "icon") return [ROLE_ICON_FILES[roleId], ROLE_PORTRAIT_FILES[roleId], ROLE_FULL_FILES[roleId]]
  return [ROLE_PORTRAIT_FILES[roleId], ROLE_FULL_FILES[roleId], ROLE_ICON_FILES[roleId]]
}
