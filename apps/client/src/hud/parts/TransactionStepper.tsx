import type { ReactElement } from "react"
import type { UiTxnState } from "../uiState.js"

export function TransactionStepper(props: {
  readonly state: UiTxnState | undefined
  readonly t: (key: string) => string
}): ReactElement | null {
  const state = props.state
  if (state === undefined) return null
  return (
    <p data-txn={state.kind} data-state={state.kind} data-key={state.messageKey} className="hud-row" role="status">
      {props.t(state.messageKey)}
    </p>
  )
}
