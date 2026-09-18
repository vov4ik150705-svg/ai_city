import { useEffect, useMemo, useRef, useState, type ReactElement } from "react"
import { parseJson, fromUtf8 } from "@corporator/contentpack"
import { commandTemplate, codes, stateTemplate } from "@corporator/protocol"
import type { ClientPack } from "../packview.js"
import { wallNowMs, cityTimeFromWall, cityClockParts } from "../clock.js"
import { applyPath, loadIntentSeq, postCommand, storeIntentSeq } from "../command.js"
import { snapshotFromEnvelope } from "../boot.js"
import { buildHud, type ClientSnapshot } from "./model.js"
import type { StringTable } from "../strings.js"
import type { HudFixture } from "../layout.js"
import type { Palette } from "../palette.js"
import { App } from "./App.js"
import { FontFaces } from "./parts/FontFaces.js"
import { hudRootFontPx, hudSelectionNarrow } from "./parts/shell.js"
import {
  createLiveAdapter,
  dispatchFromEffect,
  type CommitExtra,
  type LiveAdapterResult,
  type UiIntent,
} from "./liveAdapter.js"

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
}): ReactElement {
  const [firstLoginMs] = useState(() => wallNowMs())
  const [nowMs, setNowMs] = useState(() => wallNowMs())
  const [chromeNowMs, setChromeNowMs] = useState(() => wallNowMs())
  const [snap, setSnap] = useState(props.snapshot)
  const [narrow, setNarrow] = useState(false)
  const [drawer, setDrawer] = useState("")
  const [adapterStatus, setAdapterStatus] = useState("")
  const [adapterCode, setAdapterCode] = useState("")
  const seq = useRef(loadIntentSeq(props.sessionId))
  const snapRef = useRef(snap)
  snapRef.current = snap
  const liveCityTime = useMemo(
    () =>
      cityTimeFromWall({
        anchorCityTime: snap.cityTime,
        firstLoginMs,
        nowMs,
        rateBps: props.pack.rateBps,
        bps: props.pack.bps,
      }),
    [snap.cityTime, firstLoginMs, nowMs, props.pack.rateBps, props.pack.bps],
  )
  const view = useMemo(
    () =>
      buildHud({
        pack: props.pack,
        strings: props.strings,
        snapshot: snap,
        nowMs: chromeNowMs,
        firstLoginMs,
        demo: props.demo,
      }),
    [props.pack, props.strings, snap, chromeNowMs, firstLoginMs, props.demo],
  )

  useEffect(() => {
    const pack = props.pack
    const ms = Number(pack.clockIntervalMs)
    const id = window.setInterval(() => {
      const next = wallNowMs()
      setNowMs(next)
      const hour = liveCityHour({ snap: snapRef.current, pack, firstLoginMs, nowMs: next })
      setChromeNowMs((prev) => {
        const prevHour = liveCityHour({ snap: snapRef.current, pack, firstLoginMs, nowMs: prev })
        return hour === prevHour ? prev : next
      })
    }, ms)
    return () => {
      window.clearInterval(id)
    }
  }, [props.pack, firstLoginMs])

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

  async function fetchSnap(): Promise<ClientSnapshot> {
    const path = applyPath(stateTemplate, "city_id", props.cityId)
    const res = await fetch(props.origin + path)
    if (!res.ok) throw new Error(codes.API_PACK_STALE)
    const body = parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer())))
    return snapshotFromEnvelope(body)
  }

  async function onIntent(intent: UiIntent, extra?: CommitExtra): Promise<LiveAdapterResult> {
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
      setSnap(result.snapshot)
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
        onDrawer={setDrawer}
        onIntent={onIntent}
        onCommit={onCommit}
      />
    </>
  )
}

function liveCityHour(args: {
  readonly snap: ClientSnapshot
  readonly pack: ClientPack
  readonly firstLoginMs: bigint
  readonly nowMs: bigint
}): bigint {
  return cityClockParts({
    cityTime: cityTimeFromWall({
      anchorCityTime: args.snap.cityTime,
      firstLoginMs: args.firstLoginMs,
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
