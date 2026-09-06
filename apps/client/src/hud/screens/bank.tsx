import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { Value } from "../parts/Value.js"

export function BankScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="bank" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <p data-mint-rate={props.view.mintRate}>
        <Value display={props.view.mintRate} exact={props.view.mintRate} />
      </p>
      <p data-bank-limit={props.view.bankLimit}>
        <Value display={props.view.bankLimit} exact={props.view.bankLimit} />
      </p>
      <ActionButton {...props} actionId="bank_deposit" />
      <ActionButton {...props} actionId="bank_withdraw" />
    </ScreenFrame>
  )
}
