import type { ReactElement, ReactNode } from "react"

export function Panel(props: {
  readonly id: string
  readonly title: string
  readonly titleKey: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <section data-key={props.titleKey} data-id={props.id} className="hud-panel hud-card">
      <h2 className="hud-card__h">{props.title}</h2>
      {props.children}
    </section>
  )
}
