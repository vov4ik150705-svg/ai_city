import type { ReactElement } from "react"
import { UnavailableState } from "./Empty.js"
import { buildingCardKind, isFunctionalBuildingId, resolveBuildingArt } from "./hudArt.js"
import { BUILDING_ART_URLS } from "./hudArtUrls.js"
import { glyphForBuilding, HudIcon } from "./HudIcon.js"

export function BuildingThumbnail(props: {
  readonly buildingId: string
  readonly unavailable: string
  readonly title?: string
  readonly compact?: boolean
  readonly fallbackIcon?: boolean
  readonly className?: string
  readonly decorative?: string
}): ReactElement {
  const hit = resolveBuildingArt(props.buildingId)
  const cardKind = buildingCardKind(props.buildingId)
  const compact = props.compact === true
  const extra = props.className
  const className = [compact ? "hud-thumb hud-thumb--compact" : "hud-thumb", extra]
    .filter((part) => part !== undefined && part.length > 0)
    .join(" ")
  if (cardKind === "functional" && hit.kind === "functional" && isFunctionalBuildingId(hit.id)) {
    const url = BUILDING_ART_URLS[hit.id]
    const title = props.title
    return (
      <span className={className} data-thumb="ready" data-building={hit.id}>
        <img src={url} alt={title === undefined ? "" : title} className="hud-thumb__img" />
      </span>
    )
  }
  if (cardKind === "decorative") {
    const decorative = props.decorative
    return (
      <span className={className} data-thumb="decorative" data-building={hit.id}>
        <UnavailableState
          textKey={decorative === undefined ? "UI_UNAVAILABLE" : "UI_DECORATIVE"}
          text={decorative === undefined ? props.unavailable : decorative}
        />
      </span>
    )
  }
  if (props.fallbackIcon === true && hit.kind === "unavailable") {
    return (
      <span className={className} data-thumb="icon" data-building={props.buildingId}>
        <HudIcon glyph={glyphForBuilding(props.buildingId)} />
      </span>
    )
  }
  return (
    <span className={className} data-thumb="unavailable" data-building={props.buildingId}>
      <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
    </span>
  )
}
