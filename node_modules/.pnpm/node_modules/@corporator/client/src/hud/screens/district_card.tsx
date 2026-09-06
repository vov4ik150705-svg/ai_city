import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function DistrictCardScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="district_card" view={props.view} loading={props.loading} empty={props.view.districts.length === 0} onClose={props.onClose}>
      <ActionButton {...props} actionId="district_claim_fragment" />
      <ActionButton {...props} actionId="district_unlock_tier" />
      <ActionButton {...props} actionId="district_stake_more" />
    </ScreenFrame>
  )
}
