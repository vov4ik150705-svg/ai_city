import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { clipOfflineHours } from "@corporator/engine"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import {
  autoLaunchFlow,
  buildHud,
  cityFlowKey,
  emptySnapshot,
  loadClientPack,
  loadLastCityTime,
  loadStringTable,
  offlineWindowOf,
  storeLastCityTime,
  sumHours,
  walletLoginPhase,
  type ClientSnapshot,
} from "../src/index.ts"
import { OfflineReturnScreen } from "../src/hud/screens/offline_return.tsx"
import { WalletConnectScreen } from "../src/hud/screens/wallet_connect.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import type { FlowStorage } from "../src/hud/flows.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function memStore(): FlowStorage {
  const bag = new Map<string, string>()
  return {
    getItem: (key) => (bag.has(key) ? (bag.get(key) ?? null) : null),
    setItem: (key, value) => {
      bag.set(key, value)
    },
  }
}

describe("H7 onboarding offline wallet", () => {
  const pack = loadClientPack(loadPack(packBytes()).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function viewOf(snap: ClientSnapshot = emptySnapshot()) {
    return buildHud({
      pack,
      strings,
      snapshot: snap,
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
  }

  function propsOf(extra?: Partial<ScreenProps>): ScreenProps {
    return {
      view: extra?.view ?? viewOf(),
      pack,
      strings,
      demo: true,
      failed: new Set(),
      loading: extra?.loading ?? false,
      onClose: () => {},
      onNavigate: () => {},
      pendingCell: "",
      pendingTileX: 0n,
      pendingTileY: 0n,
      onIntent: async () => {},
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
      ...extra,
    }
  }

  it("offline_shows_clip", () => {
    const flowsSrc = readFileSync(join(client, "src/hud/flows.ts"), "utf8")
    expect(flowsSrc.includes("clipOfflineHours")).toBe(true)
    expect(flowsSrc.includes("18n")).toBe(false)
    const screenSrc = readFileSync(join(client, "src/hud/screens/offline_return.tsx"), "utf8")
    expect(screenSrc.includes("commit:")).toBe(false)
    const window = offlineWindowOf(pack)
    const added = window.automationTotalHours + window.mergeHours
    expect(window.clippedHours).toBe(clipOfflineHours(window.baseHours, added, window.hardCapHours))
    expect(window.hardCapHours).toBe(window.baseHours + window.automationTotalHours)
    expect(window.mergeHours > 0n).toBe(true)
    expect(window.reachedCap).toBe(true)
    expect(window.clippedAwayHours > 0n).toBe(true)
    const html = renderToStaticMarkup(createElement(OfflineReturnScreen, propsOf({ demo: false })))
    expect(html.includes('data-offline="merge"')).toBe(false)
    expect(html.includes('data-offline="base"')).toBe(false)
    expect(html.includes("$")).toBe(false)
    expect(html.includes('data-key="UI_OFFLINE_CAUGHT_UP"')).toBe(true)
    expect(html.includes('data-action="offline_continue"')).toBe(true)
    expect(html.includes('data-effect="navigate"')).toBe(true)
    const noMerge = offlineWindowOf({ ...pack, offlineMergeHours: 0n })
    expect(noMerge.reachedCap).toBe(false)
    expect(clipOfflineHours(noMerge.baseHours, noMerge.automationTotalHours, noMerge.hardCapHours)).toBe(
      noMerge.hardCapHours,
    )
    const quiet = renderToStaticMarkup(
      createElement(OfflineReturnScreen, propsOf({ pack: { ...pack, offlineMergeHours: 0n }, demo: false })),
    )
    expect(quiet.includes(`data-key="${codes.IDLE_OFFLINE_CAP_REACHED}"`)).toBe(false)
    expect(quiet.includes('data-key="UI_OFFLINE_CAUGHT_UP"')).toBe(true)
  })

  it("wallet_one_path", () => {
    const loginSrc = readFileSync(join(client, "src/hud/LoginRoot.tsx"), "utf8")
    const walletSrc = readFileSync(join(client, "src/hud/screens/wallet_connect.tsx"), "utf8")
    const mainSrc = readFileSync(join(client, "src/main.tsx"), "utf8")
    // One wallet path: the EIP-1193 calls live in walletLogin.ts; LoginRoot and the
    // topbar flyout both go through loginWithWallet.
    const walletLoginSrc = readFileSync(join(client, "src/walletLogin.ts"), "utf8")
    const flyoutSrc = readFileSync(join(client, "src/hud/topbar/WalletFlyout.tsx"), "utf8")
    expect(walletLoginSrc.includes("eth_requestAccounts")).toBe(true)
    expect(walletLoginSrc.includes("eth_chainId")).toBe(true)
    expect(loginSrc.includes("loginWithWallet")).toBe(true)
    expect(loginSrc.includes("eth_requestAccounts")).toBe(false)
    expect(flyoutSrc.includes("eth_requestAccounts")).toBe(false)
    expect(flyoutSrc.includes("ethereum")).toBe(false)
    expect(loginSrc.includes("spinner_inline")).toBe(true)
    expect(walletSrc.includes("eth_requestAccounts")).toBe(false)
    expect(walletSrc.includes("ethereum")).toBe(false)
    expect(mainSrc.includes("LoginRoot")).toBe(true)
    expect(mainSrc.includes("WalletConnectScreen")).toBe(false)
    expect(pack.chainId > 0n).toBe(true)
    const html = renderToStaticMarkup(createElement(WalletConnectScreen, propsOf({ demo: false })))
    expect(html.includes('data-wallet-login="0"')).toBe(true)
    expect(html.includes('data-screen="wallet_connect"')).toBe(true)
    expect(walletLoginPhase({ hasWallet: false, connecting: false, expectedChain: pack.chainId, gotChain: undefined })).toBe(
      "missing",
    )
    expect(walletLoginPhase({ hasWallet: true, connecting: true, expectedChain: pack.chainId, gotChain: undefined })).toBe(
      "connecting",
    )
    expect(
      walletLoginPhase({
        hasWallet: true,
        connecting: false,
        expectedChain: pack.chainId,
        gotChain: pack.chainId + 1n,
      }),
    ).toBe("wrong_chain")
    expect(
      walletLoginPhase({
        hasWallet: true,
        connecting: false,
        expectedChain: pack.chainId,
        gotChain: pack.chainId,
      }),
    ).toBe("ready")
  })

  it("demo_progress_isolated", () => {
    const demoCity = "city-demo"
    const walletCity = "city-wallet"
    expect(cityFlowKey(demoCity)).not.toBe(cityFlowKey(walletCity))
    const store = memStore()
    storeLastCityTime(demoCity, 3n, store)
    expect(loadLastCityTime(demoCity, store)).toBe(3n)
    expect(loadLastCityTime(walletCity, store)).toBeUndefined()
    expect(autoLaunchFlow({ lastCityTime: undefined, cityTime: 4n })).toBe("")
    expect(autoLaunchFlow({ lastCityTime: 4n, cityTime: 4n })).toBe("")
    expect(autoLaunchFlow({ lastCityTime: 1n, cityTime: 4n })).toBe("offline_return")
    const src = readFileSync(join(client, "src/hud/flows.ts"), "utf8")
    expect(src.includes("onboard")).toBe(false)
    expect(sumHours(pack.offlineAutomationHours)).toBe(pack.offlineAutomationHours.reduce((a, b) => a + b, 0n))
  })
})
