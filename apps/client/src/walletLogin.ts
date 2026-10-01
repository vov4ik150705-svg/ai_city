import { codes } from "@corporator/protocol"
import { openWalletSession, type SessionOk } from "./session.js"
import { parseWalletChain, walletLoginPhase } from "./hud/flows.js"

export type WalletRequest = {
  request(args: { readonly method: string; readonly params?: readonly unknown[] }): Promise<unknown>
}

export type WalletLoginResult =
  | { readonly ok: true; readonly session: SessionOk; readonly address: string }
  | { readonly ok: false; readonly code: string }

/** Injected EIP-1193 provider, or undefined when no wallet extension is present. */
export function walletOf(globalObj: unknown): WalletRequest | undefined {
  if (globalObj === null || typeof globalObj !== "object") return undefined
  const eth = (globalObj as { ethereum?: unknown }).ethereum
  if (eth === null || typeof eth !== "object") return undefined
  const req = (eth as { request?: unknown }).request
  if (typeof req !== "function") return undefined
  return {
    request: (args) => (req as WalletRequest["request"]).call(eth, args),
  }
}

export async function postBytes(
  url: string,
  body: Uint8Array,
): Promise<{ readonly status: number; readonly body: Uint8Array }> {
  const copy = new ArrayBuffer(body.byteLength)
  const view = new Uint8Array(copy)
  view.set(body)
  const res = await fetch(url, { method: "POST", body: copy })
  return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) }
}

/** Ask the injected wallet for an account, check the chain, sign the nonce, open a session.
 * Every failure is a protocol code; nothing here pretends a session exists. */
export async function loginWithWallet(args: {
  readonly origin: string
  readonly chainId: bigint
  readonly wallet: WalletRequest | undefined
}): Promise<WalletLoginResult> {
  const wallet = args.wallet
  if (wallet === undefined) return { ok: false, code: codes.WALLET_NOT_CONNECTED }
  let accounts: unknown
  try {
    accounts = await wallet.request({ method: "eth_requestAccounts" })
  } catch {
    return { ok: false, code: codes.WALLET_NOT_CONNECTED }
  }
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
    return { ok: false, code: codes.WALLET_NOT_CONNECTED }
  }
  const address = accounts[0]
  let gotChain: bigint | undefined
  try {
    gotChain = parseWalletChain(await wallet.request({ method: "eth_chainId" }))
  } catch {
    gotChain = undefined
  }
  const phase = walletLoginPhase({
    hasWallet: true,
    connecting: false,
    expectedChain: args.chainId,
    gotChain,
  })
  if (phase === "wrong_chain") return { ok: false, code: codes.WALLET_WRONG_CHAIN }
  let session: SessionOk | undefined
  try {
    session = await openWalletSession({
      origin: args.origin,
      address,
      sign: async (message) => {
        const sig = await wallet.request({ method: "personal_sign", params: [message, address] })
        if (typeof sig !== "string") throw new Error(codes.API_UNAUTHORIZED)
        return sig
      },
      post: postBytes,
    })
  } catch {
    return { ok: false, code: codes.API_UNAUTHORIZED }
  }
  if (session === undefined) return { ok: false, code: codes.API_UNAUTHORIZED }
  return { ok: true, session, address }
}

type WalletEmitter = {
  on(event: string, cb: (value: unknown) => void): void
  removeListener?(event: string, cb: (value: unknown) => void): void
  off?(event: string, cb: (value: unknown) => void): void
}

/** Drop the city session when the extension account or chain is no longer the one that signed in. */
export function walletIdentityChanged(args: {
  readonly signedAddress: string
  readonly accounts: readonly string[] | undefined
  readonly chainId: bigint | undefined
  readonly expectedChain: bigint
}): boolean {
  if (args.accounts !== undefined) {
    const next = args.accounts[0]
    if (next === undefined || next.toLowerCase() !== args.signedAddress.toLowerCase()) return true
  }
  if (args.chainId !== undefined && args.chainId !== args.expectedChain) return true
  return false
}

export function walletEmitterOf(globalObj: unknown): WalletEmitter | undefined {
  if (globalObj === null || typeof globalObj !== "object") return undefined
  const eth = (globalObj as { ethereum?: unknown }).ethereum
  if (eth === null || typeof eth !== "object") return undefined
  const on = (eth as { on?: unknown }).on
  if (typeof on !== "function") return undefined
  return eth as WalletEmitter
}

export function subscribeWalletIdentity(args: {
  readonly emitter: WalletEmitter
  readonly signedAddress: string
  readonly expectedChain: bigint
  readonly onDrop: () => void
}): () => void {
  const onAccounts = (value: unknown): void => {
    const accounts = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    if (
      walletIdentityChanged({
        signedAddress: args.signedAddress,
        accounts,
        chainId: undefined,
        expectedChain: args.expectedChain,
      })
    ) {
      args.onDrop()
    }
  }
  const onChain = (value: unknown): void => {
    const chainId = parseWalletChain(value)
    if (chainId === undefined) {
      args.onDrop()
      return
    }
    if (
      walletIdentityChanged({
        signedAddress: args.signedAddress,
        accounts: undefined,
        chainId,
        expectedChain: args.expectedChain,
      })
    ) {
      args.onDrop()
    }
  }
  args.emitter.on("accountsChanged", onAccounts)
  args.emitter.on("chainChanged", onChain)
  return () => {
    if (typeof args.emitter.removeListener === "function") {
      args.emitter.removeListener("accountsChanged", onAccounts)
      args.emitter.removeListener("chainChanged", onChain)
      return
    }
    args.emitter.off?.("accountsChanged", onAccounts)
    args.emitter.off?.("chainChanged", onChain)
  }
}