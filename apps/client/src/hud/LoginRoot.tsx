import { useState, type CSSProperties, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import type { StringTable } from "../strings.js"
import { openDemoSession, openWalletSession, type SessionOk } from "../session.js"
import { hudCssVars } from "../palette.js"
import type { Palette } from "../palette.js"
import { FontFaces } from "./parts/FontFaces.js"
import "./hud.css"

type WalletRequest = {
  request(args: { readonly method: string; readonly params?: readonly unknown[] }): Promise<unknown>
}

function walletOf(globalObj: unknown): WalletRequest | undefined {
  if (globalObj === null || typeof globalObj !== "object") return undefined
  const eth = (globalObj as { ethereum?: unknown }).ethereum
  if (eth === null || typeof eth !== "object") return undefined
  const req = (eth as { request?: unknown }).request
  if (typeof req !== "function") return undefined
  return {
    request: (args) => (req as WalletRequest["request"]).call(eth, args),
  }
}

async function post(url: string, body: Uint8Array): Promise<{ readonly status: number; readonly body: Uint8Array }> {
  const copy = new ArrayBuffer(body.byteLength)
  new Uint8Array(copy).set(body)
  const res = await fetch(url, { method: "POST", body: copy })
  return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) }
}

export function LoginRoot(props: {
  readonly origin: string
  readonly strings: StringTable
  readonly palette: Palette
  readonly onReady: (session: SessionOk) => void
}): ReactElement {
  const [code, setCode] = useState("")
  const vars = hudCssVars(props.palette)
  const pageBg = vars["--bg-panel"]
  const pageFg = vars["--text"]
  if (pageBg === undefined || pageFg === undefined) throw new Error(codes.API_MALFORMED)
  const geo: CSSProperties = { ...vars, background: pageBg, color: pageFg }

  async function onDemo(): Promise<void> {
    const got = await openDemoSession(props.origin, post)
    if (got === undefined) {
      setCode(codes.API_UNAUTHORIZED)
      return
    }
    props.onReady(got)
  }

  async function onWallet(): Promise<void> {
    const wallet = walletOf(globalThis)
    if (wallet === undefined) {
      setCode(codes.WALLET_NOT_CONNECTED)
      return
    }
    const accounts = await wallet.request({ method: "eth_requestAccounts" })
    if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
      setCode(codes.WALLET_NOT_CONNECTED)
      return
    }
    const address = accounts[0]
    const got = await openWalletSession({
      origin: props.origin,
      address,
      sign: async (message) => {
        const sig = await wallet.request({
          method: "personal_sign",
          params: [message, address],
        })
        if (typeof sig !== "string") throw new Error(codes.API_UNAUTHORIZED)
        return sig
      },
      post,
    })
    if (got === undefined) {
      setCode(codes.API_UNAUTHORIZED)
      return
    }
    props.onReady(got)
  }

  return (
    <div data-app="login" className="hud-root hud-login" style={geo}>
      <FontFaces />
      <section className="hud-panel hud-card hud-login__card">
        <span className="hud-brand" data-key="UI_BRAND">
          {props.strings["UI_BRAND"] ?? props.strings["UI_TOPBAR"] ?? ""}
        </span>
        <button type="button" data-key="UI_ENTER_DEMO" onClick={() => void onDemo()}>
          {props.strings["UI_ENTER_DEMO"] ?? ""}
        </button>
        <button type="button" data-key="UI_CONNECT_WALLET" onClick={() => void onWallet()}>
          {props.strings["UI_CONNECT_WALLET"] ?? ""}
        </button>
        {code.length > 0 ? <span data-key={code} className="hud-muted" /> : null}
      </section>
    </div>
  )
}
