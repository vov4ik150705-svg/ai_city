import { codes } from "@corporator/protocol"
import type { OverviewTabId } from "./fields.js"

/** Six HUD destinations from docs/reports/HUD_DESIGN_SYSTEM.md. Presentation metadata; not pack screens. */
export const HUD_NAVIGATION = [
  { id: "overview", labelKey: "UI_OVERVIEW", shortcut: "1" },
  { id: "agents", labelKey: "UI_AGENTS", shortcut: "2" },
  { id: "exchange", labelKey: "UI_EXCHANGE", shortcut: "3" },
  { id: "bank", labelKey: "UI_BANK", shortcut: "4" },
  { id: "industries", labelKey: "UI_DISTRICTS", shortcut: "5" },
  { id: "journal", labelKey: "UI_LOG", shortcut: "6" },
] as const

const HUD_PACK_OVERLAYS = [
  "leaderboard",
  "wallet_connect",
  "offline_return",
  "onboarding_demo",
  "agent_card",
  "building_card",
  "district_card",
] as const

export type HudDestination = (typeof HUD_NAVIGATION)[number]
export type HudDestinationId = HudDestination["id"]

export type HudResolvedRoute = {
  readonly route: string
  readonly overviewTab: OverviewTabId | undefined
}

export function isHudDestinationId(value: unknown): value is HudDestinationId {
  if (typeof value !== "string") return false
  for (const row of HUD_NAVIGATION) {
    if (row.id === value) return true
  }
  return false
}

/** Live HUD never opens Build or Missions as a workspace. */
export function resolveHudRoute(id: string, tab: OverviewTabId | undefined = undefined): HudResolvedRoute | undefined {
  if (id === "build" || id === "missions") return undefined
  if (id === "districts") return { route: "industries", overviewTab: undefined }
  if (id === "research") return { route: "overview", overviewTab: "research" }
  if (id === "overview") return { route: "overview", overviewTab: tab ?? "summary" }
  if (isHudDestinationId(id)) return { route: id, overviewTab: undefined }
  for (const overlay of HUD_PACK_OVERLAYS) {
    if (overlay === id) return { route: id, overviewTab: undefined }
  }
  return undefined
}

/** Data-dense workspaces reuse the existing wide drawer variant. Not a new destination. */
export function workspaceDrawerWide(route: string): boolean {
  return (
    route === "agents" ||
    route === "industries" ||
    route === "leaderboard" ||
    route === "overview" ||
    route === "district_card"
  )
}

export function packWorkspaceId(route: string): string | undefined {
  if (route === "overview" || route === "industries" || route === "journal") return undefined
  const dest = resolveHudRoute(route)
  if (dest === undefined) return undefined
  if (dest.route === "overview" || dest.route === "industries" || dest.route === "journal") return undefined
  return dest.route
}

/** Scene picks select; they do not open construction or a workspace. */
export function sceneClickOpensWorkspace(_screen: string): boolean {
  void _screen
  return false
}

export function hudDestinationById(id: HudDestinationId): HudDestination {
  for (const row of HUD_NAVIGATION) {
    if (row.id === id) return row
  }
  throw new Error(codes.API_MALFORMED)
}

export function parseHudDestinationId(value: unknown): HudDestinationId {
  if (!isHudDestinationId(value)) throw new Error(codes.API_MALFORMED)
  return value
}

export function hudDestinationByShortcut(key: string): HudDestination | undefined {
  for (const row of HUD_NAVIGATION) {
    if (row.shortcut === key) return row
  }
  return undefined
}
