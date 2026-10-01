import { useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { parseJson, fromUtf8, type Json } from "@corporator/contentpack"
import { commandTemplate, codes, stateTemplate, wsHeartbeatMs } from "@corporator/protocol"
import type { ClientPack } from "../packview.js"
import { wallNowMs, cityTimeFromWall, cityClockParts, resyncDue, resyncWaitMs } from "../clock.js"
import { applyPath, loadIntentSeq, postCommand, scopedIntentId, storeIntentSeq } from "../command.js"
import { snapshotFromEnvelope } from "../boot.js"
import { authHeaders } from "../session.js"
import {
  applyWsEvent,
  chainClockCarried,
  chainFieldsEmptyFor,
  cityWsUrl,
  openCitySocket,
  parseWsEvent,
  patchCarriesChainClock,
  socketResetsQuiet,
  staleWaitMs,
} from "./wsFeed.js"
import { buildHud, type ClientSnapshot } from "./model.js"
import type { StringTable } from "../strings.js"
import type { HudFixture } from "../layout.js"
import type { Palette } from "../palette.js"
import { App } from "./App.js"
import { FontFaces } from "./parts/FontFaces.js"
import { hudRootFontPx, hudSelectionNarrow } from "./parts/shell.js"
import { subscribeWalletIdentity, walletEmitterOf, walletOf } from "../walletLogin.js"
import {
  chainPayload,
  commandEffectOf,
  createLiveAdapter,
  dispatchFromEffect,
  transportOf,
  type CommitExtra,
  type LiveAdapterResult,
  type UiIntent,
  type UiIntentKind,
} from "./liveAdapter.js"
import { awaitingTxn, failTxn, waitingTxn, type UiTxnState } from "./uiState.js"
import { readPreparedCommand, runCsCommand } from "./walletTx.js"
import { beginExchangeBuy, liveQuoteExecutable } from "./screens/exchange.js"
import { beginPresent, voucherById, voucherFromSnapshot } from "./screens/bank.js"
import { autoLaunchFlow, loadLastCityTime, storeLastCityTime } from "./flows.js"

/** Wallet session control owned by main.tsx: address of the signed-in wallet ("" for
 * demo), connect (returns a protocol code, "" on success) and disconnect. */
export type WalletControl = {
  readonly address: string
  readonly connect: () => Promise<string>
  readonly disconnect: () => void
}

export function LiveRoot(props: {
  readonly origin: string
  readonly cityId: string
  readonly sessionId: string
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly hud: HudFixture
  readonly palette: Palette
  readonly snapshot: ClientSnapshot
  readonly demo: boolean
  readonly wallet?: WalletControl
}): ReactElement {
  const [anchorMs, setAnchorMs] = useState(() => wallNowMs())
  const [nowMs, setNowMs] = useState(() => wallNowMs())
  const [chromeNowMs, setChromeNowMs] = useState(() => wallNowMs())
  const [snap, setSnap] = useState(props.snapshot)
  const [narrow, setNarrow] = useState(false)
  const [drawer, setDrawer] = useState("")
  const [adapterStatus, setAdapterStatus] = useState("")
  const [adapterCode, setAdapterCode] = useState("")
  const [linkStale, setLinkStale] = useState(false)
  const [linkAgeMs, setLinkAgeMs] = useState(0n)
  const lastPulseRef = useRef(wallNowMs())
  const quietSinceRef = useRef(wallNowMs())
  const chainFreshRef = useRef<bigint | undefined>(chainClockCarried(props.snapshot) ? wallNowMs() : undefined)
  const txnSink = useRef<(state: UiTxnState) => void>(() => {})
  const [stockOut, setStockOut] = useState<string | undefined>(undefined)
  const seq = useRef(loadIntentSeq(props.sessionId))
  const [flowRoute] = useState(() =>
    autoLaunchFlow({
      lastCityTime: loadLastCityTime(props.cityId),
      cityTime: props.snapshot.cityTime,
    }),
  )
  const snapRef = useRef(snap)
  snapRef.current = snap
  const liveCityTime = useMemo(
    () =>
      cityTimeFromWall({
        anchorCityTime: snap.cityTime,
        anchorMs,
        nowMs,
        rateBps: props.pack.rateBps,
        bps: props.pack.bps,
      }),
    [snap.cityTime, anchorMs, nowMs, props.pack.rateBps, props.pack.bps],
  )
  const view = useMemo(
    () =>
      buildHud({
        pack: props.pack,
        strings: props.strings,
        snapshot: snap,
        nowMs: chromeNowMs,
        firstLoginMs: anchorMs,
        demo: props.demo,
      }),
    [props.pack, props.strings, snap, chromeNowMs, anchorMs, props.demo],
  )

  useEffect(() => {
    const pack = props.pack
    const ms = Number(pack.clockIntervalMs)
    const id = window.setInterval(() => {
      const next = wallNowMs()
      setNowMs(next)
      const hour = liveCityHour({ snap: snapRef.current, pack, anchorMs, nowMs: next })
      setChromeNowMs((prev) => {
        const prevHour = liveCityHour({ snap: snapRef.current, pack, anchorMs, nowMs: prev })
        return hour === prevHour ? prev : next
      })
    }, ms)
    return () => {
      window.clearInterval(id)
    }
  }, [props.pack, anchorMs])

  useEffect(() => {
    if (flowRoute.length > 0) return
    storeLastCityTime(props.cityId, props.snapshot.cityTime)
  }, [flowRoute, props.cityId, props.snapshot.cityTime])

  useEffect(() => {
    function measure(): void {
      const widthPx = BigInt(window.innerWidth)
      const rootFontPx = hudRootFontPx(getComputedStyle(document.documentElement).fontSize)
      setNarrow(
        hudSelectionNarrow({
          widthPx,
          hud: props.hud,
          packSafeW: props.pack.packSafeW,
          rootFontPx,
        }),
      )
    }
    measure()
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("resize", measure)
    }
  }, [props.hud, props.pack.packSafeW])

  useEffect(() => {
    seq.current = loadIntentSeq(props.sessionId)
  }, [props.sessionId])

  useEffect(() => {
    let closed = false
    let sock: WebSocket | undefined
    let retry: number | undefined
    function bytesOf(data: unknown): Uint8Array | undefined {
      if (typeof data === "string") return new TextEncoder().encode(data)
      if (data instanceof ArrayBuffer) return new Uint8Array(data)
      if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      return undefined
    }
    function connect(): void {
      if (closed) return
      const next = openCitySocket(cityWsUrl(props.origin, props.cityId), props.sessionId)
      sock = next
      next.addEventListener("open", () => {
        if (closed) return
        lastPulseRef.current = wallNowMs()
        setLinkStale(false)
        setLinkAgeMs(0n)
      })
      next.addEventListener("message", (ev) => {
        if (closed) return
        const bytes = bytesOf(ev.data)
        if (bytes === undefined) return
        const event = parseWsEvent(parseJson(fromUtf8(bytes)))
        if (event === undefined) return
        const seen = wallNowMs()
        lastPulseRef.current = seen
        setLinkStale(false)
        setLinkAgeMs(0n)
        const carried = event.kind === "patch" && patchCarriesChainClock(event.sections)
        const windowMs = resyncWaitMs({
          resyncTicks: props.pack.resyncTicks,
          tickHours: props.pack.offlineTickLengthHours,
          rateBps: props.pack.rateBps,
          bps: props.pack.bps,
        })
        const emptyFor = chainFieldsEmptyFor(chainFreshRef.current, seen, windowMs)
        if (socketResetsQuiet({ patchCarriesChain: carried, emptyForMs: emptyFor, windowMs })) {
          quietSinceRef.current = seen
        }
        if (carried) chainFreshRef.current = seen
        if (event.kind === "pulse") {
          if (event.packHash !== props.pack.hash) setAdapterCode(codes.API_PACK_STALE)
          return
        }
        setSnap((cur) => applyWsEvent(cur, event))
      })
      next.addEventListener("close", () => {
        if (closed) return
        const age = wallNowMs() - lastPulseRef.current
        setLinkStale(true)
        setLinkAgeMs(age < 0n ? 0n : age)
        retry = window.setTimeout(connect, Number(wsHeartbeatMs))
      })
    }
    connect()
    return () => {
      closed = true
      if (retry !== undefined) window.clearTimeout(retry)
      sock?.close()
    }
  }, [props.origin, props.cityId, props.pack, props.sessionId])

  function takeSnapshot(next: ClientSnapshot): void {
    const at = wallNowMs()
    if (chainClockCarried(next)) {
      chainFreshRef.current = at
      quietSinceRef.current = at
    }
    setAnchorMs(at)
    setSnap(next)
  }

  useEffect(() => {
    const wallet = props.wallet
    if (wallet === undefined || props.demo || wallet.address.length === 0) return
    const emitter = walletEmitterOf(globalThis)
    if (emitter === undefined) return
    return subscribeWalletIdentity({
      emitter,
      signedAddress: wallet.address,
      expectedChain: props.pack.chainId,
      onDrop: () => {
        wallet.disconnect()
      },
    })
  }, [props.demo, props.wallet, props.pack.chainId])

  async function refreshCityTime(): Promise<void> {
    try {
      const fresh = await fetchSnap()
      snapRef.current = fresh
      takeSnapshot(fresh)
    } catch {
      return
    }
  }

  useEffect(() => {
    const wait = resyncWaitMs({
      resyncTicks: props.pack.resyncTicks,
      tickHours: props.pack.offlineTickLengthHours,
      rateBps: props.pack.rateBps,
      bps: props.pack.bps,
    })
    if (wait <= 0n) return
    const ms = Number(wait)
    if (!Number.isSafeInteger(ms) || ms <= 0) return
    let cancelled = false
    const id = window.setInterval(() => {
      if (!resyncDue({ lastEventMs: quietSinceRef.current, nowMs: wallNowMs(), waitMs: wait })) return
      void fetchSnap()
        .then((fresh) => {
          if (cancelled) return
          takeSnapshot(fresh)
        })
        .catch(() => undefined)
    }, ms)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [props.pack, props.origin, props.cityId, props.sessionId])

  async function fetchSnap(): Promise<ClientSnapshot> {
    const path = applyPath(stateTemplate, "city_id", props.cityId)
    const res = await fetch(props.origin + path, { headers: { ...authHeaders(props.sessionId) } })
    if (!res.ok) throw new Error(codes.API_PACK_STALE)
    const body = parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer())))
    return snapshotFromEnvelope(body)
  }

  async function onIntent(intent: UiIntent, extra?: CommitExtra): Promise<LiveAdapterResult> {
    try {
      const fresh = await fetchSnap()
      snapRef.current = fresh
      takeSnapshot(fresh)
    } catch {
      // Keep the last snapshot; the adapter retries once on API_PACK_STALE.
    }
    if (intent.kind === "withdraw") return runWithdraw(intent, extra)
    if (intent.kind === "present_voucher") return runPresent(intent)
    if (intent.kind === "buy_stock") return runBuy(intent, extra)
    if (isChainSign(intent.kind, props.pack.launchDeployed)) {
      return runChainIntent(intent, extra)
    }
    return dispatchIntent(intent, extra)
  }

  async function dispatchIntent(intent: UiIntent, extra?: CommitExtra): Promise<LiveAdapterResult> {
    const adapter = createLiveAdapter({
      origin: props.origin,
      cityId: props.cityId,
      sessionId: props.sessionId,
      commandTemplate,
      postCommand,
      fetchSnapshot: fetchSnap,
      cityTime: () => snapRef.current.cityTime,
      nextSeq: () => {
        seq.current += 1n
        storeIntentSeq(props.sessionId, seq.current)
        return seq.current
      },
      launchReady: props.pack.launchDeployed,
      post: async (url, body, headers) => {
        const copy = new ArrayBuffer(body.byteLength)
        new Uint8Array(copy).set(body)
        const res = await fetch(url, { method: "POST", body: copy, headers: { ...headers } })
        return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) }
      },
    })
    setAdapterStatus("pending")
    setAdapterCode("")
    const result = extra === undefined ? await adapter.dispatch(intent) : await adapter.dispatch(intent, extra)
    if (result.kind === "applied") {
      takeSnapshot(result.snapshot)
      setAdapterStatus(result.kind)
      setAdapterCode("")
      return result
    }
    if (result.kind === "local") {
      setAdapterStatus(result.kind)
      setAdapterCode("")
      return result
    }
    setAdapterStatus(result.kind)
    setAdapterCode(result.code)
    throw new Error(result.code)
  }

  async function runWithdraw(intent: UiIntent, extra?: CommitExtra): Promise<LiveAdapterResult> {
    const posted = await postChain(intent, "withdraw", extra, {})
    const reply = readPreparedCommand(posted.body)
    if (reply.kind === "failed") throw new Error(reply.code)
    const snapshot = await fetchSnap()
    takeSnapshot(snapshot)
    setAdapterStatus("applied")
    setAdapterCode("")
    return { kind: "applied", intent: intent.kind, effect: "withdraw", snapshot, intentId: posted.intentId }
  }

  async function runPresent(intent: UiIntent): Promise<LiveAdapterResult> {
    let signed = false
    const clicked =
      intent.kind === "present_voucher" && intent.voucherId !== undefined && intent.voucherId.length > 0
        ? voucherById(snapRef.current.vouchers, intent.voucherId)
        : voucherFromSnapshot(snapRef.current.vouchers)
    try {
      await beginPresent({
        voucher: clicked,
        ...(snapRef.current.chainTimeS === undefined ? {} : { chainTimeS: snapRef.current.chainTimeS }),
        sign: async () => {
          signed = true
          await runChainIntent(intent)
        },
      })
    } catch (err) {
      const message = err instanceof Error && err.message.length > 0 ? err.message : codes.API_PACK_STALE
      txnSink.current(failTxn(message))
      return {
        kind: "failed",
        intent: intent.kind,
        effect: "present_voucher",
        code: message,
        httpStatus: 0,
        retryable: false,
        intentId: "",
      }
    }
    if (signed) {
      return {
        kind: "applied",
        intent: intent.kind,
        effect: "present_voucher",
        snapshot: snapRef.current,
        intentId: "",
      }
    }
    txnSink.current(failTxn("UI_NO_VOUCHER"))
    return {
      kind: "failed",
      intent: intent.kind,
      effect: "present_voucher",
      code: "UI_NO_VOUCHER",
      httpStatus: 0,
      retryable: false,
      intentId: "",
    }
  }

  async function runBuy(intent: UiIntent, extra?: CommitExtra): Promise<LiveAdapterResult> {
    const effect = commandEffectOf(intent.kind)
    if (effect === undefined) throw new Error(codes.FEATURE_NOT_IN_V1)
    const hopLive = liveQuoteExecutable(snapRef.current.quoteLive, snapRef.current.quoteAgeMs)
    const decimals = Number(props.pack.weiDecimals)
    const ran = await beginExchangeBuy({
      hopLive,
      post: async (fields) => {
        const posted = await postChain(intent, effect, extra, fields)
        return posted.body
      },
      wallet: walletOf(globalThis),
      from: props.wallet?.address ?? "",
      expectedChainId: props.pack.chainId,
      rpcUrl: props.pack.chainRpc,
      chainName: "Robinhood Chain",
      nativeSymbol: "ETH",
      nativeDecimals: Number.isSafeInteger(decimals) ? decimals : 0,
      pollMs: props.pack.receiptPollMs,
      timeoutMs: props.pack.receiptTimeoutMs,
      now: wallNowMs,
      sleep: sleepMs,
      beforeConfirm: refreshCityTime,
      onStep: (step) => {
        txnSink.current(step === "sign" ? awaitingTxn() : waitingTxn())
      },
    })
    if (ran.kind === "failed") {
      txnSink.current(failTxn(ran.code))
      throw new Error(ran.code)
    }
    if (ran.stockOut !== undefined) setStockOut(ran.stockOut)
    const snapshot = await fetchSnap()
    takeSnapshot(snapshot)
    setAdapterStatus("applied")
    setAdapterCode("")
    return { kind: "applied", intent: intent.kind, effect, snapshot, intentId: "" }
  }

  async function runChainIntent(intent: UiIntent, extra?: CommitExtra): Promise<LiveAdapterResult> {
    const effect = intent.kind === "present_voucher" ? "present_voucher" : commandEffectOf(intent.kind)
    if (effect === undefined) throw new Error(codes.FEATURE_NOT_IN_V1)
    txnSink.current(awaitingTxn())
    const decimals = Number(props.pack.weiDecimals)
    const ran = await runCsCommand({
      post: async (fields) => {
        const posted = await postChain(intent, effect, extra, fields)
        return posted.body
      },
      wallet: walletOf(globalThis),
      from: props.wallet?.address ?? "",
      expectedChainId: props.pack.chainId,
      rpcUrl: props.pack.chainRpc,
      chainName: "Robinhood Chain",
      nativeSymbol: "ETH",
      nativeDecimals: Number.isSafeInteger(decimals) ? decimals : 0,
      pollMs: props.pack.receiptPollMs,
      timeoutMs: props.pack.receiptTimeoutMs,
      now: wallNowMs,
      sleep: sleepMs,
      beforeConfirm: refreshCityTime,
      onStep: (step) => {
        txnSink.current(step === "sign" ? awaitingTxn() : waitingTxn())
      },
    })
    if (ran.kind === "failed") {
      setAdapterCode(ran.code)
      txnSink.current(failTxn(ran.code))
      throw new Error(ran.code)
    }
    if (ran.stockOut !== undefined) setStockOut(ran.stockOut)
    const snapshot = await fetchSnap()
    takeSnapshot(snapshot)
    setAdapterStatus("applied")
    setAdapterCode("")
    return { kind: "applied", intent: intent.kind, effect, snapshot, intentId: "" }
  }

  async function postChain(
    intent: UiIntent,
    effect: string,
    extra: CommitExtra | undefined,
    fields: { readonly [key: string]: Json },
  ): Promise<{ readonly intentId: string; readonly body: unknown }> {
    const intentId = scopedIntentId(props.cityId, props.sessionId, snapRef.current.cityTime, nextIntentSeq())
    const posted = await postCommand({
      origin: props.origin,
      effect,
      commandTemplate,
      cityId: props.cityId,
      sessionId: props.sessionId,
      intentId,
      expectedCityTime: snapRef.current.cityTime,
      extra: chainPayload(intent, extra, fields),
      post: async (url, body, headers) => {
        const copy = new ArrayBuffer(body.byteLength)
        new Uint8Array(copy).set(body)
        const res = await fetch(url, { method: "POST", body: copy, headers: { ...headers } })
        return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) }
      },
    })
    const body = parseJson(fromUtf8(posted.body))
    if (posted.status < 200 || posted.status >= 300) {
      const failed = readPreparedCommand(body)
      throw new Error(failed.kind === "failed" ? failed.code : codes.API_PACK_STALE)
    }
    return { intentId, body }
  }

  function nextIntentSeq(): bigint {
    seq.current += 1n
    storeIntentSeq(props.sessionId, seq.current)
    return seq.current
  }

  async function onCommit(effect: string, extra?: CommitExtra): Promise<LiveAdapterResult> {
    return dispatchFromEffect(onIntent, effect, extra)
  }

  return (
    <>
      <FontFaces pixelFamily={props.pack.fontPixelFamily} logFamily={props.pack.fontLogFamily} />
      <App
        view={view}
        pack={props.pack}
        strings={props.strings}
        hud={props.hud}
        palette={props.palette}
        tileW={props.pack.tileW}
        scene={props.pack.scene}
        cityTime={liveCityTime}
        narrow={narrow}
        drawer={drawer}
        demo={props.demo}
        adapterStatus={adapterStatus}
        adapterCode={adapterCode}
        {...(linkStale ? { linkStale: true, linkAgeMs, linkWaitMs: staleWaitMs(linkAgeMs) } : {})}
        onDrawer={setDrawer}
        onIntent={onIntent}
        onCommit={onCommit}
        bindTxn={(set) => {
          txnSink.current = set
        }}
        {...(stockOut === undefined ? {} : { stockOut })}
        initialRoute={flowRoute}
        cityId={props.cityId}
        {...(props.wallet === undefined ? {} : { wallet: props.wallet })}
      />
    </>
  )
}

function sleepMs(ms: bigint): Promise<void> {
  const delay = Number(ms)
  return new Promise((resolve) => {
    setTimeout(resolve, Number.isFinite(delay) && delay > 0 ? delay : 0)
  })
}

const CHAIN_SIGN: readonly UiIntentKind[] = [
  "deposit",
  "buy_stock",
  "stake",
  "unstake",
  "claim_unstaked",
  "claim_fragment",
  "claim_prize",
]

function isChainSign(kind: UiIntentKind, launchReady: boolean): boolean {
  if (transportOf(kind, launchReady) !== "live") return false
  for (const row of CHAIN_SIGN) {
    if (row === kind) return true
  }
  return false
}

function liveCityHour(args: {
  readonly snap: ClientSnapshot
  readonly pack: ClientPack
  readonly anchorMs: bigint
  readonly nowMs: bigint
}): bigint {
  return cityClockParts({
    cityTime: cityTimeFromWall({
      anchorCityTime: args.snap.cityTime,
      anchorMs: args.anchorMs,
      nowMs: args.nowMs,
      rateBps: args.pack.rateBps,
      bps: args.pack.bps,
    }),
    ticksDay: args.pack.ticksDay,
    anchorDay: args.pack.anchorDay,
    anchorWeekday: args.pack.anchorWeekday,
    weekDays: args.pack.weekDays,
  }).hour
}
