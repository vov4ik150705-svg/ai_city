import { createRoot } from "react-dom/client"
import type { ReactElement } from "react"
import { codes, listenBind, listenPorts, packHash, packTemplate } from "@corporator/protocol"
import { parseJson, loadPack } from "@corporator/contentpack"
import { LiveRoot, type WalletControl } from "./hud/LiveRoot.js"
import { LoginRoot } from "./hud/LoginRoot.js"
import { apiOrigin, bootFromHost, originFromListen } from "./boot.js"
import { loadClientPack, loadHudFixture } from "./packview.js"
import { loadStringTable } from "./strings.js"
import { parsePalette, type Palette } from "./palette.js"
import type { SessionOk } from "./session.js"
import { applyPath } from "./command.js"
import { loginWithWallet, walletOf } from "./walletLogin.js"

import stringsUrl from "../../../content/strings/en.json?url"
import hudUrl from "../../../content/fixtures/hud_layout.json?url"
import paletteUrl from "../../../art/palette/corporator.hex?url"

async function fetchBytes(url: string, headers?: { readonly [name: string]: string }): Promise<Uint8Array> {
  const init = headers === undefined ? undefined : { headers: { ...headers } }
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(codes.API_PACK_STALE)
  return new Uint8Array(await res.arrayBuffer())
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(codes.API_PACK_STALE)
  return await res.text()
}

function BootError(props: { readonly code: string }): ReactElement {
  return <div data-app="boot-error" data-key={props.code} />
}

type Shell = {
  readonly root: ReturnType<typeof createRoot>
  readonly origin: string
  readonly strings: ReturnType<typeof loadStringTable>
  readonly palette: Palette
  readonly chainId: bigint
}

/** Live HUD for one session. The wallet control lets the topbar flyout swap the
 * session (demo -> wallet) or drop back to the login card; there is no Settings screen. */
async function mountLive(shell: Shell, session: SessionOk, address: string): Promise<ReactElement> {
  const result = await bootFromHost({
    origin: shell.origin,
    packHash,
    cityId: session.cityId,
    sessionId: session.sessionId,
    fetchBytes,
  })
  if (!result.ok) return <BootError code={result.code} />
  const pack = loadClientPack(result.packJson)
  const hud = loadHudFixture(parseJson(await fetchText(hudUrl)))
  const wallet: WalletControl = {
    address,
    connect: async () => {
      const got = await loginWithWallet({ origin: shell.origin, chainId: shell.chainId, wallet: walletOf(globalThis) })
      if (!got.ok) return got.code
      shell.root.render(await mountLive(shell, got.session, got.address))
      return ""
    },
    disconnect: () => {
      shell.root.render(loginElement(shell))
    },
  }
  return (
    <LiveRoot
      origin={shell.origin}
      cityId={session.cityId}
      sessionId={session.sessionId}
      pack={pack}
      strings={shell.strings}
      hud={hud}
      palette={shell.palette}
      snapshot={result.snapshot}
      demo={session.accountKind === "demo"}
      wallet={wallet}
    />
  )
}

function loginElement(shell: Shell): ReactElement {
  return (
    <LoginRoot
      origin={shell.origin}
      strings={shell.strings}
      palette={shell.palette}
      chainId={shell.chainId}
      onReady={(session, address) => {
        void mountLive(shell, session, address ?? "").then((el) => {
          shell.root.render(el)
        })
      }}
    />
  )
}

async function boot(): Promise<void> {
  const rootEl = document.getElementById("root")
  if (rootEl === null) throw new Error(codes.API_MALFORMED)
  const root = createRoot(rootEl)
  const origin = apiOrigin(
    originFromListen(listenBind, listenPorts.api),
    import.meta.env.VITE_CORPORATOR_API_ORIGIN,
  )
  const strings = loadStringTable(parseJson(await fetchText(stringsUrl)))
  const palette = parsePalette(await fetchText(paletteUrl))
  let chainId = 0n
  try {
    const packBytes = await fetchBytes(origin + applyPath(packTemplate, "pack_hash", packHash))
    chainId = loadClientPack(loadPack(packBytes).pack).chainId
  } catch {
    chainId = 0n
  }
  root.render(loginElement({ root, origin, strings, palette, chainId }))
}

void boot()
