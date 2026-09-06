import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function WalletConnectScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="wallet_connect" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <ActionButton {...props} actionId="wallet_connect_start" />
      <ActionButton {...props} actionId="wallet_confirm" />
    </ScreenFrame>
  )
}
