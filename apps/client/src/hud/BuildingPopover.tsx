import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from "react"
import { lookup, type StringTable } from "../strings.js"
import type { HudView } from "./model.js"
import type { ResourceView } from "./fields.js"
import { BuildingCard, missingBuildingFacts, type BuildingCardFact } from "./parts/BuildingCard.js"
import { districtForBuilding } from "./parts/HudIcon.js"
import { groupDigits } from "./parts/si.js"
import type { BuildingSelection } from "./selection.js"
import { agentAtBuilding, clampPopoverPlacement, cssPxToRem, popoverMode, readHudInsets } from "./selection.js"
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
  const idleLabel = t("UI_IDLE")
  const reason = idleReason(props.selection.objectId, statusKey, statusText, idleLabel, t("UI_UNAVAILABLE"))
  const tick = tickLine(fn, statusKey, props.pack.buildingMeta[props.selection.objectId], t)
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
      idle={statusKey.startsWith("IDLE_")}
      idleLabel={idleLabel}
      reasonText={reason.text}
      reasonKey={reason.key}
      energy={props.view.shell.energy}
      tickText={tick.text}
      tickKey={tick.key}
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
      facts={liveBuildingFacts(props.view, fn, props.pack.buildingMeta[props.selection.objectId], {
        level: t("UI_BUILDING_LEVEL"),
        worker: t("UI_BUILDING_WORKER"),
        task: t("UI_BUILDING_TASK"),
        unavailable: t("UI_UNAVAILABLE"),
      }, t)}
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
  readonly idle: boolean
  readonly idleLabel: string
  readonly reasonText: string
  readonly reasonKey: string
  readonly energy: ResourceView
  readonly tickText: string
  readonly tickKey: string
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
      const boxW = pop.width > 0 ? pop.width : 16 * 16 + 16 + 8
      const boxH = pop.height > 0 ? pop.height : 16 * 10 + 8
      const scene = root.querySelector("[data-surface='scene'], [data-surface='scene-stub']")
      const canvas = scene === null ? null : scene.querySelector("canvas")
      const sceneBox = canvas instanceof HTMLElement ? canvas.getBoundingClientRect() : scene === null ? null : scene.getBoundingClientRect()
      const originX = sceneBox === null ? 0 : sceneBox.left - chrome.originLeft
      const originY = sceneBox === null ? 0 : sceneBox.top - chrome.originTop
      setPlace(
        clampPopoverPlacement(
          projection.x + originX,
          projection.y + originY,
          boxW,
          boxH,
          chrome.width,
          chrome.height,
          chrome.insets,
          projection.width,
          projection.height,
        ),
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
        idle={props.idle}
        idleLabel={props.idleLabel}
        reasonText={props.reasonText}
        reasonKey={props.reasonKey}
        energy={props.energy}
        tickText={props.tickText}
        tickKey={props.tickKey}
        closeLabel={props.closeLabel}
        closeKey={props.closeKey}
        onManage={props.onManage}
        onClose={props.onClose}
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

/** Server-projected level / worker / task / paid tick. Missing pieces stay unavailable. */
function liveBuildingFacts(
  view: HudView,
  fn: HudView["shell"]["functions"]["rows"][number] | undefined,
  meta: { readonly output: string } | undefined,
  labels: { readonly level: string; readonly worker: string; readonly task: string; readonly unavailable: string },
  t: (key: string) => string,
): readonly BuildingCardFact[] {
  const missing = missingBuildingFacts(labels)
  const core =
    fn === undefined
      ? missing
      : missing.map((fact) => {
          if (fact.labelKey === "UI_BUILDING_LEVEL" && fn.level !== undefined) {
            return { ...fact, value: `${t("UI_LV")} ${fn.level.toString()}`, valueKey: "UI_BUILDING_LEVEL", missing: false }
          }
          if (fact.labelKey === "UI_BUILDING_WORKER") {
            const agent = agentAtBuilding(view.agents, fn.id)
            if (agent !== undefined && agent.role.length > 0) {
              return { ...fact, value: titleCase(agent.role), valueKey: "UI_BUILDING_WORKER", missing: false }
            }
          }
          if (fact.labelKey === "UI_BUILDING_TASK") {
            const agent = agentAtBuilding(view.agents, fn.id)
            if (agent !== undefined && agent.objective.length > 0) {
              return { ...fact, value: titleCase(agent.objective), valueKey: "UI_BUILDING_TASK", missing: false }
            }
          }
          return fact
        })
  return [...core, paidFact(fn, meta, labels.unavailable, t)]
}

function paidFact(
  fn: HudView["shell"]["functions"]["rows"][number] | undefined,
  meta: { readonly output: string } | undefined,
  unavailable: string,
  t: (key: string) => string,
): BuildingCardFact {
  const outKey = outputLabelKey(meta === undefined ? "" : meta.output)
  const paid = fn === undefined ? undefined : fn.paid
  if (typeof paid === "bigint" && outKey.length > 0) {
    return {
      label: t("UI_PAYROLL_PAID"),
      labelKey: "UI_PAYROLL_PAID",
      value: `+${groupDigits(paid)} ${t(outKey)} / ${t("UI_PAYROLL_PAID")}`,
      valueKey: "UI_PAYROLL_PAID",
      missing: false,
    }
  }
  if (outKey.length > 0) {
    return {
      label: t("UI_PAYROLL_PAID"),
      labelKey: "UI_PAYROLL_PAID",
      value: `${t(outKey)} / ${t("UI_PAYROLL_PAID")}`,
      valueKey: "UI_PAYROLL_PAID",
      missing: false,
    }
  }
  return {
    label: t("UI_PAYROLL_PAID"),
    labelKey: "UI_PAYROLL_PAID",
    value: unavailable,
    valueKey: "UI_UNAVAILABLE",
    missing: true,
  }
}

function idleReason(
  objectId: string,
  statusKey: string,
  statusText: string,
  idleLabel: string,
  unavailable: string,
): { readonly text: string; readonly key: string } {
  if (objectId === "power_node" && statusKey === "IDLE_NO_ENERGY") return { text: "", key: "" }
  const norm = statusText.trim().toLowerCase()
  const idle = idleLabel.trim().toLowerCase()
  if (norm.length === 0 || norm === idle || norm === "idle" || norm === "none") {
    return { text: unavailable, key: "UI_UNAVAILABLE" }
  }
  return { text: statusText, key: statusKey }
}

function tickLine(
  fn: HudView["shell"]["functions"]["rows"][number] | undefined,
  statusKey: string,
  meta: { readonly output: string } | undefined,
  t: (key: string) => string,
): { readonly text: string; readonly key: string } {
  const paid = fn === undefined ? undefined : fn.paid
  const idle = statusKey.startsWith("IDLE_")
  if (idle && (typeof paid !== "bigint" || paid === 0n)) {
    return { text: t("UI_LAST_TICK_UNPAID"), key: "UI_LAST_TICK_UNPAID" }
  }
  if (typeof paid === "bigint" && paid > 0n) {
    const fact = paidFact(fn, meta, t("UI_UNAVAILABLE"), t)
    return { text: fact.value, key: fact.valueKey }
  }
  return { text: "", key: "" }
}

function outputLabelKey(output: string): string {
  if (output === "capital" || output === "capital_from_population") return "UI_CAPITAL"
  if (output === "energy") return "UI_ENERGY"
  if (output === "compute") return "UI_COMPUTE"
  return ""
}

function titleCase(id: string): string {
  return id.replace(/_/g, " ").replace(/^\p{L}/u, (c) => c.toUpperCase())
}

function liveFunction(view: HudView, objectId: string): HudView["shell"]["functions"]["rows"][number] | undefined {
  for (const row of view.shell.functions.rows) {
    if (row.id === objectId) return row
  }
  return undefined
}
