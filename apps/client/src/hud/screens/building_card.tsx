import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function BuildingCardScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="building_card" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <ActionButton {...props} actionId="building_upgrade" />
    </ScreenFrame>
  )
}
