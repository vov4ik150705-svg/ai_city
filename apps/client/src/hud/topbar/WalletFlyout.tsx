import { useEffect, useRef, useState, type ReactElement } from "react"
import { format, lookup, type StringTable } from "../../strings.js"
import { formatWalletLabel as shortAddress } from "../fields.js"
import { CorpMark } from "../parts/CorpMark.js"
import { HudIcon } from "../parts/HudIcon.js"
import { Loading } from "../parts/Loading.js"

export type WalletFlyoutState = {
  /** Signed-in wallet address; "" when the session is demo. */
  readonly address: string
  /** Server-side chain check (`wallet.chain.match`); undefined when the server has not said. */
  readonly chainWrong: boolean | undefined
  /** $CORP balance as the server projects it; undefined when unknown. */
  readonly corpDisplay: string | undefined
  readonly stocks: readonly { readonly ticker: string; readonly display: string | undefined }[]
  readonly chainId: bigint
}

/** Design-reference 16/17: one card under the $CORP chip. Connect (demo) or
 * address / chain / balance / Open Bank / Disconnect (wallet). No Settings screen. */
export function WalletFlyout(props: {
  readonly strings: StringTable
  readonly state: WalletFlyoutState
  readonly onConnect: () => Promise<string>
  readonly onDisconnect: () => void
  readonly onOpenBank: () => void
  readonly onClose: () => void
}): ReactElement {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState("")
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const used = new Set<string>()
  const t = (key: string): string => lookup(props.strings, key, used)
  const connected = props.state.address.length > 0
  useEffect(() => {
    function onDown(e: PointerEvent): void {
      const node = ref.current
      if (node === null) return
      if (e.target instanceof Node && node.contains(e.target)) return
      const chip = document.querySelector("[data-id='corp-chip']")
      if (chip !== null && e.target instanceof Node && chip.contains(e.target)) return
      props.onClose()
    }
    window.addEventListener("pointerdown", onDown)
    return () => {
      window.removeEventListener("pointerdown", onDown)
    }
  }, [props.onClose])
  async function connect(): Promise<void> {
    setBusy(true)
    setCode("")
    try {
      const got = await props.onConnect()
      if (got.length > 0) setCode(got)
    } finally {
      setBusy(false)
    }
  }
  function copy(): void {
    const clip = navigator.clipboard
    if (clip === undefined) return
    void clip.writeText(props.state.address).then(() => {
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 1200)
    })
  }
  const codeText =
    code.length === 0
      ? ""
      : format(props.strings[code] ?? "", { chain: props.state.chainId.toString() })
  return (
    <div ref={ref} data-surface="wallet-flyout" data-wallet={connected ? "connected" : "disconnected"} className="hud-flyout" role="dialog" aria-label={t("UI_WALLET")}>
      <div className="hud-flyout__head">
        {connected ? <HudIcon glyph="purse" size="sm" /> : null}
        <span className="hud-flyout__title" data-key="UI_WALLET">
          {t("UI_WALLET")}
        </span>
        <button type="button" className="hud-flyout__close" aria-label={t("UI_CLOSE")} onClick={props.onClose}>
          <HudIcon glyph="close" size="sm" />
        </button>
      </div>
      {connected ? (
        <>
          <div className="hud-flyout__addr">
            <span className="hud-mono" title={props.state.address}>
              {shortAddress(props.state.address)}
            </span>
            <button type="button" className="hud-flyout__copy" aria-label={t("UI_COPY")} onClick={copy}>
              <HudIcon glyph="copy" size="sm" />
            </button>
            {copied ? (
              <span className="hud-flyout__copied" data-key="UI_COPIED">
                {t("UI_COPIED")}
              </span>
            ) : null}
          </div>
          <p className={`hud-flyout__chain${props.state.chainWrong === true ? " hud-flyout__chain--bad" : ""}`}>
            <span className="hud-dot" data-tone={props.state.chainWrong === true ? "bad" : props.state.chainWrong === false ? "ok" : "muted"} aria-hidden="true" />
            <span data-key={props.state.chainWrong === true ? "UI_CHAIN_WRONG" : "UI_CHAIN_OK"}>
              {props.state.chainWrong === true ? t("UI_CHAIN_WRONG") : t("UI_CHAIN_OK")}
            </span>
          </p>
          <div className="hud-flyout__balance">
            <CorpMark kind="balance" />
            <div className="hud-flyout__bal">
              <div className="hud-flyout__amount">
                {props.state.corpDisplay === undefined ? (
                  <span className="hud-chip__dash" data-missing="1">
                    {"—"}
                  </span>
                ) : (
                  <span>{props.state.corpDisplay}</span>
                )}
                <span className="hud-flyout__unit" data-key="UI_CORP">
                  {t("UI_CORP")}
                </span>
              </div>
              <p className="hud-flyout__sub" data-key="UI_WALLET_BALANCE">
                {t("UI_WALLET_BALANCE")}
              </p>
            </div>
          </div>
          <ul className="hud-flyout__stocks">
            {props.state.stocks.map((row) => (
              <li key={row.ticker} data-wallet-stock={row.ticker} data-missing={row.display === undefined ? "1" : "0"}>
                <span>{row.ticker}</span>
                <span>{row.display === undefined ? "—" : row.display}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="hud-btn hud-btn--primary hud-flyout__cta" data-key="UI_OPEN_BANK" onClick={props.onOpenBank}>
            {t("UI_OPEN_BANK")}
          </button>
          <button type="button" className="hud-btn hud-btn--danger hud-flyout__cta" data-key="UI_DISCONNECT" onClick={props.onDisconnect}>
            {t("UI_DISCONNECT")}
          </button>
        </>
      ) : (
        <>
          <p className="hud-flyout__sub" data-key="UI_WALLET_NOT_CONNECTED">
            {t("UI_WALLET_NOT_CONNECTED")}
          </p>
          <button type="button" className="hud-btn hud-btn--primary hud-flyout__cta" data-key="UI_CONNECT" disabled={busy} onClick={() => void connect()}>
            {busy ? <Loading kind="spinner_inline" /> : t("UI_CONNECT")}
          </button>
          {code.length > 0 ? (
            <p className="hud-flyout__code" data-key={code} role="alert">
              {codeText}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
