import { useEffect, useRef, useState, type ReactElement } from "react"
import { parseJson, fromUtf8 } from "@corporator/contentpack"
import { commandTemplate, codes, stateTemplate } from "@corporator/protocol"
import type { ClientPack } from "../packview.js"
import { wallNowMs } from "../clock.js"
import { applyPath, nextIntentId, postCommand } from "../command.js"
import { snapshotFromEnvelope } from "../boot.js"
import { buildHud, type ClientSnapshot } from "./model.js"
import type { StringTable } from "../strings.js"
import type { HudFixture } from "../layout.js"
import type { Palette } from "../palette.js"
import { App } from "./App.js"
import { FontFaces } from "./parts/FontFaces.js"
import { hudNarrowLimit } from "./parts/shell.js"

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
  const [snap, setSnap] = useState(props.snapshot)
  const [narrow, setNarrow] = useState(false)
  const [drawer, setDrawer] = useState("")
  const seq = useRef(0n)
  const view = buildHud({
    pack: props.pack,
    strings: props.strings,
    snapshot: snap,
    nowMs,
    firstLoginMs,
    demo: props.demo,
  })

  useEffect(() => {
    const ms = Number(props.pack.clockIntervalMs)
    const id = window.setInterval(() => {
      setNowMs(wallNowMs())
    }, ms)
    return () => {
      window.clearInterval(id)
    }
  }, [props.pack.clockIntervalMs])

  useEffect(() => {
    function measure(): void {
      const limit = hudNarrowLimit(props.hud, props.pack.packSafeW)
      setNarrow(BigInt(window.innerWidth) < limit)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("resize", measure)
    }
  }, [props.hud, props.pack.packSafeW])

  async function fetchSnap(): Promise<ClientSnapshot> {
    const path = applyPath(stateTemplate, "city_id", props.cityId)
    const res = await fetch(props.origin + path)
    if (!res.ok) throw new Error(codes.API_PACK_STALE)
    const body = parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer())))
    return snapshotFromEnvelope(body)
  }

  async function onCommit(
    effect: string,
    extra?: { readonly [key: string]: import("@corporator/contentpack").Json },
  ): Promise<void> {
    seq.current += 1n
    const cmd = {
      origin: props.origin,
      effect,
      commandTemplate,
      cityId: props.cityId,
      sessionId: props.sessionId,
      intentId: nextIntentId(props.cityId, snap.cityTime, seq.current),
      expectedCityTime: snap.cityTime,
      post: async (url: string, body: Uint8Array, headers: { readonly [name: string]: string }) => {
        const copy = new ArrayBuffer(body.byteLength)
        new Uint8Array(copy).set(body)
        const res = await fetch(url, { method: "POST", body: copy, headers: { ...headers } })
        return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) }
      },
    }
    if (extra !== undefined) {
      await postCommand({ ...cmd, extra })
    } else {
      await postCommand(cmd)
    }
    setSnap(await fetchSnap())
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
        narrow={narrow}
        drawer={drawer}
        demo={props.demo}
        onDrawer={setDrawer}
        onCommit={(effect, extra) => {
          void onCommit(effect, extra)
        }}
      />
    </>
  )
}
