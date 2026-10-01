import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

/** Pack bijection surface. Live wallet entry is LoginRoot only. */
export function WalletConnectScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  return (
    <ScreenFrame id="wallet_connect" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <section data-wallet-login="0" aria-hidden="true">
        <span data-key="UI_UNAVAILABLE">{unavailable}</span>
      </section>
    </ScreenFrame>
  )
}
