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

export function resolveBuildingSelection(
  objectId: string,
  pack: ClientPack,
  functions?: readonly { readonly id: string }[],
): BuildingSelection {
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
    manage: manageForBuilding(objectId, pack, functions),
  }
}

export function popoverMode(
  projection: SceneProjection | undefined,
  narrow: boolean,
  workspaceOpen = false,
): PopoverMode {
  void narrow
  if (workspaceOpen) return "hidden"
  if (projection !== undefined && projection.visible) return "float"
  return "dock"
}

/** Gap between the projected GLB box and the popover card, in CSS pixels. */
export const POPOVER_ANCHOR_GAP_PX = 12

/** Place the popover below (prefer) or above the projected GLB box, then clamp to chrome.
 * Does not slide the card onto the selected mesh when a vertical slot still fits. */
export function clampPopoverPlacement(
  anchorX: number,
  anchorY: number,
  boxW: number,
  boxH: number,
  viewW: number,
  viewH: number,
  insets: PopoverInsets,
  anchorW = 0,
  anchorH = 0,
): { readonly left: number; readonly top: number } {
  const gap = POPOVER_ANCHOR_GAP_PX
  const halfW = anchorW > 0 ? anchorW / 2 : 0
  const halfH = anchorH > 0 ? anchorH / 2 : 0
  const bLeft = anchorX - halfW
  const bRight = anchorX + halfW
  const bTop = anchorY - halfH
  const bBottom = anchorY + halfH
  const minL = insets.left
  const maxL = viewW - insets.right - boxW
  const minT = insets.top
  const maxT = viewH - insets.bottom - boxH

  function clampLeft(left: number): number {
    if (maxL < minL) return minL
    if (left < minL) return minL
    if (left > maxL) return maxL
    return left
  }

  function clampTop(top: number): number {
    if (maxT < minT) return minT
    if (top < minT) return minT
    if (top > maxT) return maxT
    return top
  }

  function fitsX(left: number): boolean {
    if (maxL < minL) return false
    return left >= minL && left <= maxL
  }

  function fitsY(top: number): boolean {
    if (maxT < minT) return false
    return top >= minT && top <= maxT
  }

  function overlapsBuilding(left: number, top: number): boolean {
    if (anchorW <= 0 && anchorH <= 0) return false
    const pRight = left + boxW
    const pBottom = top + boxH
    const kLeft = bLeft - gap
    const kTop = bTop - gap
    const kRight = bRight + gap
    const kBottom = bBottom + gap
    return left < kRight && pRight > kLeft && top < kBottom && pBottom > kTop
  }

  const centerLeft = clampLeft(anchorX - boxW / 2)
  const below = bBottom + gap
  const above = bTop - gap - boxH
  const right = bRight + gap
  const leftSide = bLeft - gap - boxW

  function alongRow(top: number): { readonly left: number; readonly top: number } | undefined {
    if (!fitsY(top)) return undefined
    const mid = clampLeft(anchorX - boxW / 2)
    if (!overlapsBuilding(mid, top)) return { left: mid, top }
    if (fitsX(right) && !overlapsBuilding(right, top)) return { left: right, top }
    if (fitsX(leftSide) && !overlapsBuilding(leftSide, top)) return { left: leftSide, top }
    return undefined
  }

  const under = alongRow(below)
  if (under !== undefined) return under
  const over = alongRow(above)
  if (over !== undefined) return over

  const midTop = clampTop(anchorY - boxH / 2)
  if (fitsX(right) && fitsY(midTop) && !overlapsBuilding(right, midTop)) {
    return { left: right, top: midTop }
  }
  if (fitsX(leftSide) && fitsY(midTop) && !overlapsBuilding(leftSide, midTop)) {
    return { left: leftSide, top: midTop }
  }

  if (fitsY(below)) return { left: centerLeft, top: below }
  if (fitsY(above)) return { left: centerLeft, top: above }
  return { left: centerLeft, top: clampTop(below) }
}

export function readHudInsets(root: Element): {
  readonly width: number
  readonly height: number
  readonly originLeft: number
  readonly originTop: number
  readonly insets: PopoverInsets
} {
  const rootBox = root.getBoundingClientRect()
  return {
    width: rootBox.width,
    height: rootBox.height,
    originLeft: rootBox.left,
    originTop: rootBox.top,
    insets: {
      top: edgeBottom(root.querySelector(".hud-topbar"), rootBox),
      left: edgeRight(root.querySelector(".hud-col--left"), rootBox),
      right: edgeFromRight(root.querySelector(".hud-col--right"), rootBox),
      // Functions/activity live in the overlay row under the island well.
      // Using them as a hard bottom inset slides the card onto the GLB or into the sky.
      bottom: 0,
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

function manageForBuilding(
  objectId: string,
  pack: ClientPack,
  functions: readonly { readonly id: string }[] | undefined,
): BuildingManage {
  const built = functionBuilt(functions, objectId)
  if (!built && (objectId === "bank" || objectId === "exchange" || objectId === "agent_hub")) {
    return { route: "building_card", overviewTab: undefined, districtId: undefined }
  }
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

function functionBuilt(functions: readonly { readonly id: string }[] | undefined, objectId: string): boolean {
  if (functions === undefined) return true
  for (const row of functions) {
    if (row.id === objectId) return true
  }
  return false
}

/** Seated agent for a building. Contour/slot role on the function row is not a person. */
export function agentAtBuilding<T extends { readonly buildingId: string }>(
  agents: readonly T[],
  buildingId: string,
): T | undefined {
  if (buildingId.length === 0) return undefined
  for (const row of agents) {
    if (row.buildingId === buildingId) return row
  }
  return undefined
}
