import type { ReactElement, ReactNode } from "react"

export type HudCardVariant = "default" | "compact" | "selected" | "subtle"

export function Card(props: {
  readonly id?: string
  readonly variant?: HudCardVariant
  readonly className?: string
  readonly ariaLabel?: string
  readonly children: ReactNode
}): ReactElement {
  const variant = props.variant ?? "default"
  const className = ["hud-card", `hud-card--${variant}`, props.className]
    .filter((part) => part !== undefined && part.length > 0)
    .join(" ")
  return (
    <section
      {...(props.id === undefined ? {} : { "data-id": props.id })}
      {...(props.ariaLabel === undefined ? {} : { "aria-label": props.ariaLabel })}
      className={className}
    >
      {props.children}
    </section>
  )
}
