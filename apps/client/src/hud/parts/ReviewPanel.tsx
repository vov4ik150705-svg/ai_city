import type { ReactElement, ReactNode } from "react"
import { Card } from "./Card.js"

export function ReviewPanel(props: {
  readonly title: string
  readonly titleKey: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <Card className="hud-review-panel" ariaLabel={props.title}>
      <header className="hud-card__h hud-panel-h">
        <h3 data-key={props.titleKey} className="hud-panel-h__t">
          {props.title}
        </h3>
      </header>
      <div className="hud-card__body">{props.children}</div>
    </Card>
  )
}
