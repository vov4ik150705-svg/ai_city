import { useState, type CSSProperties, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import type { StringTable } from "../strings.js"
import { format } from "../strings.js"
import { openDemoSession, type SessionOk } from "../session.js"
import { hudCssVars } from "../palette.js"
import type { Palette } from "../palette.js"
import { loginWithWallet, postBytes, walletOf } from "../walletLogin.js"
import { walletLoginPhase } from "./flows.js"
import { FontFaces } from "./parts/FontFaces.js"
import { Loading } from "./parts/Loading.js"
import { BRAND_MARK_URL } from "./parts/hudArtUrls.js"
import "./hud.css"
import "./hud-light.css"

const post = postBytes

export function LoginRoot(props: {
  readonly origin: string
  readonly strings: StringTable
  readonly palette: Palette
  readonly chainId: bigint
  readonly onReady: (session: SessionOk, address?: string) => void
}): ReactElement {
  const [code, setCode] = useState("")
  const [connecting, setConnecting] = useState(false)
  const vars = hudCssVars(props.palette)
  const pageBg = vars["--bg-panel"]
  const pageFg = vars["--text"]
  if (pageBg === undefined || pageFg === undefined) throw new Error(codes.API_MALFORMED)
  const geo: CSSProperties = { ...vars, background: pageBg, color: pageFg }
  const phase = walletLoginPhase({
    hasWallet: walletOf(globalThis) !== undefined,
    connecting,
    expectedChain: props.chainId,
    gotChain: undefined,
  })
  const codeText =
    code === codes.WALLET_WRONG_CHAIN
      ? format(props.strings[code] ?? "", { chain: props.chainId.toString() })
      : (props.strings[code] ?? "")

  async function onDemo(): Promise<void> {
    try {
      const got = await openDemoSession(props.origin, post)
      if (got === undefined) {
        setCode(codes.API_UNAUTHORIZED)
        return
      }
      props.onReady(got)
    } catch {
      setCode(codes.API_UNAUTHORIZED)
    }
  }

  async function onWallet(): Promise<void> {
    setConnecting(true)
    setCode("")
    try {
      const got = await loginWithWallet({ origin: props.origin, chainId: props.chainId, wallet: walletOf(globalThis) })
      if (!got.ok) {
        setCode(got.code)
        return
      }
      props.onReady(got.session, got.address)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div data-app="login" data-wallet-login="1" data-phase={connecting ? "connecting" : phase} className="hud-root hud-login" style={geo}>
      <FontFaces />
      <section className="hud-panel hud-card hud-login__card">
        <span className="hud-brand hud-login__brand" data-key="UI_BRAND">
          <img className="hud-brand__mark" src={BRAND_MARK_URL} alt="" />
          {props.strings["UI_BRAND"] ?? props.strings["UI_TOPBAR"] ?? ""}
        </span>
        <p className="hud-login__hint" data-key="UI_CHAIN_OK">
          {props.strings["UI_CHAIN_OK"] ?? ""}
        </p>
        <button type="button" className="hud-btn hud-btn--primary" data-key="UI_CONNECT_WALLET" disabled={connecting} onClick={() => void onWallet()}>
          {props.strings["UI_CONNECT_WALLET"] ?? ""}
        </button>
        <button type="button" className="hud-btn hud-btn--secondary" data-key="UI_ENTER_DEMO" disabled={connecting} onClick={() => void onDemo()}>
          {props.strings["UI_ENTER_DEMO"] ?? ""}
        </button>
        {connecting ? <Loading kind="spinner_inline" /> : null}
        {code.length > 0 ? (
          <span data-key={code} className="hud-login__code" role="alert">
            {codeText}
          </span>
        ) : null}
      </section>
    </div>
  )
}
