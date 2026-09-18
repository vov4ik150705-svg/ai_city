import type { MouseEvent, ReactElement, ReactNode } from "react"

export type HudButtonVariant = "primary" | "secondary" | "ghost"

export function Button(props: {
  readonly variant?: HudButtonVariant
  readonly className?: string
  readonly labelKey?: string
  readonly type?: "button" | "submit" | "reset"
  readonly disabled?: boolean
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  readonly children: ReactNode
}): ReactElement {
  const variant = props.variant ?? "secondary"
  const className = ["hud-btn", `hud-btn--${variant}`, props.className]
    .filter((part) => part !== undefined && part.length > 0)
    .join(" ")
  return (
    <button
      type={props.type ?? "button"}
      {...(props.labelKey === undefined ? {} : { "data-key": props.labelKey })}
      className={className}
      disabled={props.disabled === true}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}
