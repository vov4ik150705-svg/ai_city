import type { ReactElement } from "react"

type StateCopy = {
  readonly textKey: string
  readonly text: string
}

function StateLine(props: StateCopy & { readonly state: "empty" | "unavailable" | "stale" | "error" }): ReactElement {
  const alert = props.state === "error"
  return (
    <p
      data-key={props.textKey}
      data-state={props.state}
      className={props.state === "empty" ? "hud-muted hud-empty" : `hud-${props.state}`}
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
    >
      {props.text}
    </p>
  )
}

export function Empty(props: StateCopy): ReactElement {
  return <StateLine state="empty" textKey={props.textKey} text={props.text} />
}

export function EmptyState(props: StateCopy): ReactElement {
  return <Empty textKey={props.textKey} text={props.text} />
}

export function UnavailableState(props: StateCopy): ReactElement {
  return <StateLine state="unavailable" textKey={props.textKey} text={props.text} />
}

export function StaleState(props: StateCopy): ReactElement {
  return <StateLine state="stale" textKey={props.textKey} text={props.text} />
}

export function ErrorState(props: StateCopy): ReactElement {
  return <StateLine state="error" textKey={props.textKey} text={props.text} />
}
