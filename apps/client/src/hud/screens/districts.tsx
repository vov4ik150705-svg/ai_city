import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function DistrictsScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="districts" view={props.view} loading={props.loading} empty={props.view.districts.length === 0} onClose={props.onClose}>
      <ul className="hud-list">
        {props.view.districts.map((d) => (
          <li key={d.id}>
            <button type="button" data-district={d.id} onClick={() => props.onNavigate("district_card")}>
              {d.ticker}
            </button>
          </li>
        ))}
      </ul>
      <ActionButton {...props} actionId="districts_open" />
      <ActionButton {...props} actionId="districts_to_exchange" />
    </ScreenFrame>
  )
}
