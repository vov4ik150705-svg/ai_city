import type { ReactElement } from "react"
import { UnavailableState } from "./Empty.js"
import { isAgentRoleId, resolveRolePortrait, type RoleArtVariant } from "./hudArt.js"
import { roleArtUrl } from "./hudArtUrls.js"
import { HudIcon } from "./HudIcon.js"

export function AgentPortrait(props: {
  readonly unavailable: string
  readonly title?: string
  readonly variant?: RoleArtVariant
  readonly roleId?: string
  readonly fallbackIcon?: boolean
}): ReactElement {
  const variant = props.variant ?? "portrait"
  const hit = resolveRolePortrait(props.roleId, variant)
  const className = variant === "icon" ? "hud-portrait hud-portrait--icon" : "hud-portrait"
  if (hit.kind !== "ready" || !isAgentRoleId(hit.roleId)) {
    if (props.fallbackIcon === true) {
      return (
        <span className={className} data-portrait="unavailable">
          <HudIcon glyph="agent" semantic="muted" />
        </span>
      )
    }
    return (
      <span className={className} data-portrait={hit.kind === "ready" ? "unavailable" : hit.kind}>
        <UnavailableState textKey="UI_UNAVAILABLE" text={props.unavailable} />
      </span>
    )
  }
  const title = props.title
  return (
    <span className={className} data-portrait="ready" data-role={hit.roleId}>
      <img src={roleArtUrl(hit.roleId, variant)} alt={title === undefined ? "" : title} className="hud-portrait__img" />
    </span>
  )
}
