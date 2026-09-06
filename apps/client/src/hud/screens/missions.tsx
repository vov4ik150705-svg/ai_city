import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function MissionsScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="missions" view={props.view} loading={props.loading} empty={true} onClose={props.onClose}>
      <ActionButton {...props} actionId="missions_start" />
    </ScreenFrame>
  )
}
