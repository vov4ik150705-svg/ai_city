import type { ReactElement, ReactNode } from "react"
import type { FieldKind } from "../fields.js"

export type StatusKind = "ready" | "unavailable" | "ok" | "warn" | "bad" | "dim"

export type StatusChipKind = StatusKind | FieldKind

export type StatusSurface = "chip" | "badge"

export type StatusChipProps = {
  readonly label: string
  readonly labelKey: string
  readonly kind?: StatusChipKind
  readonly surface?: StatusSurface
  readonly icon?: ReactNode
  readonly disabled?: boolean
  readonly onClick?: () => void
  readonly children?: ReactNode
}

export function statusKindFromKey(statusKey: string): StatusKind {
  if (statusKey.startsWith("IDLE") || statusKey.includes("CLOSED")) return "warn"
  if (statusKey === "UI_UNAVAILABLE") return "dim"
  return "ok"
}

export function statusTone(statusKey: string): "ok" | "warn" | "dim" {
  return badgeTone(statusKindFromKey(statusKey))
}

function badgeTone(kind: StatusChipKind): "ok" | "warn" | "dim" {
  switch (kind) {
    case "warn":
    case "bad":
    case "stale":
    case "error":
      return "warn"
    case "unavailable":
    case "dim":
      return "dim"
    case "loading":
    case "ready":
    case "ok":
      return "ok"
    default: {
      const miss: never = kind
      void miss
      return "ok"
    }
  }
}

function chipToken(kind: StatusChipKind): string {
  switch (kind) {
    case "dim":
      return "unavailable"
    case "ok":
    case "warn":
    case "bad":
    case "ready":
    case "unavailable":
    case "loading":
    case "stale":
    case "error":
      return kind
    default: {
      const miss: never = kind
      void miss
      return "unavailable"
    }
  }
}

function chipClass(kind: StatusChipKind): string {
  return `hud-chip hud-chip--${chipToken(kind)}`
}

function badgeClass(kind: StatusChipKind): string {
  const tone = badgeTone(kind)
  return `hud-status hud-status--${tone}`
}

export function StatusChip(props: StatusChipProps): ReactElement {
  const kind = props.kind ?? "ready"
  const surface = props.surface ?? "chip"
  const className = surface === "badge" ? badgeClass(kind) : chipClass(kind)
  const body =
    surface === "badge" ? (
      <>
        {props.icon === undefined ? null : <span className="hud-chip__icon">{props.icon}</span>}
        {props.label}
      </>
    ) : (
      <>
        {props.icon === undefined ? null : <span className="hud-chip__icon">{props.icon}</span>}
        <span className="hud-chip__k">{props.label}</span>
        {props.children == null ? null : <span className="hud-chip__v">{props.children}</span>}
      </>
    )
  if (props.onClick === undefined) {
    return (
      <span
        data-key={props.labelKey}
        data-kind={kind}
        data-state={kind}
        {...(surface === "badge" ? { "data-tone": badgeTone(kind) } : {})}
        className={className}
      >
        {body}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-key={props.labelKey}
      data-kind={kind}
      data-state={kind}
      className={className}
      aria-label={props.label}
      disabled={props.disabled === true}
      onClick={props.onClick}
    >
      {body}
    </button>
  )
}
