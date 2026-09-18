import type { ReactElement } from "react"
import {
  HUD_ICONS,
  HUD_ICON_NAME,
  HUD_ICON_SIZE,
  HUD_ICON_STROKE,
  type HudGlyph,
  type HudIconSemantic,
  type HudIconSize,
} from "./hudIcons.js"
import type { ClientPack, DistrictRow } from "../../packview.js"
import type { JournalBucket } from "../journalBuckets.js"
import type { HudDestinationId } from "../navigation.js"

export { statusKindFromKey, statusTone, type StatusKind } from "./StatusChip.js"
export {
  HUD_ICON_NAME,
  HUD_ICON_SIZE,
  HUD_ICON_STROKE,
  HUD_ICONS,
  HUD_LUCIDE,
  hudIconName,
  type HudGlyph,
  type HudIconSemantic,
  type HudIconSize,
} from "./hudIcons.js"

function semanticClass(semantic: HudIconSemantic | undefined): string {
  switch (semantic) {
    case undefined:
    case "default":
      return ""
    case "active":
      return "hud-ico--active"
    case "success":
      return "hud-ico--success"
    case "warning":
      return "hud-ico--warning"
    case "error":
      return "hud-ico--error"
    case "locked":
    case "muted":
      return "hud-ico--muted"
    default: {
      const miss: never = semantic
      return miss
    }
  }
}

function iconSize(size: HudIconSize | number | undefined): number {
  if (size === undefined) return HUD_ICON_SIZE.sm
  if (typeof size === "number") return size
  return HUD_ICON_SIZE[size]
}

export function HudIcon(props: {
  readonly glyph?: HudGlyph
  readonly name?: HudGlyph
  readonly className?: string
  readonly size?: HudIconSize | number
  readonly semantic?: HudIconSemantic
  readonly strokeWidth?: number
  readonly title?: string
  readonly named?: boolean
}): ReactElement {
  const glyph = props.name ?? props.glyph
  if (glyph === undefined) {
    return <span className={props.className} aria-hidden="true" />
  }
  const Icon = HUD_ICONS[glyph]
  const extra = [semanticClass(props.semantic), props.className].filter((part) => part !== undefined && part.length > 0)
  const className = ["hud-ico", ...extra].join(" ")
  const title = props.title ?? (props.named === true ? HUD_ICON_NAME[glyph] : undefined)
  return (
    <Icon
      className={className}
      size={iconSize(props.size)}
      strokeWidth={props.strokeWidth ?? HUD_ICON_STROKE}
      aria-hidden={title === undefined}
      focusable="false"
      {...(title === undefined ? {} : { role: "img" as const, "aria-label": title })}
    />
  )
}

export const Icon = HudIcon

export function glyphForNav(id: HudDestinationId): HudGlyph {
  switch (id) {
    case "overview":
      return "city"
    case "agents":
      return "agents"
    case "exchange":
      return "market"
    case "bank":
      return "bank"
    case "industries":
      return "industry"
    case "journal":
      return "log"
  }
}

export function glyphForBuilding(id: string): HudGlyph {
  switch (id) {
    case "city_hall":
      return "city"
    case "workshop":
      return "workshop"
    case "robotics_lab":
      return "gear"
    case "agent_hub":
      return "agents"
    case "power_node":
    case "energy_plant":
      return "power"
    case "bank":
    case "finance_tower":
    case "clearing_house":
      return "bank"
    case "exchange":
      return "market"
    case "ai_research_center":
      return "research"
    case "cloud_campus":
    case "data_center":
      return "chip"
    case "logistics_hub":
    case "drone_depot":
    case "fleet_yard":
      return "logistics"
    case "flagship_store":
    case "retail_complex":
      return "retail"
    default:
      return "building"
  }
}

export function glyphForStatus(id: string): HudGlyph {
  switch (id) {
    case "population":
      return "people"
    case "productivity":
      return "pulse"
    case "happiness":
      return "heart"
    case "stability":
      return "shield"
    default:
      return "building"
  }
}

export function glyphForJournal(bucket: JournalBucket): HudGlyph {
  switch (bucket) {
    case "idle":
      return "bolt"
    case "transport":
      return "shield"
    case "other":
      return "log"
  }
}

export function districtForBuilding(pack: ClientPack, buildingId: string): DistrictRow | undefined {
  for (const row of pack.districts) {
    if (row.beacon === buildingId) return row
  }
  return undefined
}

export function tickerForBuilding(pack: ClientPack, buildingId: string): string | undefined {
  return districtForBuilding(pack, buildingId)?.ticker
}
