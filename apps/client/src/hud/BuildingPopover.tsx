import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from "react"
import { lookup, type StringTable } from "../strings.js"
import type { HudView } from "./model.js"
import { BuildingCard, missingBuildingFacts } from "./parts/BuildingCard.js"
import { districtForBuilding, HudIcon } from "./parts/HudIcon.js"
import { IconButton } from "./parts/IconButton.js"
import type { BuildingSelection } from "./selection.js"
import { clampPopoverPlacement, cssPxToRem, popoverMode, readHudInsets } from "./selection.js"
import type { SceneProjection } from "./sceneProjection.js"
import type { ClientPack } from "../packview.js"

export function BuildingPopover(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly selection: BuildingSelection
  readonly projection: SceneProjection | undefined
  readonly narrow: boolean
  readonly workspaceOpen: boolean
  readonly pack: ClientPack
  readonly onManage: () => void
  readonly onClose: () => void
}): ReactElement | null {
  if (props.selection.kind === "none") return null
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const mode = popoverMode(props.projection, props.narrow, props.workspaceOpen)
  if (mode === "hidden") return null
  const mapped = props.selection.kind === "mapped"
  const title = mapped ? t(props.selection.labelKey) : props.selection.objectId
  const titleKey = mapped ? props.selection.labelKey : "UI_UNMAPPED_BUILDING"
  const fn = liveFunction(props.view, props.selection.objectId)
  const statusText = fn === undefined ? t("UI_UNAVAILABLE") : fn.status
  const statusKey = fn === undefined ? "UI_UNAVAILABLE" : fn.statusKey
  const district = districtForBuilding(props.pack, props.selection.objectId)
  return (
    <PopoverCard
      mode={mode}
      projection={props.projection}
      title={title}
      titleKey={titleKey}
      objectId={props.selection.objectId}
      kind={props.selection.kind}
      mapped={mapped}
      statusText={statusText}
      statusKey={statusKey}
      missingStatus={fn === undefined}
      decorative={t("UI_DECORATIVE")}
      manageLabel={t("UI_MANAGE")}
      selectedLabel={t("UI_SELECTED_BUILDING")}
      closeLabel={props.view.close.text}
      closeKey={props.view.close.key}
      statusLabel={t("UI_BUILDING_STATUS")}
      ticker={district?.ticker}
      districtId={district?.id}
      unmapped={t("UI_UNMAPPED_BUILDING")}
      unavailable={t("UI_UNAVAILABLE")}
      facts={missingBuildingFacts({
        level: t("UI_BUILDING_LEVEL"),
        worker: t("UI_BUILDING_WORKER"),
        task: t("UI_BUILDING_TASK"),
        unavailable: t("UI_UNAVAILABLE"),
      })}
      onManage={props.onManage}
      onClose={props.onClose}
    />
  )
}

function PopoverCard(props: {
  readonly mode: "float" | "dock"
  readonly projection: SceneProjection | undefined
  readonly title: string
  readonly titleKey: string
  readonly objectId: string
  readonly kind: string
  readonly mapped: boolean
  readonly statusText: string
  readonly statusKey: string
  readonly missingStatus: boolean
  readonly decorative: string
  readonly manageLabel: string
  readonly selectedLabel: string
  readonly closeLabel: string
  readonly closeKey: string
  readonly statusLabel: string
  readonly ticker: string | undefined
  readonly districtId: string | undefined
  readonly unmapped: string
  readonly unavailable: string
  readonly facts: readonly { readonly label: string; readonly labelKey: string; readonly value: string; readonly valueKey: string; readonly missing: boolean }[]
  readonly onManage: () => void
  readonly onClose: () => void
}): ReactElement {
  const boxRef = useRef<HTMLElement | null>(null)
  const [place, setPlace] = useState<{ readonly left: number; readonly top: number } | undefined>(undefined)
  useLayoutEffect(() => {
    if (props.mode !== "float" || props.projection === undefined) {
      setPlace(undefined)
      return
    }
    const projection = props.projection
    function measure(): void {
      const el = boxRef.current
      if (el === null) return
      const root = el.closest(".hud-root")
      if (root === null) return
      const chrome = readHudInsets(root)
      const pop = el.getBoundingClientRect()
      const boxW = pop.width > 0 ? pop.width : 288
      const boxH = pop.height > 0 ? pop.height : 220
      setPlace(
        clampPopoverPlacement(projection.x, projection.y, boxW, boxH, chrome.width, chrome.height, chrome.insets),
      )
    }
    measure()
    const el = boxRef.current
    const root = el === null ? null : el.closest(".hud-root")
    const ro = new ResizeObserver(() => {
      measure()
    })
    if (el !== null) ro.observe(el)
    if (root !== null) ro.observe(root)
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [props.mode, props.projection])
  const className =
    props.mode === "dock" ? "hud-popover hud-popover--dock hud-panel" : "hud-popover hud-popover--float hud-panel"
  const pos = floatStyle(props.mode, place)
  return (
    <section
      ref={boxRef}
      data-surface="selection"
      data-selection-kind={props.kind}
      data-object={props.objectId}
      data-popover-mode={props.mode}
      className={className}
      style={pos}
      aria-label={props.selectedLabel}
    >
      <span className="hud-sr">{props.selectedLabel}</span>
      <BuildingCard
        buildingId={props.objectId}
        title={props.title}
        titleKey={props.titleKey}
        ticker={props.ticker}
        districtId={props.districtId}
        mapped={props.mapped}
        decorative={props.decorative}
        statusLabel={props.statusLabel}
        statusText={props.statusText}
        statusKey={props.statusKey}
        missingStatus={props.missingStatus}
        manageLabel={props.manageLabel}
        unmapped={props.unmapped}
        unavailable={props.unavailable}
        facts={props.facts}
        variant="popover"
        onManage={props.onManage}
        end={
          <IconButton label={props.closeLabel} labelKey={props.closeKey} onClick={props.onClose}>
            <HudIcon glyph="close" />
          </IconButton>
        }
      />
    </section>
  )
}

function floatStyle(mode: "float" | "dock", place: { readonly left: number; readonly top: number } | undefined): CSSProperties | undefined {
  if (mode !== "float" || place === undefined) return undefined
  const parsed = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  const rootFont = Number.isFinite(parsed) && parsed > 0 ? parsed : 16
  return {
    left: cssPxToRem(place.left, rootFont),
    top: cssPxToRem(place.top, rootFont),
  }
}

function liveFunction(view: HudView, objectId: string): HudView["shell"]["functions"]["rows"][number] | undefined {
  for (const row of view.shell.functions.rows) {
    if (row.id === objectId) return row
  }
  return undefined
}
