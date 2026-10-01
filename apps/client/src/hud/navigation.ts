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
  "agent_card",
  "building_card",
  "district_card",
  "city_level",
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
    route === "bank" ||
    route === "exchange" ||
    route === "industries" ||
    route === "leaderboard" ||
    route === "overview" ||
    route === "journal" ||
    route === "district_card" ||
    route === "building_card" ||
    route === "agent_card" ||
    route === "city_level"
  )
}

export function packWorkspaceId(route: string): string | undefined {
  if (route === "overview" || route === "industries" || route === "journal" || route === "city_level") return undefined
  const dest = resolveHudRoute(route)
  if (dest === undefined) return undefined
  if (dest.route === "overview" || dest.route === "industries" || dest.route === "journal" || dest.route === "city_level") return undefined
  return dest.route
}

/** Journal is the only surface with a live loading flag today. */
export function workspaceLoading(route: string, logLoading: boolean | undefined): boolean {
  return route === "journal" && logLoading === true
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

export type HudPaneMotion = "in" | "forward" | "back"

/** How the cabinet body should enter. Overlays that are not one of the six step forward. */
export function hudPaneMotion(from: string, to: string, back: boolean): HudPaneMotion {
  if (from.length === 0) return "in"
  if (back) return "back"
  const left = HUD_NAVIGATION.findIndex((row) => row.id === from)
  const right = HUD_NAVIGATION.findIndex((row) => row.id === to)
  if (left >= 0 && right >= 0 && right < left) return "back"
  return "forward"
}

/** Next of the six cabinets. Undefined when the current route is an overlay. */
export function hudDestinationStep(route: string, dir: -1 | 1): string | undefined {
  const index = HUD_NAVIGATION.findIndex((row) => row.id === route)
  if (index < 0) return undefined
  const count = HUD_NAVIGATION.length
  const next = (index + dir + count) % count
  const row = HUD_NAVIGATION[next]
  return row === undefined ? undefined : row.id
}
