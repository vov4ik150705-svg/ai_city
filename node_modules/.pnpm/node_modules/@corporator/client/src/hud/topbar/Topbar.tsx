import type { ReactElement } from "react"
import { screens } from "@corporator/protocol"
import type { HudView } from "../model.js"
import { BankPlaque } from "./BankPlaque.js"
import { CapitalSlot } from "./CapitalSlot.js"
import { ClockSlot } from "./ClockSlot.js"
import { Value } from "../parts/Value.js"

export function Topbar(props: {
  readonly view: HudView
  readonly brand: string
  readonly onNavigate: (id: string) => void
}): ReactElement {
  return (
    <header data-surface={screens.topbar} className="hud-panel hud-topbar">
      <span className="hud-brand" data-key="UI_TOPBAR">
        {props.brand}
      </span>
      {props.view.topbar.map((row) => {
        if (row.id === "settings") {
          return (
            <button
              key={row.id}
              type="button"
              data-key={row.key}
              data-id={row.id}
              className="hud-metric"
              onClick={() => props.onNavigate("settings")}
            >
              <span className="hud-metric__k">{row.caption}</span>
            </button>
          )
        }
        if (row.id === "corp") {
          return (
            <button
              key={row.id}
              type="button"
              data-key={row.key}
              data-id={row.id}
              className="hud-metric"
              onClick={() => props.onNavigate("bank")}
            >
              {row.caption.length > 0 ? <span className="hud-metric__k">{row.caption}</span> : null}
              <Value className="hud-metric__v" display={row.value} exact={row.exact} />
            </button>
          )
        }
        if (row.id === "capital") {
          return (
            <CapitalSlot
              key={row.id}
              caption={row.caption}
              captionKey={row.key}
              display={row.value}
              exact={row.exact}
            />
          )
        }
        if (row.id === "clock") {
          return <ClockSlot key={row.id} value={row.value} valueKey={row.key} />
        }
        return (
          <span key={row.id} data-key={row.key} data-id={row.id} className="hud-metric">
            {row.caption.length > 0 ? <span className="hud-metric__k">{row.caption}</span> : null}
            <Value className="hud-metric__v" display={row.value} exact={row.exact} />
          </span>
        )
      })}
      <BankPlaque plaque={props.view.plaque} />
    </header>
  )
}
