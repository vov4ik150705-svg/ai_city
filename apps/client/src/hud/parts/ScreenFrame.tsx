import type { ReactElement, ReactNode } from "react"
import { Empty } from "./Empty.js"
import { Loading } from "./Loading.js"
import type { LiveAdapterResult, UiIntent, CommitExtra } from "../liveAdapter.js"
import type { HudView } from "../model.js"

export type ScreenProps = {
  readonly view: HudView
  readonly pack: import("../../packview.js").ClientPack
  readonly strings: import("../../strings.js").StringTable
  readonly demo: boolean
  readonly failed: ReadonlySet<string>
  readonly loading: boolean
  readonly onClose: () => void
  readonly onNavigate: (id: string, objectId?: string) => void
  readonly pendingCell: string
  readonly pendingTileX: bigint
  readonly pendingTileY: bigint
  readonly onIntent: (intent: UiIntent, extra?: CommitExtra) => void | Promise<void | LiveAdapterResult>
  readonly onCommit: (effect: string, extra?: CommitExtra) => void | Promise<void | LiveAdapterResult>
  readonly moneyTxn: import("../uiState.js").UiTxnState | undefined
  readonly onMoneyTxn: (state: import("../uiState.js").UiTxnState | undefined) => void
  readonly onLocal: (effect: string) => void
  readonly lookId?: string
  readonly selectedObjectId?: string
  readonly commandRefusal?: { readonly action: string; readonly code: string }
  readonly bankVoucher?: import("../screens/bank.js").BankVoucher
  readonly stockOut?: string
  readonly adapterCode?: string
}

export type ScreenFrameProps = {
  readonly id: string
  readonly view: HudView
  readonly loading: boolean
  readonly empty: boolean
  readonly onClose: () => void
  readonly children: ReactNode
}

export type HudChromeKind = "workspace" | "screen"

export function ScreenFrame(props: ScreenFrameProps): ReactElement {
  const chrome = props.view.chrome[props.id]
  const titleKey = chrome === undefined ? "" : chrome.titleKey
  const title = chrome === undefined ? "" : chrome.title
  const emptyKey = chrome === undefined ? "" : chrome.emptyKey
  const emptyText = chrome === undefined ? "" : chrome.emptyText
  const loadingKind = chrome === undefined ? "" : chrome.loadingKind
  const mount = chrome === undefined ? "fullscreen" : chrome.mount
  return (
    <section
      data-screen={props.id}
      data-mount={mount}
      data-loading-kind={loadingKind}
      data-empty-kind={chrome === undefined ? "" : chrome.emptyKind}
      data-busy={props.loading ? "1" : "0"}
      data-empty={props.empty ? "1" : "0"}
      className={`hud-screen hud-screen--${mount}`}
    >
      <header className="hud-screen__bar">
        <h1 data-key={titleKey} className="hud-screen__h">
          {title}
        </h1>
        <button type="button" data-key={props.view.close.key} className="hud-screen__x" onClick={props.onClose}>
          {props.view.close.text}
        </button>
      </header>
      {props.loading ? <Loading kind={loadingKind} /> : null}
      {!props.loading && props.empty ? <Empty textKey={emptyKey} text={emptyText} /> : null}
      {!props.loading ? props.children : null}
    </section>
  )
}
