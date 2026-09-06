import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function OfflineReturnScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="offline_return" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <ActionButton {...props} actionId="offline_continue" />
    </ScreenFrame>
  )
}
