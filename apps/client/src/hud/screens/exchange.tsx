import type { ReactElement } from "react"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"
import { Value } from "../parts/Value.js"

export function ExchangeScreen(props: ScreenProps): ReactElement {
  return (
    <ScreenFrame id="exchange" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <p data-quote-lo={props.view.quoteLo} data-quote-hi={props.view.quoteHi}>
        <Value display={props.view.quoteLo} exact={props.view.quoteLo} />
        <Value display={props.view.quoteHi} exact={props.view.quoteHi} />
      </p>
      <ActionButton {...props} actionId="exchange_buy" />
    </ScreenFrame>
  )
}
