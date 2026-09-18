import type { ReactElement, ReactNode } from "react"
import { Card, type HudCardVariant } from "./Card.js"
import { PanelHeader } from "./PanelHeader.js"

export function Panel(props: {
  readonly id: string
  readonly title: string
  readonly titleKey: string
  readonly glyph?: Parameters<typeof PanelHeader>[0]["glyph"]
  readonly extra?: ReactNode
  readonly variant?: HudCardVariant
  readonly children: ReactNode
}): ReactElement {
  return (
    <Card
      id={props.id}
      {...(props.variant === undefined ? {} : { variant: props.variant })}
      className="hud-panel"
    >
      <PanelHeader
        title={props.title}
        titleKey={props.titleKey}
        {...(props.glyph === undefined ? {} : { glyph: props.glyph })}
        extra={props.extra}
      />
      <div className="hud-card__body hud-card__list">{props.children}</div>
    </Card>
  )
}
