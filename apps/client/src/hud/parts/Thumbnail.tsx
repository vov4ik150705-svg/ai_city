import type { ReactElement, ReactNode } from "react"

export type HudThumbnailVariant = "default" | "compact" | "portrait"

export function Thumbnail(props: {
  readonly variant?: HudThumbnailVariant
  readonly state?: "ready" | "loading" | "unavailable" | "error" | "decorative"
  readonly className?: string
  readonly children: ReactNode
}): ReactElement {
  const variant = props.variant ?? "default"
  const state = props.state ?? "ready"
  const className = ["hud-thumbnail", `hud-thumbnail--${variant}`, props.className]
    .filter((part) => part !== undefined && part.length > 0)
    .join(" ")
  return (
    <span className={className} data-thumbnail-state={state}>
      {props.children}
    </span>
  )
}
