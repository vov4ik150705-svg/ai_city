import type { SceneProjection } from "./sceneProjection.js"
import type { ClientPack } from "../packview.js"
import type { OverviewTabId } from "./fields.js"

export type SelectionKind = "none" | "mapped" | "unmapped"
export type PopoverMode = "float" | "dock" | "hidden"

export type BuildingManage = {
  readonly route: string
  readonly overviewTab: OverviewTabId | undefined
  readonly districtId: string | undefined
}

export type BuildingSelection = {
  readonly objectId: string
  readonly kind: SelectionKind
  readonly labelKey: string
  readonly manage: BuildingManage | undefined
}

export type PopoverInsets = {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** Persistent Recent Activity shows at most three rows (HUD Design System errata). */
export const RECENT_ACTIVITY_DEFAULT_ROWS = 3

/** Persistent Active Functions shows at most five building shortcuts. */
export const ACTIVE_FUNCTIONS_DEFAULT_ROWS = 5

/** City Status, Recent Activity, Active Functions, and the selection popover hide while a workspace is open. */
export function islandChromeVisible(workspaceOpen: boolean): boolean {
  return !workspaceOpen
}

export function buildingLabelKey(objectId: string): string {
  return `UI_BLD_${objectId.toUpperCase()}`
}

export function resolveBuildingSelection(objectId: string, pack: ClientPack): BuildingSelection {
  if (objectId.length === 0) {
    return { objectId: "", kind: "none", labelKey: "UI_SELECTED_BUILDING", manage: undefined }
  }
  let mapped = false
  for (const id of pack.buildingIds) {
    if (id === objectId) {
      mapped = true
      break
    }
  }
  if (!mapped) {
    return { objectId, kind: "unmapped", labelKey: "UI_UNMAPPED_BUILDING", manage: undefined }
  }
  return {
    objectId,
    kind: "mapped",
    labelKey: buildingLabelKey(objectId),
    manage: manageForBuilding(objectId, pack),
  }
}

export function popoverMode(
  projection: SceneProjection | undefined,
  narrow: boolean,
  workspaceOpen = false,
): PopoverMode {
  if (workspaceOpen) return "hidden"
  if (narrow) return "dock"
  if (projection === undefined || !projection.visible) return "dock"
  return "float"
}

/** Clamp the popover box inside measured chrome, not raw projection pixels. */
export function clampPopoverPlacement(
  anchorX: number,
  anchorY: number,
  boxW: number,
  boxH: number,
  viewW: number,
  viewH: number,
  insets: PopoverInsets,
): { readonly left: number; readonly top: number } {
  const gap = 12
  const minL = insets.left
  const maxL = viewW - insets.right - boxW
  const minT = insets.top
  const maxT = viewH - insets.bottom - boxH
  let left = anchorX - boxW / 2
  let top = anchorY + gap
  if (maxL < minL) left = minL
  else if (left < minL) left = minL
  else if (left > maxL) left = maxL
  if (maxT < minT) top = minT
  else if (top < minT) top = minT
  else if (top > maxT) top = maxT
  return { left, top }
}

export function readHudInsets(root: Element): {
  readonly width: number
  readonly height: number
  readonly insets: PopoverInsets
} {
  const rootBox = root.getBoundingClientRect()
  return {
    width: rootBox.width,
    height: rootBox.height,
    insets: {
      top: edgeBottom(root.querySelector(".hud-topbar"), rootBox),
      left: edgeRight(root.querySelector(".hud-col--left"), rootBox),
      right: edgeFromRight(root.querySelector(".hud-col--right"), rootBox),
      bottom: Math.max(
        edgeFromBottom(root.querySelector(".hud-functions"), rootBox),
        edgeFromBottom(root.querySelector(".hud-activity"), rootBox),
      ),
    },
  }
}

export function cssPxToRem(px: number, rootFontPx: number): string {
  const base = rootFontPx > 0 ? rootFontPx : 16
  return `${(px / base).toString()}rem`
}

function edgeBottom(el: Element | null, root: DOMRect): number {
  if (el === null) return 0
  const box = el.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return 0
  const v = box.bottom - root.top
  return v > 0 ? v : 0
}

function edgeRight(el: Element | null, root: DOMRect): number {
  if (el === null) return 0
  const box = el.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return 0
  const v = box.right - root.left
  return v > 0 ? v : 0
}

function edgeFromRight(el: Element | null, root: DOMRect): number {
  if (el === null) return 0
  const box = el.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return 0
  const v = root.right - box.left
  return v > 0 ? v : 0
}

function edgeFromBottom(el: Element | null, root: DOMRect): number {
  if (el === null) return 0
  const box = el.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return 0
  const v = root.bottom - box.top
  return v > 0 ? v : 0
}

function manageForBuilding(objectId: string, pack: ClientPack): BuildingManage {
  if (objectId === "bank") {
    return { route: "bank", overviewTab: undefined, districtId: undefined }
  }
  if (objectId === "exchange") {
    return { route: "exchange", overviewTab: undefined, districtId: undefined }
  }
  if (objectId === "agent_hub") {
    return { route: "agents", overviewTab: undefined, districtId: undefined }
  }
  if (objectId === "city_hall") {
    return { route: "overview", overviewTab: "summary", districtId: undefined }
  }
  if (objectId === "ai_research_center") {
    return { route: "overview", overviewTab: "research", districtId: undefined }
  }
  const districtId = pack.camera.beacons[objectId]
  if (districtId !== undefined && districtId.length > 0) {
    return { route: "building_card", overviewTab: undefined, districtId }
  }
  return { route: "building_card", overviewTab: undefined, districtId: undefined }
}
